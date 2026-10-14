# Attune — the whole app in one handoff (read this first)

_Up to date: 13 Oct 2026, **v6.27** (versionCode 88) on `main` = branch `ccr-a0eb3595-e2c7a7`._
This file is the map. Details and history are in `HANDOFF.md` (§5.x = one section per release, newest at the end:
§5.44–§5.60 cover 10–12 Oct 2026). Ali's raw problem lists are in `NEXT_SESSION.md`. The desktop plan is in
`DESKTOP_PLAN.md`.

---

## 1. Who you work for, and how
- **Ali (Aly Aldibiki)**, Cairo (UTC+3), 21. He co-owns **Adrighem & Aldibiki**, a crane company with about 150 employees. He works on
  **Windows** and tests on an **Honor Magic 8 Pro** (Snapdragon 8 Elite Gen 5, 12–16 GB RAM, MagicOS). He is not at
  a keyboard writing code: he installs the APK from GitHub Actions, tests on the phone, and reports with screenshots.
- **Language:** explain every step simply, with technical terms in **English and Egyptian Arabic**. The app's Arabic UI is
  **simple formal Arabic** (his choice, 4 Oct 2026); Egyptian is used only where code reads what people type.
- **Standing rules (all in force):**
  1. Never commit `*private-key*.json`. Never change `app/attune-test.keystore` (the APK signing key, so updates install over each other).
  2. **Subjective choices** (look, layout, colours, names, wording, which of several designs): show 2–4 concrete
     options with a recommendation and build the one he picks. Objective bugs: just fix them.
  3. Targeted fixes, no rewrites (except the UI reworks he asked for).
  4. Use a **task list**. Answer **every** point he raises. Don't stop to ask unless something can't be undone.
  5. Commit as `Claude <noreply@anthropic.com>` with the session's trailer lines. **No model names** in commits or code.
  6. **Run ALL tests** (`bash tests/run_all.sh`) before pushing to `main`. Push to `main` (`git push origin HEAD:main`)
     **and** the branch. Watch **"Build the APK"** and give him the run link.
  7. **No Wikipedia, ever** (v5.22). **Knowledge packs must be commercial-safe** (Attune is sold; §5.48): only public
     domain / CC0 / CC-BY / CC-BY-SA / government open data; no NC/ND licences. Licences live on one Credits page, not per pack.
  8. **AI stays on the phone** (12 Oct 2026, "Stay phone-only"): no cloud model and no "PC brain". Don't offer them again.
  9. Keep looking for ways to make the app smoother and the models lighter, faster and more accurate without losing quality.
  10. If the session may run out, keep this file and `HANDOFF.md` current and pushed (he asked for this on 12 Oct 2026).

## 2. What Attune is
An Android app (`com.aldibiki.attune`) that is a **private, offline AI assistant plus many tools**. It is sold through
Google Play Billing.
- **Shell:** Kotlin `MainActivity` with a WebView showing ONE self-contained page, `app/src/main/assets/www/index.html`
  (about 3.9 MB: React plus compiled Tailwind, **no CDN ever**). The page is built from `web-src/`.
- **Bridge:** `window.AttuneNative` (`NativeBridge.kt`, 105 methods). Quick calls return a string; slow calls take an id
  and answer through `window.__attuneNative.resolve/reject/progress/delta`. In the page, `nativeCall(method, arg, onProgress)` wraps the slow ones.
- **Engines on the phone:**
  - **llama.cpp `llama-server`**, built into the app (`libattune-engine.so`, pinned commit `7ab4ee7b`). It listens on 127.0.0.1 with a random key per launch and runs GGUF models.
  - **Fast engine:** LiteRT-LM (`FastEngine.kt`) running Gemma `.litertlm` on the GPU (Blaze / Blaze+).
  - **Studio:** stable-diffusion.cpp `sd-cli` as a child process, for pictures.
  - **Code sandbox:** Pyodide (Python with numpy, pandas, sympy, openpyxl) and JavaScript in Web Workers, with the network cut.
- **Model names shown to people (never vendor names):** Spark, Glow, Blaze, Core Lite, Core, Core+, Sense, Blaze+, Zenith,
  Zenith+, Apex, Apex+, Everest, Everest XL (`web-src/power.js` BRANDS). Chat **Auto** picks the best installed model,
  web Off/Auto/On and thinking per question.
