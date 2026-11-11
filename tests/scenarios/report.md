# Scenario run — 2500 sentences, 2481 right (99.2%)

| group | sentences | wrong | right % |
|---|---|---|---|
| mission | 5 | 2 | 60.0 |
| moneyask | 20 | 4 | 80.0 |
| gk_ar | 19 | 3 | 84.2 |
| notmoney | 21 | 2 | 90.5 |
| deadline | 12 | 1 | 91.7 |
| note | 12 | 1 | 91.7 |
| gk_en | 42 | 2 | 95.2 |
| multi | 145 | 2 | 98.6 |
| spend_fr | 153 | 2 | 98.7 |
| debt_ar | 131 | 0 | 100.0 |
| spend_en | 373 | 0 | 100.0 |
| debt_en | 144 | 0 | 100.0 |
| plan | 79 | 0 | 100.0 |
| typos | 34 | 0 | 100.0 |
| income | 104 | 0 | 100.0 |
| todo | 29 | 0 | 100.0 |
| remind_ar | 163 | 0 | 100.0 |
| mixed | 64 | 0 | 100.0 |
| questions_with_amounts | 135 | 0 | 100.0 |
| agent | 85 | 0 | 100.0 |
| remind_en | 212 | 0 | 100.0 |
| teach | 10 | 0 | 100.0 |
| spend_ar | 317 | 0 | 100.0 |
| calc | 136 | 0 | 100.0 |
| open | 33 | 0 | 100.0 |
| talk | 18 | 0 | 100.0 |
| remind_fr | 4 | 0 | 100.0 |

## What went wrong (a few examples of each)

### deadline
- **→ chat** × 1: «return the shoes before Friday»

### gk_ar
- **→ ask:world** × 2: «سعر الدهب النهارده كام؟» · «مين كسب الماتش امبارح؟»
- **→ email** × 1: «اكتبلي ايميل اطلب فيه اجازة»

### multi
- **→ confirm** × 1: «هدية 50 و فاتورة المية 250»
- **→ life** × 1: «الايجار 700 و غدا 450»

### gk_en
- **→ email** × 1: «write a short email asking for a day off»
- **→ ask:world** × 1: «what's the price of gold today?»

### spend_fr
- **→ confirm** × 2: «egar 1000» · «egar 3200»

### moneyask
- **→ ask:owed-in** × 2: «who owes me money?» · «مين عليه فلوس ليا؟»
- **→ ask:owed-out** × 2: «عليا كام؟» · «how much do I owe?»

### note
- **→ chat** × 1: «فين المفاتيح؟»

### notmoney
- **→ where** × 2: «the meeting is on the 3rd floor room 250» · «my flight is at 9»

### mission
- **→ chat** × 1: «read 12 books before December 2027»
- **→ pot** × 1: «save 100k by the end of 2027»
