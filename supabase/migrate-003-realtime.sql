-- ============================================================================
-- Migration 003 — enable Realtime on price_history
-- Run once in Supabase Studio → SQL Editor.
-- Lets the price chart update live as trades happen.
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.price_history;
exception
  when duplicate_object then null; -- already added; ignore
end $$;
