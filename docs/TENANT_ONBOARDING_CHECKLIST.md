# Tenant Onboarding Checklist

Everything required to stand up a new white-label tenant (a loan officer / LO company, builder, or agent partner) on EarnedHome. Work top to bottom; the ⚠️ items are current single-tenant limitations that need productization before a *second* live LO.

---

## 1. Tenant record — `public.tenants` (one row)

The heart of the tenant. Insert one row (SQL or a future admin form). Fields:

| Field | What it is | Example |
|---|---|---|
| `slug` | Subdomain key → `slug.earnedhome.com` | `rparry` |
| `name` | Brand name shown in the header | `R Parry Financial` |
| `type` | `master` \| `builder` \| `agent` \| `lo_company` | `lo_company` |
| `status` | Must be `active` to resolve | `active` |
| `branding` (JSON) | `primary`, `accent`, `bg` (hex), `initials` (badge), `tag` (the "Powered by … · NMLS …" line), `logo_url` (optional) | see below |
| `lo_name` | LO/company name shown to buyers ("Your loan officer") | `R Parry Financial` |
| `nmls` | NMLS on the Equal Housing Opportunity footer | `1924318` |
| `lo_phone` | LO phone (connect screen + "Call" button) | `817-905-8660` |
| `notify_email` | Where new-lead alerts are sent | `richard@rparryfinancial.com` |
| `apply_url` | Apply/reserve link (lender portal / Blink) | `https://…` |
| `booking_url` | Calendly scheduling link | `https://calendly.com/…` |
| `custom_domain` | Optional — their own domain | `app.rparryfinancial.com` |
| `legal_name` / `company_nmls` / `originator_name` | Identity/record fields | `R Parry Financial, LLC` / `1924318` / `Richard P. McHargue` |

**Branding JSON example:**
```json
{ "primary":"#1F3864", "accent":"#2E75B6", "bg":"#F4F6FA",
  "initials":"RP", "tag":"Powered by R Parry Financial · NMLS 1924318" }
```

> Note: the header "Powered by … · NMLS …" line comes from `branding.tag`, while the footer NMLS comes from the `nmls` column. Set **both** consistently.

---

## 2. Dashboard access — Supabase Auth + `app_users`

1. **Create the auth user:** Supabase → Authentication → Users → Add user (their email).
2. **Link them to the tenant:** insert an `app_users` row — `id` (= the auth user's UID), `tenant_id`, `role` (`admin` or `lo`), `full_name`, `email`, `nmls`.
3. **Password:** they set it via password recovery. ⚠️ Self-serve "Forgot password" needs Resend SMTP wired into Supabase Auth (see §5) and the URL Configuration allowlist set; until then, send a recovery link from the dashboard.

---

## 3. Pricing engine — the ratesheet ⚠️

The buyer numbers come from the tenant's RateStream Excel workbook, read live via Microsoft Graph.

- Their **RateStream workbook** in OneDrive/SharePoint, with the tab/named-range structure the adapter expects (e.g. `EH_OUT`, credit-band grid).
- **Graph pointers:** `GRAPH_WORKBOOK_DRIVE_ID`, `GRAPH_WORKBOOK_ITEM_ID`.
- **Adapter switches:** `PRICING_ADAPTER=graph`, `GRAPH_OUTPUT_MODE=grid`, plus `GRAPH_CLIENT_ID/SECRET/TENANT_ID`.

⚠️ **Today this is a single shared workbook + one Graph credential set (env vars).** For a second LO with their own ratesheet, this needs to become **per-tenant** (workbook pointers stored on the tenant row, and either per-tenant Graph app registration or a shared app with access to each workbook). This is the biggest engineering item before multi-LO.

---

## 4. Disclosures & compliance ⚠️

- Lender-specific **disclosures** text (RESPA/TILA "not a Loan Estimate," assumptions, licensing).
- **NMLS** — company + individual originator.
- State licensing / Equal Housing.
- **White-label / licensing agreement** reviewed by a compliance attorney before real buyers.

⚠️ Disclosures are currently a **shared module hardcoded to R Parry**. For a second LO, disclosures must become tenant-specific (stored per tenant, not in code).

---

## 5. Email — Resend

- `notify_email` set on the tenant row (recipient of lead alerts).
- `RESEND_FROM` sender on a **verified domain**. To send as the tenant's own domain (e.g. `estimates@rparryfinancial.com`), verify it in Resend first (add SPF/DKIM/DMARC DNS records — requires the tenant's DNS access), then set `RESEND_FROM` per Netlify context.
- Optional `LEAD_NOTIFY_OVERRIDE` on QA/local so test leads route to you, not the LO.
- (For self-serve password reset) connect **Resend SMTP** to Supabase Auth + set the URL Configuration allowlist.

---

## 6. Hosting / domain

- **Subdomain** (`slug.earnedhome.com`) resolves automatically once the wildcard DNS + Netlify domain are configured for the root.
- **Custom domain:** set `custom_domain` on the tenant, add the domain in Netlify, and point the tenant's DNS at Netlify.

---

## 7. Integrations — optional (`tenant_integrations`)

For pushing leads into the LO's CRM (via the lead-event seam → Power Automate / Logic Apps):
- Insert a `tenant_integrations` row: `crm_type`, `crm_api_key`, `crm_config`.
- Set `LEAD_EVENT_WEBHOOK_URL` (the downstream flow). No CRM configured → the dashboard + email alert are still the source of truth.

---

## 8. Agents — optional, LO self-serve

Nothing to pre-create. Once the LO can sign in, they add their own realtor partners on the **Agents** page (each gets a `/a/<slug>` link, seat on/off, email-link, etc.). Requires `SUPABASE_SERVICE_ROLE_KEY` set on the deploy context (already set on all contexts).

---

## 9. Go-live verification (per tenant)

- Load `slug.earnedhome.com` → branding, name, NMLS (header **and** footer), logo correct.
- Run an estimate → **live pricing** resolves (not stub) with the tenant's ratesheet.
- Connect as a buyer → **buyer email**, **LO alert** (to `notify_email`), and **Calendly** all fire to the right addresses.
- Dashboard login works for the LO's account; leads appear.
- Disclosures + both NMLS numbers correct.
- (If agents) add one, run through its link, confirm attribution.

---

## Summary — what's DB-ready vs. still needs work

**Configurable per tenant today (data only):** tenant row (branding, names, NMLS, phone, notify email, apply/booking URLs), dashboard users, agents, CRM integration, custom domain.

**⚠️ Needs productization before a second live LO:**
1. **Per-tenant pricing** — move the RateStream workbook pointers + Graph access off shared env vars onto the tenant (biggest item).
2. **Per-tenant disclosures** — move lender disclosures out of the shared code module into tenant data.
3. **Shared infra to confirm:** one Supabase project + one Netlify site serve all tenants — fine at low volume; revisit data isolation as tenants grow.
4. **Self-serve auth** — Resend SMTP + URL allowlist so LOs can reset their own passwords.
