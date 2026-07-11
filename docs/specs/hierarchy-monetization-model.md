# Hierarchy & Monetization Model — EarnedHome

**Audience:** Richard McHargue (R Parry Financial) and the EarnedHome team.
**Purpose:** Explain — in plain English — how the mortgage industry stacks up, how EarnedHome models it, what works **today (Phase 1A)** vs. what comes in **Phase II** and **Phase III**, why R Parry can go live **right now**, and the best ways to **make money** at the wholesaler level and the loan-officer level.

> One-line summary: **The rate sheet lives with the broker. The book lives with the loan officer. Every broker is its own tenant today; "many LOs inside one broker" is Phase II; "a wholesaler over many brokers" is Phase III.**

---

## 1. The industry, in plain English

Picture the mortgage business as a five-rung ladder. Money and rates flow **down**; leads and loans flow **up**.

```
  WHOLESALER            e.g., Rocket Mortgage (TPO / wholesale channel)
      │                 Sets the raw rates. The "factory."
      ▼
  BROKER                e.g., R Parry Financial (company NMLS 1924318)
      │                 Owns the wholesaler relationship, the rate sheet, the brand.
      ▼
  LOAN OFFICER (LO)     e.g., Richard (individual NMLS 927662)
      │                 Owns the "book": their leads, agents, pipeline, production.
      ▼
  REFERRAL PARTNER      e.g., a real-estate agent (Jane Realtor)
      │                 Sends buyers in; gets attribution/credit.
      ▼
  BUYER                 The homebuyer who runs an estimate and connects.
```

**What each rung owns — the two rules that drive everything:**

- **The rate sheet lives with the BROKER.** The broker holds the wholesaler relationship and gets pricing from the wholesaler. Every loan officer *under that broker* prices off the **same** broker rate sheet. An LO cannot originate a loan without a broker's rate sheet behind them.
- **The book lives with the LOAN OFFICER.** The LO's leads, their referral agents, their pipeline, and their production history are *theirs*.

**A helpful analogy — a real-estate brokerage.** The **broker** is like Ebby Halliday or Berkshire Hathaway HomeServices — the firm that holds the licenses and the brand. The **loan officer** is like an individual agent working under that firm. The firm sets the shingle everyone hangs under; each agent brings their own clients.

### Where R Parry sits (important)
Richard is a special, very common case: **he is the broker *and* the loan officer at the same time.** He holds **two** licenses — the **company** license (R Parry Financial, NMLS 1924318 = the broker) and his **individual** license (NMLS 927662 = the LO). So R Parry is a "one-person shop" where the broker rung and the LO rung are the same person. **That is exactly the simplest case — and exactly what EarnedHome is built for today.**

---

## 2. Who can see what — the visibility roll-up

Each rung sees **everything below it, nothing sideways, nothing above.**

```
WHOLESALER (Rocket)   ── sees ALL brokers that use EarnedHome + Rocket   [Phase III]
   └─ BROKER (R Parry) ── sees ALL of its loan officers                  [Phase II]
        └─ LO (Richard) ── sees ONLY their own leads / agents / pipeline [Phase II]
             └─ AGENT ── sees only what they're attributed to
```

So if R Parry ever runs **five** loan officers:
- Each LO logs in with their **own** account and sees **only their own** leads, agents, and pipeline.
- **R Parry (the broker admin) sees all five** rolled up.
- If Rocket ever bought in at the top, **Rocket would see all the brokers under it** — most likely as **rolled-up production/volume**, not every buyer's personal information (privacy + broker comfort). *How much detail each rung sees is a setting we'd define per level.*

**One nuance worth saying out loud:** today the tenant admin (R Parry) already sees **everything in the tenant**. Splitting that so each LO sees **only their own slice** is the Phase II work. It's an *addition*, not a rebuild.

---

## 3. What works TODAY — Phase 1A (live now)

Everything R Parry needs to run the pilot is **built and working**:

- **One broker = one tenant.** A tenant is R Parry's own private, branded instance — its own rate sheet, its own branding (header shows company NMLS 1924318), its own dashboard login, its own buyer data, fully walled off from any other tenant.
- **The buyer tool + dashboard.** Buyers run real, lender-backed estimates (Conventional / FHA / VA, incl. Jumbo) with full payment and cash-to-close breakdowns, then connect to the LO. The LO works the pipeline (`new → working → closed/funded`) with metrics.
- **Referral-agent attribution.** Each agent (e.g., Jane Realtor) gets their own link (`/a/<slug>`); every buyer who comes through it is credited to that agent. On/off toggle, email invites, inline edit — all live.
- **Multiple brokers, side by side.** You can onboard **more brokers right now** — each becomes its own separate tenant, isolated from the others. (More on this parallel-run in §4.)

