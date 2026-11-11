# Scenario run — 10000 sentences, 9734 right (97.3%)

| group | sentences | wrong | right % |
|---|---|---|---|
| open | 43 | 39 | 9.3 |
| mission | 5 | 2 | 60.0 |
| todo | 33 | 10 | 69.7 |
| note | 12 | 3 | 75.0 |
| moneyask | 20 | 4 | 80.0 |
| spend_fr | 695 | 110 | 84.2 |
| gk_ar | 19 | 3 | 84.2 |
| deadline | 12 | 1 | 91.7 |
| multi | 820 | 51 | 93.8 |
| notmoney | 21 | 1 | 95.2 |
| gk_en | 45 | 2 | 95.6 |
| agent | 223 | 7 | 96.9 |
| spend_en | 1979 | 33 | 98.3 |
| debt_ar | 664 | 0 | 100.0 |
| debt_en | 868 | 0 | 100.0 |
| plan | 104 | 0 | 100.0 |
| typos | 144 | 0 | 100.0 |
| income | 318 | 0 | 100.0 |
| remind_ar | 447 | 0 | 100.0 |
| mixed | 198 | 0 | 100.0 |
| questions_with_amounts | 439 | 0 | 100.0 |
| remind_en | 671 | 0 | 100.0 |
| teach | 10 | 0 | 100.0 |
| spend_ar | 1779 | 0 | 100.0 |
| calc | 407 | 0 | 100.0 |
| talk | 20 | 0 | 100.0 |
| remind_fr | 4 | 0 | 100.0 |

## What went wrong (a few examples of each)

### deadline
- **→ chat** × 1: «return the shoes before Friday»

### spend_en
- **→ confirm** × 17: «a haircut 45» · «2500 a haircut» · «250 a haircut» · «a haircut 25000» · «175 a haircut» · «a haircut 2000»
- **→ chat** × 16: «a haircut 85 cash» · «a haircut 2500 cash» · «a haircut 300 cash» · «a haircut 12 cash» · «3,200 breakfast» · «19,500 lunch»

### gk_ar
- **→ ask:world** × 2: «سعر الدهب النهارده كام؟» · «مين كسب الماتش امبارح؟»
- **→ email** × 1: «اكتبلي ايميل اطلب فيه اجازة»

### multi
- **→ confirm** × 41: «هدية 50 و فاتورة المية 250» · «lunch 60 and a haircut 85» · «a haircut 150 and rent 320» · «lunch 300 and a haircut 1200» · «taxi 2500 and a haircut 700» · «a haircut 150, rent 500, groceries 2500»
- **→ life** × 9: «الايجار 700 و غدا 450» · «الايجار 4500 و غدا 7500» · «غدا 5 و الجيم 12» · «الايجار 250 و غدا 100» · «غدا 60 و النت 100» · «فاتورة المية 85 و غدا 1000»
- **→ chat** × 1: «الحلاق 12 و الحلاق 150»

### gk_en
- **→ email** × 1: «write a short email asking for a day off»
- **→ ask:world** × 1: «what's the price of gold today?»

### todo
- **→ chat** × 10: «I need to fix the printer» · «add to my todo send the invoice» · «add to my todo clean the car» · «I need to renew the domain» · «add to my todo renew the domain» · «I need to buy milk»

### spend_fr
- **→ chat** × 68: «dawa b 2000 geneh» · «rakna b 1000 geneh» · «egar b 650 geneh» · «egar b 200 geneh» · «egar b 80 geneh» · «net b 20 geneh»
- **→ confirm** × 42: «hodoom 150» · «ahwa 80» · «dawa 175» · «egar 1000» · «hodoom 7500» · «hodoom 2000»

### moneyask
- **→ ask:owed-in** × 2: «who owes me money?» · «مين عليه فلوس ليا؟»
- **→ ask:owed-out** × 2: «عليا كام؟» · «how much do I owe?»

### agent
- **→ chat** × 7: «تابعلي سعر Samsung S24» · «تابعلي سعر a PS5» · «تابعلي سعر an air fryer» · «تابعلي سعر MacBook Air M3» · «تابعلي سعر iPhone 16» · «تابعلي سعر a 55 inch TV»

### note
- **→ chat** × 3: «فين المفاتيح؟» · «where are my keys?» · «where is my passport?»

### notmoney
- **→ where** × 1: «the meeting is on the 3rd floor room 250»

### open
- **→ reminder** × 36: «call Mohamed» · «call Ahmed» · «كلم يوسف» · «call Nada» · «call Karim» · «whatsapp Sara»
- **→ chat** × 3: «افتح الفلوس» · «open my reminders» · «open Money»

### mission
- **→ chat** × 1: «read 12 books before December 2027»
- **→ pot** × 1: «save 100k by the end of 2027»
