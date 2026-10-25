# STATUS — FFXIV Gathering Route Planner

Last updated: 2026-10-25

## What was built

A static, offline, single-file web app for planning FFXIV gatherer (MIN/BTN)
routes by Eorzea time:

- `index.html` — the entire app (HTML + CSS + JS inline, no dependencies, no
  network calls). Features:
  - Live Eorzea clock (ET) + Earth time in the header, ticking via the
    standard `unixSeconds × 3600/175` conversion locked to the Unix epoch.
  - 24-hour slot picker with per-slot node counts; "Use current ET hour"
    button; smart default that skips empty bells.
  - Node cards for the selected slot: item, MIN/BTN chip, window label,
    zone + coordinates, nearest aetheryte, optional note, "open now" pill
    with remaining time.
  - Route panel: ordered stops with auto-generated travel notes
    (aetheryte → walk to coords), ↑/↓ reordering, remove; persisted in
    localStorage.
  - Per-stop live countdowns ("opens in…" / "open — closes in…") and a
    route-wide "next window" summary, refreshed 4×/second.
  - Favorite routes: named save, load, delete — all in localStorage.
  - "Copy route as text" for notes/guide sharing.
  - Data source handling: on HTTP(S) it loads an editable `nodes.json`; on
    `file://` it falls back to the embedded copy. A header badge shows which
    source is active.
- `nodes.json` — editable node data (starter set of 12 well-known timed
  nodes from ARR through Endwalker, sourced from public gathering databases).
- `tests/time-window.test.mjs` — 22 tests using Node's built-in test runner.
- `README.md` — usage, data-maintenance guide, credits for Asdale
  Dynamics, LLC.
- `LICENSE` — MIT, `Copyright (c) 2026 Asdale Dynamics, LLC`.

## How to run

- App: open `index.html` in a browser (works from `file://`, fully offline).
- Editable-data mode: `python3 -m http.server 8000` in this folder, then
  visit `http://localhost:8000`.
- Tests: `node --test tests/` (Node 18+, no dependencies).

## Verification results

- `node --test tests/` → **22/22 pass** (as of 2026-10-25):
  Eorzea epoch/bell/minute/second conversions, day wrap, far-from-epoch
  alignment, slot-window intersection edge cases, twice-daily window picking,
  open/closed countdown math (including day wrap), countdown/bell
  formatting, `nodes.json` integrity (shape, unique ids, valid windows),
  embedded fallback == `nodes.json`, inline scripts syntax-parse, and a
  "no remote URLs / no secret-looking strings" audit of `index.html`.
- DOM smoke test (throwaway script, not committed): booted the real inline
  script against a minimal DOM stub — 24 slots rendered, slot click shows the
  right node, add-to-route, favorite save/load, localStorage persistence, and
  tick path all exercised without errors.

## Known gaps

- Data coverage is a curated starter set, not a complete or guaranteed-current
  database (by design — the data is user-maintained); verify values in-game.
- Fisher timed spots and weather-conditional nodes are out of scope.
- The HTTP `fetch("nodes.json")` path was validated by code review and the
  file protocol path by the smoke test, but not in a real browser session.
- Route ordering is manual (↑/↓); no drag-and-drop.
- If both copies of the data change, the tests catch drift — but there is no
  build step to auto-sync the embedded fallback into `index.html`.
