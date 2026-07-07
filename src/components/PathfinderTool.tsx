"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  CreditBand, Occupancy, PropertyType, PricingInput, PricingQuote, PricingProduct,
} from "@/lib/pricing/types";
import { evaluateEligibility, type Family } from "@/lib/eligibility";

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
const PROPERTY_TYPES: PropertyType[] = ["Single Family", "2-4 Unit", "Condo", "Manufactured"];

interface Props {
  tenantId: string;
  loName: string;
  nmls: string | null;
  applyUrl?: string | null;
  loPhone?: string | null;
  bookingUrl?: string | null;
  agentId?: string | null;
  agentName?: string | null;
}

export function PathfinderTool({ tenantId, loName, nmls, applyUrl, loPhone, bookingUrl, agentId, agentName }: Props) {
  // form state (display strings for currency fields)
  const [homePrice, setHomePrice] = useState("0");
  const [downAmt, setDownAmt] = useState("0");
  const [downPct, setDownPct] = useState("0");
  const [creditBand, setCreditBand] = useState<CreditBand | "">("720–739");
  const [occupancy, setOccupancy] = useState<Occupancy | "">("Primary");
  const [sellerCredit, setSellerCredit] = useState("0");
  const [propertyType, setPropertyType] = useState<PropertyType>("Single Family");
  const [veteran, setVeteran] = useState(false);
  const [firstTime, setFirstTime] = useState(false);
  // VA-specific inputs — only relevant (and shown) when Military / Veteran is checked.
  const [vaPriorLoan, setVaPriorLoan] = useState(false);
  const [vaDisability, setVaDisability] = useState(false);
  const [vaFundingFee, setVaFundingFee] = useState(true);

  // results state
  const [term, setTerm] = useState<15 | 30>(30);
  const [quote, setQuote] = useState<PricingQuote | null>(null);
  // The exact input that produced the current quote — eligibility is judged
  // against this snapshot so the cards stay consistent even if inputs are edited.
  const [quoteInput, setQuoteInput] = useState<PricingInput | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // lead state
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [tcpa, setTcpa] = useState(false);
  const [leadMsg, setLeadMsg] = useState<string | null>(null);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null); // set on submit; lets the buyer edit their own record
  const [editingContact, setEditingContact] = useState(false); // reusing the modal to correct contact info after connecting

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
      creditBand: creditBand as CreditBand, occupancy: occupancy as Occupancy,
      sellerCredit: parseNum(sellerCredit),
      propertyType, veteran, firstTime,
      vaPriorLoan, vaDisability, vaFundingFee,
    }),
    [homePrice, downAmt, downPct, creditBand, occupancy, sellerCredit, propertyType,
     veteran, firstTime, vaPriorLoan, vaDisability, vaFundingFee],
  );

  // Per-field required/validity. Down payment can be 0 (e.g. VA) but must be
  // entered and below the price; no program minimum is enforced here — the result
  // cards apply program rules. Credit Score and Use must be chosen.
  const fieldErr = {
    homePrice: parseNum(homePrice) <= 0 ? "Required" : "",
    downPayment:
      downAmt === ""
        ? "Required"
        : parseNum(homePrice) > 0 && parseNum(downAmt) >= parseNum(homePrice)
          ? "Must be less than the home price"
          : "",
    creditBand: creditBand === "" ? "Required" : "",
    occupancy: occupancy === "" ? "Required" : "",
  };
  const formValid =
    !fieldErr.homePrice && !fieldErr.downPayment && !fieldErr.creditBand && !fieldErr.occupancy;
  // Only surface field errors once the buyer has started filling the form.
  const touched =
    homePrice !== "0" || downAmt !== "0" || downPct !== "0" || creditBand !== "" || occupancy !== "" || sellerCredit !== "0";

  async function getPayments() {
    if (loading) return; // guard double-clicks
    setLeadMsg(null);
    if (!formValid) return;
    setErrors([]);
    setLoading(true);
    setQuote(null);
    setQuoteInput(null);
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
      setQuoteInput(input); // snapshot for eligibility
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

  async function submitLead(action: "apply" | "call" | "book" | "reach-out" = "reach-out") {
    if (leadSubmitting || leadDone) return; // guard double-clicks / resubmits
    if (!leadName.trim() || !leadEmail.trim() || !leadPhone.trim()) {
      setLeadMsg("Please enter your name, email, and phone.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(leadEmail.trim())) {
      setLeadMsg("Please enter a valid email address.");
      return;
    }
    if (!tcpa) {
      setLeadMsg("Please agree to be contacted before connecting.");
      return;
    }
    setLeadMsg(null);
    setLeadSubmitting(true);
    try {
      // Compact summary of every ELIGIBLE product the buyer saw (both 30- and 15-yr),
      // for the estimate email. Mirrors the on-page eligibility so the email never lists
      // a product that was greyed-out / unavailable (e.g. FHA above the loan limit).
      const emailElig = quoteInput ? evaluateEligibility(quoteInput) : null;
      const summaryProducts = (quote?.products ?? [])
        .filter((p) => p.totalPayment > 0 && (p.isVa ? veteran : true)
          && (!emailElig || emailElig[famOf(p)].eligible))
        .map((p) => ({ name: p.displayName, rate: p.rate, totalPayment: p.totalPayment, cashToClose: p.cashToClose }));
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId,
          loName,
          loPhone: loPhone ?? null,
          bookingUrl: bookingUrl ?? null,
          agentId: agentId ?? null,
          action,
          quoteId,
          idempotencyKey: requestKey,
          fullName: leadName, email: leadEmail, phone: leadPhone,
          consentTcpa: tcpa,
          consentText:
            "I agree to be contacted by phone, text, or email about my inquiry. Consent is not a condition of purchase.",
          quoteSummary: quote ? {
            ratesAsOf: quote.ratesAsOf,
            cashToClose: quote.cashToClose,
            products: summaryProducts,
            disclosures: quote.disclosures,
            homePrice: quoteInput?.homePrice,
            downAmount: quoteInput?.downAmount,
            downPct: quoteInput?.downPct,
            creditBand: quoteInput?.creditBand,
            occupancy: quoteInput?.occupancy,
            propertyType: quoteInput?.propertyType,
          } : null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => ({} as { leadId?: string }));
      if (data.leadId) setLeadId(data.leadId); // remember our record so the buyer can edit their info
      setLeadDone(true);
      setShowLeadModal(false);
      setLeadMsg(`Thanks — you're connected with ${loName}.`);
      // Take the buyer to whatever they chose.
      if (action === "apply" && applyUrl) window.open(applyUrl, "_blank", "noopener");
      else if (action === "book" && bookingUrl) {
        // Prefill Calendly with what the buyer already entered (name/email/phone).
        const u = new URL(bookingUrl);
        if (leadName) u.searchParams.set("name", leadName);
        if (leadEmail) u.searchParams.set("email", leadEmail);
        if (leadPhone) u.searchParams.set("phone_number", leadPhone);
        window.open(u.toString(), "_blank", "noopener");
      }
      else if (action === "call" && loPhone) window.location.href = `tel:${loPhone.replace(/[^0-9+]/g, "")}`;
    } catch {
      setLeadMsg("Something went wrong submitting your info. Please try again.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  // Correct the contact info on the lead we already created (same record, no
  // duplicate). Used by the "Update my info" button after connecting.
  async function updateContact() {
    if (!leadId || leadSubmitting) return;
    if (!leadName.trim() || !leadEmail.trim() || !leadPhone.trim()) {
      setLeadMsg("Please enter your name, email, and phone.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(leadEmail.trim())) {
      setLeadMsg("Please enter a valid email address.");
      return;
    }
    setLeadSubmitting(true);
    setLeadMsg(null);
    try {
      const res = await fetch("/api/lead/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, fullName: leadName, email: leadEmail, phone: leadPhone }),
      });
      if (!res.ok) throw new Error();
      setEditingContact(false);
      setShowLeadModal(false);
      setLeadMsg("Your contact info was updated.");
    } catch {
      setLeadMsg("Couldn't update your info — please try again.");
    } finally {
      setLeadSubmitting(false);
    }
  }

  // Clear everything back to a fresh start: results, the lead form, and consent.
  function resetAll() {
    setQuote(null);
    setQuoteInput(null);
    setQuoteId(null);
    setRequestKey(null);
    setErrors([]);
    setShowLeadModal(false);
    setLeadDone(false);
    setLeadId(null);
    setEditingContact(false);
    setLeadSubmitting(false);
    setLeadMsg(null);
    setLeadName("");
    setLeadEmail("");
    setLeadPhone("");
    setTcpa(false);
    setTerm(30);
  }

  const shown = quote?.products.filter((p) => p.termYears === term) ?? [];
  // Judge each product against R Parry's lending-criteria matrix (conforming,
  // jumbo tiers, FHA cap, VA jumbo tiers). Eligible products show only with a real
  // payment; ineligible ones show greyed-out with the reason. VA shows only when
  // Veteran is checked. Eligibility uses the snapshot that produced this quote.
  const eligibility = quoteInput ? evaluateEligibility(quoteInput) : null;
  const cards =
    quote && eligibility
      ? shown
          .filter((p) => (p.isVa ? veteran : true))
          .map((p) => ({ p, elig: eligibility[famOf(p)] }))
          .filter(({ p, elig }) => elig.eligible && p.totalPayment > 0)
      : [];
  const routeMsg =
    quote && cards.length === 0
      ? eligibility?.routeMessage ??
        "Let’s talk through your options to find the right program for you. Use “Connect me with a loan officer” below."
      : undefined;

  return (
    <main>
      <div className="grid">
        <div className="panel">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Your path to home — let&apos;s run the numbers</h2>
            {quote && (
              <span style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic",
                marginLeft: "auto", textAlign: "right", whiteSpace: "nowrap" }}>
                Rates as of {quote.ratesAsOf}
              </span>
            )}
          </div>
          <label>Home Price</label>
          <div className="inwrap">
            <span className="pre">$</span>
            <input className="money" inputMode="numeric" value={homePrice}
              onChange={(e) => onPrice(e.target.value)} />
          </div>
          {touched && fieldErr.homePrice && <div style={{ color: "#C8102E", fontSize: 12, marginTop: 3 }}>{fieldErr.homePrice}</div>}
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
          {touched && fieldErr.downPayment && <div style={{ color: "#C8102E", fontSize: 12, marginTop: 3 }}>{fieldErr.downPayment}</div>}
          <label>Credit Score</label>
          <select value={creditBand} onChange={(e) => setCreditBand(e.target.value as CreditBand | "")}>
            {CREDIT_BANDS.map((b) => <option key={b}>{b}</option>)}
          </select>
          <label>How you&apos;ll use the home</label>
          <select value={occupancy} onChange={(e) => setOccupancy(e.target.value as Occupancy | "")}>
            {OCCUPANCIES.map((o) => <option key={o}>{o}</option>)}
          </select>
          <label>Property Type</label>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value as PropertyType)}>
            {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <label style={{ margin: 0 }}>Seller Credit ($)</label>
            <button type="button" aria-label="What's this?"
              onClick={() => setOpenTip(openTip === "seller" ? null : "seller")}
              style={{ background: "none", border: 0, cursor: "pointer", color: "var(--primary)", fontSize: 14, padding: 0, lineHeight: 1 }}>ⓘ</button>
          </div>
          <div className="inwrap">
            <span className="pre">$</span>
            <input className="money" inputMode="numeric" value={sellerCredit}
              onChange={(e) => setSellerCredit(groupInt(e.target.value))} />
          </div>
          {openTip === "seller" && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "6px 0 0" }}>
              A specific dollar amount (or percentage of the purchase price) that the seller contributes at closing to reduce the buyer&apos;s out-of-pocket expenses.
            </div>
          )}
          <label className="grouphd">Eligibility</label>
          <div className="hint">Check any that apply — you can select both.</div>
          <div className="checks">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <label style={{ margin: 0 }}><input type="checkbox" checked={veteran}
                  onChange={(e) => setVeteran(e.target.checked)} /> Military / Veteran</label>
                <button type="button" aria-label="What's this?"
                  onClick={() => setOpenTip(openTip === "vet" ? null : "vet")}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--primary)", fontSize: 15, padding: 0, lineHeight: 1 }}>ⓘ</button>
              </div>
              {openTip === "vet" && (
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "4px 0 0 32px" }}>
                  VA mortgage loans (VA-backed home loans) are a benefit primarily for eligible Veterans, active-duty service members, certain National Guard/Reserve members, and qualifying surviving spouses. You may verify your eligibility directly with the VA — visit{" "}
                  <a href="https://www.va.gov/housing-assistance/home-loans/eligibility" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>va.gov/housing-assistance/home-loans/eligibility</a>, or call the VA Loan Guaranty Service.
                </div>
              )}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <label style={{ margin: 0 }}><input type="checkbox" checked={firstTime}
                  onChange={(e) => setFirstTime(e.target.checked)} /> First-Time Buyer</label>
                <button type="button" aria-label="What's this?"
                  onClick={() => setOpenTip(openTip === "ftb" ? null : "ftb")}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--primary)", fontSize: 15, padding: 0, lineHeight: 1 }}>ⓘ</button>
              </div>
              {openTip === "ftb" && (
                <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "4px 0 0 32px" }}>
                  Generally, you haven&apos;t owned a home in the past 3 years. It can qualify you for lower-down-payment options — as little as 3% down on conventional loans.
                </div>
              )}
            </div>
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
              <div style={{ textAlign: "right", margin: "0 0 10px" }}>
                <button onClick={() => setShowInfoModal(true)}
                  style={{ background: "none", border: 0, color: "var(--primary)", fontSize: 12.5,
                    cursor: "pointer", padding: 0, textDecoration: "underline", fontWeight: 500 }}>
                  ⓘ Mortgage Terms and Payment Definitions
                </button>
              </div>
              {routeMsg ? (
                <div className="flag" style={{ marginBottom: 0 }}>{routeMsg}</div>
              ) : (
                <div className="cards">{cards.map(({ p, elig }) => (
                  <Card key={p.product} p={p} reason={elig.eligible ? undefined : elig.reason} />
                ))}</div>
              )}
              {agentName && <div className="route">Your agent: {agentName}</div>}
              <div className="route">Your loan officer: {loName}</div>
              {!leadDone ? (
                <button className="leadbtn" onClick={() => setShowLeadModal(true)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <StepBadge label="2" />Connect me with a loan officer
                </button>
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
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      If you booked a meeting, you can reschedule or cancel anytime using the
                      Calendly confirmation email that was sent to you.
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {leadId && (
                        <button onClick={() => { setEditingContact(true); setLeadMsg(null); setShowLeadModal(true); }}
                          style={{ background: "transparent", border: "1px solid var(--line)",
                            color: "var(--primary)", padding: "8px 12px", borderRadius: 8, fontWeight: 600,
                            cursor: "pointer", fontSize: 13 }}>
                          Update my info
                        </button>
                      )}
                      <button onClick={resetAll} style={{ background: "transparent",
                        border: "1px solid var(--line)", color: "var(--primary)", padding: "8px 12px",
                        borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                        Start over
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="disctop">
                This is NOT a Loan Estimate (LE) as defined by RESPA or TILA — a formal Loan Estimate will only be provided after you submit a complete, official mortgage application and your credit, income and property details are verified. See Disclosures &amp; Assumptions for more information.
              </div>
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
              {quote.engine === "stub" ? "Demo / stub engine" : "Live engine"} · EarnedHome Pathfinder 1A
            </footer>
          )}
        </div>
      </div>

      <div className="cta">
        {!quote ? (
          <>
            <div className="ctahint">Complete the fields above, then tap Get Payments to see your options.</div>
            <button onClick={getPayments} disabled={loading || !formValid}
              style={{ opacity: loading || !formValid ? 0.55 : 1 }}>
              {loading ? "Calculating…" : <><StepBadge label="1" />Get Payments</>}
            </button>
          </>
        ) : (
          <>
            <div className="ctahint">
              Changed a number? Recalculate. To finish, use “Connect me with a loan officer” above.
            </div>
            <button onClick={getPayments} disabled={loading || !formValid}
              style={{ background: "transparent", color: "var(--primary)", border: "2px solid var(--primary)", opacity: loading || !formValid ? 0.55 : 1 }}>
              {loading ? "Calculating…" : <><StepBadge label="1" />Recalculate</>}
            </button>
          </>
        )}
      </div>

      {showLeadModal && quote && (
        <div onClick={() => { setShowLeadModal(false); setEditingContact(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, maxWidth: 440, width: "100%",
              padding: "24px 24px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" }}>
            <button onClick={() => { setShowLeadModal(false); setEditingContact(false); }} aria-label="Close"
              style={{ position: "absolute", top: 12, right: 16, background: "none", border: 0,
                fontSize: 26, lineHeight: 1, color: "var(--muted)", cursor: "pointer" }}>×</button>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", marginBottom: 4 }}>
              {editingContact ? "Update your info" : `Connect with ${loName}`}
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              {editingContact
                ? "Change your name, email, or phone below, then save."
                : `Share your info, then choose how you'd like to connect with ${loName}.`}
            </div>
            <input placeholder="Full name *" required value={leadName} onChange={(e) => setLeadName(e.target.value)} />
            <div className="spacer" />
            <input placeholder="Email *" type="email" inputMode="email" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
            <div className="spacer" />
            <input placeholder="Phone *" type="tel" inputMode="tel" required value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} />
            {editingContact && (
              <button className="leadbtn" onClick={updateContact} disabled={leadSubmitting}
                style={{ width: "100%" }}>
                {leadSubmitting ? "Saving…" : "Save changes"}
              </button>
            )}
            {!editingContact && (
            <label className="consent">
              <input type="checkbox" checked={tcpa} onChange={(e) => setTcpa(e.target.checked)} />
              I agree to be contacted by phone, text, or email about my inquiry. Consent is not a condition of purchase.
            </label>
            )}
            {!editingContact && (<>
            {applyUrl && (
              <button className="leadbtn" onClick={() => submitLead("apply")} disabled={leadSubmitting}
                style={{ width: "100%" }}>
                {leadSubmitting ? "Connecting…" : "Apply / Reserve your mortgage"}
              </button>
            )}
            {loPhone && (
              <button onClick={() => submitLead("call")} disabled={leadSubmitting}
                style={{ width: "100%", marginTop: 8, padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                  background: "#fff", color: "var(--primary)", border: "2px solid var(--primary)", fontWeight: 700, fontSize: 15 }}>
                Call {loName}
              </button>
            )}
            {bookingUrl && (
              <button onClick={() => submitLead("book")} disabled={leadSubmitting}
                style={{ width: "100%", marginTop: 8, padding: "11px 14px", borderRadius: 10, cursor: "pointer",
                  background: "#fff", color: "var(--primary)", border: "2px solid var(--primary)", fontWeight: 700, fontSize: 15 }}>
                Book a time
              </button>
            )}
            <button onClick={() => submitLead("reach-out")} disabled={leadSubmitting}
              className={applyUrl ? undefined : "leadbtn"}
              style={applyUrl
                ? { width: "100%", marginTop: 8, padding: "11px 14px", borderRadius: 10, cursor: "pointer", background: "#fff", color: "var(--primary)", border: "2px solid var(--primary)", fontWeight: 700, fontSize: 15 }
                : { width: "100%" }}>
              {leadSubmitting ? "Connecting…" : `Have ${loName} reach out`}
            </button>
            </>)}
            {leadMsg && <div className="hint" style={{ marginTop: 8 }}>{leadMsg}</div>}
          </div>
        </div>
      )}

      {showInfoModal && (
        <div onClick={() => setShowInfoModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, maxWidth: 460, width: "100%", maxHeight: "85vh",
              overflowY: "auto", padding: "24px 24px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", position: "relative" }}>
            <button onClick={() => setShowInfoModal(false)} aria-label="Close"
              style={{ position: "absolute", top: 12, right: 16, background: "none", border: 0,
                fontSize: 26, lineHeight: 1, color: "var(--muted)", cursor: "pointer" }}>×</button>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", marginBottom: 4 }}>
              Understanding your estimate
            </div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, lineHeight: 1.5 }}>
              Plain-language definitions of the numbers on each card. These are estimates — your loan officer can
              walk through the specifics for your situation.
            </div>
            <InfoTerm t="Principal & Interest" d="The core of your monthly payment — principal pays down what you owe; interest is the cost of borrowing." />
            <InfoTerm t="Property Taxes" d="The estimated monthly share of your property taxes, collected and paid through escrow." />
            <InfoTerm t="Homeowner's Insurance" d="The estimated monthly share of your homeowner's insurance, collected through escrow." />
            <InfoTerm t="Mortgage Insurance" d={<>
              Mortgage Insurance (MI) protects the lender in case of default.
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>On conforming conventional loans, MI is typically required when your Loan-to-Value (LTV) ratio is greater than 80%.</li>
                <li>The monthly MI payment depends on your credit score and LTV ratio.</li>
                <li>FHA loans include an Upfront Mortgage Insurance Premium (which can often be financed into the loan) plus ongoing monthly MIP.</li>
                <li>VA loans have an Upfront Funding Fee (which can be financed). The fee varies based on first-time or subsequent use of your VA benefit. Veterans with a service-connected disability may qualify for a waiver — consult your licensed loan officer.</li>
              </ul>
            </>} />
            <InfoTerm t="Total Monthly Payment" d="Your estimated total monthly payment — principal, interest, taxes, insurance, and any mortgage insurance." />
            <div style={{ fontWeight: 700, color: "#0f6e56", fontSize: 14, margin: "14px 0 4px" }}>Estimated Funds (cash to close)</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 10px" }}>
              This is <strong>not</strong> a Loan Estimate (LE) as defined by RESPA or TILA — a formal Loan Estimate will only be provided after you submit a complete, official mortgage application and your credit and property details are verified.
            </div>
            <InfoTerm t="Loan Fees" d="The costs to set up your loan — origination, underwriting, processing, and similar. Your loan officer can walk through which apply to you." />
            <InfoTerm t="Prepaids" d="Amounts collected upfront to start your escrow account and cover the first stretch of property taxes, homeowner's insurance, and prepaid interest." />
            <InfoTerm t="Down Payment" d="The part of the purchase price you pay out of pocket; the rest is covered by the loan." />
            <InfoTerm t="Less Seller Contribution" d="Money the seller agrees to put toward your closing costs, which lowers the cash you bring. Limits apply by loan type. Consult with your licensed Loan Officer." />
            <InfoTerm t="Estimated Total" d="The estimated cash you'd bring to closing — down payment plus loan fees and prepaids, minus any seller contribution. These are general explanations. Always consult with your licensed loan officer for details specific to your loan program, credit, and situation." />
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#eef7f0", border: "1px solid #bfe3c9",
              borderRadius: 10, fontSize: 13, color: "var(--primary)", lineHeight: 1.5 }}>
              Wondering if your payment could be lower? Your loan officer can talk through options for your situation —
              no pressure.
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
function InfoTerm({ t, d }: { t: string; d: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)" }}>{t}</div>
      <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 }}>{d}</div>
    </div>
  );
}

