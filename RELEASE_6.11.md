# Attune 6.11 — release candidate (3 Oct 2026)

## What customers get (new since 6.9)
- **Ask a PDF / اسأل ملفك** — open a PDF, Word, PowerPoint, e-book or web page; read it page by page; chat with it; every answer shows its page (tap to open it); invented page references are removed in code.
- **Skills** — your own AI recipes: instructions, a checklist, a facts library, an optional offline program; import/export `SKILL.md` files; 12 ready-made.
- **CV / Resume** — English or Arabic, ATS-safe and Modern layouts, import an old CV, "Edit or improve my CV" (no invented numbers), PDF / Word / TXT.
- **Business books** (shop & trading) — invoices, quotes, VAT 14% / withholding, stock, ageing, statements, bilingual PDF/Word, WhatsApp share, backup, PIN.
- **Fit & Food** — 25,000+ dishes in the recipe book (calories always computed from real foods); an offline food pack of ~900,000 packaged foods (name, Arabic name, barcode) you can download in the app.
- **Plans & billing** page; Money included in Pro.
- **Converter** — better PDF → Word fidelity (tables, borders, labels, sub/superscripts).
- **Coding** — a stuck write→run→fix loop restarts once with a different approach; real calendar day counts for date maths.
- **Engine** — wakes by itself, survives backgrounding, GPU fallback, safer memory release.

## Release switches (all verified)
| Switch | State |
|---|---|
| Developer mode / Pro unlock for testing | **OFF** on every fresh install. Hidden: tap the version number (More, bottom) 7 times to turn on, 7 more to turn off. |
| Yusr Premium test unlock | **OFF** (follows Attune Pro) |
| Business systems test unlock | follows developer mode |
| Version | 6.11, versionCode 72 |

## Still needs YOU before the Play Store
1. **Signing:** the GitHub build is unsigned unless the signing secrets are set (the workflow says so in its log). Add your upload keystore as repository secrets (see the workflow comments) — never commit a keystore.
2. **Play listing:** screenshots, privacy policy URL (the app collects nothing; web lookup is opt-in), data-safety form (no data collected).
3. **Prices / Play products:** the product IDs must exist in Play Console (`Billing.kt` lists them).
4. Run the **phone smoke test** below on the Honor and send the engine log if anything feels slow or hot.

## 30-minute phone smoke test
1. Install the APK from the latest "Build the APK" run. Open → Chat → ask a question → answer arrives.
2. More → tap the version number 7× → Plan shows "Testing build" → everything unlocked. (Tap 7× again to see the app as a customer.)
3. Engine → install your model → chat. Note speed (words per second) and whether the phone gets hot in 5 minutes.
4. More → **Ask a PDF** → open a real PDF → ask "summarise" and one specific question → tap a page chip → the page opens.
5. More → **CV** → Import my CV (your old PDF) → AI tab → "Edit or improve" → apply → export PDF.
6. More → **Skills** → Catalogue → add "Crane rental quote" → in Chat send `/quote 50 t crane 3 days`.
7. More → **Business** → Shop & trading books → Load the sample shop → make an invoice → share as PDF.
8. **Fit & Food** → My plan → Offline food pack → download "Egypt + most popular" → turn on airplane mode → search a product and a barcode.
9. **Studio** → draw one picture; note the time.
10. Send the engine log (Engine → Send log) and tell me what was slow, hot or wrong.

## Known limits (honest)
- Phone speed and heat were never measured on a real device in this build cycle; the engine log from step 3/10 is the data I need.
- The offline food pack holds ~900,000 products (Open Food Facts), not 1,000,000; only ~1,100 are tagged Egyptian.
- Ask a PDF keeps no history between sessions; page highlights are on the text, not on the picture.
- Faster writing (multi-token prediction) is measured on a PC CPU, not on the phone.
