# Attune — complete handoff for the next session

_Last updated: 4 Oct 2026 (v6.12, §5.40). Earlier: 29 Sep 2026. Latest: **v6.9** on `main` (versionCode 71; §5.37) — Mind, every model one RAM tier lower, max tests of every model up to Zenith+, web search accuracy/speed, file converters that keep formatting, coding fix-loop probes. **Ali's open problem list after testing v6.9 on his phone is in `NEXT_SESSION.md` — start there.**_

---

## 0. START HERE (read this before anything else)

### 0.1 The state you are inheriting
| Item | State |
|---|---|
| Last version on GitHub `main` | **v6.9** (versionCode 71; §5.37). Last green APK build: https://github.com/alydibiky/attune-/actions/runs/36567802881 (artifact `attune-apk`). Every push to `main` runs "Build the APK" (~8 min). Older: v6.7 (§5.36), v6.6 (§5.35), v6.5 (§5.34), v6.4.1, v6.4 … the 6.1 launch build (§5.28). |
| Pushing | Works: this session pushed v5.32 → v5.39 straight to `main` (Ali's rule: push to main, then watch the build and give him the run link). |
| Tested on Ali's phone | Up to v5.40 (his 15-point report → v5.41). **Fit & Food, the Deal Check question, the fast ×2 sharpen (native `sharpenFast`), website continuation, Business "Combine your data" and the 6.1 model list are NOT phone-tested yet.** |
| Ali's latest requests (all done) | "as many file converters as you can" (§5.23), "copy a link of a video and download it in the quality I want" (§5.24 — he chose **safe sites only**, no YouTube/TikTok), "take a PDF, translate it, give me the PDF" (§5.25). |
| Models | Engine catalog uses Attune names only (Spark · Glow · Blaze · Core… · Blaze+ · Zenith · Apex · Everest — §5.18). Blaze / Blaze+ = LiteRT fast engine on the GPU (recommended on his Honor). Vendor names (Qwen/Gemma) must never show. |
| Billing | `web-src/billing.js`: **`TESTING_ALL_PRO = true`** (Ali asked for every Pro feature unlocked while testing; the Plan screen has a "See it as a Free user" toggle). Prices EGP 199 / 1,499 / 3,999, $4.99 / $39.99 / $99. Free limits: Deal Check 3/day, Chat X-Ray 1/day, conversions 5/day, video downloads 3/day. |
| Open items for release | 1) `SELLER.contact` (Ali's WhatsApp) in billing.js; 2) set `TESTING_ALL_PRO = false`; 3) never commit `*private-key*.json`; 4) Play listing must not mention YouTube downloading. |
| Ali's PC (for future model training) | Windows, RTX 3050 **8 GB**, 16 GB DDR4-2666 (Crucial CB16GU2666 laptop-type stick). Advised: add a matching stick or 2×16 GB DDR4-3200 (runs at 2666 on his board). LoRA-tuning Spark/Glow/Blaze-size models is feasible there; ~4B is tight. Plan was given in chat (§5.19); nothing started. |

### 0.2 Your first steps, in order
1. `git pull` and read §1 (how Ali works), §6 (method), §7 (lessons). Standing rules are in §1.
2. Set up tests once: `bash tests/setup.sh` (desktop llama-server + tiny model), `pip install python-docx openpyxl python-pptx` (real-file checks), `cd web-src && npm i` is done by build.sh.
3. **Run everything before any push:** `bash tests/run_all.sh` (≈25 min — run it in the background). It prints only lines that are not "ALL PASSED". Acceptable output: `e2e_v510_more.py:` and `e2e_v512_more.py:` (helper modules, print nothing). `tests/audit.txt` = every More tool in EN/AR checked for overflow, JS errors and untranslated English; known-OK leftovers: brand/format names (PDF, JSON, Movies, Midjourney…), random codes (PRO-XXXX, fleet ids), `ERR_TUNNEL_CONNECTION_FAILED` (the sandbox blocks outside hosts).
4. Collect Ali's problems with §0.3, fix one by one (smallest safe change), add a test for each, bump the version (`app/build.gradle.kts` versionCode/versionName + `PAGE_VERSION` in attune.jsx), add a §5.x entry, commit, push to `main`, watch the run (GitHub MCP `actions_list` / `actions_get`; on failure `get_job_logs` with `failed_only`), and give Ali the run link.

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
- **v5.37–v5.39 on a real phone:** PdfBox-Android text extraction (esp. Arabic PDFs — some store letters in visual order), `makePdf` Arabic layout, `pdfEdit` merge/split on big files (all in memory — a 200 MB PDF may run out), DownloadManager saving to Movies/Attune (Android 9 falls back to the app folder), `clipboardText` on MagicOS, the WebView canvas for WebP output, and how long the phone model takes to translate a 20-page PDF (unknown; batches of ≤ 1,500 characters).

---

## 1. The person and how to work with him
- **Ali (Aly Aldibiki)**, Cairo, Egypt (UTC+3). Co-owns **Adrighem & Aldibiki** (cranes: Liebherr, Demag, XCMG, Sany, Grove, Terex, Zoomlion, Hitachi — 20–500 t). Works on **Windows**; tests on an **Honor Magic 8 Pro** (Snapdragon 8 Elite Gen 5, 12–16 GB RAM, MagicOS with Google services).
- Arabic (Egyptian) + English. Wants **step-by-step explanations with technical terms in English + Egyptian Arabic**, the reasoning (not just steps), and **targeted fixes, not rewrites**.
- **Standing rules (latest, all still in force):** never commit `*private-key*.json`; never change the signing key `app/attune-test.keystore`; targeted fixes, no rewrites; explain each step simply with technical terms in English **and Egyptian Arabic**; commit as `Claude <noreply@anthropic.com>` with the session's Co-Authored-By / Claude-Session trailer lines; **run all tests before pushing**; push to `main` and give the Actions run link; no model names/identifiers in commits or code; "don't forget anything I asked for" — answer every point he raises.
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
  DocTools.kt        (v5.36–37) PdfBox-Android pdfText, PdfRenderer pdfImages, PdfDocument makePdf, pdfEdit (merge/split/pick/rotate)
  MediaTools.kt      (v5.38) video link probe / getText / DownloadManager download, status, open, cancel
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
  skills.js                                         (v5.15) answer recipes per question type
  erp-app.js                                        (v5.18) Business system → standalone .html app and back
  webrank.js, guard.jsx                             (v5.19) web passage ranking; screen error boundary
  research.js                                       (v5.20) deep web research: notes per page, missing-check
  actions.js, actions-ui.jsx                        reminders & phone actions (syncToPhone spares daily-* ids)
  backup.js, backup-ui.jsx, crane.js, crane-ui.jsx, cycle.jsx, calc.js, speed-ui.jsx, yusr/ (Money)
  boost.js, power.js                                (v5.23–26) sampling/tricks per model family; Attune model names (BRANDS, publicName, labelFor)
  longread.js                                       (v5.27) any-length message/file answered in parts
  tips.js                                           (v5.29) 200+ tips, picked per question
  confirm.jsx                                       (v5.28) askConfirm() before deletes
  billing.js                                        prices by region, Pro codes, trial, TESTING_ALL_PRO / testingPro(), PRO_BENEFITS
  answerfix.js, constraints.js, factsheet.js        (v5.32–34) web-answer repair (figures, tidyAnswer), writing rules checked by code, facts sheet under web answers
  places.js                                         (v5.32) Instant → Google Maps search link
  backstack.js                                      (v5.34) useSubBack: inner pages close one step on Back
  deal.js, deal-ui.jsx                              (v5.33) Deal Check (true cost, IRR, market price, scam signs)
  chatxray.js, chatxray-ui.jsx                      (v5.35) Chat X-Ray (WhatsApp export → ledger, promises, unanswered)
  convert.js, convert-ui.jsx                        (v5.36–39) File Converter + Translate (docx/xlsx/pptx/odt/ods/epub/html/rtf/json/srt; see §5.23, §5.25)
  video.js, video-ui.jsx                            (v5.38) Video Downloader (link reading; see §5.24)
  slides.js, slides-ui.jsx                          (v5.40) Slides & Reports: .pptx writer, slide layout → shapes, canvas preview, reports → Word/PDF (§5.26)
  fit.js, fit-foods.js, fit-ui.jsx                  (v5.42) Fit & Food: food table, meal reading, plan, meal plans, workouts, recipes (§5.28)
  fitdb.js                                          (v6.1.1) Open Food Facts + USDA search, barcodes, the phone's food copy (§5.29)
  fitplus.js, fitplus-ui.jsx                        (v6.2) Fit level 2: quick logging, quality, Ramadan, body fat, week plan, score, report (§5.30)
  i18n.js, i18n-ar.js                               tr("English") → Arabic dictionary (~1,800 entries)
  build/             shell.html, entry.jsx, react/reactdom shims, lucide-shim.js (icons), tw.css   ← SOURCE, not output
  fetch-pyodide.sh   Pyodide + openpyxl/et_xmlfile into www/py/ (CI runs it; not committed)
tools/erp-licence.mjs   (v5.12) keygen / issue ERP activation codes (Node 18+)
tests/               harness.py (mock phone), e2e_v3/v4/v5/v58/v59/v510(+_more)/v511/v512(+_more).py,
                     unit/*.test.mjs + unit/run.mjs, engine_args.py, image_run/, i18n_crawl.py, setup.sh
```

## 4. How to build and test
1. Edit `web-src/*`, then `bash web-src/build.sh` (Node 18+, Python 3; installs esbuild 0.28.2 + Tailwind 4.3.3 locally). Output: `app/src/main/assets/www/index.html` — **commit it** (CI checks it exists).
2. **All tests at once:** `bash tests/run_all.sh` (unit + every e2e + screen audit, ≈25 min; results in `tests/results.txt`, audit in `tests/audit.txt`). All green at **v5.41** (unit v513…v541 + older files; e2e v3…v541).
   - Unit only: `node tests/unit/v539.test.mjs` (plain Node 22 runs them; `node tests/unit/run.mjs` bundles with esbuild first).
   - One e2e: `PYTHONPATH=tests/pwshim python3 tests/e2e_v539.py` (`pwshim` points Playwright at `/opt/pw-browsers/chromium` in cloud sessions).
3. **Browser end-to-end setup:** `bash tests/setup.sh` once (desktop llama-server at the same pin + a tiny model). Phone-sized Chromium with a mock `AttuneNative` (harness.py); `chat()` hits the real tiny llama-server unless a test queues canned answers.
   Mock features (harness.py): `__mock.fakeQueue` (canned answers, streamed; skipped for warm-up requests with `max_tokens ≤ 2`; each LLM call takes one), `slowQueue`, `chatCancel`, `cancelled`, `bodies` (every request body), `notes` (schedule calls — keeps every call), `lastSaved` (saveFile), stash. New native calls are mocked per test by assigning `window.AttuneNative.<name> = (id, arg) => …` and resolving through `window.__attuneNative.resolve(id, JSON)` (see e2e_v536/v537/v538). The harness starts with `attune:testing-pro = off` so Free limits are testable.
   Real-file checks (unit v536/v537) need `pip install python-docx openpyxl python-pptx` (skipped if missing). LibreOffice is broken in the sandbox; odfpy doesn't install.
4. **Kotlin compile check without an Android SDK** — in practice this session relied on CI: verify library class/method names with `javap` on the downloaded AAR's classes.jar (done for pdfbox-android 2.0.27.0), then push and read the build log; (dl.google.com is blocked in the sandbox): kotlinc **2.4.0** (GitHub release) + `android-35/android.jar` (sparse clone of github.com/Reginer/aosp-android-jar) + hand-written stubs for androidx, jsoup, FileProvider, InternalStoragePathHandler, LiteRT-LM (signature-exact incl. RepetitionPenaltyConfig/NoRepeatNgramConfig) and **R** (add new `R.layout/R.id/R.drawable` entries by hand when you add resources). The stub set lived in the old session's scratchpad and is **gone** — rebuild it if you change Kotlin, or rely on CI.
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
- **v5.15** — answer recipes (skills.js) — see §5.4.
- **v5.16** — type while it answers (queue), smarter follow-ups, lighter streaming — see §5.5.
- **v5.17** — Ali's v5.16 phone test + Business queries/forms/rename + Copilot + versioning — see §5.6.
- **v5.18** — doubled words/digits (MTP off), junk-loop guard, websites on topic, Studio never silent, Business apps exported/imported — see §5.7.
- **v5.19** — web reads whole pages + passage ranking, Studio stray-cancel fix, connected ERP designs, screen error boundary — see §5.8.
- **v5.20** — deep web research (page by page → checked notes → missing → full answer), every Studio failure path covered — see §5.9.
- **v5.21/v5.22** — Ali: **NO information from Wikipedia at all.** Searches are sent with `-site:wikipedia.org` (WebTools `NO_WIKI`, also Brave and Daily news), any Wikipedia URL is dropped natively (`isWiki`), again in `webLookupRaw` and in `rankPassages`; the keyless Wikipedia lookup (`wikiLookup`/`keylessLookup`) is deleted. Never add Wikipedia back as a source.

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

### 5.4 v5.15 — answer recipes ("teach the model some lines of code")
Ali asked for code that makes the models stronger. Weights can't change on the phone, so `skills.js` matches each question (English + Egyptian Arabic patterns; Arabic uses an explicit space/punctuation lookahead because JS `\b` ignores Arabic letters) to at most ONE short recipe — translate, email, compare (verdict + table), steps, explain (bold answer → how it works → example), list, plan, summary — appended to the USER turn (not the system prompt, so llama.cpp's prompt cache still hits). Skipped for maths/code/web/photo/file routes, which have their own checked shapes. `extra.skill` records which recipe was used. Tests: `unit/v515.test.mjs`, e2e_v514 §3b.
- Bug found by the new test: after tapping "+" once, opening Chat again re-fired the old new-chat signal and wiped an assistant/project chat just picked. ChatHome now reacts only to a CHANGED `newChatSignal` (`seenSignal` ref).

### 5.5 v5.16 — type while it answers, follow-ups, less work while streaming
- **Queue** (Ali: "enter the prompt while you're answering, then read it and add it"): Send while busy (composer or Enter) no longer stops the answer — the text goes to `queued` (shown under the answer, dashed, "Waiting — read when this answer is done", **Send now** = stop + send, ✕ remove). When `busy` turns false (done OR stopped) the queue is joined and sent with `queuedDuring`, which tells the model it arrived during the last answer and to write the complete UPDATED answer if it changes/extends it. Photos/files while busy keep the old stop-and-send. Queue clears when the chat changes.
- **Follow-ups**: chips depend on the answer (`msg.skill` from skills.js, photo → "Exact model?"/"Specifications", compare → "Which should I choose?"/"Price difference", steps, explain, email, list, plan, translate); labels in the app language (tr), prompts in the answer's language; "Check the maths" ranks before Translate. A maths follow-up with a number ("and with 5 cranes?") after a word problem is sent to verifyMath together with the earlier question.
- **Lighter streaming** (Ali: "don't make the device glitch"): stream updates ~10×/s (setTimeout 90 ms, not every animation frame) in `ask` and `continueAnswer`; `Md` is `React.memo` (react-shim now exports `memo`), so earlier answers aren't re-rendered on every update.
- Tests: `e2e_v516.py`.

### 5.6 v5.17 — Ali's phone test (26 Sep 2026)
**First: his phone showed an OLD page** (More had no Assistants/Projects/Artifacts/Theme) although he installed "the update". `versionCode` had been 13 / "5.13" since v5.13, so nothing distinguished builds. Now `versionCode = 17`, `versionName = "5.17"` — **raise both on every release**. MainActivity loads `index.html?v=<versionName>-<lastUpdateTime>` and calls `web.clearCache(true)` once after each update; More shows `Attune <PAGE_VERSION>` (+ "· app X" if the app's differs) — `PAGE_VERSION` in attune.jsx must be raised too.
- **Website preview: tapping a link reopened Attune inside the page** → in a srcdoc iframe, `#menu`, `about.html` and form submits resolve against the APP's URL. `htmlDoc` (sandbox.js) now handles unhandled clicks on `a[href]` (hash → scrollIntoView; others → logged, not followed) and unhandled `submit` (prevented), listening on window at the end of the bubble so the page's own handlers run first.
- **"And with 5 cranes" → 500,000 + 70,000 = 453,000** → (a) the slip check needed ≥ 2 digits in the QUESTION; now it runs whenever the answer has "="; (b) `arithmeticSlips` read the list number "3." as part of the sum — list markers are stripped; (c) `fixSlips` corrects the wrong result everywhere in the text (incl. the Total line) when re-checking by code isn't possible; (d) a follow-up after an instant `calc` sum also takes the verifyMath route with the earlier question; `looksLikeMathProblem` knows "+ 14% VAT".
- **Web answers with mangled digits ("1,5,0000Pa", dollar "5.75.7")** → DRY looks back over the whole context, so copying numbers from the passages counted as repeating. `o.copy` (web sources, files, project knowledge, the audit re-answer) turns DRY / n-gram off; elsewhere `dry_allowed_length` 4 → 12.
- **Studio stuck on "Writing a fuller description…"** → the stage now moves to "start" as soon as the description is written (the real hang was the v5.16-fixed `--list-devices` read).
- **Memory item wouldn't open** → TWO causes: the fade-in (`.att-in`, defined in shell.html AND in attune.jsx's injected CSS) used `animation-fill-mode: both`, which keeps a transform in effect → the page became the containing block for `position:fixed` pop-ups, which opened off-screen; now `backwards` in both places. And the pop-ups were `items-center` in an `overflow-auto` overlay, so a tall one had its top cut off unreachably; all six such overlays are now `items-start`.
- **Memory in the bottom bar** (6 items: Chat · Instant · Money · Business · Memory · More).
- **Business**: design names in the description's language (`designLang`: Arabic script → Arabic, else English; "never Spanish…"); `designQuality` rejects designs whose tables are only an ID (Ali's "Skittlz Cafe": Clientes/ClienteID…) and falls through to lines → template; ID-only tables get a Name. **Rename by tap**: draft preview (tap table/field), system name (tap), table (tap the selected chip again or hold any chip → sheet with Rename / Edit its columns / Delete), field (hold a column header). **Connections** card in Design (`relationships`), **linked records** under a record (`relatedRows`). **Queries** tab: a sentence → `queryMessages` JSON → `makeQuery` (names matched loosely, ops = != > >= < <= contains between empty notempty, sort, group+sum, limit) → `runQuery`; saved in `sys.queries`. **Forms** tab: a sentence → `formMessages` → `makeForm` (fields in order, defaults) → saved in `sys.forms`; Data shows "New record with:" chips; RecordForm shows only the form's fields with its defaults. Tabs are now a 3×2 grid.
- **Copilot**: "Bring the chat from ChatGPT…" card — paste a whole conversation or the last reply → added as an imported turn, analysed, and next-message variants suggested at once (the paste is kept even when the day's free runs are used up); big "Copy & open <tool>" button under the prompt.
- Note for Ali: he is on the FREE tier (`TRIAL_PER_DAY` runs a day, "4 free today") — some "doesn't work" reports may be the daily limit + upgrade sheet.
- Tests: `unit/v517.test.mjs`, `e2e_v517.py`; e2e_v4 bottom bar = 6.

### 5.7 v5.18 — Ali's v5.17 phone test (26 Sep 2026)
- **"July 20205", "4002 horsepower", "Lynk & Co 9000", "ItIt is is", "as as"** (web answers at ~50 tokens/s = fast engine) → tokens were DOUBLED, not wrong facts. Cause: LiteRT-LM multi-token prediction (`ExperimentalFlags.enableSpeculativeDecoding`), which the first GPU try switched on. Now **off by default** (explicit `false`, not `null`); `Prefs.fastMtp` (`fast_mtp_v2`) + Engine → Speed row "Multi-token prediction (faster writing)" turns it back on. If doubled tokens are ever reported again, suspect llama.cpp's speculative decoding (ngram-mod / draft) next.
- **Website answer ended in hundreds of "." lines** → code/JSON (strict) answers skipped every loop guard. `detectDegenerate` (quality.js) — ≥ 20 junk lines (`.`, `…`, `-`) in the last 40, or the same line (> 3 chars) 12× in a row — now runs for strict answers too, and cuts there.
- **"website for a clothing brand called skittlz" → "ZenFlow: Focus Timer"** → `topicWords`/`onTopic` (code.js): the page must contain the named thing (word after called/named/brand/company) or the request's key words; the request pins the name ("use the name … in the <title>, the header and the text"); an off-topic page is rewritten once with "YOUR LAST PAGE WAS ABOUT SOMETHING ELSE".
- **Studio "Draw it" did nothing** → a rejected `imagine` with "Stopped" (or an empty message) was shown as nothing. Now only a Stop the person pressed is quiet (`userStop`); any other failure shows a reason; native `imagine` failures are appended to `engine.log`; exit 137/9 (SIGKILL) → "Android closed the picture engine to free memory…". The real cause on Ali's phone is still unknown — ask for Engine → Engine log.
- **Business**: design preview gets "+ field" per table and an AI box ("Change the design in words") using `changeMessages` + `applyOps` on the draft. **Export as an app** (`erp-app.js` `buildApp`): one .html with the system JSON in `<script type="application/json" id="attune-erp">` (JSON escapes `< > &`) and a self-contained runtime (the `runtime` function, embedded via `toString()`): tabs, search, add/edit/delete, auto numbers, formulas (own small parser), links, totals, CSV, localStorage per system, "Save a copy with my data" (re-embeds the records). Trial systems keep `freeRows` in the app. **Open an app file** on the Business home (`readApp`) replaces the same system (by id) with the file's data, keeping this phone's licence (a file can't carry an activation). **Excel workbook** of all tables via Pyodide openpyxl → base64 → `saveFile({b64})` (NativeBridge.saveFile now writes base64 when given).
- Version 5.18 (versionCode 18, PAGE_VERSION "5.18").
- Tests: `unit/v518.test.mjs`, `e2e_v518.py` (uses the exported app in a real tab: adds a record, formula 3 × 18,000 = 54,000, JOB-0002, reload, save a copy, re-import).

### 5.8 v5.19 — "make web search accurate, FIX Studio, expert connected ERPs, stronger app" (26 Sep 2026)
- **Web search**: the model used to see the first 2,200 characters of each page (menus + intro; spec tables never reached it). Now `WebTools.pageText` builds the text line by line with **tables as "cell | cell" rows** (h1–h5 as "## heading"), up to 16,000 chars; `search()` reads up to **6** pages (pool 6). Page side, `webrank.js` `rankPassages(question, hits)` splits into ~450-char passages with their heading, scores question words (short words as whole words, names ×2) + numbers/table rows when the question asks for figures (only on-topic passages), minus boilerplate, and packs the best within 7,000 chars per answer, sources kept in page order. `webLookup(q, question)` = `webLookupRaw` + ranking; (v5.21: Wikipedia is no longer added — Ali doesn't treat it as reliable.) GROUNDED_RULES: "asked for ALL versions/trims … list EVERY one the passages name … say which figures the passages don't give".
- **Studio "does nothing"**: the silent end was a rejected `imagine` with "Stopped". `NativeBridge.cancel(id)` — used by chat, downloads and the loop guard — also cancelled any image job with that id. Now only `cancelImage(id)` (Studio's Stop) can stop a picture. The chat model is ALWAYS paused while drawing on phones < 20 GB (the fast engine's GPU memory isn't in "available"). The last failure is kept (`image_last_error`, shown in Studio as "The last picture didn't finish: …"). If Ali still gets no picture, the message on screen now says why — act on that.
- **Connected ERPs**: the design prompt asks for 6–10 tables, "FULLY CONNECTED" (every transaction table links to what it refers to), formulas for totals/balances/durations. `findConnections`/`autoConnect` (erp.js) turn fields named after another table ("SupplierID", "Customer name", "Part", Arabic "العميل"→"العملاء") into links — automatically on new designs, and via "Connect the tables for me (n)" in Design for existing ones (`connectOps`; `changeType → link` converts existing text values to record links; Undo reverts).
- **Stability**: `guard.jsx` `Guard` error boundary wraps the page switch (keyed by mode): a crashing screen shows "Something went wrong on this screen" + Try again instead of blanking the whole app; logged via `NativeBridge.logLine` into engine.log.
- Version 5.19. Tests: `unit/v519.test.mjs`, `e2e_v519.py`.

### 5.9 v5.20 — "web search in full detail, page by page" + "fix image creation for good"
- **Deep research** (`research.js` + chat.jsx web branch): `api.webPages(query, pagesFor(question))` (native search, up to **8** pages in full, DuckDuckGo asked for 10) → for each page, `api.rankOne` passages (≤ 5,500 chars) → model call `notesMessages` (one fact per line, table rows kept, copy digits; `copy: true`, 700 tokens) → `checkNotes` drops every note line with a number not found on that page → `missingMessages` asks for ONE query for what's still missing → that query searched (4 pages) and its 3 new pages read the same way → final answer = `groundedPrompt(asked, notes) + FINAL_ADD` ("COMPLETE, detailed … every item … a table … what the sources did not say"). Status: "Reading page i of n — title", "Checking what is still missing…", "Searching again for: …". Hard cap ~3 min. Sources line says "read N pages one by one, facts from M". No notes at all → falls back to ranked passages. Tests queue: notes per page, "NONE" for the missing-check, then the final answer.
- **Studio — every failure path**: (1) stray cancel (v5.19 `cancelImage`); (2) GPU hang/refusal (watchdog → CPU); (3) **out of memory** → the run is retried ONCE at 512 px with `te=disk` (`argsAt(512, true)`), note says so; (4) **half-downloaded model** → `packProblem` checks sizes saved at install (`meta.sizes`) and the GGUF magic before drawing, with "remove and install again"; (5) **engine can't start** → `selfTest` runs `--help` once per app version (cached in `image_selftest`) and reports CANNOT LINK / permission problems; (6) **page reloaded while drawing** → `imageList()` + Studio merges files it missed into the gallery on open; (7) `catch (Throwable)` in `imagine` so an OOM Error still answers the page; (8) the "fuller description" step gives up after 45 s and draws from the idea as typed. The CI build was verified to include the picture engine (restored from cache: `libattune-image.so`).
- Version 5.20. Tests: `unit/v520.test.mjs`; e2e_v519 extended (page-by-page notes, invented number dropped, missing-check, full answer).

### 5.10 v5.23 — "catchy Attune names for the models" + "stronger models clearly much stronger"
- **Names** (`power.js` `BRANDS`, shown via `brandOf(tier)`: header chip, Engine list, install labels, flash texts; the real model + quant stays in small text under the name): xs Whisper · sm Echo · fast-e2b Pulse · md-lo Chord Lite · md Chord · md-hi Chord HD · lg Rhythm · fast-e4b Pulse Pro · xl Harmony · max Harmony Pro · moe-lg Symphony · ultra Symphony Max · moe-xl Maestro · moe-xl-long Maestro Long. A new tier without a brand shows its label and gets a level from its params. (Note: "Whisper" is now the smallest chat model's name — call the speech model something else if it is ever added.)
- **Levels** (`LEVELS`): 1 Basic, 2 Everyday, 3 Smart, 4 Expert, 5 Master, each with a blurb in the Engine list. **Power profile** `powerFor(level, ctx)` → `getPower()` (set by `setPower(activeTier)` in App): maxTokens/longTokens (1024 → 6144/8192), research `notesChars` per page (3.5k → 12k), second research round pages (0 → 6), website `codeTokens` (2.5k → 12k), ERP `designTokens` (1.8k → 6k) and table count ("3 to 5" → "10 to 16"). All capped by the model's context (answer ≤ ctx/3, code ≤ ctx/2).
- **Expert + Master only**: `EXPERT_RULES` added to the system prompt (edge cases, name the standard — EN 13000, Egyptian VAT, IFRS — full calculations with units, professional deliverable structure, assumptions/risks), and Think switches itself on for reasoning/maths questions (`thinkHard`). Small models don't get these — they get confused by long instructions.
- **Web search closer to Gemini** (Ali: "extremely detailed and accurate, close to Gemini") — `research.js` v5.23 part + chat.jsx web branch: (1) **plan**: `planMessages(question, n)` → `parsePlan` = the user's search + n−1 searches from other angles (specs, prices, reviews, latest news, comparisons), n = level's `queries` (1…5) — only for detail-hungry questions (`pagesFor` = 8); a quick question stays ONE search; (2) each search `api.webPages(q, per)`; `mergeHits` takes pages in turn from each search, no URL twice, **max 2 pages per site**, `sourceScore` moves official/brand/.gov/well-known sites up and social media/Q&A/video last; read cap = level's `readPages` (4…12); (3) gap-filling **rounds** (0…2) of `missingMessages` → new search → read; time budget `researchSecs` (120…420 s); (4) `crossCheck` marks note lines whose figure another site also gives "(also in [n])" and counts them; (5) `REPORT_ADD`: direct 2–3 line answer, `##` sections, tables, a source after every fact, "Where sources differ", "Not found in the sources"; the report gets the level's `longTokens`. Sources line: "N searches · C facts confirmed by 2+ sites". Test queues: the plan answer comes FIRST (before the page notes) when the level plans >1 search and the question is detail-hungry.
- Version 5.23. Tests: `unit/v523.test.mjs`. e2e_v519 extended (plan, several searches, report).

### 5.11 v5.24 — "make the stronger models REALLY strong"
- Instructions alone don't make a model stronger; more work per answer does. Expert + Master levels (Harmony … Maestro, all with a 32k+ window) get, via `power.js` profiles:
  - **Review pass** (`review: true`): after a plain model answer (not verified/computed/voted/code/web/photo/file) that `worthReview` (question ≥ 25 chars, draft ≥ 500 chars, not hi/thanks), the model gets `reviewMessages` (REVIEW_SYS: senior expert reviewer — recompute numbers, fix mistakes, add missing points/edge cases; reply `PROBLEMS:` + `FINAL ANSWER:`). `pickReviewed` keeps the draft when there is no FINAL ANSWER or the rewrite is < 60 % of the draft; Stop during the review keeps the draft. The draft stays on screen until the rewrite is half written. Badge "Reviewed by an expert pass · N improvements" (tap → the list). Status "Reviewing the answer like a senior expert…".
  - `thinkBudget` 3072 / 4096 (was 1024–1536), `votes` 5 in reasonVote (was 3), `codeRounds` 5 / 6 (chat code tasks + Code workbench), `historyChars` 20k / 30k (buildMessages budget, still ≤ (ctx − 4300) × 2), `fileChars` 40k / 60k (capped by the window, never below the old 14k).
- Tests: `unit/v524.test.mjs`, `e2e_v524.py` (RAM override 16 GB → install Harmony → draft + review → improved answer and badge; broken review keeps the draft; "hi" isn't reviewed). NB a test draft must not repeat one sentence — the anti-repeat guard trims it below the review threshold.

### 5.12 v5.25 — Ali's screenshot: the big models' cards looked weak
- The Engine cards showed "Rewrite / Compress / Humanize / Copilot" **crossed out on every model** (old parity-eval chips; no tier ever had them in `good`) + "Parity: unverified…". Removed. Each card now shows `capabilitiesOf(tier)` (power.js) from the real power profile: Expert/Master abilities as violet ★ chips (expert review, senior-expert mode, thinks Nk tokens, web research N searches/pages, answers up to Nk tokens, reads files / a whole book, code rounds, ERP tables, logic tries + vote), plain chips for the rest, "Reads photos" for vision tiers.
- **Long context unlocked**: a tier with ctx ≥ 65,536 (Maestro Long, 131k) gets `fileChars` up to 300k (≈ (ctx − longTokens − 4000) × 2.5) and `historyChars` 60k (`longContext: true`). Before, it was held to 60k characters like the 32k models.
- Tests: e2e_v524 extended (no line-through, whole-book chip, ★ counts).

### 5.13 v5.26 — "tips and tricks that make them smarter; maximise the SMALL models"
All in `boost.js` (pure, `unit/v526.test.mjs`, `e2e_v526.py`):
- **Sampling** (`samplingFor(family, level, taskKind(lastUserText))`, applied in the model call when not thinking/reproducible; a caller's `temperature` still wins): Qwen top_p 0.8 / top_k 20, Gemma top_p 0.95 / top_k 64, min_p 0.05; precise 0.3 · chat 0.6 · creative 0.85; levels 1–2: temperature × 0.7 (× 0.9 creative), min_p 0.1, top_k ≤ 20. `getPower().family` comes from `familyOf(tier)` in `setPower`. strict/copy calls count as precise.
- **Short system prompt** for levels 1–2 (`compactSystem`: 6 rules + one example, ~1.1k chars instead of ~3.4k) + the user profile; levels 3+ keep `systemPrompt`.
- **HONESTY_RULE** for every model (no invented specs/prices/dates/names when there are no passages or file; mark estimates; suggest Web).
- **Re-reading (RE2)**: reasoning/maths questions without think get "Read the question again: …" (chat) and every reasonVote try does too (`sampleMessages`).
- **Every part**: `partsOf` (2+ "?"/"؟" questions or a numbered/bulleted list) → `everyPart` checklist appended.
- **Sandwich**: attached text files are sent with the question before and after (`sandwich`); `groundedPrompt` now has "QUESTION:" before the passages too.
- **JSON mode**: `o.json` calls (ERP design, change, query, form) send `response_format: {type: "json_object"}`; if the engine rejects it (the desktop test llama-server does with the tiny model: "Failed to initialize samplers"), the request is re-sent without it and `LocalEngine.noJsonMode` stops asking. Verified min_p/top_k/top_p are accepted by llama-server.

### 5.14 v5.27 — "nothing I send may go unanswered, however long, even on small models"
`longread.js` (pure, `unit/v527.test.mjs`) + chat.jsx send() (`e2e_v527.py`):
- **Read in parts**: `tooLong(text, ctx, longTokens)` (density-aware: `charsPerToken`, Arabic denser; `fitChars` leaves room for system + answer, 10 % margin). A too-long typed message (request = `requestOf`: its first + last 700 chars) or attached text file (request = the question) → `splitParts` (paragraph → line → sentence/space cuts, order kept) → one `partNotesMessages` call per part (900 tokens, copy, "NONE" skipped) → notes still too long → read the notes in parts again (≤ 4 rounds) → `fromNotes` final prompt, sent with ≤ 1,500 chars of history. Status "Long message — reading it in parts (i of n)…". Maths/logic/code routes are skipped for such messages (`longMsg`). Files are no longer silently cut at `fileChars`: full text if it fits, parts if not.
- **Retries**: context error → no history → still too long → read in parts; any other engine error → one lighter retry (no history, no think) with "Something went wrong — trying again…"; an empty answer → asked once more.
- **Auto-continue**: a plain answer whose stats say `cut` continues by itself up to 4× (6× Expert/Master) with `continueMessages` (system, question, the answer's LAST 2,600 chars as the assistant turn, "Continue exactly…"), joined with `glue`. The manual Continue button also uses it now (it used to show the model the START of its answer — buildMessages keeps the first 1,800 chars). The expert review is skipped for continued / read-in-parts answers.
- e2e_v513 §4 now expects auto-continue (no Continue tap).

### 5.15 v5.28 — Ali's phone test: garbage web answer, 13-min Studio with nothing, puzzle answered "with a function"
- **Web garbage root cause = window overflow.** The fast engine (LiteRT) runs an 8,192-token window (4,096 under 8 GB RAM) and does NOT refuse an oversized request — it silently writes garbage (digits dropped/doubled: "since 205", "[111]", "1,2,48 Nm", broken tables, empty bullets). Deep research (v5.23) could put 9 pages of notes + a 2,048-token answer into it. Now: `LocalEngine.ctx` = the real window from the engine event (`settings: "context N"`); **every** request (NATIVE) is estimated (`estTok` from longread.js × 1.12 + 64) before sending — `max_tokens` shrinks to the room left, < 200 tokens of room → "longer than this model can read" (chat.jsx then reads it in parts). Research notes go through `fitNotes(notes, fitChars(ctx, longTokens, 2400))` (confirmed lines first, then each source's first lines). Levels 1–2 read 4–5 pages with 450-token notes (faster). Test: e2e_v528 (4k window, 12 requests, none too big).
- **Puzzle "answered with a function"**: Pulse Pro (Gemma family) with Think answers reasoning with a ```tool_code``` Python block. `NO_CODE_RULE` in every system prompt; `codeInsteadOfAnswer(answer, question)` (tool_code, or code with < 160 chars of prose; html/css/json/csv/mermaid blocks and questions that ask for code/pages/formulas excluded) → re-asked once "in plain words". `looksLikeDeduction` (2+ quantified statements, or 2+ quantifier sentences with a question, or deduce/syllogism/"can an X exist") → logic route, never the maths program.
- **Studio**: FLUX.2 klein 4B on a phone CPU = 10–20+ min a picture (Ali: 13 min, nothing). New pack **Studio Turbo** (`turbo`: SD-Turbo one-file GGUF, role `model` → `sd-cli -m`, euler_a, 2 steps, cfg 1, 512 px long side via `drawSize`), links tried in order (`urls`; `ModelStore.NotFound` on 404/401/403/410 moves to the next), size unknown → `approx` for the progress bar and the server's Content-Length/Content-Range for completeness (a dropped connection resumes). `imageInfo.gpuState` ("gpu"/"cpu"/"") remembered in localStorage (`gpuWorks`); `drawPack(info, choice, mode)`: GPU not working → Turbo (offered with an explanation if not installed); Turbo / Pro switch (remembered); Pro on CPU shows "10–20 min". Edit mode needs Pro. Packs renamed Studio Turbo / Studio Pro / Studio Pro HD. **Not verified from here**: the exact Turbo file names (huggingface.co is blocked in this sandbox) — the first link is gpustack/stable-diffusion-v2-1-turbo-GGUF Q4_0, then Q8_0, then the SDXL-Turbo Q4_1 whose name was confirmed by search. SD-Turbo licence: Stability AI Community License (commercial use free under $1M/year revenue) — check before selling at scale.

### 5.16 v5.29 — Ali: names, RAM, deletes, 200 tips, UI/UX, earning money
- **Names** (power.js `BRANDS`): Spark · Glow · Flash · Core Lite · Core · Core+ · Sense · Flash+ · Pro · Pro+ · Ultra · Ultra+ · Titan · Titan XL. `MODEL_TIERS[].label` IS the Attune name; the vendor name lives in `realName` (never shown). Anything from the engine goes through `publicName()` (old installs carry "Echo · Qwen3.5 2B · UD-Q4_K_XL"). Speed panel / draft helper / recommendation headline de-vendored. Cards: params, size, level blurb, **"RAM: needs X GB · smooth from Y GB"** (+ ✓ smooth / ≈ slower / ✗ too little for this device; `smoothRam` per tier), abilities. `data-testid="tier-<id>"` on each card.
- **Deletes ask first**: chat rows (inline "Delete this chat?"), and `askConfirm()` (confirm.jsx, `<ConfirmHost/>` in the shell) for reminders, places, corrections, custom actions, code projects, cranes, project files, Studio pictures.
- **Tips library** (tips.js): 246 tips in 24 areas; `tipsFor(q, n)` — triggers match at word starts (short Latin/Arabic tokens also at word ends), one tip per matching area first (areas ranked by matches), `CRITICAL` tips (VAT 14%, load chart, total load, dosage, emergencies, passwords, balanced entries, working steps) get +3. Added after the question: 2 tips (levels 1–2), 3 (Smart), 5 (Expert/Master); not for web/long messages.
- **Money** (billing.js, Plan screen `Upgrade`, MONETIZATION.md): the old "Choose" button set Pro for free and Pro keys were unchecked (`ATTUNE_PUBLIC_KEY` empty) — both closed. Pro now = Store purchase, or a **signed PRO1 code**: the phone shows `requestCode(entDeviceId())` = PRO-XXXXXXXX; seller runs `node tools/erp-licence.mjs pro <private-key> PRO-XXXXXXXX month|year|life|business` (same P-256 key as ERP codes, `LICENCE_PUBLIC_KEY` in erp.js); the app checks it with `checkProCode` (bound to the request code; `e` = end time, 0 = lifetime) and re-checks the saved code (`attune:pro-code`) at every start. Regional prices (`pricesFor`: EGP 149 / 999 / 2,999 in Egypt; $3.99 / 24.99 / 59 elsewhere), yearly pre-selected. **7-day reverse trial** (`attune:first-run`): `proActive = isPro(tier) || trialLeft > 0` → unlimited, expert review, multi-search research (`api.pro()` gates them). WhatsApp purchase uses `SELLER.contact` (erp.js) — **Ali must fill his number**.
- **UI/UX**: the footer line hidden on Chat (it showed half behind the composer); More: tools first, "Appearance" (language, text size, colours) at the bottom; brighter tile descriptions; home status strip (model · level, "★ Pro trial · N days left" → Plan); follow-up chips fade at the end (left in RTL).
- **Fixes**: auto-continue sizes the tail by the answer's real chars/token (dense text overflowed: 5,165 tokens in a 4,096 window) and keeps the answer if a continuation fails. Test engine now runs the 16k window the mocks report.
- Tests: unit v529 (tips + billing incl. signed codes), e2e v529 (tips reach the model, Plan screen, no free unlock, fake code rejected).

### 5.17 v5.30 — "web search as close, fast and accurate as Gemini" + "runs on the GPU"
- **Why it took 5 minutes**: deep research (v5.20/v5.23) made the model WRITE notes for every page (≈ 700 tokens × up to 9 pages) — output is the slow part on a phone, even on the GPU. Reading is fast (the fast engine reads thousands of tokens a second).
- **FAST research is now the default** (research.js v5.30 + chat.jsx web branch): `expandQueries(query, n)` (code, no model: the user's search + one per facet — specifications / price YEAR / trims / review / latest news / each side of "A vs B"; Arabic facets for Arabic; `topicOf` strips filler and facet words, keeps "1100-5.2") → all searches **in parallel** (`Promise.all` over `api.webPages`) → `mergeHits` (max 2 pages a site, quality first) → `api.rankAll(question, pages, { budget: fitChars(ctx, longTokens, 2600, text), perSource })` → `confirmedFigures(ranked)` (number + unit/currency on 2+ sources, shown as written, "FIGURES CONFIRMED BY 2+ SOURCES" block) → ONE model pass (`groundedPrompt + figures + FAST_REPORT_ADD` for detail questions). `groundedAudit` still re-asks for numbers not in the sources. Detail questions get ≥ 3 parallel searches on every level. Footer "read N pages · K searches · C facts confirmed".
- **DEEP (page-by-page notes)** only when `wantsDeep(text)` ("deep research", «بحث عميق», «ابحث بعمق»…) or level ≥ 4 on a detail question with Pro/trial; model-planned searches there.
- **GPU**: chat already runs on the GPU with Blaze / Blaze+ (LiteRT fast engine; called Flash / Flash+ until v5.31). FastEngine now opens a **16k window on 12 GB+ phones** (more pages in the one pass), falling back to 8k per try if the driver refuses (`for (t in tries) for (nCtx in sizes)`). Studio's GPU path is Vulkan (sd.cpp); on Ali's phone `--list-devices` found no GPU → Turbo on the CPU. Ask Ali for Engine → Engine log after a Studio try to see why.
- Tests: unit v530; e2e_v519 rewritten (fast: ≥ 3 parallel searches, ONE model call, no notes/plan; deep: plan + notes + missing-check + report), e2e_v528 research part on the fast path.

### 5.18 v5.31 — "Flash is taken by Gemini" + "no bugs, loops, holes, glitches or gaps" + "copy how Gemini searches"
- **Names** (power.js `BRANDS`; nothing may clash with another AI — Gemini has Nano/Flash/Pro/Ultra, Amazon has Titan): Spark · Glow · **Blaze** · Core Lite / Core / Core+ · Sense · **Blaze+** · **Zenith** · **Zenith+** · **Apex** · **Apex+** · **Everest** · **Everest XL**. `publicName` also renames old saved labels (Flash, Titan, Ultra…). Vendor names (Qwen, Gemma…) never show.
- **Gemini's method, copied** (Google's grounding docs: the model writes several searches, results are merged, every sentence gets its sources with links): parallel fan-out searches by code; passages ranked into ONE GPU pass; `[n]` become tappable source chips (`data-testid="cite"`); sources show their site; "How I researched" panel (`research-log`); with Web off, a question about prices / latest / specs offers a one-tap "Search the web for this" (`search-web-chip`).
- **Audit** (crawl of every tab, all 23 tools and the Engine / Profile / Plan / Backup sheets, in English and Arabic; checks crashes, JS errors, sideways overflow, buttons under 26 px, English left in Arabic):
  - Maps: the tile layer spilled past the screen edge → the map box is `overflow-hidden`.
  - Close ✕ on Engine, Profile, Backup, the custom-model sheet and records, and the voice button in Improve, were under 26 px → 36 px round tap targets with `aria-label`.
  - Arabic gaps filled: cycle headline, dates (`dateLocale()` = Arabic with Latin digits), country / language names (`Intl.DisplayNames`), Travel packs, Site report fields, Ask chips, the 64 Library notes, Compress, the map's online / tiles text, "fast engine", "synced".
  - What is left is on purpose: brand and product names (Midjourney, GitHub Copilot, Brave Search), © OpenStreetMap, request codes, device ids, `owner/repo:QUANT`.

### 5.19 v5.32 — Ali's phone test: garbled web figures, "Stopped.", Studio silent for minutes, vendor names, clutter
- **Web figures** ("0-inch", "range of 4 km", "The 0 features", "sixseater", "**(V10)****", repeated bullets, "The passages do not provide…"):
  - Root cause: `estTokens` counted number-heavy pages like prose; every digit and most symbols are single tokens, so spec pages overflowed the fast engine's window, which silently drops digits (see v5.28). `longread.js estTokens` now counts digits 1:1 and symbols 0.8; the fast web prompt uses at most a 12k window even on 16k phones.
  - `answerfix.js` (like Gemini's grounding, by code): `repairFigures` puts back figures from the source a line cites (same unit, or the same words around it; the other sources when the citation is wrong), and restores glued words ("six-seater"). `tidyAnswer`: broken bold, `[2, 3, 5]` → chips, duplicate bullets, table columns, and the "passages / sources don't provide" lines removed. The prompts no longer ask for "what the sources did not say" (that produced those lines).
  - `gapsOf`: a price / trims / specs the question asked for and the answer lacks → one more parallel search for "<subject> price" etc., and the answer is written again with the new pages (fast mode only, once).
- **Writing rules checked by code** (`constraints.js`): "no letter e", "exactly N words per sentence", "N sentences", "no numbers / symbols", "under N words" → the phone checks, tells the model exactly what broke, up to 3 rounds, keeps the best; badge `rules-checked`.
- **"Stopped." without Stop**: in chat, a "Stopped" when the person did not press Stop (runRef unchanged) now falls through to the lighter retry.
- **Studio**: sd-cli's latest output line is shown under the status (`studio-engine-line`); every run writes its story to Engine → Engine log (model, free RAM, GPU check output, backend, threads, exit code, seconds, last 14 lines). CPU watchdog: 4 silent minutes while loading → stopped with a clear message. Threads = big cores − 1 (the phone stuttered). The note no longer blames "the GPU driver" when the APK simply has no GPU engine. CI: the cached picture engine is rebuilt when the GPU copy is missing (cache key v2), and a failed GPU build prints its log instead of vanishing in /dev/null. **Next: read Ali's Engine log after a Studio try.**
- **Names**: Engine's installed list uses `labelFor` (catalog match by URL / real name, fast engine aware) — "Gemma 4 E4B-it" → Blaze+, "Qwen3.5 0.8B" → Spark; `publicName` strips ".litertlm" and "-it".
- **Instant**: says what it is for (`instant-about`); a nearby-place request ("fuel up … I am at Emerald Park compound") gets "Open in Google Maps" for "gas station near Emerald Park compound" (`places.js`, `instant-map`).
- **More**: four named groups (Create & learn · Work & business · Your life · Prompts for other AIs) + Settings (`more-group`, `more-settings`).
- **Money**: `TESTING_ALL_PRO = true` (billing.js) unlocks everything while Ali tests — **set false before release**. The trial now really unlocks every Pro gate (22 gates checked the paid plan only). Prices raised: EGP 199 / 1,499 / 3,999, $4.99 / $39.99 / $99; Business EGP 9,999 (MONETIZATION.md §3).
- Tests: unit v532 (Ali's real Winner Sky / Lynk & Co lines, rules, places); e2e_v532.

### 5.20 v5.33 — Studio noise picture, Lynk & Co glitches, and a feature that sells: Deal Check
- **Studio Turbo drew coloured noise** (35 s on the CPU, so the engine now runs): sd-cli *guesses* eps vs v-prediction for SD 2 models with a test pass (`is_using_v_parameterization_for_sd2`, diffusion_engine.cpp), and the quantised SD-Turbo fooled it into v. `ImageRun.genArgs` now passes `--prediction eps --scheduler sgm_uniform` for all-in-one (Turbo) models; Turbo draws 4 steps. The v5.32 build was the first with the GPU picture engine really inside (39 MB) — the earlier cached builds most likely had the CPU one only.
- **Answer glitches** (Ali's Lynk & Co 900): `answerfix.js` also fixes same-digits-wrong-dots figures ("1.2.93" → "1.293"), doubled digits ("0–1000 km/h" → "0–100"), "630.kW", "kWkW", "a a a", "one-piece-piece", "[3 5]", empty headings and lone "—" bullets. Web answers are written at temperature 0.1 (copying, not creating).
- **Deal Check** (`deal.js`, `deal-ui.jsx`, More → Your life, first): paste an offer / seller's message / installment plan or add a screenshot. The model only reads it into JSON fields (`extractMessages` / `parseTerms`) and writes the reply to the seller; **code** does the rest: `planCost` (true total + real yearly interest by bisection on the monthly rate; fees up front shrink the loan), `marketFrom` (prices with a currency on the web pages for "<item> price Egypt <year>", outliers dropped, median / range), `scamSigns` (pay-first, personal wallet / gift card, OTP code, prize, urgency, off-platform, guaranteed profit, copy / replica, generic, no ratings — EN + Egyptian Arabic), `verdict` (scam / risky / overpriced / fair / good, the price to ask for), `questionsFor`. Free: 3 checks a day; Pro: unlimited (PRO_BENEFITS). Tests: unit v533, e2e_v533.

### 5.21 v5.34 — "highest resolution" + "make web search a beast"
- **Studio Turbo worked** (44 s on the CPU, a real picture — the `--prediction eps` fix). **Highest resolution** (`studio-hd`, on by default, remembered in `attune:studio:hd`): after each drawing, the picture is sharpened ×4 with Real-ESRGAN automatically (512 → 2048 px; the 67 MB model downloads the first time). Turbo itself stays at 512 px — bigger makes doubled subjects.
- **Facts sheet** (`factsheet.js`): the figures in a web answer are no longer re-typed by the model. Code reads every source for ~24 specs (price, power, torque, battery, range, 0–100, top speed, engine, charging, size, weight, seats, lifting capacity, boom, storage, RAM, screen, camera, fuel use, motor) in "Spec | Value" rows, "Spec: value" lines and sentences, groups equal values (✓ = on 2+ sites, both shown when sites disagree) and copies multi-column tables (trims, load charts) as written; the table goes under the answer with citations. When a sheet exists the model gets `SHEET_NOTE` (direct answer + meaning, few figures) instead of `FAST_REPORT_ADD`.
- **Two search engines**: `WebTools.search` runs DuckDuckGo and **Bing** (keyless HTML, `li.b_algo`, `ck/a?u=a1<base64>` unwrapped) in parallel and interleaves the results (duplicates by URL removed, up to 14) — more and different sites per question. `via` reads "duckduckgo + bing".
- **Back, one step at a time** (`backstack.js`): inner pages register with `useSubBack(active, onBack)` — open project / project edit / knowledge note, assistant form (now with "← All assistants"), artifact viewer, Business system / new-system draft / rename / record form, Learn course → lesson / quiz / past, Daily news topic / past digest / adding, Deal Check result, Studio edit mode, Cycle day editor, an open Memory record. `goBack` (header ← and `window.__attuneBack` for the phone's Back) runs the newest registered step before leaving the tool; a page removes its own step when it closes, so multi-level pages keep handling Back.
- Tests: unit v534; e2e_v519 (facts sheet under the answer), e2e_v59 (auto ×4), e2e_v534 (Back).

### 5.22 v5.35 — Chat X-Ray (another feature "to take the app to another level")
- `chatxray.js` / `chatxray-ui.jsx` (More → Work & business, first): a WhatsApp export (shared from WhatsApp → Export chat → Attune — `MainActivity.readChatExport` reads the .txt or the .txt inside a .zip, up to 6 MB, delivered as `attune-share` kind "chatfile" — or a picked .txt / pasted text). `parseExport` reads Android / iPhone, day- or month-first, 12 / 24 h (AM/PM, ص/م), Arabic digits, RTL marks, multi-line messages, skips system and media lines, and numbers messages in order. `candidates` (code) keeps only messages about money / promises / dates / questions (+ the one before each) in the chosen range (3 months / year / all); `chunksOf` → numbered lines; the model returns JSON items that must point at a real message number; `parseItems` takes the quote and date from the message and drops an amount that isn't in it; `ledgerOf` (owes / paid per person and currency), `unanswered` (a question to the owner with no reply from them within a day, last 60 days), `statsOf`, `searchChat` + `askMessages` ("ask this chat", cites [#n]) — all code except reading and answering. Promises with a date → "Remind me" (`scheduleReminder`). Free: 1 X-ray a day; Pro unlimited. Saved results (no messages) in `attune:xray:v1`. Tests: unit v535, e2e_v535.

### 5.23 v5.36–5.37 — File Converter ("converts files like PDF to Word" → "as many file converters as you can")
Released together as 5.37 (5.36 was never pushed). More → Work & business → File Converter (`convert-ui.jsx`; engine `convert.js`; Android `DocTools.kt`). Nothing is uploaded.
- **Common shape:** text formats → `blocks` [{type h1|h2|h3|p|li|table, text, rows}]; sheets → `rows`; subtitles → `cues`. Every reader produces one of these and every writer takes one, so any reader × writer pair works.
- **Readers (page, JS):** docx (`docxToBlocks`), pptx (`pptxToBlocks`: a heading per slide from the title placeholder, bullets from body placeholders, tables, speaker notes via the slide's .rels), odt / ods (`odtToBlocks`, `odsToRows`: spans, `text:s`, repeated cells/rows capped at 500 — LibreOffice writes a million empty rows), epub (`epubToBlocks`: container.xml → OPF spine order), html (`htmlToBlocks`, scripts/styles/nav dropped), rtf (`rtfToText`: destinations skipped, `\ansicpg` code page e.g. 1256 Arabic, `\uN` + `\ucN`), txt/md, xlsx (shared strings), csv/tsv, json (`jsonToRows`: records → a column per field), srt/vtt (`subsParse`).
- **Readers (Android):** PDF text by PdfBox-Android (`pdfText`; a page with < 25 characters is a scan → `pdfImages` → the 📷 model reads it with `readPageMessages`). Photos → text by the 📷 model too.
- **Writers:** docx, odt, html (`blocksToHtml`), md (`blocksToMarkdown`), txt, xlsx, ods, csv (BOM for Arabic in Excel), json (`rowsToJson`), srt/vtt, PDF (Android `makePdf`: A4, StaticLayout so Arabic is shaped and right-to-left, tables with a grid, photos one per page), photo formats JPG/PNG/WebP (canvas in the page; HEIC can't be decoded by the WebView → "convert to PDF instead", where Android's BitmapFactory decodes it).
- **PDF tools (Android `pdfEdit`):** merge (several PDFs picked together, in the picked order; `PDFMergerUtility`), split (one PDF a page, zipped; `Splitter`), keep pages (`pageList` reads "1-3, 5, 9-" and Arabic digits), rotate (90° right / left / 180°, some or all pages). PDF → Excel takes the tables the text/AI gives, else each line split at wide gaps (with a note).
- **Limits (be honest with Ali):** PDF → Word keeps text, headings-as-paragraphs and AI-read tables, not the exact layout, fonts or pictures; Arabic PDFs made by some programs store letters in visual order and can come out scrambled (the 📷 route reads them correctly); old .doc/.xls/.ppt (binary) aren't supported; PowerPoint → PDF is the slides' text, not a picture of each slide.
- Free 5 conversions a day (`attune:convert:day`), Pro unlimited. Tests: unit v536 + v537 (python-docx / openpyxl / python-pptx real-file checks when installed), e2e_v536 + e2e_v537.

### 5.24 v5.38 — Video Downloader ("copy a link of a video and it downloads it with the quality I want")
Ali chose **safe sites only** (asked 27 Sep 2026): Google Play removes apps that download from YouTube / TikTok / Instagram / Facebook / X, so those (and Vimeo, streaming services…) are refused **by name** with a list of what works — never "fix" this into a YouTube downloader without asking Ali again (a separate non-Play APK flavour with yt-dlp was the other option he declined).
- `video.js` (pure, tests unit v538): `linkIn` (the link inside shared text), `classify` (blocked | direct | drive | dropbox | archive | commons | stream | page | bad), `driveUrl` + `driveConfirm` (Drive's "download anyway" form), `pageChoices` (og:video, `<video>/<source>`, JSON-LD contentUrl, plain .mp4/.webm/.mp3 links; `.m3u8` noticed but not downloadable), `archiveChoices` (archive.org/metadata/ID), `commonsChoices` (Commons API videoinfo + derivatives = 144p–1080p transcodes), `sortChoices` (height, MP4 first, audio last, deduped), `fileName` (title + "720p" + ext).
- `video-ui.jsx` (More → Work & business, after File Converter): link box + Paste (`clipboardText`) → versions with sizes (`videoProbe` HEAD/Range GET) → Download. Shared text that is just a direct / archive.org / Commons video link opens here (attune.jsx `onShare`, `videoIn`). Downloads list with live progress (`videoStatus` every second), Play (`videoOpen`), remove/cancel; kept in `attune:video:v1`. Free 3 a day (`attune:video:day`), Pro unlimited.
- Android `MediaTools.kt`: `probe`, `getText` (≤ 3 MB), `download` (DownloadManager → Movies/Attune or Music/Attune; notification; continues after Attune closes; Android 9 without the storage permission falls back to the app's own Movies folder — the permission is declared with maxSdkVersion 28 but not asked for), `status`, `openFile`, `cancel`. All network calls respect Air-gap.
- Tests: unit v538, e2e_v538 (native mocked).

### 5.25 v5.39 — Translate a document ("take a PDF, translate it to another language and give me the PDF")
File Converter → **Translate…** (PDF, Word, PowerPoint, LibreOffice, e-books, web pages, RTF, text, photos of paper, SRT/VTT subtitles). Pick one of 26 languages (`T_LANGS`, names shown via `Intl.DisplayNames` in the app's language; last choice kept in `attune:convert:tlang`) and PDF or Word (subtitles stay subtitles). `convert.js`: `translateUnits` (each heading / paragraph / bullet / table cell with 2+ letters — number-only cells never go to the model), `batchUnits` (≤ 1,500 characters), `translateMessages` (numbered `[[n]]` lines, keep numbers/names/codes, line breaks as `<br>`), `parseTranslated` (by number, order and chatter don't matter), `applyTranslations` (back into the same blocks — structure is code's job). A piece the model skips is asked again alone; still missing → left in the original language and counted in the note. Output name gets `-ar` / `-fr` …; the PDF is made by `makePdf` (Arabic right-to-left). Needs a model (Engine). Tests: unit v539, e2e_v539.

### 5.26 v5.40 — Slides & Reports ("make very good PowerPoint using an AI prompt, and make reports")
More → Work & business → **Slides & Reports** (first tile; `slides.js` engine, `slides-ui.jsx` screen). Also a Chat chip "📊 Make it a PowerPoint" / "📄 Make it a Word / PDF report" when a message asks for one (`wantsDoc`), opening the tool with the request filled in.
- **Presentation:** prompt + audience + 5/8/10/12/15 slides + 8 designs (`THEMES`: Midnight, Ocean, Emerald, Sunset, Royal, Construction, Minimal, Desert) + language (auto = the prompt's) + optional web research (3 parallel searches, `expandQueries`) + optional file (Word/PDF/PowerPoint/text; Excel/CSV → `dataSummary`: totals, averages, per-name sums, a chart — computed by code). The model writes a PLAN (`outlineMessages` → `parseOutline`: tolerant, drops agenda/thank-you, falls back to a code plan, forces variety) and then EACH slide separately in tagged lines (`slideMessages` → `parseSlide` → `fixSlide`: a slide that didn't come out in its type becomes key points, never empty). Types: bullets (cards when 2–4 short leads), two (comparison), steps (timeline), table (real PowerPoint table), quote, and — only when sources have figures (`hasFigures`) — stats and chart. **Figures:** stats/chart values not found in the prompt/pages/file are removed (`checkFigures`/`unbacked`); other unfound figures are counted and shown as "check them before presenting".
- **Design by code:** `layoutSlide` → a list of shapes on a 1280×720 grid (rect/ellipse/text/table); the SAME shapes become the .pptx (`pptxFromDeck`: 16:9, one blank layout, theme colours, speaker notes, Arabic `rtl="1"`, mirrored layout) and the phone's preview/PDF (`drawShapes` on a canvas). Cover + agenda (≥ 4 slides) + closing ("Thank you / Questions?", 8 languages in `WORDS`) are added by code.
- **Edit:** tap a slide → title, content as the same tagged lines (`slideToText` ↔ `parseSlide`), speaker notes; "Rewrite this slide" (+ an instruction) or "turn it into" another type (AI, that slide only, with this session's web pages); move earlier/later, delete; one tap re-themes the whole deck. Save **PowerPoint** or **PDF** (each slide a JPEG → `makePdf {images, fullPage:true}` → 16:9 pages). Last 15 decks/reports kept in `attune:slides:v1` (sources cut to 20k chars).
- **Report:** 8 kinds × Short 3 / Standard 5 / Detailed 8 sections. Plan (`reportOutlineMessages`) → each section in Markdown (`sectionMessages`, ~300 words, tables allowed) → conclusions & recommendations → executive summary + findings written LAST from the finished text (`summaryMessages`/`parseSummary`). `reportBlocks`: cover title/subtitle/date, contents, page break, numbered chapters, the data chart (canvas PNG), sources, the data table. **Word** (`docxFromBlocks` now also takes title/subtitle/caption/pagebreak/image blocks + `accent` heading colour; plain files unchanged) or **PDF** (Kotlin `makePdf` got the same block types). "Make slides from this report" = `deckFromReport` (code, no AI).
- **Themes, transitions, animations "if I ask using a prompt"** (Ali, same day): `styleFromPrompt` reads the request (EN + Egyptian Arabic): a design only when a design word is present (theme/design/colour/ثيم/تصميم/لون… — so "crane" in a topic doesn't change it), transition fade/push/wipe/split/cover/zoom (morph → fade), animation fade/fly/zoom, "automatic/تلقائي" vs on tap, "no/without/بدون" turns one off. The request's words beat the chips; the deck shows "From your request: …". The AI prompts are told to ignore design wishes. Chips on the form + three selects on the deck. PowerPoint: `<p:transition>` per slide and `<p:timing>` entrance effects (`timingXml`: Fade presetID 10, Fly in 2/sub 4, Zoom 53/sub 16; on-tap = clickEffect per step, automatic = afterEffect every 0.5 s; bldP/bldGraphic list). What appears together is set in `layoutSlide` via `g` (a card with its texts, a step with its circle; a plain list is `byPara` → point by point via `<p:txEl><p:pRg>`); `animSteps` gives the order to both the file and **Play** (full-screen presenter on the phone: CSS transitions, the same entrance effects on the canvas, notes, tap zones, "turn your phone sideways"). The cover animates title → subtitle → date.
- **Sources on the slides** (Ali: "bullet points with the sources", "at the end of the PowerPoint the sources should be there"): with web pages or a file, each slide prompt asks for `[n]` after every point / row / number (`[F]` = his file); `parseSlide` takes the citations off the text into `slide.cites` (notes' citations ignored; a citation never becomes a chart number); each slide's footer reads "Sources: [1] example.com · [F] fleet.xlsx"; `fullDeck` adds a **Sources** slide before "Thank you" (`sourcesOf`: the cited pages, or all when none were cited) with titles and links; hand edits keep the slide's citations. Reports cite `[n]` in the text too, and list `[F]` with the web pages. **Words per point:** Short / Detailed (20–30-word sentences; also from the request: "detailed", «مفصل», "brief", «مختصر»). The Arabic preview now keeps English words / links in their own order inside right-to-left lines.
- Kotlin changed: `DocTools.makePdf(blocks, images, fullPage)` + `NativeBridge.makePdf` passes `fullPage` — compile-checked only by CI.
- Free: 2 a day (`attune:slides:day`), Pro unlimited (PRO_BENEFITS line). New icon `Presentation` in lucide-shim.
- **Verified in the sandbox:** python-pptx and python-docx open the files; all parts/relationships present; every animation targets a real shape; ids unique (unit v540). **Not verifiable here:** opening in real PowerPoint / Google Slides / WPS on the phone (and how Google Slides shows the animations — it supports fewer effects) (LibreOffice is broken in the sandbox) — ask Ali to open a saved .pptx; slide quality from a 2–4B model.
- Tests: unit v540, e2e_v540 (`SHOTS=<dir>` saves screenshots of every slide).

### 5.27 v5.41 — Ali's phone test after v5.40 (27 Sep 2026: 15 points; 1–6, 8–10, 12, 13, 15 done here)
- **#2 Video Downloader "P/as/te"**: the Paste button could shrink; with his bigger Text size the word broke letter by letter → `shrink-0 whitespace-nowrap`, the link box `min-w-0`. The audit now has a **squeezed-label** check (a one-word label on 2+ lines) and an **en-narrow** pass at 320 px (text as big for the width as with a larger Text size); it also caught "Construction" (Slides designs → 3 columns under 380 px), "Dictate" (Site reports), "DuckDuckGo" (Engine), "$39.99" (Plan).
- **#9/#10 website: garbled HTML and no Preview**: "A landing page for my crane rental company…" didn't count as a code task, so it went through plain chat, where DRY / no_repeat_ngram punish HTML's natural repeats (`<div class=` × 20) → "divclass", "</div</div>", "padding: 150 20 0". `looksLikeWebsiteTask` (verify.js, EN + AR) → `looksLikeCodeTask`; the Website builder assistant (`a-web`) always takes the code route with `lang: "html"` (`codeTask(..., {lang})`); any request that asks for code / contains ``` gets no DRY / n-gram in the model call (`codeAsk`); `detectArtifact` shows Preview for an unclosed ```html page.
- **#12 File Converter options**: a "What do you want to do?" grid (`QUICK`: Merge PDFs, PDF → Word, Photos → PDF, Scan → Word, Translate, Split, Keep pages, Rotate, Word → PDF, PDF → pictures, Excel ↔ CSV, Photo format) sets the picker (accept / multiple) and preselects the target; Merge with one file explains how to pick several.
- **#13 Zenith "loaded" without download**: tapping a card only selected it, but the status said "<selected> loaded" and the header chip + **the power profile followed the selection** (Blaze+ ran with Zenith's expert prompts/token budgets — slower and worse). `tierOfInstalled(m)` maps an installed model to its tier; `runningTier` (the active installed model) drives `setPower` and the chip; Engine shows "Running now: X. You picked Y." with **Download Y** or **Use Y (already on this phone)** (`engine-download-selected` / `engine-use-selected`).
- **#15 + #3 Back "for good"**: `setMode` keeps a screen history (`modeHist`; Chat clears it); Back = overlays → the tool's inner page (`popBack`) → the previous screen → Chat → leave. `useSticky(key, init)` (backstack.js, in-memory Map) keeps each tool's place when it unmounts: Learn (course/view/lesson/quiz), News, Chat X-Ray (chat/result/tab), Converter (files/target/result), Deal (text/result), Business (system/view/tab), Slides (deck/report/edit), Projects (open project), Video (found), Studio (mode, description).
- **#3 Studio sharpening restarted**: the job's state lived in the screen; leaving Studio lost the progress and the finished picture was never added (its React updater never ran). Now module-level `LIVE` (busy, cur, callId, `hub` = the mounted screen's setters) and `commitPic` (saves to storage directly); `attune:studio:pending` notes a running draw/upscale — after a reload Studio polls `imageList` every 3 s for the file (`<name>-x4.png` for sharpening) up to 25 min ("Still working — it carried on while you were away…"); the recovery also takes `-x4` files now.
- **#4 Chat X-Ray asking**: `askKind` → **about** ("what was it about", «ملخص», «كانوا بيتكلموا عن إيه»: `overviewSample` spreads ~12 stretches of the whole chat → `overviewMessages` topics with dates) · **mention** ("was “X” mentioned", «هل اتقال "…"»: `mentionTerm` + `findMentions` (Arabic normalised, «ال» optional) + `mentionAnswer` — by code, instant, who/when/count) · other (search as before). Model calls time out after 150 s; Stop button; suggestion chips.
- **#6 Deal Check maths**: "12,400 EGP or 3 × 4,133 with valU" was read by the model as 12,400 down + 3 × 4,133 → total 24,799 < price, "−13,201". `plansIn` (deal.js) reads plans by code: "N × M", "M × N months", "M a month for N", "N installments of M", «قسط M على N شهر», "X or N × M" (X = the cash price), "down payment / مقدم D"; it overrides the model's reading. `planCost` flags a plan cheaper than cash as `inconsistent` (reason: ask for the exact total), rounding (≤ 0.2 %) = 0. `priceMismatch` (two prices ≥ 1.6× apart in one offer) → sign "two-prices" (weight 2).
- **#5 PDF → Word format**: Android `pdfText` now returns per line `{y, x, s, b, sp: [[x, text, size, [[wordX, word]…]]]}` (`LayoutStripper` overrides `writeString`, groups words by baseline, splits spans at gaps > 1.6 × size, marks raised smaller words as `^(…)`), plus page width `w`; fallback = plain text. `pdfLinesToBlocks` (convert.js): body size by character count; headings (≥ 1.18 × body, or bold short lines), paragraphs (wrapped lines joined), lists with `num` (and their wrapped lines), tables (2+ lines whose spans line up; columns from the body rows by text centre; a header with fewer spans is split word by word). Word: numbered items as "1.\t…", bullets "•\t…", `^(…)` → real superscript runs; Kotlin makePdf prints `num`. Checked on a simulation of Ali's GUC assignment PDF (all 3 tables exact, questions 1–6 numbered); the stray base "2" of 2^−ΔΔCt may still land at the line end — **check on the phone**.
- **#8 web "Lynk & Co 90"**: `fixModelNames` (answerfix.js) puts back a model name's number that lost/gained a digit (names from the question + names written 2+ times in the sources; one-word prefixes only when model-like: LTM, iPhone); never touches a name the sources really write (Lynk & Co 09). GROUNDED_RULES: copy the product name exactly. **Honest note**: the digit slip is the small model itself (LiteRT copy mode already has no penalties); the guard fixes names, `repairFigures`/audit fix figures.
- **#1 edit a deck by a sentence**: `parseDeckCommand` (slides.js, EN + AR, numbers as on the thumbnails): delete / move / swap / add a slide about X (after N) / "slide N: …" (rewrite with the instruction, or "make it a table" → that type) / title / design + motion words / anything else → every content slide rewritten with it. Deck screen: "Change the presentation" box (`deck-cmd`, `deck-cmd-go`, `deck-cmd-note`).
- **Not in this release** (next): #7 health & food app (v5.42), #11 Business as a full app (v5.43), #14 launch hardening — model quality and phone load (v5.44).
- Kotlin changed: `DocTools` (LayoutStripper, layoutLines, makePdf `num`). Tests: unit v541, e2e_v541; audit.py squeezed check + en-narrow.
### 5.28 v5.42 → v6.1 — Fit & Food, the last fixes, and the launch build (28 Sep 2026)
Ali: "make the fit app a huge database of recipes, meals and food photo recognition — widely better than Yazio"; "find why it didn't finish the code of the website"; "Studio took 10 min to sharpen and only finished 6 of 25"; "in Deal Check, if the AI doesn't understand the offer, make it ask 'do you mean that?' — yes or no and he explains"; "make the PowerPoint writing more accurate"; #11 Business as a full app; #14 launch; "make the app v6.1 as the final build".
- **v5.42 Fit & Food** (More → Your life, first tile; `fit.js` engine, `fit-foods.js` data, `fit-ui.jsx` screen): 361 foods per 100 g (Egyptian, Gulf/Levant, fast food, drinks, sweets; EN + AR names with spelling variants) and 53 recipes (per serving, computed from the table). **Every number is code**: `matchFood` / `quickParse` read "٢ بيض ورغيف عيش وطبق فول" without a model (instant, table values); a photo or a harder sentence goes to the model (`mealMessages` → `parseMeal`), but a food found in the table always uses the table's values; unknown foods are estimates whose macros are rescaled to their calories. The person **confirms every item and can change grams** before saving. `targets` = Mifflin-St Jeor + activity; safety: under 18 / pregnant / BMI < 18.5 → no deficit, floors 1500/1200 kcal, pace capped at ¼ of TDEE. Today: ring, macros, fibre, tips (`dayTips`), water, fasting timer (`FASTS`), a suggested meal per slot from `mealPlan` (split 25/35/30/10 %, diet-aware — vegetarian/keto/low-carb — portions ×0.5–2 in quarters, seed = the day). Recipes: search by name or ingredient, tag filters, favourites, "what's in your fridge" → `recipeMessages`/`parseRecipe` (only table foods counted). Move: MET activities (`burned` = MET × kg × h), 5 guided plans with a timer ("Quick HIIT — 8 moves", renamed: it is ~5 min), AI weekly plan. Progress: 7-day bars, streak, weight + 7-entry average line. Chat: "I ate…" / «كلت…» → chip "🍽 Log it in Fit & Food" (`looksLikeFoodLog`). Data: `attune:fit:v1` (localStorage). Icons added to lucide-shim: Apple, Dumbbell, Camera.
- **v5.43 website not finishing**: on a phone the engine opens a 4k window, so `codeTokens` = 2,048 and a full site stopped mid-tag. `workLoop` now continues a page that ends before `</html>` (`isCutHtml` → `continueMessages(task, last 1,800 chars)` → `joinCont` drops a fence, a restarted file and any repeated overlap), up to 3 times; the brief asks for compact CSS. Step text "The page was cut off — writing the rest…".
- **v5.43 Studio sharpening**: Real-ESRGAN ×4 needs ~25 s per 128-px tile on a phone CPU (a 640-px picture = 25 tiles ≈ 10+ min — Ali saw 6 of 25). New native **`sharpenFast`** (ImageEngine.kt: ×2 bilinear + 3×3 unsharp mask 0.7, `<name>-x2.png`, < 1 s, no download). "Highest resolution" uses it automatically when the picture was drawn on the CPU (or the ×4 pack isn't installed); ×4 stays for the GPU. Buttons "×2 sharper · instant" and "×4 AI sharpen · ~N min" (N from the tile count); on the CPU ×4 asks first ("Start ×4" / Cancel); "about N min left" while it runs; ×4 of a ×2 picture starts from the original.
- **v5.43 Deal Check "Do you mean…?"**: the check is now read → (question) → judge. `needsConfirm(terms, text, plan)` by code: two prices ≥ 1.6× apart (a number labelled deposit / down / fee / عربون / مقدم / رسوم is not a second price — `labelledPart`), no price, installments adding up to < 90 % of cash, months without an amount, or the model's own `unclear` question (new field in `extractMessages`). `readingOf` says the reading back in one sentence (EN/AR). **Yes** → the check goes on with that reading (no second model call); **No** → "explain what you mean" → `withClarification` (the buyer's words win) → read again, never asked twice.
- **v5.43 slides more accurate**: slide text at temperature 0.3 (was 0.5); a text slide (not stats/chart, which drop figures by code) whose numbers aren't in the sources is written once more with `figureFixNote` (the exact numbers named); `tidySlide` leaves out points that still carry them and points repeated from earlier slides (never empties a slide); one-digit figures with a scale ("2 million", "5%", «٣ مليار») are checked too; the prompt forbids filler and unsure facts. A slide the person asked to change ("slide 3: add prices") is only flagged, not pruned. "Has sources" = web pages or the file (`d.source` alone is the prompt).
- **v5.44 Business combines databases** (More tab, first card "Combine your data"): `linkSuggestions` finds a text/choice column whose values name another table's records (≥ 60 %, spelling/case ignored, the other table's own names only) → "Link them" (`linkColumn`: adds the missing names to the other table, then `changeType` → link; one Undo reverts all). Import of a second sheet: `keyFor` finds the key column (unique, matching records) → "Merge into T (same K = same record)" (`mergeRows`: updates only the cells the sheet has, adds the rest, no duplicates). "T with its linked tables" → `combinedView` (the linked tables' columns beside each record, like an Access join) → CSV. Import bug fixed: phones / 0-codes were typed as numbers and lost the leading 0 (`guessType`).
- **v6.1 launch hardening**: the Engine list on a phone shows only models worth using on it — Spark (0.8B) only when nothing else fits, Glow (2B) only when no stronger model runs smoothly, nothing too big for the phone; installed/selected always shown; "Show all models (N more…)" (`tiers-show-all`). Android `onTrimMemory(TRIM_MEMORY_BACKGROUND)` lets the model go when the phone needs memory and Attune is in the background (not while writing/drawing — `GenService.busy()`), logged in Engine log; it reloads on resume. Library: no developer text; no request to the unset `REMOTE_LIBRARY_URL`.
- Version: versionCode 61, versionName "6.1", `PAGE_VERSION` "6.1".
- Kotlin changed (CI-only verification): `ImageEngine.sharpenFast`, `NativeBridge.sharpenFast`, `MainActivity.onTrimMemory/onResume`, `GenService.busy`. Tests: unit v542 v543 v544, e2e_v542 (Fit), e2e_v543 (website / Studio / Deal), e2e_v544 (Business), e2e_v61 (model list, Library).
- **Still open for release** (§0.1 "Open items"): `SELLER.contact`, `TESTING_ALL_PRO = false`, Play listing text.
### 5.29 v6.1.1 — a food database bigger than Yazio, on-device photo recognition, Studio on the GPU (28 Sep 2026)
Ali: "a database bigger than Yazio in everything and an elite photo food recognition" — asked, he chose **photos on the phone only (no cloud)** and **online food databases, saved on the phone**. Then: "a mobile has a GPU, why can't I use it for photo generation?"
- **Database** (`fitdb.js`): the built-in table (offline) + **Open Food Facts** (~3.5 M packaged products with barcodes; Egyptian products asked first: `countries=egypt`, then the world, by popularity) + **USDA FoodData Central** (Foundation, SR Legacy, FNDDS; key `DEMO_KEY` — 30 requests/hour per IP; put a free own key in `usdaSearchUrl` before launch if people search a lot). Asked through the native **`fetchJson(id, url)`** (WebTools.foodJson: only `*.openfoodfacts.org` and `api.nal.usda.gov`, Offline lock + Network log apply, UA "Attune/6.1"). `fromOFF` / `fromUSDA` read per-100 g values (kJ → kcal; incomplete labels dropped; `consistent` flags a label whose macros can't make its energy: "label may be wrong"); household measures and the product's serving become portions. **Every food found is kept on the phone** (`attune:fit:foods:v1`, up to 4,000, least recently used dropped) — `searchOffline` finds it next time without internet. Search ranking: exact name first, Egyptian products up, flagged labels down; an Arabic query asks USDA with the table's English name. Barcodes: the check digit (`validBarcode`), a typed barcode in search, or **"Scan a barcode"** (photo → native **`scanBarcode`**, ML Kit `com.google.mlkit:barcode-scanning:17.3.0`, bundled model, offline) → `byBarcode` (phone copy, then Open Food Facts).
- **Photo recognition on the phone** (fit.js, same vision model, used better): `photoMessages` asks for kind (meal / label / package), per item the food + **2 alternatives + grams + confidence**, portions judged against things of known size (26 cm plate, spoon, can, baladi loaf, palm). **A barcode in the photo is read first** (exact product). A **nutrition label** is read as numbers (`parsePhoto` → a food per 100 g, "per serving" converted). A **second look** (`hiddenMessages` → `parseHidden`) adds the calories people forget — oil, butter, ghee, sauces, tahini, sugar, drinks, bread on the side — never a food twice, never > 400 g. Screen: a confidence dot, "Is it: …" chips (`chooseFood`), "something else…" (search any food, online too), portion buttons ×0.5 · ×0.75 · as seen · ×1.5 · ×2 (`scaleItem`), "easy to miss" badge. **Corrections are learned** (`learnFix` → `attune:fit:learn:v1`: what the model said → the food chosen + the person's portion ratio); the next photo shows "as you corrected it".
- **Studio on the GPU**: one failed GPU run (the first Adreno start compiles its programs for minutes, or GPU memory was still taken) switched Studio to the CPU **for good**. Now CPU only after **2 failures in a row** (`image_gpu_fails`), a success resets it, and after an app update an automatic switch-off is undone once (`retryGpuAfterUpdate`; the person's own switch is kept). Studio shows "Use the graphics chip" when it draws on the CPU while the GPU engine is there. The GPU engine is OpenCL (Adreno) — **if it still says no GPU on Ali's Magic 8 Pro, get Engine → Engine log after one Studio try: it has the `--list-devices` output.**
- Kotlin (CI-only check): `WebTools.foodJson`, `NativeBridge.fetchJson/scanBarcode`, ImageEngine GPU retry; Gradle: ML Kit barcode. Tests: unit v611, e2e_v611 (database, barcode, photo guesses, hidden oil, learned correction, label), e2e_v542/e2e_v543 updated. Version 6.1.1 (versionCode 62).
### 5.30 v6.2 — Fit & Food "better than Yazio by levels" (28 Sep 2026)
Ali: "how is there a mobile without a GPU" (answered: every phone has one — Studio had lost access to it, fixed in 6.1.1) and "make it better than Yazio by levels". All code, no model: `fitplus.js` (engine) + `fitplus-ui.jsx` (screens), wired into fit-ui.jsx.
- **Faster logging** (top of the log sheet, `QuickLog`): recent & frequent foods (`frequentFoods`, 30 days), "Same as yesterday" (`copyMeal`), saved "my meals" (`myMeal`, `SaveMyMeal` under the draft, `st.myMeals`), "My own food" from a label per 100 g or per serving (`customFood` → kept in the phone's food copy, searchable).
- **Food quality**: sugar, saturated fat and salt carried from Open Food Facts (`sugars_100g`, `saturated-fat_100g`, `salt_100g` / sodium × 2.5) and USDA (2000/1063, 1258, 1093 mg Na) into every logged item (scaled with portions); Nutri-Score letter + NOVA group badges (`Grades`). Today: **day score 0–100** (`dayScore`: calories near goal, protein, fibre, water, sugar & salt limits — 20 each) and bars against `limits` (sugar & sat. fat 10 % of energy, salt 5 g — WHO), with "from N of M foods whose labels give them" (the built-in table has no sugar/salt yet).
- **Ramadan mode** (My plan → 🌙): 16 cities (Egypt + Gulf + Istanbul) each with its own time zone (`zoneOffset` via Intl, summer time included — the device clock is NOT used); `fastTimes` = NOAA sun position, Fajr 19.5° (Egyptian General Authority), Maghrib 0.833°, checked against published Cairo times (±3 min, the card says so); countdown to Iftar / end of Suhoor; slots renamed Suhoor / Iftar / After Taraweeh / Snacks (`RAMADAN_NAMES`, same storage slots); `ramadanPlan` 45/20/35 % and a glass of water every N minutes from Maghrib to Fajr; 3 tips.
- **Body**: US Navy body fat from waist/neck(/hip) + height (`bodyFat`, `bodyFatClass`), saved history (`st.body`).
- **Week plan + shopping list** (Recipes → "Plan my week"): `weekPlan` (7 × `mealPlan`, seed per date), `shoppingList` (ingredients × servings × portion, rounded up to 50 g, by shop section), `shoppingText` → Share (WhatsApp) / Copy.
- **Weekly report** (Progress, `weekReport`): days logged, average vs goal, days on target, protein days, weight change and direction, next-week advice.
- **Reminders** (My plan): meals 09:00 / 14:30 / 20:30 and water 10–22 h, daily, ids `daily-fit-…` (daily-ui.jsx now only cleans `daily-learn-` / `daily-news-`; actions.js keeps every `daily-` id).
- Tests: unit v62, e2e_v62 (EN + AR). Version 6.2 (versionCode 63).
- **Ideas not done yet** (next levels): sugar/salt values for the built-in Egyptian table; steps from Health Connect (native, permissions); recipe scaling by servings; body photos; a home-screen widget for calories left.
### 5.31 v6.3 — food input like Yazio's AI, better photo recognition, watches (28 Sep 2026)
Ali: "I want the photo recognition to be better than Yazio and to have an AI inputting food like Yazio. Test everything in the app by yourself — not just the code: the logic of the answers, the path, its reliability. Top notch in everything, even minor details. Connect it to watches for steps, calories burned etc." (photos stay on the phone — his earlier choice).
- **Measured, not guessed** (`tests/eval/`): `meals.mjs` = 127 real sentences (English, Egyptian Arabic, mixed) with the foods and gram ranges a dietitian would log, plus 10 broken model answers; `holdout.mjs` = 60 more written AFTER tuning; `run.mjs` scores them (`node tests/eval/run.mjs -v` lists every miss). Before: the old reader got **56 %** of meals fully right, 5/10 broken answers repaired. The new reader: 127/127, 10/10; on the unseen set **88 % on first contact** (53/60), 100 % after fixing the general rules it exposed (sandwich + filling, a generic word before a specific one, «علبة» of yogurt, half a pizza). Unit v63 fails if the scores drop (≥ 97 % / ≥ 95 % / 10 of 10).
- **The reader** (`fitread.js` `readMealText`): digits / Arabic digits / words / fractions («نص»، «ربع»، 1/2, "x3"), Arabic duals («بيضتين»، «رغيفين»، «حتتين»، «معلقتين»…), kilo fractions («ربع كيلو» = 250 g), units («طبق»، «كوباية»، «علبة»، «سيخ»…), sizes («كبير»، "large", on the food's own small/large portion), ~400 names people use (pepsi → cola, falafel → taameya, «بانيه»…), glued «و/ب/بال» («وبيبسي»، «بالعسل»), "X with Y" split, "fried" variants, "no sugar", "a … meal" → fries + drink, sugar "spoons" = teaspoons, «نص فرخة» = the half-chicken dish, the same food twice merged, amounts nobody eats capped and flagged (`checkAmount`). Only words it can't place go to the model (`mealMessages` on the leftovers), and the model's JSON is repaired by `parseMealChecked` (fences, trailing commas, arrays, kg / teaspoons, zero or negative amounts, duplicates, Arabic names). **Bug found by the measuring set**: a reading marked the shared name list ("skip"), so "eggs" vanished from every later sentence — each reading now works on copies.
- **Talking to the list** (`draftCommand`): "remove the cola" / «شيل البيبسي», "rice 200 g" / «الرز ٢٠٠ جرام», "make it 3 eggs" / «خليهم ٤ بيض», "add a spoon of oil" / «ضيف معلقة زيت», "double / half the rice"; anything else changes nothing and says so. Screen: a mic on the log sheet ("Say it", `listen` → NativeBridge.listen, ar-EG when the app is in Arabic) and a "Change something" box with its own mic under the read meal.
- **Photos** (fit.js): the model picks names from `DISH_NAMES` (300+ table names — a closed list makes a small vision model far more accurate); per item it gives a count, a container, the share of the plate it covers and its height (things a vision model judges well); `geoGrams` turns that into grams (plate area × height × density by food kind, or count × the food's piece, or the container's portion); blended with the model's grams (geometric mean), **flagged "check the portion"** when they differ > 2.5×. Items the model is unsure of (confidence < 0.6, with a box) get a **zoomed second look** (`cropPhoto` in fit-ui: the box + margin, enlarged to 640 px → `zoomMessages` → `applyZoom`, which never lets a less sure answer override a surer one). Then the hidden-calories pass as before.
- **Watches** (`Health.kt`, read only): Health Connect (Samsung Health / Galaxy Watch, Fitbit / Pixel Watch, Garmin Connect, Mi Fitness… anything that shares to it) → steps, active + total calories, distance, heart rate avg/max, workouts of the day. NativeBridge `healthStatus` / `healthConnect` (Health Connect's permission screen, or its Play Store page) / `healthDay`; manifest: 6 READ permissions, the Health Connect package query, the rationale intent, the Android 14 permission-usage alias. **Library: `connect-client:1.1.0-alpha07`** — 1.1.0 final needs compileSdk 36 + AGP 8.9.1 (the branch build failed with exactly that; moving the whole toolchain is a separate job). Fit: `WatchCard` on Today (compact, "Later" hides it) and Move; refreshed on open, on return to the app and after the permission screen; stored per day (`day.watch`). **Burned = max(watch active kcal, logged workouts)** — never both (`dayTotals`). *Honor watches*: Honor Health's Health Connect support is not confirmed — check on Ali's phone.
- Also from reading the answers, not the code: the day's score card showed "Sugar 0/53 g" when no food had sugar data (now "—" and why), and a red score at lunchtime (now "so far" until 20:00). Logic sweeps (unit v63b): 15,120 body profiles (floors, no unsafe deficit, macros add up), 5 diets × 30 days of meal plans, 16 cities × 365 days of Ramadan times (Istanbul's winter Fajr is really ~06:40 — UTC+3 all year), body fat rising with the waist, the score peaking at the target, all 361 table foods read back by their own names.
- Tests: unit v63 (includes the eval gates), unit v63b (sweeps), e2e_v63 (mock mic, mock Health Connect, the zoomed look with a real PNG crop). The Android code was built on the branch first (workflow_dispatch) before merging to main.

### 5.32 v6.4 — ≥ 90 % of meals right (measured on unseen sets), correct once → right next time, favorites, copyable engine log (28 Sep 2026)
Ali: "make the engine log can be copied so I can send it to you; in the food app make a favorites option; I want at least 90 percent of the meals correct and the other 10 percent can be corrected easily, and auto corrects the next time".
- **Measured honestly**: two NEW sets written before the changes they measure. `tests/eval/blind.mjs` (79 meals: typos, loose spelling, shop names, home dishes, long sentences) scored **67 % on first contact**; `tests/eval/fresh.mjs` (60 meals, written after blind was tuned) scored **85 % on first contact**. After the general fixes all four sets are 100 % (127 / 60 / 79 / 60) and broken model answers 10/10. Unit v64 fails under 97 / 95 / 90 / 90 %. The first-contact numbers are the honest guide for sentences nobody has written yet: expect roughly 85–95 %, the rest fixed with one tap.
- **General reader fixes** (`fitread.js`): `fixTypos` (Damerau distance to the words the reader knows; 1 edit, 2 for words of 7+ letters; a same-length word wins a tie — "egs" → egg; never touches «و/ب/بال/ال» + a known word such as «ورز» / «ورغيف», or «عند»); shop names removed BEFORE typo fixing ("pizza hut pepperoni" → pepperoni pizza; KFC → fried chicken; «من عند جاد» → nothing); punctuation splits parts; «و» glued to number words; «تلت فرخة»; a stew + «باللحمة» is one dish (the meat is in it), «بامية ولحمة» stays two; «نص بطيخة» = half the whole fruit (watermelon cap 4 kg); «طعمية» alone = 4 pieces, «بيض» alone = 2 eggs (`bare`); milk in tea/coffee with no amount = a 50 g splash; «شاي بلبن» = tea with milk; cheeseburger, chocolate cake, espresso, shawarma plate, «برتقالتين» and ~40 home dishes added.
- **Easy correction**: every typed item carries `said` (the words it came from), `explicit` (a number or grams written), `readBase`, `base` and `alts` (`altsFor`: the food's family — rice → vermicelli rice / brown rice…); the draft shows "Is it: …" chips + "something else…" on EVERY typed item and ×0.5…×2 "as written". A typed food swapped takes the new food's own portion (`chooseFood` with `from: "text"`; photo items keep their grams).
- **Auto-correct next time**: on Save, a typed item that was swapped, or whose unwritten portion changed > 10 %, is learned under `"t:" + said` (`learnFix`, the same store as photos — `attune:fit:learn:v1`). `applyLearned` runs on every reading: the learned food always; your portion only when you didn't write the amount («رز ١٠٠ جرام» stays 100 g). A dish the code didn't know, read by the model and corrected, is read by the code next time (no model). Items show "as you corrected it"; correcting back is learned too.
- **Favorites**: ★ on every draft item (`fit-fav-toggle`) keeps the food at the grams you starred it at (`toggleFav` / `isFav` in fitplus.js, `st.favFoods`, 40 max, newest first); a "★ Favorites" row at the top of the log sheet adds it with one tap; tap the star again to remove. (Recipes keep their own ★ filter.)
- **Engine log** (attune.jsx, Engine → Engine log): selectable text, "Copy log" (clipboard, with a fallback) and "Send log" (share sheet), headed with the app version, time, phone, SoC, RAM and model.
- Tests: unit v64 (gates + every fix + learn cycle + favorites), e2e_v64 (copy/send the log; swap + regram once → next time brown rice 300 g "as you corrected it"; star → Favorites → one tap → un-star).

### 5.33 v6.4.1 — Huawei watches through Health Sync (28 Sep 2026)
Ali: "I want also Huawei Health connected".
- **The fact that decides the design**: Huawei Health does not share its data with Android's Health Connect (Huawei keeps it in its own Health Kit). Reading it directly means Huawei's Health Kit SDK + HMS Core + an AppGallery Connect project and Huawei's approval of the app for health scopes — that needs Ali's Huawei developer account and weeks of review, so it is NOT done. The working route today: **Health Sync** (`nl.appyhapps.healthsync`, third-party, free trial then a small payment to its maker) copies Huawei Health → Health Connect, and Attune reads it exactly like every other watch (v6.3 code unchanged).
- Kotlin: `Health.installed` + `healthStatus` now also says `huawei` (com.huawei.health on the phone) and `healthSync`; NativeBridge `openHealthApp(pkg)` opens one of those two ONLY (launch if installed, else Play Store, else Huawei AppGallery `appmarket://`, else the web page); manifest `<queries>` for both packages.
- Screen (`HuaweiGuide` in fitplus-ui.jsx): a phone with Huawei Health sees the 4 steps by itself (install/open Health Sync → source Huawei Health + Huawei ID → destination Health Connect + the 5 data types → back here, Connect, Refresh), with buttons; others get a small "Huawei watch?" link. When the day's data sources include Health Sync the card says "Huawei Health, through Health Sync ✓" and the steps go away; "Hide" remembers (`st.huaweiHide`). Honest limit shown in the app: newer Huawei phones without Google services have no Health Connect, so this route needs a phone with Google services (the watch can still be Huawei).
- Tests: e2e_v641 (with and without Huawei Health; buttons open only those apps; the Health Sync source is recognised).

### 5.34 v6.5 — Huawei Health directly (Health Kit, like Yazio), a bigger food database, a glitch sweep (28 Sep 2026)
Ali: "Yazio has Huawei Health, so try to do it; also make sure there is a huge database and there are no glitches in all of Attune, nor logic constraints".
- **Huawei Health Kit** (`HuaweiHealth.kt`, `com.huawei.hms:health:6.11.0.303` from Huawei's Maven repo — version taken from Huawei's own `HMS-Core/hms-health-demo-kotlin`): Huawei ID sign-in + read scopes (steps, calories, distance, heart rate) through `SettingController.requestAuthorizationIntent` (MainActivity `askHuaweiPermission` → the `attune-health-permission` event with `{huawei: ok}`); a day = `readTodaySummation` / `readDailySummation` per type, fields read by name so the same code survives field renames; same JSON shape as Health Connect's day. NativeBridge `huaweiStatus` / `huaweiConnect` / `huaweiDay`; `openHealthApp` also opens HMS Core (`com.huawei.hwid`). Works on Huawei phones without Google services (HMS Core) and on other phones with HMS Core + Huawei Health.
- **OFF until the App ID is set**: `gradle.properties` → `attune.hmsAppId=` → manifest `com.huawei.hms.client.appid`. Empty → `configured:false` and the app offers the Health Sync route (§5.33). **What only Ali can do** (needs his Huawei developer account): developer.huawei.com → register + verify → AppGallery Connect → new project → Android app `com.aldibiki.attune` → SHA-256 of the signing key (test key: `95:ED:98:12:B5:5C:6C:66:4F:AF:AD:51:3D:CF:34:E4:DE:91:4D:54:EB:83:2E:FB:5B:68:77:23:D5:2F:9F:65`; a Play release key needs its own) → Health Kit → apply for read access to steps, calories, distance, heart rate → add his Huawei ID as a test user (works before Huawei's review ends) → the App ID into `gradle.properties`. Nothing else changes.
- Screen: "Connect Huawei Health" (or "install HMS Core first") on Today and Move; Health Connect and Huawei read side by side, **each number the larger, never the sum** (`mergeWatch` — Health Sync may copy the same steps into both); a refusal or an empty day says what to do (Huawei Health → Me → Privacy → Data sharing).
- **Database**: USDA's branded foods (~450,000 packaged products, brand + barcode + label serving) are searched when the other sources give < 12 answers (one extra call only: the free USDA key allows ~30 calls an hour per phone); a barcode Open Food Facts doesn't know is looked up in USDA's branded foods; no internet still reports the network error, not "unknown product". Together with Open Food Facts (millions of products, Egyptian ones first) and USDA's generic foods: larger than Yazio's catalogue; 588 foods + 90 recipes built in, everything used is kept on the phone.
- **Glitch sweep**: 30,000 random sentences (numbers, units, junk, emoji…) through the reader and the edit commands, broken model JSON, odd profiles, broken factors. **Found**: the words "constructor" / "toString" crashed the reader (lookup tables inherited JavaScript's own names) → prototype-free tables; `learned()` own keys only; `scaleItem` guards a broken factor. Every exported function of the other 29 logic modules was fed odd text: the crashes were all wrong argument types the app never passes (false alarms) or intended messages ("That file isn't a Word file"); a damaged saved setting could have given NaN in `powerFor`, `fitChars`, `trialDaysLeft` → hardened.
- Tests: unit v65 (seeded fuzz, 8,000 sentences), unit v65b (database), e2e_v65 (direct Huawei: connect, merge, refusal, no HMS Core). Built on the branch first (workflow_dispatch) before main.

### 5.35 v6.6 — every calculating tool checked for RIGHT answers, not just "no crash" (28 Sep 2026)
Ali: "I didn't say it will crash — test that you get all logical and correct answers in everything".
- `tests/eval/logic.mjs` (`node tests/eval/logic.mjs -v`): 115 questions whose answers were worked out OUTSIDE Attune — by hand, in Python (instalment interest by bisection), from the WMO Beaufort table, Excel's ROUND, the crane makers' chart rules, Mifflin-St Jeor and the US Navy body-fat formula. Tools: crane (33), calculator (28), Deal Check (20), debts (5), business formulas (11), the AI-arithmetic checker (7), file conversion (2), body maths (9). Unit v66 fails on any wrong answer.
- **First contact: 92 of 103 right (89 %).** What was wrong:
  - Calculator: «١٢٠٠٠ + ١٤ في المية» gave **12,014** (14 added, not 14 %) — a confidently wrong total; «١٤٪» (Arabic percent sign) the same. Now «في المية / بالمية / ٪» = %, and «٣ في ٤ كام» = 3 × 4 — «في» counts as × only when the message asks for a result (كام، احسب، يساوي، =) and never before a year: «معاد 5 في 6» (a date) and «اشتريت 3 في 2025» stay text.
  - Crane: Beaufort limits were not the WMO table (0.3 m/s read as force 0, 1.5 as 2, 32.6 as 12); a boom between chart columns whose shorter column can't reach the radius said "not permitted" — the manufacturers' rule is the NEXT LONGER boom's rating (now used, with a "check the boom reaches it" note; a longer boom with no rating still refuses).
  - Business formulas: ROUND halved negatives toward zero (ROUND(−2.5) = −2, ROUND(−2.345,2) = −2.34) — now like Excel (−3, −2.35; ROUND(1.005,2) = 1.01).
  - Deal Check: «١٢ قسط × ٣٠٠٠» wasn't read as a plan.
- Right from the start: instalment interest (12,000 vs 1,100 × 12 = 19.53 %/yr — matches Python), fees as interest, "cheaper than cash" never shown as a saving, lift % and levels, outrigger pressure and mat size, sling tension, wind, debts per person and currency, dates in formulas, ÷ 0, self-reference, column totals without float noise, the AI-arithmetic checker, CSV/Excel round trips, BMR/TDEE/BMI/body fat.
- Not covered by this set: answers the AI model writes itself (chat, research, slides text). Those are guarded by code already — sums are done by the calculator, written arithmetic is re-checked and corrected (`arithmeticSlips`/`fixSlips`), figures are cross-checked against the sources (`repairFigures`), reasoning answers are voted — but their wording depends on the model on the phone.

### 5.36 v6.7 — Google Play Billing (automatic, no WhatsApp), higher prices, Fit Pro limits, 43 countries, 35 AI tools (28 Sep 2026)
Ali: "prices a bit more — I offer a lot; no WhatsApp; Google Play or InstaPay, easy, automated, no effort for me or the customers; businesses pay easier and automated; make it a huge database".
- **Billing.kt** (`com.android.billingclient:billing-ktx:7.1.1`, built on the branch first — green): `attune_pro_monthly` / `attune_pro_yearly` (subscriptions), `attune_pro_lifetime` (one-time), `attune_business_system` (one-time CONSUMABLE — consumed after it activates one system, so a company can buy the next). Pending purchases (carrier billing) enabled; every purchase acknowledged (Play refunds unacknowledged ones after 3 days). NativeBridge `storeProducts` / `storeBuy` / `storeOwned` / `storeConsume` → `window.ATTUNE_STORE` (installed after `NATIVE` is defined — putting it earlier crashes the page at load).
- **Plan screen**: Play's own local prices, one tap, "Payment pending" for carrier billing; NO WhatsApp / InstaPay buying; signed codes only behind "I have an activation code (company deals)". **Business → More**: "Activate this system · <Play price>"; a paid purchase that wasn't applied is offered ("Use your Google Play purchase on this system").
- **Why not InstaPay**: no fees, but no automatic payment confirmation for app developers — every transfer would need checking by hand, the effort Ali doesn't want. Documented in MONETIZATION.md §4 with the Play Console steps.
- **Prices** (billing.js `PRICES`): EGP 299 / 2,499 / 5,999, Business 14,999; USD 7.99 / 59.99 / 149.99 / 299.99. Unit v529 and e2e_v529 updated.
- **Fit on Free**: typed/spoken logging, barcode, search, favorites, the watch and 3 photo meals a day (`FREE_PHOTOS_PER_DAY`, `st.photoUse`); Pro: unlimited photos, week plan + shopping list, week report. A blocked photo is removed so typing works at once (found by e2e_v67).
- **Travel**: 12 more country packs (43): Maldives, Sri Lanka, Kenya, Tanzania & Zanzibar, Azerbaijan, Uzbekistan, Bosnia, Albania, Cyprus, Switzerland, Austria, USA — same full schema; visa rules added only where certain (mv, ke, ch, at, cy, us); without a rule the screen shows no visa badge.
- **Prompts for other AIs**: 22 more tools (35) in 5 families — chat (Copilot, Mistral, Qwen, Kimi, Meta AI), code & apps (Cursor, Claude Code, GitHub Copilot, v0, Lovable, Bolt, Replit), images & video (Midjourney, ChatGPT Images, Ideogram, Leonardo, Sora, Veo, Runway, Kling), music/voice/slides (Suno, Udio, ElevenLabs, Gamma, Canva); shared builders `codePrompt` / `appPrompt` / `imagePrompt` / `videoPrompt`; aspect/style controls via `ASPECT_TOOLS` / `STYLE_TOOLS`.
- **Real-model trials of every tool (Ali's request) are blocked**: the environment's network policy denies huggingface.co, so no real model can be downloaded here; the tests use the tiny random model. Ali was told how to allow it (environment → Network access). When it's open: download a ~4B instruct GGUF, run each tool through the page with the desktop llama-server, read the answers, fix prompts.
- **run_all failure logs worked**: `tests/fail-e2e_v5.log` showed the intermittent failure — under load two answers are "unusually slow", two hint buttons, a strict-mode click. Fixed in the test (`.last`).
- Tests: e2e_v67 (fake Google Play: prices, buy, pending, business activation + consume, unapplied purchase, Fit limits), e2e_v67b (22 new AI tools build correct prompts, 43 countries open).

### 5.37 v6.8 → v6.9 — every tool tried with real models, Mind (replaces Memory), every model one RAM tier lower, web search accurate + fast, every model max-tested (28–29 Sep 2026)
Ali: "make sure all functions give good answers by trying yourself"; "make my phone (12 GB, Honor Magic 8 Pro) run Zenith — less space, same power"; "instead of memory an app like mymind but much better"; "test every model and every thing in the app".
- **Real-model trials** (`tests/trials/`): `run.sh <model.gguf> [tools]` starts the desktop llama-server like the phone (flash attention, 8-bit KV) and `run.mjs` sends each tool its OWN prompt builders and parsers (Travel / Prompts / Instant / Memory prompts are pulled out of attune.jsx by `appsrc.mjs`, so they can't drift) with realistic requests; `report.md` has the raw answers + automatic checks. 25 tools: learn, slides, business, deal, xray, code, math, fit, travel, news, translate, action, prompts, instant, website, assistants, memory, projects, mind. Qwen3.5-4B went 28/34 → all green after the fixes below.
- **Fixes the trials found**: Learn — JSON after a stray backtick / an extra brace, key points taken from the visual or sections when missing, translation+pronunciation lines only for language courses, an accuracy rule. Chat X-Ray — a promise («هحولك») is not a payment; the same transfer counts once; who owes whom read from the words (حسابك/عليك); a clear «حولتلك 10000» the model skipped is added by code (`addMissedPayments`); a wrong message number is matched by amount/words; a booking asked + «تمام» is kept by code; the answer to a question is a candidate; Egyptian money words in the prompt. Actions — «فكرني … اكلم» is a reminder, not a call. Slides — an outline returned as JSON. Assistants — Accountant: every quantity, no invented taxes (the 4B invented a 1% "monopoly tax"); Crane expert answers in the question's language. Web pages — a named element (a table) is built as that element. Maps — «كمبوند» cut at its «و»; "where can I park". Instant — an answer in the wrong language is asked again (`answerfix.js wrongLanguage`).
- **Mind** (`mind.js` pure + `mind-ui.jsx`, mode id still "memory"): save anything; kind by code (link, product+price, quote, to-do, contact, place, recipe, code, photo, answer); the model files each item in the background while the screen is open (title, one line, 3–5 tags, same language; `tagMessages` / `parseTagReply` / `fileRecord`, max 2 tries); photos keep a 420 px thumbnail in IndexedDB (`attune-mind`/`thumbs`) and are read by the vision model in one call; plain-words search with filters (`parseQuery`: kinds, today/last week/last month/«الشهر اللي فات», months, pinned — whole words in any script; «في» never matches inside «وظيفي»); kind chips; Spaces (auto from tags + saved searches); From your past (on this day / a year ago / older, stable per day); an item: rename, tags, note, pin, remind me (phone reminder `m-<id>`), similar items, ask about it, find promises, forget; Ask your Mind = aiAsk, sources shown by CODE. Promises and Your words are tabs; every old record is kept; Mind's fields are in the BM25 index. Keeping a note never pops Engine open. Tests: unit v68mind, e2e_v68.
- **Zenith for 12 GB phones**: `.github/workflows/model-bench.yml` (ARM runner, KLD vs Q8_0 on English/Arabic/Egyptian Wikipedia + llama-bench). Qwen3.5-9B: Q4_K_M 5.68 GB, KLD ar 0.018, write 6.3 t/s → **IQ4_NL 5.37 GB, KLD 0.024, write 7.0 t/s (+11 %)**; 3-bit versions are worse AND slower on ARM. Zenith = IQ4_NL, smoothRam 12; on a 12 GB phone it is the "stronger" choice. Engine.kt `contextFor`: Qwen 3.5 keeps KV in 1 layer of 4, so a 12 GB phone gives Zenith 8K context (was 4K).
- **Every model**: `tests/models/catalogue.mjs` asks Hugging Face which file each catalogue model resolves to (ModelStore.resolveHf's rule), its size, its mmproj, and whether the 55 % memory rule accepts it on the smallest phone it is offered to. Fixed: Sense (5.13 GB) was offered to 8 GB phones the engine refuses → 12 GB; Core Lite on 4 GB → 6 GB; real sizes (Zenith+ 7.37, Apex 17.0, Apex+ 18.8, Spark 0.53); phoneMin 48 for Everest/Apex/Apex+; the Gemma files are not QAT (label removed). `tests/models/every_model.sh` runs all trials on Spark, Glow, Core Lite, Core, Core+, Sense, Zenith, Zenith+ (report-<name>.md, summary in every-model.txt). Spark 75/97 → its failures gave the X-Ray and language safety nets above. Blaze models (LiteRT, phone GPU) are checked by catalogue.mjs only.
- Plan screen Arabic (Google Play texts) — found by the screen audit.
- **File converters keep the look** (Ali: "all file converters … not just convert but with formatting and spacing and everything, like from PDF to Word"). Bench: `bash tests/convert/run.sh` — `make_samples.py` makes Word files and a deck with every kind of formatting (English report, Arabic offer, long A4 manual with header / footer, 5-slide deck), LibreOffice makes the PDFs, `PdfLayout.java` is DocTools.kt's reader on desktop PDFBox 2.0.27 (the version pdfbox-android is ported from — keep the two in step), `bench.mjs` / `bench_pdf.mjs` / `bench_slides.mjs` run the app's own convert.js, `print_pdf.py` prints like the phone's WebView, `compare.py` scores 12 parts against the original, side-by-side PNGs in `out/`. **PDF → Word 100 % on all 12 parts for all 3 documents; Word → PDF 100 %** (the manual's text 99 %: a manual line break becomes a space).
  - PDF reader (DocTools.kt): every word's bold / italic / colour / font and x-end; each line's right edge, direction, font; pictures with their place (`ImageFinder`, ≤ 12 a page, 40 a file); the DRAWN font size (`yScale`: Chrome / Skia PDFs are drawn at 3/4, `fontSizeInPt` made them a third too big); Arabic rebuilt from its letters right to left (PDFBox turned «لا» into «ال»: «ملاحظة» → «مالحظة»), English / numbers inside kept left to right, «%50» → «50%».
  - `pdfLinesToBlocks`: runs, alignment (from the margins; right-to-left pages mirror the missing left margin), justified vs ragged, indents / first line, space before, line pitch = the SMALLEST repeating gap (the most common one merged paragraphs on list-heavy pages), fonts (Liberation → Times New Roman / Arial), sizes, headings incl. "1. Summary", Symbol-font bullets (private-use chars) and list levels, tables with widths / bold cells / wrapped cells / right-to-left, pictures in place, page breaks, running header / footer (same text at the top / bottom of most pages AND apart from the text) → Word header / footer with a PAGE field. `pdfDocOptions`: the page size, margins, body size and font. `docxFromBlocks` writes it all (bCs / iCs / szCs for Arabic; in a bidi paragraph Word's "left" jc / ind is the START side — measured).
  - Word → PDF: `docxRead` (styles chain, theme fonts, contextual spacing, Word's own list numbers, tables with widths / merged cells, pictures, page, header / footer) → `blocksToPrintHtml` (@page size / margins, header / footer in the margin boxes with counter(page), padding not margins — Word adds before + after) → `NativeBridge.htmlToPdf`: an off-screen WebView printed silently by `android.print.AttunePdfPrinter` (the callbacks can only be made from that package); if a phone refuses, `makePdf` as before. Excel / CSV / web page / text → PDF use the same page (sheets: numbers on the right, header row repeated, landscape when wide).
  - PowerPoint → PDF: `pptxToSlidesHtml` — a page per slide: placeholders placed from the layout / master, theme colours with Office's maths (tint / shade in linear light — black at tint 75 % = #898989; lumMod / lumOff on HSL lightness), fills / outlines / rounded / oval, theme shadows, text with fonts / sizes / colours / bullets by level / spacing, pictures, groups, tables in the theme's style. Compared with LibreOffice's PDF of the same deck (out/deck.side.png): the same.
  - Web pages / e-books keep bold / italic / colour / alignment / header cells / pictures; Markdown keeps **bold** / *italic*; Excel output: 18,000 / 14 % are numbers with their format, column widths, frozen header, right-to-left Arabic sheets. A translated paragraph keeps its whole-paragraph look (per-word looks can't follow the words).
- **Every model one RAM tier lower, same quality** (Ali: "a model that runs on 32 GB runs on 24, 24 on 16…"). Each move is MEASURED on the ARM runner (`model-bench.yml`: KLD vs Q8_0 in English/Arabic/Egyptian + write speed); a smaller file is taken only when its drift stays in the "same answers" range (KLD ≲ 0.03) — and on ARM the IQ4 files are also FASTER. Before → after (needRam / smoothRam): Core+ Q5_K_M 8/12 → **Q5_K_S 3.02 GB 6/8** (KLD ar 0.010, +6 % speed); Zenith 12 → **IQ4_NL 10/12**; Apex UD-Q4_K_XL 17.0 GB 24/32, phoneMin 48 → **UD-IQ4_XS 13.6 GB 16/24, phoneMin 24**; Apex+ 18.8 GB 32/48 → **IQ4_XS 16.4 GB 24/32, phoneMin 32**; Everest 22.1 GB 32/48 → **UD-IQ4_XS 17.7 GB 24/32**; Everest XL 48/64 → **32/48**. NOT moved (the smaller files change the answers): Sense (gemma-4-E4B: KLD 0.11–0.22 at IQ4/Q3), Spark/Glow (already tiny). Zenith+ (gemma-4-12B, measured 29 Sep): every smaller file drifts more in Arabic — same top word 66.4 % (UD-Q4_K_XL 7.0 GB) → 64.7 % Q4_K_M, 61.8 % IQ4_NL 6.4 GB, 60.8 % IQ4_XS 6.1 GB — so it stays UD-Q4_K_XL at 16 GB (a 12 GB phone gets Zenith). Note: Gemma 4 scores an odd raw-text perplexity in llama-perplexity (the Q8 reference itself is 181–1001), so for Gemma compare the versions to EACH OTHER, not to the 0.03 line used for Qwen.
- **Max test of every model** (`tests/models/every_max.sh` → `tests/trials/every-max.txt`, per model `max-<name>.md`): 143 checks across 13 tools incl. photos and speed. Spark 102/143 (23.9 t/s), Glow 120/143 (12.9 t/s), Core Lite 128/143 (6.9 t/s) on a 4-core x86. Fixes it found: Mind filed English items in Arabic («outriggers» → «جرار») → the model is told the item's language and a wrong-language title is not kept (`itemLang`, `parseTagReply(raw, rec)`); «فكرني بعد ساعتين» came back as a timer → a reminder unless the words say timer; X-Ray: a bill the model left out («9,500 a day, 3 days» + the other side pays) is added by code as rate × count. The Fit trial now reads meals the app's way (the offline reader first — it gets all 5 test meals right without the model). Core 4B 130, Core+ 134, Sense 140/143. Zenith+ (gemma-4-12B, no photos) **133/137** (1.8 t/s write on this CPU); its misses gave: maths — «lifts at 75 % of its chart capacity» planned for the full chart value → `solveMessages` states the crane rule (plan for N % of the chart value); coding — its own tests expected wrong numbers (10.55 × 1.14 as 12.0; a loan payment 856.06 for 856.07) and the fix rounds redid the sum in their heads → `assertProbe` / `probeValue` in `code.js`: on a Python AssertionError the app runs the failing `assert A == B` line's left side and tells the fix round "it expects B, but A actually returns X"; fix replies get the first write's length limit (a rewritten program was cut at 1,600 tokens). Then (checked on Core 4B, coding 4/6 → 5/6): the probe runs EVERY `assert A == B` / `assert abs(A - B) < tol` line and lists each wrong expected value in one round (`probeFindings`); `failingLine` shows the failing test line (the summary drops "<exec>" frames) and, when a test trips an error the program raises on purpose (`assert vat(-10) == 0`), says to catch it; a fix that changes nothing is refused and named; returning to code that already failed is named; a JavaScript "expected X, got Y" says the test may be the wrong part. The one left: Core 4B insists 2023-02-28 → 2024-02-28 is 366 days (it is 365) — a 4B model's limit; Zenith+ gets it right. Zenith and Zenith+ photos: 6/6 each. Mind: a filing that was entirely in the wrong language now counts as filed (the item keeps its own first line) instead of being retried and left unfiled — this was the e2e_v68 timeout. Web search: the gap search after a missing fact is topic-gated strictly (`mergeHits(…, strict)`), so a page that never names the subject is not read. Website follow-up (2 Oct): `websiteFollowUp(text, history)` in `verify.js` turns "okay you do the frontend only" into the website asked for earlier, and `refusesToBuild(answer)` makes chat.jsx ask again as a code task when a model says "I cannot create a functional website" (`buildCode` in chat.jsx; tests: unit v68, `tests/e2e_v69site.py`). Test servers run with `--cache-ram 0` (llama-server's 8 GB prompt cache killed the 9B/12B runs; the phone uses 256/0).
- **Web search: accurate, fast, every model** (Ali: "very accurate and powerful and fast … the whole app no matter the model"). `WebTools.kt`: DuckDuckGo (GET first — a POST from a data centre gets the "anomaly" page — then POST, then Lite) and Bing at the same time; the Bing reader works on every layout; no `-site:` operator (Bing misreads it; Wikipedia is dropped after); pages are read in parallel and the answer goes on when 60 % are in and 4 s passed (9 s cap) — one slow site never holds it. The same search within 20 minutes is reused (`WEB_CACHE`). `research.js`: a relevance gate (`keyTerms`/`onTopic`: the page must name the question's subject / model numbers; nothing passes → keep all); `quickBudget`: a one-fact question reads a 6,000-character window instead of ~9,000 (comparisons, trims, specs, lists, deep research keep the full one) — the model's reading of the prompt is most of the time on a phone. Benchmark: `tests/websearch/` (Node port of WebTools + the FAST path, `eval.mjs`; `fixtures.json` = real search results per question because GitHub's machines get blocked/poisoned results; pages are read live) and `.github/workflows/web-bench.yml` (Search-only / Glow-2B / Core-4B). Results: the answer is in the pages 19–20/20 and survives the quick window 19/19; Core-4B answered 7/7 right before the runner stopped. Glow-2B (GitHub x86, 20 questions): 20/20 right with the full window AND with the quick one; model time 118 s → 81 s average (−32 %), e.g. the Suez Canal year 6,331 → 2,153 prompt tokens, 196 s → 65 s. The same run found the grounded prompt ending in "Answer in match." (the Prompt-builder language setting's default) — an Arabic question got an English body; the question's language is used now.

### 5.38 v6.10 — engine wakes by itself, exact-length rules, Plans & billing page, Business "books" (2 Oct 2026)
Ali: "do everything" from NEXT_SESSION; unlock all Pro (incl. Yusr); a billing page for everything; Business systems "very professional, worth paying for"; Shelf (notes like his phone's Notebook app, named **Shelf / رف**, not started). Opus planned, Sonnet built, Opus reviewed (the review found 3 real bugs, fixed). Detailed plans and what is left: **`PLANS_2026-10-02.md`**.
- **Engine** (items 19/20/2): `NativeBridge.wake()`, `waitReady` wakes instead of "open Engine", chip "Asleep — wakes when needed", `onTrimMemory` only at real pressure, poll 10 s, timers paused in background (not while busy/waking), GPU half-fail → CPU restart, large-model warning at 40 % of RAM, renderer-gone logged, native `shareFile` (FileProvider path `shared/`). Not compiled locally (no Android SDK): CI is the compile check (run 67 green).
- **Answers**: `constraints.js` — exactly N words, Nth/last/first word, starts/ends with, paragraphs, bullets, characters, table only; `enforce()` last resort (only near misses, never pads long texts); chat system prompt keeps names/standards and asks for the mechanism first on engineering faults; bold around `[n]` citations no longer shows `**`.
- **Money (Yusr)**: `paytext.js` reads relation + person ("+250 EGP from my cousin Youssef"); direction from a leading `+250` or `<amount> <cur> from/to` ONLY (a reminder "at 9 to call Ahmed", "+ 14% VAT", phone numbers, "Convert 500 USD to EGP" are NOT payments — tested). Mind keeps photo pictures (`keepPicture`) with a full-size view and renders saved tables via `Md`. Fit photos: time limits, `canSee`.
- **Testing unlock**: `TESTING_ALL_PRO` (billing.js), **`TESTING_ALL_PREMIUM`** (yusr/index.new.html), and `setTestingOpen` (erp.js: every Business system counts as activated). The Plan screen's "See it as a Free user" turns all three off. **Set false before release.**
- **Plans & billing page** (`Upgrade` in attune.jsx): status card, Monthly/Yearly/Lifetime switch with every price, app-by-app "what Pro gives" (`BILLING_GROUPS`), Business system card, Free/Pro/Business compare table (`COMPARE_ROWS`, real limits). **Money is included in Pro**: Attune sends `entitlement {pro}` over the Yusr bridge; Yusr's paywall inside Attune says "part of Attune Pro" and sends `open-plan`.
- **Business books** (Business tab → "Shop & trading books"): finance core `books.js` + operations `books-ops.js` (pure, golden-tested: v611books, v612ops), storage `books-store.js` (IndexedDB, one record per collection, localStorage fallback), screens `books-ui/-sales/-purchases/-stock/-money/-reports/-docs/-kit.jsx`. Money is integer piastres; documents go draft → posted (numbered per series per year, gapless, immutable; fix by credit note); VAT 14 % / table tax before VAT / withholding on the net; ledger with trial balance, P&L, VAT return; ageing 0/1–30/31–60/61–90/90+; statements; moving-average stock; hash-chained audit log; owner PIN (not encryption); bilingual PDF invoice via `htmlToPdf` + `shareFile`; sample shop; backup/restore/erase. `build/react-shim.js` now exports `createContext`/`useContext`. The books screen is `z-[60]` (above the app's bottom bar).
- **Cloud-session test setup** (the container has none of this by default): `pip install playwright openpyxl python-pptx python-docx pdfplumber pypdfium2`, then `bash tests/setup.sh`. `tests/unit/v537.test.mjs` (RTF €) fails here only because this Node lacks full ICU — not a product bug. e2e that clicked "outside" to close the Plan screen now use its X (it is a page, not a modal).

### 5.40 v6.12 (4 Oct 2026) — Ali's phone test of 6.11: CV import, PowerPoint pages, food photos, several attachments, Shelf import, web search, Maps
Ali tested 6.11 and sent 7 screenshots + a list (NEXT_SESSION.md section L). What was wrong and what changed:
- **Toasts were invisible behind every full-screen sheet** (the toast had no z-index; sheets are z-[70]) — every error on the CV
  import sheet (and others) was silent, so buttons "did nothing". Toast is z-[300] now.
- **CV import** (`cv-ai.js` `parseCVText`, `jsonLoose`, `mergeImport`; `cv-ui.jsx`): a long CV made the model's JSON stop at the
  1,800-token cap → "cut off" → nothing imported. Now a code reader (EN/AR headings, jobs split on date lines, Present = current,
  contact line) always works and keeps every line; the model (4,000 tokens, 120 s cap) only improves sections it covers fully;
  a cut-off answer is repaired. Errors show inside the sheet. Tests: unit v700cvimport.
- **Ask a PDF, PowerPoint = 2 pages instead of 10**: the text was cut into ~fixed-size "pages". Now one page per slide in the deck's
  own order (`pptxToBlocks` tags every block with `slide`, reads `presentation.xml` order). Tests: unit v701slides, v537.
- **Ask a PDF keeps documents** (TEST_GUIDE §2): text + conversation (+ the PDF if < 8 MB) in IndexedDB `attune-pdfchat`, last 8,
  "Opened before" reopens with one tap, Forget removes. e2e_v619pdfchat checks it.
- **Fit & Food photo** (Ali's eggs-on-toast: "Fried egg 138 g · Is it: Fried egg, Fried egg"). Measured with the real Gemma 4 E4B
  GGUF + mmproj on his photo (llama-server, CPU): without thinking the model returns 4 fried eggs + 4 toast slices; the fast
  CLIP look said "Eggs with tomatoes / Shakshuka / Croque madame" (35 %, so the chat model ran and the hint was lost).
  Changes (`fit.js`, `fitclip.js`, `fit-ui.jsx`): the prompt lists every layer (toast under, sauce/cheese on top) and every piece,
  asks for ONE-line compact JSON (pretty JSON burned the token cap), carries the fast look's guesses; `jsonLoose` keeps every
  complete item of a cut-off answer (`parsePhoto`, `parseHidden`, `applyZoom`); `uniqAlts` removes duplicate chips; maxTokens
  1000; the hidden-calories prompt names tomato sauce / cheese / toast. Note: a test run WITHOUT `enable_thinking:false`
  made Gemma think for 1,000 tokens and return nothing — the app always sends it (LiteRT: thinking only when asked). Tests: unit v703fitphoto.
- **Instant "What are my expenses in the last 4 days"** → "please provide the data": the ledger is in localStorage `ledger.v3`
  (Yusr). `myledger.js`: `myMoneyIntent`, `spanOf` (last N days/weeks, today, yesterday, this/last week (Sat start), this/last
  month, this year; Arabic words and digits), `answerMyMoney` (sums per currency, by category, each entry; gold accounts left out).
  Instant and Chat answer by code. Instant now renders Markdown (tables/bold), and no longer shows "Re-read against the source…
  numbers match" under a plain short question. Tests: unit v702myledger.
- **The "…was promised to you and is late" banner** on every screen came from Ali's own "Save that a maid comes…" note read as
  a promise. `gateCommitments` rejects notes-to-self ("save/remember/note…", «احفظ/افتكر»); stale ones are dropped on load; the
  banner reads "Late — you were promised: …". Skills: the Catalogue button no longer wraps.
- **Chat: several files and photos in one message** (`multidoc.js`): up to 8 files (documents read into pages labelled by file;
  whole when they fit, else the passages matching the question with file + page; summaries go through the long-read path) and
  up to 6 photos (sent as ONE numbered collage — both engines take one picture per message). A document no longer jumps to Ask
  a PDF; its chip has "Read". Tests: unit v704multidoc, e2e_v700multi, e2e_v619pdfchat (Read chip).
- **Shelf import** (`shelf-import.js`): Shelf → ⋮ → Import notes (several files: txt/md/html/Word/PDF/ODT/RTF, Google Keep
  JSON/HTML, Evernote .enex, .zip of notes, photos of notes; or paste several notes split on ---/##/empty lines) into a chosen
  book or «Imported notes». A text shared from the phone's Notebook app → Mind card → "Save to Shelf". Android: a note shared as
  a .txt FILE (EXTRA_STREAM only) was dropped — now read. Tests: unit v705shelfimport, e2e_v700shelfimport.
- **Web search** (`research.js`, `chat.jsx`, `WebTools.kt`, `tests/websearch/search.mjs`): the benchmark log showed Bing
  answering questions with dictionary pages ("Who won the 2022 FIFA World Cup?" → dictionary.com) and the gate then KEEPING
  them when nothing passed. Now: dictionary/thesaurus sites are never read (unless the question is about a word); an engine that
  answers mostly with them counts for nothing; when every page is off-topic, `mergeHits` marks the list `offTopic` and the chat
  searches again (bare subject + facets); still nothing → the model answers from its knowledge and says the web found nothing.
  Brave's and Mojeek's own HTML results are searched next to DuckDuckGo and Bing, merged by reciprocal-rank fusion. Pictures:
  each page's og:image is fetched natively as a 320 px data: thumbnail (the page's CSP still allows no web loads) and up to 4
  show above a web answer. Next-question chips after a web answer (versions & prices, pros & cons, compare, latest news).
  GitHub's machines cannot measure the new engines (Brave 429, Mojeek 403 from data centres) — phone only. Tests: unit v706webjunk, v68.
- **Maps** (`mapsearch.js`): "Address east compound" → nothing (Nominatim only). Now Photon + Nominatim at once with the map's
  centre (viewbox / lat-lon bias), then simpler wordings ("Address east", "… Cairo"), then Overpass named places within 40 km;
  merged, nearest-best first, type + distance shown, saved places first; the picked result is pinned and can be saved; a
  my-location button (WebView geolocation; Android asks for location only when tapped; manifest has COARSE/FINE). Tests: unit
  v707mapsearch, e2e_v700maps.
- Ask your Mind renders Markdown answers.
- Version 6.12 (versionCode 73).
- **Not done / needs Ali:** the Maps visual rework and the whole-app UI rework (looks: options to show him), the rest of
  TEST_GUIDE §2 (knowledge packs wiring, Studio preview, desktop phase 2, Business ETA JSON / roles / multi-currency, converter
  ODT/RTF/Excel readers, skills second pass, coding review mode, big-model max tests).

### 5.41 v6.13 (4 Oct 2026, night) — Core+ "0000…", Yusr write-to-log, Bills tab
- **Engine:** the 0.8B helper (draft model) is retired (`Engine.RETIRED_DRAFT`; `draftFor` clears the old pref). New
  per-model **safe mode** (`Prefs.safeMode`, set via `setSpeed {safe}`): no speculation (no ngram-mod / MTP), f16 KV
  cache; settings note says "safe mode". Page: `junkStart(text)` (quality.js) — ≥ 90 % of the first 64 non-space
  characters the same → `looped.where = "junk"` → `setSpeed {safe:true}` → the same request again once (`_safeRetry`);
  a second junk answer → a clear error naming the way out. Tests: unit v713junk, e2e_v713junk (mock queue "0"×400).
- **Yusr** (`web-src/yusr/`): new `logtext.js` (pure: `amountsIn` with ألف/k, `clauses`, `dateIn`, `readLocal`,
  `logPrompt`, `parseLog` — model amounts must be in the text; items the model dropped are added back from the code
  reading). `yusr-bridge.js` AI kind `log-text` with `hints`. Attune's `ai-request` handler answers `log-text` even with no
  model (code reading). Yusr's new code lives in **`yusr/yusr-v613.js`**; `build.sh` pastes it into the
  `<script id="yusr-v613">/*__V613__*/</script>` placeholder of `index.new.html` (so edit the .js, not the html).
  Bills tab `scr-bills` (`renderBills`, `billsAhead`), recurring `freq: daily` + `fromDay/toDay` (`inDayRange`,
  `advance(d, f, r)`), invoices/demo UI removed (code kept, data kept). Tests: unit v714yusrlog, e2e_v713yusr.
- **Yusr home (B + C mix):** `homeCards()` (ring `#home-ring`, grid `#home-grid`), `renderTalk()` (`db.talk`, last 30;
  a logged bubble re-reads its transactions so edits/deletes show), the bar `#write-box` (fixed, `body.on-home` only).
  `log-text` replies `{answer}` when `isQuestion(text)` (logtext.js) — Attune's `askLedger` answers by code
  (`answerMyMoney(q, ledger, {short:true})`, category from `catAsked`), the model only for advice, from code's figures.
  One-time `db.ui.v613` migration: tabs accounts/goals/notes hidden (tiles in More, `moreTiles()`), `db.ui.cards`
  switches. Tests: unit v715moneyask; e2e_v713yusr covers question, cards, 5 tabs, bar on Home only.

