-- Durable duplicate-lead prevention via an idempotency key.
-- The client sends one key per quote result; repeat submits collapse to one row,
-- and the unique index holds even against direct API calls. Applied to azfesppisxniclnntrmc.

alter table public.leads add column if not exists idempotency_key text;

-- Unique per tenant. NULLs are distinct in Postgres, so leads without a key
-- (e.g. legacy/direct inserts) are unaffected; only non-null keys are deduped.
create unique index if not exists leads_tenant_idempotency_uidx
  on public.leads (tenant_id, idempotency_key);
