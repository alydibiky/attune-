# Scenario run — 2500 sentences, 2377 right (95.1%)

| group | sentences | wrong | right % |
|---|---|---|---|
| open | 33 | 29 | 12.1 |
| mission | 5 | 2 | 60.0 |
| todo | 29 | 10 | 65.5 |
| agent | 85 | 28 | 67.1 |
| note | 12 | 3 | 75.0 |
| moneyask | 20 | 4 | 80.0 |
| gk_ar | 19 | 3 | 84.2 |
| spend_fr | 153 | 23 | 85.0 |
| deadline | 12 | 1 | 91.7 |
| multi | 145 | 10 | 93.1 |
| gk_en | 42 | 2 | 95.2 |
| notmoney | 21 | 1 | 95.2 |
| spend_en | 373 | 7 | 98.1 |
| debt_ar | 131 | 0 | 100.0 |
| debt_en | 144 | 0 | 100.0 |
| plan | 79 | 0 | 100.0 |
| typos | 34 | 0 | 100.0 |
| income | 104 | 0 | 100.0 |
| remind_ar | 163 | 0 | 100.0 |
| mixed | 64 | 0 | 100.0 |
| questions_with_amounts | 135 | 0 | 100.0 |
| remind_en | 212 | 0 | 100.0 |
| teach | 10 | 0 | 100.0 |
| spend_ar | 317 | 0 | 100.0 |
| calc | 136 | 0 | 100.0 |
| talk | 18 | 0 | 100.0 |
| remind_fr | 4 | 0 | 100.0 |

## What went wrong (a few examples of each)

### deadline
- **→ chat** × 1: «return the shoes before Friday»

### spend_en
- **→ confirm** × 4: «a haircut 45» · «2500 a haircut» · «250 a haircut» · «a haircut 25000»
- **→ chat** × 3: «a haircut 85 cash» · «a haircut 2500 cash» · «a haircut 300 cash»

### gk_ar
- **→ ask:world** × 2: «سعر الدهب النهارده كام؟» · «مين كسب الماتش امبارح؟»
- **→ email** × 1: «اكتبلي ايميل اطلب فيه اجازة»

### multi
- **→ confirm** × 9: «هدية 50 و فاتورة المية 250» · «lunch 60 and a haircut 85» · «a haircut 150 and rent 320» · «lunch 300 and a haircut 1200» · «taxi 2500 and a haircut 700» · «a haircut 150, rent 500, groceries 2500»
- **→ life** × 1: «الايجار 700 و غدا 450»

### gk_en
- **→ email** × 1: «write a short email asking for a day off»
- **→ ask:world** × 1: «what's the price of gold today?»

### todo
- **→ chat** × 10: «I need to fix the printer» · «add to my todo send the invoice» · «add to my todo clean the car» · «I need to renew the domain» · «add to my todo renew the domain» · «I need to buy milk»

### spend_fr
- **→ chat** × 14: «dawa b 2000 geneh» · «rakna b 1000 geneh» · «egar b 650 geneh» · «egar b 200 geneh» · «egar b 80 geneh» · «net b 20 geneh»
- **→ confirm** × 9: «hodoom 150» · «ahwa 80» · «dawa 175» · «egar 1000» · «hodoom 7500» · «hodoom 2000»

### moneyask
- **→ ask:owed-in** × 2: «who owes me money?» · «مين عليه فلوس ليا؟»
- **→ ask:owed-out** × 2: «عليا كام؟» · «how much do I owe?»

### agent
- **→ money** × 22: «اشتريلي iPhone 16 بأقل من 45000» · «اشتريلي AirPods Pro 2 بأقل من 5000» · «نبهني لما iPhone 16 يبقى أقل من 5000» · «اشتريلي an air fryer بأقل من 5000» · «نبهني لما MacBook Air M3 يبقى أقل من 9000» · «اشتريلي MacBook Air M3 بأقل من 25000»
- **→ chat** × 6: «تابعلي سعر Samsung S24» · «تابعلي سعر a PS5» · «تابعلي سعر an air fryer» · «تابعلي سعر MacBook Air M3» · «تابعلي سعر iPhone 16» · «تابعلي سعر a 55 inch TV»

### note
- **→ chat** × 3: «فين المفاتيح؟» · «where are my keys?» · «where is my passport?»

### notmoney
- **→ where** × 1: «the meeting is on the 3rd floor room 250»

### open
- **→ reminder** × 26: «call Mohamed» · «call Ahmed» · «كلم يوسف» · «call Nada» · «call Karim» · «whatsapp Sara»
- **→ chat** × 3: «افتح الفلوس» · «open my reminders» · «open Money»

### mission
- **→ chat** × 1: «read 12 books before December 2027»
- **→ pot** × 1: «save 100k by the end of 2027»
