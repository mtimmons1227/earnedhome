export const dynamic = "force-dynamic";

// Public unsubscribe landing. We DON'T unsubscribe on GET — email scanners and
// link-preview bots prefetch URLs, which would opt people out by accident. Instead
// we show a confirm button that POSTs to /unsubscribe/<token>/set.
export default function UnsubscribePage({
  params, searchParams,
}: {
  params: { token: string };
  searchParams: { done?: string };
}) {
  const done = searchParams.done === "1";
  const isTest = params.token === "test";

  return (
    <main style={{ maxWidth: 520, margin: "12vh auto", padding: 16, fontFamily: "Arial, Helvetica, sans-serif" }}>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 28, textAlign: "center", background: "#fff" }}>
        <img src="/brand/buyerbridge-logo.png" alt="BuyerBridge" style={{ height: 44, width: "auto", marginBottom: 16 }} />
        {done ? (
          <>
            <h2 style={{ color: "#1F3864", margin: "0 0 8px" }}>You&apos;re unsubscribed</h2>
            <p style={{ color: "#374151", margin: 0 }}>
              You won&apos;t receive any more broadcast emails from us. If this was a mistake, just reply to a
              previous email and we&apos;ll add you back.
            </p>
          </>
        ) : isTest ? (
          <>
            <h2 style={{ color: "#1F3864", margin: "0 0 8px" }}>Test unsubscribe link</h2>
            <p style={{ color: "#374151", margin: 0 }}>
              This is a sample link from a test email — there&apos;s nothing to unsubscribe. Real emails carry a
              personal link that works.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ color: "#1F3864", margin: "0 0 8px" }}>Unsubscribe</h2>
            <p style={{ color: "#374151", margin: "0 0 18px" }}>
              Click below to stop receiving broadcast emails from us.
            </p>
            <form action={`/unsubscribe/${encodeURIComponent(params.token)}/set`} method="post">
              <button type="submit" style={{ background: "#1F3864", color: "#fff", border: "none", borderRadius: 8, padding: "12px 22px", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
                Unsubscribe me
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
