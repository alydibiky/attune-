# Scenario run — 10000 sentences, 9964 right (99.6%)

| group | sentences | wrong | right % |
|---|---|---|---|
| moneyask | 20 | 4 | 80.0 |
| mission | 5 | 1 | 80.0 |
| gk_ar | 19 | 3 | 84.2 |
| notmoney | 21 | 2 | 90.5 |
| deadline | 12 | 1 | 91.7 |
| note | 12 | 1 | 91.7 |
| gk_en | 45 | 2 | 95.6 |
| multi | 820 | 15 | 98.2 |
| spend_fr | 695 | 4 | 99.4 |
| spend_en | 1979 | 3 | 99.8 |
| debt_ar | 664 | 0 | 100.0 |
| debt_en | 868 | 0 | 100.0 |
| plan | 104 | 0 | 100.0 |
| typos | 144 | 0 | 100.0 |
| income | 318 | 0 | 100.0 |
| todo | 33 | 0 | 100.0 |
| remind_ar | 447 | 0 | 100.0 |
| mixed | 198 | 0 | 100.0 |
| questions_with_amounts | 439 | 0 | 100.0 |
| agent | 223 | 0 | 100.0 |
| remind_en | 671 | 0 | 100.0 |
| teach | 10 | 0 | 100.0 |
| spend_ar | 1779 | 0 | 100.0 |
| calc | 407 | 0 | 100.0 |
| open | 43 | 0 | 100.0 |
| talk | 20 | 0 | 100.0 |
| remind_fr | 4 | 0 | 100.0 |

## What went wrong (a few examples of each)

### deadline
- **→ chat** × 1: «return the shoes before Friday»

### spend_en
- **→ chat** × 3: «3,200 breakfast» · «19,500 lunch» · «25,000 lunch»

### gk_ar
- **→ ask:world** × 2: «سعر الدهب النهارده كام؟» · «مين كسب الماتش امبارح؟»
- **→ email** × 1: «اكتبلي ايميل اطلب فيه اجازة»

### multi
- **→ life** × 9: «الايجار 700 و غدا 450» · «الايجار 4500 و غدا 7500» · «غدا 5 و الجيم 12» · «الايجار 250 و غدا 100» · «غدا 60 و النت 100» · «فاتورة المية 85 و غدا 1000»
- **→ confirm** × 4: «هدية 50 و فاتورة المية 250» · «فطار 60 و فاتورة المية 1500» · «فاتورة المية 175 و فاتورة المية 450» · «ركنة 120 و فاتورة المية 85»
- **→ list** × 2: «coffee 12 and a gift 85» · «a gift 45 and coffee 35»

### gk_en
- **→ email** × 1: «write a short email asking for a day off»
- **→ ask:world** × 1: «what's the price of gold today?»

### spend_fr
- **→ confirm** × 4: «net 450» · «net 5000» · «net 7500» · «net 80»

### moneyask
- **→ ask:owed-in** × 2: «who owes me money?» · «مين عليه فلوس ليا؟»
- **→ ask:owed-out** × 2: «عليا كام؟» · «how much do I owe?»

### note
- **→ chat** × 1: «فين المفاتيح؟»

### notmoney
- **→ where** × 2: «the meeting is on the 3rd floor room 250» · «my flight is at 9»

### mission
- **→ pot** × 1: «save 100k by the end of 2027»
