# Attune for Windows, macOS and Linux — plan and prototype (3 Oct 2026)

Ali's goal: the same app (chat with local models, Studio pictures, Ask a PDF, Fit, Business/Books, CV, Skills,
converters) on computers, with much stronger models (16–64 GB RAM, graphics cards), offline and private, same web UI.

Status: **prototype runs** (branch `desktop-shell`, folder `desktop/`). Chat with a local model, model install,
engine start/stop, device info — streamed answers verified on this Linux box, and in CI on all three systems
(workflow `.github/workflows/desktop.yml`).

## 1. Decision: Electron (شِل Electron — نفس متصفح Chrome جوّه البرنامج)

| Criterion | Electron | Tauri v2 | Node/Python launcher + browser |
|---|---|---|---|
| Reuse web-src **unchanged** | **Yes.** The page calls `AttuneNative.info()` etc. and expects a string *at once* (sync). Electron's `ipcRenderer.sendSync` gives exactly that, so the Android bridge contract is copied 1:1. | No sync calls (all `invoke` is async) → every `nativeJSON(...)` site in attune.jsx would need rewriting. | Page in a normal browser: no sync bridge either; browser storage tied to a localhost port; looks like a website. |
| Same rendering everywhere | Same Chromium on all 3 OSes = what we test is what ships (the Android WebView is Chromium too). | WebView2 (Win) / WebKit (mac) / WebKitGTK (Linux): three engines; WebKitGTK lags (CSS, WASM, Pyodide). | Whatever browser the user has. |
| Size | ~90–110 MB installer + engine (~20–60 MB). | ~5–15 MB + engine. | Small, but needs Node/Python installed. |
| Auto-update | `electron-updater` from GitHub Releases (mature; mac needs signing). | Built-in updater (needs its own signing key). | Do-it-yourself. |
| Signing / notarisation | electron-builder does Windows (Authenticode / Azure Trusted Signing) and mac notarisation from env secrets. | Same requirements, also supported. | Same, plus the runtime. |
| Spawning llama-server / sd-cli | Node `child_process` in main — trivial, per-OS binaries in `resources/engine/<variant>`. | Rust sidecars — fine. | Fine. |
| CI without GPU | Yes: Xvfb on Linux, plain on Windows/macOS runners; the engine falls back to CPU. **Done and green.** | Yes. | Yes. |

Why: the models are gigabytes; 90 MB of shell is noise next to them. What matters is zero changes to a 3 MB web
app with ~100 sync bridge calls, one browser engine to test, and a proven updater/signing path. Tauri can be
revisited later if size ever matters (the bridge contract stays the same).

## 2. Architecture

```
 ┌──────────────────────── Attune.exe / Attune.app / Attune.AppImage ───────────────────────┐
 │  Renderer (Chromium)                                                                       │
 │    app://attune/index.html  = the SAME built web app (app/src/main/assets/www/index.html)  │
 │    window.AttuneNative  ← preload.js (contextBridge)  — same method names as Android       │
 │       quick calls: ipcRenderer.sendSync  → string/bool at once (info, models, engine…)     │
 │       slow calls:  ipcRenderer.send(id)  → answers later via window.__attuneNative         │
 │                     .resolve/.reject/.progress/.delta  (exactly like evaluateJavascript)   │
 │  ─────────────────────────────── IPC ────────────────────────────────                      │
 │  Main process (Node)  main.js                                                              │
 │    lib/models.js  download (resume, Range), install, list, remove  → <userData>/models     │
 │    lib/engine.js  spawn llama-server on 127.0.0.1:<random port>, random API key,           │
 │                   GPU first → CPU fallback, health poll, engine.log                        │
 │    lib/device.js  RAM, cores, CPU flags, GPUs + VRAM (llama-server --list-devices)         │
 │    (later) lib/image.js  sd-cli for Studio; lib/docs.js converters; lib/voice.js           │
 └────────────┬───────────────────────────────────────────────────────────────────────────────┘
              │ HTTP + SSE, loopback only, bearer key
       llama-server (child)   resources/engine/{vulkan|metal|cuda}/   (+ sd-cli later)
```
The page never talks to the network itself for chat: the main process makes the request (same reason as Android:
no CORS / mixed-content trouble, Stop closes the connection).

