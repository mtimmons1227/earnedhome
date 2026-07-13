# Tenant Onboarding — Run Script

Onboard a new loan-officer tenant in **3 SQL blocks + 1 manual step**. You edit values in **one place** (the `v` block); the SQL does the rest by cloning the template.

**Order:** Template (once) → Block A create tenant → Block B create login → Step C ratesheet → verify.

---

## One-time setup (skip if `_template` already exists)

```sql
insert into public.tenants (slug, name, type, status, branding)
values ('_template', 'Template LO', 'lo_company', 'pending',
  '{"primary":"#1F3864","accent":"#2E75B6","bg":"#F4F6FA","initials":"EH","tag":""}'::jsonb);
```

Check it exists: `select slug, status from public.tenants where slug = '_template';`

---

## Block A — Create the tenant

Edit **only the `v` block**, then run the whole thing.

```sql
with v as (
  select
    'rparry'                                as slug,            -- subdomain (lowercase, no spaces)
    'R Parry Financial'                     as name,            -- brand + "Your loan officer"
    'RP'                                    as initials,        -- 2-letter header badge
    'R Parry Financial, LLC'                as legal_name,
    'Richard P. McHargue'                   as originator_name,
    '1924318'                               as company_nmls,    -- shown in header + footer
    '817-905-8660'                          as lo_phone,
    'richard@rparryfinancial.com'           as notify_email,    -- new-lead alerts go here
    'https://www.blink.mortgage/app/...'    as apply_url,       -- apply / reserve link
    'https://calendly.com/...'              as booking_url,     -- scheduling link
    ''                                      as custom_domain    -- leave '' if none
)
insert into public.tenants
  (slug, name, type, status, branding, lo_name, nmls, lo_phone, notify_email,
   apply_url, booking_url, custom_domain, legal_name, company_nmls, originator_name)
select
  v.slug, v.name, 'lo_company'::tenant_type, 'active'::tenant_status,
  jsonb_set(jsonb_set(t.branding,
     '{tag}',      to_jsonb('Powered by '||v.name||' · NMLS '||v.company_nmls)),
     '{initials}', to_jsonb(v.initials)),
  v.name, v.company_nmls, v.lo_phone, v.notify_email,
  v.apply_url, v.booking_url, nullif(v.custom_domain,''),
  v.legal_name, v.company_nmls, v.originator_name
from v, public.tenants t
where t.slug = '_template';
```

*Uses the template's brand colors. To customize colors, add `jsonb_set(..., '{primary}', to_jsonb('#hex'))` wraps.*

**Verify:**
```sql
select slug, status, lo_name, nmls, lo_phone, notify_email, branding->>'tag' as tag
from public.tenants where slug = 'rparry';
```

---

## Block B — Create the LO's dashboard login

1. Supabase → **Authentication → Users → Add user** (their email + a temp password). Copy the new user's **UID**.
2. Run (edit the 4 values + slug):

```sql
insert into public.app_users (id, tenant_id, role, full_name, email, nmls)
select
  '«AUTH_UID»',                      -- paste UID from step 1
  t.id, 'admin',                     -- 'admin' or 'lo'
  '«Full Name»', '«email»', '«individual NMLS»'
from public.tenants t where t.slug = 'rparry';
```

---

## Step C — Attach the ratesheet ⚠️ (manual)

Live pricing currently reads a shared workbook (R Parry's). Point the tenant at **their** RateStream workbook (Graph `DRIVE_ID`/`ITEM_ID`) so their rates show. *This is the only bespoke step until per-tenant pricing is built.*

---

## Verify live (2 min)

Open `slug.earnedhome.com` and check:
- Header brand, badge, **NMLS** correct (header + footer).
- Run an estimate → **live** rates (their sheet, not R Parry's).
- Connect as a buyer → buyer email + LO alert (to `notify_email`) + Calendly all fire.
- LO signs in at `/login` → sees their dashboard.

Done. Add agents (LO self-serve on the Agents page) as needed.
