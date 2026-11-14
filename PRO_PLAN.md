# Pro, the guide, background thinking, the brain, agents — the build plan (Ali, 14 Nov 2026)

Ali's answers on https://claude.ai/artifact/XF3TxLzpUYDzBmNPecpdTL (docs/mockups/free-pro-combined.html):
**OK-1 — "Don't remove undo as the app could still get something wrong"** · OK-2 · OK-3 · OK-4 · **BG-3** · **BR-4**.
Earlier picks (docs/mockups/free-pro.html): FP-4 · PM-1 · PM-2 · PM-4 · GD-5 · GW-A · TR-3.
His extra words (same message):
- "giving the extra 7 days free trial is by actually completing the setting up of your app, and make it very helpful and deep — not just very
  easy steps without actually doing anything and they get the extra days" → a step counts only when its data really exists and works
  (e.g. "bank messages" = at least one real bank message read and saved; "papers" = at least 2 papers with dates; "people" = a real
  person with an amount). Checked by code from the stores, never by a tap on "done".
- "I want app languages in the settings to be a drop down list" → DONE (v9.9.33, LangSwitch is a <select>).
- "In the agents I don't want Search now only — I want it to check while I am away and give me new info, and use much more websites, not
  just Amazon" → batch A below.
- "After I finish, make a 1m test for everything in the app and every aspect in it: coding, user experience, UI and UX, all languages, chat
  smartness, etc. — very very rigorous, hard and challenging" → batch F, LAST.

Rules for every batch: all 20 languages in the same change · light + dark · phone + computer · its own 10,000-case generator + held-out
set + unit test on 2,500 · full suite before main · push after each batch · tick here + NEXT_CHAT.md.

## Batches (tick when on main)
- [x] 0. Quick fixes (v9.9.33): Chat bubble keeps the exact words · old wrong agent finds dropped on load (EGP 120 FreeClip) · language dropdown.
- [x] A. (v9.9.33, branch) Agents work while you're away: checks during the day too (not only "Search now" / night charging), "what's new" messages in the
      agent's conversation + a notification only when something really changed (new best, back in stock, price drop), many more stores per
      country (search pages + the phone's real browser for sites that need one), offers from every store merged and believable.
- [x] B. (v9.9.34, branch) Pro (FP-4 table + OK-1 with Undo kept + PM-1 + PM-2 + PM-4): billing.js plan rules, the Plan page's two columns, limits, the
      "Pro would have done this" line (≤ 1 a day, never on urgent days), Friday card, trial-end screen.
- [ ] C. Guide (GD-5 + GW-A + TR-3, deep): Chat interview, Home "Set up your life · n of 8", one-time tips, Settings → Set up your life,
      monthly check-up; steps verified from real data; 6 of 8 really done → +7 trial days once.
- [ ] D. BG-3: the model reads unsure notifications with Attune closed (battery > 40 % and screen off, or charging), quiet notification
      while reading, answers merged on open (Kotlin like AiNight.kt).
- [ ] E. BR-4: the brain — facts with sources (What Attune knows, correct / forget), Chat answers from it at once, morning "Attune noticed"
      + Sunday analysis; Free keeps the morning card.
- [ ] F. The 1,000,000-case test of everything (after A–E).
