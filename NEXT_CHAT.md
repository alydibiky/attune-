# Attune — start here (handoff for the next chat, 24 Oct 2026)

Read this page first, then `CLAUDE.md` (Ali's standing rules), `GEMINI_DESIGN_BRIEF.md` and `CHAT_RUNS_APP.md`.

## Where things stand
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

## NEXT: the Gemini step (Ali: "when you finish and push we will start the Gemini thing")
Gemini designs each area creatively as **HTML mock-ups only (no code)**; Ali approves; **Claude builds it into the app himself**
(do not wait for Gemini's code — that was a mistake once), tests, sends screenshots, ships. Order: ~~1 Money~~ (v7.2) · ~~2 Health~~ (v7.3) · ~~3 Chat~~ (v7.4) · ~~4 Business~~ (v7.5) · ~~5 Mind & learning~~ (v7.7) · ~~6 Tools~~ (v7.8) · (Money page,
Follow-ups, Guardian, Deal Check) · 2 Health (Fit & Food, Family health, Cycle) · 3 Chat (chat, Assistants, Projects) ·
4 Business hub + Books + Shop · 5 Mind & learning · 6 Tools · 7 Settings, sidebar, How to use. The message Ali sends Gemini is in the
last chat; the brief is `GEMINI_DESIGN_BRIEF.md`. When an HTML mock-up arrives: render it locally (Tailwind CDN is blocked — compile
its classes with `tailwindcss@3.4.17` in the scratchpad, see how it was done for step 1/2), show Ali screenshots, then build.

## Open questions for Ali (small)
1. **Books → Settings → Appearance (Light/Dark)** does nothing now (Books follows the app). Hide it, or keep a separate Books mode?
2. **Fit's six looks** keep their own colours only in light mode; in dark Fit follows the app. OK, or bring look colours to dark too?
3. Still open from before: Family circle (A/B/C), sample data ("try Attune with a sample life"), feature names in
   `LANG_NAMES_REVIEW.md`, release prep.

## Also still to do
- Desktop two-pane Home from Gemini's mock-up (box on one side, Your day on the other) — phone Home is done.
- Reports in the option-C style now exist for Money, Health, Books, Shop, Fleet and My report.
- Grow the other 18 languages for new strings (Arabic is complete; others fall back to English for the newest lines).

## Hard-won lessons from this round
- **Never run `web-src/build.sh` while `tests/run_all.sh` is running** — it changes the page under the tests (happened twice).
- Run the full suite in the background with `timeout 7200000`. `e2e_v5` speed section is a known flake (passes alone).
- Helpers (Agent tool) are good for big restyles with **disjoint file lists**; tell them "presentation only, keep every
  data-testid / tr() key, no build, no e2e"; they hit usage limits — resume them with SendMessage.
- Don't let tests be "satisfied" with fake classes — update the test to check the real thing (e.g. the terracotta selected pill).
- Ali's phone theme: Settings → Colour was pink-red — the first colour (green-teal) shows Quiet Atelier.
- Test browsers run in en-US: money tiles need `attune:country = eg` and a ledger with `currency` to show EGP in screenshots.
