-- ============================================================================
-- Migration 009 — apply pending (catch-up bundle)
-- 本番に未適用だった 005 硬化 / 007 延長 / 008 コメント制限 を 1 ファイルに集約。
-- Supabase Studio → SQL Editor に丸ごと貼って Run（ONCE でよいが、再実行しても安全）。
-- すべて idempotent（add column if not exists / create or replace / drop ... if exists）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (007) markets に延長メタ列を追加
-- ---------------------------------------------------------------------------
alter table public.markets
  add column if not exists extended_count   numeric not null default 0;
alter table public.markets
  add column if not exists last_extended_at timestamptz;

-- ---------------------------------------------------------------------------
-- (005 硬化) resolve_market — NULL-role bypass を is distinct from で防ぐ
-- ---------------------------------------------------------------------------
create or replace function public.resolve_market(p_market_id uuid, p_result text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if; -- NULL-safe（profiles 行が無い認証ユーザーも拒否）
  if p_result not in ('YES','NO') then raise exception 'BAD_RESULT'; end if;

  -- 市場の存在と未解決を確認（解決済みの再解決＝二重配当を防止）
  select status into v_status from public.markets where id = p_market_id for update;
  if v_status is null then raise exception 'MARKET_NOT_FOUND'; end if;
  if v_status = 'resolved' then raise exception 'ALREADY_RESOLVED'; end if;

  -- pay winners: 1 winning share = 1 point
  update public.profiles p
     set points = points + (case when p_result='YES' then pos.yes_shares else pos.no_shares end),
         xp     = xp     + (case when p_result='YES' then pos.yes_shares else pos.no_shares end)
    from public.positions pos
   where pos.market_id = p_market_id and pos.user_id = p.id;

  update public.markets set status='resolved', resolved=p_result where id = p_market_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (007) extend_market — closed の市場を未来の締切で open に戻す（admin only）
-- ---------------------------------------------------------------------------
create or replace function public.extend_market(p_market_id uuid, p_new_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  m public.markets%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role is distinct from 'admin' then raise exception 'ADMIN_REQUIRED'; end if;

  select * into m from public.markets where id = p_market_id for update;
  if not found then raise exception 'MARKET_NOT_FOUND'; end if;
  if m.status <> 'closed' then raise exception 'NOT_CLOSED'; end if;
  if p_new_deadline <= now() then raise exception 'DEADLINE_IN_PAST'; end if;

  update public.markets
     set status           = 'open',
         deadline         = p_new_deadline,
         extended_count   = extended_count + 1,
         last_extended_at = now()
   where id = p_market_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- (008) コメント長ガード — 空・巨大コメントをサーバー側でも拒否
-- ---------------------------------------------------------------------------
-- 既存データに 500 文字超があると ADD CONSTRAINT が失敗するため、先に切り詰める。
update public.comments
   set body = left(body, 500)
 where char_length(body) > 500;

alter table public.comments
  drop constraint if exists comments_body_len;

alter table public.comments
  add constraint comments_body_len
  check (char_length(btrim(body)) between 1 and 500);
