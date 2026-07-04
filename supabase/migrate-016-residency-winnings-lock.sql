-- supabase/migrate-016-residency-winnings-lock.sql
-- 居住国申告の記録 + ゲーム勝ち分の出金不可ロック
-- (docs/superpowers/specs/2026-07-05-residency-gate-winnings-lock-design.md)
-- Supabase Studio → SQL Editor に貼り付けて実行(migrate-012 / 015 の後に実行すること)
--
-- 方針:
--   A) ゲーム(Mines/Plinko)の純増分 greatest(payout - bet, 0) を bonus_locked に加算し、
--      「ゲームでは出金可能額(points - bonus_locked)を絶対に増やせない」構造にする。
--      ベット原資はロックしない(勝っても負けても往復で出金可能額は増えない)。
--      クランプトリガ(migrate-012)は変更しない。
--   B) 居住国申告 + 同意バージョンを profiles に記録する(機能制限はしない。記録のみ)。

-- ============================================================
-- B) 居住国申告の記録
-- ============================================================
alter table public.profiles
  add column if not exists residency text,
  add column if not exists residency_consent_version text,
  add column if not exists residency_consented_at timestamptz;

-- 居住国は ISO 3166-1 alpha-2 の国コード(例: JP / US / AU)で記録する
alter table public.profiles drop constraint if exists profiles_residency_check;
alter table public.profiles add constraint profiles_residency_check
  check (residency is null or residency ~ '^[A-Z]{2}$');

