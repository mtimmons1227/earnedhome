-- Phase II: capture a contact phone number for each loan officer (mirrors the
-- agent sign-up, which already collects a phone). Additive and nullable — no
-- backfill needed; existing LOs simply have no phone until edited.
alter table public.app_users add column if not exists phone text;
