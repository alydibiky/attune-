# Scan anything — one model per job, working together (Ali, 23 Nov 2026)

> Ali OK'd **OK-SS** (SS1 📎 Scan · SS2 new screenshots read by themselves · SS3 Share → Attune · SS4 every country and format):
> "will be good if done right and accurate, accuracy is everything". Then: **"Add a specific model for each thing and make them work together."**
> The look is the OK'd combined page: https://claude.ai/artifact/FBuHWjYDtYYC2uoaoPPsK7 (docs/mockups/quick-input-combined.html, block B).

## The chain (each job its own model; code checks every number at the end)

| # | Job | Model | Why this one | Size / where it runs | Licence |
|---|-----|-------|--------------|----------------------|---------|
| 1 | Camera photo of a paper → flat, cropped, upright | **ML Kit Document Scanner** (Google Play services) | finds the edges, fixes the angle, removes fingers / stains; no camera permission | ~0 MB in the APK (Play services), on the phone | Google ML Kit terms (free) |
| 2 | Is the photo good enough? | **code** (photocheck.js, since v9.9.23) | blurry / dark / glare / too far → "take a clearer photo" before anything is saved | — | ours |
| 3a | Read the text — Latin (English, French, card numbers, passport code lines) | **ML Kit Text Recognition (Latin)** — already in Attune | fast, exact on printed Latin | in the APK, on the phone | ML Kit terms |
| 3b | Read the text — Arabic (and Persian / Urdu) | **PaddleOCR PP-OCRv5 mobile: text finder + Arabic reader** (ONNX, ONNX Runtime is already in Attune) | ML Kit has no Arabic; PP-OCRv5's Arabic reader is ~8 MB | downloaded once when first needed (~13 MB), on the phone | PaddleOCR: Apache-2.0 (check the exact model card before shipping — §5.48) |
| 3c | Read the text — Chinese, Japanese, Korean, Hindi / Bengali | **ML Kit's Chinese / Japanese / Korean / Devanagari readers** | the 20 languages | Play services, on demand | ML Kit terms |
| 4 | What is it? (subscription · passport · visa · ID · bank card · receipt · ticket · prescription · nothing) | **code first** (the passport code lines, a card number's check digit, the 200 most used services, receipt words) → when code isn't sure: **the paper reader (6)** | code is exact and instant; the model only for the doubtful ones | — | ours |
| 5 | The fields of each kind | **one code reader per kind**: mrz.js (passports / visas / IDs of every country), Egyptian ID (exists), bank card (exists: last 4, expiry, network — never the full number, never the CVC), **subscriptions (new)**, receipts (Money's paytext.js), dates (deadlines.js) | every number checked: check digits, calendar dates, the amount must appear in the text | — | ours |
| 6 | What code can't read (an Arabic Shahid receipt, an odd layout, a photo of a screen) | **the paper reader: Qwen3-VL-2B-Instruct** (GGUF + mmproj, through the llama engine Attune already has); small fallback **Granite-Docling-258M** | reads the picture itself, Arabic included; answers in JSON | optional download (~1.5 GB, or ~0.2 GB for Docling), on the phone | Apache-2.0 (Qwen3-VL family; Granite-Docling: IBM, Apache-2.0) — confirm on the model cards |
| 7 | The judge | **code** | the model's answer is kept only when its amount / number / date is in what the text readers read (or passes its check digit); otherwise Attune asks ONE question | — | ours |

Sources: PaddleOCR ONNX models (huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx, huggingface.co/monkt/paddleocr-onnx), ML Kit Document
Scanner (developers.google.com/ml-kit/vision/doc-scanner), Qwen3-VL-2B GGUF (huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF), Granite-Docling
(ibm.com/new/announcements/granite-docling-end-to-end-document-conversion). Arabic OCR fine-tunes seen (Qari-OCR, Apache-2.0, on Qwen2-VL-2B) —
a candidate to swap in for job 6 if Qwen3-VL-2B reads Arabic receipts badly in the trials.

## Order of work (each stage: 20 languages, phone + computer, 10,000 HARD cases per reader, full suite, APK)
- [~] **S1** the subscription reader `web-src/subread.js` DONE (v10.9.4 work: 10,000 HARD composed 100 %, held-out seed 2 100 %, 92 % shapes; first honest run 78.6 % → bugs fixed in the reader: currency must touch the number, R$ ≠ $, French «le» ≠ LE, "Microsoft 365" ≠ a price, VAT 14 %, "MONTHLY"/"GBP" ≠ a quantity; test changes said honestly: a screen with nothing showing it is yours must ASK, currency signs kept by the hardener). The conductor `web-src/scanread.js` (jobs 4, 5, 7) is written: passport/visa/ID (mrz.js) → bank card (asks before keeping) → Egyptian ID → subscription → receipt (paytext.js) → date → nothing. **Next in S1**: tests/scan/kinds.mjs — 10,000 MIXED papers (each kind + look-alikes: a card's number next to a subscription, a receipt with a date, a passport photo with a booking), HARD, each must land in the right kind with the right fields; a flight / booking reader for Trips (deadlines.js reads expiries, not bookings).
- [ ] **S2** SS1 the 📎 Scan button (Home box + Papers) → the "What I understood" card → filed with Undo; SS3 Share → Attune into the same card.
- [ ] **S3** the Arabic text reader (job 3b) in Kotlin (ONNX Runtime) + the extra ML Kit scripts (3c).
- [ ] **S4** the paper reader (job 6): model download in Settings → Models, the JSON prompt, the judge (7); trials on real screenshots (tests/trials).
- [ ] **S5** SS2 new screenshots read by themselves (the switch in Settings; Done for you with Undo; card photos always ask).
- [ ] **S6** the camera path through the Document Scanner (job 1).
- [ ] SS4 coverage, in Ali's order: subscriptions, passports, bank cards → visas, residence cards → national IDs country by country.