## 3. NATIVE bridge → desktop map (every NativeBridge.kt method)

Legend: **✅ done in prototype** · 🟡 planned (phase) · ⛔ not needed on desktop (hidden, so the page's own
"Android only" fallback shows).

| Method | Desktop implementation |
|---|---|
| info | ✅ `device.js`: platform "desktop", ramGB, cores, CPU flags (avx2/avx512/neon/dotprod/i8mm), gpus[], vramGB, unifiedMemory, freeStorageBytes, airGap |
| models / remove / use / install / restart / wake / engine / log | ✅ `models.js` + `engine.js`. install accepts {repo,quant} / {spec} / {url,mmprojUrl} / **{path}** (a GGUF already on the disk) |
| chat / cancel | ✅ SSE from llama-server, deltas batched every 60 ms (same as Android), Stop aborts the HTTP request |
| keepAwake | ✅ `powerSaveBlocker` |
| setAirGap / netLog / clearNetLog | ✅ air-gap blocks install + fetchJson; netLog records host + reason |
| setTextZoom | ✅ `webContents.setZoomFactor` |
| logLine / stashPut / stashGet / stashDel | ✅ files in userData |
| share | ✅ copies to the clipboard (computers have no share sheet) |
| saveFile | ✅ native "Save as…" dialog |
| fetchJson | ✅ food databases only (same allow-list idea as WebTools.foodJson) |
| fetchText / search / news | 🟡 P2: port WebTools (Node fetch + readability); same allow-list + air-gap |
| doctor / speed / setSpeed | 🟡 P2: read engine.log + /props; on desktop "speed" = context size, GPU layers, threads |
| hash | 🟡 P2: sha256 stream in Node |
| pdfText / pdfImages / makePdf / pdfEdit | 🟡 P2: pdf.js / pdf-lib in Node (Android uses PdfBox/MuPDF-style code) |
| htmlToPdf | 🟡 P2: `webContents.printToPDF` (better than Android's path) |
| shareFile / saveImageToGallery / shareImage / deleteImage | 🟡 P2: save dialog / reveal in folder / Pictures folder |
| clipboardText | 🟡 P2: `clipboard.readText` |
| imageInfo / imageList / installImagePack / removeImagePack / imagine / upscaleImage / sharpenFast / cancelImage / setImageCpu | 🟡 P3: `sd-cli` (stable-diffusion.cpp, CUDA/Vulkan/Metal builds), packs in `<userData>/studio`; Qwen-Image on ≥24 GB VRAM or ≥48 GB unified memory |
| speak / stopSpeaking | 🟡 P2: renderer `speechSynthesis` (OS voices, offline) |
| listen / stopListening | 🟡 P3: whisper.cpp (offline) — the OS dictation APIs are not private enough |
| schedule / unschedule / scheduled / canExact / notifyAllowed / askNotifications / askExact | 🟡 P2: Electron `Notification` + a timer while running; tray "keep running for reminders" |
| storeProducts / storeBuy / storeOwned / storeConsume | 🟡 P4: licence-key store (see §9) exposed as the same `ATTUNE_STORE` |
| foodPackText / foodClipStatus / foodClipInstall / foodClipRemove | 🟡 P2: same files, in userData |
| videoProbe / videoGet / videoDownload / videoStatus / videoOpen / videoCancel | 🟡 P3: same helper binary as Android if license allows; else hide |
| scanBarcode | ⛔ (a webcam reader could come later via the page's BarcodeDetector) |
| intent / openHealthApp | ⛔ phone apps |
| healthStatus / healthConnect / healthDay / huaweiStatus / huaweiConnect / huaweiDay | ⛔ phone health stores (import a file later) |
| setWidget | ⛔ home-screen widget |

## 4. Where things live (البيانات فين)

| What | Windows | macOS | Linux |
|---|---|---|---|
| App data root (`userData`) | `%APPDATA%\Attune` | `~/Library/Application Support/Attune` | `~/.config/Attune` |
| Models | `<root>/models/<id>/model.gguf`, `mmproj.gguf`, `meta.json` | same | same |
| Picture packs (P3) | `<root>/studio/<pack>/` | same | same |
| Engine log / app log / state | `<root>/engine.log`, `app.log`, `state.json` | same | same |
| Engine binaries | inside the install (`resources/engine/<variant>`) | `Attune.app/Contents/Resources/engine` | in the AppImage |
`ATTUNE_HOME` overrides the root (tests). P2: a setting to move models to another drive (big models, small C:).

## 5. Device capability → the existing recommenders

- `info()` returns `platform: "desktop"`. **The only web-src change** (2 lines, attune.jsx): when the bridge says
  desktop, `detectDevice` reports `platform: "desktop"` (so `tierFits` uses `needRam`, not `phoneMin`, and the
  desktop-only tiers Everest/Apex appear), and the phone-only fast engine (litert tiers) is hidden when
  `NATIVE.desktop`. Android: unchanged (`platform` is "android" there).
- Memory figure fed to the tiers (`ram`): system RAM. Rules for what fits (P2, in device.js → a `fitGB` field):
  - Apple silicon: unified memory; usable ≈ 70% of RAM (macOS keeps the rest; `iogpu.wired_limit_mb` default).
  - Discrete GPU: weights may sit in VRAM + RAM; `--fit on` lets llama.cpp place layers. Fast if the model fits
    in VRAM; MoE models (Everest 35B-A3B) stay fast with experts in RAM (`--n-cpu-moe`).
  - So a 32 GB PC with an 8 GB card gets Apex/Everest (MoE) offered; a 16 GB laptop without GPU tops at Zenith+.
- Studio: `recommendStudioPack`/`drawPack` read `info.ramGB` and `gpuState`; desktop adds `vramGB` so Pro/Qwen-Image
  are offered only where they finish in reasonable time (P3).

## 6. GPU backends (كارت الشاشة)

| OS | Shipped engine | Covers | Later |
|---|---|---|---|
| Windows x64 | Vulkan + an AVX2 CPU path (any x64 CPU from 2013 on; the per-generation CPU variants fail to compile with clang-cl at the pinned commit — revisit on the next engine bump) | NVIDIA, AMD, Intel GPUs; any CPU | optional CUDA download (~500 MB of CUDA runtime) for NVIDIA speed; Windows on ARM build |
| macOS arm64 | Metal (embedded library) | M1–M5 | Intel Macs: CPU-only x64 build if wanted |
| Linux x64 | Vulkan + all CPU variants | most GPUs (Mesa / NVIDIA driver) | CUDA, ROCm as optional packs; arm64 build |
Engine start order: GPU (`--fit on -fa auto`) → if it fails to start, CPU (`--device none`, 8-bit KV cache,
flash attention). Verified both paths on CPU-only machines.

## 7. Memory rules
- One model at a time (`-np 1`), `--cache-ram 0` (big models were killed otherwise, see CLAUDE.md).
- Refuse to start a model whose file > 85% of (VRAM + free RAM) with a clear message (P2; the phone's guard).
- Picture engine and chat model not loaded together when they would not fit: chat engine is stopped while
  Studio draws on machines below 32 GB (P3; same as the phone).

## 8. Auto-update (التحديث التلقائي)
`electron-updater` reading GitHub Releases of this repo (P4). macOS only auto-updates **signed** apps;
Windows works unsigned but SmartScreen warns. Updates download in the background, install on quit,
and are skipped while the offline lock is on.

## 9. Licensing / billing hooks
The web app already asks `window.ATTUNE_STORE` (billing.js) and has `devMode`. Desktop has no Play Store:
- P4: sell through a web checkout (Ali picks: Paddle / Lemon Squeezy / Gumroad / Stripe) that emails a licence
  key; the app verifies an **offline-checkable signed key** (Ed25519 public key in the app) → `ATTUNE_STORE.owned()`.
  No account, no phone-home needed after activation. Keys can be checked once online for revocation (optional).
- Same SKUs as Android so the Business/ERP gates in the page work unchanged.

## 10. Privacy statement (draft — wording is Ali's call)
"Attune runs its models on this computer. Your chats, documents, photos and books never leave it. The app
connects to the internet only when you download a model or picture pack (from Hugging Face), check for an update,
or use a feature that needs the web (search, food database) — each is listed in Engine → Connections, and the
Offline lock turns all of them off. The model engine listens only on this computer (127.0.0.1) and needs a
secret key that changes every start."

## 11. Signing / notarisation — what Ali must provide later (no secrets exist yet)
| Platform | What to buy / set up | GitHub secrets (electron-builder names) |
|---|---|---|
| macOS | Apple Developer Program ($99/yr), a "Developer ID Application" certificate exported as .p12 | `CSC_LINK` (base64 .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` |
| Windows | Either Azure Trusted Signing (cheapest, ~US$10/month, needs identity validation) or an OV/EV code-signing certificate | Trusted Signing: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (+ account/profile names in config). Certificate: `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` |
| Linux | Nothing required (optional GPG signature of the AppImage) | — |
| Updates | GitHub token with `contents: write` for releases | built-in `GITHUB_TOKEN` is enough |
Until then: Windows shows "Windows protected your PC → More info → Run anyway"; macOS needs right-click → Open
(or `xattr -dr com.apple.quarantine Attune.app`).

## 12. Phased roadmap (with sizes)
| Phase | Content | Size (rough) |
|---|---|---|
| **P1 (done)** | Shell, bridge subset (chat, models, engine, info, stash, save, air-gap), CI build + smoke on 3 OSes, unsigned installers | ~1 day |
| P2 | Model-memory guard + `fitGB`; doctor/speed; search/fetchText/news; PDF + converters (pdf.js, pdf-lib, printToPDF); speak; reminders as notifications; food pack; models folder setting; desktop-sized layout check of every screen | 4–6 days |
| P3 | Studio: sd-cli builds (Vulkan/Metal/CUDA) + packs incl. Qwen-Image on capable machines; listen via whisper.cpp; optional CUDA engine download | 5–8 days |
| P4 | Signing + notarisation, auto-update, licence keys / ATTUNE_STORE, store pages (Microsoft Store / Mac App Store optional — sandbox rules restrict spawning binaries, so direct download first) | 3–5 days + Apple/Microsoft review time |
| P5 | Desktop-only strength: bigger default tiers (Apex, Everest), longer context, parallel background work (draft checks) when VRAM allows | ongoing |

## 13. What is NOT tested yet
- Real GPUs (Vulkan on NVIDIA/AMD/Intel, Metal on a Mac): CI runners have none, so only the CPU path ran. Metal
  should work on GitHub's M-series runners only if they expose the GPU (they report a paravirtual device; see the
  "Engine sees which devices" step).
- Signed / notarised builds, auto-update, Windows SmartScreen flow.
- Every screen of the page at desktop size (the UI is phone-first).
- Large models (> 4 GB) download + resume on a real network.

## 14. Decisions for Ali (قرارات ليك)
1. Product name on computers ("Attune" / "Attune Desktop" / other), app icon for Windows/macOS, window colour.
2. Layout on a big screen: (a) phone-width column centred, (b) wide two-pane (chats list + chat), (c) phone layout
   stretched. Recommendation: (b), built later in P2 with mock-ups first.
3. Shell: Electron recommended (above). Confirm, or ask for the Tauri comparison build.
4. Price and how to sell on desktop (one-time vs subscription; Paddle / Lemon Squeezy / Gumroad / Stripe).
5. Which signing route on Windows (Azure Trusted Signing vs certificate) and enrolling in the Apple Developer Program.
6. Whether to offer an optional NVIDIA (CUDA) engine download (+~0.5 GB, faster on NVIDIA cards).
7. Privacy statement wording (§10).

## How to run it (from the repo)
```
cd desktop && npm install
# engine: put llama-server (+ its libs) in desktop/engine/cpu/  or  set ATTUNE_LLAMA_DIR=/path/to/bin
npm start
# tests
node test/unit.js
ATTUNE_LLAMA_DIR=../tests/build-dl/bin xvfb-run -a node test/smoke.js /home/user/models/q08.gguf
```
