# Attune repair plan (Ali, 28 Nov 2026: "I want a complete plan in everything in the app to make it better overall")
Page with the evidence, the scoreboard and Ali's decisions D1–D6: https://claude.ai/artifact/BkAo2My6XLuggJonNLnfeN

## The five root causes (measured 28 Nov by 4 code audits + a page-by-page walk-through)
1. The same question is answered in many places: advert 7 files, amount 8, merchant 7, dates 10, ~35 deciders per Chat sentence, Chat ≠ Home chain.
2. Tests don't test what the phone does: single functions, my own data, prewarm off under webdriver, the persona test's "EG" country ignored.
3. Parts don't share facts: a debt paid back isn't lowered, Guardian doesn't see People & plans subscriptions, repeats shown wrong.
4. Phone-only problems are invisible to desktop tests (kills, ANRs, scroll, Android rules — place reminders and the hidden agent browser never worked).
5. Wide app, one 13,400-line App component: any write re-mounts every kept page (660–1,670 ms opens).

## Phases (no new features until the scoreboard is green; fix the shared module, never the screen)
- [ ] P0 freeze + real data: Ali's test pack (D4), a sentence bank from his chats + every handoff mistake, tests through the real path with prewarm on at phone speed.
- [ ] P1 one money core: adverts.js, moneyread.js, dedupe.js (pairs), services.js, categories.js, accounts.js; currency on every ledger row; ~25–30 files switch; old copies deleted.
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
