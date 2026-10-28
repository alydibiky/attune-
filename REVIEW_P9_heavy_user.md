# Persona 9 — the heavy user (one year, every feature, every day)

**What I did:** lived **one full year (28 Oct 2025 → 28 Oct 2026) through the Home box** — 1,592 sentences in English and
Egyptian Arabic, the way a busy person types: breakfast and lunch every day, groceries, taxis, the maid every Saturday,
electricity on the 10th, Netflix on the 5th, salary on the 1st, water, walks and gym, reminders, a loan to a friend every
six weeks, and questions about it all ("how much did I spend this month?", «مين عليه فلوس ليا؟»). The stores were kept between
days exactly as the phone keeps them. Then I **opened the real app with that year of data** (390 × 844 phone, also on a
4× slower CPU) and asked it questions.

## What holds up after a year (measured)
| Check | Result |
|---|---|
| Money totals | income 384,000 = 384,000 ✔ · spending matches to the pound (except the first Netflix, see below) |
| Understanding one sentence + saving it | median **7 ms**, 95 % under 16 ms, slowest 110 ms |
| Storage after a year | **0.82 MB** (Fit 0.31 M characters, Money 0.12 M) — the phone's limit (~5 MB) lasts ~6 years |
| Cold start with a year of data | 1.0–1.8 s |
| Page switch on a 4× slower CPU | Home 96 ms · Fit 76 · Follow-ups 106 · People & plans 127 · Health 71 · **Money 350 ms** (same as an empty app — persona 5's P5-E) |
| "How much did I spend this year?" | 165,471 EGP, by category, instantly, by code ✔ |

## What broke over time — fixed now
1. **"netflix 250" every month made 12 Netflix subscriptions**, and Safe to spend took all 12 off. Now a subscription that
   is already there is **paid for this month** (the money goes out, the plan's payment is ticked): "Netflix: this month's
   250 paid."
2. **Paying a subscription with its amount made the whole plan disappear** (the "spread what's left" logic treated
   "250 a month, forever" as a 250 total). Open-ended plans now keep going.
3. **Open-ended plans ran out after 12 months** — from the 13th month nothing was due. They now keep a year ahead of today.
4. **"vegetables 460", «خضار 415», "koshari 85"** were logged as a 300 g mahshi, a vegetable soup, a 450 g koshari — the
   number thrown away. When the food reader can't use the number, the number is the price ("rice 200" = 200 g still food).
5. **«صرفت ٥٧ على فول وطعمية» logged water** («مية» inside «طعمية») and filed the money under bills. Short Arabic keywords
   (مية، نت، عيش، بيض، لبن، لبس، دوا…) now match only as whole words (و / ب / ال in front allowed); فول، طعمية، كبدة،
   حواوشي… are food. **"water bill 300"** was a 500 g "water bull" food — a bill is never a drink now.
6. **«فول وعيش بلدي على الفطار»** saved the bread as «عيش بلدي الفطار» (the meal word stuck to the name, 88 times in the
   year).
7. **"I lent محمد 1603", "محمد owes me 1730"** (English with an Arabic name) were plain expenses — now debts.
8. **"Who owes me?" said "9 people"** — it was 4 people and 9 loans. Now one row per person: "Sara (4 loans) 9,369".
9. **"When did I last pay netflix?"** answered with this month's bills. Now: "The last time: 5 Oct (23 days ago) — 250 ·
   netflix", with the earlier months listed.
10. **A year of meals typed on Home, Fit never set up** → Fit showed only "Welcome — Get started", as if nothing was there.
    It now says "Your 365 days of meals from Home are kept — set your goal and they appear in your diary."

## What a year of use shows — Ali picks
- **H-A Safe to spend with savings**: after a year the balance is 182,585 and Safe to spend says **"45,646 a day until 31 Oct"**
  — it treats every pound saved as spendable. Options: (1) count only this month's income minus what's spent and due
  (recommended); (2) a "Savings" account the person moves money into, not counted; (3) keep it, add "of which savings".
- **H-B Old open loans look late forever**: "Sara owes me 2026" with no date became due on the 1st of the next month and
  has shown **"Late"** for a year; People & plans opens with "Due this week · 10 items · 20,767". Options: (1) a loan with no
  date is "open — no date" (never late) until a date is set (recommended); (2) late, but only on the list, not "Due this
  week"; (3) ask for a date when it's added.
- **H-C One person, many loans**: Sara has 4 rows in People & plans. Options: (1) one card per person with the loans inside
  (recommended); (2) keep separate rows.
- **H-D The first "netflix 250"** sets up the subscription but doesn't log the first payment (the money total is 250 short).
  Options: (1) on the first mention also log it as paid today; (2) ask "paid today?" with Yes / No (recommended — one tap).
- **H-E Monthly review**: a heavy user never opened a "month in review". Suggest the persona 4 morning card + a 1st-of-the-
  month summary ("October: spent 15,350, 52 % kept, Sara still owes 9,369, 22 days of meals logged").

## Tests added
`tests/unit/v860p9.test.mjs` — 8 checks (money vs food numbers, «طعمية» / water bill, mixed-script debts, meal words in names,
a subscription typed twice, open-ended plans a year ahead, one row per person, "when did I last…"). The year simulation and the
real-app run: `scratchpad/p9/year.mjs`, `ui.py` (not in the repo).
