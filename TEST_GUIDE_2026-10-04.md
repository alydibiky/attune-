# Attune — test guide and status (4 Oct 2026)

**The build to install:** GitHub → Actions → "Build the APK" → run 90 (green) → download the APK artifact:
https://github.com/alydibiky/attune-/actions/runs/37171215004
(Commit `f345824` on `main`. All unit tests and all browser tests passed on this commit. Nothing in it has run on a real phone yet — that is what you are testing.)

Legend: ✅ in this build · 🟡 in this build, but only proven on GitHub/this machine, not on a phone · 🔧 being built now (not in this build) · ⬜ not started · 👤 only you can do it

---------------------------------------------------------------------------------------------------------------------------------
## 0. Before you test (2 minutes)
1. **Unlock Pro for testing:** More → scroll to the bottom → tap the **version number 7 times** → Plan shows "Testing build" (tap 7 more times to see the app as a customer).
2. **Reinstall what you want to be faster:** models you installed earlier are the standard builds. Reinstall a chat model (Engine → install) to get its faster build (MTP). Reinstall the **Turbo** picture pack to get the tiny decoder.
3. Send me the **Engine log** after a slow, hot or broken moment (Engine → Send log).

---------------------------------------------------------------------------------------------------------------------------------
## 1. What is in the build — and how to test it (in this order)

### 1.1 Chat and the 12 languages ✅
- Write in each language and check the answer comes in the same language: English, Chinese, Hindi, Spanish, French, Arabic, Bengali, Portuguese, Russian, Urdu, Indonesian, German.
- Try "answer in French: …" / «اشرحلي بالعربي» — it follows what you ask for, not what you wrote in.
- Voice input and read-aloud use the language of the message.
- **Known limit:** the menus/buttons are still English + Arabic only; only the chat itself works in the 12 languages.

### 1.2 Models and speed ✅/🟡
- Core / Zenith / Glow / Spark are the Qwen family; **Everest XL** now uses the fast (MTP) build of the same 35B model.
- Look at: words per second, heat after 5 minutes, "faster writing (MTP)" setting in Engine → Speed.
- **RAM changes (🟡, untried on a phone):** smaller work batches; a model slightly over your RAM budget now runs from storage instead of being refused (status line says so).
- **Heat (🟡):** if the phone gets very hot the app waits up to 20 s before a new answer and uses fewer threads at the next start; the Speed doctor shows the warning.
- Measured on the lab machines (not phones): Qwen3.5 4B 156/173 on the big test, Gemma 4 E4B 163/173 (bigger file, 5 GB).

### 1.3 Coding ✅🟡
- Ask for a function with tests (e.g. "a function that returns VAT-inclusive price with tests", also in Arabic).
- **Measured:** about 2× faster (58 % fewer words, 57 % less time) with the same correctness on 10 hidden-test tasks. A second independent version of the function settles a disputed test after it fails twice.

### 1.4 Fit & Food ✅🟡
- **Photo recognition:** one 60-second limit with fallbacks (barcode → full look → quick names → your typed note → clear message). 🟡 The **fast photo path** (names the food in ~0.2 s in the lab): My plan → **Fast photo recognition** → Get it (~100 MB) → take a photo. Needs the download.
- **Country:** My plan → settings → "Food from" → pick a country (35 countries, 944 dishes). Suggestions, recipes, search, typed/spoken logging and photo hints follow the country.
- **Offline food pack** (1,037,651 foods): My plan → Offline food pack → download → test search and barcode in airplane mode.
- 25,428 recipes; Egyptian dishes first.

### 1.4b Studio (pictures) ✅🟡
- **Turbo** (small phones, default): tiny decoder → ~37 s instead of 63 s (lab machine).
- **Turbo+ (working name)**: SDXL-Turbo, ~17 s a picture, 3.95 GB, phones with 8 GB+ RAM.
- **Studio Ultra (working name)**: Qwen Image 2.1, 9.9 GB, 12 GB+ RAM — runs, but ~10 minutes a picture on a phone CPU (practical on a computer GPU). Licence "Qwen research": check before paid use.
- **"Recommended for your phone"** line with the reason and a time estimate; the first download is preselected.
- Please time one picture on each pack you try and tell me.

### 1.5 Ask a PDF, Skills, CV, Business books, Plans ✅ (from earlier today — see CHECKLIST_2026-10-03.md and RELEASE_6.11.md for the 10-step smoke test)

