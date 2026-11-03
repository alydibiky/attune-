# Attune — launch on Google Play within one month (plan of 2 Nov 2026, target: live by 2 December 2026)

Ali, 2 Nov: "try to make the app perfect and really smart because I want to deploy it in 1 month max".

## The one date that decides everything
A new **personal** Play developer account can publish to everyone only after a **closed test with ≥ 12 testers opted in for
14 days in a row**, then Google reviews (usually 1–7 days). So:

| By | What | Who |
|---|---|---|
| **Fri 7 Nov** | Play Console app created · upload key + 4 GitHub secrets · first bundle on the **closed-testing** track · 12+ testers invited (aim for 20 — some drop out, and the 14 days restart if it falls under 12) | **Ali** (steps: RELEASE_6.29.md §2, REVIEW_P7_play_launch.md) |
| **Fri 21 Nov** | 14 days done → apply for production | Ali |
| **Fri 28 Nov** | Release candidate frozen: only fixes after this | Claude |
| **~2 Dec** | Live | Google's review |

An **organisation** account (company + D-U-N-S number) skips the 14-day test, but getting a D-U-N-S number takes 1–4 weeks.

## Week 1 (3–9 Nov): understand every sentence, no wrong words
- [x] The referee (option B): code answers only when sure; the phone's model decides mixed sentences; learned; 20 languages.
- [x] Language audit of all 20 dictionaries as a test; two-meaning words split (Left, Free, Word, Model, Background, Update, Read).
- [x] **Sentence bank → 500 real sentences** (511 on 3 Nov; started at 65: `tests/unit/v908bank.test.mjs` — found and fixed 6 real misses) (English, Egyptian Arabic, Franco, + the 18 others): every kind (reminder, money,
      agent, research, food, people, deadline, translate…) — each must land where it belongs; run on every test run.
- [ ] Read every Arabic screen (Chat, Settings, Business, Fit & Food, Learn, Studio, Library… — Home, Money, People & plans,
      Follow-ups, Health, Reminders, Agents done) and fix wording; finish the two-meaning list (307 words).
- [x] The app's name in Egyptian Arabic: "Attune" everywhere (Ali picked).
- [ ] Crash and freeze safety: an on-phone crash log + "Send a report" (nothing sent by itself); every page opens < 1 s on a
      mid-range phone (the Agents page was slow — find any other).

## Week 2 (10–16 Nov): the closed test is running — fix what testers find
- [ ] Testers' reports → fixed within a day; each fix gets a test so it can't come back.
- [ ] Ask testers who speak French, Spanish, Hindi, Urdu, Indonesian, Turkish… to read their language for 10 minutes — the
      only real check of meaning for the 18 other languages.
- [ ] The 9 persona reviews (REVIEW_P1–P9) re-run on the release build; anything "broken" or "confusing" fixed.
- [ ] Agents: hotels + products checked on the real sites from Egypt; Scout on Dubizzle / Hatla2ee.

## Week 3 (17–23 Nov): store and speed
- [ ] Store listing (STORE_LISTING.md): Arabic first, 6 screenshots of the hero flows, a 30-second video.
- [ ] Data safety, Health Connect, foreground-service and financial-features declarations (REVIEW_P7 list).
- [ ] Size (115 MB) and first-run speed: optional packs download on first use.
- [ ] Battery: background checks (agents, wake word, scout night) measured over 24 h.

## Week 4 (24–30 Nov): freeze
- [ ] 28 Nov: release candidate — no new features, only fixes; full test suite + a real-phone pass of every page.
- [ ] Apply for production with the frozen bundle.

## Ali's answers (2 Nov)
- Play account / closed test: **later** — "I mean the app has to be ready, with no mistakes, so when I deploy it it has no
  problems". So the month is spent on quality; the closed test (14 days) starts when he is ready.
- First release scope: **leave the 3 out** — already so in the `play` flavor (no overlay permission, no keyboard; the page hides
  Video Downloader when `attune_play` is true). The APK Ali installs stays "full".
- The app's name in Egyptian Arabic: **"Attune"** everywhere (52 places changed); only the spoken wake word stays «يا أتيون».

## Decisions only Ali can make (asked 2 Nov)
1. Is the Play developer account made, personal or organisation? Has the closed test started?
2. First release scope: leave out the riskier parts for Play's first review (Video Downloader, the floating orb over other
   apps, the keyboard) and add them in an update — or ship everything?
3. The app's name in Egyptian Arabic: "Attune" or «أتيون».
4. Support e-mail for the store listing and AI-answer reports.
