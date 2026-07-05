-- supabase/migrate-017-plinko-integer-bet.sql
-- Plinko のベットを整数に限定する（Mines と挙動を揃える多層防御）
-- Supabase Studio → SQL Editor に貼り付けて実行（migrate-016 の後に実行すること）
--
-- 背景: mines_start は p_bet <> trunc(p_bet) で小数ベットを弾いていたが、
--       plinko_play は 1〜10000 の範囲のみで小数を許容していた（不整合）。
-- 変更点: BAD_BET 判定に整数チェックを追加するのみ。抽選・配当・勝ち分ロックは migrate-016 と同一。

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
  -- 整数ベットのみ許容（mines_start と同じ多層防御）
  if p_bet is null or p_bet < 1 or p_bet > 10000 or p_bet <> trunc(p_bet)
    then raise exception 'BAD_BET'; end if;
  select multipliers into v_mult from public.plinko_config where rows_count = p_rows;
  if not found then raise exception 'BAD_ROWS'; end if;
  select points, residency into v_points, v_residency
    from public.profiles where id = v_uid for update;
  if v_points is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_residency = 'JP' then raise exception 'REGION_BLOCKED'; end if;
  if v_points < p_bet then raise exception 'INSUFFICIENT_POINTS'; end if;
  -- 抽選: 公正なコイントス p_rows 回
  for i in 1..p_rows loop
    if random() < 0.5 then v_bucket := v_bucket + 1; end if;
  end loop;
  v_multiplier := v_mult[v_bucket + 1]; -- PostgreSQL 配列は 1 始まり
  v_payout := round(p_bet * v_multiplier, 2);
  -- 勝ち分ロック: 純増分は出金不可枠へ（migrate-016）
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

-- 念のため再revoke/grant（create or replace はACLを維持するが、単体実行時の保険）
revoke execute on function public.plinko_play(numeric, int) from public, anon;
grant execute on function public.plinko_play(numeric, int) to authenticated;
