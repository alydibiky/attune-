# Attune repair plan (Ali, 28 Nov 2026: "I want a complete plan in everything in the app to make it better overall")
Page with the evidence, the scoreboard and Ali's decisions D1–D6: https://claude.ai/artifact/BkAo2My6XLuggJonNLnfeN

## Ali's decisions (28 Nov): D1A D2A D3A D4A D5A D6A
- D1A: the Play closed test starts when P6 is green; launch ~mid-January.
- D2A: first release = 9 core pages (Home, Chat, Money, Follow-ups, To-dos & lists, Dates & papers, People & plans, Mind, Passwords); the rest under "More (early)".
- D3A: nothing found → say it plainly + two buttons (Add a payment / Search Mind).
- D4A: Settings › Make a test pack (anonymised on the phone, shared once).
- D5A: keep Glass; drop card shadows on phones only if the health line shows stutters.
- D6A: one subscriptions list, each line says where it came from.
Visible ones (D2 D3 D4 D6) wait for the combined "what I understood" OK (MOCKUPS.md rule).

## The five root causes (measured 28 Nov by 4 code audits + a page-by-page walk-through)
1. The same question is answered in many places: advert 7 files, amount 8, merchant 7, dates 10, ~35 deciders per Chat sentence, Chat ≠ Home chain.
2. Tests don't test what the phone does: single functions, my own data, prewarm off under webdriver, the persona test's "EG" country ignored.
3. Parts don't share facts: a debt paid back isn't lowered, Guardian doesn't see People & plans subscriptions, repeats shown wrong.
4. Phone-only problems are invisible to desktop tests (kills, ANRs, scroll, Android rules — place reminders and the hidden agent browser never worked).
5. Wide app, one 13,400-line App component: any write re-mounts every kept page (660–1,670 ms opens).

## Phases (no new features until the scoreboard is green; fix the shared module, never the screen)
- [ ] P0 freeze + real data: Ali's test pack (D4), a sentence bank from his chats + every handoff mistake, tests through the real path with prewarm on at phone speed.
- [~] P1 one money core — PART 1 DONE (28 Nov, v10.9.12): adverts.js (one advert / "money moved" decision, 7 private lists merged; every
  reader imports it) · dedupe.js (samePayment / samePayee across scripts, family names, branches, accounts, currencies; txnCurrency) used by
  paylog inbox + alreadyIn, autopilot.inLedger, guardian "charged twice", overpay · paytext fixes the generators found (a time glued to the
  amount 1:23+120 = 23,120; a %, a promo code, a year as the amount; "order total" as an order number; payees after «إلى حساب» / «شراء من» /
  «لصالح» / «حسابك من»; "Transaction approved" / "renewed for" = out) · Autopilot cards carry currency; overpay uses Money's amount reader;
  notifmeaning "money in" restored; categories: food delivery first, Autopilot asks paylog.categorise; Guardian per currency; services: 5
  audit bugs fixed in place (Shahid ≠ «شاهد», Claude the app only, Gemini known, Steam not a subscription; Google One kept = Gemini, Ali's 9 Nov case).
  Tests: tests/adverts/gen.mjs, tests/dedupe/gen.mjs (10,000 HARD each, 100 %), tests/unit/v10912money.test.mjs.
  OPEN in P1: one services.js list (3 lists still, names differ — renaming touches saved subscriptions); a wallet top-up from your own bank is
  a transfer between your accounts (needs a transfer entry — P3); lifeask's money sums per currency (merged into myledger in P2);
  accounts.js (a bank SMS / card last4 → its Money account).
- [ ] P1 (rest): services.js (one list), accounts.js, moneyread.js (one record per message for the remaining readers: notifmind amountIn, gmail isPaymentEmail, firstmin SMS part), the old copies deleted.
- [ ] P2 one router for Chat / Home / voice (priority table), one "my data" parser, "nothing about X" answers (D3), one vocabulary per language, model picks kept only after confirmation; balance / next salary / cancel a reminder / "with Omar".
- [ ] P3 one fact one place: debts / subscriptions / repeats read by every page (D6); "paid me back" lowers the debt; "half"; "on Tuesday" = once.
- [ ] P4 phone reliability: Engine lease (one owner, background AI only charging + idle, one job at a time); PayListener off the main thread; RecallLog pruned; FGS rules (START_NOT_STICKY, onTimeout); onRenderProcessGone everywhere; a daily on-phone health line.
- [ ] P5 speed: per-page stale keys (no re-mount on unrelated writes), Mind index / mineTerms / brainFacts out of the first render and split, long lists windowed, attune.jsx split, Arabic file only in Arabic, look tuned (D5).
- [ ] P6 finish every page in the launch scope (D2) with one checklist at 390 / foldable / 1366, EN + Egyptian.
- [ ] P7 Ali's week of normal use with 0 wrong money entries / answers; the Play closed test (D1).

## Already fixed 28 Nov (v10.9.10)
Pop-up on every open · Guardian adverts + two Claude accounts · agents / Scout ANRs → BgRunJob · model released after 4 min in background · Glass ground layer · BgRunJob id clash with AiNightJob (0x5c0b1) · place reminders (mutable intent) · HeadlessRead (main Handler + resumeTimers) · country "EG" = "eg".

## Audit details (kept for P1–P5)
Money (10 bugs with real inputs), Chat (120 sentences, ~25 wrong), Android (13 issues ranked), speed (measured table) — summarised on the page above.