**The key limitation, stated plainly:**
> **Today you cannot put multiple loan officers *inside one broker*.** One tenant = one book. Because R Parry is a broker-and-LO-in-one, that's a perfect fit for the pilot. It only becomes a limitation when you onboard a broker who has *several* independent LOs under one roof — and that's Phase II.

---

## 4. The "parallel run" — bringing on a second broker now

**Question: if another broker wants to come aboard alongside R Parry, do we set up a separate tenant? — Yes.**

Each broker is its **own tenant**: its own rate sheet, branding, agents, buyers, and login, completely isolated from R Parry by the database's security rules. R Parry and "Broker B" run **in parallel and never see each other's data.**

**This works today — with one condition:** it's straightforward as long as Broker B is a **single-LO shop** (a broker-and-LO-in-one, just like R Parry). You clone the tenant and you're live. The moment Broker B wants **several LOs under one account**, *that broker* needs the Phase II capability — but adding the parallel tenant itself is a today thing.

| Capability | Status |
|---|---|
| **Parallel brokers** (Broker B alongside R Parry) = separate tenants | ✅ **Works today** |
| **Multiple LOs *under one* broker** (each sees only their own) | ⏳ **Phase II** |
| **Wholesaler over many brokers** (Rocket at the top) | ⏳ **Phase III** |

So you can **grow the customer count now** (many single-LO brokers, each a tenant) without building anything new. What you can't yet do is serve *one* broker that houses *several* LOs.

---

## 5. Phase II — many loan officers under one broker

**The trigger:** you sign a broker (or R Parry grows) that has **2+ loan officers** who each need their own login and their own slice.

**What gets built (all additive — no rewrite):**
- A **broker → LO hierarchy** (parent/child) so one broker rate sheet is **shared** by all its LOs.
- **Per-LO scoping:** each lead/agent is tagged to a specific LO; each LO sees only their own; the broker admin sees all of them rolled up.
- **LO portability / re-parenting:** if an LO moves to a different broker, we can move their **book** with the rules below.

**What travels vs. what stays when an LO leaves** (the real-estate-agent parallel you raised):
- **Travels with the LO:** their **relationships / sphere** — their referral agents and their contacts. (Like an agent taking their client relationships to a new brokerage.)
- **Stays with the broker/shop:** the **active, in-flight pipeline** (loans already in process) and the **broker's rate sheet** (it was never the LO's). You don't yank a borrower who's mid-loan.
- **Belongs to the LO as a record:** their **production history / track record** (their numbers follow them as proof of performance).

This mirrors exactly what you said: an LO wouldn't want to abandon an active, in-place borrower — so active pipeline stays put; the relationships and the track record travel.

---

## 6. Phase III — the wholesaler tier (selling at the top)

**The trigger:** a wholesaler (e.g., Rocket) wants EarnedHome pushed down across **their** broker/LO network — a top-down, enterprise play.

**What gets built:**
- A **wholesaler rung** above brokers — Rocket as a parent over many broker tenants.
- **Roll-up reporting** for the wholesaler (aggregate production across all their brokers, with privacy-appropriate detail).
- **Multi-level billing / seat management** so seats can be bought and distributed from the top (see §7).
- Optionally, **AI surfaces** (LO Copilot, predictive lead scoring) as premium tiers layered across the network.

None of this blocks today's design — it sits **on top** of the multi-tenant foundation already in place.

---

## 7. Monetization — how EarnedHome makes money

There are two directions to sell, and they can coexist. **Compliance note first (read this):** mortgage has a hard rule — **RESPA Section 8** — that you **cannot tie payments to the referral of loan business.** EarnedHome must always be priced as **software licensed at fair market value**, *never* as a per-loan or per-referral kickback. The models below are all built as SaaS licensing. *This is a general framing, not legal advice — have counsel bless the final pricing.*

### A. Bottom-up: sell to the Loan Officer / Broker (start here)
This is the R Parry motion — and where you begin.

