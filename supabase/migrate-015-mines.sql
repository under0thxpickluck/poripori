-- supabase/migrate-015-mines.sql
-- Mines（宝石堀り）× MIRAIX ポイント連携（docs/superpowers/specs/2026-07-04-mines-game-design.md）
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-014 の後に実行すること）
--
-- 不正防止の原則:
--   地雷位置はプレイ中 mines_secrets（RLSポリシー無し=クライアントから読めない）にのみ存在し、
--   終局時に初めて mines_games.mines へ書き込んで公開する。
--   倍率式: multiplier = round(house_edge × Π_{i=0..k-1}(25−i)/(25−m−i), 4)
--   house_edge はゲーム開始時に mines_config から凍結（プレイ中の設定変更は進行中ゲームに影響しない）

-- 1) 設定（1行のみ。読み取りは全員可・変更は admin RPC のみ）
create table if not exists public.mines_config (
  id         int primary key check (id = 1),
  house_edge numeric not null default 0.95 check (house_edge >= 0.10 and house_edge <= 1.50)
);
insert into public.mines_config (id, house_edge) values (1, 0.95)
on conflict (id) do nothing;

alter table public.mines_config enable row level security;
drop policy if exists mines_config_read on public.mines_config;
create policy mines_config_read on public.mines_config for select using (true);

-- 2) ゲーム台帳（本人のみ閲覧可。mines 列は終局まで NULL）
create table if not exists public.mines_games (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  bet         numeric not null check (bet > 0),
  mines_count int not null check (mines_count between 1 and 24),
  house_edge  numeric not null,
  revealed    int[] not null default '{}',
  status      text not null default 'active' check (status in ('active','busted','cashed')),
  multiplier  numeric not null default 1,
  payout      numeric,
  mines       int[],
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists mines_games_user_idx on public.mines_games(user_id, created_at desc);
-- 同時に active なゲームは1人1つまで（DB保証）
create unique index if not exists mines_games_one_active_uidx
  on public.mines_games(user_id) where status = 'active';

alter table public.mines_games enable row level security;
drop policy if exists mines_games_select_own on public.mines_games;
create policy mines_games_select_own on public.mines_games
  for select using (auth.uid() = user_id);
-- insert/update/delete のポリシーは作らない（RPC 経由のみ）

-- 3) プレイ中の地雷位置（RLS有効・ポリシー無し = SECURITY DEFINER 関数のみが読める）
create table if not exists public.mines_secrets (
  game_id uuid primary key references public.mines_games(id) on delete cascade,
  mines   int[] not null
);
alter table public.mines_secrets enable row level security;

-- 4) 開始: ベット即時減算 → 地雷を乱択して secrets へ
create or replace function public.mines_start(p_bet numeric, p_mines int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_points numeric;
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

  select points into v_points from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
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

-- 5) 1マス開示。地雷なら没収確定、全安全マス開放で自動キャッシュアウト
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
    -- 罠: 没収確定・地雷公開
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
    -- 全ての安全マスを開け切った: 自動キャッシュアウト
    v_payout := round(g.bet * v_mult, 2);
    update public.profiles set points = points + v_payout
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

-- 6) キャッシュアウト（1マス以上開示済みが条件）
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
  update public.profiles set points = points + v_payout
   where id = v_uid returning points into v_balance;
  update public.mines_games
     set status = 'cashed', payout = v_payout, mines = v_mines, finished_at = now()
   where id = g.id;
  delete from public.mines_secrets where game_id = g.id;
  return json_build_object(
    'payout', v_payout, 'multiplier', g.multiplier, 'balance', v_balance,
    'revealed', to_json(g.revealed), 'mines', to_json(v_mines));
end $$;

-- 7) 管理者: ハウスエッジ変更（0.10〜1.50 をサーバーで強制）
create or replace function public.admin_mines_set_house_edge(p_edge numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if p_edge is null or p_edge < 0.10 or p_edge > 1.50 then raise exception 'RTP_OUT_OF_RANGE'; end if;
  update public.mines_config set house_edge = p_edge where id = 1;
end $$;

-- 8) ACL
revoke execute on function public.mines_start(numeric, int) from public, anon;
revoke execute on function public.mines_reveal(uuid, int) from public, anon;
revoke execute on function public.mines_cashout(uuid) from public, anon;
revoke execute on function public.admin_mines_set_house_edge(numeric) from public, anon;
grant execute on function public.mines_start(numeric, int) to authenticated;
grant execute on function public.mines_reveal(uuid, int) to authenticated;
grant execute on function public.mines_cashout(uuid) to authenticated;
grant execute on function public.admin_mines_set_house_edge(numeric) to authenticated;
