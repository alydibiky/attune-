# Everything built in this session (2–3 Oct 2026) — checklist for Ali

Legend: ✅ done and tested here · 🟡 done, but part of it can only be proven on the phone / on GitHub · ⬜ not done yet

## Testing switches (Ali: "open all pro options so I can test them")
- ✅ Everything unlocked for testing: Pro, Yusr Premium (the receipt photo), Business systems. The Plan screen's "See it as a Free user" turns them off.
- ⬜ **Before release set to false:** `TESTING_ALL_PRO` (billing.js), `TESTING_ALL_PREMIUM` (yusr/index.new.html), `setTestingOpen` (erp.js).

## Engine and answers
- ✅ Model wakes by itself when needed; no more "No model" after backgrounding; chip "Asleep — wakes when needed" (items 2/19/20)
- ✅ GPU half-failure falls back to CPU; trim-memory only releases the model when really needed; WebView timers pause in background
- ✅ Exact-length writing rules ("exactly 50 words", table-only) checked in code (item 21)
- ✅ Yusr: payment direction and person detection fixed (false positives removed)
- ✅ Coding: a stuck write→run→fix loop restarts once from scratch with a different approach
- ⬜ Coding next: plan-first prompt, two candidates keep-the-passing-one, review/refactor of pasted code, measure on the real-model trials
- ⬜ Heat/speed phase 2 (threads, draft model, thermal), storage ideas (items 1/3), state restore after process kill, answer-quality items 4–8, Studio (9), Mind (11), Money (12), max-test of big models (15), idea verdicts (22)

## Billing page
- ✅ "Plans & billing": plans first + one card per product + compare table; Money included in Pro

## Business / ERP ("Shop & trading books") — flagship: general trading & shop
- ✅ Finance core: money in piastres, VAT 14%/0%/exempt, table tax, withholding, gapless numbering, credit notes, double-entry ledger, ageing, moving-average stock, tamper-evident audit log (golden tests)
- ✅ Dashboard home + Sales / Purchases / Stock / Money / Reports; bilingual invoice/quote/statement (PDF + Word), WhatsApp share, overdue reminders, backup, PIN, sample shop
- ✅ Sample shop fixed (no negative bank, a sale today)
- ⬜ ETA e-invoice JSON export, automatic encrypted backup, price lists/delivery notes, roles, multi-currency, industry packs

## Converter (PDF → Word etc.)
- ✅ On Ali's real PDF: table at full text width with light borders, bold labels kept as paragraphs, wrapped lines merged, real sub/superscripts, stroked rules keep their colour
- ✅ RTF euro sign fix (was failing on main)
- ⬜ The missing "Y_X/S" symbol (needs picture-based reading), spacing/margins polish, Word→PDF polish, ODT/RTF/Excel readers

## Skills ("no basic version")
- ✅ Skills page: create, catalogue (12 ready-made, with checklists), import/export, on/off, /commands, auto-pick by description
- ✅ Skills v2: instructions up to 6,000 chars · checklist · facts library (only matching paragraphs used) · offline script in the locked sandbox (shown in full before you keep it) · Claude-style SKILL.md (`description:`) imports
- ⬜ Second "check the answer against the checklist" pass (costs a model run), skills calling skills, shared skill store

## CV / Resume
- ✅ Build a CV (English or Arabic), ATS-safe and Modern layouts with a switch, themes, check list of what is missing, PDF / Word / TXT, saved copies per job
- ✅ Import an old CV (PDF, Word, pasted text)
- ✅ "Edit or improve my CV": say what to add/change and/or "make it professional"; refuses invented numbers and lost jobs/schools; keeps skill groups; preview then undo
- ✅ Fixed: Modern button did nothing (label bug); Modern sidebar now fills the page; HTML-injection closed

## Fit & Food
- ✅ 25,428 recipes (148 hand-written + 25,280 generated from real foods, calories always computed, English + Egyptian Arabic names, searchable in 40 ms)
- 🟡 Offline food pack (target 1,000,000+ packaged foods): builder, GitHub job, native download, IndexedDB store, search by name / Arabic / barcode, settings card. **The job is running now — its summary will show the real count; if it is under 1,000,000 I will say so.**
- ⬜ Photo fallback chain + shorter prompt (item 10), Fit home redesign (item 14), bigger curated recipe set

## Ask a PDF (reader + chat with the PDF)
- ✅ Opens PDF, Word, PowerPoint, e-book, web page, text; scanned pages read by the AI
- ✅ Chat answers from the right pages only, page chips you can tap, citations checked in code (invented pages removed), "not in the document" without guessing, "explain page 4", summary/outline plan
- ✅ Reader: real page picture + text, next/previous, jump, word search with hits
- ✅ A PDF attached in Chat opens here (the attach button now accepts documents)
- ⬜ Highlight on the picture itself, keep documents between sessions

## Models
- ✅ Research written in PLANS_2026-10-02.md: Qwen3.5 stays; MiniCPM5-2B has no Arabic; Ling-3.0-tiny to measure; GLM-4.7-Flash / Kimi Linear too big
- ⬜ GitHub job to resolve file names and run the real-model trials on Ling-3.0-tiny and MiniCPM5-2B; add only if better than the same-size Qwen

## Quality work
- ✅ Independent code review found 7 real bugs — all fixed with tests
- ✅ Screens checked at phone size: Skills, catalogue, CV, Books, Fit, pack card, recipes, Ask a PDF
- ✅ Full test suite green on the tested commits (last full run: 1 failure, a Latin-letter check in the Arabic menu — fixed, re-run alone, passes; all unit tests pass)

## Still waiting on you / not started
- ⬜ Item 25 **Shelf (رف)** notes — waits for "start"
- ⬜ UI/UX rework step by step (item 13), Add-any-model (24), plugins stage 2

## GitHub runs (status when this file was written)
- ✅ Build the APK, run 70 (Skills, CV, recipes) and run 71 (Skills v2): success
- 🟡 Build the APK, run 72 (food pack + Ask a PDF + fixes): in progress — this one compile-checks the new Kotlin
- 🟡 Build the offline food pack, run 1: in progress
