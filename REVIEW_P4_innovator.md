# Persona 4 — the innovator (25 years building products)

**How I looked at it:** what Attune already has that nobody else has together — a private on-phone AI, code that reads money /
food / debts / reminders exactly, agents that read real websites, notification reading, the watch, 30 country packs — and
which small additions turn those pieces into something people can't live without. I also checked where the market is going in
2026: memory is now expected, the new edge is **proactive** assistants that work in the background, and the winners mix
on-device with cloud and keep the person in control of permissions
([Vellum review](https://www.vellum.ai/blog/best-personal-ai-assistants-with-memory),
[AI assistant news 2026](https://bump.arahi.ai/blog/ai-assistant-news-updates-2026)). Attune is already on-device and permission-
first; what it lacks is the proactive layer.

Each idea: **what it is · why it matters · what already exists · effort.**

## A. Stronger — Attune works while you're not looking
1. **The morning card (proactive, one notification a day).** "Today: Sheikh's payment is due (2,444) · Netflix renews tomorrow ·
   you're 300 kcal under goal yesterday · the AirPods agent found 8,700 (was 9,400)." People open apps that tell them something
   new. *Exists:* timeline.js, safespend, agents, Fit day totals, DailyWidget. *Effort:* small (one composer + the existing
   notification channel).
2. **Attune Saves (your parked idea).** A monthly receipt: "Attune saved you EGP 3,420 — a double charge caught, a price drop,
   a subscription you cancelled, a debt collected." It is retention *and* the best marketing screenshot. *Exists:* Guardian,
   Overpaying, agents' price history, People & plans. *Effort:* medium.
3. **Agents that learn your taste.** After two "Not this one", the agent says "you skip refurbished and sellers under 4★ — I'll
   filter those". *Exists:* skip lists per agent. *Effort:* small.
4. **Price history for every agent check** — a line chart and "best time to buy" (the checks are already saved).
   *Effort:* small.
5. **Ask-anything over your own life.** "How much did I spend on Ahmed's family this year?", "when did I last pay the
   electricity?" — Your life already answers many; add the long tail through the model with code-computed numbers only.
   *Effort:* medium.

## B. Faster — the phone feels instant
6. **Code first, model second (keep pushing it).** Today's tests show code handles ~85 % of what people type on Home in
   milliseconds. Every sentence that reaches the model without need is a 2–10 second wait — log which ones, and add readers.
   *Effort:* ongoing, small each time.
7. **A tiny "router" model** (≈100 MB) for understanding what a sentence wants, so the big model only wakes for real
   questions. *Effort:* medium (train on the app's own test sentences + the ones people type).
8. **Warm the model when the person is likely to ask** (they opened Chat, the mic, the interpreter — done today for the
   interpreter). *Effort:* small.

## C. Easier — fewer taps, fewer screens
9. **One camera button that knows what it sees**: receipt → Money, plate → Fit, bill → Follow-ups, document → Saved, menu or
   sign → Translate, barcode → product. *Exists:* every reader (receipt, plate, barcode, OCR, translate). *Effort:* medium (a
   classifier on top).
10. **Share anything to Attune** (a WhatsApp message, a bank SMS, a screenshot, a link) → it says what it will do in one line,
    you tap ✓. *Exists:* the share path for photos/text and paylog. *Effort:* small.
11. **Home-screen widget with the box** — type "lunch 150" without opening the app. *Exists:* widgets. *Effort:* small.
12. **Voice as the main way in the car and the kitchen** — the voice screen now answers anything; add "what's left today?"
    style questions read out loud. *Effort:* small.

## D. Valuable — new things worth paying for
13. **Family space**: shared groceries to-do, shared expenses (who paid what), family medicines and reminders for parents.
    *Exists:* Sync (Wi-Fi / Google), Family health. *Effort:* medium-large. Big for Egypt (family finances are shared).
14. **Bills autopilot**: People & plans + Guardian + Agents → "your electricity bill usually arrives on the 10th; this month
    it's 40 % higher than usual — check the meter reading". *Effort:* medium.
15. **Health that connects**: blood pressure + sugar + meals + steps on one weekly page for a doctor (PDF to share).
    *Exists:* Health report, Family health, Fit. *Effort:* small-medium. Missing BP logging (found by persona 1).
16. **Optional cloud boost (paid add-on)** for the 5 % that the phone can't do well — long research, a 300-page document,
    a hard maths problem — with a clear "this leaves your phone" switch. Keeps the private promise, fixes the "weaker than
    ChatGPT" gap. *Effort:* medium; a real revenue line.

## My top 5 to do first
1 (morning card) · 2 (Attune Saves) · 9 (one smart camera) · 13 (family space) · 16 (cloud boost add-on).

## Redone hands-on (28 Oct): how close each top idea already is — tried in the app
**What I did:** checked each idea against what the app really does today, on a phone-size screen in customer mode: shared five
texts into Attune the way Android hands them over (Share → Attune), looked for the morning card, the widgets, the camera
entry points and the agents' memory of "Not this one".

| Idea | What is there today (tried) | Gap |
|---|---|---|
| **10. Share anything to Attune** | A bank SMS → Money's add sheet, filled in. **Fixed now:** the shop was read as «حسابك بطاقة رقم» and the category as Food — now «كارفور», Groceries. "Ahmed owes me 500…", "Remind me tomorrow at 9…", "lunch 150, taxi 60", "Meeting with Orascom on Thursday at 2pm" all **land in Mind as notes** with a "Do something with it" button | Run shared text through the Home reader and show its one line ("Ahmed owes you 500 — save?") with ✓ — the reader already understands all four. *Small; the biggest quick win.* |
| **1. Morning card** | Only the Missions "debrief" (missions-…) and per-feature reminders (daily learn / news / fit). Nothing sums up the day | One composer over Follow-ups + Money + Fit + Agents → one notification. *Small.* |
| **11. Widget with the box** | Two widgets (Daily info, Fit info) — read-only | A third widget that opens the Home box focused. *Small.* |
| **9. One smart camera** | 39 separate camera / photo / scan buttons across the app | One camera that sorts receipt / plate / barcode / document. *Medium.* |
| **3. Agents learn taste** | "Not this one" is kept per agent (`skip`) but only hides that exact offer | Learn the pattern after two skips (refurbished, low rating, a seller). *Small.* |
| **13. Family space** | Family health + Sync exist; money and to-dos are one person's | *Medium-large.* |

**Order I'd build them (unchanged top 5, re-ranked by effort now that it's measured):** 10 → 1 → 11 → 3 → 9.
