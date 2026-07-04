-- supabase/migrate-014-withdraw-daily-limit.sql
-- サロンEPへの出金に日次上限を設ける（ロック侵食対策の実害上限）
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-012 の後に実行すること）
--
-- ルール:
--   当日（Asia/Tokyo 基準）の direction='out' かつ status in ('pending','completed') の
--   ep_amount 合計 + 今回申請額 が daily_withdraw_ep を超える出金は DAILY_LIMIT で拒否。
--   failed / reversed は返金済みなので集計に含めない。
--   上限は ep_config.daily_withdraw_ep（初期 1,000 MR/日。0 で出金停止）。

-- 1) 設定テーブル（1行のみ。読み取りは全員可・変更は admin RPC のみ）
create table if not exists public.ep_config (
  id                int primary key check (id = 1),
  daily_withdraw_ep numeric not null default 1000 check (daily_withdraw_ep >= 0)
);
insert into public.ep_config (id, daily_withdraw_ep) values (1, 1000)
on conflict (id) do nothing;

alter table public.ep_config enable row level security;
drop policy if exists ep_config_read on public.ep_config;
create policy ep_config_read on public.ep_config for select using (true);
-- insert/update/delete のポリシーは作らない（変更は admin RPC 経由のみ）

-- 2) 管理者: 上限変更
create or replace function public.admin_set_daily_withdraw_ep(p_limit numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if p_limit is null or p_limit < 0 then raise exception 'BAD_LIMIT'; end if;
  update public.ep_config set daily_withdraw_ep = p_limit where id = 1;
end $$;

revoke execute on function public.admin_set_daily_withdraw_ep(numeric) from public, anon;
grant execute on function public.admin_set_daily_withdraw_ep(numeric) to authenticated;

-- 3) 出金開始を日次上限込みでチェックするよう差し替え
--    （migrate-012 の ep_begin_withdraw を置換。BONUS_LOCKED チェックは維持）
create or replace function public.ep_begin_withdraw(
  p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_points numeric; v_locked numeric; v_limit numeric; v_today numeric;
begin
  if p_ep <= 0 or p_points <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select points, bonus_locked into v_points, v_locked
    from public.profiles where id = p_user for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
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

-- 念のため再revoke（create or replace はACLを維持するが、単体実行時の保険）
revoke execute on function public.ep_begin_withdraw(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;
