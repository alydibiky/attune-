# code — archived 4 Nov 2026 (v9.1)

Ali's decisions (FEATURES.md, 4 Nov evening). The screen(s) cut out of web-src/attune.jsx are in `attune-routes.jsx.txt`;
`web-src/` holds the files only this feature used (moved with git mv). `web-src/removed.js` lists its id.

To bring it back: `git mv archive/code/web-src/* web-src/`, remove its id(s) from removed.js, put its import(s) back in attune.jsx
(see git history at the commit "Archive Deal Check, Learn daily, Homework Coach, the Code page, Video tools") and paste the route from
attune-routes.jsx.txt before `) : mode === "write"`; then build and run all tests.

The Code page (talk to a coder, CodeWorkbench in code-ui.jsx) — row 56. code-ui.jsx stays: Chat's code blocks use its RunBlock (Run),
and the Python sandbox (sandbox.js) checks Attune's own calculations. Only the route and the "Test & fix in Code" button were cut.
