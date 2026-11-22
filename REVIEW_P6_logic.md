# Persona 6 — the logic tester (30 years; the code, the data and the AI's answers)

**What I did:** I checked the app's own maths and readers against answers I can prove independently — 60+ checks across the
calculator, the answer-checker that guards the AI, instalments, calorie formulas, every food in the table, holidays and
weekends, VAT, Metro routes, dates and reminders — and fixed every wrong answer. AI answers themselves are persona 8.

## What is strong (measured)
| Area | Result |
|---|---|
| Food database | **1,188 foods**; every portion believable; no duplicate names; only 6 foods where calories and macros differ by > 25 % — all leafy vegetables / lemon, normal for USDA values (fibre) |
| Calorie targets | Mifflin-St Jeor exact (male 30 y, 180 cm, 80 kg → BMR 1,780, TDEE 2,759); a too-fast loss is capped at 25 % below TDEE, and says so |
| Holidays (Egypt 2026) | 17 days: Coptic Christmas 7 Jan, Eid al-Fitr 20–22 Mar, Sham el-Nessim 13 Apr (day after Coptic Easter 12 Apr), Arafat + Eid al-Adha 26–29 May, Islamic New Year 16 Jun, Prophet's Birthday 25 Aug, 23 July, 6 October ✔ |
| Weekends | Friday off in Egypt, Saturday in the UAE ✔ |
| VAT | Egypt 14 %, Saudi 15 %, UAE 5 %, UK 20 %, Germany 19 % ✔ |
| Cairo Metro | Maadi → Sadat 8 stops, Line 1, no change; Helwan → Attaba 20 stops, change at Sadat; Shubra El-Kheima → Cairo University, Line 2 direct ✔ |
| Translator locks | invoice numbers, amounts, times, dates and e-mails come back exactly ✔ |
| The 60-day money test (persona 1) | Money's totals match the real spending to the pound ✔ |

## Wrong answers found — fixed now
| Input | Was | Now |
|---|---|---|
| Calculator `sqrt(144)` | **144** (the function ignored) | `sqrt` / `√` worked out; `(5+3)*2^3` = 64, `2^3^2` = 512; functions it can't do (log, sin…) are left to the AI instead of answered wrongly |
| The AI answer-checker: "150000 + 21000 = **171500**" | passed as correct (it allowed 0.5 %, = 855 here) | caught — whole-number sums must be exact; the 0.5 % room stays only for rounded results |
| "22,000 over 9 months" | payments added up to **21,999.96** | exactly 22,000 (the last payment takes the cents) |
| "expires 29/02/2027" | silently **1 March 2027** | not a date (2027 isn't a leap year) |
| «جواز السفر بينتهي ١٠/٥/٢٠٢٧» | not caught | 10 May 2027 (Egyptian «بينتهي» + Arabic digits) |
| "my visa ends on 31 jan" · "car license renewal 15/12" | not caught | 31 Jan 2027 · 15 Dec 2026 |
| "remind me on 3/4 at 5pm" (in October) | "That time has already passed" | 3 April 2027, 5 pm |

## Still open
- "every last Friday of the month" sets one reminder, not a monthly one.
- "insurance expires next month", "warranty ends 2028" (a month or year only) aren't caught.
- "10 % 3" is read as 10 % × 3 = 0.3 (fine for money talk; a programmer meant 1).
- Netflix-style "renews on the 5th" with no month isn't a deadline (it is caught as a subscription in People & plans).

## Tests added
`tests/unit/v860p6.test.mjs` — 10 checks for the fixes above. All unit tests pass.

## Re-run on the release build (22 Nov 2026, v10.8) — `tests/e2e_v1080personas.py`, phone 390 + computer 1366, English + Arabic
- "how much did I spend this month?" / «صرفت كام الشهر ده؟» answers the exact total from your own Money, at once ✔.
- The old "still open" list: "insurance expires next month", "warranty ends 2028", "Netflix renews on the 5th" are deadlines now ✔;
  "every last Friday of the month" is a monthly reminder ✔.
- New and fixed (repeating reminders): "remind me every Friday to pay rent" went to Chat; «فكرني كل جمعة …» had no date; «كل يوم سبت» was
  every day; "each Friday", "on Fridays", "of each month" didn't repeat; "on the 5th of every month" was titled «of to pay rent»;
  "remind me every Monday to call mum" asked who mum is; "every day at 07:00" said at 10:00 became 19:00; "8 a.m." was 8 pm; «8 الصبح»
  wasn't a time; "send the weekly report" lost «weekly»; two spaces or a direction mark broke it. All fixed, with a 10,000-case test
  (tests/reminders/repeat.mjs: 72.86 % → 81 % on the harder version → 100 %, 71.7 % shapes; held-out 89.85 % → 100 %).
- Still open: "every first Monday of the month" (makes a one-off for next Monday — the title shows what was meant); "remind me every month
  to pay the internet" with no day goes to Chat (it needs to ask which day).
