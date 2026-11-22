# Persona 8 — the AI model tester

**What I did:** ran the real phone model (Core, a 4 B model at Q4, the same file the app downloads) on 4 CPU threads —
**about 5 words a second to write, 48 to read**, close to a mid-range phone. Three rounds:
1. **29 raw questions to the model alone** (facts, honesty, maths, food estimates, translation, JSON, Egyptian Arabic, safety,
   finding one line in a long text) — to see what the model does on its own.
2. **The same hard ones through the app's own safety nets** (maths as a program run on the phone, the food table check,
   the web-check offer) — what the person actually sees.
3. **The app's own trials** (`tests/trials/max.mjs`: 17 instant actions + 4 maths problems).

## What the model alone gets wrong (round 1: 21 / 29)
| Area | What happened |
|---|---|
| Egyptian culture | «مين اللي غنى أنا لك على طول؟» → a made-up singer and a made-up film, with full confidence |
| Arithmetic in its head | crane rental 3 × 4 days × 12,500 + 14 % → **19,000** (right: 171,000); "what percent do I save" → 20 (right: 25); ٢٢٠٠٠ ÷ ٩ → 2,222 (right: 2,444.44) |
| Food estimates | koshari and shawarma at **380 kcal per 100 g** (real ≈ 150–250); pizza, molokhia, basbousa right |
| Live facts | "it's very hot today, what do I do" → it **invented today's Cairo weather** (22–26 °C) and told the person it isn't hot |
| Egyptian Arabic | understands it well, but often answers in formal Arabic (الآن، لماذا، سوف) |
| Small slips | "Australia doesn't have a single capital" (it does: Canberra); in Arabic it said the 2030 World Cup is the next one after 2034 |
| Strong | refuses harmful requests; says "I don't know" about the future and your private data; translation keeps invoice numbers, amounts and dates exact; JSON on request; finds one line in ~1,200 words |

## What the person sees — after the app's code (round 2 and 3)
| Check | Before today | Now |
|---|---|---|
| 5 money word problems through Chat (crane, saving %, ٢٢٠٠٠ ÷ ٩, price before a discount, «ضعف فلوس أحمد») | 3 / 5 | **5 / 5** |
| The app's trials: instant actions | 17 / 17 | 17 / 17 |
| The app's trials: maths | 3 / 4 | **4 / 4** (after the fix below, checked through the app's own path) |
| Koshari estimated at 1,140 kcal a plate | shown as is | **pulled to 785** (halfway back to the food table) and marked checked |
| «مين اللي غنى …؟» | answered from the model's memory | **offers a web check** first (who sang / wrote / composed / directed …) |
| "It's very hot today" | invented the weather | helps with the heat, no invented numbers |

## Fixed now
1. **Arabic-Indic digits were invisible to the maths router** — «عندي ٢٢٠٠٠ هتتقسم على ٩ شهور» went to the model's head
   instead of being worked out as a program. `verify.js` now counts ٠–٩ as digits.
2. **"Price after a 10 % discount → original?"** — the program did 18,000 × 1.1 = 19,800. The solver is now told how reversed
   percentages work (÷ (1 − d) for a discount, ÷ (1 + d) to take VAT off). Now 20,000.
3. **`print("ANSWER: {full_months} months")`** without the `f` — the person would have seen "{full_months} months". Such a
   line is now made an f-string before it runs (`repairAnswerLines`). Now "21 months".
4. **AI food estimates are checked against the food table** (`fit.checkWritten`): when the table knows the same food and the
   AI is more than 1.6× away from it, the estimate is pulled halfway back (on a ratio scale) and marked `checked: "pulled"`;
   the person's own words (homemade, restaurant) still move it. Believable estimates are kept as they are.
5. **"Who sang / wrote / composed / directed …"** (EN + Egyptian Arabic) are now questions that get the "search the web?"
   offer (`research.needsWeb`), because that is exactly where the phone model invents.
6. **Two rules added to both chat prompts** (full and compact): which words are Egyptian Arabic (with one example), and
   "what the person says about their own day is true — never state live facts you can't see". Measured on 4 Egyptian
   messages: the invented weather is gone and greetings sound Egyptian; longer answers are still partly formal.
7. **The trials script now reads programs the way the app does** (`programFrom`), so it doesn't report failures the app
   doesn't have.

## Still open (Ali picks)
- **M-A Egyptian Arabic for real**: the 4 B model's Egyptian is limited. Options: (1) a small Egyptian-dialect fine-tune
  (LoRA) of Core from public Egyptian chat data — the biggest gain, a few days of work; (2) a code layer that swaps the most
  common formal words for Egyptian ones in short answers (لماذا → ليه, الآن → دلوقتي) — cheap, a little risky in quotes;
  (3) leave it. *Recommend 1, with 2 as a stop-gap.*
- **M-B Facts about people and culture**: even with the web offer, offline answers about Egyptian singers / actors / history
  are weak. Option: a small offline "who's who" pack (Wikidata, CC0 — commercial-safe) that the answer is checked against.
- **M-C Speed**: ~5 words a second means a 120-word answer takes ~25 s on this class of phone. The app already answers ~85 %
  of Home sentences by code in milliseconds; the next win is the router model idea (persona 4, B7).

## Tests added
`tests/unit/v860p8.test.mjs` — 7 checks (Arabic digits route, reversed % rule, food check pulled / kept / no table, web offer
for who-made-it questions, the f-string repair). Real-model scripts used: `scratchpad/p8/p8.mjs`, `vm.mjs`, `eg.mjs` (not in
the repo); the trial: `TRIAL_PORT=8199 node tests/trials/max.mjs math,action`.

