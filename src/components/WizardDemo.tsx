"use client";

import { useState } from "react";

type Occupancy = "Primary" | "Second home" | "Investment";

const TOTAL = 6;

export function WizardDemo() {
  const [step, setStep] = useState(0);
  const [price, setPrice] = useState("");
  const [occupancy, setOccupancy] = useState<Occupancy>("Primary");

  const pct =
    step === 0 ? 8 : Math.round(((step + 1) / TOTAL) * 100);

  return (
    <div className="wz-wrap">
      {step > 0 && (
        <>
          <div className="wz-lab" style={{ marginBottom: 6 }}>
            Step {step + 1} of {TOTAL}
          </div>
          <div className="wz-progress" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
        </>
      )}

      {step === 0 && (
        <div className="wz-step" key="welcome">
          <div className="wz-h">Let&apos;s see where you stand</div>
          <div className="wz-sub">
            A few quick questions to show your buying power. No credit pull, no
            commitment, no pressure.
          </div>
          <div className="wz-chips">
            <span className="wz-chip">No credit pull</span>
            <span className="wz-chip">2 minutes</span>
            <span className="wz-chip">Private</span>
          </div>
          <button className="wz-btn" onClick={() => setStep(1)}>
            Start
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="wz-step" key="home">
          <div className="wz-lab">About the home</div>
          <div className="wz-h" style={{ fontSize: 18 }}>
            What home price are you considering?
          </div>
          <label htmlFor="wz-price">Home price</label>
          <div className="inwrap">
            <span className="pre">$</span>
            <input
              id="wz-price"
              className="money"
              inputMode="numeric"
              placeholder="450,000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <label htmlFor="wz-occ">Will this be your home?</label>
          <select
            id="wz-occ"
            value={occupancy}
            onChange={(e) => setOccupancy(e.target.value as Occupancy)}
          >
            <option>Primary</option>
            <option>Second home</option>
            <option>Investment</option>
          </select>
          <div className="wz-why">
            <span>
              We ask so your taxes and payment match this specific home. A range
              is fine — this is an estimate, not an application.
            </span>
          </div>
          <div className="wz-row">
            <button className="wz-btn ghost" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="wz-btn" onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wz-step" key="next">
          <div className="wz-lab">Nice — that&apos;s the idea</div>
          <div className="wz-h" style={{ fontSize: 18 }}>
            You just moved between steps without leaving the page.
          </div>
          <div className="wz-sub">
            Each step slides in place — same page, no reload. The rest of the
            journey (cash, credit, budget, your results, save) plugs in right
            here next.
          </div>
          <div className="wz-row">
            <button className="wz-btn ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="wz-btn" onClick={() => setStep(0)}>
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
