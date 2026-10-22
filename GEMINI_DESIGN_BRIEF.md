# Attune — design brief for Gemini (from Ali, 22 Oct 2026)

You are designing the interface of **Attune**: one private app a person lives in (money, health, food, work, learning, files,
plans) **and** the business systems they run (Fleet & rentals for crane companies, Books, Shop, and systems Attune builds from a
sentence). Ali loves how you design. Be **bold and creative** — but follow the rules below exactly, because another engineer
(Claude) integrates your work into a large, tested codebase and every rule protects something that already works.

## The goal
**One level of professionalism everywhere**: the business systems and the personal app must feel like the same, premium product
— the quality bar of the best SaaS dashboards (clear hierarchy, calm surfaces, confident numbers, beautiful data). Reference
mood Ali shared: dark-navy "desk" dashboards with soft glass cards, a warm accent pill for the active tab, KPI tiles, a timeline,
filter chips, people rows with progress bars, bar + line charts. Those screenshots are a **paid commercial template — use them as
a quality bar only. Do not copy their layout, names, colours or assets.** Make something that is Attune's own.

## Hard rules (never break these)
1. **Presentation only.** Change markup structure, Tailwind classes, inline styles and the theme CSS. Do **not** change logic:
   no edits to `*.js` files, to function/variable names, props, state, hooks, event handlers, `useEffect`s, imports of logic, or the
   order in which things happen. If a design needs new data or a new action, write it under "Needs from Claude" — don't build it.
2. **Keep every `data-testid` and `aria-*` attribute** on the element that does the same job (the app has ~440 automated test files that
   find elements by them). You may wrap or move an element; you may not drop its test id.
3. **Words:** all visible text stays inside `tr("…")` with the **exact English text** (it is the key for 20 languages). Don't reword;
   if a word should change, list it under "Wording ideas for Ali". New text must be `tr("New text")`.
4. **Right-to-left:** Arabic, Urdu and Persian flip the page. Use logical classes only — `ps-/pe-/ms-/me-/start-/end-/text-start/
   text-end`, never `left/right/pl/pr/ml/mr`. Arrows/chevrons that point "forward" get `rtl:rotate-180`.
5. **Phone first, desktop too.** Must look right at **360 px** wide (no sideways scroll; wide tables scroll inside their own box) and
   at **1024 px+** (the app already has a two-pane desktop layout: `PANES`, `LEFT`, `RIGHT` from `desk.jsx`).
6. **Colours only through the theme tokens** (CSS variables), in BOTH light and dark mode. Today's tokens (in
   `web-src/build/tw.css`, class `.calm`): `--c-bg --c-surf --c-ink --c-mut --c-ln --c-acc --c-soft --c-warn --c-pos --c-neg --c-r`.
   You may add tokens (e.g. `--c-acc-2`, `--c-chart-1…5`, `--c-glass`) — define each for light AND dark.
   Status colours mean one thing each: good / due-soon / overdue (green / amber / red), everywhere.
7. **Accessible:** text contrast ≥ 4.5:1 (small grey labels too), touch targets ≥ 44 px, real `<button>`s, focus visible, colour is
   never the only signal (add an icon or a word).
