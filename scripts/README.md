# Calc-validation harness

Proves the app's pricing matches Richard's workbook to the penny (Test Plan category A, WBS #26).

1. Richard runs each scenario in `engine-golden.json` through his workbook.
2. Fill the `null`s with the workbook's numbers.
3. Run it:
   - `npm run validate:engine` — uses the stub (sanity-checks the harness itself).
   - `PRICING_ADAPTER=graph npm run validate:engine` — the real engine (needs the workbook hosted + `GRAPH_*` env).
4. Any value outside `tolerance` ($1) fails and the script exits non-zero (so it can gate a deploy). Nulls print in "capture" mode showing the app's computed value.

Add scenarios freely — more coverage = safer launch.
