# Attune — handoff for the next session

_Last updated: 24 Sep 2026 (end of the v5 session)._

## 1. The person and how to work with him
- **Ali (Aly Aldibiki)**, Egypt (Cairo, UTC+3). Owns a crane company (Adrighem & Aldibiki: Liebherr, Demag, XCMG, Sany cranes, 20–500 t). Works on **Windows**; tests on an **Honor Magic 8 Pro** (Snapdragon, 12–16 GB RAM, MagicOS with Google services).
- Speaks Arabic (Egyptian) and English. Wants **detailed, step-by-step answers**, technical terms in **English + Egyptian Arabic**, reasoning explained (not just steps), and **targeted fixes instead of full rewrites**.
- He is **not a developer at the keyboard**: give him exact clicks. He builds the APK with **GitHub Actions**, never Android Studio.
- He tests on his phone and reports with screenshots. Take each point literally and answer every one.

## 2. What Attune is
An Android app (package `com.aldibiki.attune`) that is a **fully offline AI assistant**:
- A **Kotlin WebView wrapper** hosting one self-contained page (`app/src/main/assets/www/index.html`, about 1.3 MB, React + compiled Tailwind, no CDN).
- **llama.cpp's official server** (`llama-server`) compiled into the app (`libattune-engine.so`). It runs in-process on `127.0.0.1` on a random port with a per-launch API key.
- Models: Qwen 3.5 / Gemma 4 GGUFs from Hugging Face (`unsloth/...`), downloaded in the app (resumable, SHA-256 fingerprint).
- **Privacy:** there is an offline lock that blocks every network path, and a network log. Nothing connects at start-up.
- **Repo:** `https://github.com/alydibiky/attune-` (public). **Workflow:** "Build the APK" (`.github/workflows/build-apk.yml`). The artifact `attune-apk` is signed with the debug key. Run #2 was the first green build (about 8 minutes).

## 3. Where things are
```
app/src/main/java/com/aldibiki/attune/
  MainActivity.kt   WebView, asset loader (/app/www/), share intents (text + images),
                    file chooser, Back → page first, then moveTaskToBack (keeps model loaded),
                    renderer-crash recovery, mic permission, Engine.onChange → page
  NativeBridge.kt   window.AttuneNative: info, models, install, use, restart, chat (SSE → delta),
                    cancel, search, fetchText, hash, netLog, setAirGap, keepAwake,
                    listen/stopListening (voice), speak/stopSpeaking (TTS), share
  Engine.kt         starts llama-server: context sizing, 4-min load watchdog, memory guard (>55% RAM refused),
                    loadPhase from log, isHeavy, onChange listener
  DeviceInfo.kt     real RAM, cores, thermal; gen threads ≤4, batch = cores-2 (≤6)
  ModelStore.kt, WebTools.kt (DuckDuckGo/Brave), Prefs.kt, NetLog.kt, Voice.kt (SpeechRecognizer), EngineNative.kt
app/src/main/cpp/   CMakeLists.txt, attune-engine.cpp (JNI), fetch-llama.sh/.bat (pinned llama.cpp 7ab4ee7b…)
web-src/            SOURCE of the page — edit here, then run `bash web-src/build.sh`
  attune.jsx        the app (~10k lines; one big App component + tabs)
  chat.jsx          Chat home screen (Md renderer, history, actions, routing)
  cycle.jsx         period tracker + natural-language log parser
  yusr/             Yusr money/zakat ledger (runs in an iframe, talks via yusr-bridge.js)
  build/            shell.html, shims, lucide icon set (lucide-shim.js), tw.css
  build.sh          reproducible build → app/src/main/assets/www/index.html (verified byte-identical)
tests/              e2e_v4.py (38 checks), e2e_v3.py (35 checks), setup.sh, make_tiny_model.py
```

## 4. How to build and test
1. Edit `web-src/*`, then run `bash web-src/build.sh` (needs Node 18+ and Python 3; it installs esbuild 0.28.2 and Tailwind 4.3.3 locally).
2. Browser tests: run `bash tests/setup.sh` once, which builds a desktop llama-server at the same pin and a tiny model. Then run `python3 tests/e2e_v4.py && python3 tests/e2e_v3.py`. These use a phone-sized Chromium with a mock `AttuneNative` whose `chat()` hits the real llama-server.
3. **Kotlin:** there is no Android SDK in the sandbox (dl.google.com is blocked). The previous session compile-checked the Kotlin with `kotlinc` against `android-35.jar` plus hand-written androidx stubs. Otherwise, rely on CI.
4. **The APK:** commit and push to `main`. GitHub Actions builds it, and Ali downloads the artifact. If this session cannot push, give Ali a zip plus the GitHub web **Upload files** steps.

