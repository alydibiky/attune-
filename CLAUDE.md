# Attune — read this first (every session)

0. Read **`APP_HANDOFF.md`** first: the whole app on one page (what it is, every feature and its files, rules, what is open).
1. Read **`NEXT_SESSION.md`**: Ali's full, current problem list (24 items, grouped A–I; Ali keeps adding more) and the prompt
   for the session. Work through all of it with a task list.
2. Read **`HANDOFF.md`** §0 ("START HERE") and the latest section (§5.37) for how the app is built and tested.

## Where things stand (18 Oct 2026, v6.35 — HANDOFF §5.44–§5.82 (latest: §5.82 v6.35 Ali's 18 Oct notes: plate scan, Core Max+ desktop-only, NPU declared, Solve one by one, Scout year, Arabic letter-spacing, Knowledge hidden; his six choices in NEXT_SESSION AA; §5.81 v6.34 Ali's phone list: food labels, maid every Saturday, Money Watch, Engine + Food sheet minimal, Learn ahead, Fleet issue; §5.80 Mind A (wall) + Code B (talk to a coder); §5.79 v6.32 the joint release with Edit a PDF and the Overpaying check; §5.78 roadmap items: Scout night, Learn extras, FR/ES/TR, Attune keyboard; §5.77 Fleet & rentals + Business v2; §5.76 Deep answer, Fit & Food minimal B, Create 6 tabs; release checklist RELEASE_6.29.md); Ali: everything optimised for phone AND desktop; DESKTOP APP (Windows first, Claude/ChatGPT layout) in progress: HANDOFF §5.60; packs must be commercial-safe (§5.48); Ali's latest lists: NEXT_SESSION.md sections U, V, W, X (v6.32: Ali's phone + release checklist, what is open) Y (v6.33) Z (v6.34) and **AA (newest: v6.35, Ali's six choices)**)
- **Read `ROADMAP_2026-10-13.md` (the direction agreed 13 Oct: sync, device levels, code-first, redesign, Life layer).**
- Read **`PLANS_2026-10-02.md`** too: the converter / Fit / heat / Business plans and exactly what is left.
- `main` = branch `ccr-a0eb3595-e2c7a7` = v6.35 (versionCode 96). All test files pass (`bash tests/run_all.sh`).
- Every other branch (business-extras, fit-home, pdf-reader, studio-preview, converter-polish, knowpack-wire, and the five 17 Oct thread branches: project-thread, pdf-edit-converter, overpaying-finder, business-erp, roadmap-items) is merged.
- Arabic UI = simple formal Arabic (Ali's choice, 4 Oct 2026); Egyptian only where code reads what people type.
- Web app: edit `web-src/`, then `bash web-src/build.sh` → `app/src/main/assets/www/index.html` (commit both).
- Real-model trials: `tests/trials/max.mjs` (sections: deal, xray, action, fit, math, travel, business, code,
  translate, instant, mind, assistants, photos; `MMPROJ=` is needed for photos; `TRIAL_PORT=` picks the
  llama-server port). Run llama-server with `--cache-ram 0`, or big models get killed for memory.
  Reports: `tests/trials/max-<model>.md`.
- Converter fidelity bench: `tests/convert/run.sh` (PDF→Word, Word→PDF, slides→PDF).
- Playwright in cloud sessions: `PYTHONPATH=tests/pwshim:tests` (run_all.sh sets it).

## Ali's standing rules
- Never commit `*private-key*.json`; never change `app/attune-test.keystore`.
- Subjective choices (look and feel, layout, colours, names, wording, which of several good designs): don't decide alone.
  Show Ali 2–4 concrete options (a screenshot, mock-up or short description of each, with a recommendation) and build
  the one he picks. Objective bugs and measurable fixes: just fix them.
- Targeted fixes, no rewrites — except the UI/UX rework and the Fit & Food redesign he asked for.
- Explain every step simply, with technical terms in English AND Egyptian Arabic.
- Commit as Claude <noreply@anthropic.com>; no model names in commits or code.
- Run ALL tests (`bash tests/run_all.sh`) before pushing to main; push to main (`git push origin HEAD:main`)
  and to the branch.
- Watch "Build the APK" on main and give Ali the run link.
- Answer every point he asks; use a task list; don't stop to ask unless something is irreversible.
- Keep searching for ways to make the app smoother and every model lighter, faster and more accurate
  without compromising anything.
