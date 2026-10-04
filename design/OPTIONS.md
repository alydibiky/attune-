# Design options for Ali to pick (items 9, 13, 14)

The images are in `design/`. Nothing in the app was changed. Ali picks a letter for each item, and a later
session builds it. The HTML sources are in `design/src/`. To re-render them, run
`PYTHONPATH=tests/pwshim:tests python3 design/_render.py <html> <png>`. The screenshots of the current
app come from `design/_shots.py` (Playwright on the v6.9 web build, 390 px).

## 1. Fit & Food home: `fit-home-options.png` (item 14)

| | Option | Pros | Cons | Taps per meal | Effort |
|---|---|---|---|---|---|
| **A** | **Log bar**: the ring and macros at the top, then a Photo · Barcode · Say it · Search bar, then one-tap chips for recent and frequent meals, meals by time of day, water glasses and a week mini-chart | It is the fastest to log, and everything is visible on one screen. It is familiar to Yazio users, but quicker. | It is the busiest of the three screens. | **1–2** | ~22 h |
| B | **Camera-first**: one large "Snap your plate" button; a long-press gives the other ways | It is very simple and photo-led. | Barcode, voice and search are hidden. It depends on photo recognition, which is still broken (item 10). | 2 | ~16 h |
| C | **Timeline + ＋ sheet**: one ＋ opens a sheet with 6 ways to log and your favourites | It is the cleanest look. | Every meal costs one extra tap. | 2–3 | ~18 h |

**Recommendation: A.** It is 1 tap for meals you eat again, against 4 or more in Yazio. It also works offline,
with Egyptian dishes and voice in Arabic. The Arabic RTL version is in the image.
For any option: the first time Fit opens it asks 3 questions (the long plan form moves to Profile),
each add gets "Added · Undo" with a light haptic tick, and the photo gets a 15 s limit with a fallback.

Files touched: `web-src/fit-ui.jsx` (`FitApp`, `Today`, `ProfileForm`, `Ring`, `Bar`; tabs
Today/Recipes/Move/Progress), `fit.js` (recent and frequent meals), `fitphoto.js` (timeout and fallback),
`fit-cuisines.js` (suggestions from the country's dishes), `i18n-ar.js`. The bridge is used for haptics.

## 2. Studio progress: `studio-preview-options.png` (item 9)

| | Option | Pros | Cons | Effort |
|---|---|---|---|---|
| **A** | **Draft then clear**: a 384 px draft in about 10 s that you can keep, then the 768 px version cross-fades in on the same spot | You see in 10 s whether the prompt worked, and can stop early. | It adds about 10 s to the total. | ~10 h (UI) + engine work for the draft pass |
| B | **Best of 2**: two drafts, you tap one, and only that one is refined | It gives the best results on hard prompts (the crane-over-sea case). | It needs about 1.3× the time and memory. | ~14 h |
| C | **Per-step previews**: a live latent preview and a step strip | It feels alive. | The early steps are only noise, so it gives no earlier verdict, and it is 5–8 % slower. | ~12 h |
| D | Simple bar (the baseline, roughly what the app does today) | It is cheap. | You wait about 50 s blind. | 0 |

**Recommendation: A, with "Best of 2" as a switch in the settings.** Every state uses a skeleton (no
spinner), Stop is always there, and the chat model stays loaded.
Files touched: `web-src/studio-ui.jsx` (`StudioPage`), `web-src/studio.js`, and the native image engine
(it needs a draft resolution and a refine pass).

## 3. App-wide rework: `ui-rework-options.png` (item 13)

The audit uses these screenshots: `current-home.png`, `current-more.png`, `current-fit.png`,
`current-studio.png`, `current-money.png`, `current-instant.png` and `current-business.png`. The 10
problems are listed in the image. The biggest ones: More is a wall of 32 tiles, Fit opens on a form, each
mini-app has its own language prompt and theme (Money), there are 6 tabs, empty dead ends (Studio), and
there are spinners and reloads with no motion system.

| | Direction | Pros | Cons | Effort |
|---|---|---|---|---|
| **A** | **Calm hub**: 4 tabs (Home · Chat · Apps · You), a short daily Home, an Apps grid with search, one shared shell | It brings the most order for the least change to habits, and keeps today's look. | Business and Money lose their permanent tab (unless you pin them). | ~40 h |
| B | **Chat is the app**: apps open as sheets over the chat; a chip row and "/" commands | It is the most modern and has the fewest screens. | Big apps feel cramped, and it is the biggest change in habits. | ~55 h |
| C | **Workspace rail**: a left rail of pinned apps, with no bottom bar | It shows the most at once and suits foldables. | It is unusual on Android, hard to reach one-handed, and costs 44 px of width. | ~45 h |

**Recommendation: A.** It fixes the problems in the audit without making the app feel new, and the
rules (48 px targets, ≤ 2 taps to the 5 common actions, skeletons, 220 ms slide transitions,
sheets with drag-to-close, shared-element transitions, haptics, a 6-step type scale, a 4 px spacing grid,
no reloads) apply to any direction.
Files touched: `web-src/attune.jsx` (the bottom nav, the More sheet around line 10632, the top bar and
model chip, the chat home), `backstack.js` (sheet and back behaviour, motion), `chat.jsx`,
`erp-ui.jsx` (`MoreTab`), `attune.jsx` `MoneyTab` / `yusr/` (drop the second language prompt and theme),
`studio-ui.jsx` (empty state), `i18n.js` / `i18n-ar.js`, plus a small CSS token file for the type, space
and motion scales.
