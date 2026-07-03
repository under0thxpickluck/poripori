-- supabase/migrate-011-plinko.sql
-- Plinko × MIRAIX ポイント連携(docs/superpowers/specs/2026-07-03-plinko-miraix-integration-design.md)
-- Supabase Studio → SQL Editor に貼り付けて実行(migrate-010 と同じ運用)

-- 1) 倍率テーブル設定(単一の真実。ゲーム表示・配当計算・管理画面が全てここを参照)
create table if not exists public.plinko_config (
  rows_count  int primary key,
  multipliers numeric[] not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id)
);

alter table public.plinko_config enable row level security;
drop policy if exists plinko_config_read on public.plinko_config;
create policy plinko_config_read on public.plinko_config for select using (true);
-- insert/update/delete のポリシーは作らない(変更は admin RPC 経由のみ)

-- 既定値: school_repo の generateMultipliers(8段95%⇔16段90% 線形補間, GROWTH=2.0)の出力
insert into public.plinko_config (rows_count, multipliers) values
  (8,  '{5.7,2.9,1.4,0.72,0.38,0.72,1.4,2.9,5.7}'),
  (10, '{9.7,4.9,2.4,1.2,0.61,0.33,0.61,1.2,2.4,4.9,9.7}'),
  (12, '{17,8.3,4.2,2.1,1,0.52,0.29,0.52,1,2.1,4.2,8.3,17}'),
  (14, '{29,14,7.1,3.6,1.8,0.89,0.45,0.21,0.45,0.89,1.8,3.6,7.1,14,29}'),
  (16, '{49,25,12,6.2,3.1,1.5,0.77,0.38,0.22,0.38,0.77,1.5,3.1,6.2,12,25,49}')
on conflict (rows_count) do nothing;

-- 2) プレイ台帳(ep_transfers と同じ運用: クライアント書き込み不可)
create table if not exists public.plinko_plays (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  bet        numeric not null,
  rows_count int not null,
  bucket     int not null,
  multiplier numeric not null,
  payout     numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists plinko_plays_user_idx
  on public.plinko_plays(user_id, created_at desc);

alter table public.plinko_plays enable row level security;
drop policy if exists plinko_plays_select_own on public.plinko_plays;
create policy plinko_plays_select_own on public.plinko_plays
  for select using (auth.uid() = user_id);

-- 3) プレイ: 検証→抽選(二項分布)→配当→残高更新→台帳記録 を1トランザクションで
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
  update public.profiles set points = points + v_payout - p_bet
   where id = v_uid returning points into v_balance;
  insert into public.plinko_plays (user_id, bet, rows_count, bucket, multiplier, payout)
  values (v_uid, p_bet, p_rows, v_bucket, v_multiplier, v_payout);
  return json_build_object(
    'bucket', v_bucket, 'multiplier', v_multiplier,
    'payout', v_payout, 'balance', v_balance);
end $$;

revoke execute on function public.plinko_play(numeric, int) from public, anon;
grant execute on function public.plinko_play(numeric, int) to authenticated;

-- 4) 管理者: 倍率テーブル変更(RTP 10%〜150% をサーバーで強制)
create or replace function public.admin_plinko_set_multipliers(p_rows int, p_multipliers numeric[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rtp numeric := 0;
  v_coeff numeric := 1; -- C(p_rows, k) を漸化式で計算
  k int;
  m numeric;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from public.plinko_config where rows_count = p_rows)
    then raise exception 'BAD_ROWS'; end if;
  if array_length(p_multipliers, 1) is distinct from p_rows + 1
    then raise exception 'BAD_MULTIPLIERS'; end if;
  for k in 0..p_rows loop
    m := p_multipliers[k + 1];
    if m is null or m < 0 then raise exception 'BAD_MULTIPLIERS'; end if;
    v_rtp := v_rtp + v_coeff * m;
    v_coeff := v_coeff * (p_rows - k) / (k + 1); -- C(n,k) → C(n,k+1)
  end loop;
  v_rtp := v_rtp / power(2::numeric, p_rows);
  if v_rtp < 0.10 or v_rtp > 1.50 then raise exception 'RTP_OUT_OF_RANGE'; end if;
  update public.plinko_config
     set multipliers = p_multipliers, updated_at = now(), updated_by = auth.uid()
   where rows_count = p_rows;
end $$;

revoke execute on function public.admin_plinko_set_multipliers(int, numeric[]) from public, anon;
grant execute on function public.admin_plinko_set_multipliers(int, numeric[]) to authenticated;
