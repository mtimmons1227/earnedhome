# Tenant Template + Clone Script

Onboard a new loan-officer tenant by **cloning a template row and filling in the LO's details** — no hand-writing a full INSERT each time.

- **Step 1** is run **once** — it creates a hidden `_template` tenant that holds the standard defaults.
- **Step 2** is the **reusable** clone: copy the block, fill in the ~13 values, run it. That's a new live tenant.
- **Step 3** covers the two things a clone can't do yet (dashboard user + ratesheet).

> The template is parked on `status = 'pending'`, so it never resolves publicly (the app only serves `status = 'active'` tenants).

---

## Step 1 — Create the template (run ONCE)

```sql
insert into public.tenants
  (slug, name, type, status, branding, lo_name, nmls, lo_phone, notify_email,
   apply_url, booking_url, custom_domain, legal_name, company_nmls, originator_name)
values (
  '_template',
  'Template LO',
  'lo_company',
  'pending',
  '{"primary":"#1F3864","accent":"#2E75B6","bg":"#F4F6FA","initials":"EH","tag":"Powered by <LO Company> · NMLS <#>"}'::jsonb,
  'Your loan officer',
  null, null, null,
  null, null, null,
  null, null, null
);
```

The only things worth copying from the template are the **brand colors** (`primary`/`accent`/`bg`) and the row *structure* — everything else gets overridden per LO. Tweak the default colors here if you want a different house palette.

---

## Step 2 — Clone a new tenant (reusable)

Copy this block, replace every `«…»` placeholder, and run it. It copies the template's colors + type, sets the row live, and fills in the LO's info.

```sql
insert into public.tenants
  (slug, name, type, status, branding, lo_name, nmls, lo_phone, notify_email,
   apply_url, booking_url, custom_domain, legal_name, company_nmls, originator_name)
select
  '«slug»',                    -- subdomain → «slug».earnedhome.com  (lowercase, no spaces)
  '«Display Name»',            -- header brand name
  type,                        -- copied from template (lo_company)
  'active',                    -- go live immediately
  jsonb_set(
    jsonb_set(branding, '{tag}',      '"Powered by «Company» · NMLS «CompanyNMLS»"'::jsonb),
                        '{initials}', '"«XX»"'::jsonb),   -- 2-letter badge; colors copied from template
  '«LO / Company name»',       -- lo_name  (shown as "Your loan officer")
  '«FooterNMLS»',              -- nmls     (Equal Housing Opportunity footer)
  '«000-000-0000»',            -- lo_phone
  '«alerts@lo-domain.com»',    -- notify_email  (where new-lead alerts go)
  '«https://apply…»',          -- apply_url
  '«https://calendly.com/…»',  -- booking_url
  null,                        -- custom_domain (leave null unless they use their own)
  '«Legal Entity, LLC»',       -- legal_name
  '«CompanyNMLS»',             -- company_nmls
  '«Originator Full Name»'     -- originator_name
from public.tenants
where slug = '_template';
```

Notes:
- `id` and `created_at` fill in automatically — don't set them.
- `slug` must be unique and lowercase; it's the subdomain.
- Set the footer `nmls` and the header `tag` NMLS to whatever you want each to show (company vs. individual) — usually both the company number.
- To use custom brand colors, add more `jsonb_set(...)` wraps for `{primary}` / `{accent}` / `{bg}`.

**Verify the clone:**
```sql
select slug, name, status, lo_name, nmls, lo_phone, notify_email, branding->>'tag' as tag
from public.tenants where slug = '«slug»';
```

---

## Step 3 — Finish the setup (per tenant, not cloned)

The clone gives you a fully-branded, live tenant. Two things still need a manual step:

1. **Dashboard login for the LO.** Supabase → Authentication → Users → Add user (their email), then link them:
   ```sql
   insert into public.app_users (id, tenant_id, role, full_name, email, nmls)
   values (
     '«auth-user-uuid»',                                   -- from Authentication → Users
     (select id from public.tenants where slug = '«slug»'),
     'admin',                                              -- 'admin' or 'lo'
     '«Full Name»', '«email»', '«NMLS»'
   );
   ```

2. **⚠️ Ratesheet (pricing).** Live pricing still comes from shared env vars pointing at R Parry's workbook, so a freshly cloned tenant would show R Parry's rates until per-tenant pricing is built. Until then, attaching the LO's own RateStream workbook is the one true manual step. (Disclosures are likewise shared today.)

Once per-tenant pricing + disclosures land on the tenant record, this same clone block will produce a 100%-complete tenant, and the future admin "New tenant → clone from template" button will just be a form wrapper around exactly this.
