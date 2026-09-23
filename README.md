# Attune for Android

An AI assistant that runs **entirely on the phone**: llama.cpp's own engine is
built into the app, the model is downloaded once, and after that nothing needs
a connection. Web lookup (DuckDuckGo, or Brave with your key) is optional and
off by default; an **offline lock** switches every network path off.

## Two ways to build the APK

### A. GitHub builds it for you (recommended)

No Android Studio, no NDK, no Windows path problems. GitHub's Linux machines
build the exact configuration llama.cpp's own release pipeline uses.

1. On github.com: **New repository** → name it `attune` → **Public** → **Create**.
2. **uploading an existing file** → drag in *everything in this folder*
   (including the hidden `.github` folder — turn on "show hidden files" if you
   can't see it) → **Commit changes**.
3. Open the **Actions** tab. *Build the APK* starts by itself. The **first run
   takes about 20-30 minutes** (it compiles the engine for every ARM chip
   generation); later runs take a few minutes.
4. When it is green: open the run → **Artifacts** → download `attune-apk` →
   unzip → install the `.apk` on the phone.

### B. Android Studio on your computer

1. **Put the project at a short path with no spaces**, e.g. `C:\attune`.
   The engine has deeply nested source files; long Windows paths (over 260
   characters) break the native build.
2. Double-click `app\src\main\cpp\fetch-llama.bat` (needs
   [Git for Windows](https://git-scm.com/download/win)). It downloads llama.cpp
   pinned to the tested version. On Mac/Linux: `bash app/src/main/cpp/fetch-llama.sh`.
3. Android Studio → **Settings → Languages & Frameworks → Android SDK → SDK
   Tools** → tick **Show Package Details** → under **NDK (Side by side)** tick
   `29.0.14206865`, under **CMake** tick `3.31.6` → **Apply**.
4. **File → Open** the project folder → let Gradle sync.
5. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**. The first build
   compiles llama.cpp and takes a while; later builds are fast.

## First run on the phone

1. Open Attune → **Engine**. It reads the phone's real memory and recommends
   the strongest model that fits (e.g. Qwen 3.5 9B on a 12 GB phone).
2. Tap **Install** — on Wi-Fi; progress is shown and it resumes if interrupted.
3. When it says **Running**, ask something. Answers stream in as they are
   written; **Stop** ends one early.

## What was verified before handing this over

- **Engine**: the same CMake configuration was built on a desktop (shared
  libraries + every CPU variant) and a 39-check test ran against it through the
  real JNI entry points: fastest CPU variant loaded exactly once, API key
  enforced, only the app's origin allowed, streaming with speed figures,
  identical output with a fixed seed, stop/restart, switching models, a bad
  model file failing without crashing the app.
- **Kotlin**: every source file compiles against the Android 35 API.
- **Web app**: built from source and driven in a phone-sized Chromium against
  the real engine: onboarding once, Engine screen, install with progress,
  streamed answers, Stop, DuckDuckGo lookup with sources, offline lock and
  network log, shared/selected text, Back — all passing, no script errors.
- **Not verifiable here**: the final Android compile and a run on a phone (no
  Android SDK/NDK can be downloaded in the build environment). The Android
  build settings follow llama.cpp's own Android release pipeline at the pinned
  commit. If the first build shows an error, send the first red message.

## Signing for the Play Store (later)

Without signing secrets the workflow makes a debug-signed APK — fine for your
own phone, not accepted by the Play Store. When ready, add four repository
secrets (Settings → Secrets → Actions): `ATTUNE_KEYSTORE_BASE64`,
`ATTUNE_STORE_PASSWORD`, `ATTUNE_KEY_ALIAS`, `ATTUNE_KEY_PASSWORD`.
**Back the keystore up** — lose it and the app can never be updated again.

See `NATIVE-ENGINE.md` for how the engine works, the model list, and privacy.
