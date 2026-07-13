import Link from "next/link";

export const dynamic = "force-dynamic";

// Confirmation landing page for email sign-in / password-reset links.
//
// WHY THIS EXISTS: email links from Supabase are ONE-TIME. Corporate mail
// security (Microsoft 365 "Safe Links", Yahoo, etc.) pre-opens every link in an
// incoming message to scan it — which CONSUMES a one-time token before the human
// ever clicks, so the real click lands on an "expired" link. It also flags a
// "set your password" email whose link points to a different domain (supabase.co)
// than the sender as phishing → spam.
//
// The fix: the email links HERE, on our own domain. This page does nothing on
// load except show a button. The token is only exchanged when a human clicks
// "Continue" (a POST to /auth/confirm/verify). A scanner that GETs this page
// doesn't press the button, so the token survives — and the visible link now
// matches our sending domain, which improves inbox delivery.
export default function ConfirmPage({
  searchParams,
}: {
  searchParams: { token_hash?: string; type?: string; next?: string };
}) {
  const tokenHash = searchParams.token_hash ?? "";
  const type = searchParams.type ?? "recovery";
  const next = searchParams.next ?? "/reset-password";

  const wrap: React.CSSProperties = {
    maxWidth: 460,
    margin: "10vh auto",
    padding: 16,
  };

  if (!tokenHash) {
    return (
      <main style={wrap}>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>This link is missing its code</h2>
          <p className="hint">
            The link looks incomplete. Request a fresh one using{" "}
            <b>Forgot password?</b> on the sign-in page.
          </p>
          <Link href="/login" className="navbtn" style={{ marginTop: 12, display: "inline-block" }}>
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Confirm it&apos;s you</h2>
        <p className="hint">
          For your security, click Continue to set your password and sign in to
          your EarnedHome dashboard.
        </p>
        <form method="post" action="/auth/confirm/verify" style={{ marginTop: 16 }}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button type="submit" className="leadbtn" style={{ width: "100%" }}>
            Continue
          </button>
        </form>
        <p className="hint" style={{ fontSize: 12, marginTop: 14 }}>
          If this link has expired, use <b>Forgot password?</b> on the{" "}
          <Link href="/login">sign-in page</Link> for a new one.
        </p>
      </div>
    </main>
  );
}