### 5.42 v6.14 (10 Oct 2026) — formal Arabic everywhere, copy food, A-vs-B answers, ready courses, Cycle chat
- Arabic style decision (Ali, 4 Oct): simple MSA for every screen. `i18n-ar.js` is now generated-style (one entry per line,
  header documents the style). Inline Arabic: keep Egyptian only in input-reading code. Tests that read Arabic UI text were
  updated (e2e_v5, v62, v542, v537, v538, v533, v512_more, audit.py, unit v529).
- `tests/unit/jsxload.mjs` bundles a `.jsx` with React/icon stubs (`tests/unit/stubs/`) so its pure functions can be unit-tested.
- New tests: unit v716compare, v717copyfood, v718ready, v719cyclechat; e2e_v713copyfood.

### 5.43 v6.15 (10 Oct 2026) — the other session's branches merged into main
Four branches from the "Pages & look" / helper sessions had never reached `main`. All merged (merge commits, no rebase):
- `ccr-04b5cbe2-dr1189` (= `business-extras` + `fit-home` + `pdf-reader`): Business roles (owner / accountant / cashier /
  viewer, `actorCan`), multi-currency documents (`books-more.js fxView`), price lists by customer group with quantity breaks,
  sales orders + delivery notes (`books-ops2.js`), ETA batch export + validator, encrypted automatic snapshots
  (`books-vault.js`); the Ask-a-PDF reader (word boxes, highlights, notes, bookmarks, outline, library of kept documents with
  their chats, `pdfreader.js`); the Fit home (log bar, one-tap chips, country ideas, swipe rows, 3-question first visit,
  `fithome.js`).
