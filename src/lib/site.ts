// Canonical public base URL for the current environment (no trailing slash).
//
// Prefer NEXT_PUBLIC_SITE_URL, set per Netlify deploy context:
//   Production      -> https://home.rparryfinancial.com
//   Branch (test)   -> https://test--earnedhome.netlify.app
//   (unset locally / on deploy previews -> falls back to the request origin)
//
// Emailed links (sign-in, set-password, agent share, buyer consent) must use
// this clean, allow-listed domain — never a per-deploy *.netlify.app permalink,
// which would break the Supabase Auth redirect allow-list and confuse users.
export function siteOrigin(fallback?: string): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  const pick = (env && env.trim()) || (fallback && fallback.trim()) || "";
  return pick.replace(/\/+$/, "");
}
