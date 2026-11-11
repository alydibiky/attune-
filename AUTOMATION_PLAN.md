# Automation build plan — Ali's 29 picks (11 Nov 2026)

> Ali: "I WANT ALL FEATURES TO BE WORKING IN ALL LANGUAGES AND ALL COUNTRIES OFFERED IN MY APP, finish batch by batch while updating
> handoff so if the limits come another AI can continue after you." — and: "it has to be done right and tested in at least 10000
> scenarios each because I want no mistakes".

**Any session: read this file, find the first batch not ticked, and carry on. Tick each step here when it is done and pushed.**

## The rules for every feature (no exceptions)
1. **Look first.** Screens page with Ali's picks: https://claude.ai/artifact/NSsHTv8B6NSzN9eCS1Got8. Where he picked A+B ("combine"),
   the combined screen + "what I understood" must get his OK before its SCREEN is built:
   combined page → see "Combined screens" below. Logic (readers, engines, tests) that changes nothing on screen can be built before.
2. **All 20 languages** (ar = Egyptian, arb = Fusha, es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko): every screen line through
   `tr()` in all 20 dictionaries (`python3 tools/i18n/add_lines.py lines.json`), AND every reader understands free text in all 20
   (word tables like `understand.js` FOLLOW / EVERY; Franco too). Not understood → Attune ASKS (never guesses).
3. **All 30 countries** (countrypack.js + country.js): currency, date order, weekend, holidays, banks/wallets, official portals.
4. **10,000 cases per feature**: `tests/<feature>/gen.mjs` makes exactly 10,000 different cases across the 20 languages and 30
   countries, each with what Attune must do AND the details (amount, date, person, place); `run.sh` writes `report.md`;
   a held-out set written AFTER the fixes; `tests/unit/<feature>.test.mjs` keeps a 2,500 sample above the mark (≥ 99%).
5. Nothing with money or messages is done alone the first time; every automatic action is in "Done for you" with Undo (AU8).
6. Full suite before pushing to main; APK run link to Ali; this file + NEXT_CHAT.md updated after each batch.

## Ali's picks and his notes (what each one must be)
| Code | Screen | Ali's note → what I understood |
|---|---|---|
| AU1 | A | "the most functions possible … understands every free text, and if it does not understand it asks me" → every trigger and action Attune can do; the When/If/Do card after any sentence; anything unread → a question with choices |
| AU2 | A | suggestion card on Home |
| AU3 | A | gallery of life moments |
| AU4 | A | jobs page + result on Home in the morning |
| AU5 | A+B | combine: each reminder has a level (once / 10 min / hour / until done) AND a one-tap ★ Important that sets "every 15 min until done" |
| AU6 | A | say it (or share) → follow-up card with a drafted nudge |
| AU7 | A+B | combine: Paid · Tomorrow · In 1 h; after Paid the notification STAYS and asks Cash / CIB / Vodafone Cash (his real balances) |
| AU8 | A | the page with limits + Undo; every action EDITABLE, and Attune remembers the change for next time when it applies |
| M1 | A | checklist with amounts |
| M3 | A | group with settle-up |
| M5 | B | ask once when he changes a category (+ the rules list in Settings) |
| T1 | A | NOT voice only: a typed / pasted brainstorm paragraph is organised the same way |
| T2 | A | Home card with week dots |
| T3 | A | chips — and tapping one OPENS its countdown (B's big card) |
| T4 | A | a place inside the reminder |
| T5 | A | calendar with blocks |
| T6 | A | full-screen timer — only if Play allows (check the policy: DND access / full-screen intent) |
| N1 | A | sections — and every item opens the ORIGINAL (the message, the payment, the note) |
| N2 | A | summary with ▶ on each line, in ALL languages; ships only if ≥ 99% offline |
| N3 | A | small card on Home |
| P1 | A | list with how long since |
| P2 | B | three lines in the notification |
| P3 | A+B | combine: Occasions page + the 9:00 card with a drafted wish on the day |
| TR1 | B | ask first, then add |
| TR2 | A+B | combine: the notifications AND the flight-day card that ticks along |
| TR3 | A | money + papers tabs |
| X1 | A+B | combine: read-and-ask after the photo (every field EDITABLE when read wrong) + the list by expiry |
| X2 | A | Upkeep page — plus a plain "Done" (without a cost) |
| X3 | A | photo → filled card; every field editable |
| X4 | A+B | combine: a card per person inside one family page with tabs; share / lock screen |
| X6 | A+B | combine: the child's page + "found in the class group" to tick; everything editable |
| X5 | — | LATER (after launch) |

## Combined screens (step 3 of MOCKUPS.md) — waiting for Ali's OK
- Page: **https://claude.ai/artifact/HeHrRSrz3BNcDa9vwZhGNU** — AU1 AU5 AU7 AU8 T1 T3 T6 N1 P3 TR2 X1 X2 X3 X4 X6 (16 screens). Waiting for his OK.
- Sources of all three pages: docs/mockups/ (automation-picks.html = the 38 ideas, automation-mockups.html = A/B screens, automation-combined.html = step 3). Edit there and republish with the Artifact tool (same file, keeps the link only from the session that published it — otherwise publish a new one and log the link).

## Batches (tick when done and pushed)
- [x] **B0** this plan + combined screens page published + logged in MOCKUPS.md / NEXT_CHAT.md
- [ ] **B1 safety first: AU5 nag levels · AU7 notification buttons · AU8 done-for-you log** (logic + 10,000 cases each; screens after OK)
  - [x] logic: web-src/nag.js (AU5 levels + quiet hours), web-src/notifpay.js (AU7 Paid → balance → exactly once), web-src/donelog.js
        (AU8 limits, Undo, Edit, remember only for the same kind + source)
  - [x] 10,000 cases each, each with an independent oracle and a planted-bug check: `bash tests/nag/run.sh` (5 time zones × 2,000),
        `node tests/notifpay/gen.mjs` (30 countries' currencies), `node tests/donelog/gen.mjs` (20 languages' names) — all 100%;
        tests/unit/v9918b1.test.mjs (2,500 samples + held-out)
  - [x] the phone: NagPay.kt (nag rings, Done / Paid / balance / Undo / Tomorrow / In 1 hour, taps kept for the page), Reminders.kt
        hooks, manifest receiver, NativeBridge.takeTaps — **compiled only by CI (no kotlinc here): check the branch build**
  - [x] country fix: "weekdays" reminders follow the country's weekend (country.js weekendOf; actions.js, timeline.js, Reminders.kt
        `off`) — was Egypt's Fri + Sat everywhere
  - [ ] after Ali's OK on https://claude.ai/artifact/HeHrRSrz3BNcDa9vwZhGNU: the screens — the "Keep reminding" chips + ★ in the
        reminder sheet (sets r.nag / r.important / r.quiet), payment reminders pass r.pay (notifpay.payButtons with tr() labels in 20
        languages) and r.labels, the page applies NATIVE.takeTaps() on open (notifpay.applyTaps → paylog appendToLedger, Undo),
        the "Done for you" page (donelog.js) + Edit sheet + "Do it this way next time?"; all words in 20 languages; e2e test.