create or replace function public.declare_residency(p_residency text, p_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_residency is null or p_residency !~ '^[A-Z]{2}$'
    then raise exception 'BAD_RESIDENCY'; end if;
  if p_version is null or length(trim(p_version)) = 0
    then raise exception 'BAD_VERSION'; end if;
  update public.profiles
     set residency = p_residency,
         residency_consent_version = p_version,
         residency_consented_at = now()
   where id = v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
end $$;

revoke execute on function public.declare_residency(text, text) from public, anon;
grant execute on function public.declare_residency(text, text) to authenticated;

-- ============================================================
-- A-1) Plinko: 勝ち分ロック(migrate-011 の plinko_play を差し替え)
--      変更点は profiles 更新行の bonus_locked 加算のみ
-- ============================================================
create or replace function public.plinko_play(p_bet numeric, p_rows int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mult numeric[];
  v_points numeric;
  v_bucket int := 0;
  v_multiplier numeric;
  v_payout numeric;
  v_balance numeric;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet is null or p_bet < 1 or p_bet > 10000 then raise exception 'BAD_BET'; end if;
  select multipliers into v_mult from public.plinko_config where rows_count = p_rows;
  if not found then raise exception 'BAD_ROWS'; end if;
  select points into v_points from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_points < p_bet then raise exception 'INSUFFICIENT_POINTS'; end if;
  -- 抽選: 公正なコイントス p_rows 回(クライアントの旧 sampleBinomialBucket と同一モデル)
  for i in 1..p_rows loop
    if random() < 0.5 then v_bucket := v_bucket + 1; end if;
  end loop;
  v_multiplier := v_mult[v_bucket + 1]; -- PostgreSQL 配列は 1 始まり
  v_payout := round(p_bet * v_multiplier, 2);
  -- 勝ち分ロック: 純増分は出金不可枠へ
  update public.profiles
     set points = points + v_payout - p_bet,
         bonus_locked = bonus_locked + greatest(v_payout - p_bet, 0)
   where id = v_uid returning points into v_balance;
  insert into public.plinko_plays (user_id, bet, rows_count, bucket, multiplier, payout)
  values (v_uid, p_bet, p_rows, v_bucket, v_multiplier, v_payout);
  return json_build_object(
    'bucket', v_bucket, 'multiplier', v_multiplier,
    'payout', v_payout, 'balance', v_balance);
end $$;

-- ============================================================
-- A-2) Mines: 勝ち分ロック(migrate-015 の mines_reveal / mines_cashout を差し替え)
--      変更点は自動キャッシュアウト時と cashout 時の bonus_locked 加算のみ
-- ============================================================
create or replace function public.mines_reveal(p_game uuid, p_cell int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  g public.mines_games;
  v_mines int[];
  v_revealed int[];
  v_k int;
  v_fair numeric := 1;
  v_mult numeric;
  v_payout numeric;
  v_balance numeric;
  i int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 24 then raise exception 'BAD_CELL'; end if;
  select * into g from public.mines_games
   where id = p_game and user_id = v_uid for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status <> 'active' then raise exception 'GAME_FINISHED'; end if;
  if p_cell = any(g.revealed) then raise exception 'ALREADY_REVEALED'; end if;

  select mines into v_mines from public.mines_secrets where game_id = g.id;
  if v_mines is null then raise exception 'GAME_NOT_FOUND'; end if;

  if p_cell = any(v_mines) then
    -- トラップ: 没収確定・公開
    update public.mines_games
       set status = 'busted', payout = 0, mines = v_mines, finished_at = now()
     where id = g.id;
    delete from public.mines_secrets where game_id = g.id;
    return json_build_object(
      'safe', false, 'status', 'busted', 'multiplier', g.multiplier,
      'revealed', to_json(g.revealed), 'mines', to_json(v_mines));
  end if;

  v_revealed := g.revealed || p_cell;
  v_k := coalesce(array_length(v_revealed, 1), 0);
  for i in 0..(v_k - 1) loop
    v_fair := v_fair * (25 - i)::numeric / (25 - g.mines_count - i);
  end loop;
  v_mult := round(g.house_edge * v_fair, 4);

  if v_k = 25 - g.mines_count then
    -- 全ての安全マスを開け切った: 自動キャッシュアウト(勝ち分はロック)
    v_payout := round(g.bet * v_mult, 2);
    update public.profiles
       set points = points + v_payout,
           bonus_locked = bonus_locked + greatest(v_payout - g.bet, 0)
     where id = v_uid returning points into v_balance;
    update public.mines_games
       set status = 'cashed', revealed = v_revealed, multiplier = v_mult,
           payout = v_payout, mines = v_mines, finished_at = now()
     where id = g.id;
    delete from public.mines_secrets where game_id = g.id;
    return json_build_object(
      'safe', true, 'status', 'cashed', 'multiplier', v_mult, 'payout', v_payout,
      'balance', v_balance, 'revealed', to_json(v_revealed), 'mines', to_json(v_mines));
  end if;

  update public.mines_games set revealed = v_revealed, multiplier = v_mult where id = g.id;
  return json_build_object(
    'safe', true, 'status', 'active', 'multiplier', v_mult,
    'revealed', to_json(v_revealed));
end $$;

create or replace function public.mines_cashout(p_game uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  g public.mines_games;
  v_mines int[];
  v_payout numeric;
  v_balance numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into g from public.mines_games
   where id = p_game and user_id = v_uid for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status <> 'active' then raise exception 'GAME_FINISHED'; end if;
  if coalesce(array_length(g.revealed, 1), 0) < 1 then raise exception 'NO_REVEAL'; end if;

  select mines into v_mines from public.mines_secrets where game_id = g.id;
  v_payout := round(g.bet * g.multiplier, 2);
  -- 勝ち分ロック: 純増分は出金不可枠へ
  update public.profiles
     set points = points + v_payout,
         bonus_locked = bonus_locked + greatest(v_payout - g.bet, 0)
   where id = v_uid returning points into v_balance;
  update public.mines_games
     set status = 'cashed', payout = v_payout, mines = v_mines, finished_at = now()
   where id = g.id;
  delete from public.mines_secrets where game_id = g.id;
  return json_build_object(
    'payout', v_payout, 'multiplier', g.multiplier, 'balance', v_balance,
    'revealed', to_json(g.revealed), 'mines', to_json(v_mines));
end $$;