## 5. Version history (what is already done)
- **v2** (the first working APK): the engine, downloads, web search, offline lock, back button, and assorted fixes.
- **v3**, after Ali's phone test. Symptoms: the answer never came, the phone got hot and laggy, "Loading" went on forever after reopening. Causes: Gemma 4 12B with a 32K context filled RAM and swapped; the engine used all 8 cores; a reopen race meant the new screen never got the "ready" message. Fixes:
  - **Speed-first model choice:** phones are recommended **Qwen 3.5 4B**; the 9B is offered as "Stronger, slower".
  - **Engine limits:** thinking is off by default with a per-question Think button and a `thinking_budget_tokens` cap; every answer streams; there is a thermal stop.
  - **Instant:** one box plus Go, which works out the task itself; "Answer in" language chips that relabel the buttons; Stop, and switching action mid-answer; voice input.
  - **Cycle** period tracker, logged from natural language in English and Egyptian Arabic.
  - **Payments:** accepted by share, paste or photo, and sent to Money.
  - **Fixes:** all 4 madhhabs made obvious and linked to the combining (ḍamm) rule; multi-select onboarding; domain pack buttons were empty (they iterated `CPACKS` instead of `PACKS`).
  - **Smoothness:** Tailwind compiled at build time (the old in-browser Tailwind re-scanned the whole page on every change); overscroll containment; no backdrop blur.
- **v4**, a professional chat UI:
  - Chat is the home screen: streaming Markdown (tables, lists, code, right-to-left aware).
  - Multi-turn history, budgeted to the engine's context, with a retry if it overflows.
  - Buttons on each answer: Copy, Regenerate, Edit, Read aloud (native TTS), Share (native sheet), Save to Memory.
  - Follow-up chips; a chat history drawer with search, rename and delete.
  - On-device routing: a period log or a payment becomes a card, with no model call.
  - A bottom bar (Chat · Instant · Money · Cycle/Memory · More), with a More sheet holding every other tool.

## 6. Status right now (after v5)
- **GitHub `main` was still v2** at the start of the v5 session (v4 had never been uploaded). The v5 session could NOT push (the repo was not in its authorised set), so everything was delivered as `Attune-v5.x-upload.zip` for Ali to upload with **Add file → Upload files**. If `main` still shows "CI: install only platform-tools…" as the last commit, the upload hasn't happened yet.
- **First install of v5 needs one uninstall**: earlier APKs were signed with a random per-run CI debug key. From v5 on, release builds use the fixed test key `app/attune-test.keystore`, so later updates install over each other. Ali should back up (More → Backup) before any future uninstall.
- **Not yet tested on Ali's phone:** everything in v4 and v5. Check first: GitHub Actions log line "OpenCL SDK ready" (GPU backend built) or its absence (CPU-only APK, still fine).
- If something breaks: Engine screen → Engine log (screenshot or copied text).

