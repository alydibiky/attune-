# learn — archived 4 Nov 2026 (v9.1)

Ali's decisions (FEATURES.md, 4 Nov evening). The screen(s) cut out of web-src/attune.jsx are in `attune-routes.jsx.txt`;
`web-src/` holds the files only this feature used (moved with git mv). `web-src/removed.js` lists its id.

To bring it back: `git mv archive/learn/web-src/* web-src/`, remove its id(s) from removed.js, put its import(s) back in attune.jsx
(see git history at the commit "Archive Deal Check, Learn daily, Homework Coach, the Code page, Video tools") and paste the route from
attune-routes.jsx.txt before `) : mode === "write"`; then build and run all tests.

Learn daily (a lesson a day, FSRS review, courses) and Homework Coach — maybe "Attune Learn" later (row 53/54). The Learn PAGE was
in daily-ui.jsx, which stays because the morning news (NewsPage) lives there too — only its route was cut. Chat answers homework itself.
