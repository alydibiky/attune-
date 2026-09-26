# Attune — complete handoff for the next session

_Last updated: 26 Sep 2026 (v5.14 session). Latest: **v5.14**._

---

## 0. START HERE (read this before anything else)

### 0.1 The state you are inheriting
| Item | State |
|---|---|
| Last version on GitHub `main` | **v5.14** — pushed; Actions builds the APK on every push (artifact `attune-apk`). |
| Pushing | Works from a session that has `alydibiky/attune-` in its sources (v5.13 rebuild + v5.14 pushed from Claude Code on the web). |
| Tested on Ali's phone | v5.13 (screenshots → v5.14 fixes). **v5.14 is NOT tested on the phone yet** (Assistants, Projects, Artifacts, Themes are new). |
| Ali's latest message | Wants: fewer glitches, stronger answers, single-prompt websites, AI ERP, themes, artifacts, "gems", projects, better models. v5.14 = first round (§5.3). Next: his phone test of v5.14. |
| Recommended model | **Gemma 4 E4B** (fast engine, GPU). E2B = faster but weaker; Qwen 3.5 9B = strongest, slow (llama.cpp CPU). |

### 0.2 Your first steps, in order
1. **Get the code onto GitHub.** If `origin/main` is still `a779969`:
   ```bash
   git fetch ./attune-v5.12.bundle main:v512 && git merge --ff-only v512 && git push origin main
   ```
   (Or, if you are working in the repo that already has these commits, just `git push origin main`.)
   **Never commit `*private-key*.json`** (it is git-ignored; check `git ls-files | grep -i private-key` prints nothing).
2. **Watch the GitHub Actions run "Build the APK".** The riskiest new parts have never been through a real Android build: `DailyWidget.kt`, `res/layout/widget_daily.xml`, `res/xml/widget_daily_info.xml`, the `news()` method in `WebTools.kt` (uses `android.util.Xml`). If the build fails, fix with a targeted change.
3. **Collect Ali's problems** with the intake template in §0.3 — one row per problem, a screenshot each. Then fix them **one by one, smallest safe change first**, with a test for each (see §6).
4. Commit + push after each fix (or batch of small ones) so Actions builds a new APK for him.

### 0.3 Problem intake template (send this to Ali)
Ask him to answer like this for every problem (Arabic or English is fine):
```
Problem N:
- Where (screen/tab): e.g. Chat / Business / Learn daily / Daily news / Studio / Engine
- What I did (exact prompt or taps):
- What I expected:
- What happened instead (+ screenshot):
- Model in use (header chip, e.g. "4B eff." / Gemma 4 E4B):
- Happens every time? yes / sometimes
```
Also ask for: **Engine → Speed** screenshot, and for crashes/“not working”: **Engine → Engine log** (copy text).

### 0.4 What was never verifiable in the sandbox (likely sources of phone-only bugs)
- The **ARM/Android build** of anything native (llama.cpp engine, LiteRT-LM AAR resolve, sd-cli for Studio, OpenCL GPU paths). Only CI and the phone show these.
- **Real speeds** on the Honor (E2B/E4B GPU, Studio drawing time).
- **Home-screen widget** rendering (RemoteViews — only LinearLayout/FrameLayout/TextView etc. are allowed; a plain `View` breaks it; the layout was written to that rule).
- **Google News RSS** from the phone (`news.google.com/rss/search?q=…+when:2d`), and DuckDuckGo's `df=d` (past-day) parameter.
- **Notifications** for Learn daily / Daily news firing at the chosen time (they reuse the Reminders AlarmManager path, which is proven).
- **LiteRT (fast engine) with the new JSON-heavy prompts** (ERP design, quizzes, correction verdicts): Gemma E2B may break JSON more often than the test mock. Parsers repair JSON (`jsonFrom` in erp.js) and retry once, but real output quality is unknown.
- The **quality** of lessons/digests/ERP designs from a 2–4B model (tests use canned answers).

---

