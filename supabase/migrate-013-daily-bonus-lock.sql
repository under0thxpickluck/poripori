-- supabase/migrate-013-daily-bonus-lock.sql
-- デイリーボーナスのサロンEP出金漏れ対策
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-012 の後に実行すること）
--
-- 背景: 出金可能MR = points - bonus_locked（migrate-012 ロー・ウォーターマーク方式）。
-- デイリーボーナス（最大400MR/日）は points だけを増やしていたため、
-- 無償付与分がそのままサロンEPへ出金できてしまう漏れがあった（E2Eで+1EP漏れを実測）。
--
-- 対策: 付与額を bonus_locked にも同額加算する。
-- 新規登録特典と同じ原則 —— ボーナスそのものは出金不可、
-- ボーナスを使って増えた分・サロンから入金した分は出金可。
-- （bonus_locked は profiles のクランプトリガ（migrate-012）で常に 0〜points に収まる）

create or replace function public.claim_daily_bonus()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_last date;
  v_streak int;
  v_amount numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select last_bonus, bonus_streak into v_last, v_streak from public.profiles where id = v_uid for update;
  if v_last = current_date then
    return json_build_object('claimed', false);
  end if;
  if v_last = current_date - 1 then v_streak := coalesce(v_streak,0) + 1; else v_streak := 1; end if;
  v_amount := 100 + least(v_streak - 1, 6) * 50;
  update public.profiles
     set points = points + v_amount, xp = xp + v_amount,
         -- ボーナス分は出金不可枠へ（サロンEPへの出金可能額を増やさない）
         bonus_locked = coalesce(bonus_locked, 0) + v_amount,
         last_bonus = current_date, bonus_streak = v_streak
   where id = v_uid;
  return json_build_object('claimed', true, 'amount', v_amount, 'streak', v_streak);
end;
$$;
