# EH_Out tab — block-read layout (build sheet for Richard)

**Goal:** gather every output the app reads into ONE contiguous grid so the app reads it in a single call (instead of ~78 cell reads). The cells are just *references* to values that already exist, so this does **not** change any pricing — and Richard can rearrange the Front/Engine sheets freely; only this tab matters to the app.

## 1. Add a tab named `EH_Out`

## 2. Fill this grid

**Column A** is a human label (the app ignores it). **Columns B→N** hold the 13 values the app reads, in this exact order. **Order is the contract** — the app maps by position, so don't reorder rows or columns.

| Col | Field |
|---|---|
| A | (product label — for humans only) |
| B | name |
| C | rate |
| D | apr |
| E | Principal & Interest (pi) |
| F | taxes |
| G | insurance (ins) |
| H | mortgage insurance (mi) |
| I | total |
| J | loanFees |
| K | prepaids |
| L | downPayment |
| M | lessSeller |
| N | cashToClose |

**Rows** (one product each, fixed order):

| Row | A (label) | B | C | D | E | F | G | H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | *(header labels — optional)* | name | rate | apr | pi | taxes | ins | mi | total | loanFees | prepaids | downPayment | lessSeller | cashToClose |
| 2 | 30-yr Fixed | `=eh_out_fixed30_name` | `=eh_out_fixed30_rate` | `=eh_out_fixed30_apr` | `=eh_out_fixed30_pi` | `=eh_out_fixed30_taxes` | `=eh_out_fixed30_ins` | `=eh_out_fixed30_mi` | `=eh_out_fixed30_total` | `=eh_out_fixed30_loanFees` | `=eh_out_fixed30_prepaids` | `=eh_out_fixed30_downPayment` | `=eh_out_fixed30_lessSeller` | `=eh_out_fixed30_cashToClose` |
| 3 | 30-yr FHA | `=eh_out_fha30_name` | `=eh_out_fha30_rate` | `=eh_out_fha30_apr` | `=eh_out_fha30_pi` | `=eh_out_fha30_taxes` | `=eh_out_fha30_ins` | `=eh_out_fha30_mi` | `=eh_out_fha30_total` | `=eh_out_fha30_loanFees` | `=eh_out_fha30_prepaids` | `=eh_out_fha30_downPayment` | `=eh_out_fha30_lessSeller` | `=eh_out_fha30_cashToClose` |
| 4 | 15-yr Fixed | `=eh_out_fixed15_name` | `=eh_out_fixed15_rate` | `=eh_out_fixed15_apr` | `=eh_out_fixed15_pi` | `=eh_out_fixed15_taxes` | `=eh_out_fixed15_ins` | `=eh_out_fixed15_mi` | `=eh_out_fixed15_total` | `=eh_out_fixed15_loanFees` | `=eh_out_fixed15_prepaids` | `=eh_out_fixed15_downPayment` | `=eh_out_fixed15_lessSeller` | `=eh_out_fixed15_cashToClose` |
| 5 | 15-yr FHA | `=eh_out_fha15_name` | `=eh_out_fha15_rate` | `=eh_out_fha15_apr` | `=eh_out_fha15_pi` | `=eh_out_fha15_taxes` | `=eh_out_fha15_ins` | `=eh_out_fha15_mi` | `=eh_out_fha15_total` | `=eh_out_fha15_loanFees` | `=eh_out_fha15_prepaids` | `=eh_out_fha15_downPayment` | `=eh_out_fha15_lessSeller` | `=eh_out_fha15_cashToClose` |
| 6 | 30-yr VA | `=eh_out_va30_name` | `=eh_out_va30_rate` | `=eh_out_va30_apr` | `=eh_out_va30_pi` | `=eh_out_va30_taxes` | `=eh_out_va30_ins` | `0` | `=eh_out_va30_total` | `=eh_out_va30_loanFees` | `=eh_out_va30_prepaids` | `=eh_out_va30_downPayment` | `=eh_out_va30_lessSeller` | `=eh_out_va30_cashToClose` |
| 7 | 15-yr VA | `=eh_out_va15_name` | `=eh_out_va15_rate` | `=eh_out_va15_apr` | `=eh_out_va15_pi` | `=eh_out_va15_taxes` | `=eh_out_va15_ins` | `0` | `=eh_out_va15_total` | `=eh_out_va15_loanFees` | `=eh_out_va15_prepaids` | `=eh_out_va15_downPayment` | `=eh_out_va15_lessSeller` | `=eh_out_va15_cashToClose` |

**The only special cells:** `H6` and `H7` (VA mortgage insurance) = **`0`** — VA has no MI, so there's no named range to reference.

> Shortcut: every data cell follows the pattern `=eh_out_{row-prefix}_{column-field}`, where the row prefixes are `fixed30, fha30, fixed15, fha15, va30, va15` and the column fields are the 13 above. (Except VA MI = 0.)

## 3. Define one named range over the grid
- **`eh_out_grid`** = `EH_Out!$B$2:$N$7` (the 6 rows × 13 columns of data — **not** the label column A or header row 1).
- Leave **`eh_out_ratesAsOf`** as-is (the date, read separately as text).

## 4. What the app then does (code side — Marvin)
The adapter reads **`eh_out_grid`** (values + text) and **`eh_out_ratesAsOf`** in one batch, then maps row → product and column → field by position — replacing ~78 cell reads with one. A quote drops from ~6 round-trips to ~3 (open session → write+recalc → read grid), targeting ~1 second, with no toggle penalty and no fragility (named ranges survive layout edits).

## 5. Rules / gotchas
- **Don't reorder** rows or columns — position is the contract.
- Keep cells as **references** (`=eh_out_…`), not pasted values, so they stay live each recalc.
- If Richard later moves a source cell, he only fixes that one `eh_out_*` name; the grid and the app are untouched.
