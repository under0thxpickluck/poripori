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
--   B) 居住国申告 + 同意バージョンを profiles に記録する。
--   C) 居住国 = 日本(JP)のユーザーは参加不可: クライアントは全画面遮断、
--      サーバーは価値移転系RPC(mines_start / plinko_play / ep_begin_withdraw)を
--      REGION_BLOCKED で拒否する。

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
-- C) 日本居住者の参加遮断
--    mines_start(migrate-015 の定義 + residency チェック)
-- ============================================================
create or replace function public.mines_start(p_bet numeric, p_mines int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_points numeric;
  v_residency text;
  v_edge numeric;
  v_mines int[];
  v_game public.mines_games;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet is null or p_bet < 1 or p_bet > 10000 or p_bet <> trunc(p_bet)
    then raise exception 'BAD_BET'; end if;
  if p_mines is null or p_mines < 1 or p_mines > 24 then raise exception 'BAD_MINES'; end if;
  if exists (select 1 from public.mines_games where user_id = v_uid and status = 'active')
    then raise exception 'GAME_ACTIVE'; end if;

  select points, residency into v_points, v_residency
    from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_residency = 'JP' then raise exception 'REGION_BLOCKED'; end if;
  if v_points < p_bet then raise exception 'INSUFFICIENT_POINTS'; end if;
  select house_edge into v_edge from public.mines_config where id = 1;
  if v_edge is null then v_edge := 0.95; end if;

  update public.profiles set points = points - p_bet where id = v_uid;

  select array_agg(x) into v_mines
    from (select x from generate_series(0, 24) as x order by random() limit p_mines) s;

  begin
    insert into public.mines_games (user_id, bet, mines_count, house_edge)
    values (v_uid, p_bet, p_mines, v_edge)
    returning * into v_game;
  exception when unique_violation then
    raise exception 'GAME_ACTIVE';
  end;
  insert into public.mines_secrets (game_id, mines) values (v_game.id, v_mines);

  return json_build_object(
    'id', v_game.id, 'bet', v_game.bet, 'mines_count', v_game.mines_count,
    'house_edge', v_game.house_edge, 'revealed', to_json(v_game.revealed),
    'multiplier', v_game.multiplier, 'status', v_game.status,
    'balance', v_points - p_bet);
end $$;

-- ============================================================
-- C) ep_begin_withdraw(migrate-014 の定義 + residency チェック)
-- ============================================================
create or replace function public.ep_begin_withdraw(
  p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_points numeric; v_locked numeric; v_residency text; v_limit numeric; v_today numeric;
begin
  if p_ep <= 0 or p_points <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select points, bonus_locked, residency into v_points, v_locked, v_residency
    from public.profiles where id = p_user for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_residency = 'JP' then raise exception 'REGION_BLOCKED'; end if;
  if v_points < p_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  -- 特典ロック枠: 出金可能額（points - bonus_locked）を超える出金は拒否
  if v_points - coalesce(v_locked, 0) < p_points then raise exception 'BONUS_LOCKED'; end if;
  -- 日次上限（Asia/Tokyo の暦日で集計）
  select daily_withdraw_ep into v_limit from public.ep_config where id = 1;
  if v_limit is not null then
    select coalesce(sum(ep_amount), 0) into v_today
      from public.ep_transfers
     where user_id = p_user
       and direction = 'out'
       and status in ('pending', 'completed')
       and (created_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date;
    if v_today + p_ep > v_limit then raise exception 'DAILY_LIMIT'; end if;
  end if;
  update public.profiles set points = points - p_points where id = p_user;
  insert into public.ep_transfers
    (user_id, salon_group, salon_login_id, direction, ep_amount, points_delta, idempotency_key)
  values (p_user, p_group, p_login_id, 'out', p_ep, -p_points, p_key)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.ep_begin_withdraw(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;

-- ============================================================
-- A-1) Plinko: 勝ち分ロック + 日本居住者遮断(migrate-011 の plinko_play を差し替え)
-- ============================================================
create or replace function public.plinko_play(p_bet numeric, p_rows int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mult numeric[];
  v_points numeric;
  v_residency text;
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
  select points, residency into v_points, v_residency
    from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_residency = 'JP' then raise exception 'REGION_BLOCKED'; end if;
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