- `studio-preview`: draft-then-clear pictures. `converter-polish`: Word/PDF fidelity. `knowpack-wire`: Knowledge (your own
  sources with citations in Chat; World Factbook + Egyptian laws packs), under More → Your life.
- Conflict decisions: `books-eta.js` = the merged (fuller) builder; it ALSO reads the fields the v6.12 screens saved
  (`company.eta`, `customer.eta.{type,address,nationalId}`, `item.eta.{itemCode,itemType}`) via `etaSettings()` — one ETA
  button (`EtaButton`), one settings section (`EtaSettings`); `etaCheck/etaJson` kept as thin wrappers. Fit home = theirs, with
  v6.13/6.14 put back in (copy meal/day, vitamins panel, fasting stages + 23:1/36 h, weekday goal, fast-photo offer). The
  reader keeps one page per PowerPoint slide. Knowledge button in the reader = `addToKnowledge` (the one attune.jsx passes).
- All their Arabic was rewritten into simple formal Arabic (≈180 strings).
- Workspace tile in Arabic = «مساحة العمل» (it was «الأعمال», the same as Business).
- Known flaky: `e2e_v59` (Studio "edit this" wait) failed 2 of 16 runs, not reproduced under load; `e2e_v620pdfreader`
  selection-bar read now waits for its text.

