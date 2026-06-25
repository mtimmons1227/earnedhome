# Speed optimization — "block reads" (workbook layout ask for Richard)

**For: the 6/25 meeting. Status: proposed. Optional — current quote time is already ~2s (down from ~7s).**

## The story so far
We made the buyer quote **~3× faster** (about 7 seconds → ~2 seconds) purely in code, by bundling the workbook calls (Microsoft Graph "batching"). No spreadsheet change was needed for that.

To get the rest of the way (toward ~1 second), there's **one optional change to the workbook** that only Richard can make. This note explains it in plain terms.

## Why it's still ~2 seconds
For every quote, the app reads **~78 individual numbers** out of the workbook — about 13 values for each of the 6 product cards (rate, APR, P&I, taxes, insurance, MI, total, loan fees, prepaids, down payment, less-seller, cash-to-close, and the heading). Today each of those 78 numbers is a **separate lookup**, and Microsoft Graph processes them one workbook "session" at a time, so they stack up.

## The fix: group each product's outputs into one block
If each product's ~13 output values sit **next to each other in one contiguous block** with a **single named range** over them, the app can grab an entire product in **one read instead of 13**. That turns ~78 reads into **6** — and the quote drops toward ~1 second.

### What Richard would do (one-time, ~20 min)
For each of the 6 products (30-yr Fixed, FHA 30, 15-yr Fixed, FHA 15, VA 30, VA 15):

1. Put that product's 13 output cells in **one contiguous strip** (a single row or single column), in a **fixed, agreed order** — for example:
   `name, rate, apr, P&I, taxes, insurance, mortgage-insurance, total, loan-fees, prepaids, down-payment, less-seller, cash-to-close`
2. Create **one named range** covering that whole strip, e.g. `eh_out_fixed30_block`, `eh_out_fha30_block`, `eh_out_fixed15_block`, `eh_out_fha15_block`, `eh_out_va30_block`, `eh_out_va15_block`.
3. Keep the existing per-cell named ranges if you like — leaving them does no harm.

The **order must be fixed and identical** across all six products, because the app maps values by position within the block.

### What I (Marvin / the code) do after
- Read the 6 block ranges in one batch instead of 78 cells, and map each value by its position in the strip.
- No change to any pricing math — this is purely *where the numbers sit*, not *what they are*.

## Decision for 6/25
- Is ~2 seconds good enough to launch the pilot, with block reads as a fast-follow? **(Recommended — ship at ~2s, optimize later.)**
- Or do we want Richard to do the block layout now to reach ~1 second before pilot?

Either way, no rush: the speed is already in a shippable place.