- [ ] **B2 the engine: AU1 rules (all triggers/actions, 20 languages, asks when unsure) · AU2 suggestions · AU3 recipes**
  - [~] web-src/rules.js `parseRule(text, ctx)` → { when, if, do, ask } — one word table per idea in all 20 languages (W), days from
        Intl for every language, digits of every script, the person's own names (ctx.people / places / devices / pots / lists / apps);
        unsure → `ask` with choices. Works on first sentences in en / ar / fr / es / zh / ja (scratch check).
  - [ ] NEXT: tests/rules/gen.mjs — exactly 10,000 sentences: 21 language codes × triggers × checks × actions, each with the
        expected { when.type, who/place/device, ifs, do types, pct/amount, pot } + sentences that are NOT rules (must be null) +
        sentences missing a name (must ask); independent phrasings in a held-out file written after the fixes; unit test
        tests/unit/v9918rules.test.mjs (2,500 sample ≥ 99%). Then wire: Chat / Home "When … do …" card (screen A, after OK),
        the rule store + runner (time → Reminders, money_in → AutoRules.kt words, message/call → watch.js, arrive/leave → a
        geofence (needs location — Play: background location declaration!), bluetooth/wifi/charging → Kotlin receivers).
- [ ] **B3 money: M1 salary sorter · M5 categories that learn · M3 split groups** (30 countries' currencies)
- [ ] **B4 to-dos: T1 brain dump (typed + voice) · T3 countdowns · T2 habits · T6 focus (Play check) · T4 places · T5 week plan**
- [ ] **B5 people: P1 keep in touch · P3 occasions · P2 before you meet · N1 person page · N3 on this day**
- [ ] **B6 papers & things: X1 paperwork · X4 emergency card · X2 upkeep · X3 what I own · X6 kids & school**
- [ ] **B7 travel: TR1 trip from bookings · TR2 flight day · TR3 trip money & papers**
- [ ] **B8 AU4 scheduled AI jobs** (needs the night job)
- [ ] **B9 N2 voice memo** (last; ship only at ≥ 99% offline in all languages — else tell Ali)

## Log
- 11 Nov 2026 (night): B1 logic + 10,000-case tests + Kotlin done (see B1); screens wait for the OK.
- 11 Nov 2026: plan written; Ali's picks recorded.
