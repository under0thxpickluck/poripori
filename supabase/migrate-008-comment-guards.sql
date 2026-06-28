-- ============================================================================
-- Migration 008 — comment length guard (server-side defense-in-depth)
-- Run ONCE in Supabase Studio → SQL Editor (after schema.sql / migrate-007).
-- Safe to run on an existing project.
-- ============================================================================

-- 空コメント・巨大コメントをサーバー側でも拒否する（クライアントの maxLength=500 と二重防御）。
-- 既存データに 500 文字超があると ADD CONSTRAINT が失敗するため、先に切り詰める。
update public.comments
   set body = left(body, 500)
 where char_length(body) > 500;

alter table public.comments
  drop constraint if exists comments_body_len;

alter table public.comments
  add constraint comments_body_len
  check (char_length(btrim(body)) between 1 and 500);
