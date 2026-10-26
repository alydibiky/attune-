# Attune — start here (handoff for the next chat, 26 Oct 2026 — v8.2)

Read this page first, then `CLAUDE.md` (Ali's standing rules), `GEMINI_DESIGN_BRIEF.md` and `CHAT_RUNS_APP.md`.
Then carry on with **"Do this next"** below — no need to ask Ali anything before starting.

## Status in one look
| | |
|---|---|
| `main` | **v8.0** (versionCode 122) — branch `claude/compassionate-einstein-kdqslx` = main |
| Last APK | see "Build the APK" on main for the v7.9 commit (the link was sent to Ali) |
| Tests | full `bash tests/run_all.sh` passed for v7.9 (e2e_v59 passed alone; e2e_v740artdata made robust) |
| Gemini step | Areas 1–6 built · **Area 7 (Settings, sidebar, How to use, Privacy)**: Ali picked "I design it myself in Gemini's style" for the rest of the UI — How to use is done (v7.9); Settings / sidebar / Privacy still to design (show Ali 2–3 options first) |

## v8.2 — 26 Oct: Ali's 17-point phone list (branch `claude/youthful-davinci-fe3400`)
Done and tested (unit `tests/unit/v820fixes.test.mjs`, e2e additions in `e2e_fithome.py` + `e2e_v727agent.py`, hub test updated):
Tools is its own place in the sidebar (`hubs.js` toolbox); Instant + Ask (classic) retired (`RETIRED` → Chat; shared photo → a new chat
with it attached, `\u0005` seed in chat.jsx; quick tile → Chat); Convert only in Tools; Ask a PDF card in Tools; hotel agent window +
stars + near (agents.js); installments sentence (life.js); cheese samosa / breadsticks + tap a food to see how it was read (fit-ui
ReadDetail); watch numbers per source + estimate from steps + WatchTop strip (Health.kt, fit.js); Speed switches dev-only; Scout reads
the ad page for its price; voice fallbacks (Voice.kt, Subtitles.kt, NativeBridge.listen waits for the wake word to free the mic);
"Slow screen …" lines in the log (attune.jsx PerformanceObserver); Your details (agent-ui.jsx: trips / daily life / booking forms,
`bookingLine` → every prompt via profileLine, agents use the trip prefs).
**Waiting for Ali (show him `design/v82/*.png`):** 1 Follow-ups one page A/B/C (rec. A) · 2 smarter agents A/B/C (rec. A) ·
3 book library A/B/C (rec. A). Build the pick. Also ask: does his Assistants page list "Crane expert"? (sidebar 5 = page 5 in tests).
Phone checks needed: voice (log now says "Voice … error N"), watch numbers after Refresh, Scout prices, and send the log after a
laggy moment ("Slow screen …" lines say where).

## ⚠️ OPEN NOW — Ali's 26 Oct list, part 1 (v8.1 on his phone) — NOT FIXED YET
Ali's deal (26 Oct): **after every big change, update this file and push**, so if the session limit ends another AI carries on.
Ali said "read this first, then I'll upload more" — part 2 may follow below. Tick each item here when done.
- [~] 1. (v8.2: 'Slow screen <page>: froze N ms' lines now go to the log; in the browser at 4× slower CPU only start-up (1.2 s) and Money (0.25 s) freeze — need Ali's log after a laggy moment) **"The app glitches and makes the phone glitch a lot."** Clues in his log: one kill at **3680 MB rss** (24 Oct 17:36,
      LowMem) and 2409 MB (25 Oct), "excessive binder traffic during cached" (25 Oct 14:57 — something keeps calling the
      system while Attune is in the background: suspects = AgentWatch, WakeWord service, MessageWatch, appsList),
      LowMemQuick kill while a fg-service ran (26 Oct 15:40), React error #300 in Studio (hooks after an early return).
      Find what holds memory / spins in the background; measure, then fix.
- [x] 2. (DONE v8.2: runScoutGoal reads up to 8 new + 4 kept unpriced ads' own pages (readPage = fetchText); no price → «No price shown — open the ad» and −15 score) **Scout: most ads show no price** (screenshots: only 3arabyat has 1,250,000; contactcars / yallamotor / dubizzle rows
      have none) → "how will I know if it found something useful". Read the price from the ad page / snippet (contactcars,
      dubizzle, yallamotor, opensooq), show it on every row, say "price not shown — open the ad" when truly absent, and rank
      priced ads first. List pages ("12 Used Hyundai Tucson…") are not ads — show them apart or drop them.
- [x] 3. (DONE v8.2: speed-ui.jsx — NPU/GPU/MTP switches + their warnings only in developer mode) **Engine → Speed (speed-ui.jsx)**: "NPU could not be used", "GPU closed the app last time", GPU switch, Multi-token
      prediction switch. Ali: **make them work, or remove them so users never see them (and not in the notes either)**.
      Default plan: hide NPU line + MTP switch for normal users (developer mode only); keep GPU only if it works on his
      HONOR (SM8850 / Adreno 840), otherwise hide too.
- [x] 4. (part 1 DONE v8.2: window of dates → 6 start days, `starsIn` → Booking `nflt=class=4;class=5`, near → `distance=1000`, Check now runs every start day (AgentBrowser autoClose), card shows the cheapest days; `agents.js` bookingUrl/windowStarts/takeChecks. STILL OPEN: options for 'smarter agents') **Agents too basic / "too stupid"**. His sentence: hotel near Masjid al-Haram, under 45k, **4 nights between 10 Dec and
      29 Jan**, **4 or 5 stars**. Bugs found in `agents.js` ~line 148: two dates become checkin/checkout (40 nights, wrong);
      stars are not read; the Booking search is sorted cheapest instead of filtered by stars. Fix: "N nights from A to B" =
      a WINDOW → search every 4-night start in the window (or flexible dates) and report the cheapest that fits; read
      stars (4 or 5 / ٤ أو ٥ نجوم) → Booking `nflt=class=4;class=5`; distance to the Haram. Also he wants agents "complex
      and actually useful" — **subjective: show Ali 2–4 options** for what a smarter agent does (plan, multi-step, report).
- [~] 5. (checked: sidebar count and page both show 5 incl. Crane expert when Fleet is used — asked Ali) **Assistants shows 5 next to it but there are only 4** — find the count (hubs / sidebar) and count what is shown.
- [x] 6. (DONE v8.2: life.js PER_AMOUNT + lowercase names) **People & plans (screenshot 5)**: "sheikh owes me 22,000 to be paid in installments monthly for 9 months" only saved
      "owes you 22,000" — the installment plan (9 × 2,444.44 monthly, due dates) was lost. Fix the sentence reader
      (EN + Egyptian Arabic + Franco: "على 9 شهور", "قسط شهري").


### Ali's 26 Oct list, part 2 (more may follow)
- [x] 7. (DONE v8.2: hubs.js `toolbox` place + RETIRED=[instant, ask] → navTo sends them to Chat; shared photo → Chat with it attached (seed \u0005); quick tile opens Chat) **Tools becomes its own page in the left sidebar.** Remove **Instant** everywhere (tools list, Home, "/", hubs): normal
      Chat should do that job. Also remove **"Ask (classic)"** (`hubs.js:85`, `attune.jsx:7753`, the earlier Ask screen).
- [x] 8. (DONE: Ask a PDF card in Tools too; it also stays in Students) **"Ask a PDF" (PDF chat): where is it, how do I find it?** It is the Students hub (`hubs.js:13`: coach = Homework,
      convert, pdfchat, slides, cv). Make it findable (sidebar search / Tools page / Chat "ask this PDF"). Explain to Ali.
- [x] 9. (DONE v8.2: convert only in Tools; Ask a PDF card added to Tools) **Convert is duplicated** (Students → Convert AND Tools → Files & Converter). Keep it in one place only (recommend: Tools,
      and Students links there; or ask Ali).
- [~] 10. (options A/B/C in design/v82/followups.png — waiting for Ali) **One page for Follow-ups + Guardian + Reminders + Timeline + Dates**, organized and centralized. Layout is subjective:
      **show Ali 2–3 options first**, then build.
- [~] 11. (v8.2: fallbacks + log lines; needs Ali's phone) **Voice does not work at all**: not the transcriber, not the voice chat/call, not anything voice. Test every voice path on
      Android (mic permission, Whisper / STT model download, WakeWord service, TTS) and fix the root cause.
- [x] 12. (DONE v8.2: fit-foods breadsticks + cheese/meat sambousek, matchFood last-word rule + FILLER, fitread whole-name rule, fit-ui ReadDetail on tap) **Food from text**: he typed "4 plain bread sticks and 6 cheese samosas" → got "White cheese 180 g" + "bread stick 150 g".
      "Cheese samosa" became "white cheese" (wrong match; count 6 lost). Fix the matcher (compound dishes like samosa / sambousek,
      counts × piece weight). Also: **tapping an item opens it** and shows everything it read (the words it matched, the food
      from the pack, grams per piece, how the kcal was worked out).


### Ali's 26 Oct list, part 3 (his last: "that's all")
- [x] 14. (DONE v8.2, needs Ali's phone check: Health.kt reads each source alone and keeps the biggest number + lastAt; fit.js watchBurn/watchKm estimate from steps when the app sends ~0 kcal / km; WatchTop strip under the summary) **Watch numbers stale / wrong place**: Fit & Food showed 6,017 steps · 8 active kcal · 0.2 km after Refresh while the
      watch said 6,442 steps · 406 kcal ("Heat") · 5.74 km · HR 54/80/117. Burned calories must be at the TOP of Diary, and
      Refresh must pull fresh numbers (Health Connect read of today: steps, distance, active + total calories from Huawei
      via Health Sync — check which record types / time range we read; 0.2 km vs 5.74 km = wrong source or wrong range).
- [~] 15. (options A/B/C in design/v82/books.png — waiting for Ali; build on multidoc.js + docqa.js + recall) **Book library you can talk to**: upload e.g. 10 trusted history PDFs, ask anything; it reads them fast, compares what
      the books say, cites the book + page, says where they disagree, and you can keep chatting with follow-ups like a
      normal AI. Build on "Remember" (v6.46) + Recall (bge-m3 meaning search) — multi-book index, compare step, chat thread.
- [~] 16. **Whole app smarter and smoother** (ongoing; tie to item 1 performance work).
- [x] 17. (DONE v8.2) **Your details** (Ali, mid-list): Booking details expanded — trips / daily life / booking forms, private, used by answers + agents.

## Do this next
1. Ask Ali for his next list (he said he has more). Keep his rule: **ask before anything subjective** — show 2–4 options
   (`tools/render_mockup.py` renders a mock-up HTML with `data-screen` sections; see `scratchpad mock/round1.html` style:
   Quiet Atelier tokens, phones side by side, A/B/C with a recommendation).
2. Still to design (Ali's item 11 "fix the rest of the interface like Gemini would"): Settings, the sidebar, Privacy, and any
   screen not yet in Quiet Atelier — show options first, then build.

## v8.1 — 26 Oct: Money is Attune's own everywhere + «يا أتيون» (voice phase 3, option C)
- **Money (Ali: "it redirects me to the old app — I don't want that at all")**: no Money path shows Yusr's screens any more.
  `web-src/money-sheets-ui.jsx` = Attune's own sheets (account, bill, goal, debt + pay, Zakāt payment + settings, entry edit /
  delete, the full list with search, ledger settings incl. Tabs to show). Each change goes to Yusr (hidden, the engine) through
  the bridge's "do" message (`yusr-bridge.js` DO_OPS, `yusr/index.new.html` doOp) = Yusr's own forms and Save. Chat's
  "Add to Money" opens Attune's add sheet with the message as evidence. Tests: e2e_v800moneysheets (+ v790/v750/v713/v5/v4 updated).
- **«يا أتيون»** (VOICE_PLAN.md phase 3): WakeWord.kt (service, Voiceprint, QuietOrb), wake-ui.jsx (switch, teach your voice,
  QuietWake), assets/wake/*.onnx + config.json, tools/wake/ (how the model was trained, licences, numbers). Ali must test it on
  his phone and add the Play Console "foreground service: microphone" declaration before release.

## v8.0 — Ali's 25 Oct list (5 points)
1. **Yusr settings — answered (25 Oct): Ali meant "inside Yusr's own settings"** — they already are (Money → More → Ledger
   settings); his phone shows Yusr's old bottom bar = an older APK. Fixed on that screen: Tabs to show now drives Money's bar
   (`panesFor` in money-pages-ui.jsx, only after the person changes it — `db.ui.tabsSet`, since a new ledger starts with
   Accounts/Goals off), Notes/Invoices out of the list, 11 labels that had no words ("billsTab" on the Bills screen…).
   Earlier note: **"Put this in the settings in Yusr app"** (screenshots of Yusr's Customize / Tabs to show — old gold "Midnight" look with Yusr's
   own bottom bar, so probably the standalone Yusr app or an older APK): **asked Ali what he means** (see the chat). Fixed meanwhile:
   the "Show" checkboxes looked empty when on (`.field input` gave them `appearance:none` + full width) — `yusr/index.new.html`.
2. **Huawei watch "just opened the app"**: the Automatic tracking Huawei tile now says "Not connected yet" and shows the Health
   Sync steps (`HuaweiGuide`), or "Connect Huawei Health" when the direct Health Kit link is configured; ✓ only when Huawei data
   has really arrived (sources `com.huawei.health` / `nl.appyhapps.healthsync`). The direct link still needs Ali's AppGallery
   Connect App ID in `gradle.properties` (`attune.hmsAppId`) — see `HuaweiHealth.kt`.
3. **Studio paused on phones** (`device.js` `STUDIO_PHONE_PAUSED`, `studioPaused(native)`): out of every list / hub / group / "/"
   even with "Show every tool", its page says paused (`studio-paused`), `nativeCall("imagine")` is refused, Chat's "Draw it in
   Studio" card and lesson pictures are off. Photo editor (Eraser / Expand) unchanged. `attune:studio:try = 1` runs it anyway
   (the harness sets it so the old Studio tests still run). Flip the constant to bring Studio back.
4. **Slides quality** (his deck: AIDA titles, content not matching titles, title repeated as a bullet, 4 same-type slides):
   plan prompt asks for concrete titles from the topic (no bare framework stages), a comparison slide for "X and Y" topics;
   slide prompt: every point answers its title, general knowledge where sources are silent (numbers still only from sources);
   `tidySlide` drops title-only points / title leads and reworded repeats (0.6 overlap); a 4-slide deck gets one other kind;
   a plan far short of the count is asked once more. Unit `v1000fixes`.
5. **Agents page — BUILT (Ali picked A + "it must open any app I ask: Uber, Booking, Amazon, Talabat…")**: `agents.js` (sentence →
   open / do / watch / track / order / scout / alert, asks what is missing; app catalogue EN+AR + every launcher app via
   `appsList`), `agents-ui.jsx` (box, chips, cards, Check now, report). Android: `openAnyApp`, `appsList` (manifest `<queries>`
   LAUNCHER intent), `AgentWatch.kt` (+ receiver, BootReceiver) checks watched pages ~every 12 h with Attune closed,
   `agentWatchPlan/Take`; delivery = MessageWatch rule `app: "pkgs:…"` (WatchMatch); AgentBrowser `watch` extra returns the
   cheapest price. Sidebar places now Money · Business · Health · Shelf · Agents. Home box creates agents too. Country = Attune's
   saved country (country.js) → EGP / Talabat / Uber-Careem-inDrive. Tests `v1000agents`, `e2e_v1000agents.py`.
   Next ideas (ask Ali): Booking may block the background read (then the card says "tap Check now"); level-3 full phone
   control (accessibility) is still not done on purpose.
   Honest limits told to Ali: Booking/Talabat/Amazon have no public consumer API → watch by reading the pages on the phone,
   Talabat = one tap opens your usual and you press Order (no paying by itself), Amazon = read its notifications / emails.
- Tests: `tests/e2e_v1000fixes.py`, `tests/unit/v1000fixes.test.mjs`.

## v7.9 — Ali's 24 Oct phone list + design round 1 (all done, tested)
- **Camera**: "Take a photo" opens the camera (MainActivity `cameraIntent` → ACTION_IMAGE_CAPTURE into cache/camera via the
  FileProvider; `<queries>` IMAGE_CAPTURE). The WebView ignores `capture=` by itself.
- **Studio report crash**: hooks below an early return (also PayInbox). `tests/unit/v900hooks.test.mjs` scans every page.
- **Guardian "twice"**: shows the two payments (`f.txns`); "Charged twice" only when both have times minutes apart and neither was
  typed (`f.sure`), else "Same payment twice?" + *Logged twice — remove one* (`removeTxn`). Payments now keep `created` + `source`
  (Yusr add-txns, paylog appendToLedger); `alreadyIn()` stops a notification already in Money being added by itself.
- **Maid**: People & plans asks on her day with a real checkbox (`askToday`, `skipDay` "Didn't come"); "Saturday 600" is money now.
- **Scout**: essay sites in NOT_AD, `aboutIt()` (an ad must be about the goal), `samePlace()` (Arabic = English places), Home's
  "found N new" opens on the new ads. Design A: goal numbers, one row per ad (tap = details), "Select to compare" → `compareAds()` table.
- **Food photo**: `composeDish()` ("Cake" + "Mango" → "Mango cake"); search ranks foods with every word first (`rankFoods`, the pack
  ranked with the rest). Design B + slices: `fit-summary-ui.jsx` PhotoSummary (dish, ring, ½·1·1½·2, macros), `fit-summary.js`.
- **Code page**: "Your programs" above a 2-column grid; Build & test full width on a phone.
- **Knowledge**: in no list for anyone (dev tools stay in developer mode). **Booking details** explains itself.
- **Invoices → Business**: `yusr-to-books.js` copies Yusr invoices into Books once (posted, customers, receipts; totals match);
  notes copied into Mind (tag money). Flags `attune:moved:invoices|notes`. Nothing deleted in Yusr.
- **Hidden features**: Automations in Money → More; Recall row in Mind; Missions already on Home → My report.
- **How to use** (A + C): `guide-areas.js` (AREAS, SAY "You say → You get" for all 53 pages, tried = pages opened `markTried`),
  life-area cards with ticks, Try it / How, "See all features (A–Z)". `tests/unit/v900guide.test.mjs` fails if a page has no entry.
- **Automations** (A + many): READY rules (one tap), several of your own (one per line, `parseMany`), unique rule ids.
- **Money** (A): the bar is Yusr's tabs Home · Trends · Accounts · Goals · Bills · Zakāt (Attune draws it; Yusr's inner nav, + and
  Invoices button hidden by CSS in `yusrDocumentHtml`); every tab but Home shows Yusr's screen with the bar under it; floating +.
  The v7.6 Accounts/Bills/Zakāt pages are no longer used. More = Automations · Invoices (→ Business) · Full ledger · Settings.
- Tests: `e2e_v900fixes.py`, `e2e_v910design.py`, units `v900*`; updated v731guide, v731scout, v736scoutnight, v790money,
  v620knowledge / v727teach / v732packdl (open Knowledge directly), v722maps (finds the fuel search), v740artdata (waits per tap).

## Ali's 24 Oct requests, done in this chat (v7.6) — keep them
- **Home is the chat** (he picked A): New chat (sidebar and the chat's +) goes to the clean Home; the Chat · Your life ·
  Translate tab row and pages are gone — three pills in Home's box (`box-mode-chat|life|translate`, cmdbox-ui `BoxModes`).
  Your life answers under the box by code (lifeask-ui `LifeAnswer`); Translate sends a Translate-mode chat (seed `\u0004`) and
  links "Talk with someone, a photo or a document" to the Translate page (kept only for the interpreter / photo / document —
  not in any list). `navTo("lifeask")` → Home with the pill on. The chat's phone header has ← Home. Chat opens empty after a
  New chat (chat.jsx `HANDLED_SIGNAL`). Tests that tap New chat now reopen Chat with `attune-open {mode:'chat'}`.
- **Money's bottom bar** (he picked A): Home · Accounts · (+) · Bills · Zakāt (`money-bar`, `money-pages-ui.jsx`); + = the add
  sheet (expense / income / transfer, the account the person picked; the ledger's add-txns now accepts `transfer`);
  Lend/borrow, new bill, new account open the ledger's own forms (bridge `go` screens `debt`, `add-bill`, `add-account`).
  **More** (top) = Goals, Trends, Notes, Invoices, Full ledger (`money-open-ledger`), Ledger settings — these still open in the
  old ledger design (possible next step: rebuild them in the new design). Zakāt is only shown as the ledger's engine sent it.
- **Reminders page** fixed (Plan my day header, full-width date, repeat pills, Coming up first on a phone).

## Version history (newest first)
- **`main` = v7.8** (versionCode 120) — **Gemini step 6 (Tools) is built**: an on-device tool log (`web-src/toollog.js`, titles
  and numbers only, last 300; unit `v810toollog`) written by Writing (improve/compress), the Converter, Instant, Studio and the
  Video downloader. The Tools hub (`tools-hub-ui.jsx` ToolsHub): jobs this week / made today, the five families as cards
  (`tools-page-improve|convert|instant|studio|video`) with "{n} this week", recent outputs, "See all → Tools Report";
  Writing: five compact target chips + More targets, before (struck through) / after, Writing Report; Converter: recent files
  & results + Converter Report; Instant and Studio reports (Studio in a browser: `StudioOffDevice`). e2e `e2e_v810tools.py`.
- **`main` = v7.7** (versionCode 119) — **Gemini step 5 (Mind & learning) is built**: Mind's calm top (on a computer three
  numbers: everything kept, promises due, auto spaces) and "Do now" (the promise due today / late, with Done → state done);
  "See all → Mind Report" on a phone, the Mind Report beside the wall on a computer (kept this week by kind, promises due or
  late, most-used tags, things you forgot you have); Learn daily: the streak pill, today's lesson card, "See all → Learning
  Report" (days studied this month, quiz accuracy over time, learned, weak points, courses); Homework Coach: "See all →
  Homework Report" (this week, first-try %, by topic); Remember: the library's numbers; Recall: matched words highlighted and the
  on-phone index. Numbers: `web-src/learning-report.js` (unit `v800learnreport`), UI `learning-report-ui.jsx`, e2e `e2e_v800mind.py`.
- **`main` = v7.6** (versionCode 118) — Ali's 24 Oct requests (all decided by him, options A/A):
  - **Home is the chat**: New chat (sidebar, the chat's +) goes to the clean Home; the Chat · Your life · Translate tab row is
    gone — three pills in Home's box (`box-mode-chat|life|translate`, cmdbox-ui `BoxModes`); Your life answers under the box
    by code (lifeask-ui `LifeAnswer`); Translate sends a Translate-mode chat (seed `\u0004`) and links "Talk with someone, a photo
    or a document" to the Translate page (still there for the interpreter/photos, not in any list); `navTo("lifeask")` → Home
    with the pill on; the chat's phone header has ← Home. Chat opens empty after a New chat (chat.jsx `HANDLED_SIGNAL`).
  - **Money's bottom bar**: Home · Accounts · (+) · Bills · Zakāt (`money-bar`, money-pages-ui.jsx); + = the add sheet
    (expense / income / transfer through the bridge with the account the person picked — the ledger now takes `transfer`
    in add-txns; Lend/borrow, new bill, new account open the ledger's own forms via new `go` screens `debt`, `add-bill`,
    `add-account`); More (top) = Goals, Trends, Notes, Invoices, Full ledger (`money-open-ledger`), Ledger settings.
    Accounts / Bills / Zakāt calm + report (money-pages.js, unit `v790moneypages`, e2e `e2e_v790money`). Zakāt is shown only
    as the ledger's engine sent it. Fixed "-162% of it kept" → "Spent X more than earned".
  - **Follow-ups → Reminders** fixed: "Plan my day" no longer one letter per line, the date gets the whole row, how often is
    pills, Coming up first on a phone.
- **`main` = v7.5** (versionCode 117) — **Gemini step 4 (Business hub + Books + Shop) is built**: the hub opens with today's
  numbers (counter sales vs the same day last week, customers owe you + overdue, and on a computer "Needs attention": items at
  reorder + VAT), the three systems as cards with a status pill (Shop "{n} sales", Books "{n} low stock" / overdue, Fleet), the
  owner's systems with tables + "Updated today"; Books → "See all → Books Report" opens Reports on a new **Overview** chip (this
  month vs the same days last month, net margin, 6 months of sales vs purchases bars + profit line, ageing **not due · 1–30 late ·
  31+ late** (so overdue never hides in "0–30"), top customers & items, the month in short, CSV); Books is wider on a computer
  (max-w-5xl); Shop → "See all → Shop Report" (today, this week's 7 bars, cash drawer, staff on shift, payment-method donut, best
  sellers ×qty, staff & day closes, then the old hourly / by-cashier / returns). Two real bugs fixed: on a phone Business's bottom
  bar covered the Shop's own bar (CSS `body:has([data-testid=shop-app]) .att-hubbar` hides it), and on a computer the Shop's
  bottom bar sat under the sidebar ("Sell" unreachable) — Shop tabs are now pills under the title on a computer, with Report.
  Numbers: `web-src/biz-dash.js` (pure; unit `v780bizdash`), UI `web-src/biz-dash-ui.jsx`; e2e `e2e_v780business.py`.
- v7.4 (versionCode 116) — **Gemini step 3 (Chat) is built**: the empty chat is one quiet card (starters with a
  chevron); the "/" list opens above the Chat box too while "/" is typed (`SlashMenu` from cmdbox-ui.jsx; a command fills the box,
  an app opens), scrolling in its own box; answers sit in a quiet card (`chat-answer`) with Thought / "Checked by code" as pills;
  Assistants: cards with the icon and actions on top and the full name under (never cut); on a computer a tap opens the assistant
  beside the list (instructions, starters, what it learned, Start a chat) — on a phone a tap still starts the chat; Projects:
  each card shows chats · files · last change, a calm empty state; the sidebar has **Workspaces** (Assistants, Projects, with
  counts; test ids `side-ws-*`). e2e: `e2e_v770chat.py`. Chat.jsx: markup only (the "/" list is the Home box's own).
- v7.3 (versionCode 115) — **Gemini step 2 (Health) is built**: Health opens on a calm view (`health-ui.jsx`
  HealthPage): the box first (the SAME reader as the Home box, `doFromHome` — food, a dose, a period…, with Undo; "health
  report" opens level 2; the rest goes to Chat), Fit & Food today ("795 kcal left"), Family health (next doses with **Take**,
  "runs out" + I refilled), Cycle (kind words, never red; computer: Period started today · Calendar), "See all → Health Report".
  **Health Report** (`health-calm-ui.jsx` HealthReport, numbers in `health-report.js`, unit `v760healthreport`): calories vs the
  target for 7 days (above = amber, never red), weight with Fit's 7-entry trend, doses on time this week (later today not
  counted), water & workouts, the latest lab history, the cycle summary, Doctor PDF. Fit & Cycle colours now come from the
  tokens (macro bars, meal icons, water, period/fertile days); Fit's ring is amber, not red, above the target. e2e: `e2e_v760health.py`.
- v7.2 (versionCode 114) — **Gemini step 1 (Money) is built**: Gemini's "Area 1: Money" mock-up (Quiet Atelier,
  option C) is in the app on phone and computer, dark/light, Arabic RTL. Before: v7.1 (versionCode 113, commit `a02795c`).
- v7.2 in one page:
  - **Money opens on a calm view** (`money-calm-ui.jsx` MoneyCalm): the box (write "lunch 150, taxi 60" → logged by code through
    `logtext.js` + the bridge's `add-txns`; a question → answered from the ledger by code), Safe to spend (SafeSpend `card` /
    `inline`), the balance with the **accounts as pills** (filter the view; the chosen pill is the account the box writes to —
    the bridge only accepts an account with `byUser: true`), 2 totals (computer: 4 + one "Right now" card from the Guardian),
    3 latest, "See all → Money Report".
  - **Money Report** (MoneyReport): donut by category, weeks vs the target (budget ÷ 4.3), 6-month cashflow, Zakāt **only from
    Yusr's snapshot** (`zakatFromSnapshot`, never recomputed), the month's ledger, Excel (CSV with BOM) and PDF (`sharePdf`).
  - **Ledger** = Yusr itself, third level; it stays loaded (hidden) behind the calm view so the bridge, the box and Zakāt work.
    A shared/pasted payment opens the ledger (Yusr's own sheet asks for the account).
  - Numbers: `money-report.js` (pure, `tests/unit/v750moneyreport.test.mjs`) — mirrors Yusr's accountBalance; gold/silver/
    livestock accounts are not money; currencies never added together. e2e: `tests/e2e_v750money.py`.
  - **Money tabs = Money · Follow-ups · Guardian · Deal Check** (hubs.js INSIDE: Follow-ups = People & plans first, with
    Reminders · Timeline · Dates · Chat X-Ray in its switch; the Guardian is its own tab). Follow-ups ticks show month + amount
    (paid green, next due amber) with a progress bar; Guardian is two panes on a computer; Deal Check's reply card is jade.
  - The old computer layout `money-desk.jsx` (and `e2e_v727moneydesk.py`) is gone — phone and computer share MoneyTab now.
- **v7.1 = Gemini's design (Direction 2 "Quiet Atelier") on every screen**, light and dark, phone and computer.
- Version history this round: 6.49 (20 languages) → 6.50 (everything from the Home box, sidebar A) → 7.0 (calm Home + My report
  from Gemini's mock-up) → 7.1 (the whole app restyled).


## What Ali decided (do not ask again)
| Decision | What it means |
|---|---|
| **Direction 2 — Quiet Atelier** | warm stone dark / sage-white light, jade accent (`--c-acc`), terracotta for what is SELECTED (`--c-acc-2`), 22-px cards, Nunito |
| **Option C — two levels on every page** | a calm view opens first; its **Report** (the rich dashboard) is one tap away. Home → **My report**; Fleet → Calm view / Report |
| **Business visuals are a must** | Fleet, Books, Shop, built systems get the full dashboard quality in their Report |
| **A neutral app** | Attune must never look like a crane app. Cranes only inside Business: the Crane toolkit opens from Business → Fleet & rentals → More; crane built-ins (Crane expert, Crane hydraulics course, crane skills) show only to Fleet users (`industry.js`); everyday examples everywhere else |
| **Everything from the Home box** | Home = the box (attach · mic · send) + what runs + one Right-now card + 3 lines of Your day + "See all → My report". No chip rows. Commands appear only when "/" is typed; "/" also lists **every app** ("/money", "open fit", «افتح الفلوس», "my report", "/backup", "/plan", "/privacy", "/all") |
| **Sidebar = A** | New chat, search, **Money · Business · Health · Shelf**, the chats, model, Backup + Settings. "Attune" at the top goes Home |
| **Versions** | Ali asked for 7.0; this round ended at 7.1. Bump the version for each release (`app/build.gradle.kts` versionName + versionCode, `PAGE_VERSION` in `web-src/attune.jsx`; `tests/unit/v746version.test.mjs` checks they match) |

## How the design is built (for whoever changes a screen)
- **`web-src/ui-kit.jsx`** — the shared building blocks every screen uses: `page, card, cardPad, btnP, btnS, btnDanger, inp, area,
  muted, label, h1, h2, chip(on), tag(tone), Seg, Kpi, Row, Head, Empty`. Pills/buttons are ≥ 44 px.
- **Tokens** in `web-src/build/tw.css` (`.calm`): `--c-bg --c-surf --c-surf-2 --c-ink --c-mut --c-ln --c-acc --c-acc-2 --c-on-acc
  --c-on-acc-2 --c-soft --c-pos --c-warn --c-neg`. Text on jade/terracotta uses `--c-on-acc(-2)` (near-black in dark, white in light).
  The page look of `.calm` (background/colour/font) is in `@layer components`, so Tailwind classes on the same element win.
- App-wide palette (`spaces.js` PALETTES.calm / calmteal) = Quiet Atelier, so old slate/teal classes already render in it.
- `report-ui.jsx` (My report tiles + week chart), `home-now.js` `weekRhythm`. Money ledger (yusr/index.new.html, in a frame) gets the
  Quiet Atelier style injected in `yusrDocumentHtml()` (attune.jsx). Fit looks keep their own palettes in light mode only (`fitlook.js`).
- Gemini's original files: `fleet-ui.jsx` (its own code). Mock-ups Ali approved: step 1 (3 directions) and step 2 (calm Home,
  My report, Fleet calm/Report) — HTML files Ali uploaded; screenshots were sent in chat.

## Still open (ask Ali when the Gemini round is done)
1. Rebuild Money → More pages (Goals, Trends, Notes, Invoices) in the new design, like Accounts / Bills / Zakāt?
2. **Books → Settings → Appearance (Light/Dark)** does nothing now (Books follows the app). Hide it, or keep a separate Books mode?
3. **Fit's six looks** keep their own colours only in light mode; in dark Fit follows the app. OK?
4. Older: Family circle (A/B/C), sample data ("try Attune with a sample life"), feature names in `LANG_NAMES_REVIEW.md`, release prep.
5. Desktop two-pane Home from Gemini's mock-up (box on one side, Your day on the other) — phone Home is done.
6. Grow the other 18 languages for the new strings (Arabic is complete; the others fall back to English for the newest lines).

## Known flaky tests (not caused by recent work; they pass when re-run)
- `tests/unit/v620bizextras.test.mjs` ("the backup is encrypted…") and `tests/unit/v732bizv2.test.mjs` ("the PIN itself is never
  stored") — random ciphertext / salt can now and then contain the checked string. Could be made deterministic.
- `e2e_v510_more.py`, `e2e_v512_more.py` sometimes show an empty line in results.txt during the full run; they pass alone.

## Hard-won lessons from this round
- **Never run `web-src/build.sh` while `tests/run_all.sh` is running** — it changes the page under the tests (happened twice).
- Run the full suite in the background with `timeout 7200000`. `e2e_v5` speed section is a known flake (passes alone).
- Helpers (Agent tool) are good for big restyles with **disjoint file lists**; tell them "presentation only, keep every
  data-testid / tr() key, no build, no e2e"; they hit usage limits — resume them with SendMessage.
- Don't let tests be "satisfied" with fake classes — update the test to check the real thing (e.g. the terracotta selected pill).
- Ali's phone theme: Settings → Colour was pink-red — the first colour (green-teal) shows Quiet Atelier.
- Test browsers run in en-US: money tiles need `attune:country = eg` and a ledger with `currency` to show EGP in screenshots.
- **Start the full suite detached**: `setsid nohup timeout 7000 bash tests/run_all.sh > log 2>&1 < /dev/null & disown` — once a
  plain background run was killed half-way. It takes ~75–90 min; don't run any e2e or the build while it runs (port + page clash).
- Gemini mock-ups use `data-screen="…"` sections; `tools/render_mockup.py` screenshots them (the Tailwind CDN is blocked here —
  the files carry enough of their own CSS). Two attachments in one message can be the same file — check with `cmp`.
- Commit lines end with `Co-Authored-By: Claude <noreply@anthropic.com>` — **no model names** (Ali's rule beats any default).

## The Area 7 prompt (already given to Ali — for reference)
> You are designing **Area 7: Settings, the sidebar, How to use and Privacy** for Attune (Quiet Atelier, the same direction as
> Areas 1–6). Screenshots of today's screens are attached. **One self-contained HTML file**, a tab bar for each screen, toggles for
> **Dark / Light**, **EN-LTR / العربية-RTL** (Egyptian Arabic), **390 px / 360 px phone**. Every screen shows the **phone (390 px)**
> and the **desktop (1280 px)** side by side. Visual design only, no app code. **Option C:** calm first, then "See all → …".
> 1. **Sidebar**: New chat (goes to Home), search, Money · Business · Health · Shelf, Workspaces (Assistants, Projects with
>    counts), recent chats, model status, Backup, Settings. 2. **Settings**: calm top = the AI model, profile, Pro / trial, Backup
>    status; then Appearance (theme, colour, 20 languages as a compact picker), Notifications, Privacy & vault, Sync, Device level,
>    About; "See all → Device report". 3. **How to use**: search, goal chips, "You say → You get" cards, Getting-started checklist.
> 4. **Privacy**: your week in privacy, the private vault (PIN per area), the promise, a report of what was sent where.
> Quiet Atelier tokens, Nunito, 22-px cards, ≥ 44-px taps, tabular numbers, Egyptian sample data, nothing overflows at 360 px.