// Which lending family a product belongs to (drives its eligibility check).
function famOf(p: PricingProduct): Family {
  return p.isVa ? "va" : p.isFha ? "fha" : "conventional";
}

function Card({ p, reason }: { p: PricingProduct; reason?: string }) {
  // Ineligible for this scenario: show the product greyed-out with the reason,
  // not the (inapplicable) payment numbers.
  if (reason) {
    return (
      <div className="card" style={{ opacity: 0.55 }} aria-disabled="true">
        <div className="top">
          <div className="nm">{p.displayName}</div>
        </div>
        <div style={{ padding: "12px 0 4px", lineHeight: 1.5 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>
            Not available for this scenario
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{reason}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="top">
        <div className="nm">{p.displayName}</div>
        <div className="rt">Rate {p.rate.toFixed(3)}% · APR {p.apr.toFixed(3)}%</div>
      </div>
      <div className="rows">
        <Row l="Principal & Interest" v={money(p.principalAndInterest)} />
        <Row l="Property Taxes" v={money(p.taxes)} />
        <Row l="Homeowner's Insurance" v={money(p.insurance)} />
        <Row l="Mortgage Insurance" v={p.mortgageInsurance ? money(p.mortgageInsurance) : "—"} />
        <div className="rw total"><span>Total Monthly Payment</span>
          <span className="v">{money(p.totalPayment)}/mo</span></div>
        <div style={{ marginTop: 8, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f6e56", marginBottom: 4 }}>Estimated Funds</div>
          <EfRow l="Loan Fees" v={money(p.loanFees)} />
          <EfRow l="Prepaids" v={money(p.prepaids)} />
          <EfRow l="Down Payment" v={money(p.downPayment)} />
          <EfRow l="Less Seller Contribution" v={money(p.lessSeller)} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700,
            color: "#0f6e56", paddingTop: 6, marginTop: 4, borderTop: "1px dashed var(--line)" }}>
            <span>Estimated Total</span><span>{money(p.cashToClose)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function Row({ l, v }: { l: string; v: string }) {
  return <div className="rw"><span>{l}</span><span className="v">{v}</span></div>;
}
// Estimated Funds line — teal, to mirror the spreadsheet's breakdown section.
function EfRow({ l, v }: { l: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#1d9e75", padding: "2px 0" }}>
      <span>{l}</span><span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
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