## 7. v5 — what was built (all five done, each its own commit)
1. **Encrypted backup/restore** (`web-src/backup.js`, `backup-ui.jsx`): every localStorage key (chats, Yusr `ledger.v3`, cycle, memory, reminders, crane charts, settings) → one `.attune` file. PBKDF2-SHA-256 600k → AES-256-GCM, header authenticated, gzip. Saved via Android's Save-to picker (`NativeBridge.saveFile` → `CreateDocument`). Restore: Replace or Merge (lists joined by id; ledger never mixed), one-step Undo (`stashPut/Get` in app private files). More tile turns amber after 14 days.
2. **Arabic interface** (`i18n.js`, `i18n-ar.js`): `tr("English")` everywhere (English text is the key; missing = English). ~1,300 entries. Switch in More and onboarding; reloads the page, sets `dir=rtl`, syncs Yusr's `db.lang`. Classes are logical (`ms-/me-/ps-/pe-/start-/end-`). **Not translated yet: Travel country-pack contents** (~1,000 content strings, lines ~718–792 and COUNTRY_PACKS). `tests/i18n_crawl.py` lists English still visible in Arabic.
3. **Reminders & actions** (`actions.js`, `actions-ui.jsx`, `Reminders.kt`, `PhoneActions.kt`): Chat detects "remind me / صحيني / ابعت على الواتساب…" → model call with a **GBNF grammar** (`body.grammar`, NOT `json_schema`: see lessons) → `buildAction` works out the time with the deterministic `parseTime` (EN + Egyptian Arabic) → editable card → confirm. Reminders: AlarmManager + notification + BootReceiver; exact only with "Alarms & reminders" allowed (else ≤10 min window, UI says so). Alarm/timer/calendar/WhatsApp/call open the phone's own app pre-filled. More → Reminders screen. Confirmed dated promises get a 9:00 reminder.
4. **Speed** (`speed-ui.jsx`, `Engine.kt`, `attune-engine.cpp`, CMake, workflow): optional **OpenCL/Adreno GPU** backend built only if CI's "OpenCL SDK" step succeeds (continue-on-error), renamed `libattune-gpu.so` so the CPU scan never touches the driver; loaded by `nLoadGpu` only when GPU is on. CPU mode passes `-ngl 0`. Crash guard `Prefs.gpuTrial` + automatic CPU fallback with a note. **Speculative decoding** with Qwen 3.5 0.8B draft (`-md` + `--spec-type draft-simple`), Qwen 3.5 only, only if both fit. Engine → Speed has the switches and a fixed-task speed test.
5. **Crane toolkit** (`crane.js`, `crane-ui.jsx`): load charts per crane (pasted table), cautious lookup (min of surrounding cells, never interpolated up), % of chart with company limits, outrigger ground pressure + mat size, sling tension (3/4-leg rated as 2), wind (tip-height power law; v = v_chart·√(1.2·m/(A·cw))), 20-item pre-lift checklist. Planning aid — stated on screen.

**Tests now:** `node tests/unit/run.mjs` (69: time parser + crane math), `python3 tests/e2e_v5.py [backup|arabic|actions|speed|crane]` (87), plus e2e_v4 (38) and e2e_v3 (35). `tests/harness.py` holds the v5 mock phone (reuses the v4 mock from e2e_v4.py).
**Kotlin check without an SDK:** kotlinc 2.0.21 (GitHub release) + `android-35/android.jar` (sparse clone of github.com/Reginer/aosp-android-jar) + hand-written androidx/jsoup/R stubs.

## 7b. Next (not started)
- Translate the Travel country packs; Android-side error messages in Arabic.
- Whisper Egyptian-Arabic voice (`MAdel121/whisper-small-egyptian-arabic`) via whisper.cpp; hands-free mode.
- "Ask your documents" (on-device RAG, EmbeddingGemma 308M).
- Quotation/invoice PDFs (ETA); fleet maintenance reminders (can reuse Reminders); fingerprint lock for Money/Cycle; widget/tile.
- Crane: import charts from a photo of the printed chart (model reads, person verifies cell by cell).

