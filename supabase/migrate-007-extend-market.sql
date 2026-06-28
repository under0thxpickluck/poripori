-- ============================================================================
-- migrate-007: 市場の締切延長／再開（extend_market）
-- closed の市場を、新しい未来の締切で open に戻す。Supabase Studio で実行。
-- ============================================================================

-- 1) 軽量記録の列
alter table public.markets add column if not exists extended_count   int not null default 0;
alter table public.markets add column if not exists last_extended_at timestamptz;

-- 2) RPC（admin 限定・closed 限定・未来締切を強制）
create or replace function public.extend_market(p_market_id uuid, p_new_deadline timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  m public.markets%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'admin' then raise exception 'ADMIN_REQUIRED'; end if;

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
