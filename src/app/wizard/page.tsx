import { WizardDemo } from "@/components/WizardDemo";

export const dynamic = "force-dynamic";

export default function WizardPreviewPage() {
  return (
    <div>
      <header className="eh-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/buyerbridge-logo.png" alt="BuyerBridge" />
        <div>
          <div className="eh-tag">Guided journey — preview</div>
        </div>
      </header>
      <main>
        <div className="flag">
          Preview of the guided wizard (Welcome → step 2). Single page — steps
          slide in place, nothing navigates away.
        </div>
        <div className="panel">
          <WizardDemo />
        </div>
      </main>
    </div>
  );
}