## Re-run on the release build (22 Nov 2026, v10.8) — `tests/e2e_v1080personas.py`, phone 390 + computer 1366, English + Arabic
- Not re-run: this needs a real model on a phone or the trials machine (tests/trials/max.mjs) — the cloud session has only the tiny test
  model. The code layer around the model (numbers, money, reminders, pages) was re-run and is above in P1 / P6.

## Re-run on Ali's phone (22 Nov 2026, v10.8 APK, Blaze, his own screenshots) → fixed in v10.9
What he got, and what the code around the model now does (web-src/askguard.js; tests/askguard/gen.mjs 10,000 + held-out, unit
v1090askguard, e2e_v1090askguard.py phone + computer):

| # | His answer | Why | Now |
|---|---|---|---|
| 1 | «مفيش معلومات في بياناتك السابقة» (Abdel Halim) | a reference pack passage that wasn't about it was handed to the model, which was told to say «لا تحتوي معرفتك» | passages go only when one holds most of the question's words (`packsFit`); the model is never taught that line; if it still says it, the question is asked again on its own (`noKnowledgeLine`) |
| 2 | 42,750 ✓ (1 min) | — | the pack and notes lookups that cost time on every question are gone (below) |
| 4 | the jacket got the crane total (1.5 min) | "the price" made it a follow-up, so the crane sum + the jacket went to the code checker together | a message with its own numbers is its own question (`ownProblem`); an answer with the previous question's numbers and none of this one's is asked again without the earlier turns (`wrongQuestion`) |
| 5 | heat → web → Facebook posts | «النهارده» / «الجو» = "needs today's web" | tips are not news (`adviceNotNews`) — answered by the model |
| 6 | WhatsApp message + «إجابات من مجتمع المستخدمين…» | the Arabic→English pack retry ran for a writing task; the pack's warning was added though no passage was used | the retry only for lookups; a pack's warning only when its passage is used |
| 8 | "8. What's the capital…" → Record it in Money ×3 | "8." read as 8 pounds | a list number is dropped first (`listNumber`) |
| 9 | «لا تحتوي معرفتك على هذا» (World Cup) | as #1 | as #1, and the model is told the future can't be known (`future`) |
| 11 | «لا تحتوي معرفتك على ده» (bomb) | as #1 | refused plainly by code, in 20 languages, before the model (`danger`) |
| 12 | the whole month's 58,720 for «دفعت كام لأحمد» | the person was ignored | only entries naming Ahmed (any spelling, «لأحمد», "Ahmed") (`payee` + myledger) |
| 13 | «نعم، شرب القهوة في رمضان جائز» | the model's own (wrong) answer, from a community-answers pack | the settled ruling goes with the question; an answer saying it's allowed is replaced by the ruling, 20 languages (`fasting*`) |
| 14 | gold with sources ✓ (1 min) | — | — |
| 15 | formal Arabic | «اشرحلي» wasn't seen as Egyptian; answers over 1,500 characters were never made Egyptian | more Egyptian markers, a firmer instruction with examples, and long answers (tables too) made Egyptian |

Speed: «Looking in your notes…» (19 s, the meaning model) ran for EVERY question because a check was always true — now only for
questions about your own things ("my…", "did I…"). The pack lookup no longer adds ~1,000 tokens of unrelated passages to the prompt,
and "From: a knowledge pack" shows only when a passage was really used.
Not fixable by code: the model's own knowledge (e.g. it said bank certificates are easy to trade). The real fix is still M-A / M-B.

## The REAL phone model through the real Chat (22 Nov 2026, v10.9) — tests/trials/realchat.py
Ali: "your tests are bullshit — whenever I try a simple thing there is always a problem". He was right about the gap: the tests used a
stand-in model that says what the test wrote. Now Blaze itself (Gemma 4 E2B, Google's 4-bit QAT GGUF — the model on his phone) runs
through the real Chat screen with his 15 sentences and ~45 everyday ones; every answer is written to tests/trials/realchat-blaze-e2b-q4.md
and READ. Round 1 → round 3, what it found and what code now does:
- crane rent 562,500 "checked by code" (14 used as ×14) → impossible results sent back (`verify.implausible`); 157.89 for the price
  before VAT of 18,000 → also caught; «900 ألف» read as 900,000 in that check
- "22000/9" as the answer → fractions become numbers (2,444.44)
- «قهوة وأنا صايم» → «مسموح… من المباح» → the ruling is given by code
- 10,080 minutes in a week (it said 1,008), Ramadan 2027 = 8 Feb (it said March), 15 % of 640 (it "converted pounds to kg") → worked out
  by the phone and handed to the model (`unitNote`, `hijriNote`, `percentNote`)
- "15% tip on 640 pounds" was SAVED as a 640 expense → a sum, not money
- "what should I eat before the gym" → "Nothing spent on Health" → advice never goes to your records
- "translate …" in Chat → "the result shows on Home" → translated in Chat; «3/11» came back "⟦2/3⟧" → dates kept whole, merged
  markers put back, a leftover marker is never "done"
- «صرفت 150 على الغدا» asked to confirm in Money → saved at once (as Home, with Undo)
- "every first Monday of the month" made WEEKLY by the model → a reminder code reads completely is used as read (also instant)
- "Ottawa is Canada's biggest city", "Tokyo the most populous city", pounds→kg bullets → the small model is no longer told to always add
  2–5 bullets; one-fact questions get one sentence
- "and with 10% VAT?" answered with 14 % again → the follow-up is told the question CHANGED
- Franco "eh a7san mobile b 15 alf" (a7san taken as a phone name, answered in English) → given in Arabic letters, answered in Egyptian
Still the model's own knowledge (no code can add it): who sang «أنا لك على طول», who invented the telephone ("nobody alone").
