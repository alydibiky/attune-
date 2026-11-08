# Follow-ups FU1 — archived 8 Nov 2026 (v9.9)

FU1 = one feed: Today · This week · Later, a tick box on each row (Ali picked it on 8 Nov, it shipped in v9.8.4, then he said
"cancel FU1, tell me a better option" and picked **FU6 — Attune asks, you answer**).

- `timeline-ui.jsx` here is the whole FU1 page as it was in v9.8.4.
- Its logic stays live in `web-src/timeline.js` (`feedOf`, `actionOf`, tested in `tests/unit/v980fu1.test.mjs`) — FU6 uses it too.

To bring FU1 back: copy `timeline-ui.jsx` over `web-src/timeline-ui.jsx`, run `bash web-src/build.sh`, and restore the FU1 blocks of
`tests/e2e_v960picks.py` / `tests/e2e_v740timeline.py` from git (commit "v9.8.4: Follow-ups FU1").