## 8. Hard-won lessons (do not repeat)
- **CORS:** `Access-Control-Allow-Headers: *` does not cover `Authorization`. All model calls go through `NativeBridge.chat`, not browser fetch.
- **The page path:** it is served under `/app/www/` (not `/assets/`) to escape an old service worker. In the app, service workers are unregistered and caches deleted.
- **Engine threads:** OpenMP must stay OFF on Android. minSdk is 28 (posix_spawn). Use `GGML_BACKEND_DL` + `GGML_CPU_ALL_VARIANTS`, and `useLegacyPackaging = true` so the CPU variant `.so` files are unpacked.
- **Never stop the engine in `onDestroy`:** the stop-then-start race left "Loading…" forever. Back sends the app to the background instead.
- **Chat history must alternate user/assistant:** only complete pairs are sent. Stopped answers and cards are excluded.
- **Build tools:** the page must never load from a CDN (a CI check fails the build if it does). Keep esbuild pinned to 0.28.2 for byte-identical builds.
- **Git:** commits should be authored `Claude <noreply@anthropic.com>` (a stop hook checks this).
- **`web-src/build/` is SOURCE.** The root `.gitignore` rule `build/` once silently dropped it from an upload; it's now `/build/` + `app/build/` with `!web-src/build/`. The v5 session rebuilt it from the compiled page (byte-identical).
- **Release APKs are signed with `app/attune-test.keystore`** (committed on purpose). Never go back to the CI debug key: every run makes a new one and updates stop installing.
- **Grammar, not json_schema:** at this llama.cpp pin, `response_format/json_schema` grammars are pre-fed the template's generation prompt ("prefill"); user-supplied `grammar` is not. Keep strings in the grammar bounded and `max_tokens` ≥ ACTION_MAX_TOKENS so the JSON always closes.
- **Speculative decoding:** `-md` alone does nothing at this pin — add `--spec-type draft-simple`. Check `timings.draft_n` / `draft_n_accepted`.
- **GPU default:** llama.cpp's `-ngl` default is auto (offload to any GPU found) — always pass `-ngl 0` for CPU.
- **i18n:** new UI text must go through `tr()` and get an `i18n-ar.js` entry; run `tests/i18n_crawl.py` to find gaps. Changing language reloads the page (module-level tables use `tr()` at load).
- **e2e_v3 thinking step** was flaky (~1 in 3, also on the original v4 page): it now accepts either live thinking or "How it thought".
- **v5.6 (after Ali's first v5 test: 0.7 tokens/s, ~10 min for one sum, app under the status bar):** `--load-mode none` (weights read into RAM; mmap pages could be evicted and re-read per token — **`--no-mmap` no longer exists at this pin**, `tests/engine_args.py` now checks every Engine.kt flag against the real server and starts it with the CPU/GPU/draft sets); GenService foreground service while writing; warm-up of Chat's system prompt when a model becomes ready (skipped once the user has asked); instant exact arithmetic in Chat (`calc.js`); chat prompt now says "working first, total last, write it once" (the old "result first" made the model state a wrong total then 'correct' it); Engine → Speed → "Why is it slow?" doctor + a hint under slow answers; WebView inside a padded FrameLayout (WebView ignores its own padding → page drew under the status/nav bars); More → Text size (WebView textZoom; 90 % by default on narrow screens); Money is a fixed full page with its tools in a slide-up sheet.
- **Test mock lesson:** a canned ("fake") answer must abort the real engine request, or the engine keeps generating unseen and later real requests time out (the source of the v3/v4 flakiness). Tests now also kill their engine on exit.
- **Honest ceiling:** a 4B model on a phone CPU writes ~15–25 tokens/s when healthy; a whole long answer can't take 1–2 s. What can: exact answers without the model (calc, period, payment, reminders), first words in ~1 s (warm cache), and shorter answers.

- **v5.7 — the fast engine (Ali: "make the on-device model really fast… compete with online models"):** a second engine next to llama.cpp. `FastEngine.kt` runs **.litertlm** models on Google's **LiteRT-LM** (`com.google.ai.edge.litertlm:litertlm-android:0.17.1`, pinned; Kotlin plugin bumped 2.0.21 → **2.4.0** because that AAR carries Kotlin 2.4 metadata, and `kotlinOptions{}` was replaced by `kotlin { compilerOptions { … } }`). Tries GPU+photos+multi-token prediction → GPU+photos → GPU → CPU+photos → CPU and reports what really loaded; crash guard `fast_trial`/`fast_cpu` prefs like the OpenCL one. `Engine.kind` = "llama" | "litert"; `NativeBridge.chat` sends litert requests straight to `FastEngine.chat` (same request/response shape as llama-server: `{content, reasoning, timings{prompt_per_second, predicted_per_second}}`; GBNF grammar isn't available there, so the JSON is asked for in words and trimmed to `{…}` — the page already falls back to `quickAction`). Catalogue: **Gemma 4 E2B** (`gemma-4-E2B-it.litertlm`, 2.59 GB, multimodal — NOT the `-gpu`/`-web` files, which are text-only) is now the first recommendation in the Android app, **E4B** (3.66 GB) the stronger one. Engine → Speed shows a "Switch to the fast engine" button on llama.cpp, and a fast-engine panel (GPU on/off, MTP status) when it runs. Published figures (Google, S26 Ultra GPU): E2B prefill ~3,800 t/s, decode ~52 t/s, 66–92 t/s with MTP — **unverified on the Honor**; if the GPU refuses, the note in Speed says why. Tests: `e2e_v5.py fastengine` (14 checks); Kotlin compile-checked with kotlinc 2.4.0 against signature-exact stubs of LiteRT-LM v0.17.1. **Not verifiable here:** Google Maven is blocked from the sandbox, so the first CI run is the first real Gradle resolve of the AAR — if it fails, the likely causes are (1) the AAR's minSdk (manifest has `tools:overrideLibrary="com.google.ai.edge.litertlm"`), (2) a duplicate `.so` (add a `pickFirsts`).