- **Privacy:** an Offline lock blocks every network path, there is a network log, and nothing connects at start-up.
- **Billing:** `web-src/billing.js` and `Billing.kt` (Play Billing). Developer mode is hidden behind 7 taps on the version number and
  unlocks everything for testing. It is off for customers.

## 3. Every feature, and where its code lives (`web-src/`)
| Area | What it does | Main files |
|---|---|---|
| **Chat** (home) | Streamed answers; Auto model/web/think; attachments (many files and photos); follow-ups; 👎 teach; import a chat shared from other AIs; packs answer first, the web second | `chat.jsx`, `router.js`, `quality.js`, `reason.js`, `verify.js`, `longread.js`, `skills.js`, `tips.js`, `boost.js`, `power.js`, `ai-import.js` |
| **Web answers** | 4 engines (DDG, Bing, Brave, Mojeek) sharing an 8 s deadline; pages read in full; **fact sheet built by code** (versions, price, specs, powertrain, drive, launch); answer sized to the phone's measured speed (`timeBudget`); figures repaired and cited | `research.js`, `webrank.js`, `factsheet.js`, `answerfix.js`, `constraints.js`, Kotlin `WebTools.kt` |
| **Knowledge packs** | Offline databases (SQLite FTS) downloaded from GitHub Releases: world, cars (91k), 7 Stack Exchange Q&A packs (qa-tech, cars, home, science, life, language, code), Quran, hadith, fiqh, islamlib, math, physics, chemistry, biology, history, geography, coding, dictionary, medicines, health, laws (Egypt), economics, numbers, society, cities, cranes, wikidata (sourced facts only), plus personal packs ("Teach your model") | `knowledge.js`, `knowpack.js`, `knowledge-ui.jsx`, `teach*.js(x)`, Kotlin `KnowPacks.kt`; builders `tools/build_know_pack.py`, `tools/know_sources.py`; workflow `know-pack.yml` |
| **Maps** (look A) | Whole-country offline maps (44 countries), places from OSM + Overture (Egypt +186,939), search, add a missing place, **offline directions** (car/walk, turn-by-turn; optional route file, 430 MB for Egypt); v6.27: world overview pack `wld`; every country shown ONLINE without downloading (range reads of the free GitHub packs, `mapRange`) and its places searchable online (`-find.bin`); smart search «أقرب صيدلية» (`mapintent.js`, code first, model fallback); named compounds searchable | `map-ui.jsx`, `offlinemap.js`, `mapsearch.js`, `route.js`, Kotlin `MapPacks.kt`; `tools/build_map_pack.py`, `tools/build_route_graph.py`; workflow `map-pack.yml` |
| **Fit & Food** (an app of its own, 3 looks, default A "Fresh") | Diary (swipe a food: **Copy one food · Edit everything · Delete**), food from a sentence, a photo (fast path about 1 s, then the AI checks; amount questions) or a barcode; offline food pack (about 900k products); 25k+ recipes; plans; workouts; fasting; Ramadan; vitamins; watches (Health Connect, Huawei); widget; challenges | `fit*.js`, `fit-ui.jsx`, `fitplus-ui.jsx`, `fitlook-ui.jsx`, `foodpack.js`, Kotlin `FoodClip.kt`, `Health.kt`, `HuaweiHealth.kt`, `FitWidget.kt`; workflows `food-pack.yml`, `food-clip.yml`, `food-train.yml` |
| **Business** (an app of its own) | ERP builder (name → design → logic → data → screens); Home/Tables/Form/Reports; AI design chat; **one system for phone AND computer** (per-device layout); export as a standalone .html app; "Books" accounting (sales, purchases, stock, VAT, ETA e-invoice) | `biz-ui.jsx`, `biz-steps.js`, `erp*.js`, `erp-ui.jsx`, `erp-screens.js`, `erp-app.js`, `books*.js(x)` |
| **Money (Yusr)** | Expenses by typing or AI, recurring, bills, dashboard plus chat | `yusr/`, `myledger.js` |
| **Mind** (look C) | Everything you keep, filed by itself, smart spaces, an ask bar | `mind.js`, `mind-ui.jsx` |
| **Coding** (look B) | Task, steps and a tested program; editor; preview | `code.js`, `code-ui.jsx`, `sandbox.js`, `sandbox/` |
| **Studio** | Pictures on the phone (FLUX.2 klein 4B and others), upscale | `studio.js`, `studio-ui.jsx`, Kotlin `ImageEngine.kt`, `ImageRun.kt` |
| **Ask a PDF / PDF reader** | Chat with a PDF or book, page cited | `docqa.js`, `pdfchat-ui.jsx`, `pdfreader.js`, `multidoc.js`, Kotlin `DocTools.kt` |
| **File Converter + Translate** | 80+ conversions that keep the formatting (PDF→Word measured at 100%) | `convert.js`, `convert-ui.jsx`; bench `tests/convert/run.sh` |
| **Slides & Reports** | A .pptx or report from one sentence | `slides.js`, `slides-ui.jsx` |
| **CV / Resume** | Build, import, tailor and export (EN/AR) | `cv*.js`, `cv-ui.jsx` |
| **Learn daily / Daily news** | A lesson a day with quizzes and ready courses; morning news | `daily.js`, `daily-ui.jsx`, `langs.js` |
| **Money Guardian, Deadline Radar** (v6.27) | Finds money in your own payments (late debts, double charges, price rises, subscriptions) with an honest "saved" counter; watches free trials, renewals, returns, warranties and documents (automatic from notifications + scan/paste/by hand) | `guardian*.js(x)`, `deadlines.js`, `radar-ui.jsx`, `locale.js` |
| **What you're owed · Read it to me · Job ready** (v6.27, HANDOFF §5.69) | Flight compensation & claim letters (one sheet from Chat/Travel/Radar/Guardian) · any paper read aloud, explained, acted on (Home camera) · CV → skills, voice interview practice, job links | `owed*.js(x)`, `readaloud*.js(x)`, `jobready.js`, `cv-ui.jsx` |
| **Agent, Homework Coach, Family health, Shop in your pocket, Translate, Travel** (v6.27, HANDOFF §5.68) | Book/order from Chat (links; in-app browser that marks the best offer and fills details, stops before paying) · homework solved by code and taught with spoken, animated steps · prescriptions → doses and reminders, label-quoted interactions, labs by printed range · a shop on Books from one sentence · checked translation of text, photos and documents · Travel in Calm tabs with passport, fair-price and trip checks | `agent*.js(x)`, `AgentBrowser.kt`, `coach*.js(x)`, `lesson-ui.jsx`, `care*.js(x)`, `shop*.js(x)`, `translate*.js(x)`, `travel*.js(x)` |
| **Deal Check, Chat X-Ray** | True cost before you pay; WhatsApp chat → money, promises, unanswered questions | `deal*.js(x)`, `chatxray*.js(x)` |
| **Shelf, Skills, Assistants, Projects, Artifacts** | Notes in books; user recipes for the AI; experts; folders; saved pages | `shelf*.js(x)`, `skills-ui.jsx`, `userskills.js`, `spaces*.js(x)` |
| **Cycle, Crane toolkit, Site reports, Fleet, Reminders, Instant, Video Downloader** | As named (crane: load charts, ground, slings, wind) | `cycle.jsx`, `crane*.js(x)`, `actions*.js(x)`, `video*.js(x)`, `places.js` |
| **Engine screen** | Install/use models, speed doctor, heat, log, offline lock | `attune.jsx`, `speed-ui.jsx`, `heat.js`, Kotlin `Engine.kt`, `ModelStore.kt`, `DeviceInfo.kt` |
| **Arabic** | `tr("English")` → `i18n-ar.js` (every new UI string needs an entry; Arabic descriptions must not contain Latin letters) | `i18n.js`, `i18n-ar.js` |

