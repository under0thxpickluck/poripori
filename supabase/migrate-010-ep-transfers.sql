-- supabase/migrate-010-ep-transfers.sql
-- EPクロス連動 Phase 1（docs/superpowers/specs/2026-07-01-ep-cross-salon-integration-design.md）
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-009 と同じ運用）

-- 1) profiles にサロン連携列
alter table public.profiles
  add column if not exists salon_group    text,
  add column if not exists salon_login_id text;

create unique index if not exists profiles_salon_identity_uidx
  on public.profiles (salon_group, salon_login_id)
  where salon_login_id is not null;

-- 2) EP転送台帳
create table if not exists public.ep_transfers (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  salon_group     text not null,
  salon_login_id  text not null,
  direction       text not null check (direction in ('in','out')),
  ep_amount       numeric not null check (ep_amount > 0),
  points_delta    numeric not null,
  idempotency_key text not null unique,
  status          text not null default 'pending'
                    check (status in ('pending','completed','failed','reversed')),
  gas_result      jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists ep_transfers_user_idx
  on public.ep_transfers(user_id, created_at desc);

alter table public.ep_transfers enable row level security;
drop policy if exists ep_transfers_select_own on public.ep_transfers;
create policy ep_transfers_select_own on public.ep_transfers
  for select using (auth.uid() = user_id);
-- insert/update/delete のポリシーは作らない（クライアント書き込み不可。service_role はRLSを通過する）

-- 3) 入金完了: GAS deduct_ep 成功後に points加算 + completed を原子的に行う
create or replace function public.ep_complete_deposit(p_transfer uuid, p_gas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.ep_transfers
   where id = p_transfer and status = 'pending' and direction = 'in'
   for update;
  if not found then raise exception 'TRANSFER_NOT_PENDING'; end if;
  update public.profiles set points = points + t.points_delta where id = t.user_id;
  update public.ep_transfers set status = 'completed', gas_result = p_gas where id = p_transfer;
end $$;

-- 4) 出金開始: points を先に減算して pending 行を作る（原子的）
create or replace function public.ep_begin_withdraw(
  p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_points numeric;
begin
  if p_ep <= 0 or p_points <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select points into v_points from public.profiles where id = p_user for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_points < p_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  update public.profiles set points = points - p_points where id = p_user;
  insert into public.ep_transfers
    (user_id, salon_group, salon_login_id, direction, ep_amount, points_delta, idempotency_key)
  values (p_user, p_group, p_login_id, 'out', p_ep, -p_points, p_key)
  returning id into v_id;
  return v_id;
end $$;

-- 5) 出金確定/失敗: 失敗時は points を戻す（原子的）
create or replace function public.ep_finish_withdraw(p_transfer uuid, p_ok boolean, p_gas jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select * into t from public.ep_transfers
   where id = p_transfer and status = 'pending' and direction = 'out'
   for update;
  if not found then raise exception 'TRANSFER_NOT_PENDING'; end if;
  if p_ok then
    update public.ep_transfers set status = 'completed', gas_result = p_gas where id = p_transfer;
  else
    update public.profiles set points = points - t.points_delta where id = t.user_id; -- points_delta は負なので減算=返金
    update public.ep_transfers set status = 'failed', gas_result = p_gas where id = p_transfer;
  end if;
end $$;

-- 6) クライアントから実行不可にする（Edge Function の service_role のみが呼ぶ）
revoke execute on function public.ep_complete_deposit(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.ep_begin_withdraw(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;
revoke execute on function public.ep_finish_withdraw(uuid, boolean, jsonb) from public, anon, authenticated;