## 1. The person and how to work with him
- **Ali (Aly Aldibiki)**, Cairo, Egypt (UTC+3). Co-owns **Adrighem & Aldibiki** (cranes: Liebherr, Demag, XCMG, Sany, Grove, Terex, Zoomlion, Hitachi — 20–500 t). Works on **Windows**; tests on an **Honor Magic 8 Pro** (Snapdragon 8 Elite Gen 5, 12–16 GB RAM, MagicOS with Google services).
- Arabic (Egyptian) + English. Wants **step-by-step explanations with technical terms in English + Egyptian Arabic**, the reasoning (not just steps), and **targeted fixes, not rewrites**.
- **Standing rules he gave:** use a **task list** so he sees progress; **don't stop to ask questions unless something can't be undone**; commit + push after each feature so Actions builds an APK.
- He is **not a developer at the keyboard**: give exact taps/clicks. He builds only with **GitHub Actions**. He tests on the phone and reports with screenshots — take each point literally and answer every one.
- When pushing is impossible, give him a **bundle + zip + a paste-ready prompt** for a Claude Code session that has repo access.
- Commits: author `Claude <noreply@anthropic.com>`, message ends with the `Co-Authored-By` / `Claude-Session` trailer lines the session gives you. A stop hook complains about unpushed commits — if push is 403, say so plainly; don't loop.

## 2. What Attune is
Android app `com.aldibiki.attune` — a **fully offline AI assistant**:
- **Kotlin WebView wrapper** hosting one self-contained page `app/src/main/assets/www/index.html` (~1.7 MB; React + compiled Tailwind; **no CDN ever**) served at `https://appassets.androidplatform.net/app/www/index.html` via `WebViewAssetLoader`.
- Bridge: `window.AttuneNative` (NativeBridge.kt). Async calls: page `nativeCall(method, arg, onProgress)` → native `resolve/reject/progress/delta` on `window.__attuneNative`.
- **Two engines:**
  - **llama.cpp `llama-server`** compiled into the app (`libattune-engine.so`, pin `7ab4ee7b`), in-process on `127.0.0.1:<random>` with a per-launch API key. GGUF models (Qwen 3.5, Gemma 4) from Hugging Face.
  - **Fast engine**: `FastEngine.kt` on **LiteRT-LM 0.17.1** running `.litertlm` Gemma 4 **E2B** (2.59 GB) / **E4B** (3.66 GB) on the **GPU**. `Engine.kind` = `"llama" | "litert"`.
- **Studio**: stable-diffusion.cpp `sd-cli` as a child process (FLUX.2 klein 4B).
- **Code sandbox**: Pyodide 314.0.7 (Python 3.14 + numpy/pandas/sympy/openpyxl) and JS in Web Workers with the network cut.
- **Privacy**: offline lock blocks every network path (`Prefs.requireOnline`), network log, nothing connects at start-up.
- **Repo**: `https://github.com/alydibiky/attune-` (public). Workflow **"Build the APK"** (`.github/workflows/build-apk.yml`), artifact **`attune-apk`**, signed with the committed test key `app/attune-test.keystore` (so updates install over each other).

## 3. Where things are
```
app/src/main/java/com/aldibiki/attune/
  MainActivity.kt    WebView, asset loader (/app/www/, /studio/), withMime (.wasm/.mjs), share intents,
                     notification/widget taps (Reminders.EXTRA_ID → page 'attune-share' {kind:'reminder', id}),
                     file chooser, Back → page first then moveTaskToBack, renderer-crash recovery
  NativeBridge.kt    window.AttuneNative: info, models, install, use, restart, chat (SSE→delta), cancel,
                     search, fetchText, news (v5.12), setWidget (v5.12), hash, netLog, setAirGap, keepAwake,
                     listen/speak, share, saveFile, stashPut/Get/Del, schedule/unschedule/scheduled,
                     intent, doctor, speed/setSpeed, imageInfo/installImagePack/imagine/upscaleImage/…
  Engine.kt          llama-server start: context sizing, watchdog, memory guard, flags (see §7)
  FastEngine.kt      LiteRT-LM: GPU+vision+MTP → GPU+vision → GPU → CPU+vision → CPU; crash guard
  ImageEngine.kt / ImageRun.kt   Studio (sd-cli child process)
  Reminders.kt / ReminderReceiver / BootReceiver   AlarmManager + notifications (repeat none|daily|weekly|weekdays)
  DailyWidget.kt     (v5.12) home-screen widget: today's lesson + headline
  WebTools.kt        DuckDuckGo (+df recency) / Brave search, pageText, news() (Google News RSS + DDG past day)
  GenService.kt, PhoneActions.kt, Voice.kt, DeviceInfo.kt, ModelStore.kt, Prefs.kt, NetLog.kt, EngineNative.kt
app/src/main/res/    layout/widget_daily.xml, xml/widget_daily_info.xml, drawable/widget_bg.xml (v5.12),
                     values(-ar)/strings.xml (widget_* strings), xml/file_paths.xml
app/src/main/cpp/    CMakeLists.txt, attune-engine.cpp (JNI), fetch-llama.sh, build-image-engine.sh
web-src/             SOURCE of the page — edit here, then `bash web-src/build.sh`
  attune.jsx         the app (~10.7k lines: App component, tabs, engine glue, chatApi, MORE_TOOLS, MODE_TITLES)
  chat.jsx           Chat (Md renderer, history, routing, badges, 👎 teach + check)
  quality.js         loop detector/trim, mathToText
  verify.js          verified maths (program → run → explain), looksLikeMathProblem/CodeTask
  reason.js          vote + strict checker, analyzeFile (pandas on attached files), checkCorrection (v5.12)
  code.js, code-ui.jsx, sandbox.js, sandbox/*.mjs     Code workbench + sandbox
  studio.js, studio-ui.jsx                          Studio
  erp.js, erp-ui.jsx                                (v5.12) Business / ERP
  daily.js, daily-ui.jsx                            (v5.12) Learn daily + Daily news + notifications/widget sync
  spaces.js, spaces-ui.jsx                          (v5.14) Assistants, Projects, Artifacts (viewer + library), Themes
  actions.js, actions-ui.jsx                        reminders & phone actions (syncToPhone spares daily-* ids)
  backup.js, backup-ui.jsx, crane.js, crane-ui.jsx, cycle.jsx, calc.js, speed-ui.jsx, yusr/ (Money)
  i18n.js, i18n-ar.js                               tr("English") → Arabic dictionary (~1,800 entries)
  build/             shell.html, entry.jsx, react/reactdom shims, lucide-shim.js (icons), tw.css   ← SOURCE, not output
  fetch-pyodide.sh   Pyodide + openpyxl/et_xmlfile into www/py/ (CI runs it; not committed)
tools/erp-licence.mjs   (v5.12) keygen / issue ERP activation codes (Node 18+)
tests/               harness.py (mock phone), e2e_v3/v4/v5/v58/v59/v510(+_more)/v511/v512(+_more).py,
                     unit/*.test.mjs + unit/run.mjs, engine_args.py, image_run/, i18n_crawl.py, setup.sh
```

