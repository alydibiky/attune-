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
