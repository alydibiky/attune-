# Attune web app source

The Android app shows one self-contained page: `app/src/main/assets/www/index.html`.
This folder is what that page is built from.

- `attune.jsx` — the app; `chat.jsx` — the Chat home screen; `cycle.jsx` — the period tracker; `yusr/` — the Money ledger.
- `build/` — the page shell, icon set, and Tailwind input (CSS is compiled at build
  time; nothing is compiled in the phone's browser).

To rebuild: compile `build/tw.css` with Tailwind v4, bundle `build/entry.jsx` with
esbuild (aliases: react → build/react-shim.js, react-dom/client → build/reactdom-shim.js,
lucide-react → build/lucide-shim.js), then inline the CSS, React, the bundle and
`yusr/index.new.html` (base64, in `<script type="text/plain" id="yusr-src">`) into
`build/shell.html`. Or just ask Claude to rebuild it.
