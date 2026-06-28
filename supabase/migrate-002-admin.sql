-- ============================================================================
-- Migration 002 — admin RPCs + market insert/delete policies
-- Run this ONCE in Supabase Studio → SQL Editor (after schema.sql).
-- Safe to run on an existing project (does not touch seed data).
-- ============================================================================

-- Admin: adjust points / role -------------------------------------------------
create or replace function public.admin_add_points(p_user uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  update public.profiles set points = points + p_amount, xp = xp + greatest(p_amount, 0) where id = p_user;
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    then raise exception 'ADMIN_REQUIRED'; end if;
  if p_role not in ('user','admin') then raise exception 'BAD_ROLE'; end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- Restrict non-admins to proposing 'pending' markets only ---------------------
drop policy if exists markets_insert on public.markets;
create policy markets_insert on public.markets for insert with check (
  created_by = auth.uid()
  and (
    status = 'pending'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
);

-- Allow admins to delete (reject) markets ------------------------------------
drop policy if exists markets_admin_delete on public.markets;
create policy markets_admin_delete on public.markets for delete using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
