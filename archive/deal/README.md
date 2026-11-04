# deal — archived 4 Nov 2026 (v9.1)

Ali's decisions (FEATURES.md, 4 Nov evening). The screen(s) cut out of web-src/attune.jsx are in `attune-routes.jsx.txt`;
`web-src/` holds the files only this feature used (moved with git mv). `web-src/removed.js` lists its id.

To bring it back: `git mv archive/deal/web-src/* web-src/`, remove its id(s) from removed.js, put its import(s) back in attune.jsx
(see git history at the commit "Archive Deal Check, Learn daily, Homework Coach, the Code page, Video tools") and paste the route from
attune-routes.jsx.txt before `) : mode === "write"`; then build and run all tests.

Deal Check ("Before you pay or sign": the real cost, market price, scam signs, contracts) — folded into Money Guardian (row 50).