## 4. How to build and test
1. Edit `web-src/*`, then `bash web-src/build.sh` (Node 18+, Python 3; installs esbuild 0.28.2 + Tailwind 4.3.3 locally). Output: `app/src/main/assets/www/index.html` — **commit it** (CI checks it exists).
2. **Unit tests:** `node tests/unit/run.mjs` → 11 files, all green at v5.14.
3. **Browser end-to-end:** `bash tests/setup.sh` once (builds a desktop llama-server at the same pin + a tiny model), then from `tests/`:
   `python3 e2e_v3.py`, `e2e_v4.py`, `e2e_v5.py`, `e2e_v58.py`, `e2e_v59.py`, `e2e_v510.py`, `e2e_v511.py`, `e2e_v512.py`, `e2e_v513.py`, `e2e_v514.py` — **all green at v5.14**. Phone-sized Chromium with a mock `AttuneNative`; `chat()` hits the real tiny llama-server unless a test queues canned answers.
   Mock features (harness.py): `__mock.fakeQueue` (canned answers, streamed; skipped for warm-up requests with `max_tokens ≤ 2`), `slowQueue`, `chatCancel`, `cancelled`, `bodies` (every request body), `notes` (schedule calls — **keeps every call, not one per id**), `files` (saveFile), stash. v5.12 tests add `N.news` and `N.setWidget` mocks (`NEWS_MOCK` in e2e_v512_more.py).
4. **Kotlin compile check without an Android SDK** (dl.google.com is blocked in the sandbox): kotlinc **2.4.0** (GitHub release) + `android-35/android.jar` (sparse clone of github.com/Reginer/aosp-android-jar) + hand-written stubs for androidx, jsoup, FileProvider, InternalStoragePathHandler, LiteRT-LM (signature-exact incl. RepetitionPenaltyConfig/NoRepeatNgramConfig) and **R** (add new `R.layout/R.id/R.drawable` entries by hand when you add resources). The stub set lived in the old session's scratchpad and is **gone** — rebuild it if you change Kotlin, or rely on CI.
5. **APK:** push to `main` → Actions builds (~8+ min; longer when caches are cold) → Ali downloads `attune-apk`. If you can't push: bundle (`git bundle create x.bundle <origin-main-sha>..main`) + zip + paste-ready prompt.

