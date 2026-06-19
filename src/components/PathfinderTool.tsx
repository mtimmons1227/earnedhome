"use client";

import { useMemo, useState } from "react";
import type {
  CreditBand, Occupancy, Buydown, PricingInput, PricingQuote, PricingProduct,
} from "@/lib/pricing/types";
import { evaluateEligibility } from "@/lib/eligibility";

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const parseNum = (s: string) => +String(s).replace(/[^0-9.]/g, "") || 0;
const groupInt = (s: string) => {
  const v = String(s).replace(/[^0-9]/g, "");
  return v ? (+v).toLocaleString("en-US") : "";
};

const CREDIT_BANDS: CreditBand[] = [
  "780+", "760–779", "740–759", "720–739", "700–719",
  "680–699", "660–679", "640–659", "620–639",
];
const OCCUPANCIES: Occupancy[] = ["Primary", "Second Home", "Investment"];
const BUYDOWNS: Buydown[] = ["None", "1-0", "2-1", "3-2-1"];

interface Props {
  tenantId: string;
  loName: string;
  nmls: string | null;
}

export function PathfinderTool({ tenantId, loName, nmls }: Props) {
  // form state (display strings for currency fields)
  const [homePrice, setHomePrice] = useState("450,000");
  const [downAmt, setDownAmt] = useState("45,000");
  const [downPct, setDownPct] = useState("10");
  const [creditBand, setCreditBand] = useState<CreditBand>("740–759");
  const [occupancy, setOccupancy] = useState<Occupancy>("Primary");
  const [sellerCredit, setSellerCredit] = useState("5,000");
  const [buydown, setBuydown] = useState<Buydown>("None");
  const [veteran, setVeteran] = useState(false);
  const [firstTime, setFirstTime] = useState(true);
  // VA-specific inputs — only relevant (and shown) when Military / Veteran is checked.
  const [vaPriorLoan, setVaPriorLoan] = useState(false);
  const [vaDisability, setVaDisability] = useState(false);
  const [vaFundingFee, setVaFundingFee] = useState(true);

  // results state
  const [term, setTerm] = useState<15 | 30>(30);
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // lead state
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [tcpa, setTcpa] = useState(false);
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadDone, setLeadDone] = useState(false);

  // keep $ and % in sync off home price
  function onPrice(v: string) {
    const formatted = groupInt(v);
    setHomePrice(formatted);
    const price = parseNum(formatted);
    if (price > 0) setDownPct(((parseNum(downAmt) / price) * 100).toFixed(1));
  }
  function onDownAmt(v: string) {
    const formatted = groupInt(v);
    setDownAmt(formatted);
    const price = parseNum(homePrice);
    if (price > 0) setDownPct(((parseNum(formatted) / price) * 100).toFixed(1));
  }
  function onDownPct(v: string) {
    setDownPct(v);
    const price = parseNum(homePrice);
    const a = Math.round((price * parseNum(v)) / 100);
    setDownAmt(a ? a.toLocaleString("en-US") : "0");
  }

  const input: PricingInput = useMemo(
    () => ({
      homePrice: parseNum(homePrice),
      downAmount: parseNum(downAmt),
      downPct: parseNum(downPct),
      creditBand, occupancy,
      sellerCredit: parseNum(sellerCredit),
      buydown, veteran, firstTime,
      vaPriorLoan, vaDisability, vaFundingFee,
    }),
    [homePrice, downAmt, downPct, creditBand, occupancy, sellerCredit, buydown,
     veteran, firstTime, vaPriorLoan, vaDisability, vaFundingFee],
  );

  function validate(): string[] {
    const e: string[] = [];
    if (input.homePrice <= 0) e.push("Enter a home price.");
    if (input.homePrice > 0 && input.downAmount >= input.homePrice)
      e.push("Down payment must be less than the home price.");
    if (input.downAmount < 0) e.push("Down payment cannot be negative.");
    return e;
  }

  async function getPayments() {
    if (loading) return; // guard double-clicks
    const errs = validate();
    setErrors(errs);
    setLeadMsg(null);
    if (errs.length) return;
    setLoading(true);
    setQuote(null);
    setQuoteId(null);
    setLeadDone(false); // a new quote means a new potential lead
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, input }),
      });
      if (!res.ok) throw new Error("quote failed");
      const data = (await res.json()) as { quote: PricingQuote; quoteId: string | null };
      setQuote(data.quote);
      setQuoteId(data.quoteId);
      // One idempotency key per quote result: repeat "Connect" clicks for this
      // scenario collapse to a single lead; a new quote starts a new key.
      setRequestKey(crypto.randomUUID());
    } catch {
      setErrors(["We couldn't calculate options right now. Please try again."]);
    } finally {
      setLoading(false);
    }
  }

  async function submitLead() {
    if (leadSubmitting || leadDone) return; // guard double-clicks / resubmits
    if (!tcpa) {
      setLeadMsg("Please agree to be contacted before connecting.");
      return;
    }
    setLeadMsg(null);
    setLeadSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          loName,
          quoteId,
          idempotencyKey: requestKey,
          fullName: leadName, email: leadEmail, phone: leadPhone,
          consentTcpa: tcpa,
          consentText:
            "I agree to be contacted by phone, text, or email about my inquiry. Consent is not a condition of purchase.",
        }),
      });
      if (!res.ok) throw new Error();
      setLeadDone(true);
      setLeadMsg(`Thanks — you're connected with ${loName}.`);
    } catch {
      setLeadMsg("Something went wrong submitting your info. Please try again.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  // Clear everything back to a fresh start: results, the lead form, and consent.
  function resetAll() {
    setQuote(null);
    setQuoteId(null);
    setRequestKey(null);
    setErrors([]);
    setLeadDone(false);
    setLeadSubmitting(false);
    setLeadMsg(null);
    setLeadName("");
    setLeadEmail("");
    setLeadPhone("");
    setTcpa(false);
    setTerm(30);
  }

  const shown = quote?.products.filter((p) => p.termYears === term) ?? [];
  // Edit checks: which products qualify (loan limits, min down/LTV, min credit) vs route to LO.
  const elig = quote ? evaluateEligibility(input) : null;
  const eligibleShown = shown.filter((p) =>
    (p.isVa ? elig?.va.eligible : p.isFha ? elig?.fha.eligible : elig?.conventional.eligible) ?? true);
  // VA only appears as a family when the buyer checked Veteran; otherwise it's not "ineligible", just N/A.
  const ineligible = elig
    ? [elig.conventional, elig.fha, ...(veteran ? [elig.va] : [])].filter((f) => !f.eligible)
    : [];
  const familyLabel = (f: string) => (f === "fha" ? "FHA" : f === "va" ? "VA" : "Conventional");

  return (
    <main>
      <div className="flag">
        Demo data — illustrative numbers from a stub engine. In Phase 1A.2 the
        same fields connect to Richard&apos;s live workbook via Microsoft Graph;
        nothing on this screen changes.
      </div>
      <div className="grid">
        <div className="panel">
          <h2>Your numbers</h2>
          <label>Home Price</label>
          <div className="inwrap">
            <span className="pre">$</span>
            <input className="money" inputMode="numeric" value={homePrice}
              onChange={(e) => onPrice(e.target.value)} />
          </div>
          <div className="twin">
            <div>
              <label>Down Payment ($)</label>
              <div className="inwrap">
                <span className="pre">$</span>
                <input className="money" inputMode="numeric" value={downAmt}
                  onChange={(e) => onDownAmt(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Down Payment (%)</label>
              <input inputMode="decimal" value={downPct}
                onChange={(e) => onDownPct(e.target.value)} />
            </div>
          </div>
          <label>Credit Score</label>
          <select value={creditBand} onChange={(e) => setCreditBand(e.target.value as CreditBand)}>
            {CREDIT_BANDS.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label>Occupancy</label>
          <select value={occupancy} onChange={(e) => setOccupancy(e.target.value as Occupancy)}>
            {OCCUPANCIES.map((o) => <option key={o}>{o}</option>)}
          </select>
          <label>Seller Credit ($)</label>
          <div className="inwrap">
            <span className="pre">$</span>
            <input className="money" inputMode="numeric" value={sellerCredit}
              onChange={(e) => setSellerCredit(groupInt(e.target.value))} />
          </div>
          <label>Temporary Buydown</label>
          <select value={buydown} onChange={(e) => setBuydown(e.target.value as Buydown)}>
            {BUYDOWNS.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label className="grouphd">Eligibility</label>
          <div className="hint">Check any that apply — you can select both.</div>
          <div className="checks">
            <label><input type="checkbox" checked={veteran}
              onChange={(e) => setVeteran(e.target.checked)} /> Military / Veteran</label>
            <label><input type="checkbox" checked={firstTime}
              onChange={(e) => setFirstTime(e.target.checked)} /> First-Time Buyer</label>
          </div>
          {veteran && (
            <div className="checks" style={{ marginTop: 10 }}>
              <div className="hint" style={{ marginBottom: 4 }}>VA loan details</div>
              <label><input type="checkbox" checked={vaPriorLoan}
                onChange={(e) => setVaPriorLoan(e.target.checked)} /> Previous VA loan</label>
              <label><input type="checkbox" checked={vaDisability}
                onChange={(e) => setVaDisability(e.target.checked)} /> Receiving VA disability</label>
              <label><input type="checkbox" checked={vaFundingFee}
                onChange={(e) => setVaFundingFee(e.target.checked)} /> Finance the VA funding fee</label>
            </div>
          )}
        </div>

        <div id="results">
          {errors.length > 0 && (
            <div className="panel">
              <div className="errbox">
                <b>Please fix the following:</b>
                <ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </div>
          )}
          {loading && (
            <div className="panel"><div className="loading">Calculating your options…</div></div>
          )}
          {!loading && !quote && errors.length === 0 && (
            <div className="panel">
              <div className="empty">
                Enter your numbers and tap <b>Get Payments</b> to start your
                journey to home ownership.
              </div>
            </div>
          )}
          {!loading && quote && (
            <div className="panel">
              <div className="toggle">
                <button className={term === 30 ? "active" : ""} onClick={() => setTerm(30)}>30-Year</button>
                <button className={term === 15 ? "active" : ""} onClick={() => setTerm(15)}>15-Year</button>
              </div>
              {elig?.routeMessage ? (
                <div className="flag" style={{ marginBottom: 0 }}>{elig.routeMessage}</div>
              ) : (
                <>
                  <div className="cards">{eligibleShown.map((p) => <Card key={p.product} p={p} />)}</div>
                  {ineligible.map((f) => (
                    <div className="hint" key={f.family} style={{ marginTop: 8 }}>
                      {familyLabel(f.family)} — {f.reason}
                    </div>
                  ))}
                </>
              )}
              <div className="ctc">
                <span className="l">Estimated Cash to Close</span>
                <span className="n">{money(quote.cashToClose)}</span>
              </div>
              <div className="disctop">
                Estimates only — not a Loan Estimate or commitment to lend. APR
                assumes financed closing costs; payments include estimated taxes,
                insurance, and any mortgage insurance. Subject to credit approval.
              </div>
              <div className="route">Your loan officer: {loName}</div>
              {!leadDone ? (
                <>
                  <input placeholder="Full name" value={leadName}
                    onChange={(e) => setLeadName(e.target.value)} />
                  <div className="spacer" />
                  <input placeholder="Email" type="email" inputMode="email" value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)} />
                  <div className="spacer" />
                  <input placeholder="Phone" type="tel" inputMode="tel" value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)} />
                  <label className="consent">
                    <input type="checkbox" checked={tcpa} onChange={(e) => setTcpa(e.target.checked)} />
                    I agree to be contacted by phone, text, or email about my inquiry.
                    Consent is not a condition of purchase.
                  </label>
                  <button className="leadbtn" onClick={submitLead} disabled={leadSubmitting}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {leadSubmitting ? "Connecting…" : <><StepBadge label="2" />Connect me with a loan officer</>}
                  </button>
                  {leadMsg && <div className="hint" style={{ marginTop: 8 }}>{leadMsg}</div>}
                </>
              ) : (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16,
                  background: "#eef7f0", border: "1px solid #bfe3c9", borderRadius: 10 }}>
                  <div style={{ flex: "0 0 auto", width: 28, height: 28, borderRadius: "50%",
                    background: "#1f9d55", color: "#fff", display: "flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 700 }}>✓</div>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--primary)" }}>
                      You&apos;re connected with {loName}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
                      {leadName ? `Thanks, ${leadName.split(" ")[0]}. ` : "Thanks. "}
                      A loan officer will reach out shortly about your{" "}
                      {money(quote.cashToClose)} cash-to-close scenario.
                    </div>
                    <button onClick={resetAll} style={{ marginTop: 10, background: "transparent",
                      border: "1px solid var(--line)", color: "var(--primary)", padding: "8px 12px",
                      borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                      Start over
                    </button>
                  </div>
                </div>
              )}
              <details className="disc">
                <summary>Disclosures &amp; assumptions</summary>
                {quote.disclosures.map((d, i) => <p key={i}>{d}</p>)}
              </details>
              <div className="eho">
                Equal Housing Opportunity{nmls ? ` · NMLS ${nmls}` : ""} · Estimates
                only, not a commitment to lend.
              </div>
            </div>
          )}
          {quote && (
            <footer>
              Rates as of {quote.ratesAsOf} · {quote.engine === "stub" ? "Demo / stub engine" : "Live engine"} · EarnedHome Pathfinder 1A
            </footer>
          )}
        </div>
      </div>

      <div className="cta">
        {!quote ? (
          <>
            <div className="ctahint">Complete the fields above, then tap Get Payments to see your options.</div>
            <button onClick={getPayments} disabled={loading}>
              {loading ? "Calculating…" : <><StepBadge label="1" />Get Payments</>}
            </button>
          </>
        ) : (
          <>
            <div className="ctahint">
              Changed a number? Recalculate. To finish, use “Connect me with a loan officer” above.
            </div>
            <button onClick={getPayments} disabled={loading}
              style={{ background: "transparent", color: "var(--primary)", border: "2px solid var(--primary)" }}>
              {loading ? "Calculating…" : <><StepBadge label="1" />Recalculate</>}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

function Card({ p }: { p: PricingProduct }) {
  return (
    <div className="card">
      <div className="top">
        <div className="nm">{p.product}</div>
        <div className="rt">Rate {p.rate.toFixed(3)}% · APR {p.apr.toFixed(3)}%</div>
      </div>
      <div className="rows">
        <Row l="Principal & Interest" v={money(p.principalAndInterest)} />
        <Row l="Taxes" v={money(p.taxes)} />
        <Row l="Insurance" v={money(p.insurance)} />
        <Row l="Mortgage Insurance" v={p.mortgageInsurance ? money(p.mortgageInsurance) : "—"} />
        <div className="rw total"><span>Total Payment</span>
          <span className="v">{money(p.totalPayment)}/mo</span></div>
      </div>
    </div>
  );
}
function Row({ l, v }: { l: string; v: string }) {
  return <div className="rw"><span>{l}</span><span className="v">{v}</span></div>;
}

// Green circular step number, shown on the two action buttons so the buyer
// sees there are two things to complete (1 = Get Payments, 2 = Connect).
function StepBadge({ label }: { label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: "50%", background: "#1f9d55", color: "#fff",
      fontSize: 12, fontWeight: 700, marginRight: 8, flex: "0 0 auto",
      verticalAlign: "middle" }}>{label}</span>
  );
}
