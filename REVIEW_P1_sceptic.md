# Persona 1 — the sceptical tester (two months of real use)

**Who:** someone who doesn't trust the app and tries to catch it out — every kind of sentence, typos, Franco, Arabic digits, odd
numbers — and who keeps using it for two months to see what breaks over time.

**What I did (measured, not guessed):**
1. **60 simulated days of one person's life** typed into the Home box: salary twice, daily breakfast and lunch, fuel every
   5 days, the maid every Saturday, debts (Ahmed owes me, I owe Karim), a 9-month payment plan (Sheikh), Netflix, car
   insurance, weight, walks, electricity, groceries. At the end I compared Money's totals with what the person really spent,
   checked every plan's schedule, asked "how much did I spend on food / fuel / this month?", "how much does Ahmed owe me?".
2. **48 edge sentences**: empty, emoji, 2,000 characters, negative and huge amounts, `1.500` vs `1,500.50`, typos, Franco
   (`da3et 200`), "yesterday" / "last Friday", several amounts in one sentence, lending and owing in small letters, lbs,
   impossible weights, blood pressure, sleep, a `<script>` tag.

## Result of the 60 days — before → after
| Check | Before | After |
|---|---|---|
| Money spent recorded (should be 16,950 EGP) | **7,750** — 9,200 EGP silently missing | **16,950** ✔ |
| "fuel 500" (×12) | logged as **ful medames** (food), no money | 500 EGP Transport ✔ |
| "maid 400" (×9) | went to Chat, not recorded | 400 EGP expense ✔ |
| "Ahmed paid me back 1000" | money in, but **Ahmed still owed 3,000** | money in **and** Ahmed owes 2,000 ✔ |
| Sheikh's 9-month plan made on 1 Sep | first payment always "next month" — **re-dated to today every day**, never due | first payment 1 Oct, then monthly ✔ |
| "how much do I owe?" | Netflix listed as "0 EGP · 0/?" | "Netflix 250 EGP a month → next date" ✔ |
| Food names | "Chicken shawarma **paid**", "**Spent on** koshari" (my own v8.6 naming change) | "Chicken shawarma sandwich", "Koshari" ✔ |
| Fit storage for 60 days | 151 KB (each food kept its whole swap list) | 50 KB ✔ |

## Edge sentences — fixed now
| Typed | Before | Now |
|---|---|---|
| electricity bill 650 due on the 10th | a **10 EGP** expense | 650 EGP every month on the 10th, in People & plans |
| last friday paid 500 for the doctor | a **reminder next Friday** | 500 EGP expense dated last Friday |
| spent 200 on lunch and 50 on coffee and 30 tip | one 200 expense named "Coffee" | three expenses, 280 in all |
| spent 1.500 on shoes | 1.5 EGP | 1,500 EGP |
| da3et 200 3ala el akl (Franco) | Chat, then **3 EGP** (the "3" in the word) | 200 EGP |
| i got 500 from mom | an expense | money in |
| I weigh 200 lbs | 200 kg | 90.7 kg |
| weight 920 | a **920 EGP expense** | "doesn't look like a body weight — write it again" |
| I lent mohamed 700 | an expense | Mohamed owes me 700 |
| I owe the grocer 120 | an expense | I owe the Grocer 120 |
| Mohamed paid me back 300 / paid the grocer 120 | money only | the debt goes down too |

## Still open (feature gaps — not wrong answers; tell me which matter)
- **Blood pressure** ("my blood pressure 120/80") and **sleep** ("slept 7 hours") aren't logged anywhere — both are things
  people track daily.
- **Loans from a bank** ("loan 5000 from the bank, 12 months") → Chat; installments with a person work.
- **Typos** ("spnt 200 on lunh") → Chat. With a model loaded Chat answers, but nothing is recorded.
- A **negative amount** ("spent -50") is saved as 50 with "-" in the note — harmless, untidy.
- Notes keep filler words ("last friday doctor", "da3et 3ala el akl") — readable, not pretty.
- Not testable here (needs your phone): reminders firing over weeks, the watch day after day, the mic.

## Tests added
`tests/unit/v860p1.test.mjs` — 16 checks, one per bug above, so none can come back. All unit tests pass.