## 5. Version history
- **v2** — first working APK: engine, downloads, web search, offline lock, back button.
- **v3** (after Ali's first phone test — answer never came, phone hot, "Loading" forever): Qwen 3.5 4B recommended; thinking off by default with a Think button and budget; streaming; thermal stop; Instant; Cycle; payments to Money; madhhab fixes; build-time Tailwind.
- **v4** — professional Chat home: streaming Markdown, multi-turn history budgeted to context, Copy/Regenerate/Edit/Read aloud/Share/Save, follow-ups, history drawer, on-device routing (period/payment cards), bottom bar + More sheet.
- **v5** — (1) encrypted backup/restore (`.attune`, PBKDF2 600k → AES-256-GCM, Replace/Merge, Undo); (2) Arabic interface (`tr()`, RTL, logical classes); (3) reminders & phone actions (GBNF grammar → `parseTime` → card; AlarmManager; alarm/timer/calendar/WhatsApp/call intents); (4) speed (optional OpenCL GPU `libattune-gpu.so`, speculative decoding with Qwen 0.8B draft, Engine → Speed); (5) Crane toolkit (load charts, ground pressure, slings, wind, checklist).
- **v5.6** — after "0.7 tokens/s": `--load-mode none`, GenService, warm-up, `calc.js` exact arithmetic, "Why is it slow?" doctor, WebView padding fix (page under status bar), Text size, Money full page.
- **v5.7** — **fast engine** (LiteRT-LM, Gemma 4 E2B/E4B on GPU), Kotlin plugin 2.4.0.
- **v5.8** — **Code workbench** (tests written + run + SEARCH/REPLACE fixes; Pyodide sandbox; `--spec-type ngram-mod`).
- **v5.9** — **Studio** (FLUX.2 klein 4B via sd-cli; edit by instruction; Real-ESRGAN ×4).
- **v5.10** — fixes after Ali's fast-engine test: scrolling/black screens (removed `content-visibility:auto`), nothing wider than the phone, follow/↓ button, keyboard/composer, anti-loop sampling + live loop guard, LaTeX → plain text, **verified maths** (program run on phone), coding requests through the workbench, photo context carried into follow-ups, web answers say what sources DO show, Studio Q8_0 on ≥12 GB.
- **v5.11** — self-consistency vote + strict checker for reasoning; learning from 👎 corrections in Chat (few-shot, `attune:learned:v1`); 📎 files in Chat computed with pandas on the phone (openpyxl bundled).
- **v5.12** — see §5.1.
- **v5.13** — fixes from the first v5.12 phone test — see §5.2.
- **v5.14** — Ali's screenshots after v5.13 + Assistants, Projects, Artifacts, Themes — see §5.3.

### 5.1 v5.12 in detail (the part nobody has tested on the phone yet)
- **Corrections checked before learning** (`checkCorrection`, reason.js; UI in chat.jsx `checkTeach/saveTeach`): 👎 → "Check & teach". Maths question → `verifyMath(..., explain:false)` computes the answer, compared by number (±0.5%). Otherwise 2 independent re-solves (temp 0.2 / 0.7; a 3rd at 0.5 if they disagree) returning `VERDICT: RIGHT|WRONG|PARTLY|PREFERENCE` + `REASON:` + `ANSWER:`. RIGHT/PREFERENCE → saved (`checked` field). WRONG/PARTLY/unsure → reason box (`data-testid=teach-verdict`) with "Learn the checked answer" (partly), "I'm sure — learn mine anyway" (`teach-force`), "Edit my correction".
- **Business / ERP** (More → Business): `erp.js` (pure, unit-tested) + `erp-ui.jsx`.
  - Storage: `attune:erp:v1` (index) + `attune:erp:v1:<systemId>` (whole system). Included in backups automatically (all `attune:*` keys).
  - Model: system `{id, name, currency, tables[{id,name,fields[{id,name,type,options?,link?,formula?,prefix?,required?}]}], rows{tableId:[{_id,_ts,<fieldId>:value}]}, history[15 snapshots], licence}`. Everything by **id**, so renames never lose data.
  - Field types: text, longtext, number, money, date (ISO; reads dd/mm/yyyy and Excel serials), bool, choice, link (to a record of another table; matched by any text field), phone, email, auto (prefix + 4-digit pad, e.g. `JOB-0001`), formula (Access-style `[Days] * [Daily rate]`; functions ROUND, DAYS, MIN, MAX, ABS, IFEMPTY; stored as `{fieldId}`; safe recursive-descent parser, no eval; cycles → blank).
  - Design ops (`applyOps`): addTable, renameTable, deleteTable (links → text), addField, renameField, deleteField (refused if a formula uses it), changeType (converts values, reports how many were cleared; text→choice makes choices from existing values), setOptions, moveField, setRequired, setFormula. Every op list is dry-run first in the UI and shown before **Apply**. **Undo** restores the last snapshot.
  - AI: `designMessages` (whole design as JSON, with an example), `changeMessages` (current design described → `{"ops":[…]}`), `recordMessages` (fill one record from a sentence). `jsonFrom` repairs trailing commas, bare keys, single quotes; `normalizeSpec` maps type synonyms.
  - Templates: crane rental (Customers, Equipment, Jobs with Days/Total formulas, Invoices with Balance, Maintenance, Crew), shop, contracting, restaurant, blank.
  - Data tab: search, tap-header sort, totals row + a visible totals line; record form per type; delete needs a second tap and warns about linked records. Summary: group by + sum. More: licence, import CSV/TSV/xlsx (xlsx through Pyodide pandas) as a new table (types guessed) or into the current table, CSV export (UTF-8 BOM), whole-system JSON export/import, rename/delete system.
  - **Licence (paid per system):** trial = `FREE_ROWS = 30` records per table; design always free. Code format `ATT1.<base64url JSON {s: "ERP-…", p: plan, i: issued}>.<ECDSA P-256 SHA-256 signature>`, verified with WebCrypto against `LICENCE_PUBLIC_KEY` in erp.js. Issue codes: `node tools/erp-licence.mjs issue <private-key.json> ERP-XXXX`. **The private key is NOT in the repo** (Ali has `attune-erp-private-key.json`; git-ignored). Lose it → `keygen` again → put the new public key in erp.js → old codes stop working. `SELLER = { price: "", contact: "" }` in erp.js is still empty — Ali must fill it. If sold via Google Play, digital unlocks must use **Play Billing** — the code scheme is for direct/B2B sales.
- **Learn daily** (More → Learn daily; `daily.js` + `daily-ui.jsx`, storage `attune:daily:courses:v1`):
  - Course `{topic, level, lang en|ar, goal, time HH:MM, quizEvery, plan[~30 titles], lessons[], quizzes[], review[], streak}`.
  - Plan: model returns JSON `{title, lessons[]}` (a numbered list is accepted too). Each lesson: Markdown + a final ```json block `{visual, keyPoints}`; `visual.kind` ∈ table | steps | cards (flip) | compare | bars | timeline — **drawn by the app** (`Visual` component), not by the model.
  - After "I've read it", tomorrow's lesson is generated right away so the notification can name it. "One more today" lets him go faster.
  - Quiz when `quizEvery` lessons are done since the last quiz: 5 MCQs JSON; invalid ones dropped; options shuffled with a seeded RNG. Missed questions → `review` → the next lessons open with a "Quick review" (spaced repetition).
- **Daily news** (More → Daily news; storage `attune:daily:news:v1`):
  - Topic `{query, lang, time, digests[7]}`. On open (or on notification tap) → native `news` → `WebTools.news`: Google News RSS search (`when:2d`, dated headlines + publisher) + DuckDuckGo past-day (`df=d`) with the top 3 pages read.
  - `mergeNews`: newest first, drops > 36 h, already-seen URLs/titles from earlier days, same-story duplicates (title word overlap).
  - `digestMessages`: only the gathered articles, neutral wording, `[n]` on every bullet, "NOTHING NEW" if none fit. `checkCitations` removes citations to non-existent sources and flags unsourced bullets.
- **Notifications + widget**: `syncDaily` (daily-ui.jsx) schedules one repeating notification per course/topic (`daily-learn-<id>`, `daily-news-<id>`, `repeat: "daily"`), refreshing the body with the next lesson title / today's headline; `syncToPhone` (reminders) leaves `daily-*` ids alone. Tap → `attune-share {kind:'reminder', id}` → App routes to Learn/News (`dailyOpen`). Widget: `NATIVE.setWidget(json)` → `DailyWidget.save` → SharedPreferences `attune_widget` → RemoteViews; rows open the same ids.
- New icons in lucide-shim.js: Database, ArrowUp, ArrowDown, Undo2, Upload, GraduationCap, Newspaper, KeyRound, BarChart3.
- MORE_TOOLS order now: Instant, Studio, **Learn daily, Daily news, Business**, Code, Crane toolkit, Reminders, Memory, …


### 5.2 v5.13 — fixes from Ali's first v5.12 phone test (25 Sep 2026)
Ali's report (screenshots) → cause → fix. All covered by `tests/e2e_v513.py` + `tests/unit/v513.test.mjs`.
- **Tables/code blocks trap vertical swipes** → `overscroll-behavior: contain` on horizontal scrollers (a sideways scroller is also a y-scroller to Chromium). Now `overscroll-behavior-x: contain; -y: auto; overflow-y: hidden` on `pre, .overflow-x-auto, .att-hscroll, .att-chips, .att-tabs` (shell.html).
- **Empty code box + code as plain text** → the Code-workbench streaming preview wrapped the model's own ```` ```python ```` in a second fence. Preview strips it (chat.jsx `livePreview`); Md only closes a block on a BARE fence and drops a doubled opening fence. New `CodeBox` (language label, Copy → "Copied"). `_x_` italics only at word boundaries (`second_largest_distinct`).
- **Wrong digits ("10,0400", "June 200005", "LTM 12000")** → plain `repeat_penalty 1.05` punishes repeated digit tokens. Now `repeat_penalty = 1.0`; loops still stopped by DRY + no_repeat_ngram + live guard.
- **Long answers stop** → max_tokens 900 → 2048 (3072 long answers); history budget `(ctx-4300)*2`. Cut answers (`tokens >= max_tokens-3`) get **Continue ▸** which carries on in the same bubble (`continueAnswer`).
- **Wrong sums (rent 25,000 × 4 = 10,000; VAT 4%)** → (a) money/rent/VAT/days questions now count as word problems (`looksLikeMathProblem`); (b) `arithmeticSlips()` recomputes every `a op b = c` in an ordinary answer; any slip → the question is re-done through `verifyMath` (note "The first answer had a wrong sum — re-done by running code").
- **"Working it out as a program…" looked stuck** → Python warms up while the program is written (`warm`), phase shows "Writing the program…" and a live seconds counter (`Elapsed`).
- **English question → Arabic answer** → `langHint()` adds "(Write the reply in English.)" / Arabic equivalent from the CURRENT message (chat, verify, vote routes).
- **Web: "Android 6, June 200005"** → grounded prompt has today's date, "latest = highest version/most recent date", "copy numbers exactly"; `groundedAudit` in Chat → one re-answer if a number isn't in the sources; leftover flagged "Not found in the sources".
- **Load-chart photo (20 m → "0 m, 722 t")** → table-lookup questions about a photo make the model copy the exact row + headers first; answer carries "check against the chart". Honest ceiling: dense charts in a photo are at the edge of a 4B vision model.
- **Attendance `.xls` → "Could not open the file:" (empty)** → the error's last NON-empty line is shown; `FILE_PRELUDE.load_sheets()` reads real xls (xlrd 2.0.1 added to fetch-pyodide.sh, sha256 pinned), xlsx, csv/tsv, and ".xls" files that are really HTML tables or cp1256 text (common exports), skipping title rows; `pd.read_excel/read_csv` are patched to fall back to it. If computing fails, the model gets the file preview instead of nothing.
- **Business "didn't produce a usable design"** → JSON answers were being cut by the loop guard / n-gram ban (fields like "Phone" legitimately repeat). `strict` requests (JSON / code-only system prompts, `o.json`) skip loop guard + anti-repeat. Fallbacks: line format (`designLinesMessages` / `specFromLines`) → closest template (`guessTemplate`).
- **Learn daily "Daily notification" one letter per line** → `w-full` beat `w-28` on the time box. `fieldFixed` + wrapping row.
- **Studio stuck "Loading the picture model…" 4 min** → GPU driver can hang without failing. Watchdog in `ImageEngine.runWithFallback`: no output 150 s (or >5 min in start/load) → abort GPU, draw on CPU, remember (`setCpuOnly`). Stop button no longer wraps.
- **Paste shows only after Enter / black patch on composer / tab-out glitches** → removed `setLayerType(LAYER_TYPE_HARDWARE)` on the WebView; `onResume` → `postInvalidate` + `attune-resume` event (page repaints + re-reads the text box); `onPaste`/`onInput` handlers; composer on its own layer.
- **Chats lost / "No chats yet"** → saves failed silently when storage was full of photos. `saveChats` now degrades (drops photos from older chats, then all, then oldest chats); saves on `attune-pause`/`visibilitychange`/`pagehide`; `saveIfOurs` never overwrites storage someone else changed (backup restore).
- **Ali: no period tracker on the home screen** → bottom bar is Chat · Instant · Money · **Business** · More; Cycle only in More; "Log my period" starter replaced.
- UI: messages/screens fade in (`att-in`/`att-msg`, reduced-motion respected), zebra tables, smooth ↓, new screen opens at its top.

### 5.3 v5.14 — Ali's screenshots after v5.13 + Assistants, Projects, Artifacts, Themes (26 Sep 2026)
Covered by `tests/e2e_v514.py` + `tests/unit/v514.test.mjs`.
- **Web follow-up "What model" searched the bare words** (dictionary pages) → `looksLikeFollowUp` (spaces.js): short or pointing-back messages are first rewritten by the model into one standalone search query from the last turns (+ the carried photo), and the grounded prompt gets the full question. chat.jsx `ask()`.
- **"What is this crane" → "This is a mobile crane."** → system prompt: answers lead with a bold direct answer, then useful bullets; comparisons get a verdict + table (Gemini-like, Ali's reference screenshot). Photo of a machine/product → type, likely make/model from visible clues, confidence, 3–5 facts. Grounded (web) answers use the same shape.
- **"1.1 tokens/s — unusually slow" on a 6-token photo answer** → speed not shown under 16 tokens; the slow hint needs ≥ 40 tokens (a tiny answer can't be measured; the image read dominates).
- **Composer covered the last answer's buttons/chips** → the chat's bottom padding follows the composer's measured height (ResizeObserver), not a fixed 176 px; the ↓ button follows too.
- **Crane Simulator opened with 10 "Lowered hook" log lines** → the writer told EVERY program to include "a short demo"; web pages now have their own brief (`HTML_BRIEF`, code.js): clean first state (no demo on load), finished design (palette, cards, dark mode, 44 px targets), real content, SVG/canvas for visuals, localStorage state; 4000 tokens.
- **Assistants** (More → Assistants; like Gems): built-ins (Crane expert, Turkish tutor, Website builder, Accountant (Egypt), Writer) + your own (name, emoji, one-line description, instructions — "Write them for me" drafts them — starter questions). Storage `attune:assistants:v1` (custom only). A chat carries `assistantId`; its instructions are appended to the system prompt (`spaceBlock`). The vote route is skipped inside an assistant (it ignores the role).
- **Projects** (More → Projects): name, emoji, instructions, knowledge (pasted notes / text files ≤ 1.5 MB), its chats. Storage `attune:projects:v1`. Chat carries `projectId`. `knowledgeFor` splits files into ~900-char passages and sends only those matching the question (word overlap, Arabic-normalised), ≤ 3,500 chars; a small project goes whole.
- **Artifacts**: `detectArtifact` finds a web page (```html), a program (≥ 15 lines) or a long structured document (≥ 900 chars with headings/table/lists) in an answer → a card under it → full-screen `ArtifactViewer` (sandboxed iframe for pages, Preview/Code, versions, "Change it…" via SEARCH/REPLACE edits or a full rewrite, Save, Copy, Share, File). Library: More → Artifacts. Storage `attune:artifacts:v1` (≤ 60 items, 10 versions; degrades when storage is full).
- **Themes** (More sheet): 8 accent colours × Midnight / Black (OLED) / Graphite / Warm / Light. Works by overriding Tailwind 4's `--color-*` variables on `<html>` (`themeVars`/`applyTheme`); Light flips every scale 50↔950 and swaps white/black. `attune:theme:v1`. shell.html body background follows `--color-slate-950`.
- **Models (researched Sep 2026):** nothing phone-sized clearly beats Gemma 4 E4B / Qwen 3.5 4B for Arabic + photos. LFM2.5-8B-A1B (MoE, ~1.5B active) is fast and ≈ a 3–4B dense model, text-only — not added (huggingface.co is blocked from the sandbox, so file names could not be verified; Engine → custom install takes `repo:QUANT` if Ali wants to try it).
- **Studio "loading the model forever"** (Ali, v5.13): (1) `gpuDevice` read `--list-devices` output BEFORE its 20 s timer, so a hanging OpenCL driver blocked forever; now a reader thread + 120 s timeout (first Adreno kernel compile is slow), a timeout is not remembered (next picture retries the GPU), stage `gpu` shown ("Waking the graphics chip…"). (2) A finished `#` loading bar now moves the stage to `prompt` — the screen no longer sits on "Loading… 100%" while the text encoder and first step run. (3) CPU runs got a watchdog (no output 20 min → clear error) and are drawn at ≤ 768 px on the long side. (4) After 90 s Studio says it is still working and how long the CPU takes. Kotlin not compile-checked in the sandbox — CI is the check.
- e2e_v4's formatting prompt changed (money questions now take the checked route since v5.13).
- Sandbox note: this container's Playwright wanted chromium-1243 but /opt/pw-browsers has 1194 — run the e2e tests with a `sitecustomize.py` that sets `executable_path="/opt/pw-browsers/chromium"`, and `pip install openpyxl` for e2e_v511.

## 6. How to fix Ali's problems well (method)
1. Reproduce in the browser harness first if it's a page bug (most are). Write the failing check into the matching e2e file (or a new `e2e_v513.py`), then fix, then run **all** suites — earlier tests catch regressions (v5.12 broke two old tests just by adding the word "reminders" to a More-menu description).
2. Phone-only bugs (engine, GPU, widget, notifications, downloads): ask for the Engine log; reason from the Kotlin; make the smallest change; add a note to §0.4.
3. Model-quality complaints: prefer code around the model (verify by running code, vote/check, better prompts, stricter parsing) over "use a bigger model". Be honest when the ceiling is the model.
4. Keep answers to Ali bilingual for technical terms, step by step, and give him a test prompt for each fix.

## 7. Hard-won lessons (do not repeat)
- **CORS:** `Access-Control-Allow-Headers: *` doesn't cover `Authorization`. All model calls go through `NativeBridge.chat`, never browser fetch.
- **Page path** `/app/www/` (escapes an old service worker). In the app, service workers are unregistered and caches deleted.
- **Engine:** OpenMP OFF on Android; minSdk 28; `GGML_BACKEND_DL` + `GGML_CPU_ALL_VARIANTS`; `useLegacyPackaging = true`. Flags that exist at this pin: `--load-mode none` (**`--no-mmap` no longer exists**), `-ngl 0` for CPU (default is auto-offload!), `--spec-type ngram-mod` (or `draft-simple,ngram-mod` with a draft; `-md` alone does nothing). `tests/engine_args.py` checks every Engine.kt flag against the real server.
- **Never stop the engine in `onDestroy`** (stop/start race → "Loading…" forever). Back sends the app to the background.
- **Chat history must alternate user/assistant**; only complete pairs are sent.
- **No CDN, ever**; esbuild pinned 0.28.2 for byte-identical builds.
- **`web-src/build/` is SOURCE** (root .gitignore uses `/build/` + `app/build/` + `!web-src/build/`).
- **Release signing:** always `app/attune-test.keystore`. Never the per-run CI debug key.
- **Grammar, not json_schema,** for llama.cpp JSON (json_schema gets a prefill). LiteRT has no grammar: ask for JSON in words and repair it (`jsonFrom`).
- **Layout:** no `content-visibility:auto` (blank sections in the Android WebView). Nothing may be wider than the phone — wide tables scroll inside `.overflow-x-auto`. Composer z-40, z-60 only while typing. Blur delayed 300 ms.
- **Loops:** repeat_penalty 1.05 + DRY 0.8/4 + no_repeat_ngram 24; temperature 0.5 (0.3 loops more on Gemma). Loop guard is off for grammar/JSON requests.
- **Test mock:** a canned answer must abort the real engine request; warm-up requests (`max_tokens ≤ 2`) must not consume `fakeQueue`; `__mock.notes` keeps every schedule call — dedupe by id in tests. `innerText` of a form includes `<option>` text — wait on input values, not on text.
- **i18n:** every new UI string goes through `tr()` and gets an `i18n-ar.js` entry; the Arabic More-menu test fails if a description contains Latin letters (e.g. "ERP") — write Arabic-only descriptions. `tests/i18n_crawl.py` lists gaps.
- **RemoteViews:** no plain `View` in widget layouts (use FrameLayout/ImageView).
- **sd-cli:** `-M upscale` exits 0 and saves the ORIGINAL if the upscaler fails — check the output is 4× wider.
- **Honest ceiling:** a 2–4B phone model is fast but makes reasoning/format mistakes; that is why answers are checked by code, votes and parsers. Weights never change on the phone — "learning" is few-shot examples; real fine-tuning (LoRA) needs a PC/GPU and ~200+ corrections.
- **Pushing:** if `git push` returns 403 "not in this session's authorized repository set", no command will fix it — deliver a bundle + zip + paste-ready prompt, or ask Ali to add the repo to the session's sources.

## 8. Backlog (not started)
- Whatever Ali reports next (§0.3) — **top priority**.
- Fill `SELLER.price/contact` (Ali's price + WhatsApp); optional Play Billing for ERP licences.
- ERP: printable invoice/quote PDFs from records (ETA e-invoice format), per-table forms layout, relations shown as sub-lists (e.g. a customer's jobs), multi-user sync (would need a server — discuss with Ali first).
- Learn daily: Studio picture per lesson automatically when Studio is installed; audio pronunciation via TTS for language lessons.
- Daily news: prefetch at the notification time (needs a WorkManager job + model in background — heavy; current design gathers on open).
- Translate the Travel country packs; Arabic Android-side error messages.
- Whisper Egyptian-Arabic voice; "Ask your documents" (on-device RAG); fingerprint lock for Money/Cycle; crane chart import from a photo.
