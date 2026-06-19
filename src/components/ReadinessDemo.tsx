"use client";

import { useState } from "react";

export function ReadinessDemo() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [income, setIncome] = useState("");
  const [debts, setDebts] = useState("");
  const [done, setDone] = useState(false);

  function finish() {
    setDone(true);
    setOpen(false);
    setStep(0);
  }
  function close() {
    setOpen(false);
    setStep(0);
  }

  return (
    <>
      <div className="panel">
        <div className="route">Your quick estimate</div>
        <div className="ctc">
          <span className="l">Estimated cash to close</span>
          <span className="n">$53,500</span>
        </div>
        <div className="rw">
          <span>Estimated payment</span>
          <span className="v">$3,279/mo</span>
        </div>

        <div className="score-box">
          {!done ? (
            <>
              <div className="score-lab">Your qualification score</div>
              <div className="score-sub">
                Answer a couple more questions to see where you stand — and
                exactly what it takes to qualify for this home.
              </div>
              <button className="wz-btn" onClick={() => setOpen(true)}>
                See my full readiness
              </button>
            </>
          ) : (
            <>
              <div className="score-lab">Your qualification score</div>
              <div className="score-num">
                78 <span className="score-of">/ 89 to qualify</span>
              </div>
              <div className="reco">
                <span className="reco-pill">Our read</span>
                <div className="reco-h">You&apos;re close — a few small moves</div>
                <div className="reco-sub">
                  A bit more down payment, or a VA loan, would get you there.
                  Here&apos;s the plan — at your pace, no pressure.
                </div>
              </div>
              <button className="wz-btn ghost" onClick={() => setDone(false)}>
                Start over
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grab" />
            <div className="sheet-top">
              <span className="wz-lab">A few more details · step {step + 1} of 2</span>
              <button className="sheet-x" aria-label="Close" onClick={close}>
                &times;
              </button>
            </div>
            <div className="wz-progress" aria-hidden="true">
              <i style={{ width: `${(step + 1) * 50}%` }} />
            </div>

            {step === 0 && (
              <div className="wz-step" key="income">
                <div className="wz-h" style={{ fontSize: 18 }}>
                  What&apos;s your monthly income?
                </div>
                <label htmlFor="rd-income">Monthly income (before taxes)</label>
                <div className="inwrap">
                  <span className="pre">$</span>
                  <input
                    id="rd-income"
                    className="money"
                    inputMode="numeric"
                    placeholder="6,500"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                  />
                </div>
                <div className="wz-why">
                  <span>
                    We use this to see what you can comfortably afford. Nothing
                    is shared without your okay.
                  </span>
                </div>
                <div className="wz-row">
                  <button className="wz-btn ghost" onClick={close}>
                    Skip for now
                  </button>
                  <button className="wz-btn" onClick={() => setStep(1)}>
                    Next
                  </button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="wz-step" key="debts">
                <div className="wz-h" style={{ fontSize: 18 }}>
                  About how much are your monthly debts?
                </div>
                <label htmlFor="rd-debts">Car, cards, student loans</label>
                <div className="inwrap">
                  <span className="pre">$</span>
                  <input
                    id="rd-debts"
                    className="money"
                    inputMode="numeric"
                    placeholder="900"
                    value={debts}
                    onChange={(e) => setDebts(e.target.value)}
                  />
                </div>
                <div className="wz-why">
                  <span>
                    An estimate is fine. This helps us show how close you are to
                    qualifying — and how to close the gap.
                  </span>
                </div>
                <div className="wz-row">
                  <button className="wz-btn ghost" onClick={() => setStep(0)}>
                    Back
                  </button>
                  <button className="wz-btn" onClick={finish}>
                    See my readiness
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
