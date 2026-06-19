import { ReadinessDemo } from "@/components/ReadinessDemo";

export const dynamic = "force-dynamic";

export default function ReadinessPreviewPage() {
  return (
    <div>
      <header className="eh-header">
        <div className="eh-badge">EH</div>
        <div>
          <div className="eh-brand">EarnedHome</div>
          <div className="eh-tag">Hybrid journey — preview</div>
        </div>
      </header>
      <main>
        <div className="flag">
          Hybrid demo: the full page shows your quick estimate. Tap &ldquo;See my
          full readiness&rdquo; and a guided wizard slides up for the deeper
          questions — single page, nothing navigates away.
        </div>
        <ReadinessDemo />
      </main>
    </div>
  );
}
