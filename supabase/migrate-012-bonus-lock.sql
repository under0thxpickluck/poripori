-- supabase/migrate-012-bonus-lock.sql
-- 新規登録特典（1,000MR）のサロンEPへの出金を禁止するロック枠
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-010 の後に実行すること）
--
-- ルール（ロー・ウォーターマーク方式）:
--   出金可能MR = points - bonus_locked
--   bonus_locked は特典付与額で始まり、points がそれを下回ったら追従して減る（復活しない）。
--   → 特典そのものは出金できないが、特典を使って増えた分・サロンから入金した分は出金できる。

-- 1) profiles にロック枠列（新規行はスキーマ既定の初期1000ptに合わせて1000）
alter table public.profiles
  add column if not exists bonus_locked numeric not null default 1000;

-- 既存ユーザーの backfill: 初期付与1000を上限に現残高でクランプ
update public.profiles
   set bonus_locked = greatest(0, least(1000, points));

-- 2) points 減少時に bonus_locked を追従させるトリガ
create or replace function public.clamp_bonus_locked()
returns trigger language plpgsql as $$
begin
  new.bonus_locked := greatest(0, least(new.bonus_locked, new.points));
  return new;
end $$;

drop trigger if exists profiles_clamp_bonus_locked_upd on public.profiles;
create trigger profiles_clamp_bonus_locked_upd
  before update of points, bonus_locked on public.profiles
  for each row execute function public.clamp_bonus_locked();

drop trigger if exists profiles_clamp_bonus_locked_ins on public.profiles;
create trigger profiles_clamp_bonus_locked_ins
  before insert on public.profiles
  for each row execute function public.clamp_bonus_locked();

-- 3) 出金開始をロック枠込みでチェックするよう差し替え
--    （migrate-010 の ep_begin_withdraw を置換。ACL=クライアント実行不可 は維持される）
create or replace function public.ep_begin_withdraw(
  p_user uuid, p_ep numeric, p_points numeric, p_key text, p_group text, p_login_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_points numeric; v_locked numeric;
begin
  if p_ep <= 0 or p_points <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  select points, bonus_locked into v_points, v_locked
    from public.profiles where id = p_user for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_points < p_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  -- 特典ロック枠: 出金可能額（points - bonus_locked）を超える出金は拒否
  if v_points - coalesce(v_locked, 0) < p_points then raise exception 'BONUS_LOCKED'; end if;
  update public.profiles set points = points - p_points where id = p_user;
  insert into public.ep_transfers
    (user_id, salon_group, salon_login_id, direction, ep_amount, points_delta, idempotency_key)
  values (p_user, p_group, p_login_id, 'out', p_ep, -p_points, p_key)
  returning id into v_id;
  return v_id;
end $$;

-- 念のため再revoke（create or replace はACLを維持するが、単体実行時の保険）
revoke execute on function public.ep_begin_withdraw(uuid, numeric, numeric, text, text, text) from public, anon, authenticated;