- **Per-seat SaaS subscription** — a flat monthly (or annual) fee **per loan-officer seat.** Predictable, RESPA-clean, easy to explain. This is the core.
- **Tiered plans** that grow with value:
  - **Base** — buyer tool + LO dashboard + referral-agent attribution.
  - **Pro** — adds the **AI LO Copilot** (drafts follow-ups, lead summaries, daily digest) and **predictive lead scoring**. Justifies a higher per-seat price and makes the tool *sticky* (an LO won't leave a tool that writes their follow-ups and tells them who to call).
  - **Team/Broker** — the Phase II multi-LO broker view + roll-up reporting; priced per active LO with a broker platform fee.
- **Add-ons:** extra referral-agent seats, extra branded links, premium AI features, multilingual (Spanish) buyer experience.
- **Onboarding / setup fee** for standing up a new tenant (rate-sheet mapping, branding).

**Why bottom-up first:** fast to close (one decision-maker), proves value loan-by-loan, and each LO you land is a reference for the next. It also fits **LO-owned licensing** — if an LO owns their seat, it travels with them when they move brokers (the "bottom-up" ownership you favored).

### B. Top-down: sell to the Wholesaler (Phase III, the scale play)
Bigger contracts, longer sales cycle, huge distribution.

- **Enterprise platform license** — the wholesaler pays a **platform fee + per-active-LO** rate to enable EarnedHome across their broker network. They buy a **pool of seats** and distribute them (this is the **top-down licensing** model: the wholesaler owns the seats; if an LO leaves the network, the seat returns to the pool).
- **Enablement / channel model** — the wholesaler subsidizes the tool for brokers who use them, as a **bona-fide software benefit** (must be fair-market software value, **not** contingent on loan volume — RESPA again).
- **Data & analytics premium** — the wholesaler pays for **aggregate, anonymized market intelligence** across their network (pull-through, product mix, regional demand). High-margin, and it compounds as more brokers join.
- **White-label / co-brand fee** — the wholesaler's brand on the platform across their network.

### C. Seats vs. data — the ownership question you raised
Keep **two things separate**:
- **Seat ownership (who paid for the license):**
  - *Top-down* → the **wholesaler** owns the seat pool; a departing LO's seat returns to the pool.
  - *Bottom-up* → the **LO** owns their seat; it travels with them.
  - *Hybrid* (recommended long-term) → support both, set per contract.
- **Data ownership (who keeps the book):** governed by §5 — relationships travel with the LO, active pipeline stays with the broker, the rate sheet always stays with the broker.

> Selling a seat and owning the data are different levers. A wholesaler can *pay for* the seat (top-down) while the **broker** still owns the rate sheet and the **LO** still owns their relationships. Design the contract, not just the code, around that.

### Recommended sequence
1. **Now:** bottom-up, per-seat, to single-LO brokers like R Parry. Land, prove, reference.
2. **Phase II:** add the Broker/Team tier (multi-LO) — now you can sell a whole brokerage, not just a solo LO.
3. **Phase III:** top-down enterprise to a wholesaler — platform + per-active-LO + data/analytics premium, layered with AI upsells.

---

## 8. What this means for Richard, right now

- **You can go live today.** R Parry is the broker-and-LO-in-one case — exactly what's built and working. Nothing about the bigger hierarchy needs to exist for you to run the pilot.
- **You can add more solo brokers in parallel today** — each is its own isolated tenant.
- **You are *not* yet ready to hand this to a broker with multiple LOs** — that's Phase II, and it's built *when a multi-LO broker (or Rocket) is actually on the table*, not before. Building ahead of demand wastes money and risks building the wrong thing.
- **Nothing today paints us into a corner.** Today's design is a clean *subset* of the full ladder. Phase II and Phase III are **additions on top** of the same multi-tenant foundation — additive migrations, not rewrites.

---

## 9. The gap at a glance (today → target)

| Piece | Today (Phase 1A) | Phase II | Phase III |
|---|---|---|---|
| Broker as a tenant | ✅ Built | ✅ | ✅ |
| Parallel brokers (separate tenants) | ✅ Built | ✅ | ✅ |
| Referral-agent attribution | ✅ Built | ✅ | ✅ |
| Buyer tool + LO dashboard + metrics | ✅ Built | ✅ | ✅ |
| Rate sheet shared across a broker's LOs | LO = broker (n/a yet) | ✅ Build | ✅ |
| Multiple LOs under one broker | ❌ Not yet | ✅ Build | ✅ |
| Per-LO visibility scoping | ❌ Not yet | ✅ Build | ✅ |
| LO portability / re-parenting | ❌ Not yet | ✅ Build | ✅ |
| Wholesaler tier + roll-up | ❌ Not yet | ❌ | ✅ Build |
| Multi-level billing / seat pools | ❌ Not yet | Partial | ✅ Build |

---

*Companion docs: [`multi-loan-officer-routing.md`](multi-loan-officer-routing.md) (the Phase II technical spec), [`ai-opportunity-map.md`](ai-opportunity-map.md) and [`lo-copilot.md`](lo-copilot.md) (the AI premium tiers), [`../ROADMAP_PHASE_2_3.md`](../ROADMAP_PHASE_2_3.md).*
*Compliance framing here is general and not legal advice; confirm any pricing/relationship model with mortgage compliance counsel.*
