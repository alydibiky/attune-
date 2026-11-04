# Studio — archived 4 Nov 2026 (v9.1)

Pictures made on the phone (FLUX.2 klein 4B and others, stable-diffusion.cpp), upscale, the photo editor like the Honor Gallery
(tap to erase, passers-by, cut out, enhance, change), Eraser (28 MB) and Eraser HD (LaMa, 208 MB).
Removed because Attune's brand is the life & work organiser (VISION.md, 4 Nov) — and it restarted Ali's phone once (v8.0).

## What is here
- `web-src/` — studio.js, studio-ui.jsx, photoedit.js, photoedit-ui.jsx, erase-ui.jsx (moved with git mv)
- `attune-routes.jsx.txt` — the `mode === "studio"` screen cut out of web-src/attune.jsx
- `tests/` — its unit and browser tests

## What stayed in the app (dormant)
- Android: `ImageEngine.kt`, `ImageRun.kt`, `Eraser.kt`, `PhotoSmart.kt` and the NativeBridge methods (imagine, upscale, erase…)
  stay compiled but nothing can call them; the picture engine (`libattune-image*.so`) is no longer built: in
  `.github/workflows/build-apk.yml` the steps "Cache the picture engine" and "Picture engine for Studio" have `if: ${{ false }}`.
  (They can be removed fully in a session that can compile Android.)
- `attune.jsx`: the Studio entry in MORE_TOOLS stays, hidden by `web-src/removed.js`; `STUDIO_OFF = true`; the native call
  "imagine" is refused.

## To bring Studio back
1. `git mv archive/studio/web-src/* web-src/` and move `archive/studio/tests/*` back to `tests/` (unit tests to `tests/unit/`).
2. Remove "studio" from `web-src/removed.js`; in attune.jsx set `STUDIO_OFF = studioPaused(NATIVE)` again.
3. attune.jsx imports: `import { StudioPage } from "./studio-ui.jsx";` and `import { enhanceWaitMs } from "./studio.js";`;
   paste the route from `attune-routes.jsx.txt` back into the route chain; restore the "attune-studio" event
   (`setStudioIn(e.detail || null); setMode("studio")`), the Learn page's `illustrate` prop and the native "imagine" check
   (`studioPaused(NATIVE)`) — see git history of web-src/attune.jsx at the commit "Archive Studio and Business".
4. chat.jsx: the "Draw it in Studio" card (looksLikeImageRequest / pictureSubject from studio.js) and its "studio" card action.
5. tools-hub-ui.jsx: the Studio family filter (`!studioPaused(...)`); guide-demo.js "create" goal.
6. build-apk.yml: delete the two `if: ${{ false }}` lines. Then `bash web-src/build.sh` and run all tests.
