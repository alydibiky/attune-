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
