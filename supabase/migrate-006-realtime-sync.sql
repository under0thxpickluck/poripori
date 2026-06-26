-- ============================================================================
-- Migration 006 — full live sync.
-- Add markets / profiles / positions to the realtime publication so other
-- users' trades, payouts, balances and market-status changes update every
-- client without a reload (price_history + trades were already realtime).
-- Run ONCE in Supabase Studio → SQL Editor. Safe to re-run.
-- ============================================================================
do $$ begin alter publication supabase_realtime add table public.markets;   exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.profiles;  exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.positions; exception when duplicate_object then null; end $$;