8. **Fast on weak phones:** no `backdrop-filter`/blur on large or scrolling areas (a small header is fine), no animation longer
   than 200 ms, no animated shadows, no web fonts beyond **Nunito** (Ali's choice; Arabic falls back to the system Arabic font),
   no new npm libraries, no images from the internet. Charts: inline SVG or CSS only.
9. **Icons:** only lucide icons the app already ships (`web-src/build/lucide-shim.js`); if you need another, name it under
   "Needs from Claude".
10. **Numbers:** tabular figures (`tabular-nums`), Western digits, currency after the amount as the app does now.
11. **One file at a time.** For each screen you redesign, return the **whole file**, plus a short list: what changed, what you
    need from Claude, wording ideas. Don't touch files you weren't asked to.

## A neutral app (Ali, 22 Oct — read before every screen)
Attune is for **anyone** (a student, a nurse, a shop owner, a family) — it must never look like a crane or fleet app. Fleet & rentals
is just ONE of the business systems, and lives only inside Business. In every mock-up of Home, My report, Chat, Mind, Money and
the other personal screens, use **everyday sample data** (groceries, rent, a phone bill, exams, a trip, a gym session, a café) —
no cranes, no fleet, no lifting. Crane data belongs only in Fleet's own screens.

## Calm, not cluttered (Ali's vision — read before every screen)
Your job is the **look** (colours, type, cards, tiles, charts, spacing, dark mode) — **not adding more things to a screen**. Attune's
idea is that **the chat box does most of the work**, so screens stay quiet:
- **Home:** the box first and biggest. Under it only what is happening now (job cards while something runs; at most ONE "Right
  now" card). Then "Your day" short: at most 3 rows and a "See all". No extra chip rows, no tile grids, no "Needs you" lists on
  the phone — the box answers those ("what do I owe?", "what's on today?").
- **Commands appear only when "/" is typed** (the "/" list opens above the keyboard). No `/convert` `/remember` `/find` chips
  under the box — under it only: attach, Web, Translate (and the mic / camera / send buttons).
- **Every screen:** one main action, 3–4 numbers at most above the fold, the rest one tap away (a tab, "See all", or folded).
  Empty space is part of the design.
- **Business screens** (Fleet, Books, Shop) may be richer dashboards on the **desktop**; on the **phone** show the 4 KPI tiles and
  "Needs attention" first, and put charts and long lists behind a tab or "See all".
- Show the screen with **a normal day's data**, not the busiest possible day.

## Two levels on every page: calm view + Report (Ali, 22 Oct — option C)
Every app and every part has **two levels**:
1. **The calm view** (what opens first) — per "Calm, not cluttered" above.
2. **Its Report** — the detailed, dashboard-rich page you showed in Step 1 (KPI tiles, charts, timeline, people rows with progress,
   tables, "Needs attention"). Opened from the calm view's "See all" / a "Report" tab, or by asking the box ("my report",
   «وريني التقرير», "Fleet report"). Plus **one "My report"** page that joins every area (money, food, health, fleet, your day).
- **Business is a must:** Fleet, Books, Shop and the systems Attune builds get the full Step-1 dashboard quality in their Report
  (desktop: the rich desk; phone: the same tiles and charts stacked, nothing hidden that matters).
- Reports use the SAME components as the calm views — only more of them. On desktop, a Report may sit in the right pane.
- New pages / tabs / routes are logic: draw them, and list each under "Needs from Claude" (Claude wires the page and the box words).

## Where you are free (be creative)
Layout and hierarchy, spacing rhythm, card styles, KPI tiles, tab and chip styles, tables vs. cards on phone, empty states,
inline-SVG illustrations, chart styling, subtle motion (≤ 200 ms), a "desk" mode for business screens, dark-mode richness,
microcopy suggestions (as a list). Surprise Ali.

## Step 1 — the design system first (before any screen)
Deliver **2–3 named directions** (Ali chooses — his rule is that look-and-feel choices are his). For each:
- the token set (light + dark), type scale, radius, spacing, elevation;
- the shared component vocabulary used by EVERY screen: page header · KPI tile · segmented tabs · filter chips · list row · data
  table (phone + desktop) · status pill · timeline / schedule bar · chart card (bar, line, donut) · form field · bottom sheet ·
  empty state · toast · the Home box and job card;
- one static mock-up (HTML) of **Fleet → Today** and **Home** in that direction, phone (390 px) and desktop (1280 px).
Then stop and wait for Ali's pick.

**Step 1 feedback from Ali (22 Oct):** the visuals and dashboards are impressive — keep that quality. But the Home mock-up shows
too much at once: redo Home in the picked direction following "Calm, not cluttered" above (box first, jobs, one Right-now card,
3 rows of Your day). The busy Home you drew becomes **"My report"** (see "Two levels" above), and Fleet → Today's rich
version becomes **Fleet's Report** — keep both designs. **Ali picked Direction 2 — Quiet Atelier** (warm stone dark, jade green, terracotta active pill, 22 px corners) **and option C** (calm view + Report on every page and part)
and: commands only when "/" is typed.

## Step 2 — screens, in this order (after Ali picks)
Business (same components everywhere):
1. Fleet & rentals — `fleet-ui.jsx` (Today, cranes, jobs, cheques, store), `fleet-desk-ui.jsx`, `fleet-pro-ui.jsx`,
   `fleet-trade-ui.jsx`
2. Books — `books-ui.jsx`, `books-sales.jsx`, `books-purchases.jsx`, `books-money.jsx`, `books-stock.jsx`, `books-reports.jsx`,
   `books-docs.jsx`, `books-extras.jsx`, `books-pro-ui.jsx`
3. Shop — `shop-ui.jsx`, `shop-pro-ui.jsx`
4. Systems Attune builds — `erp-ui.jsx` (tables, forms, insights), `biz-v2-ui.jsx`, `biz-pro-ui.jsx`; the Business home `biz-ui.jsx`
App (same professionalism):
5. Home — `home-ui.jsx`, `cmdbox-ui.jsx` (the box, "/" list, job cards, answer cards); sidebar `side-ui.jsx`; desktop home
   `desk-ui.jsx`
6. Chat composer and messages — `chat.jsx` (**markup and classes only**; this file has heavy logic — touch nothing else)
7. Mind — `mind-ui.jsx`; Money — `money-desk.jsx` and the Money pages

## How to hand back
For every file: `--- FILE: web-src/<name> ---` then the whole file, then the three short lists. Claude builds it
(`bash web-src/build.sh`), runs all tests (`bash tests/run_all.sh`), fixes anything that broke without changing your design, and
shows Ali screenshots before it ships.
