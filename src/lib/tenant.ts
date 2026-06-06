import { createSupabaseServer } from "@/lib/supabase/server";

export interface TenantBranding {
  primary: string;
  accent: string;
  bg: string;
  initials: string;
  tag: string;
  logo_url?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  type: "master" | "builder" | "agent" | "lo_company";
  branding: TenantBranding;
  lo_name: string | null;
  nmls: string | null;
}

const DEFAULT_SLUG = "earnedhome";

// Pull the tenant slug from the request host (set by middleware) with a
// dev/local fallback. acme.earnedhome.com -> "acme"; localhost -> default.
export function slugFromHost(host: string | null | undefined): string {
  if (!host) return DEFAULT_SLUG;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "earnedhome.com";
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === root || hostname === `www.${root}`) return DEFAULT_SLUG;
  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(`.${root}`).length).split(".")[0];
    return sub || DEFAULT_SLUG;
  }
  // localhost / 127.0.0.1 / vercel preview -> default tenant
  return DEFAULT_SLUG;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  // Surface config/connection problems instead of silently showing "not configured".
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.error(
      "[tenant] Missing Supabase env vars. URL set:",
      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      "KEY set:",
      !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
    return null;
  }
  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from("tenants")
      .select("id, slug, name, type, branding, lo_name, nmls")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) {
      console.error(`[tenant] query failed for slug="${slug}":`, error.message);
      return null;
    }
    if (!data) console.error(`[tenant] no active tenant row for slug="${slug}"`);
    return (data as Tenant | null) ?? null;
  } catch (e) {
    console.error(`[tenant] connection error for slug="${slug}":`, (e as Error).message);
    return null;
  }
}

export async function getTenantForHost(host: string | null): Promise<Tenant | null> {
  const slug = slugFromHost(host);
  const tenant = await getTenantBySlug(slug);
  if (tenant) return tenant;
  if (slug !== DEFAULT_SLUG) return getTenantBySlug(DEFAULT_SLUG);
  return null;
}
