# Attune — handoff for the next session

_Last updated: 24 Sep 2026 (end of the v4 session)._

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

## 6. Status right now
- **v4 has NOT been tested on Ali's phone yet.** Ali should upload the v4 zip and build. Check first: how fast answers start and flow, whether the phone stays cool, the mic, read-aloud, and sharing a bank SMS to Attune.
- If something breaks, ask for the Engine screen, then **Engine log**, as a screenshot or copied text.
- Ali still has a Gemma 4 12B installed; he should install Qwen 3.5 4B from Engine.

## 7. The agreed next step: v5 (from the research, in priority order)
1. **Encrypted backup/restore** of everything (chats, Yusr ledger, cycle, memory, settings) to one password-protected file. This is critical because all data lives only on the phone.
2. **Full Arabic interface** (RTL, all strings; Yusr already has Arabic).
3. **Reminders and actions:**
   - Tool calling with a **GBNF grammar**: llama-server supports `grammar`/`json_schema` per request. With a small model, prompt-only JSON works only about 80–85% of the time.
   - Actions: alarms, reminders, calendar events and WhatsApp drafts through Android intents. Found commitments become notifications.
4. **Speed:**
   - Build the **OpenCL (Adreno)** backend with CPU fallback. Hexagon NPU is still "experimental" in llama.cpp.
   - **Speculative decoding** with Qwen 3.5 0.8B as the draft model (`-md`).
   - A built-in benchmark.
5. **Crane toolkit** (deterministic calculators, not model guesses): load charts per crane, outrigger ground pressure, sling angles, wind limits, pre-lift checklist. **Or "Ask your documents"** (on-device RAG with EmbeddingGemma 308M / AraGemma-Embedding).

Later:
- Whisper Egyptian-Arabic voice (`MAdel121/whisper-small-egyptian-arabic`, WER 22.7%, MIT) via whisper.cpp. Gemma 4 audio through llama-server is not supported (issue #21868 closed as not planned).
- Hands-free voice mode; quotation/invoice PDFs, ETA-ready (threshold EGP 250k, penalties EGP 20k + 1k/day); fleet maintenance reminders.
- Fingerprint lock for Money and Cycle; home-screen widget and quick-settings tile; Cycle reminders and doctor PDF.

## 8. Hard-won lessons (do not repeat)
- **CORS:** `Access-Control-Allow-Headers: *` does not cover `Authorization`. All model calls go through `NativeBridge.chat`, not browser fetch.
- **The page path:** it is served under `/app/www/` (not `/assets/`) to escape an old service worker. In the app, service workers are unregistered and caches deleted.
- **Engine threads:** OpenMP must stay OFF on Android. minSdk is 28 (posix_spawn). Use `GGML_BACKEND_DL` + `GGML_CPU_ALL_VARIANTS`, and `useLegacyPackaging = true` so the CPU variant `.so` files are unpacked.
- **Never stop the engine in `onDestroy`:** the stop-then-start race left "Loading…" forever. Back sends the app to the background instead.
- **Chat history must alternate user/assistant:** only complete pairs are sent. Stopped answers and cards are excluded.
- **Build tools:** the page must never load from a CDN (a CI check fails the build if it does). Keep esbuild pinned to 0.28.2 for byte-identical builds.
- **Git:** commits should be authored `Claude <noreply@anthropic.com>` (a stop hook checks this).
