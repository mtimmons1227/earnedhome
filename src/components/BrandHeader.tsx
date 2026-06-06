import type { Tenant } from "@/lib/tenant";

export function BrandHeader({ tenant }: { tenant: Tenant }) {
  const b = tenant.branding;
  return (
    <header className="eh-header">
      {b.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo_url} alt={`${tenant.name} logo`} />
      ) : (
        <div className="eh-badge">{b.initials}</div>
      )}
      <div>
        <div className="eh-brand">{tenant.name}</div>
        <div className="eh-tag">{b.tag}</div>
      </div>
    </header>
  );
}