### 1.6 Desktop 🟡 (separate from the phone build)
- A working **Electron prototype** exists (Windows, macOS, Linux builds on GitHub: run 37169225266). Chat with a downloaded model works headlessly; the rest of the screens are phase 2. Details: `DESKTOP_PLAN.md`.

---------------------------------------------------------------------------------------------------------------------------------
## 2. Not in this build yet

| Item | State | Notes |
|---|---|---|
| **Shelf (رف)** — notebook-style notes, Option A cover grid, every feature | 🔧 an Opus agent is building it | covers + own photo cover, rename/delete/reorder/move, search, reminders, Mind link, migration of old notes, rich text, checklists, lock, archive/trash, tags, export, backup (feature matrix coming) |
| **Knowledge packs** (retrieval): facts answered right went 31→99 of 104 (0.8B), 69→104 (4B) | 🔧 core written and tested, **not wired into the app** | needs embedder download (0.44 GB), a vector store, a screen; free word-search version first |
| **Studio fast preview** (a 384 px draft in ~10 s, then the final) | ⬜ | needs your look choice |
| **Saved prompt cache on disk** | ⬜ | gives zero reuse on our engine version (needs an engine update) |
| **Desktop phase 2** (all screens, Studio, voice, converters), signing, updates, licence keys | ⬜ | 3–6 days of work + your accounts |
| Per-tier model upgrades | ⬜ | only Everest XL changed; 4B IQ4_XS (−1.8 GB RAM) pending a re-measure; nothing else beat what we ship |
| UI/UX rework (13), Fit home redesign (14), Add-any-model (24), plugins stage 2 | ⬜ | each needs your look choices |
| Converter: missing "Y_X/S" symbol, Word→PDF polish, ODT/RTF/Excel readers | ⬜ | |
| Business: ETA e-invoice JSON, automatic encrypted backup, price lists, roles, multi-currency | ⬜ | |
| Skills: second "check against checklist" pass, skills calling skills | ⬜ | |
| Ask a PDF: highlight on the picture, keep documents between sessions | ⬜ | |
| Coding: plan-first prompt, review/refactor of pasted code | ⬜ | |
| Big-model max-test (Apex/Apex+/Everest on a 64 GB machine) | ⬜ | cannot run on the free test machines (16 GB) |

---------------------------------------------------------------------------------------------------------------------------------
## 3. Decisions waiting for you (look, names, choices)
1. **Names:** "Turbo+", "Studio Ultra", "Storage Boost" and the desktop app name/icon are placeholders.
2. **Studio:** how the "Recommended for your phone" line and the new choice chips look; whether to add the fast preview.
3. **Apex+:** keep Gemma 4 31B, or test Qwen3.8-27B (new, Aug 2026, ~14 GB) — I can compare when a 64 GB machine is available.
4. **Core:** use IQ4_XS instead of Q4_K_M (saves ~1.8 GB RAM, same score) — after one more measurement.
5. **Knowledge packs:** which first — Egypt facts, engineering/cranes, or your own documents; make the 0.44 GB embedder an optional download?
6. **Desktop:** layout on big screens (I recommend two panes, mock-ups first), confirm Electron, price model and payment provider, optional NVIDIA engine download.
7. **Qwen "research" licence** for Studio Ultra, and the Fanar/ALLaM Arabic models (not adopted).

## 4. Only you can do (👤)
- **Play Store:** signing keystore as GitHub secrets, store listing (screenshots, privacy policy URL, data-safety form), product IDs in Play Console.
- **Before release:** turn the testing switches off (already OFF on fresh installs; developer mode is hidden behind 7 taps).
- **Desktop:** Apple Developer account ($99/yr) and its secrets; Windows signing route (Azure Trusted Signing or a certificate).
- **Test on your real phone** and send the Engine log + what felt slow/hot/wrong.

## 5. Honest limits to keep in mind while testing
- Nothing in 1.2, 1.4 (fast photo path), 1.4b has been tried on a phone: expect surprises in RAM, heat and speed.
- ChatGPT-level pictures are not possible on a phone model; Turbo+ gives clean single-subject pictures in ~20 s; text inside pictures, busy scenes and hands will still fail often.
- The Opus agents were cut off twice by the usage limit; all their work was committed and resumed, nothing was lost.
