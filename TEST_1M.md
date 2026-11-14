# The 1,000,000-case test (Ali, 14 Nov 2026)

> "I want after I finish to make a 1m test for everything in the app and every aspect in it — coding, user experience, UI and UX, all
> languages, chat smartness, etc. — but it has to be very very rigorous and hard and challenging."

Every case is DIFFERENT and has a checked expectation (not "it didn't crash"). Each part writes its own report; `tests/onemillion/run.sh`
runs them all and writes `tests/onemillion/REPORT.md` (totals, every failure class with examples, what was fixed).

| Part | Cases | What is checked |
|---|---|---|
| A. Understanding what people type (code) | 300,000 | 100,000 hard sentences (mega.mjs, new seed) + 100,000 chat orders (chat100k.mjs, new seed) + 100,000 NEW: the 20 interface languages and Franco — each language's own way of saying spend / remind / owe / open / ask, with typos, voice-to-text mistakes, mixed scripts. Kind + amount + time + person + direction checked. |
| B. Every feature's own generator | 300,000 | the 30 feature generators (agents, Free/Pro, setup, background thinking, brain, notifications, bank messages, rules, papers, IDs, passports, people, plans…) each run with 10,000 NEW cases (a new seed). |
| C. UI and UX | 200,000 | every screen × 20 languages × light / dark × phone / computer (≈ 12,000 screen views), each checked for ≈ 16 things: nothing wider than the screen, no clipped or overlapping text, no English left in another language, right-to-left for Arabic / Urdu / Persian, every button named for screen readers, tap targets ≥ 44 px, text contrast ≥ 4.5, no `{x}` / `undefined` / `NaN` shown, no JavaScript errors, back always works, the bottom bar never covers a button. |
| D. Answers by code ("chat smartness") | 150,000 | calculations (calc.js), "how much did I spend on X in Y", "who owes me", "what's due", the brain's facts, dates and times worked out, currencies, Hijri dates — each answer compared with the truth computed separately. |
| E. Flows end to end | 50,000 | multi-step journeys in the real page (say it → saved → Undo → edit → it appears in Money / Follow-ups / Home; agent made → checked → found → opened; setup interview; trial → Free → Pro) with random data. |
| **Total** | **1,000,000** | |

**The AI model**: a model on this machine answers in ~12 s on 4 CPU cores, so 1,000,000 model answers would take months. The model is
tested on what only it does (the cases code leaves to it) with a 2,000-case sample per model size, reported separately and honestly.

**Rule while running**: every failure class gets a fix AND a held-out case; a fix is only kept when the full suite stays green.