`attune.jsx` (about 12k lines) is the app shell: tabs, the More menu (`MORE_TOOLS`, `MORE_GROUPS`), engine glue, `PAGE_VERSION`.

## 4. Build, test, release
1. Edit `web-src/`, then run `bash web-src/build.sh`. That writes `app/src/main/assets/www/index.html`; **commit both**.
2. Tests:
   - **All:** `bash tests/run_all.sh` takes about 30 min, so run it in the background. It prints only the lines that are not "ALL PASSED". The only acceptable lines are `e2e_v510_more.py:` and `e2e_v512_more.py:` (helper files).
   - **One e2e test:** `PYTHONPATH=tests/pwshim:tests python3 tests/e2e_x.py`. To run one while the suite is running, add `ATTUNE_ENGINE_PORT=18891 ATTUNE_PAGE_PORT=8866`.
   - **Unit tests:** `node tests/unit/x.test.mjs`.
   - **The mock phone:** `tests/harness.py` fakes `AttuneNative`. It has canned answers in `__mock.fakeQueue`, plus `leave_apps` and `to_tables`.
   - **Real models:** `tests/trials/max.mjs`. Run llama-server with `--cache-ram 0`.
   - Don't run heavy jobs while the suite runs (they cause flakes). Don't `pkill -f run_all.sh`.