### 5.44 v6.16 (10 Oct 2026) — Ali's look picks: Mind C, Coding B, Maps A + whole-country offline maps
- Options were shown as a design canvas (claude.ai artifact "Attune page looks"); Ali chose Mind C, Coding B ("make sure
  the preview page is good"), Maps A ("download a whole country at once … always up to date").
- Mind (mind-ui.jsx): smart-space tiles (kinds, auto tags, saved spaces, Promises), one "From your past" card (Keep /
  Not now), Keep-something sheet from a + button (`mind-new`), a tile opens its items with a back button (`mind-all`).
- Coding (code-ui.jsx): programs row, task card, Steps / Code / Preview tabs (`code-view-*`; the editor stays in the DOM),
  Change-it bar, New (`code-new`). Preview: phone/tablet/desktop widths laid out at that width and scaled (iframes need
  `maxWidth: none` — the app's CSS caps them at 100%), reload, full screen, console (log + errors). sandbox.js gives a
  locked preview a private in-memory localStorage.
- Maps (map-ui.jsx + offlinemap.js + MapPacks.kt): MapLibre 5.24 (www/vendor/, loaded only on Maps), pmtiles 4.5,
  @protomaps/basemaps 5.7 (dark flavor, Arabic names). A country pack = <code>.pmtiles (Protomaps' daily OSM build cut
  to the Geofabrik outline) + <code>-places.sqlite (FTS4 search of every named place/street/shop) + manifest (date,
  sizes, SHA-256), published weekly by .github/workflows/map-pack.yml (tools/build_map_pack.py) as release map-<code>;
  fonts/icons once as map-assets. The phone downloads with resume, verifies SHA-256, swaps an update in only when
  complete; the page reads the file through N.mapRead (sync, base64) — no HTTP Range needed. Updates: checked once a day
  (and on the Offline maps tab), banner + Update button. Without a pack: online OSM tiles through the old tile cache
  (osmc:// protocol). No WebGL → the old MapTab. Normalisation (Arabic letters/digits, Turkish, accents) is identical in
  offlinemap.js, MapPacks.kt and build_map_pack.py — tests/unit/v722maps checks JS = Python.
- Tests: e2e_v722maps (a real tiny vector map, tests/fixtures/cairo-mini.pmtiles, from make_map_fixture.py),
  e2e_v722mapbuilder, unit v722maps; e2e_v58, e2e_v68, e2e_v700maps updated for the new layouts.
- First run (10 Oct, run 38041401209, 2 min): map-assets (2.4 MB) and map-eg — eg.pmtiles 269 MB (z0–15, data of
  2026-10-10), eg-places.sqlite 83 MB (249,190 places). Egypt rebuilds every Friday; other countries: run the workflow
  with countries="tr gcc …" (add them to the schedule's list in the plan step if Ali wants them weekly).
  Knowledge packs (know-pack.yml) were never published — waiting for Ali's go-ahead (confirm=yes).

### 5.45 (10 Oct 2026, still v6.16) — 44 country maps, Knowledge packs that install themselves
- Ali: "Build the most 40 famous countries". tools/map_countries.json (44 packs, ~50 countries; GCC and
  Malaysia+Singapore+Brunei come grouped from Geofabrik) is the one list for the app (imported by offlinemap.js) and the
  workflow (build_map_pack.py country/all). The weekly run rebuilds all, 4 at a time. The biggest keep maxzoom 13 (us,
  ca, br, ru, cn, in, au) or 14 (mx, ar, gb, fr, de, it, es, pl, jp, id). Files over 1.9 GB → <name>.001… parts;
  MapPacks.fetchInto appends each part to one .part file (resumable across parts), SHA-256 of the whole. The builder
  pre-filters named features with osmium-tool (the USA's 11 GB → memory-sized). First "all" run started 10 Oct from
  this branch.
- Ali on Knowledge: "integrate them so the model has this knowledge and Chat answers me". Chat already adds matching
  passages (factsBlock, cited) to lookup questions when Knowledge is on (default). New: knowledge.js autoInstallPacks —
  the public packs install by themselves (8 s after start, ≤ every 6 h, online, not with the offline lock), and a
  newer published build replaces the old one. The packs were published on 10 Oct (know-pack.yml, confirm=yes).
  Still no Wikipedia (Ali's rule, v5.22). Test: unit v723knowauto.

### 5.46 (10 Oct 2026, v6.16) — general knowledge: 6 more reliable packs, searched on the phone
- Ali: "find reliable sources and make the app better in general knowledge". New packs (tools/know_sources.py): science
  (OpenStax, CC BY only), health (MedlinePlus, public domain), numbers (World Bank, CC BY, monthly), cities (GeoNames,
  CC BY), cranes (OSHA 29 CFR 1926.1400–1442, 1926.251, 1910.179/180/184 from govinfo bulk CFR XML — the eCFR API answered 406; public domain), quran (Tanzil, verbatim). Still no Wikipedia.
- Format 2: every pack is a gzipped SQLite file (passages + FTS4 on the normalised text, same normalize() as the maps,
  incl. Arabic digits, dagger alef, Quranic marks) at release know-<id>-v2. KnowPacks.kt downloads (MapPacks' resumable
  downloader + SHA-256), unpacks, searches with BM25 from matchinfo('pcnalx'), common words dropped, light English
  stemming, prefix match. The page never holds pack text in memory (the old JSONL packs used ~150 MB of RAM for laws alone;
  autoInstallPacks removes those old copies). knowledge.find ranks own sources + the phone's candidates together.
- Chat: an Arabic question with no Knowledge hit is retried with a short English search line from the model (24 tokens).
- know-pack.yml: all 8 packs, monthly (1st), confirm gate removed (Ali approved). Tests: e2e_v724knowbuild (parsers +
  the phone's search replicated in Python), unit v723knowauto, knowledge.test updated.
- Published 10 Oct 2026 (passages / download): world 34,390 / 9.6 MB · egy-laws 20,235 / 11.6 MB · numbers 217 / 0.1 MB ·
  cities 34,408 / 5 MB · science (15 OpenStax books) 32,219 / 24.1 MB · health 4,046 / 3 MB · quran 6,236 / 1.2 MB ·
  cranes 596 / 0.45 MB. Packs over 15 MB (science) install only on Wi-Fi (N.unmetered()). write_pack refuses an empty pack.
- Maps "all" run 38042755681: the USA was killed for memory while indexing places (12 GB pbf → 3.4 GB named). Fix:
  build_places uses idx=sparse_file_array on disk when the pbf is over 1 GB; a USA-only rerun was queued.
  By 11:20 the other 41 countries + map-assets were published (ru, cn, in included); za and au were finishing; the USA
  rerun is run 38046680530 (it waits for the "all" run: concurrency group map-pack).
- APK runs 99–101 failed: NativeBridge.unmetered() was an expression body whose second line began with '!' — Kotlin
  read it as a continuation of the line above. Now a block body (87bb0d3); branch run 38047174802 is green. No Android
  SDK in the cloud sandbox, so a Kotlin change is only compiled by "Build the APK" — dispatch it on the branch first.

### 5.47 (10 Oct 2026, v6.16) — Islamic packs, Dorar, Cars pack, and Ali's car answer
- quran pack now = Tanzil text + التفسير الميسر (King Fahd Complex, from QUL tafsir 38 via github.com/spa5k/tafsir_api):
  114 surah introductions once, verses explained together kept as one passage (الآيات ١–٦), 11,390 passages, 4.5 MB.
- fiqh pack (new): الفقه الميسر (الطيار/المطلق/الموسى, 13 vols) + الفقه الميسر في ضوء الكتاب والسنة, from turath.io. turath
  ids ≠ Shamela ids → books found via api.turath.io/search by exact title; book file, else page by page (/page, 0.15 s apart).
- hadith pack (new): 36,104 hadiths (Bukhari, Muslim, 4 Sunan, Muwatta, 40s) from fawazahmed0/hadith-api (Unlicense) with
  rulings (الألباني، الأرناؤوط، أحمد شاكر، زبير علي زئي…) translated by grade_ar(); 23 MB download, Wi-Fi only.
- Dorar (الدرر السنية) has no bulk download → live: native dorarSearch (dorar.net/dorar_api.json?skey=, offline lock),
  knowledge.js isHadithQuestion/dorarQuery/parseDorar/dorarSearch, K.liveSearch merged in find(). Fixture:
  tests/fixtures/dorar_api_sample.json (a real recorded answer, MIT dorar_hadith package). Test: unit v725dorar.
- cars pack (new): US EPA vehicles.csv (public domain, model years 2000+) + EEA CO2 new-car data (CC BY 4.0, 2010+) via
  discodata SQL, one query per year; 2023+ live in their own tables (co2cars_2024Fv29…) — listing tables is refused, so
  names are probed (eea_probe, no retries). Brands get Arabic names, Chinese brands are marked (make_key prefix match).
  No prices in any open source.
- Car answers (research.js TPL.vehicle, Ali's "bare minimum"): expert driver's overview → every trim (hp, Nm, 0–100, top
  speed, price USD + home currency, official and market) → per-trim specs (dimensions, ground clearance, WLTP and CLTC
  ranges, pure-electric WLTP/CLTC for hybrids) → features → prices official vs market (used by year, home-country price) →
  advantages → disadvantages → rivals → Egypt. 7 searches, 10 pages, ≈40% of the window for the answer. Today's rates via
  native fxRates (open.er-api.com, cached 6 h) → fxNote; the Cars pack's figures → officialSpecsNote (api.carSpecs).
- Bridge methods always get (id, arg): a method with only (id) is not found from JS — fxRates takes an unused arg.
- Published by the end of 10 Oct: fiqh 5,820 passages / 6.5 MB (5,118 الطيار 13 vols + 702 مجمع الملك فهد); cars 55,170 /
  10.2 MB (EPA 20,720 for 2000–2027, EEA 34,455 for 2010–2025, 691 marked Chinese); hadith 36,104 / 23 MB; quran 11,390 / 4.5 MB.
- Maps: all 44 packs published (data 10 Oct 2026). The USA rerun (38046680530, sparse_file_array) is green: 6.1 GB in parts;
  also in parts: ca, fr, de, se, no, ru. Main APK for 35aee65 (run 38047936952) green; branch runs 106/107 compile dorarSearch/fxRates.

### 5.48 (10 Oct 2026, v6.16) — Attune is sold: only commercial-safe sources; pack quality audit
Ali: "Attune will charge money … find reliable free sources … full mark … all correct and reliable info".
- **Licence rule:** every pack source must allow commercial use — CC BY, CC BY-SA, CC0, public domain, PSF, Apache, Tanzil
  (verbatim with credit). No NC/ND, no modern copyrighted books. `commercial_ok()` in know_sources.py; `--allow-nc` removed.
- **OpenStax** moved all books to CC BY-NC-SA → `cc_by_version()` reads each book at its newest commit still under CC BY
  (git history, worktree checkout; CC licences are irrevocable). Manifest `sources[].version` = that commit.
- **quran** = Tanzil + تفسير الجلالين (QUL 523, public domain; it skips 226 verses it found plain — check is ≥ 6000).
  التفسير الميسر removed (King Fahd Complex: free to share, not for sale).
- **islamlib** = تفسير ابن كثير verse by verse (QUL 22; the edition's `[[…]]` notes stripped, long parts cut 1,400 chars,
  numbered) + رياض الصالحين + بلوغ المرام (turath). تفسير السعدي out (author d. 1956 → life+70 until end of 2026).
- **fiqh** = classical books via turath: الفقه على المذاهب الأربعة (الجزيري d. 1941), بداية المجتهد, عمدة الفقه, متن أبي شجاع,
  مختصر القدوري, مختصر خليل. الفقه الميسر (both) removed. Titles may list alternatives `A|B`; when a title isn't found
  the log prints what turath's search returned (turath is blocked from the cloud sandbox — only Actions can reach it).
- **Editors' footnotes** (copyrighted, not the author's) are cut from every turath page: text below `<hr>` / `_____`, and
  `(1)` marks only when the page had notes.
- **Quality** (`tools/audit_packs.py <dir>` → table; exit 1 on problems): found 5× repeated passages in economics (Micro/
  Macro/AP editions share chapters) → `unique_rows()` in subject + coding packs; `Ã©` car names → `fix_mojibake()`;
  76 Bukhari hadiths with a damaged letter in BOTH hadith-api editions → shown as `[…]` + a note to check Dorar;
  Uyghur/Persian names as "Arabic" in cities/geography → `arabic_name()` (U+0621–U+0652 only); medicines grouped by
  active ingredient (openFDA substance_name), cosmetics out.
- **Trial:** packtrial.mjs now 45 questions (medicines, recalls, dictionary, hadith, fiqh, Ibn Kathir, Arabic geography,
  quadratic formula, Newton, pH, opportunity cost); grading strips Arabic diacritics.
- Search fixes found by the trial: Arabic country names → English (Intl.DisplayNames), one dictionary entry max and the bar set
  by the best non-dictionary passage, `keyLine()` points the model at the answering clause, question filler words ignored,
  'single-quoted' words exact, the question's own 2–4-word run boosted ×2 (`near_phrase`), `verseFirst()` for quoted verses,
  squared exact-name bonus, `head_chunks()` (no header-only passages), EU trims merged, recalls only for car makes (cars 24 MB),
  medicines split by route, fiqh dotted separators out, the classical measures in grams (MEASURES).
- Trial (45 questions, tests/trials/packtrial-*.md): small q08 23 → 39 with packs; 4B q4b 34 → 41 (44 after the grader accepted 3
  correct answers; nisab needs the fiqh rebuild with MEASURES). Lookup ≈ 180 ms.
- Still to ask Ali: Wikipedia/Wikidata (he: "if you can guarantee it's reliable, add it" — nobody can guarantee it; options given);
  calculus source; Dorar live API in a paid app (ask Dorar in writing).
- Builds that were still running at the end: fiqh (with MEASURES, ~1.5 h), dictionary (لسان العرب page by page, up to 6 h).

### 5.49 (10–11 Oct 2026, v6.16) — Ali: "accuracy and reliability above all"; Wikidata B; Dorar free; the AI note
- **AI note** (Ali: "like any AI, write in a small font that AI can make mistakes"): `data-testid=ai-note` under Chat's box,
  Ask a file, Ask and Cycle — «Attune ذكاء اصطناعي وقد يخطئ، فتحقّق من المعلومات المهمة.» Test: e2e_v728ainote.py.
- **Dorar is free** (Ali: "I won't take money from people for the Dorar service"): `billing.countsTowardLimit(q, isHadithQuestion)`
  — a hadith question never counts toward a daily limit (whatever enforces FREE_LIMITS must ask it); plans table row
  «Hadith search (Dorar): Free, unlimited» on every plan. Test: unit v729dorarfree.
- **Wikidata (option B)**: `build_wikidata` — SPARQL per (class, property); a statement is kept only if a reference is a
  non-Wikimedia URL (P854) or «stated in» (P248) a work that isn't a Wikipedia edition; not deprecated, not ended (P582); when
  one value is «preferred», older ones are dropped. Each fact shows its source; the app scores Wikidata ×0.75 so official
  packs lead. Famous people dropped (query over WDQS's 60 s). Queries are syntax-checked with rdflib in e2e_v724 (if
  installed). A `\.` in a SPARQL string = 400 for every query — use CONTAINS.
- **Calculus**: Applied Calculus (Calaway, Hoffman & Lippman, CC BY 3.0) from LibreTexts (`LIBRETEXTS`, LaTeX kept). No
  CC BY trig-derivative chapter there; Lumen "suny-calc1and2" was a course page with adverts — removed (`PRESSBOOKS = []`).
- **Quality**: fiqh dotted separators out (turath_text), nisab etc. in grams (`MEASURES`), «Click here to…» sentences out of
  textbooks (`LINK_OUT`), audit check «site junk». Pack builds: `timeout-minutes: 350`, `PYTHONUNBUFFERED=1`.
- Search: filler words out, 'single-quoted' exact, `near_phrase` ×2, `verseFirst`, squared exact-name bonus.
- Trials: q08 23 → 39/45; q4b 34 → **45/45** with every rebuilt pack (11 Oct); see tests/trials/packtrial-*.md.

### 5.50 (11 Oct 2026, v6.17, versionCode 78) — Fit & Food as an app of its own (look A); food photos read the printed text; Maps fixed
- **Ali:** Fit & Food was "cluttered … a page in an app, not an app in an app", "more confusing than Yazio"; typed foods
  found nothing; a Big BAIK photo (1000 kcal printed) was logged as "fish 600 kcal". He picked **look A (Diary app)** from
  the artifact "Fit & Food Looks". Then: "Maps doesn't work or where is the map itself" (screenshot: empty dark map).
- **Fit look A (`web-src/fit-ui.jsx`):** Attune's header and nav hide in Fit (`mode === "fit"` in attune.jsx); Fit has its own
  top bar (`fit-exit`, title, engine chip) and bottom tabs Today · Recipes · **+** (`fit-add`) · Progress · Me (`fit-tab-*`).
  First visit: welcome (`fit-qs-welcome` → `fit-qs-start`), 3 questions, then the plan screen (`fit-qs-plan`, `fit-qs-kcal`,
  «Start logging» = `fit-qs-next`). Today = calories ring, meals (with per-meal ideas `fit-suggest-*`), water, fasting,
  exercise card (`fit-open-move`). The log bar + one-tap chips live under **+** (`LogBar`); Say it/Photo/Read it under the
  text box show only once there is text or a photo. Day quality, vitamins and tips moved to Progress; plan, workouts
  (`fit-me-move`) and settings to **Me** (`MeTab`). Saving a changed plan returns to Today. Log-bar buttons keep the meal
  the + panel was opened for (was: switched to "now").
- **Food photos:** ML Kit text recognition (`NativeBridge.readText`, `com.google.mlkit:text-recognition`) runs first; if the
  photo has a printed calorie line, `fitphoto.menuFromText` → one "as printed" item (`src: "photo-text"`). Full nutrition
  labels return null (they go to the label path). Food database downloads itself on Wi-Fi (`fit-pack-bg`); typed foods
  search online 900 ms after typing when there are < 6 local hits. Food pack rebuilds monthly (food-pack.yml cron).
- **Maps blank — cause:** MapLibre's CSS (`.maplibregl-map{position:relative}`) loads after Tailwind and overrode the map
  box's `absolute inset-0`, so the box was **0 px tall**: the map was drawn (features loaded) but invisible. Fixed with an
  inline style; the map's top is re-measured after the page settles (the search bar had slid under the header); the
  OSM credit sits on the sheet (`map-credit`). Reproduced and verified with the real `map-eg` pack read through a mocked
  bridge (270 MB). `e2e_v722maps.py` now checks the box height and the search-bar position.
- **Tests:** new `e2e_v731fitapp.py`, `e2e_v728ainote.py`, unit `v728packfix`, `v729dorarfree`, `v730menutext`; the old Fit
  tests were moved to the new structure (welcome → plan → + panel / Me / Progress).

### 5.51 (11 Oct 2026, v6.17) — Maps download button, Knowledge downloads that never hang, packs without provider names, food photos measured and improved
- **Maps:** a «Download maps» / «Offline maps» button on the map (`map-open-offline`) opens the country list; a dot when an
  update is ready; the floating buttons hide while the sheet is pulled up.
- **Knowledge downloads ("it keeps loading only"):** one download per pack (`NativeBridge.knowJobs`: a second request for the
  same pack — the quiet auto-download and a tap — joins the first instead of writing the same files), progress every 256 KB
  and at 0 %, a JS watchdog (`STALL_MS` 2 min, `window.__attuneStallMs` in tests) that sends Stop and leaves the reason on
  the card, and the list refreshes every 5 s so background downloads show «ready». Test: `e2e_v732packdl.py`.
  All 24 published packs were downloaded and checked here (size, sha256, gzip): all fine — the problem was on the phone.
- **Pack cards (Ali: naming every source "is not professional"):** the cards say what a pack does (no OpenStax, GeoNames,
  World Bank…); the credits the licences require (CC BY etc.) are in one closed «Sources & licences» list at the bottom
  (`kn-credits`). Book titles of the Islamic packs stay — they are the content. Answers in Chat still cite their passage.
- **Food photos (Ali: "53 percent is not accurate at all").** Measured with `tools/eval_food_clip.py` on 2,316 photos —
  1,010 Food-101, 703 Middle-Eastern home plates, 603 Arab dishes (test sets only: their licences are unknown, never trained on):
  | | Food-101 | Middle-East | Arab dishes |
  |---|---|---|---|
  | v6.10 CLIP B/32 int8 alone | 58 % | 51 % | 43 % |
  | v6.17 CLIP + SigLIP B/16 int8 + the user's region first | 75 % (top-5 92) | 57 % (83) | 74 % (88) |
  | + the phone's memory of 3 earlier photos of the dish | 78 % | ≈ 98 % | 92 % |
  Also measured and not taken: CLIP B/32 fp32 (60/53/54, 351 MB), CLIP B/16 (63/51/48), CLIP L/14 (69/54/51, 307 MB, 4× slower),
  SigLIP 2 (ONNX export scores 21 %: broken). SigLIP's text MUST be padded with `</s>` (id 1): padded with 0 its Food-101
  fell from 69 to 47 %.
  - Bank v2 (`food-clip-v2` release, `tools/build_food_clip_bank.py`): items carry their country (`cc`; tsv sections →
    eg/intl/plain), `encoders` = [CLIP (centre square), SigLIP (whole photo squeezed, mean/std 0.5, output pooler_output)],
    each model's scores standardised over the bank and added, prior {own 0.5, region 0.5, other −1} (`priorOf` = Python
    `prior_of`), softmax at temp 2.0, auto 0.6 (≈ half the photos logged at once, 92 % of those right). v1 stays for older apps;
    `FoodClip.status()` reports a v1 install as not installed (`old: true`) so the app offers the new files (≈ 200 MB).
  - Personal memory (`fitclip.remember/loadMemory`, `attune:fit:photomem`, 200 photos, int8): saving a photo meal keeps the
    photo's vectors with the dish (the chosen food when the guess was corrected); a new photo with mean cosine > 0.8 lifts
    that dish by up to 3.
  - Browser runtime check (onnxruntime-web 1.22, both int8 models): browser vs Python vectors cosine 0.99; 0.2 s + 0.7 s on one
    desktop core (a phone ≈ 2–4 s).
  - **Next for accuracy (not done):** train on commercially licensed food photos — MM-Food-100K (OpenRAIL, 100k phone photos;
    mostly Asian; hosted on file.b18a.io, blocked in this sandbox, reachable from GitHub Actions) and Wikimedia Commons CC0/CC BY
    photos of Egyptian dishes — as image prototypes per bank entry; expected to lift top-1 well above 80 %. Remove photos that
    also appear in the Middle-Eastern test set (it looks derived from MM-Food-100K). Ali was asked whether an optional online
    "precise mode" (paid per photo, the photo leaves the phone) is wanted — awaiting his answer.

### 5.52 (11 Oct 2026, v6.18, versionCode 79) — food photo calories: one amount question per item (measured 93 % within ±25 %)
Ali: "I don't want mistakes" / "I want an accuracy of above 80 percent".
- **Measured first (tests/trials/photokcal.mjs, 40 real plates with per-ingredient grams, `SET=`, `PROMPT=v2…v5`, `RAW=` keeps
  every answer, `RESCORE=1` re-scores without the model):** photo-only calories are 35–55 % median error whatever the model —
  Qwen 0.8B 55 % (writes "fried egg, tomato, cheese" on almost every plate), 2B 64 %, 4B 45 %, Gemma 4 E2B 22–52 % by prompt,
  E4B 32–44 %; best case ≈ 40–55 % of plates within ±25 %. The models name foods well but misjudge the amount.
  Small models copy any food named in the prompt (v2 with examples: "burger patty, bun" on half the plates).
- **So the person gives the amount, in one tap (web-src/fitamount.js):** `amountQuestion(item)` → count (eggs, loaves,
  slices: 1 2 3…, big pieces ½ 1 1½ 2 3 4), plate share (a little, ¼ ½ ¾ full, heaped; grams per food type, `fullPlate`),
  drink (its own container: cola = a 330 ml can), spoons (1 tsp … 3 tbsp, cups when the food has one), sprinkle (nuts, seeds,
  grated cheese: pinch … 2 handfuls). None for exact amounts (written, printed in the photo, barcode, quick add).
  `askFirst` rings the unsure items (biggest calories first, max 3); `answerAmount` scales the nutrients. The row
  `fit-amount` replaces ×0.5…×2 for photo items (typed items keep it). The answer is learned (`learnFix`) and the fast path
  now applies learned foods and amounts too (`fitclip.decide`, it ignored them); a dish set twice is not asked again.
- **Measured (train/simq.mjs logic: the right food + the amount choice nearest the real grams, reference = an independent
  USDA-style table):** 40 tuning plates 70 → 98 % within ±25 %; **1,564 untouched plates 86 % → 93 %** (median 9 %)
  after adding the foods they showed missing.
- Names photo readers write now find the right food (`GENERIC` in `matchFood`, exact only): cheese, burger, salad, white
  cheese, tomato sauce, potato fries, shredded/provolone cheese, breaded chicken, pancake, bulgur wheat, salmon fillet,
  flatbread, ground beef… New foods: tomato sauce, ricotta, beef patty, ham, heavy/whipped cream, chocolate/caramel sauce,
  brioche, burrata, smoked salmon, coconut milk, minced meat, pine nuts.
- **Training on MM-Food-100K (OpenRAIL) — built, measured, not shipped:** `.github/workflows/food-train.yml` +
  `tools/embed_mmfood.py` read all 100,000 photos with the phone's two models on 8 GitHub machines (≈ 1 h; release
  `food-train-v1`: vectors + table, no photos). Name prototypes / Tip-Adapter / nearest-photo bonus: Food-101 +1.4,
  Middle-Eastern +1…4, Arab dishes −1…3 (the photos are mostly Chinese/SE-Asian); calories from the nearest photos: 12–18 %
  within ±25 %. Useful later for Asian dishes; 83 of its photos are near-duplicates of the test sets (drop cos ≥ 0.92).
- The photo bank (`food-clip-v2`) does not know the 13 new foods until `food-clip.yml` runs again (Actions → Run).

### 5.53 (11 Oct 2026, v6.18) — Fit & Food's three looks, the photo loading screen and labels on the photo; Maps look A
- **Fit looks (Ali: "all 3 optional in the settings but the default is A"):** `web-src/fitlook.js` (+ `fitlook-ui.jsx`).
  Mock-ups: artifact "Fit & Food new look". Fresh (light green, default), Night (dark teal), Bold (white/orange).
  Tailwind 4 colours are CSS variables, so a look just redefines the palette for the page while Fit is open
  (`body:has(.fit-look-<id>)` — Attune's own wrapper is behind Fit and stayed dark otherwise). Light looks turn the
  slate scale around (950 = page, white = ink) and darken accents; filled buttons keep white writing (`ON_FILL`).
  `st.look` in Fit's state; the picker (`LookPicker`) is at the top of Fit's settings. No web fonts (no CDN rule).
- **While a photo is read:** `PhotoLoading` — the photo (scan line / pulse / spinning ring), the stage, and one of 12
  sourced facts (WHO, EFSA, USDA, Atwater…; EN + AR) every 5 s.
- **Labels on the photo:** `PhotoMarks` + `placeMarks(items)` — each food with a box (from the photo reader) gets a
  label (name + kcal) on the nearer side, spread so they never overlap (tested), and a line to it measured after
  layout; Night adds numbered pins (same numbers in the list), Bold a dashed frame per food. One dish with no box =
  the whole plate (points at the middle); others without a box are chips at the bottom. `useLayoutEffect` was added
  to `web-src/build/react-shim.js`.
- **Maps look A (Ali: "make it like an app inside Attune"):** mock-ups: artifact "Maps new look". Full screen —
  `mode === "map"` hides Attune's header and nav like Fit; `onExit` (← in the search bar) and `listen` (voice) come
  from attune.jsx. Light map style (`dark: false`). Search bar: ← · input · mic · country badge (`map-open-offline`).
  Sheet: peek = your places as chips + `map-mode`; tabs show when pulled up; place card with Directions/Save/Share and
  "Other matches" (`sel.from`). The offline search now also tries `MS.variants()` (Ali's "Address east compound").
- Tests: `e2e_v718looks.py` (draws its own plate with PIL — PNGs in tests/ are git-ignored), `unit/fitlook`,
  `e2e_v722maps.py` (full screen, bright style, ← back), `e2e_v700maps.py`.

### 5.54 (11 Oct 2026, v6.18) — Business as an app of its own: introduction, five-step builder, Home/Form/Reports, AI design chat
- **Ali:** "rework the whole Business UI … an app in the app with introductions … step by step"; "an AI chat inside
  Business where I ask it to change the design"; "a mix of the 3 in a brilliant way" (mock-ups: artifact "Business new
  look", looks A guided / B workspace / C studio); "a form like Microsoft Access for data entry".
- **Files:** `web-src/biz-ui.jsx` (the app), `biz-steps.js` (steps, interview suggestions, checks, alerts, chart data —
  pure, `unit/biz.test.mjs`), `erp-screens.js` (the system's look: colour, menu, density, home parts, KPIs, list
  columns, form order/sections/hidden fields; `applyScreenOp` is reached from erp.js `applyOne`, so the AI, Undo and
  the design history all work on screens too). `erp-ui.jsx` keeps `SystemView` (now `embedded`), BusinessPage is gone.
- **Look:** light professional palette for all of Business (`LIGHT_BASE` from fitlook.js); the system's colour
  re-maps the teal accent (`accentVars`). biz-ui uses hex classes (`bg-[#FFFFFF]`) — slate/white are re-mapped there.
- **Builder:** Name → Data → Logic → Screens → Launch; each step asks one question with one-tap answers computed from
  the design (no model needed) plus free text to the model; phone + computer previews; Undo; "Design" on a live system
  reopens the same steps (Done saves).
- **A system:** coloured header, tabs Home (KPIs, latest, chart, alerts) · Tables (the old grid with Design/Queries/
  Forms/Summary/More) · Form (Access-style: one record, ◀ ▶ first/new, Record n of m, required checks, related records)
  · Reports; the ✦ button opens the design chat (shows the change first, Apply, Undo).
- Tests: `e2e_v718biz.py`; `harness.py` got `to_tables` and `leave_apps` for the older Business tests.
- **Phone AND computer (Ali: "design the same business system if I use it both on mobile or desktop"):** one system
  (tables, rules, records, colour shared); `ui.homeComputer` (null = same as the phone) and `ui.formCols` (1–3) are
  the computer's own; ops `setHome {device}` and `setFormColumns`. Screens step: a Phone | Computer switch
  (`biz-device-*`, sticky `biz:device`). `useWide()` (≥ 900 px) switches `SystemShell` to `data-layout`
  computer-left (coloured side menu + tables list) or computer-top, full width (attune.jsx drops its max-w-3xl wrapper
  for Business); Home in two columns, the form in `formCols` columns. The exported app file follows: computer menu,
  form columns, form order, sections, list columns and hidden fields (CSS `@media (min-width:900px)`).

### 5.55 (11 Oct 2026, v6.19, versionCode 80) — a bare product name searches the web; packs don't answer for other models
- **Ali's screenshot:** "Lynk and co 900" (Web · Auto) → "Your Knowledge does not contain… you may be thinking of the 01 or 02".
  Two causes: Auto searched only for words like price/specs/latest, and the packs' passages about the Lynk & Co 02 / 08
  were handed to the model as if they were about the 900.
- `router.js` `looksLikeProductName()` (a name + model number, maybe Pro/Max/Hybrid…, ≤ 8 words; not "give me 5", "page 12",
  sums) → `wantsWeb` true. `knowledge.js` `keepCovering(hits, q)`: when the question names a model number, only passages
  that mention it are used (years and maths questions are not filtered); chat.jsx applies it before `factsBlock`.
- Tests: `unit/v710router`, `unit/knowledge`, `e2e_v700auto.py` (types "Lynk and co 900", checks the web search).

### 5.56 (11 Oct 2026, v6.20, versionCode 81) — the photo name bank updates itself; fried eggs on toast
- **Ali's photo:** four fried eggs on toast → "Eggs with tomatoes, 123 g = 22 kcal". The bank line «eggs with tomatoes» was
  `~tomato` in the first bank (fixed to `~shakshuka` in 9d8127b), but the phone never downloads the bank again.
- **Updates:** `tools/build_food_clip_bank.py` writes a sha256 per file in the manifest; `FoodClip.install()` fetches only
  files whose fingerprint changed (an old manifest without fingerprints: the .json bank is fetched again, models kept by
  size); `{"update":true}` from the page = the quiet daily check (`fitclip.updateDue`, once / 20 h when Fit opens; files over
  5 MB wait for Wi-Fi; the manifest keeps the old entry of a skipped file). `resetClip()` → the next photo loads the new bank.
- **Safety net (works offline, before any update):** `fitclip.entryFood` — a bank name that is exactly a main-table food's
  name or a GENERIC name (`F.exactFood`, no country dishes) uses that food: an old «eggs with tomatoes = tomato» → shakshuka.
- **New food** `egg-toast` "Fried egg on toast" (76 g piece, 224 kcal / 100 g; amount question counts pieces: 4 ≈ 680 kcal);
  bank: `egg-toast fried eggs on toast|eggs on toast|…|fried eggs on bread`; GENERIC: "eggs with tomatoes" → shakshuka.
- Tests: `unit/v622fitclip` (old bank entries, 4 eggs on toast, the daily check).
- **Web answers sized to the phone (Ali: "Reading 10 pages… 5 min 19 s — when will it end", Core Lite at 7.5 tokens/s):**
  attune.jsx keeps the measured speed (`attune:speed:v1`, running average of `tps` / `promptTps` from answers ≥ 40 tokens;
  cleared when another model starts; `api.speed()`). `research.timeBudget(speed)` → read ≈ 35 s, write ≈ 70 s (70 / 180 s
  for "More detail" / detail questions). chat.jsx: fewer pages (≈ 900 tokens each), a smaller passage budget, `maxTokens`
  capped for every web answer (found pages or not), and on a slow phone (< 1,200 answer tokens) no section template but a
  "answer in about N words" note. Tests: `unit/v712shape`, `e2e_v700auto.py` (7.5 tokens/s → max 525 tokens, short prompt).

### 5.57 (12 Oct 2026, v6.21, versionCode 82) — Maps: directions inside Attune + many more places; Q&A packs; packs before the web; faster search
Ali: "what's the point of maps if it will redirect me to another map, a lot of places is not in the map" → he approved
directions on the phone + Overture places. Then: "add huge databases for knowledge packs so the app doesn't do a lot of
internet searching … improve internet searching and make it faster".
- **More places** (`tools/build_map_pack.py overture`, a step in map-pack.yml): Overture Maps Places (Meta / Microsoft /
  Foursquare / AllThePlaces; CDLA-Permissive-2.0, Apache-2.0, CC0 — commercial OK) merged into `<code>-places.sqlite`:
  confidence ≥ 0.5, open, the country's own (address country), a commercial-safe licence, no phone-number adverts, not
  already in the OSM index within ≈ 150 m. Overture categories → OSM kinds for the chips (`OV_KIND`). Measured Cairo + Giza:
  148,524 → +87,190 places (Palm Hills, Madinaty, Mall of Arabia, SODIC, B.TECH, Seoudi…). Read from S3 with pyarrow
  (anonymous; DuckDB's httpfs can't be downloaded in the cloud sandbox). Test: `e2e_v720overture.py`.
- **Directions, offline** (`tools/build_route_graph.py` → `<code>-route.bin`, `web-src/route.js`): Overture's
  transportation theme (OSM roads, ODbL), roads split at junctions; one-way = `access_restrictions` heading denied for vehicles
  (people may walk both ways); speed = limit × 0.85 or a class default. The file = a JSON directory + blobs: squares of 0.1°
  and a backbone (motorway…secondary). route.js reads only what a trip needs by byte range (`N.mapRead`), joins them by
  country-wide node id, A* (car = time, walk = 1.35 m/s), steps from names and turn angles (`tidySteps` folds short unnamed
  links). Measured: west Cairo 195k junctions → 19 MB; Egypt ≈ 3.7 M road pieces ≈ 300 MB → an OPTIONAL download
  (`MapPacks.isRoutes`, `installRoutes`, bridge `mapInstall {routesOnly}`); the map's size excludes it (`packBytes`).
  Sheikh Zayed → Dokki 29 km / 27 min in 0.75 s (node). UI: Directions = a button (map-directions) → download offer with the
  size, Car / Walk, the blue line, time (no traffic), steps, "Open in another maps app" as a small link; "Add a missing place"
  (map-add-place: a pin at the centre, a name → your places, searchable offline). Tests: `unit/v720route` (fixture
  `tests/fixtures/cairo-route-small.bin`, 1 MB, downtown), `e2e_v720directions.py`.
- **Q&A packs** (`know_sources.SE_PACKS`, `build_stackexchange`): Stack Exchange data dump on the Internet Archive (7z →
  Posts.xml stream), CC BY-SA 4.0: qa-tech, qa-cars, qa-home, qa-science, qa-life, qa-language, qa-code — a question with
  score ≥ 3 and its accepted / best answer (≥ 3), top-voted first, ≈ 100 MB text per pack; no religious, medical or legal
  sites. CATALOG entries `big: true`. Test: `e2e_v720qapacks.py`. (Still no Wikipedia — Ali's rule.)
- **Packs before the web:** chat.jsx — when Auto would search, `knowledge.find` first; `packsCover()` (≥ 80 % of the
  question's words in one of the best three passages) and not `router.needsToday()` (prices, news, weather, latest, years…)
  → answered offline, no web.
- **Faster search** (WebTools.kt): one shared deadline for the engines (DDG + Bing ≤ 8 s; Brave + Mojeek +1.2 s once those
  answered) instead of 16 + 16 + 10 + 6 s in a row; quick questions read pages 50 % / 2.5 s / cap 6 s (was 60 % / 4 / 9).

### 5.58 (12 Oct 2026, v6.22, versionCode 83) — web answers: code reads every page in full (phone-only "loophole")
- Ali: "the Lynk & Co answer is lame — as strong as Gemini, find a loophole". Options given (his own Gemini key, his PC as
  the brain over Wi-Fi, both, phone-only) → **he chose phone-only** (12 Oct 2026). No cloud, no PC — don't offer them again.
- The loophole: code is nearly free on the phone, the model isn't. The model still reads a short, speed-sized slice
  (§5.56 timeBudget), but the facts sheet (factsheet.js) is now built from EVERY page found, in full (webCtx.toRead, up to
  16,000 characters each); pages the model didn't read are added to the source list so citations stay right. The page
  count is no longer cut on slow phones (fetching costs no model time).
- factsheet.js: new specs `powertrain` (plug-in hybrid / EREV / EV / hybrid / petrol / diesel), `drive` (AWD / FWD …),
  `launch` (month + year); word-valued specs read sentences with no number (`WORDY`), and a "Spec | Value" row only gives
  them a value that IS one. Up to 3 tables, versions / trims / prices first. Test: `unit/v721sheet`.
- Cars pack (know_sources.py): + Natural Resources Canada fuel-consumption ratings 2015 → newest model year (Open
  Government Licence – Canada) via the open.canada.ca CKAN API (`nrcan_rows`, columns found by their words). China-only
  models (e.g. the Lynk & Co 900) are in no open dataset — the web covers them.

### 5.59 (12 Oct 2026, v6.23, versionCode 84) — Fit diary: edit everything, copy one food
- Ali: "I can't edit anything after I press save except the grams, and I can't copy the meal by itself, I have to copy all the breakfast".
- Swipe a logged food → **Copy · Edit · Delete** (`LogRow`, 168 px of actions).
- **Edit** opens `EditFood` (fit-ui.jsx): name, grams (the numbers follow), calories / protein / carbs / fat / fibre typed in,
  and the meal (moves it). Pure helpers in `fithome.js`: `replaceAt(day, meal, i, x, to)`, `editedFood(x, base, fields)`
  (grams scale from `base`, which takes typed numbers; a new name drops the old `ar`).
- **Copy** one food: `CopySheet` with `item`; `fitplus.js copyItem(days, toKey, toSlot, item)`; the same day and meal is allowed.
- Test: `tests/e2e_v723editfood.py`. `e2e_fithome.py` still edits grams through the sheet (same test ids).

### 5.60 (12 Oct 2026) — DESKTOP APP, Windows first (IN PROGRESS — read this before touching `desktop/`)
- **Ali's decisions (12 Oct 2026, don't ask again):** layout on a computer = **like Claude / ChatGPT** (left sidebar:
  New chat, chat history, the tools; the open chat or tool fills the rest, chat text in a centred column).
  **Windows first**, macOS and Linux after. Stay phone-only for AI (no cloud), same as the phone.
- **What exists:** `desktop/` = Electron shell (P1 of `DESKTOP_PLAN.md`): chat, model install/use, engine, info,
  stash, saveFile, fetchJson, air-gap. CI `.github/workflows/desktop.yml` builds Windows/macOS/Linux installers
  (last green run 37169225266, 4 Oct). The page = the same `app/src/main/assets/www/index.html`.
- **What the phone bridge has that the desktop lacks** (NativeBridge.kt, 105 methods): search / fetchText / news /
  fetchShare / dorarSearch / fxRates (WebTools.kt), knowledge packs (know*), map packs (map*), PDFs (pdfText,
  pdfWords, pdfOutline, pdfImages, makePdf, pdfEdit, htmlToPdf), hash, clipboardText, readText, speak, schedule /
  notifications, doctor / speed / setSpeed, food pack / food clip, Studio (imagine…), listen. Phone-only (never on
  desktop): health, Huawei, widgets, barcode camera, intent, gallery.
- **Plan, in order (each step pushed when its tests pass):** (1) web-src wide layout like Claude/ChatGPT;
  (2) web search on desktop (port WebTools.kt to Node); (3) knowledge + map packs (same files; `node:sqlite`);
  (4) PDFs + converters (printToPDF, pdf.js); (5) hash, clipboard, speak, reminders, doctor/speed, food pack;
  (6) desktop.yml on main, Windows installer link for Ali; (7) Studio pictures (sd-cli) later.
- **Testing here:** Electron downloads and runs in this sandbox (`npm i electron@44.5.1` works); run with `xvfb-run -a`.
- Progress notes go below this line as each step lands.
- **Step 1 DONE (v6.24, versionCode 85): the Claude/ChatGPT layout** — `web-src/side-ui.jsx`: `useDesktopWide()` (≥ 1024 px),
  `useSide()` (open/closed remembered in `attune:side:open`; sets `html.att-wide`, `--side` = 268px, `--nav-h` = 0),
  `DesktopSide` (New chat, search over chats AND tools, Chat/Instant/Money/Business/Mind, "All tools" in MORE_GROUPS,
  recent chats grouped by day with rename/delete, engine + Profile/Plan/Backup/Settings at the bottom).
  Chat publishes its list as the `attune-chats` event and obeys `attune-chat-cmd` {op: rename|delete}; open = `setOpenChatId`.
  Pinned panels carry the class `att-shift` (CSS in `build/shell.html`: `html.att-wide .att-shift{inset-inline-start:var(--side)}`)
  and use `var(--nav-h, 58px)` instead of 58px. Phones unchanged. Test: `tests/e2e_v724desktop.py` (`new_page(..., desktop=(w,h))`).
- **Step 2 DONE: web search on the desktop** — `desktop/lib/web.js` = WebTools.kt in Node (cheerio 1.0.0): 4 engines, shared
  deadline, rank fusion, no Wikipedia, junk filter, pages read with tables as rows, og:image thumbnails (Electron nativeImage),
  Google News RSS. Requests go through Electron `net.fetch` (system proxy + certificates). Bridge: search, news, fetchText,
  fetchShare, dorarSearch, fxRates. Test: `desktop/test/web.js` (sample pages; the real engines run in CI via the smoke test).
- **Step 3 DONE: knowledge packs + maps on the desktop** — `desktop/lib/packs.js` = KnowPacks.kt + MapPacks.kt (same releases,
  same BM25 search; `node:sqlite` has FTS4 + matchinfo). Bridge: knowPacks/knowRemote/knowInstall/knowRemove/knowSearch/
  knowPackText/foodPackText, mapPacks/mapRemote/mapInstall (routes, parts)/mapRemove/mapRead/mapSearch, unmetered.
  Test: `desktop/test/packs.js` (+ LIVE: the real cranes pack downloaded, checked, searched — passes here and in CI).
- **CI:** `desktop.yml` now runs on pushes to `main` that touch `desktop/**` or the built page: Windows + Linux
  (macOS by hand: "Also build macOS"). Unit + web + live packs + smoke (sidebar, bridge, live web search) + package + smoke the
  packaged app. Artifact for Ali: `attune-desktop-windows-x64` (Attune Setup 6.24.0.exe, unsigned → "More info → Run anyway").
- **Step 4 DONE: PDFs on the desktop** — `desktop/lib/pdf.js` + `desktop/pdfworker.html`: reading in a hidden window with
  pdf.js 4.10.38 (served as app://attune/__pdf/…): pdfText (lines, paragraphs, w/h, scan flag), pdfWords, pdfOutline, pdfImages;
  htmlToPdf = Chromium printToPDF (own session "attune-print", network blocked); makePdf = pdf-lib pictures + blocks printed as
  HTML; pdfEdit = pdf-lib merge/split/pick/rotate/annotate. Arabic stored as shaped letters in visual order is put back (fixRun).
  NOT ported: the phone's PDF→Word layout extras (`lines` with fonts/colours, `rects`, `imgs`, `glyphs`) — the converter falls
  back to plain paragraphs on the desktop. Tested in the smoke test (print → read back EN+AR, picture, words, merge, split, rotate).
- **Step 5 PART DONE:** reminders → system notifications (`desktop/lib/reminders.js`; ring while Attune is open; click opens
  the reminder via the page's `attune-share` event), clipboardText, hash (model check). Read aloud uses the browser's voices
  (chat.jsx no longer calls a missing NATIVE.stopSpeaking). Green: Windows + Linux run 38264160588, APK 38264160569.
- **v6.25 — Back on a computer** (Ali: "there is no back in the app, it keeps building up tabs in the desktop"):
  the sidebar has a ← (shown only when there is somewhere to go: a tool, an open panel or an inner page — `useBackDepth()`
  in backstack.js makes it react); Alt+←, the keyboard's Back key and the mouse's back button go back one step (a 300 ms
  guard: Windows sends the mouse button twice — as a click and as the `app-command` main.js forwards as `attune-back`);
  Esc closes an open panel / inner page (not while typing). The desktop app is now single-instance
  (`requestSingleInstanceLock`): opening it again focuses the open window instead of a second window + second engine.
  Test: `tests/e2e_v724desktop.py` (Back section).
- **v6.26 — desktop look "A + C" (Ali picked it from 3 mock-ups, 12 Oct; colours KEPT as they are — Business/Fit light):**
  sidebar = Home · Chat · Tools · Mind · Money · Business, then **Pinned** tools (★ on the Tools page; `attune:side:pins`,
  default convert/fit/map), then recent chats. `web-src/desk-ui.jsx`: `DesktopHome` (greeting, ask box → a NEW chat sent at
  once via chatSeed "\u0002…" — kept in the box when no model is loaded; Today card from storage: kcal eaten, reminders
  left, chats; cards Money/Business/Mind (v6.27: Maps taken out — Ali) + recently used tools `attune:tools:recent` + All tools) and `ToolsPage`
  (every tool, 4 columns, by group, find box, ★ pin). A computer opens on Home (`mode` "home"; Back ends at Home); a
  narrow window returns to Chat. Tool pages: `att-page` + CSS in shell.html lifts their phone-width `max-w-*` columns
  (not dialogs); File Converter grid 4 columns; the top bar is hidden for tools with their own title (`OWN_TITLE`); no
  second ← or model chip in the bar on a computer; the floating line at the bottom is gone; Mind's + sits in the corner.
  `i18n.js forDesktop()`: in the Windows/Mac app "your/this/the phone" reads "computer" (not "phone number/call/app"),
  Arabic هاتفك → جهازك. Esc closes only the app's own panels (Shelf's own Esc kept a page open → fixed).
- **v6.26 — Windows engine fix (Ali's PC: "Stopped · Zenith", six silent starts):** the Windows llama-server was built
  with ClangCL against the Visual C++ runtime + OpenMP DLLs, which CI machines have and a normal PC does not.
  desktop.yml now builds ONE static exe (`BUILD_SHARED_LIBS=OFF`, `/MT`, `GGML_OPENMP=OFF`) for `engine/vulkan` AND a
  CPU-only `engine/cpu` fallback, and a CI step fails if any exe imports vcruntime/msvcp/libomp/vcomp/ggml/llama DLLs.
  ALSO OpenSSL: llama.cpp linked libssl-3-x64.dll / libcrypto-3-x64.dll found on the runner → `-DLLAMA_OPENSSL=OFF`.
  The CI check is an ALLOWLIST (only Windows' own DLLs + vulkan-1.dll), so any new outside DLL fails the build.
  `engine.js` writes why an engine stopped (`exitReason`: DLL missing 0xC0000135, no AVX2, crash, out of memory…) and
  handles spawn errors (antivirus).
- **Next:** rest of step 5 (hash, clipboardText,
  readText, speak/stopSpeaking, schedule → Notification, doctor/speed/setSpeed, foodClip*), then Studio (sd-cli), signing, updates.

### 5.61 (13 Oct 2026) — v6.27: roadmap, no Brave, maps without OpenStreetMap's tile servers, online planet (R2)
- **Roadmap** agreed with Ali: `ROADMAP_2026-10-13.md` (sync via Google Drive, device levels, code-first, design A "Calm",
  Life layer). Read it after APP_HANDOFF.md.
- **Brave removed** (page scraping and the API option): `WebTools.kt`, `desktop/lib/web.js`, settings in `attune.jsx`.
  Free search = DuckDuckGo + Bing + Mojeek at once (reciprocal-rank fusion). A paid API for Pro only if it measures close
  to Gemini (roadmap).
- **Maps never use tile.openstreetmap.org** (it forbids apps; 403 on the desktop). The style with no pack is just the
  ground. New pack **`wld`** (world overview, maxzoom 6) built by `map-pack.yml` job `world`; the map page downloads it
  by itself on Wi-Fi when no map is installed, else shows "No map on this device yet" + "Download the world map".
  `countryOf("wld")` / `countryOf("online")` have names (the update banner crashed on `wld` before).
- **Online map, $0 (Ali: "I don't want to pay for maps"; R2 and OpenFreeMap both rejected; he picked "our own packs"):**
  with signal, the country the map looks at is read ONLINE from its free GitHub release without downloading it —
  `"net:<code>"`. The phone/computer fetch only the pieces on screen: `MapPacks.range` (Kotlin) / `packs.mapRange`
  (desktop) = HTTP Range requests (≤ 4 MB, files in parts mapped onto the right part, the manifest cached 6 h, every
  request through the offline lock); the page's `OM.NetSource` asks `nativeCall("mapRange")` (no browser CORS limits).
  Before the first online view only the fonts/icons download (`mapAssets`, a few MB). Map choice (map-ui.jsx): the
  country in view if downloaded → that country online (`OM.nearestCountry` of the view centre, zoom ≥ 4) → the country
  you picked → first downloaded → world overview → "No map yet". All 44 packs (~50 countries) are published, so all
  stream today.
- **Online search of every place, $0:** `<code>-find.bin` (build_map_pack.py `find`, a new map-pack.yml step) = the
  places index (OSM + Overture) cut into gzip pieces by the first 3 letters of each word (the Arabic "ال" skipped; words
  in > 0.4 % of places are "common" and not used to cut, except a place's rarest common word when it is ≤ 1.5 %). The
  app's `OM.netFind` reads the 16-byte header + the index once (Egypt: 130 KB), then ONE piece per search (Egypt:
  median 0.3 KB, biggest 416 KB) via mapRange. Egypt: 436,120 places → 14,656 pieces, 45.6 MB file. Measured on the
  real Egypt index: Madinaty, Palm Hills, Mall of Arabia, City Stars, El Rehab, Seoudi, B.Tech, مستشفى السلام all
  found in 4–50 ms. "Address East" is in NO free source (OSM or Overture) — "add a missing place" covers it.
  map-ui runSearch: saved places → installed pack → the view's country online (netFind) → Photon/Nominatim/Overpass.
  Never downloaded with the pack (`isOnlineOnly`, Kotlin + desktop; packBytes skips it). Published from the next
  map-pack run (weekly, Fridays; run it by hand for a country).
  Tests: `tests/e2e_v727online.py` (map + search), `desktop/test/maprange.js` (+ `tests/unit/v727maprange.test.mjs`,
  desktop.yml), `tests/unit/v727netfind.test.mjs` (builder ↔ netFind).
- **AI-powered search, code first (Ali: "every place, offline, and AI-powered"):** `web-src/mapintent.js`
  `parseMapQuery` reads what was typed into {sort (22 sorts, Arabic formal + Egyptian + English words → index kinds),
  what, area, near}: «أقرب صيدلية», «بنزينة جنبي», «كمبوند في التجمع», «مطعم سوري في مدينة نصر», «ATM near me».
  The area is found in the map's own index (a `place/*` first) and searched around; near = your location. Only a
  longer request code can't read goes to the phone's model (`ask` prop = callClaude, 120 tokens, only when a model is
  already loaded — never waits), which fills the same JSON from the same fixed list (`readModel` drops anything else).
  map-ui `searchAt` (saved → installed pack → country index online → web) is used for names, sorts and chips; a sort
  online searches its word in English AND Arabic (`sortNames`) and keeps only that sort's kinds.
  Tests: `tests/unit/v727mapintent.test.mjs`, e2e_v727online («أقرب صيدلية»), e2e_v722maps («أقرب بنزينة» offline).
- **Compounds:** `build_map_pack.py` now indexes named residential areas — gated ones (`residential=gated`/`gated=yes`)
  as `place/compound` (62), the rest as `place/residential_area` (60: many are towns or resorts, e.g. حلايب) — they
  were dropped from offline search before. Egypt build of 13 Oct: 436,696 places, +627 residential areas. Most real
  compounds are already there as `place/neighbourhood` (Mivida, Hyde Park, Eastown, Al Burouj; 712 names with
  كمبوند/compound) — the «compound» sort covers all three kinds. World pack published: wld.pmtiles 45 MB (zoom ≤ 6).
  Egypt's eg-find.bin published (45.6 MB).
- **Compounds NAMED on the map (our own label layer `att-areas`, map-ui `addAreaLayer`, zoom ≥ 12):** the basemap only
  labels neighbourhoods drawn as points; compounds drawn as areas, and Overture's, never showed. Now the places index's
  named areas (`OM.AREA_KINDS`: compound, residential_area, neighbourhood, quarter, suburb) are labelled where you look —
  compounds in teal, first. Offline: `mapSearch` {kinds, radiusDeg} on the downloaded pack. Online: find.bin's new
  `areas` section (0.25° squares, gzip; Egypt: 171 squares ≈ 260 KB in all) via `OM.netAreas` (one square ≈ a few
  KB, cached). Re-read on every map stop (250 ms debounce) and after each style change ("style.load").
- **Google-like order (`MS.rankPlaces` / `placeScore`, mapsearch.js):** every result, whatever its source, gets
  4×name match (whole name 1, starts with 0.85, a whole word 0.75, else words × 0.6) + importance (index `rank`/100, or
  by kind) + 1/(1 + km/10) + 0.4 for a saved place. "Nearest X" stays sorted by distance. `rank` now comes back from
  the phone's and the computer's mapSearch. Tests: v707mapsearch (Madinaty town beats "Madinaty Pharmacy" next door…).
- **Ask the map from Chat:** `MI.chatMapIntent` (mapintent.js) spots a map question — a "where / nearest" word AND a
  sort, or "where is <a short name>" (personal or technical things excluded: «فين مفاتيحي», «where is the bug…»,
  «nearest star»). chat.jsx shows an emerald card "A place — Maps finds it" [Show on the map | Just answer]; the
  "attune-map" event stores the search in `attune:map:ask` and opens Maps, which runs it on open. No model needed.
  Tests: v727mapintent (Chat cases), `tests/e2e_v727chatmap.py`.
- Tests: `tests/unit/v722maps.test.mjs` (world name, online style), `tests/e2e_v722mapbuilder.py` (compounds).
- `tests/audit.py` never finished since a full page (Fit/Money) hides the bottom bar: it now presses the app's Back
  until the bar shows. It then found the Instant page's "Go" off a 320-px screen → that toolbar wraps now.

### 5.62 (13 Oct 2026) — design A "Calm" begins: tokens, fonts, Money on a computer
- **Tokens** (web-src/build/tw.css, class `.calm`): from Ali's pick (claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4) — light
  bg #F4F5F3 / cards #FFF / ink #16201D / muted #6B7672 / lines #E4E8E5 / teal #0F7B6C (+ soft #E2F1ED); dark bg
  #111416 / cards #181C1F / teal #4FC2AF; green / amber / red only for good / due / overdue. Light follows
  html.att-light (spaces.js applyTheme). Helpers: c-card, c-lbl, c-sub, c-amt, c-num, c-pill(.due/.late), c-list,
  c-ic, c-tab, c-btn, c-bar, c-ticks. Fonts (SIL OFL, in www/fonts, 252 KB): Figtree 400–700 + IBM Plex Sans Arabic
  400–700 (Arabic range only). Six icons added to build/lucide-shim.js (ShoppingCart, Car, Utensils, Gift, Coffee, Heart).
- **Money on a computer** (`web-src/money-desk.jsx`, shown when `wide`): title + tabs (Overview · Transactions · Bills ·
  People & debts · Zakat · Reports · Accounts). Overview = 3 columns from `money-calm.js moneyOverview(ledger)` (pure,
  by code: balance per currency — never adds EGP to USD; this month in/out; 4 weeks of spending vs budget; latest 6;
  bills due ≤ 7 days, late ones marked; who owes you with paid-instalment ticks; what you owe). Every other tab is Yusr
  itself, kept loaded below (MoneyTab `screen` prop → new bridge message `go` → Yusr's `go(screen)`, whitelisted
  screens only). The phone keeps Money exactly as before. Re-reads the ledger on the "storage" event.
  Tests: `tests/unit/v727moneycalm.test.mjs`, `tests/e2e_v727moneydesk.py` (dark + light, screenshots with SHOTS=).
- Next in "Calm": the phone Home (Today card + areas, bottom bar Home·Chat·Money·Health·Mind), then the 7-area tool map.

### 5.63 (13 Oct 2026) — the Life layer: "People & plans"
- `web-src/life.js` (pure): `parseLife(text)` reads a sentence in English, formal Arabic or Egyptian Arabic into a
  commitment {kind installment|debt|circle|bill|rent|subscription, person, dir in|out, amount (each payment), count,
  total, every month|week|year|null, start, myTurn, currency}. Rules per language; amounts with Arabic digits, "12 ألف",
  "1.5k", "ألفين"; counts/days/turns are never read as money; "monthly" is not Monday; one amount "a month" is each
  payment, "in 12 / على 12" splits a total. Savings circles under local names (جمعية, tanda, susu, chit fund, hui,
  arisan…). `scheduleOf` (dates), `progressOf` (paid / left / next), `tickText` (the sentence Money already reads:
  "Received 1,000 EGP from Ahmed — installment 4 of 12"), `dueSoon`, store `attune:life:v1`, model fallback
  `lifeModelPrompt` / `readLifeModel` (same fields, fixed kinds). `chatLifeIntent`: statements only, questions stay.
- `web-src/life-ui.jsx` `LifePage` (mode "life", tool "People & plans", first in "Your life"; Calm design): type → read
  by code (the loaded model only if the rules can't) → preview → Save; groups People / Installments / Savings circles /
  Bills…; a checkbox per payment (≤ 24 shown); a tick → confirm → `sendToMoney(tickText)` (Money asks for the account).
  Chat: a commitment typed there → emerald card [Save it | Just answer] → "attune-life" event → the page opens with it read.
- Tests: `tests/unit/v727life.test.mjs` (68: Ali's example 7 ways, debts, circles, bills, rent, subscriptions, my
  installments, non-commitments, schedule/ticks/store/model), `tests/e2e_v727life.py`, `tests/e2e_v727chatmap.py`.
  The roadmap's ~500-sentence set per language: grow this file with every sentence that fails in real use.
- Next: show "People & plans" in Money (People & debts tab) and Home's Today card; reminders for due payments.

### 5.64 (13 Oct 2026) — design A "Calm" on the phone: Home, the bottom bar, the tool map
- **The phone opens on Home** (`web-src/home-ui.jsx` PhoneHome, Calm tokens): date + greeting, "Ask or add anything" (→
  Chat with the text), TODAY (`home.js todayList`: People & plans' due payments + Money's bills due ≤ 7 days, late
  first, ≤ 4 lines + today's reminders; a line opens People & plans or Money), Spent this month (of the budget) and
  Food today (of the Fit goal, `fithome.targetsOf`), then the areas Money · Health · Mind · Files · Places · All.
  `attune:start` = "chat" keeps the old start — **the test kit (harness.new_page and the tests with their own context)
  sets it**, so older tests still start in Chat; Home tests set "home". A narrow window no longer drops Home.
- **Bottom bar:** Home · Chat · Money · Health (Fit) · Mind · All (the sheet). Instant and Business moved into All.
  Tests that pressed "the first button" for Chat now press "Chat"; Business/Instant are opened from All.
- **All = the agreed tool map:** Money & people (People & plans, Deal Check, Reminders) · Health (Fit, Cycle) · Mind &
  learning · Chat (Instant, Assistants, Skills, Projects, Artifacts, Chat X-Ray) · Files (Converter, Ask a PDF, Slides,
  CV, Video Downloader) · Places (Maps, Travel) · Business (add-on) · Create (add-on: Studio, Coding, the prompt tools).
  **Video Downloader stays** (Ali, 13 Oct — he overruled removing it): in Files, second.
- Bills now carry their own name ("فاتورة الكهربا", "Electricity bill", "اشتراك نتفليكس": the words before the amount).
- Tests: `tests/unit/v727home.test.mjs`, `tests/e2e_v727home.py` (light + dark, screenshots with SHOTS=).
- Next in Calm: the remaining screens area by area (Chat, Fit, Mind, Files, Places) in the Calm tokens; People & plans
  in Money's People & debts tab; reminders for due payments.

### 5.65 (13 Oct 2026) — Calm everywhere; "Money tracks itself", by itself
- **Calm is the app's default look** (spaces.js themeVars): the slate scale → `PALETTES.calm` (green-grey; dark ground
  #111416, cards #181C1F, lines #262C2F), teal → `PALETTES.calmteal` (#4FC2AF … #0F7B6C); light = ground #F4F5F3, white
  cards, lines #E4E8E5. Font for the whole app: Figtree + IBM Plex Sans Arabic (tw.css @theme --font-sans, shell.html).
  Settings' other themes (zinc, stone, black, accents) still work. Fit & Business keep their own looks.
- **Money tracks itself (Android):** `PayListener.kt` (NotificationListenerService, manifest + BIND_NOTIFICATION_LISTENER_SERVICE)
  keeps only notifications that look like money (`PayLog.looksLikeMoney`), last 200, private prefs; never SMS; nothing
  leaves the phone. Bridge: payAccess / openPayAccess / payQueue / payForget. Page: `paylog.js` (paytext.js reads each;
  OTPs, balance-only and adverts dropped; the same payment twice kept once; `categorise` — merchants (Wataniya, Seoudi,
  El Ezaby…) then Money's own words; `autoPick` = high confidence only; `appendToLedger` = Money's own add) and
  `paylog-ui.jsx` (PayInbox at the top of Money: access card → "Turn on"; review list Add / Dismiss / Add all).
  **By itself (on by default, "Ask me first" turns it off):** Money closed → `runAutoPay` at app open and every return
  writes the sure ones straight into ledger.v3 + a flash "N payments added to Money by themselves"; Money open →
  PayInbox adds them through Money once it is loaded ("ready"). Unsure ones wait for a tap.
- **Bridge fix:** yusr-bridge.js only allowed 4 message types, so "go" (the computer's Money tabs) never reached Money.
  Now "go" (whitelisted screens) and "add-txns" (1–50 entries, expense/income, no account — Money picks it by
  currency — and never zakat) are allowed and checked; Yusr handles add-txns (categories kept).
- Tests: `tests/unit/v727paylog.test.mjs`, `tests/e2e_v727paylog.py` (by hand, by itself with Money closed, by itself
  with Money open, access off), e2e_v727moneydesk now checks Money really opens its Bills screen.

### 5.66 (13 Oct 2026) — Money Guardian: "Attune pays for itself" (the reason to pay for Pro)
- **What it is:** `guardian.js` reads the person's own data on the phone (ledger.v3 — filled by itself from payment
  notifications —, People & plans, Money's bills) and finds money BY CODE: `late` (someone owes you and the date passed →
  a polite reminder written by code, Egyptian Arabic for an Arabic name, sent on WhatsApp), `double` (same amount, same
  merchant, ≤ 10 min → ask the bank to refund one), `creep` (a steady monthly payment went up ≥ 5 % → the yearly cost),
  `subs` (a subscription paid 3+ months → the yearly total), `fees` (bank fees this month), `due` (a bill in ≤ 3 days).
- **The honest counter** ("attune:guardian:v1"): only what the person did and marked counts — refund got back, a
  subscription cancelled (counts one month for every month since), a rise fixed (rise ÷ 12 a month), and a late debt
  that was ticked paid in People & plans AFTER a Guardian reminder (`noteReminded` → `collected`, wired in life-ui tick).
- **UI:** `guardian-ui.jsx` — `GuardianPage` (mode "guardian", first in All → Money & people) and `GuardianCard` on the
  phone Home ("3 ways to save 2,790"; Pro also "X saved for you this month"). **Pro gate:** Free sees the first finding in
  full and the rest as "2 more ways to save 1,790" → the plan; the counter shows "—". Findings carry `T`/`D` templates so
  titles are translated (i18n-ar.js).
- Tests: `tests/unit/v727guardian.test.mjs` (14), `tests/e2e_v727guardian.py` (Pro: findings, WhatsApp, refund counted,
  collected after a reminder; Free: one shown, rest locked → plan). audit.py TOOLS starts with "guardian".

### 5.67 (14 Oct 2026) — Deadline Radar; the money features made global (Ali: "make everything global")
- **Deadline Radar** (`deadlines.js` pure, `radar-ui.jsx` page, mode "radar", All → Money & people): free trials,
  renewals, return windows, warranties, document expiry (passport 180 days ahead, licence, ID, insurance, visa, car
  registration, bank card). Read BY CODE in en/ar/es/fr/pt/de/it/tr/id/nl: dates (ISO, d/m/y or m/d/y by region,
  "12 Nov 2026", "3 de noviembre", "Nov 12", card "03/27"), durations ("30-day", "2 Jahre", "سنتين"), amounts (dates
  masked first), the item's name (a known service, else the receipt's product line). Model fallback only if a model is loaded.
  Sources: **automatic** — `runAutoRadar` (app open + every return) adds the sure ones from the notification queue and
  schedules reminders, the rest are suggestions; **by hand** — Scan a receipt (ML Kit `readText`; a photo-reading model
  for other scripts), Paste or type, **Add by hand** form (Ali asked for manual input too); Chat «my Spotify trial ends on…»
  → card "Watch it". Photos are kept in IndexedDB `attune-radar`. Home's TODAY lists items inside their warning window.
  Cancelled / Returned / Claimed → `markSaved` kind "radar" in the Guardian counter. Free watches 3 (FREE_LIMIT).
- **paylog**: a charge that hasn't happened yet ("you'll be charged", "renews on", trial notices — many languages) is no
  longer read as a payment.
- **Global**: `locale.js` (homeCurrency: Money's currency, else the phone's region; dateOrder mdy for US/PH);
  `paytext.js` ~55 currencies (+ ambiguous $/kr/¥/Rs resolved by the home currency), every number format (`payNumber`:
  1.234,56 · 1 234,56 · 1,23,456 · 12.500 KWD = 3 decimals), debit/credit/declined words in many languages;
  `paylog.js` worldwide merchants + OTP/balance/promo words; `PayListener.kt` filter any currency code/sign and many
  languages (+ trial/renew words); `life.js` es/fr/pt/de/it/tr/id sentences, month names, "15 November" is a date not an
  amount, default currency = home; Guardian: global subscriptions/fees, neutral Arabic or English reminder, sent via the
  phone's **share menu** (not only WhatsApp); Yusr's first run uses the phone's country/currency (`homeCountry/homeCur`);
  EGP defaults removed from money-calm, myledger, chatxray, erp templates, the org card, research fx (home first).
  Books (Egyptian ETA e-invoice, BASE "EGP") is unchanged — Egypt-specific by design.
- Tests: `tests/unit/v727global.test.mjs` (24 bank messages in 15 countries, numbers, dates, People & plans in 8
  languages), `tests/unit/v727radar.test.mjs`, `tests/e2e_v727radar.py`; desktop `test/reminders.js` (early timer).

### 5.68 (14 Oct 2026) — The agent (levels 1+2), Homework Coach, Family health, Shop in your pocket, Translate, Travel in Calm
Ali: "build a, b, c and the agents part 1 and 2 … don't make the app cluttered, blend them in"; "the code should be smart
and strong enough so the app doesn't make mistakes"; "teaching with visuals, video, audio"; "travel calm and minimal without
removing anything, much stronger"; "translate anything to any language — text, PDF, photo — with exceptional accuracy".
Rule everywhere: **code decides, the model only helps; missing facts are asked, never guessed; nothing irreversible
(paying, a dose) happens without the person.**
- **Agent** (`agent.js`, `agent-ui.jsx`, `agent-kit.js`, `AgentBrowser.kt`): Chat «book a flight Cairo→Istanbul 1 Nov» →
  a card with the plan read by code (airports, dates, people) and links (Google Flights/Skyscanner/Kayak, Booking/Airbnb,
  food and ride apps by country). Level 1 = deep links (the app if installed, the search copied). Level 2 = "Do it here":
  an in-app browser with **Best offer** (ranks offers on the page) and **Fill my details** (from Booking details; never
  card/CVV/password; a "Hotel name" field is not the person's name). It stops before paying. Level 3 (full phone control)
  waits for a Play-policy-safe way (accessibility services are restricted). Tests: `v727agent` unit, `e2e_v727agent(kit).py`.
- **Homework Coach** (`coach-math.js` exact fractions, `coach.js`, `coach-ui.jsx`, mode "coach", Mind & learning): a photo
  or typed sheet → each problem solved BY CODE with steps (arithmetic, linear equations with the check, percentages),
  taught first ("what do you think comes next?"), then similar practice; weak topics remembered. The model only for
  word problems, checked by Python when available. **Lesson player** (`lesson-ui.jsx`): spoken steps (NativeBridge
  `speakWait`, else speechSynthesis) with animated SVG pictures (balance, fractions, dots, number line, percent bar);
  Learn daily got **Listen** with the paragraph highlighted. Brute force: 398 sums + 300 equations, 0 wrong.
- **Family health** (`care.js`, `care-ui.jsx`, mode "care", Health): prescriptions read line by line (counts in many
  languages, 1x2, PRN, insulin units, tapering flagged), daily reminders `med-<id>-HHMM`, today's doses on Home,
  interactions ONLY quoted from the medicines pack's label passages, lab results judged only by the report's printed range.
- **Shop in your pocket** (`shop.js` on Books, `shop-ui.jsx`, Business Hub card): set up from one sentence, sell (cash/card/
  credit, change), stock and recipes, customers, staff hours, the day's close, re-order message. Tax-inclusive shelf prices
  are exact to the cent (16,632 combinations; a "Rounding" line when needed). Through Books' own operations — the ledger balances.
- **Translate** (`translate.js`, `translate-ui.jsx`, mode "translate", Files): numbers, amounts, dates, links, e-mails,
  codes, model names are locked as ⟦n⟧ markers and restored exactly; every piece checked (all markers, the target
  script, not left untranslated, the glossary), retried alone with the reason, then MARKED. Extra careful = round trip
  (tokens + negation by code, a YES/NO judge only when words differ). Photo: the translation drawn over the photo using
  ML Kit line boxes (NativeBridge `readText` now returns x/w and the image size). Documents go through the File Converter,
  which uses the same engine.
- **Travel in Calm** (`travel.js` logic, `travel-ui.jsx` page; the old 310-line block left attune.jsx): five tabs
  Trip · Arrive · Say it · Ask · Know, everything kept. New: the trip (dates, from, people); the **passport** from Radar
  checked 6 months past the return; flight/hotel links with the trip's dates → the agent; the trip + a visa reminder
  (3 weeks before) to Radar; a **fair-price check** from the pack's own price lines (all 162 lines parse; no matching line =
  "no usual price", never a guess; another currency is converted with the saved rate or asks for it); phrases spoken
  aloud and **shown big**; "A sign or menu" opens Translate into the country's language. Tests: `v727travel` unit,
  `e2e_v727travel.py`; `e2e_v67b.py` updated for the tabs.

### 5.69 (14 Oct 2026) — Fit looks A/B/C, full nutrient words + pulse loader, What you're owed, Read it to me, Job ready
Ali: "c p f is just lame"; "a pulse loading screen"; "the app is one colour"; "i loved the 3 interfaces, make them optional";
"build all ideas … blend them in without cluttering"; "optimized for every device interface" (phone AND computer, every time).
- **Fit & Food:** `Macros` (fit-ui.jsx) writes Protein / Carbs / Fat in full with a colour dot (sky / amber / rose, the Diary
  bars' colours) — no P/C/F anywhere. `PulseLoader` (fitlook-ui.jsx) replaces the photo loader and the text skeleton: rings
  pulse from the plate or the photo, the stage, a sourced fact; held ≥ 0.7 s (`hold`) so an 80-ms code read doesn't flicker
  ("Found 3 foods"). Three new looks in Me → Look (fitlook.js `LOOKS`, `layoutOf`, `MEAL_STYLE`): **meals** (colour per meal
  cards), **rings** (gradient card + a ring per nutrient), **tiles** (pastel tiles; a tile opens its meal; md: 3 columns).
  Today's meal content is one `mealView(m, variant)` for every layout. Tap targets ≥ 36–44 px; Save bar sticky; formal Arabic.
  Tests: e2e_v727fitlooks.py (+ all Fit e2e).
- **What you're owed** (`owed.js`, `owed-ui.jsx` `OwedHost` mounted once; window event `attune-owed`): EU261 / UK261 / APPR by
  code (great-circle km from `AIRPORT_POS`, carriers by IATA code, extraordinary causes not owed, unknown cause "probably owed"
  and asked); claim / return / warranty / duplicate-charge letters (en/ar). Opened from Chat (`flightFromText`), Travel → Trip,
  Radar (return/warranty "Write the request"), Guardian (double charge "Ask for it back"). Tests: v727owed, e2e_v727owed.py.
- **Read it to me** (`readaloud.js`, `readaloud-ui.jsx` `ReadHost`; event `attune-read`): kind of paper, amount, due date,
  medicines by code; says what it is first, then reads sentence by sentence (lit), Slower, translate (checked engine), a
  labelled AI explanation; due date → Radar, prescription → Care (`attune-care` → CarePage `incoming`), bill → Money
  (`attune-money`). Entry: Home's camera (phone), "Read a paper to me" (desktop Home), Chat (photo + "read it"/"اقرأ"),
  Translate photo. Tests: v727read, e2e_v727read.py.
- **Job ready** (`jobready.js`; CV editor tab "job"): role → skills shown/missing (16 roles; missing → `attune-learn` → Learn
  daily's new-course form with the topic, via `attune:learn:seed`), interview practice (questions spoken; answer by voice —
  NATIVE.listen or Chrome's SpeechRecognition — or typed; code feedback: length, fillers, story, a number, matches the CV;
  optional AI coach), job links by country. Tests: v727job, e2e_v727job.py.
- Every new sheet: bottom sheet on a phone, centred window (md:) on a computer — checked at 1280 px in the e2e tests.
- **Two Android builds (14 Oct, Ali's phone: "App blocked to protect your device")**: Play Protect's enhanced fraud protection
  (≈185 markets) blocks apps installed from a browser / file manager / chat that declare a notification listener, SMS or
  accessibility. Ali: keep the notification reading. So: flavour **full** (the main APK `attune-apk` and the Play bundle) HAS
  PayListener via `app/src/full/AndroidManifest.xml`; flavour **lite** (`attune-apk-lite`) leaves it out for phones that can't
  install the full one. Ways to install the full one: Google Play **internal testing** (CI uploads the AAB to the internal track
  on every push to main once `PLAY_SERVICE_ACCOUNT_JSON` + the release keystore secrets exist; the first bundle is uploaded by
  hand), or once with Play Protect's scan paused, or over USB (adb). versionCode = 1000 + the CI run number (ATTUNE_VERSION_CODE).
  `NativeBridge.payAvailable()` / `payReader(N)` hide "Turn on notification access" in the lite build. Never add SMS or
  accessibility to the main manifest.

### 5.70 (14 Oct 2026) — The computer layout "A" across the whole app (Ali: "optimize it for the whole app"; he picked A)
- **Rule:** on a computer (Tailwind `lg:`, ≥1024 px) what you type/choose is on the LEFT and the answer on the RIGHT; lists are
  card grids. Phones are untouched (every group was checked pixel-for-pixel at 390 px). Helpers live in `web-src/desk.jsx`:
  `PANES`, `LEFT`, `RIGHT`, `GRID2/3`, `DeskEmpty` (the dashed "…appears here" placeholder, computer only).
- **Done:** Deal, Instant, Library (3 cols), Plans & billing (centred two-column window above the sidebar), Profile (2 cols),
  Settings window (not the phone "All" sheet), Fit (Diary: summary/water/fasting left, meals right; Recipes 3 cols; Progress
  and Me as 2 card columns), Business home, Guardian, Radar, People & plans, Family health, Homework Coach, Translate, Travel,
  Learn, News, Knowledge, Shelf, Mind, Skills, Ask a PDF (pages + chat side by side), CV (live preview always on the right),
  Assistants/Projects/Artifacts, Converter, Slides & Reports, Video, Chat X-Ray, Studio, Code, Crane, Cycle, Reminders.
- `shell.html` widens `.att-page` children; a form that should stay narrow adds the class **`att-keep`** (Fit's setup screens).
- Calm pages joined `OWN_TITLE` (no extra "Attune" bar above them on a computer).
- Fixed on phones too: the CV Preview iframe was squeezed to ~⅔ width by Tailwind's `max-width:100%` (now `maxWidth: none`).
- Arabic placeholder lines never say "on the left" (the panels swap sides in Arabic).
- Still a little uneven on a computer: Travel → Trip (right column longer), Radar card buttons wrap to two lines.

### 5.71 (14 Oct 2026) — v6.28: insulin ↔ Food, converter subscripts, Studio on big models, How to use, device levels, spaced repetition
- **Insulin ↔ Fit & Food** (Ali: "the insulin app should work with Food — tips and notifications when insulin is low"). `care.js`
  (end of file): `isInsulin` (brands, generics, Arabic), `stock`/`stockAt` on a medicine (units / tablets left; each dose ticked
  counts down), `daysOfSupply`, `lowSupply` (≤ 5 days) → `supplyReminder` (one notification `supply-<id>` at 10:00 next morning,
  set when a dose is ticked), blood sugar quick log (`addGlucose`, mmol/L under 35 converted), `insulinState`, `insulinTips`
  (hypo 15 g / 15 min steps first; "eat now" 20–120 min after a dose with no meal logged; refill; carbs today). NEVER a dose.
  Family health → Today: the "Blood sugar now" box, refill warnings with "I refilled"; a reading under 70 sets a `sugar-recheck`
  notification in 15 min. Fit → Diary (today): `InsulinCard` (fitplus-ui.jsx) + "· N g carbs" on each meal for insulin users.
  Tests: `tests/unit/v731insulin.test.mjs`, `tests/e2e_v731insulin.py`.
- **Converter** (Ali: "converter not working properly"): on the real two-column paper the table split in two and a formula vanished,
  because the PDF reader puts sub/superscripts (μ_max, K_S, e^μt) on lines of their own. `attachScripts()` (convert.js, runs first in
  `pdfLinesToBlocks`) glues a small piece that starts where a nearby word ends back on as a sub/superscript; a table stops at a
  line of running text; a line under a sub/superscript may sit a little lower in the same paragraph. Real bench `paper_2col`:
  tables 0 → 100, paragraphs 81 → 95, text 96 → 97; the other real files and the synthetic bench unchanged (all 100).
  Tests: `tests/unit/v731scripts.test.mjs`.
- **Studio on Zenith / Zenith+:** the description step had 45 s; a 9–12B model on a phone often needs longer, so the picture was
  drawn from the raw idea (often Arabic — the picture models read English). Now `enhanceWaitMs(power)`: 120 s for expert models
  (level ≥ 4). `cleanPrompt` also removes an unclosed `<think>`, Gemma 4's thought channel and gpt-oss channels.
  Tests: `tests/unit/v731studio.test.mjs`.
- **Computer layout leftovers:** Radar's lists use a container query (`@[920px]:grid-cols-2`): one column until each card's buttons fit
  on one line. Travel → Trip: on a computer "Flights and hotels" moves under the passport (a `matchMedia` flag renders it once, in
  one place) so the two columns end together; the phone order is unchanged.
- **How to use Attune** (mode `guide`; `guide.js` content, `guide-ui.jsx`): Getting started (4) + every tool in All (41) in 3 steps
  each, English and formal Arabic, a tip, and an SVG drawing of the screen whose numbered marks follow the step (tap a step, Next,
  Play). Phone: search + chapters opening in place; computer: layout A. Opened from the top of All (phone) and the Settings window
  (computer); sidebar search finds it. `tests/unit/v731guide.test.mjs` fails if a tool in MORE_TOOLS has no guide.
  Tests: `tests/e2e_v731guide.py`.
- **Device levels** (ROADMAP §2; `device.js`): phone < 6 GB → 1 Light (small models, no Studio in the list, `att-lite` effects),
  6–8 → 2, 8–12 → 3, 12+ → 4, computer → 5; fewer than 6 cores → one level down. Settings shows "This device: Level N" and
  "Show every tool anyway". `modelFits()` is ready for the Engine list (not wired: the Engine already marks heavy models).
  Tests: `tests/unit/v731device.test.mjs`, `tests/e2e_v731device.py`. The model router itself has existed since v6.12 (router.js).
- **Learn daily spaced repetition** (`daily.js`): a missed quiz question is reviewed in the next lesson, then again after 2, 5, 12 and
  30 days, then counts as learned; missed again → starts over. `c.review` (text list, unchanged) + `c.srs` ({text: {box, due}}) +
  `c.learned`; old courses keep working. The course screen shows "N to review · N coming back later (date) · N learned".
  Tests: `tests/unit/v731srs.test.mjs`.
- **Ask your life** (Ali, after seeing the engagement options: "what I meant is a feature that helps people, automates their lives
  or does a hard thing no one can do — see what's best"). Picked because a cloud AI has none of the person's data and Attune has
  all of it, on the phone, in separate tools. `lifeask.js` (pure): `kindOf` → owed-in / owed-out (People & plans), lab trend and
  blood sugar (Family health, per family member: `memberAsked`), medicines and today's doses, meals (Fit & Food, by `spanOf`),
  money (→ `answerMyMoney`), due in 7 / 30 days (Radar + People & plans + Reminders, late ones flagged), else a word search over
  Mind, Money notes, Radar, People and medicines. Every answer: English + Arabic text made by code, rows, its sources and the tool
  to open. Page `lifeask-ui.jsx` (mode `lifeask`, first in All → Mind & learning; layout A on a computer; "Ask Chat" leaves the
  question in Chat's box via `attune:chat:prefill`). Chat: `chatAsk` answers only questions about YOUR own things ("is my
  HbA1c better?", «مين عليه فلوس ليا؟») as a card with "Open …" (`attune-open` event); "What is HbA1c?" stays a model answer.
  Tests: `tests/unit/v731lifeask.test.mjs`, `tests/e2e_v731lifeask.py`. Name "Ask your life" can be changed in one place each
  (MORE_TOOLS, i18n-ar). The A/B/C engagement options page is still there if Ali wants one later.
- **"Do it from Home"** (Ali: "when I'm lazy I just type on Home 'I ate that for breakfast' and it happens in the food app — for the
  whole app"). `doit.js` (pure): `understand(text)` uses each tool's OWN reader — food `readMealText`, money `readLocal`, reminders
  `quickAction`, debts `chatLifeIntent`, deadlines `chatDeadlineIntent` — plus rules for water (ml), weight, workouts (Fit's MET table),
  a dose taken (nearest untaken time of the named medicine / insulin), blood sugar, period, "note: …"; one sentence can be two
  actions (food + its price). Order matters: a reminder before food; money only with a money word or currency ("2 eggs" is not
  money); the water phrase is removed before reading food/money ("glasses" read as molasses, "water" as a bill). `apply(action)`
  returns the tool's new store; the page (`doFromHome` in attune.jsx) writes it, keeps the old values for Undo, and does the
  rest (schedule the reminder, Mind note, Cycle log, low-sugar re-check). Questions about your own data are answered on Home
  (Ask your life); everything else goes to Chat as before. The card: `doit-ui.jsx` (phone Home + computer Home), with Open
  per line and one Undo; Home's numbers refresh at once. Tests: `tests/unit/v731doit.test.mjs` (23 sentences EN/AR),
  `tests/e2e_v731doit.py`. Also fixed: "1 ways to save" in Money Guardian.
- **Scout** (Ali: "I like Scout if it is made correctly, very strong, very accurate and works with everything"). `scout.js` (pure):
  `parseGoal` (EN + Egyptian Arabic: kind rent / buy-home / car / product / job / tender / service, place, budget incl. «ألف» /
  «مليون» / k, and wishes: beds, not ground floor, m², model years, km, one owner, no accident, automatic, new/used, metro, pets,
  furnished, elevator, parking, remote, full-time, warranty); `searchesFor` (the sites that matter per kind, `site:` searches + one
  open search, through the app's own free search: DuckDuckGo + Bing + Mojeek with pages read in full); `isAdPage` (one ad, not a
  search/category page); `readAd` (price — phone numbers blanked first, years / sizes / down payments skipped — area, beds, floor
  incl. «دور ارضي», year, km, the yes/no wishes with WHOLE-word matching: «بالمعادي» is not «عادي»); `check` (✓ / ✗ / "not stated",
  each with a quote cut from the ad's own sentence); `mergeTwins` (the same ad on two sites); `fairness` (vs the median of similar
  ads seen, per m² for homes); `learn` / `tasteNudge` (👍 / 👎); `runGoal` + `worthTelling` (new strong ones or a price drop; score
  ≥ 75); `sellerMessage` (Arabic / English, an offer from the fair price). Page `scout-ui.jsx` (mode `scout`, first in All → Money
  & people; layout A on a computer): goals, Check now, pause, finds with checks, fair price, drop, twins, Open the ad (the agent),
  Message to the seller (copied), 👍 / 👎. Runs: Check now; 25 s after Attune opens for goals due (each ≤ twice a day, ≤ 3 per open);
  the computer app the same. "find me …" / «دورلي على …» on Home starts a goal. Arabic name «الكشّاف». Icons added to the lucide
  shim: Binoculars, ThumbsUp, HelpCircle, TrendingDown.
  **Not yet:** a native background worker for nightly runs while Attune is closed (WorkManager + a headless WebView; needs phone
  testing); photo checks (the vision model on each ad's photos); map distance to the metro (text only now). The live-web check
  could not run in the cloud session (its network policy blocks duckduckgo.com / bing.com / the ad sites) — test it on the phone.
  Tests: `tests/unit/v731scout.test.mjs` (real-looking ads, Arabic and English), `tests/e2e_v731scout.py`.
- **Test setup in a fresh cloud session:** `bash tests/setup.sh` (≈ 10 min, builds llama-server). If the Pyodide download is cut,
  run `bash web-src/fetch-pyodide.sh` again — without it e2e_v510/v511/v513 time out (they run code in Python).

### 5.72 (15 Oct 2026) — v6.29: Back, crashes, Health page, data questions in Chat, Scout accuracy, Learn daily, Slides, declutter
Ali's list: "the UI is still cluttered; Back must return to the previous page, not Home; Scout really good in everything; Health
from Home opens Fit & Food, not a Health page; Ask your life automatically in the Home chat; finish Learn daily; the app sometimes
crashes; rework Slides & Reports; Fit & Food on Home; run the app and check; make it strong from a coding perspective".
- **Back** (attune.jsx): every page change pushes where it came from (`pushHist`, also in `navTo` — it used to clear the list);
  Back walks the list and ends on Home (or Chat for the old start). Tests: `tests/e2e_v732back.py`.
- **Crashes:** `entry.jsx` RootGuard ("Reopen Attune", data-testid app-error) + window error/unhandledrejection → saved in
  `attune:lastcrash` and the Engine log, toast "That didn't work — …"; `<Guard>` around windows/sheets and the computer sidebar;
  `nativeCall` rejects cleanly when a native method is missing (the CV "share" crash on desktop); MainActivity.kt: a background
  thread's uncaught error is logged to engine.log instead of closing the app (the main thread still crashes normally).
  A crawler (46 tools × phone EN / phone AR / computer, 30 random taps each, 138 visits) found no page errors after the fixes.
- **Health page** (`health-ui.jsx`): Fit & Food today, Family health (next dose, late doses, supply running out, last sugar),
  Cycle. Home's Health and the bottom bar open it. `FitToday` is also on Home (meals open Fit on adding to that meal; + glass).
  Tests: `tests/e2e_v732health.py`.
- **Data questions in Home and Chat** (`lifeask.js`): "how much did I pay for X", "history of X", "last time I …" are answered by
  code from Money, People & plans, Mind, Health (paid-for sums, record lists, last date). Tests: `tests/unit/v731lifeask.test.mjs`.
- **Scout** (`scout.js`): the exact item — model words must all be there, a variant word not asked for (Pro Max, Plus, Ultra…)
  is out, storage normalised (256 GB = 256 جيجا), Arabic transliteration; jobs: years of experience asked vs yours; rent: a sale
  price is out; the price reader skips specs (256GB, 5000mAh are not prices); the same product in 2+ stores → the cheapest is
  marked ("cheapest of 3 stores"); no ad page at all → searched again with the item's own words. Tests: `tests/unit/v731scout.test.mjs`.
- **Learn daily rework** (`daily.js`, `daily-ui.jsx`, Calm design): one plan per course for today — review the cards → today's
  lesson → the quiz. Cards are made BY CODE from each lesson read (word cards, table rows, timeline, "term: meaning" key points)
  and from missed quiz questions; they come back after 1, 3, 7, 16, 35 days, need no model (`cardsFromLesson`, `addCards`,
  `cardsDue`, `gradeCard`). `streakNow` (a missed day shows 0), `todayPlan`, `groundQuiz` (drops a question the lessons contradict
  or with doubled options), a too-short lesson is written once more. The plan shows only the lessons around you (Show all).
  Tests: `tests/unit/v732learn.test.mjs`, `tests/e2e_v732learn.py`; the old `e2e_v512 lessons` still passes.
- **Slides & Reports:** the form is request → sources → one button → one line with the chosen options ("8 slides · Midnight ·
  Short points — Change") that opens them; the deck shows Play / PowerPoint / PDF first; labelled transition / animation pickers
  (they were cut off); report tables write 910000 as 910,000 (`groupNum`; codes and years untouched). Tests: `tests/unit/v732slides.test.mjs`.
- **Declutter:** a page with its own big title doesn't repeat it in the top bar (phones; Money keeps it); the privacy footer only on
  Home and the tools list; Home hides "Today" when nothing is due and "Spent this month" at 0 with no budget.
- **Version:** 6.29 (versionCode 90).
- **Open, Ali to choose (look):** the Home area tiles repeat the bottom bar — options given in chat (keep / remove / replace with
  "recent tools"); the Health page empty space on a computer.

### 5.73 (15 Oct 2026) — v6.29 (cont.): Home A, chat sidebar on the phone, Scout tab, release blockers for Google Play
Ali picked Home **A** ("but remove Health and add something more helpful"; chose: bottom bar Health → **Scout**, plus
**What's waiting**) and asked for "a sidebar where I can see the history of my chats"; then "do all that's left — I want to
deploy within 2 weeks".
- **Home** (`home-ui.jsx`, `home.js`): "Recent" = the last 4 tools (`recentTools()`, filled with scout/learn/slides/convert/
  lifeask) with a live line each (`toolLine`); "What's waiting" (`waitingList`) = todayList + new Scout finds (`goal.unseen`,
  set by `runScoutGoal`, cleared when the goal is shown) + cards to review / today's lesson + a medicine running out.
  Bottom bar: Home · Chat · Money · Scout · Mind · All. Tests: `tests/unit/v733home.test.mjs`, `tests/e2e_v733home.py`.
- **Phone sidebar** (☰ on Home): the computer's `DesktopSide` in a drawer (`touch` shows rename/delete; `width`); places
  include Health. `applyChatCmd` (chat.jsx) renames/deletes in storage when the Chat page isn't open.
- **Release (RELEASE_6.29.md = the checklist for Ali):** target API 36 + AGP 8.9.1 + Health Connect 1.1.0 (CI green);
  AgentBrowser back via OnBackInvokedDispatcher; developer mode only when `AttuneNative.testBuild()` (resValue
  `attune_test_build` = signed with the test key) — `devAllowed()` in billing.js; no code/key purchase UI when
  `Store.available()`; Privacy page (`privacy.js`, `privacy-ui.jsx`, mode "privacy", More → Privacy; Health Connect rationale
  intents → `{kind:"privacy"}`), `docs/privacy-policy.html` generated from privacy.js; PayListener ignores OTP;
  Billing.kt: ack Business at once, `owned` returns `error` when Play doesn't answer (page keeps Pro: `Store.owned()` → null),
  reconnect + one connection for waiting calls, guarded launchBillingFlow; gradle refuses a release bundle without
  ATTUNE_KEYSTORE; workflow_dispatch keeps `attune-play-bundle`; old map never fetches tile.openstreetmap.org; unused
  open-meteo code removed; Engine.start catches native errors. Tests: `tests/unit/v733release.test.mjs`, `tests/e2e_v733release.py`.
- **Ali must:** start the 14-day / 12-tester closed test now (personal accounts), keystore secrets, privacy URL, products,
  declarations, USDA key, the Video Downloader decision (RELEASE_6.29.md §2).

### 5.74 (16 Oct 2026) — v6.30: no bottom bar, a ChatGPT-style sidebar with 6 places, combined pages; why the app closed
Ali: "the app still crashes on its own a lot … I don't want a bottom bar in any page, I want a sidebar like ChatGPT, combine
every feature that can be combined, no more than 6 options on the left sidebar" and, of the Create group, "combine all of this
except Studio under one page".
- **6 places** (`web-src/hubs.js`, pure, `tests/unit/v734hubs.test.mjs`): Home · Chat · Money · Health · Learn · Tools. Every
  mode belongs to exactly one place (`hubOf`). A page shows a **tab row** at its top (`hub-ui.jsx` `HubTabs`, `tabsFor`):
  its group inside Tools (Files / Places / **Create = Code · Improve a prompt · Compress · Humanize · Copilot · Library ·
  Ask (classic)** / Business), else the members of its place (e.g. Money · Guardian · Radar · People & plans · Deal · Scout ·
  Reminders). Studio has no tabs. Full-screen pages (`FULL`: home, tools, business, fit, map) have none. Tabs are filtered by the
  device level (`groupsFor`). The pages themselves are unchanged — a tab is the same page as before.
- **No bottom bar**: hidden unless `localStorage attune:legacy-nav = "1"` (the old e2e tests set it via `new_page(legacy_nav=True)`,
  the default; new tests pass `legacy_nav=False`). `--nav-h` = 0. Phone header: ☰ (`header-menu`, opens the sidebar drawer)
  + ←. Chat's ☰ opens the same drawer (chat history is in it). Money's phone page is a fixed iframe, so its ☰ and tab row live
  in `MoneyTab`'s own header. `DesktopSide` takes `places` (the 6), `activePlace` (= `hubOf(mode)`), `showPins={false}`.
- **Tools page = 6 pages** (Ali: "I don't want Tools to be 30 or 40 features — no more than 6 pages"): `TOOL_PAGES` / `toolPages()`
  = Files · Create · Studio · Maps & travel · Business · Help & privacy; a card opens the first member, the rest are tabs
  (Maps and Business are full-screen, so those cards open Travel / Crane toolkit). Search still lists single tools.
  Legacy mode (old tests) keeps the old Tools page.
- **ExitWatch.kt** (Android 11+): on every start reads `ApplicationExitInfo` since the last start, writes each ending to the
  Engine log (reason, foreground/background, memory, the model that was running — pref `model_at_exit` set by `Engine.start`,
  cleared by `stop` — and the ANR trace), and keeps the newest unexpected foreground ending; the page asks `AttuneNative.lastExit()`
  once and shows "Attune closed unexpectedly last time: …" (low memory → a tip to pick a smaller model). Ask Ali for the
  Engine log after a crash: it now says exactly why. (Next step if it's the native engine: run llama-server in its own process.)
- **No more than 6 tabs** (Ali said yes): `INSIDE` in hubs.js — Skills inside Assistants, Artifacts inside Projects, Reminders inside
  Radar: one tab, and a small switch (`hub-parts`, `partsOf`) on top of the page moves between the two parts.
- **Ali's first crash log (6.29, HONOR BKQ-N49, 16 GB)**: "the page's process was reclaimed by Android for memory; the page was
  rebuilt" 6 times in 4 s — the WebView renderer (its own process) ranked below the app, so Android killed it first, and the
  instant `recreate()` got killed again. Fix (MainActivity): `setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT, true)`;
  on a loss the dead view is removed and destroyed; a 2nd loss within a minute lets the model go (not while answering);
  from the 3rd the rebuild waits 3 s. Also in the log: prompt reading only 26 t/s (Qwen3.5-4B IQ4_XS; KleidiAI has kernels
  only for Q4_0/Q8_0) — a Q4_0 file may read several times faster on ARM: measure before switching.
- Test: `tests/e2e_v734sidebar.py`.

### 5.75 (17 Oct 2026) — v6.31: minimal design A; Core Lite → IQ4_NL; Core Max (8-bit)
Ali: "research and make the app minimal so it's not cluttered" → research (3–5 places, progressive disclosure, one "+" menu like
ChatGPT/Gemini/Copilot, one main action per screen, no explanation lines) + an audit of every screen + three mock-ups
(claude.ai/artifact/Dc5kUTf3qBzPzWMGZBfvVE: A calm six, B chat first, C one feed). Ali: "do the best you see" → A (+ B's "+").
Everything below is gated on the new layout (`!LEGACY_NAV`, i.e. `attune:legacy-nav` ≠ "1"), so old tests see the old app.
- `html.att-min [data-intro] { display:none }`: 23 tool intro paragraphs tagged `data-intro` (setup questions and Backup keep theirs).
- `HubTabs`: underlined text tabs; short names (`TAB_SHORT` in attune.jsx: Guardian, Radar, People, PDF chat, X-ray, …).
- Header: the model is a small dot + name (`header-model`), not an outlined button.
- Home (`minimal` prop): no "Just say it" hint, no footer, no Fit & Food set-up advert (shows once set up), Recent rows without
  subtitles unless there is a live line; "All tools" opens the Tools page.
- Chat (`MINIMAL` in chat.jsx): empty screen = title + 3 plain suggestions; composer = one "+" (`composer-plus` → `composer-menu`:
  Photo, File, Think first, Search the web), what is on shows as a chip (`chip-think`, `web-toggle`). The menu is a portal on
  `document.body` (`window.ReactDOM.createPortal`) — the composer has `contain: paint`, which clipped it.
- Converter (`MINIMAL` in convert-ui.jsx): "Choose a file" first, the 4 most used as rows (TOP4), the rest behind "All conversions";
  Translate isn't repeated (it is the next tab). Scout shows 2 examples.
- Models (`tests/models/quant_bench.py`, CI `quant-bench.yml`, Neoverse N2 + KleidiAI, 4 threads; reading/writing t/s, KLD vs Q8_0):
  IQ4_XS 22.5/11.0/0.051 · Q4_0 53.2/12.6/0.066 · IQ4_NL 35.2/11.4/0.048 · Q4_K_M 36.8/10.9/0.041 · Q5_K_S 31.2/8.9/0.028 ·
  Q8_0 96.1/15.0/0. → Core Lite (md-lo) is now IQ4_NL (better on every measure); new **Core Max** (md-max, Q8_0, 4.61 GB,
  needRam 12). Q4_0 rejected (answers drift more). Idea for later: the same bench for the big IQ4_XS models (Apex+, Everest).
- Test: `tests/e2e_v735minimal.py`.

### 5.76 (17 Oct 2026) — v6.32: Create 6 tabs, video downloads not sold, Deep answer, Fit & Food minimal (B) + contrast
Ali answered the four open questions on cards: Compress → Improve; Video Downloader A; Deep answer "build now"; Fit & Food next.
- **Create = 6 tabs**: `INSIDE.compress = "improve"` (hubs.js) — Compress is the small switch inside "Prompts" (Improve a prompt).
- **Video Downloader (Play policy A)**: off `PRO_BENEFITS`, `BILLING_GROUPS`, `COMPARE_ROWS` (billing.js); the 3-a-day limit and its
  "Pro is unlimited" message are gone (video-ui.jsx) — it is free and never advertised. RELEASE_6.29.md §6/§8 say the store text
  must not mention it.
- **Deep answer** (router.js `deepModel` / `deepLine`, chat.jsx `deep`): "+" → Deep answer (`menu-deep`, chip `chip-deep`) — the NEXT
  question only goes to the strongest installed model the phone can run at all (also one that isn't smooth, e.g. Everest in flash
  mode; Auto never picks those), thinking forced on; a photo needs a model that sees. Status warns "reads from storage, a few
  minutes" when `smoothRam > RAM`. The answer is tagged `deep-tag` ("Deep answer · Everest"); afterwards the model that was loaded
  is switched back (`deepBack`, in `finally`, only when no newer question runs). Tests: unit `v736deep`, e2e `e2e_v736deep.py`.
- **Fit & Food minimal = B** (Ali: "B but i want the colour and text to be contrast so its more visible"; mock-ups
  claude.ai/artifact/EgFPuhDQxUm3x36GGpy5C8). `FitApp minimal` = `!LEGACY_NAV`, so old tests keep the old Fit:
  - no bottom bar: a tab row on top (`fit-nav` is now `role=tablist`, same `fit-tab-*` ids) and a floating "Log food" (`fit-add`);
  - header says "Fit & Food"; Diary: no fibre bar, suggestions as one line "Try: …" (`fit-suggest-*`), solid meal "+" buttons;
    Water / Move / Fasting are 3 small buttons (`fit-chip-*`) that open their card;
  - Progress: weight first (`fit-weight-card`), everything else (day quality, vitamins, tips, report, week, measurements, photos,
    challenges, export, body fat) behind `fit-progress-more`;
  - contrast (every look, fitlook.js): secondary text ~8:1 instead of ~4.8:1, firmer lines, deeper green (white on it 6.5:1);
    dark looks get lighter greys. `.fit-min` darkens the ring / bar / glass tracks.
  - Test: `tests/e2e_v736fitmin.py` (EN + AR, contrast ≥ 7:1 checked).
- Running a single e2e while the full suite runs: set `ATTUNE_ENGINE_PORT` / `ATTUNE_PAGE_PORT` (harness.py) to other ports.

### 5.77 (17 Oct 2026) — Business: Ali's two desktop ERP apps inside Attune (Fleet & rentals) + Business builder v2
Ali attached the handoffs of two apps he built before (Crane Management desktop v2.7; Crane Warehouse) and asked for their
outcomes in Business "and even more", plus Business v2 (roles, currencies, price lists, encrypted backup, export as a real project).
- **Fleet & rentals** (Hub card `fleet-open`; `fleet.js` logic, `fleet-store.js` IndexedDB `attune-fleet`, `fleet-ui.jsx`): one app,
  tabs Today · Jobs · Fleet · Money · Store (phone: top tabs; ≥ 900 px: side rail `fleet-rail`). The old apps' confirmed rules are
  kept exactly: crane in a garage or at a site (job only when free or already at that site; complete/cancel → back to its garage;
  Move Crane log); hourly (start → end, optional end date, 08→08 next day = 24 h), daily, period; no overlapping hours for a crane;
  evidence required on every work entry (full quality, IndexedDB `att:<id>`); month grouping; client balance = opening + work −
  non-bounced incoming payments; cheques in/out with maturity warnings (N days in Settings); expenses per crane / site / general
  with type lines; Recycle Bin 7 days (purged on open); demo data tagged and erased without touching real records; DD/MM/YYYY typed
  (never the phone's M/D). **Store** = the warehouse: internal code `{seq}/{month}{yy}` (1/526), one counter for in and out that never
  goes back, multi-item purchase invoices (purchaser required), issues linked to a reference code, `planOut` = the original
  planSadr split rule (linked line at the invoice's unit price + the rest from the general balance; refuse above the total balance;
  used-up invoice → all general, no zero line), running balance per item, opening stock, Reference-code / technician / crane /
  supplier reports. **More than the originals:** cash/transfer payments beside cheques; editing a line (re-priced from its invoice,
  never below what was issued, stock never negative); deleting an invoice with linked issues is refused (the old orphan problem);
  minimum-stock warnings; **profit per crane = income − expenses − parts issued to it from the Store**; Excel export (6 sheets);
  printable invoice / issue (EN/AR); encrypted backup.
- **Business builder v2** (`erp-v2.js`, `biz-v2-ui.jsx`, `biz-vault.js`; header button `biz-tools-open` → "Team & tools"):
  Team & roles (owner / editor (optionally some tables) / viewer, a PIN each, salted SHA-256; the system opens behind `PinGate`;
  ONE check `guardChange(before, after, user)` wraps SystemShell's setSys so the form, grid, design chat and import are all
  covered); currencies (a money column's own currency + `sys.rates`, totals in the system currency, a missing rate is named, not
  guessed); price lists (± % and fixed prices; the form's "Price list" select fills the price when a product is picked);
  encrypted backup (`attune-biz-vault`, PBKDF2 600k → AES-GCM-256, header authenticated, opens as a copy); export as a real project
  (.zip: index.html + manifest + offline worker, data/system.json, Electron package.json/main.js with Ali's build lessons
  (`--dir`, no signing, author set), README EN/AR). The team's PIN hashes are never exported.
- Books already had roles, currencies, price lists and its own vault (v6.15/v6.20); those stay as they are.
- Tests: `tests/unit/v732fleet.test.mjs` (58), `tests/unit/v732bizv2.test.mjs`, `tests/e2e_v732fleet.py`, `tests/e2e_v732bizv2.py`.
- Not built yet (ideas): Fleet nightly reminders as Android notifications; per-crane maintenance schedule by engine hours;
  a client statement PDF; sharing Fleet between phones (waits on Google Drive sync).

### 5.77b (17 Oct 2026) — Business "Pro": every built system as professional as the crane system; export as a website
Ali: "i want the output of any job like a grocery store or an erp system for any company to be as good and as professional as this"
(his crane ERP) and "exportable so user can push it on a designated website".
- **`erp-pro.js`** (pure, `tests/unit/v732pro.test.mjs`): finds rules in ANY design from table/field names (English + Arabic):
  stock (opening + Purchases − Sales, low stock vs "Reorder at", overselling refused), balances (charges − payments, direct or through
  one record: Invoices → Projects → Clients; cash sales don't count, "on credit" does; a job billed by an invoice isn't counted twice),
  statement of account with running balance, due/expiry warnings (skipped when done/paid), no double booking of an asset (Start/End),
  recycle bin (7 days), sample data for any design (`_demo` tagged), Excel with one sheet per table (`convert.js xlsxFromSheets`),
  printable documents (`recordDoc`, `statementDoc`). The owner can switch each rule off (`sys.pro.off`).
- **Screens** (`biz-pro-ui.jsx`): a 5th tab **Overview** in every system (numbers, Needs you, Stock on hand, Balances → statement →
  print, Tools: sample records, Excel, Recycle bin, What it does for you). Form: Print button; Delete → recycle bin. SystemShell's
  setSys runs `P.checkChange` (a refused change shows its reason). The AI design prompt now names fields so the rules switch on.
- **Website export**: `build.sh` makes a 2nd bundle (`build/site-entry.jsx` + `build/site-shell.html`) → `www/business-site.html`
  (~1.1 MB). `erp-v2.js siteHTML()` fills `__SITE_TITLE__`/`__SITE_DATA__`; Tools → Export as a project and Fleet → More →
  "Website & desktop app" zip it with manifest, sw.js, Electron files and README. The site runs `SiteSystem` / `SiteFleet` (no back
  button, no design studio); records live in that browser (a static site does NOT share data between people — that needs sync).
  `readApp` also opens these site files.
- Fixed: `fleet-store.js` read of a missing key returned `true` (Fleet then started empty even with a seed).
- Tests: `tests/unit/v732pro.test.mjs`, `tests/e2e_v732pro.py` (also opens the exported sites from file://, phone + computer).

### 5.78 (17 Oct 2026) — v6.32 roadmap items (branch `claude/roadmap-items-knk93s`)
All with unit + e2e tests (`tests/unit/v736*.test.mjs`, `tests/e2e_v736*.py`); Kotlin checked by "Build the APK" on the branch.
- **Money / life:** split bills, gold & currency savings (niṣāb → Zakat), car manager (People & plans: `split.js`, `gold.js`,
  `car.js`, `plans-ui.jsx`); price memory (Guardian + Chat); contract second opinion (Deal Check, `contract.js`); Plan my day around
  the prayers (Reminders, `prayer.js planDay`); private vault (Privacy; `Vault.kt`, `vault.js`); "From:" line on answers.
- **Scout:** searches once a night with the app closed (`ScoutNight.kt`, `scout.js nightPlan`, attune.jsx takes the results on
  open); walking minutes to the nearest metro (`nearestStation`, map pack stations); same photo in another ad (`dhash`, `photoTwins`).
  Fix: "170 m2" was read as 170 million (multiplier lookahead in `pricesIn`).
- **Learn:** FSRS review deck (`fsrs.js`); Say it — a score per word (`speak.js pronScore`, phone speech recognition); spoken
  dialogues; a picture per lesson (Studio engine); knowledge packs as courses with no model (`packcourse.js`, `KnowPacks.toc/section`).
- **Web comparisons:** "A vs B" gets a head-to-head table built by code (`factsheet.js headToHead`); `research.js onTopic` keeps a page
  about either side.
- **UI languages:** French, Spanish, Turkish (`i18n-fr.js`, `i18n-es.js`, `i18n-tr.js`, ~700 lines each = the first screen of every
  page; the rest shows in English). New language = a dictionary + one row in `LANGS` (i18n.js). The strings were collected by opening
  every page with `window.__trMiss` (a crawl in both layouts).
- **Attune keyboard** (`AttuneKeyboard.kt`, `res/xml/method.xml`): English/Arabic keys + Improve / Translate / Reply (Egyptian for
  Arabic messages, from the clipboard) / Prompt, using the model already loaded (Engine HTTP or FastEngine, same process). No model →
  Improve tidies by code, the strip offers "Wake the model". Passwords/numbers: keys only. Settings → "Attune keyboard" row
  (`keyboardState` / `keyboardSetup`). **Needs a phone test.**
- **Waiting for Ali's accounts** (`cloud.js`, `SETUP_CLOUD.md`): Drive sync (encrypted backup in drive.appdata, pull → merge → push;
  `NativeBridge.driveSync` is the stub), Family circle lists (`mergeList`), paid Pro search via `tools/pro-search-relay` (Cloudflare
  Worker + Serper). All invisible until `CLOUD` has the ids.
- **Looks to choose** (Ali): Mind page and Coding page, 3 options each (`/mnt/project-files/screens-v632/*-options.png`).


### 5.79 (17 Oct 2026) — v6.32 joint release: five threads merged into one APK
Ali ran five threads in parallel on 17 Oct, each on its own branch, and asked for one release with one APK at the end.
Merged into `main` on branch `claude/joint-release-6zxc2i` (version **6.32**, versionCode 93; CI sets 1000 + run number):
| Branch | What | Notes |
|---|---|---|
| `claude/project-thread-5y87k7` | Create 6 tabs, video not sold, Deep answer, Fit & Food minimal B + contrast | §5.76 |
| `claude/pdf-edit-converter-mj6lcu` | **Edit a PDF** (Converter, first row; Ali picked option A) | below |
| `claude/overpaying-finder-t3e0nu` | **Overpaying check** in Money Guardian (look A, one list) | below |
| `claude/business-erp-uqi622` | Fleet & rentals (Ali's crane + warehouse ERPs) + Business builder v2 + Business Pro (every built system gets stock, balances, due dates, recycle bin, print, Excel; export as a website / desktop project) | §5.77, §5.77b |
| `claude/roadmap-items-knk93s` | Money/life extras, Scout night, Learn extras, web head-to-head, FR/ES/TR, Attune keyboard | §5.78 |
- **Edit a PDF** (`pdfedit.js` logic, `pdfedit-ui.jsx` screen; phone: `DocTools.kt` `pdfEdit` mode `"edit"`; computer:
  `desktop/lib/pdf.js` with pdf-lib): tap a line to change it, tap an empty spot to add text, highlight, draw, sign (the signature
  is kept on this device only), drag pages to reorder, turn / delete / add pages (blank or from another PDF). Always saved as a
  **new** PDF. Text the built-in Helvetica can't write (Arabic) is drawn, not typed (`plainLatin`). Tests: `tests/unit/pdfedit.test.mjs`,
  `tests/e2e_v736pdfedit.py`.
- **Overpaying check** (`overpay.js`, `overpay-ui.jsx`, in `GuardianPage`): one list of subscriptions, free trials ending, price rises,
  overlapping services (`GROUPS`), renewals and unused perks, each with its source (payment, money notification, a pasted email, or a
  **Gmail export** `.mbox` from Google Takeout read on the phone, with a Gmail link from `X-GM-THRID`). Guardian's own "subs" and
  "creep" findings are hidden because the check covers them. A monthly reminder on the 1st (`Reminders.kt` / actions.js
  `repeat: "monthly"`). Gmail sign-in (reading new mail by itself) needs Ali's Google Cloud setup: `docs/GMAIL_SIGNIN.md`. Tests:
  `tests/unit/v732overpay.test.mjs`, `tests/e2e_v732overpay.py`.
- **Merge notes:** the built page (`www/index.html`) was rebuilt after every merge, never hand-merged. `i18n-ar.js` conflicts were
  unions (no key ended up with two different Arabic texts). `guardian-ui.jsx`: the Overpaying check (overpay thread) and Price memory
  (roadmap thread) both sit on the Guardian page. Business and roadmap both wrote "§5.76"; they are §5.77 and §5.78 now, and
  the roadmap's NEXT_SESSION "V" is "W".
- **Test fix:** `tests/unit/fitlook.test.mjs` still expected three Fit looks (there are six since v6.18); it failed silently because
  `run_all.sh` read only each file's last line. Now `run_all.sh` reports a unit file's first `FAIL` line when it has one.

### 5.80 (17 Oct 2026) — v6.33: Mind A (the wall) and Code B (talk to a coder)
Ali picked from the three options each (`/mnt/project-files/screens-v632/mind-options.png`, `code-options.png`): "Mind a, Code B".
Built on `claude/roadmap-items-knk93s`, merged into `main`; version **6.33** (versionCode 94).
- **Mind = the wall** (`mind-ui.jsx`, `mind.js`): a search box, one row of chips (All, each kind, Promises, Your words, colours, your
  spaces, #tags), then everything as a picture wall. Links get a coloured preview with their site; each card has a small kind label;
  "From your past" sits on the wall. A photo's main colour is read once from its thumbnail and the colour chips filter the wall
  (like the My Mind app). Tests: `tests/unit/v736mind.test.mjs`, `tests/e2e_v736mindwall.py`.
- **Coding = talk to a coder** (`code-ui.jsx`): a start screen (What should I build?, four starters, your programs), then the work as
  a conversation: the ask as a bubble, each step (plan, write, test, fix) with a mark, the code in a card (first lines; "Show code"
  opens the editor), Run / Fix / Copy / Save, and a box at the bottom for a change, which becomes the next bubble with its own steps.
  Test: `tests/e2e_v736coder.py` (`e2e_v58.py` adjusted).
- Strings in Arabic, French, Spanish and Turkish. Merge: `i18n-ar.js` union; two keys that ended up twice ("Show all {n}",
  "{n} lines") keep one entry each.

### 5.81 (17 Oct 2026) — v6.34: Ali's phone list of 17 Oct (food labels, maid, Watch, Engine + Food minimal, Learn ahead, Fleet issue)
Ali sent 13 screenshots, two 6.33 Engine logs (Core Max loading) and his warehouse app's handoff + the crane-desktop zips.
His picks (asked on cards): Money "integrate them the best way"; More page "B: remove it completely"; Engine "A"; Food sheet "A + ideas from Yazio".
- **Food photo labels** (`fitlook-ui.jsx PhotoMarks`): in the looks Colour per meal / Rings / Pastel tiles the label was WHITE text on a
  white pill (fg was dark only for Fresh). Every white label now has dark text and the shadowed line. `e2e_v718looks.py` checks 5 looks.
- **Food corrections** (`fitread.js draftCommand`): "There is tomato sauce …", "it has …", «فيه صلصة» → added; "it's cake, not milk chocolate"
  → swapped (grams kept); any sentence naming new foods → added. Table: "milk chocolate" was milk + chocolate, "tomato sauce" a raw
  tomato, "chocolate log" milk chocolate → aliases + a new food `choc-log` (fit.js). Note: normA turns an apostrophe into a space ("it s").
- **Fleet → Issue parts** (`fleet-ui.jsx OutForm`) in the order of Ali's warehouse app (sadrBox): internal code, date, reference code first
  (optional, "— no link (from the general stock) —"), the invoice's items as rows to tap (Item · Original · Left · Unit price; the item
  box is locked meanwhile), quantity + technician, ONE destination list (cranes, other places, "Another place…"), notes, the planOut preview.
- **Learn**: `daily-ui.jsx lessonAhead` — while a model is loaded and idle (no request, nothing asked for 30 s, page visible; checked
  every 20 s in attune.jsx; background request, gives way to the person), every course whose lessons are all read gets its NEXT lesson
  written — ready when Learn opens. Off in tests unless `attune:learn:ahead` = 1 (harness sets "0"). "Add a lesson" (`AddLesson`)
  appends your title to the plan. The writing preview has no markdown signs (`plainPreview`). Home: one line per topic, lowest
  lesson first; starting the same ready course again opens the one you have. "1 things" → "1 thing".
- **Lessons: a diagram AND flashcards** (Ali: "diagrams and flashcards inside the lesson"): the lesson prompt asks for `visual` (one
  diagram, not cards) + `cards` (4–6) + keyPoints; `parseLesson` returns `cards` (an old "cards" visual becomes them). The lesson
  shows `lessonDiagram(l)` (the model's, else a map of its own ## headings) and `lessonCards(l)` (the model's, else `cardsFromLesson`)
  as flip cards (`lesson-diagram`, `lesson-cards`); `cardsFromLesson` takes `l.cards` first, so they go into the review deck.
- **Lessons checked by code** (Ali: "make the lessons very good coding so the models don't glitch"): `daily.js writeLesson` (used by
  the Learn page and `lessonAhead`): write → `cleanLessonBody` (loop cut, stray JSON/fences, LaTeX → text, "Sure, here is…", the title
  echoed, a repeated paragraph/line, a cut-off last sentence; `fixed` records what) → `lessonProblems` (short < 200, < 2 sections, wrong
  language by Arabic-letter share, loop) → one stricter retry, the better kept (language 4, loop 3, short 2, sections 1) → extras broken
  → no diagram AND no flashcards → a request under `EXTRAS_GRAMMAR` (GBNF; checked on the real llama-server: valid JSON) → still missing → `codeKeyPoints`,
  `cardsFromLesson`, `codeTryIt`. Nothing usable → null ("try again"). Test: `tests/unit/v737lessons.test.mjs` (8 broken answers).
- **Courses past 30** (Ali: "a language takes more than 30 lessons"): `needsMore` (≤ 3 planned lessons left, plan < 300) → the
  background writer plans the next 20 (`moreMessages` / `addMore`, repeats dropped, `parts` counted; a failed try waits 6 h) after
  writing the next lesson; the course screen has "Plan 20 more lessons" (`learn-more`). Languages go on "towards fluent".
- **Documents** (`docqa.js intent "solve"` + `solveMessages`, `pdfchat-ui.jsx`): "Solve the questions" / «حل الأسئلة» solve the questions
  from the whole document (7,000-character parts, up to 8), step by step with pages — it used to search for a passage and say "not found".
- **Web**: when every search of a question comes back empty (a burst refused), one plain search again after 1.2 s; the "web found
  nothing" prompt forbids saying a product doesn't exist (Lynk & Co 900 is real, 2025).
- **Engine memory** (Engine.kt): Ali's 6.33 log/ExitWatch: "the phone ran out of memory (Core Max)" in use. A copy now also needs
  2 GB free after the weights (availMem); else the weights are mapped from storage (logged). The photo reader loads at start only
  with 2.5 GB still free after model + reader; otherwise on the first photo. The "unused tensor blk.32.nextn" lines are the MTP layer
  as seen by the main loader — harmless; whether MTP ran shows as "· MTP" in Engine → Details.
- **Notification access** (`paylog-ui.jsx RestrictedHelp`, `NativeBridge.openAppInfo`): after "Turn on" the steps for Android's
  "Controlled by restricted setting" (APK not from Play: App info → ⋮ → Allow restricted settings) with a button to App info.
- **Money settings** (yusr/index.new.html): the Premium heading, "Premium active" and "Test premium (developer)" are hidden.
- **The maid every Saturday** (`life.js` kind "regular", `regular.js tickRegular`): «the maid comes every Saturday and takes 600 EGP» /
  «الشغالة بتيجي كل سبت…» → "Comes regularly", a box on each Saturday (today included); Home shows it on its day (`home-regular`),
  a tick writes the expense into Money's ledger directly (cat bills, note "Maid · date"), an untick takes it out; a missed day is
  not "late". No ledger yet → the sentence goes to Money to confirm. Tests: unit `v737fixes`, e2e `e2e_v737maid.py`.
- **"Paid?" on its day** (Ali, later the same evening: "when the deadline of a subscription comes, a checkbox asks me if I paid; yes
  = recorded in Money"): `home.js todayList` gives a `pay` row for a People & plans payment you make (regular, subscription, bill,
  rent) on/after its day, and for a Radar renewal with an amount on its day or up to 7 days after (`home-pay-radar`, with "No").
  Tick → `tickRegular` / `regular.js payRadar` write the expense (rent → cat rent, else bills); the renewal becomes done "renewed"
  ("No" → "cancelled"). In People & plans a tick on those kinds records it by itself too (no question). No Money ledger yet → Money opens.
- **Money = 5 tabs** (hubs.js INSIDE radar/reminders → guardian; `partsOf` returns 2+ parts): Money · **Watch** · People · Deal Check ·
  Scout; Watch has a switch Payments (Guardian) · Dates (Radar) · Reminders (`hub-ui.jsx PART_TITLE`).
- **More page removed** (new layout): Settings in the sidebar opens Settings only (no tool grid, no How-to card).
- **Engine minimal A** (attune.jsx NativeEnginePanel, `engine-min`, only without LEGACY_NAV): a dot + "Blaze+ · running" + ⋯ (Restart,
  Engine log, Details); each model one row (✓ in use, size; tap = use; ⋯ Fingerprint / Delete with a confirm on the row); a download
  is a thin bar row; everything else (switches, instructions, network log, community model, Speed) folded under "Settings".
- **Food Add sheet minimal A + Yazio** (fit-ui.jsx `fit-add-min`): one "What did you eat?" box with camera / barcode / mic inside;
  typing 1–3 words also searches (results under it); "Add it"; Recent · Favourites · My meals as rows with a + (one tap logs);
  More = quick add kcal, my own food, same as yesterday, search millions online, faster photos. 15 words on screen.
- **Fleet ideas of §5.77, built** (`fleet.js`): maintenance by engine hours (crane `serviceEvery`; `craneHours` = hourly entries +
  daily × `settings.dayHours` (8); `serviceStatus`, `markServiced`; warnings `serviceDue` / `serviceSoon`; crane screen `fleet-service`
  with "Serviced today"); a client's statement of account (`statement`, `statementHTML`, EN/AR, running balance = the client's
  balance; button `fleet-statement` → print / save as PDF); one phone notification at 09:00 for what needs you (`reminderNote` →
  `AttuneNative.schedule` id "fleet-needs", re-made on every change). Test `tests/unit/v737fleet.test.mjs`. Sharing Fleet between
  phones still waits on Drive sync.
- **Minimal design A, more pages** (the agreed rules, measured words on screen in the new layout): Business 182 → 26 (no
  introduction on its own — "How it works" still opens it; card descriptions and the subtitle are `data-intro`), Fleet 77 → 38,
  Knowledge 1,441 → 735 (explanations hidden; each pack's safety notice stays on purpose), Travel 224 → 205. Learn, Studio, Coach,
  Mind, Shelf, News, Convert, Slides and CV were already under 60 words.
- **French / Spanish / Turkish**: a crawl of every page in the new layout (French, `__trMiss`) found 251 English strings on the
  first screens; 182 are translated in all three (+ ~170 lines each); what is left is brand and language names (they stay) and a
  few strings that are translated twice. Deeper screens (sheets, forms) still show some English.
- **Desktop CI** (Windows "Smoke test from source" red since v6.31): not a lost answer — the runner's window is 1008 px, and the check
  expected the phone's bottom bar under 1024 px; v6.30 removed the bar. `desktop/test/smoke-run.js` now accepts the ☰ menu.
- **Quant bench for any model**: `quant-bench.yml` takes repo / prefix / quants (`tests/models/quant_bench.py` reads `PREFIX`); run for
  Glow 2B, Spark 0.8B and Zenith 9B. The 13–18 GB models (Apex+, Apex, Everest) don't fit the 16 GB ARM runner several times over.
- Tests: `tests/unit/v737fixes.test.mjs`, `e2e_v737learn.py`, `e2e_v737maid.py`, `e2e_v737engine.py`, `e2e_v737fitadd.py`; updated
  `e2e_v718looks.py`, `e2e_v732fleet.py`, `e2e_v734sidebar.py`, `v734hubs.test.mjs`.
- **NPU (Snapdragon Hexagon), experimental, off by default**: `hexagon-lab.yml` proved llama.cpp's Hexagon backend builds at the
  app's commit in Qualcomm's public image `ghcr.io/snapdragon-toolchain/arm64-android:v0.7` (NDK + Hexagon SDK). "Build the APK"
  now builds it (optional step) → `jniLibs/arm64-v8a/libattune-npu.so` (= libggml-hexagon.so, renamed so the CPU scan never
  loads it) + `libggml-htp-v*.so` (the DSP halves). `attune-engine.cpp nLoadNpu` sets ADSP_LIBRARY_PATH to the app's lib folder,
  loads it and returns the device ("HTP0"); Engine.kt starts with `-ngl 99 --device HTP0` (NPU first, then GPU, then CPU);
  fallback / crash guard like the GPU (`npuTrial`, `npuNote`); Engine → Settings → Speed → "Use the NPU (experimental)" when
  `npuBuilt`. Supported types: Q4_0, Q8_0, MXFP4 → **Core Max (Q8_0)** is the model to try. Needs Ali's phone test; unknowns:
  whether an app process may open an unsigned DSP session on his phone, and whether the separately built backend matches the
  app's libggml-base (same commit, same API).
- Research notes (17 Oct): llama.cpp has an experimental Hexagon (NPU) backend for 8 Gen 3 / 8 Elite / 8 Elite Gen 5 (Q4_0, Q8_0,
  MXFP4) — anecdotes say CPU-like speed but much cooler; worth a lab run on Ali's SM8850 (Core Max is Q8_0 = supported). No official
  Qwen3.5 QAT GGUF exists yet.
- **Lab results (17 Oct, ARM runner, Neoverse-N2, 4 threads)** — nothing changes in the app; the current files and MTP are the best:
  - DFlash (block-diffusion draft, lossless) vs MTP: every mode gave the same answers as "off" (5/5), but MTP is faster on average —
    Core Max Q8_0: off 14.2 / **MTP 23.2** / DFlash-8 16.7 / DFlash-15 20.5 t/s (DFlash-15 wins code and JSON, 35 vs 29, but
    Arabic drops to 4.9 vs 14.4); Core Q4_K_M: MTP +22% (10.8 → 13.2); Zenith IQ4_NL: MTP +26% (6.4 → 8.1). Not wired.
  - Quant bench (KLD vs the 8-bit file; lower = closer): Glow 2B UD-Q4_K_XL 0.036 (best 4-bit, the app's file); Spark 0.8B Q4_K_M
    0.059 (Q5_K_S 0.031 for +0.04 GB but 10% slower writing); Zenith 9B IQ4_NL 0.055 (the app's file; Q4_0 reads 1.6× faster
    but drifts twice as much). On this server CPU the Q8_0 files of the small models are faster AND exact (Spark Q8_0 0.83 GB,
    68 t/s writing vs 44); on a phone memory speed decides — an option for Ali, not changed.
  - NPU lab run 2: libggml-hexagon.so + libggml-htp-v73/v75/v79/v81.so all built (v81 = 8 Elite Gen 5).

### 5.82 (18 Oct 2026) — v6.35: Ali's phone notes of 18 Oct (food plate scan, phone models, NPU, lessons, Solve, research, Scout, Arabic, keyboard, Knowledge)
Ali tried 6.34 and sent 9 screenshots, two Engine logs and his big idea. Objective items fixed; the subjective ones are on the choices
page (Artifact: https://claude.ai/artifact/LQ1s1sqbSGJtSC8vfZQLec) — six questions, each with options and a recommendation.
- **Food photo** (only mahshi, 60 g; feteer and sauce missed): the fast look (CLIP) called mahshi "sure" (≥ 50 %), so the AI never
  looked, and mahshi's first portion is 1 piece = 60 g. `fitclip.js` **plate scan**: `classifyRegions` reads the four overlapping
  quarters (first encoder only), `plateScan` adds a food that wins a quarter as its own item (with a `box` where it was seen, for
  the label), gives each food grams from its share of the plate (`gramsForShare`: its "plate" portion × share, ≥ 40 g), never calls a
  plate with several foods "sure", and a dish counted in pieces is never "sure" either (the AI counts pieces); a full plate of mahshi
  starts at the plate amount. The AI gets every food the scan saw as hints. `photoPixels(…, region)`. Tests `v738plate.test.mjs`.
- **Core Max and bigger off the phone** (Ali's decision): `phoneOff: true` on md-max, Sense, Zenith, Zenith+, Apex, Apex+, Everest,
  Everest XL; `tierFits` false on a phone, hidden from the Engine list (even "Show all"), never picked by Auto / Deep answer
  (`modelsForRoute`), a note under the list (`tiers-desktop-note`), an installed one marked "too heavy for a phone"
  (`engine-model-computer`). The desktop app is unchanged.
- **NPU "could not be used"**: the Hexagon backend dlopens the vendor `libcdsprpc.so`, which Android 12+ hides from apps unless the
  manifest declares it → `<uses-native-library android:name="libcdsprpc.so" android:required="false"/>`. `nLoadNpu` now keeps the
  backend's warnings/errors (ggml_log_set while it loads) and the loader's dlerror, and returns "ERR:<why>"; Engine.kt writes
  "NPU: could not be used — <why>" (or "NPU: running on HTP0") into the Engine log. Bug fixed on the way: the start-up notes
  (also the v6.34 memory note) were written before the log was cleared for the start, so they never showed (`startNotes`).
- **Lesson conversation on Blaze** ("couldn't write a small conversation"): `speak.js parseDialogue` reads JSON in fences, JSON cut
  off by the limit, trailing commas, names instead of A/B, and plain "A: … (meaning)" lines; `dialogueMessages(c, l, true)` = a
  second try in plain lines (1000 then 900 tokens).
- **Doc chat "Solve the questions"** (empty answer shown as "not found"; slow): `docqa.js questionsOf` finds the questions by code
  ("1.", "Q2", "3)", "Problem 4", a line ending "?", a one-line PDF split before "2. Explain"), `solveOneMessages` solves each with
  its page; the answer grows on the page question by question (streamed, `onToken` now passed to Ask a PDF); an empty solve says
  "The model gave no answer this time…", never "not found".
- **Research (Lynk & Co 900 → a table with the 08)**: `research.js onTopic` — a model number in the question ("900", "08", "X5")
  must be on the page as a word (title / address, or next to the name: "Co 900"); a year stays optional. `answerfix.js cutLoops`
  (in tidyAnswer): a labelled paragraph that starts again ("**Comparison:** … The 9 **Comparison:**") is cut at the repeat, a
  6+-word sentence said twice is kept once.
- **Scout (Tucson 2022 → 2027 ads, "151 EGP", category page 100/100)**: a plain year in a car / product goal is that exact year; on
  the known ad sites only an ad address is an ad, a list title ("Vehicles for sale in Egypt") never is; an amount no car / home /
  rent can cost is not its price (car ≥ 30,000 EGP, home ≥ 150,000, rent ≥ 800); the model words match with one letter off or
  two swapped (`close1`: "Tuscon" = Tucson).
- **Arabic "disturbing for the eyes"**: letter-spacing (the capital-label style) pulled the joined Arabic letters apart — none in
  RTL now (tw.css and the Money app); line height 1.6 in Arabic; the Money app (yusr) uses IBM Plex Sans Arabic; `fmt()` in Arabic
  keeps "-17,922" one left-to-right piece + a no-break space + the currency (it showed "ج.م-" above "17,922"). Wording = choice 5.
- **Keyboard bottom row** ("some buttons don't work"): since Android 15 the keyboard draws behind the navigation bar and the bar's
  own hide / switch-keyboard buttons covered the row; the root view pads the navigation-bar inset. Look = choice 6.
- **Shop in your pocket**: the item name box was squeezed to 40 px (w-full beat flex-1) → it takes the room, the price is 96 px.
- **Knowledge hidden from users** (Ali: "I want to be the one to add the knowledge, not the users"): `KNOW_ADMIN = devMode()`
  (Ali's test builds, 7 taps on the version). Without it: no Knowledge page in the tools / Learn hub, no "Add to Knowledge" in
  Ask a PDF, no "Teach this to my model", no "Chat now knows: …" toast; the packs still install by themselves and answer, and the
  answer shows "Sources: …" chips. Pack expansion = choice 4.
- **Android 17** (Ali: "developed for Android 17 and lower, not 16"): compileSdk and targetSdk 37 (API 37), minSdk stays 28. AGP stays
  8.9.1 (Google's Android 17 setup page: 8.9.0-rc01 or newer; `android.suppressUnsupportedCompileSdk=37` in gradle.properties;
  AGP 9.1.1+ is the fully supported line — a bigger upgrade, later). The APK workflow installs `platforms;android-37`. Checked against
  "behavior changes for apps targeting 17": no System.load of writable files, no background-activity PendingIntent modes, no
  widget bitmaps, no SMS, no reflection on MessageQueue; LAN access would need ACCESS_LOCAL_NETWORK (the engine is on 127.0.0.1).
- Version 6.35 (versionCode 96). Tests: `tests/unit/v738plate.test.mjs`, `tests/unit/v738fixes.test.mjs`.
- Ali's big idea (answered on the choices page): Core Max and up only on computers (done); a code-first app where the small model
  only phrases and connects (the direction already; agent ideas = choice 2); regroup the app (choice 1); food stronger than Yazio
  (plate scan done, USDA pack = choice 4A); Scout stronger (choice 3).

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
- Slides & Reports ideas not done: Morph transition (needs the p159 namespace), per-slide different transitions, Studio pictures on slides, charts as native (editable) PowerPoint charts, custom logo/company colours, report → Excel appendix.
- **Before release:** `TESTING_ALL_PRO = false`, `SELLER.contact`, Play listing text (offline, private; no YouTube downloading), real Play Billing if he wants it.
- File Converter ideas not done: old binary .doc/.xls/.ppt, PDF → Word keeping pictures and layout, PowerPoint → PDF as slide pictures, compress PDF, PDF password remove/add, sign a PDF, OCR a PDF into a searchable PDF, translate Excel/CSV cells.
- Video Downloader: HLS (.m3u8) streams would need ffmpeg (≈ +20 MB) — only for sites that allow downloads. YouTube & co. stay refused unless Ali explicitly asks for a separate non-Play APK (he declined on 27 Sep 2026).
- Own models per RAM tier trained on Ali's PC (RTX 3050 8 GB): LoRA on the small tiers with his corrections (≥ 200 examples) — plan discussed in chat, nothing built.
- Fill `SELLER.price/contact` (Ali's price + WhatsApp); optional Play Billing for ERP licences.
- ERP: printable invoice/quote PDFs from records (ETA e-invoice format), per-table forms layout, relations shown as sub-lists (e.g. a customer's jobs), multi-user sync (would need a server — discuss with Ali first).
- Learn daily: Studio picture per lesson automatically when Studio is installed; audio pronunciation via TTS for language lessons.
- Daily news: prefetch at the notification time (needs a WorkManager job + model in background — heavy; current design gathers on open).
- Translate the Travel country packs; Arabic Android-side error messages.
- Whisper Egyptian-Arabic voice; "Ask your documents" (on-device RAG); fingerprint lock for Money/Cycle; crane chart import from a photo.


### 5.39 v6.11 (3 Oct 2026) — release candidate: what this session built and measured
- **Built and tested:** Skills v2 (checklist / facts / offline script / SKILL.md), CV builder + "Edit or improve", Business books (finance core + UI + documents), 25,280 generated recipes (`fit-recipegen.js`) + 148 hand-written, offline food pack (`foodpack.js`, `tools/build_food_pack.py`, workflow `food-pack.yml`, release `food-pack-v1`; ~902k products from Open Food Facts; the USDA merge probes the dated file name), **Ask a PDF** (`docqa.js`, `pdfchat-ui.jsx`; native `pdfText` has a `textOnly` fast path), converter fidelity on the real PDF, plans & billing page, engine lifecycle, exact-length rules, coding restart + date facts.
- **Release switches:** developer mode (hidden 7 taps on the version number; `devMode()` in billing.js) — OFF by default; Yusr Premium test unlock removed. Tests run in developer mode via `tests/harness.py` (`release=True` = a customer phone; `tests/e2e_v620release.py`).
- **Measured (PC CPU, the app's own engine commit 7ab4ee7):** the standard Qwen3.5 GGUFs have NO multi-token-prediction layers; `unsloth/Qwen3.5-{0.8B,2B,4B,9B}-MTP-GGUF` do. With `--spec-type draft-mtp --spec-draft-n-max 3 --spec-draft-p-min 0.5` the 4B writes JSON +65%, code +48%, rewrites +28%, emails +24%, summaries +21%, free-form prose −12% (English and Arabic); answers identical. The 0.8B draft model is a net loss (−2% on 4B, −28% on 2B). The engine cannot switch speculation per request (tested), so it is chosen at engine start.
- **Labs (GitHub, ARM runner):** `model-lab.yml` (speed / memory / prompt cache / speculative modes / real trials for Qwen3.5 4B & 9B, MTP builds, Ling-3.0-tiny, MiniCPM5-2B, LFM2-8B-A1B), `studio-lab.yml` (Turbo vs Pro vs Z-Image-Turbo with CLIP prompt-match). Local: `tests/models/spec_lab.py`.
- **Not done:** Studio switch (waits for the lab), phone-side measurements, Shelf notes (item 25), UI rework (13), Fit photo fallback chain (10), heat phase 2 (1), item 3 storage ideas (prompt-cache restore needs `--slot-save-path` and removing `--no-slots`; mmap stays OFF — MagicOS evicts mapped pages).
- **Network (this sandbox):** huggingface.co reachable; unsloth.ai, static.openfoodfacts.org, fdc.nal.usda.gov, most blogs are not.
- Release checklist and the 30-minute phone smoke test: `RELEASE_6.11.md`. Everything built this session: `CHECKLIST_2026-10-03.md`.
