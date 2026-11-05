# Gemini Deep Research — 35 ideas (R1–R35), checked against the code (5 Nov 2026)

Ali uploaded Gemini's answer to `GEMINI_RESEARCH_PROMPT.md` ("Attune — Product & AI Strategy", 35 ideas + cuts + models).
This page is each idea checked against what Attune **already has** (searched in `web-src/` and the Android code), so Ali picks
only what is really new. Workflow (NEXT_CHAT.md): **Ali sends the IDs → build each** (20 languages, tests, full suite, APK).

Legend: ✅ already built · 🟡 partly built (only the missing piece is listed) · 🆕 new · ⚠️ needs Ali's decision or has a policy/honesty problem

## Verdicts

| ID | Idea | Verdict | What is already there / what would really be new |
|---|---|---|---|
| R1 | Code reads numbers & dates before the AI | 🟡 | Number guard + sentence battery + "19,500 in 2,500s" fix (5 Nov). New: lock **every** number into tokens before the model sees the sentence (the model can't change any figure) |
| R2 | Grammar-forced JSON for every tool | 🟡 | `actions.js` ACTION_GRAMMAR already forces reminders/alarms/WhatsApp. New: the same grammar for money, split, agents, lists |
| R3 | Franco → Arabic normaliser | 🟡 | Franco keyboard + Franco words exist. New: "daf3t 350 l a7med" → دفعت 350 لأحمد before parsing, digits-in-words vs real amounts, with a 200-sentence test |
| R4 | 3 chips "which did you mean?" + learns | ✅ | Built v9.1 (option A) and learns per sentence (v6.48) |
| R5 | One Undo for a change in several places | 🟡 | Undo exists per screen. New: one "Undo all" for a sentence that changed wallet + debt + follow-up |
| R6 | Bank notifications: full text, no duplicates | 🟡 | Full text (bigText + messages) and the duplicate filter are built. Missing: PayListener does not skip Android's **group summary** notification (ChatInbox/RecallLog/MessageWatch do) — 1-line fix, do it in the next build |
| R7 | Egypt rails (InstaPay, Vodafone/Orange/e&/WE Cash, Fawry) | 🟡 | `yusr/paytext.js` reads them. New: fee + balance + match the masked number to a person; "teach Attune" when a bank changes its wording |
| R8 | Fake transfer screenshot check | 🆕 | Scam check exists, but checking a WhatsApp screenshot **against the wallet/InstaPay notifications that really arrived** is new. Strong for Egypt |
| R9 | Close the day: each wallet + pocket cash | 🟡 | Close the day built v9.3. New: per-wallet "started / in / out / now" + "cash in pocket" stepper |
| R10 | Gam'eya payout ↔ big bills ↔ Zakāt | 🟡 | Zakāt complete (v9.2) and gam'eya exist. New: "your turn next month covers the car licence" link |
| R11 | Split a receipt with friends + WhatsApp settle card + Splitwise import | 🟡 | Family/Chat X-Ray split exist. New: tap receipt lines per friend, fewest transfers, settle card with InstaPay, Splitwise CSV import. ⚠️ Gemini's Splitwise numbers (2–3 a day, 10 s ad) are not verified — never use them in the store listing |
| R12 | Safe to spend today | ✅ | Built v6.37 (Home + widget) |
| R13 | Weekly "you spent more on X" card with a 1-tap fix | 🆕 | Small: once a week, only when a category is >25% above normal |
| R14 | Visa sites in a real browser, you pass the check once | ✅ | Built v9.4 G2 (AgentBrowser slot mode, WebView cookies) |
| R15 | Price agents that survive a site redesign (JSON-LD) | 🆕 | No JSON-LD / og:price reading today. Makes price, restock and price-protection agents break much less |
| R16 | Reply from the notification + scheduled messages | ✅ | Built v9.4 G1 (RemoteInput, wa.me fallback) |
| R17 | Licence/ID/bill expiry + traffic-fines page | 🟡 | Deadline radar exists. New: per-country pages (traffic fines, WE, Fawry) opened from the expiry card |
| R18 | Works in the first minute without the model | 🟡 | First minute built v9.3. To check on Ali's phone: does every step work before the model download ends? |
| R19 | 4 tabs only, the rest appears when you ask | ⚠️ | Design choice — Ali arranged the tabs himself (§5.84). Only as 2–4 options for Ali |
| R20 | Morning brief + "roll unfinished to tomorrow" | 🟡 | Close the day exists. New: a morning card + "move unfinished to tomorrow / Someday" (no red overdue pile) |
| R21 | Native quick-add from the widget (no WebView) | 🟡 | Widgets built v9.3. New: a native sheet that opens in <0.1 s. Big (Kotlin) |
| R22 | Privacy proof: bytes sent counter, screenshot block | 🟡 | Privacy week exists. New: real bytes-out counter (Android TrafficStats) + "block screenshots on Money". ⚠️ Must be honest: web answers and agents DO use the internet — show them, never claim "0 bytes" globally. SQLCipher = big, later |
| R23 | Tiny wake-word model (sherpa-onnx, Apache-2.0) | 🟡 | «يا أتيون» works (VOICE_PLAN option C). Swap to sherpa-onnx KWS only if Ali's phone test shows battery/false wakes |
| R24 | Heat & memory pilot (free the model after 30 s idle, lighter model when hot) | 🟡 | Speed & heat doctor exists. New: idle unload + switch down on thermal status / battery <20% |
| R25 | Folder of PDFs → one table of dates/amounts/obligations | 🆕 | Strong for work/desktop (contracts, invoices). Medium build |
| R26 | Share a voice note / 3 messages to Attune → promise, debt, date | 🟡 | Share of text/PDF exists. New: shared WhatsApp voice notes transcribed offline |
| R27 | One page per person (owes, promises, files, last contact) | 🟡 | Person history exists (v9.0 `personhist.js`: plans, loans, payments, sums). New: promises, files, last contact, WhatsApp statement |
| R28 | Screenshots filed automatically (Fawry codes, tickets) | ⚠️ | Needs broad photo access — Google Play's photo policy allows that only when it is the app's core use. Safer: "Share screenshot to Attune" |
| R29 | Money for two with automatic merge (CRDT) | 🟡 | Money for two built v9.3 (merge by id, newest wins). CRDT/Drive auto-sync = later |
| R30 | "after Asr by 15 minutes", "1 hour after iftar" | 🆕 | Prayer times exist (opt-in). New: reminders tied to a prayer that move each day |
| R31 | Lab results explained from the printed range | ✅ | `care.js` flags only against the report's own range. New bit only: read aloud + "add follow-up" |
| R32 | Affiliate tag on agent links | ⚠️ | Business choice for Ali (needs Amazon/Booking partner accounts; switch to turn it off; shown on the Privacy page) |
| R33 | Price per country + "day-5 what Attune did for you" card | 🟡 | `PRICES_BY_COUNTRY.md` exists (Egypt EGP 99/mo). New: the day-5 value card. ⚠️ Prices are Ali's decision |
| R34 | Travel day card + currency abroad | ✅ | Built v9.4 G6 (gate changes from notifications). New bit only: "35 eur" logged in the trip's currency |
| R35 | "#work / company pays me back" + claim PDF | 🆕 | Small and useful for Ali's own company; stays personal (no ERP — that is Attune Business) |

## Engine advice (section 6) — do without asking when measured better
- Thinking is already off on phones (`enable_thinking: false`). ✅
- **Keep the system prompt's memory (KV cache) between messages** — not done; would cut the wait before the first word. Measure, then keep.
- **Quantised KV cache (q8_0)** and **prompt-lookup speculation for PDF answers** — try in A1 model trials.
- **SQLite FTS5 (BM25) first, bge-m3 only on the top 25** — for Recall/Documents search; measure first.
- Model picks (Qwen3-4B-Instruct-2507, Gemma 4 E4B) = the A1 trials already planned. Gemini's version numbers for llama.cpp
  ("v0.6.0") and some speeds are not reliable — trust only our own `tests/trials/max.mjs` results.

## Cuts (section 5)
- "Merge Reminders / Follow-ups / Radar / To-dos" — Follow-ups is already one list (v8.3); a full merge is a design choice → options.
- "Hide File Converter / Slides on phones", "Career mission" — design choices → options for Ali, never decided alone.
- "Silent visa polling" — already replaced by the browser check (v9.4 G2).

## Mock-ups + how each pick is built
Published for Ali: https://claude.ai/artifact/GaNgb3thF9dSYox2Pt1HkA

## Recommended picks for the launch (Claude's view)
**R8, R1, R3, R15, R13, R9, R30, R27, R35** (+ R6's 1-line fix, which Claude does anyway). The rest after launch.
