# Persona 5 — the UI/UX designer (25 years)

**What I did (hands-on, measured):**
1. **An accessibility audit of 16 screens, in English and in Arabic** (390×844 phone): every button and field measured for tap
   size, every visible text for size and for contrast against its real background (WCAG 2.2 AA), and horizontal overflow.
2. **10 everyday tasks done only by tapping what's on screen** (no Home-box shortcuts), counting taps and screenshotting
   every step: an expense in Money, set up Fit + log breakfast, a reminder in Follow-ups, translate, an agent from a chip,
   homework, a note in Saved, switching the app to Arabic, the light theme.
3. **Speed on a phone-class processor** (Chrome CPU 4× slower): time to switch each main page, and a cold start.
4. Guidance checked: WCAG 2.2 (target size ≥ 24 px; 4.5:1 text contrast), Material 3 (48 dp targets, 11 sp smallest label),
   and current mobile-navigation advice — **3–5 primary destinations, don't bury frequent actions, keep embedded parts in the
   host app's own navigation** ([DesignStudio 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/),
   [ProCreator: super-app challenges](https://procreator.design/blog/how-to-solve-super-app-design-challenges/)).

## Measured results
| Check (16 screens × EN + AR) | Result |
|---|---|
| Text contrast below WCAG AA | **0** — every text passes |
| Anything wider than the screen | **0** |
| Tap targets under 24 px | **1** (the Translate "Extra careful" checkbox, 16 px — inside a 44 px label; made larger now) |
| Tab labels narrower than 40 px ("CV", "Mind", "Code") | 15, all 44 px tall — fine by WCAG, under Material's 48 dp |
| Text under 12 px | Money and Business card labels at 11–11.5 px (inside Material's 11 sp label size; at the edge for older eyes) |
| Page switch on a 4× slower CPU | Home 69 ms · Fit 81 · Follow-ups 77 · Agents 65 · Tools 66 · Chat 71 · Health 57 · Go 83 · **Money 351 ms** |
| Cold start → the Home box ready | 1.45 s |

| Task, by tapping only | Taps | What I noticed |
|---|---|---|
| Expense in Money ("taxi 60") | 4 | Clear; "Safe to spend today 0 EGP" on day one with no income feels harsh |
| Set up Fit + log breakfast | 16 (11 set-up, 4 to log) | Good set-up; the plan is sensible (2,060 kcal / 171 g protein for 95 kg). **Two back arrows** on the add screen (bar ← and page ‹) |
| Reminder in Follow-ups ("call mom tomorrow at 6pm") | 4 | **"I couldn't read that"** — fixed |
| Agent from the "Find & buy" chip | 4 | Card shows its plan clearly; **"RUNNING · 0"** with an agent on screen — fixed |
| Homework (type a problem) | 4 | Fine (via sidebar search) |
| Switch the app to Arabic | 3 | The whole layout flips correctly; the date shows Arabic digits (٢٧) while the rest of the app uses 27 |
| Light theme | — | Renders correctly |

## Fixed now
- Follow-ups' box: anything with a day or a time is a reminder ("call mom tomorrow at 6pm", «كلم ماما بكرة الساعة 6»); on
  Home "call / visit / meet / pick up + a time" too.
- Agents counts buy agents ("Running · 1") and the report lists "Buy agents".
- **Fit suggested "Pulled pork sandwich" and "Pancakes with maple syrup"** to an Egyptian whose phone is in English (it took the
  food country from the phone's language). It now follows the country chosen in Attune; and the day's plan never proposes
  pork in a Muslim-majority country (still searchable and loggable).
- Translate's checkbox is larger.

## Recommendations (layout — Ali picks)
- **P5-A Navigation (the biggest one).** Today: a sidebar with 9 places + pages with their own tab rows + Money and Business
  with their own bottom bars + Fit with its own bottom bar. Three navigation systems at once. Options: (1) one bottom bar with
  4 places + "More" (Home · Money · Health · Follow-ups · More) and the sidebar only for chats; (2) keep the sidebar, remove
  the inner bottom bars (Money / Business / Fit become tabs at the top like Health and Students). *Recommend 2* — less change,
  one system.
- **P5-B One back control per screen** (drop the inner ‹ when the top bar already has ←). *Recommend yes.*
- **P5-C One input box component everywhere** (Home, Money, Health, Follow-ups, Agents each have a different box today).
- **P5-D Labels at 12 px minimum** (Money / Business eyebrows 11 → 12). *Recommend yes.*
- **P5-E Money's first open (351 ms)**: show the calm view first and load the ledger engine right after — feels instant.
- **P5-F Day one in Money**: before any income is logged, show "Add your income to see what's safe to spend" instead of
  "Safe to spend today 0 EGP".
- **P5-G Digits**: one rule everywhere (Western digits in Arabic, as the app already does elsewhere).

## Visuals and colours (Ali asked persona 5 to look at these too)
**How:** every main screen captured in light and dark system mode, the colour tokens and every font, size, corner radius,
border and shadow on screen read from the page, and the screens laid side by side.

**The palette in use (light theme, Ali's design A):** background `#F4F7F5`, cards white, ink `#16201C`, muted `#4A5852`,
**green accent `#157A52`** (primary buttons, links), **terracotta `#B5543A`** (selected chips and tabs), soft green `#E3F4EC`,
warning `#B4560E`, negative `#B33A2E`, positive `#1E7A43`. Text contrast passes everywhere.

**What works:** the green is calm and trustworthy (good for money and health); white cards on a pale green-grey read cleanly;
the tinted icon squares (Tools, Business) give a consistent family look; Nunito is friendly and readable in English and the
Arabic fallback lines up.

**What doesn't (found by measuring and looking):**
1. **The "selected" colour looks like the "error" colour.** Terracotta `#B5543A` (selected chip, active tab, "Teach me first",
   "30 days", "All 0", Chat pill) sits right next to warning `#B4560E` and negative `#B33A2E`. A selected filter reads like an
   alert. → make "selected" a green tint (soft green fill + green text), keep orange/red only for money out, warnings, errors.
2. **Eleven different corner radii** on screen (6, 8, 10, 12, 14, 16, 18, 22, 24, 26 px and full pills). It's why cards on
   different pages feel slightly different. → three: 12 (small controls), 20 (cards), full (pills and chips).
3. **Two fonts**: Nunito everywhere, Figtree on ~10 % of the text (the styling framework's default still named Figtree first). **Fixed now: Nunito first everywhere.**
4. **Three looks of page chrome**: most pages (menu + back + title + "No model"), Business (round back chevron, its own
   bottom bar — looks like another app), Saved → Notes (a second menu ☰, alarm, search, + and ⋮ inside the page, titled
   "Shelf" under a tab called "Notes", with a purple book that matches nothing else). → one header style everywhere.
5. **Web-style underlined links** ("Open: People & plans · Reminders · Dates…", "Update everything") next to chip buttons
   everywhere else. → chips or a list row with ›.
6. **Empty space on day one**: Home is the box and two "See all"; Fit's welcome is a large empty card with one small apple;
   Money's balance card has a decorative half-circle that looks like a loading artefact. → one friendly illustration per
   empty state, or tighter layouts.
7. **The app doesn't follow the phone's dark mode** — with the phone dark it stays light (dark themes exist in Settings →
   Theme, but no "follow my phone").

## Visual options for Ali
- **V-A Selected state**: (1) green tint (recommended), (2) keep terracotta but move warnings/negatives to a clearly different
  red, (3) ink-black selected chips.
- **V-B Theme**: add "Follow my phone (light by day, dark at night)" as the default; light stays the light. *Recommend.*
- **V-C Consistency pass**: 3 radii, Nunito only, one header style, chips instead of underlined links. *Recommend — no new
  look, the same look made consistent.*
- **V-D Empty states**: a small illustration + one example button on Home, Money, Fit, Follow-ups, Agents.