3. Version bump: `app/build.gradle.kts` (versionCode/versionName) and `PAGE_VERSION` in `attune.jsx`. Then add a `HANDOFF.md` §5.x entry.
4. Push to `main`. **"Build the APK"** (`build-apk.yml`) takes about 8 min and produces the artifact `attune-apk`. Give Ali the run URL.
   Last green build: v6.23, https://github.com/alydibiky/attune-/actions/runs/38184280228
5. Data packs are built by GitHub workflows (run them by hand) and published as GitHub Releases. The phone downloads them:
   `know-pack.yml` (pick a pack), `map-pack.yml` (pick a country; Overture places plus the route file), `food-pack.yml`, `food-clip.yml` / `food-train.yml`.
   The sandbox can't reach Geofabrik, archive.org, Wikidata or Canadian government sites, but GitHub Actions can.
6. Labs (measurements only): `model-lab`, `model-bench`, `studio-lab`, `storage-lab`, `storage-boost`, `web-bench`, `arabic-cmp`.

## 5. Hard-won lessons (short list; more in HANDOFF §7)
- All model calls go through `NativeBridge.chat`, never a browser fetch (CORS). Chat history must alternate user/assistant.
- Engine flags at this pin: `--load-mode none` (`--no-mmap` doesn't exist), `-ngl 0` for CPU. mmap stays OFF (MagicOS evicts mapped pages).
  `tests/engine_args.py` checks the flags.
- Never stop the engine in `onDestroy`. Back sends the app to the background.
- Nothing may be wider than the phone (wide tables scroll inside `.overflow-x-auto`). No `content-visibility:auto`.
- For llama.cpp JSON, use a grammar, not json_schema. LiteRT has no grammar: ask for JSON in words and repair it (`jsonFrom`).
- A 2–4B phone model makes mistakes, so put code around it: verify by running code, fact sheets, votes, parsers. Be honest about the ceiling.
- Every new UI string needs an Arabic entry. Business sits in the bottom bar and hides the nav, so old tests call `leave_apps`.

## 6. What is open (by priority)
1. **DESKTOP APP — in progress (12 Oct 2026).** Ali: "like Claude and ChatGPT" and **Windows first**. See HANDOFF §5.60 and
   `DESKTOP_PLAN.md`.
   - Exists (v6.24): `desktop/`, an Electron shell — chat, models, engine, web search, knowledge packs, maps, food pack, offline lock — and the Claude/ChatGPT layout in `web-src/side-ui.jsx`. CI `desktop.yml` builds the Windows installer on every push to `main` that touches `desktop/` or the page. Done steps and what is next: HANDOFF §5.60.
   - To do, in order:
     1. A wide layout in `web-src` like Claude/ChatGPT: left sidebar with New chat, chat history and tools; content on the right; chat in a centred column.
     2. Web search on the desktop (port `WebTools.kt` to Node).
     3. Knowledge and map packs (same files, `node:sqlite`).
     4. PDFs and converters (`printToPDF`, pdf.js).
     5. hash, clipboard, speak, reminders as notifications, doctor/speed, food pack.
     6. `desktop.yml` running on `main`, and the Windows installer link for Ali.
     7. Studio pictures (`sd-cli`).
     8. Later: signing, auto-update and licence keys (these need Ali's accounts).
   - Electron 44.5.1 downloads and runs in the cloud sandbox (use `xvfb-run -a`).
2. **Web search "as strong as Gemini"** (tasks #6/#15): it is phone-only now, with the fact sheet from full pages. Still to do: a comparison template (each
   car, then a head-to-head table), per-trim tables, and measuring with a real 4B/9B model. The target is in `tests/websearch/targets/README.md`.
3. **Big features as full customisable pages** (NEXT_SESSION M-41): Learn daily, Cycle, Yusr. These are look choices, so show options first.
4. **Food photo on mixed plates** (task #45): calories right without the cloud.
5. TEST_GUIDE_2026-10-04.md §2 leftovers:
   - Studio fast preview (needs a look choice).
   - Converter polish.
   - Business: roles, multi-currency, price lists, encrypted backup.
   - Skills: a second "check" pass.
   - Ask a PDF: highlights, and keeping documents between sessions.
   - Coding: a plan-first prompt.
   - Max-testing the big models (needs a 64 GB machine).
6. **Before a public release:**
   - Play listing text (offline, private; no YouTube downloading).
   - Check the prices.
   - Developer mode must stay off.
7. Never verified on a phone (likely sources of phone-only bugs; HANDOFF §0.4):
   - The GPU paths and real speeds.
   - The widgets and notifications.
   - The Overture places and the route file on the phone (published 11–12 Oct).
   - The new Q&A packs downloaded on the phone.

## 7. Recent history in one screen (details: HANDOFF §5.44–§5.60)
| Version | Date | What |
|---|---|---|
| v6.16 | 10 Oct | Look picks: Mind C, Coding B, Maps A; 44 country maps; Knowledge packs; Islamic packs; commercial-safe audit |
| v6.17 | 11 Oct | Fit & Food as its own app; photos read printed text; Maps download fixed |
| v6.18 | 11 Oct | One amount question per photo item (93% within ±25%); Fit looks; Business as its own app |
| v6.19 | 11 Oct | A bare product name ("Lynk & Co 900") searches the web; packs don't answer for other models |
| v6.20 | 11 Oct | Answers sized to the phone's speed; the photo name bank updates itself; fried eggs on toast |
| v6.21 | 12 Oct | Maps: offline directions and Overture places; 7 Q&A packs; packs before the web; faster search |
| v6.22 | 12 Oct | Fact sheet from every page in full (the phone-only "loophole"); cars pack with Canadian data (91k); Business phone + computer |
| v6.23 | 12 Oct | Fit diary: edit name/grams/calories/macros/meal of a logged food; copy one food to any day and meal |
| v6.24 | 12 Oct | Computer layout like Claude/ChatGPT (sidebar); the Windows app gets web search, knowledge packs, maps, PDFs, reminders |
| v6.25 | 12 Oct | Back on a computer (sidebar ←, mouse back button, Alt+←, Esc); one Windows app window at a time |
| v6.26 | 12 Oct | Desktop look A + C (Home page, Tools page, pinned tools, wide pages, "computer" wording); Windows engine needs no extra Microsoft files |
| v6.27 | 13 Oct | Roadmap agreed (ROADMAP_2026-10-13.md); Brave search removed; maps without OpenStreetMap's tile servers (world overview pack); every country online without downloading, free; compounds searchable offline |
| v6.28 | 14 Oct | Insulin ↔ Fit & Food (refill + low-sugar notifications, carbs per meal); converter sub/superscripts; Studio on big models; How to use Attune; device levels; spaced repetition in Learn |

## 8. Prompt for the next session (paste as is)
```
Continue Attune. Read CLAUDE.md, then APP_HANDOFF.md (the whole app), then HANDOFF.md §5.60 (desktop, in progress)
and the newest §5.x entries. Work on branch ccr-a0eb3595-e2c7a7. Continue the desktop app (Windows first, layout like
Claude/ChatGPT) step by step from APP_HANDOFF.md §6.1, pushing each step when its tests pass, and answer anything new I
send first. Keep APP_HANDOFF.md and HANDOFF.md current. Follow every standing rule in APP_HANDOFF.md §1.
```
