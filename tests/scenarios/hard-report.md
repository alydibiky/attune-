# Hard scenario run — 10000 sentences, 9554 right (95.5%)

Every sentence is different; each is checked for WHAT the app does and for the details (amount, direction, hour, person).

| group | sentences | wrong | right % |
|---|---|---|---|
| lists_todos | 350 | 75 | 78.6 |
| two_orders | 200 | 36 | 82.0 |
| teach_alert_auto | 200 | 28 | 86.0 |
| spend_franco | 400 | 54 | 86.5 |
| plans | 450 | 58 | 87.1 |
| edits_cancels | 140 | 12 | 91.4 |
| goals | 150 | 11 | 92.7 |
| notes_where | 250 | 18 | 92.8 |
| spend_short_mix | 450 | 31 | 93.1 |
| multi_spend | 400 | 26 | 93.5 |
| remind_mixed | 200 | 12 | 94.0 |
| my_money_questions | 300 | 17 | 94.3 |
| agents | 400 | 20 | 95.0 |
| open_call_go | 250 | 10 | 96.0 |
| spend_words | 300 | 10 | 96.7 |
| calc | 350 | 10 | 97.1 |
| debt_en | 450 | 9 | 98.0 |
| remind_en_time | 550 | 6 | 98.9 |
| debt_ar | 400 | 2 | 99.5 |
| world_questions | 350 | 1 | 99.7 |
| spend_story_en | 450 | 0 | 100.0 |
| spend_story_ar | 450 | 0 | 100.0 |
| income | 400 | 0 | 100.0 |
| not_a_payment | 500 | 0 | 100.0 |
| remind_ar_time | 500 | 0 | 100.0 |
| remind_repeat | 300 | 0 | 100.0 |
| repay | 300 | 0 | 100.0 |
| deadlines | 250 | 0 | 100.0 |
| smalltalk | 60 | 0 | 100.0 |
| numbers_not_money | 250 | 0 | 100.0 |

## What went wrong (examples of each)

### spend_short_mix
- **→ confirm** × 29: «school books (550)» · «😋 new charger 25» · «haircut 1750/-» · «diapers - 350» · «شاحن جديد 25ج» · «school books 650/-»
- **→ chat** × 2: «تورتة 15ج» · «sushi   150  »

### spend_words
- **→ money-ask** × 9: «صرفت مية على تذاكر الاتوبيس» · «flowers cost me ten» · «صرفت عشرة على هدية» · «صرفت مية على المغسلة» · «صرفت مية على فاتورة الكهربا» · «صرفت مية على فاتورة المية»
- **→ chat** × 1: «اشتريت الميكانيكي بعشرة»

### spend_franco
- **→ chat** × 44: «rakna 110 geneh» · «hodoom 300 geneh» · «rakna kalefny 420 geneh» · «dawa b 950 geneh» · «sabak b 35 geneh» · «el 7ala2 kan b 3200»
- **→ confirm** × 10: «el sabak kan b 850» · «el hedeya kan b 650» · «el dawa kan b 720» · «el rakna kan b 25» · «el hodoom kan b 1400» · «el hedeya kan b 850»

### multi_spend
- **→ chat** × 16: «today: school books 1100; the barber 120» · «a new charger 720, the mechanic 12500» · «كتب المدرسة 2500، تورتة 1100» · «بامبرز 110 وكتب المدرسة 2500» · «flowers 600 and a haircut 850» · «المغسلة 18000 والميكانيكي 2500»
- **→ calc** × 6: «the laundry 720 + tolls 650» · «lunch 75 + tolls 950» · «the barber 5200 + tolls 850» · «the mechanic 250 + cat food 7500» · «diapers 220 + a new charger 75» · «flowers 2500 + dinner 850»
- **→ life** × 3: «فاتورة النت 25 والغدا 1100» · «الغدا 220، فاتورة النت 1500» · «الغدا 95، فاتورة النت 12500»
- **amounts N+N ≠ N+N** × 1: «دفعت 95 الفطار و 175 العشا»

### remind_en_time
- **time N/N N:N ≠ N/N N:N** × 6: «wake me in 2 hours to buy bread» · «set a reminder on 25 December at 8 pm: send Maria the photos» · «wake me in 2 hours to water the plants» · «wake me in 2 hours to take the laundry out» · «wake me in 2 hours to renew the car licence» · «on the 15th at 6 pm remind me to send Maria the photos»

### remind_mixed
- **time none ≠ N/N N:N** × 10: «fakarny kaman 20 de2e2a atfy el forn!» · «fakarny kaman sa3a ashrab maya pls» · «fakarny kaman 20 de2e2a atfy el forn pls» · «fakarny kaman sa3a ashrab maya!» · «fakarny kaman 20 de2e2a atfy el forn 🙏» · «fakarny kaman sa3a ashrab maya 🙏»
- **time N/N N:N ≠ N/N N:N** × 2: «fakarny ba3d bokra el sa3a 10 el sob7 akalem Maria» · «fakarny enharda el sa3a 8 bel leil akalem Maria»

### debt_en
- **person “…” ≠ uncle Samir** × 5: «uncle Samir lent me 10000» · «I still owe uncle Samir 12000 for the laundry» · «I owe uncle Samir 700» · «I have to give uncle Samir back 6500» · «lent 10000 to uncle Samir yesterday»
- **person “…” ≠ my friend Ali** × 4: «my friend Ali owes me 500, 250 a month» · «my friend Ali owes me 1200» · «my friend Ali has 1500 of mine» · «my friend Ali borrowed 2000 from me»

### debt_ar
- **→ chat** × 2: «صاحب البيت لسه مرجعش ال1200 اللي استلفهم مني» · «اديت صاحب البيت 25000 سلف»

### plans
- **each payment N ≠ N** × 33: «قسط الموبايل 1500 كل شهر على 12 شهر» · «قسط الموبايل 200 كل شهر على 10 شهر» · «قسط الموبايل 200 كل شهر على 12 شهر» · «قسط الموبايل 600 كل شهر على 12 شهر» · «قسط الموبايل 1500 كل شهر على 24 شهر» · «قسط الموبايل 120 كل شهر على 36 شهر»
- **→ chat** × 16: «car insurance 200 every year» · «car insurance 12000 every year» · «car insurance 49 every year» · «car insurance 350 every year» · «car insurance 1500 every year» · «car insurance 120 every year»
- **→ money** × 9: «بدفع 99 كل شهر للجيم» · «بدفع 12000 كل شهر للجيم» · «بدفع 600 كل شهر للجيم» · «بدفع 120 كل شهر للجيم» · «بدفع 350 كل شهر للجيم» · «بدفع 200 كل شهر للجيم»

### agents
- **→ chat** × 14: «تابعلي سعر iPhone 16» · «تابعلي سعر a Xiaomi scooter» · «تابعلي سعر an Apple Watch» · «تابعلي سعر an iPad Air» · «تابعلي سعر MacBook Air M3» · «تابعلي سعر Samsung S24»
- **→ money** × 5: «عايز فندق في جدة من 3 ل 7 مارس» · «عايز فندق في دبي من 3 ل 7 مارس» · «عايز فندق في باريس من 3 ل 7 مارس» · «عايز فندق في الرياض من 3 ل 7 مارس» · «عايز فندق في اسطنبول من 3 ل 7 مارس»
- **→ where** × 1: «where is my noon order»

### lists_todos
- **→ chat** × 68: «shopping list: chicken, milk, pasta» · «we're out of sugar and yoghurt» · «shopping list: bread, bananas, onions» · «we're out of sugar and tomatoes» · «we're out of yoghurt and cheese» · «shopping list: rice, milk, soap»
- **→ agent/order** × 3: «don't forget: order the cake» · «todo: order the cake» · «new task: order the cake»
- **→ teach** × 3: «new task: pay the maid» · «don't forget: pay the maid» · «todo: pay the maid»
- **→ ask:money** × 1: «show my shopping list»

### notes_where
- **→ chat** × 14: «النضارة فين؟» · «where did I put the charger?» · «where did I put the car papers?» · «الباسبور فين؟» · «where did I put the drill?» · «المفاتيح فين؟»
- **→ teach** × 3: «the glasses is at my mum's house» · «the wallet is at my mum's house» · «the headphones is at my mum's house»
- **→ ask:money** × 1: «where did I put the old phone?»

### open_call_go
- **→ chat** × 10: «open Documents» · «go to Follow-ups» · «افتح الاعدادات» · «open People & plans» · «افتح المتابعات» · «open Settings»

### teach_alert_auto
- **→ chat** × 28: «Maria always comes first» · «Priya always comes first» · «Hana always comes first» · «alert me if Tom calls» · «alert me if John calls» · «alert me if Karim calls»

### goals
- **→ chat** × 11: «read 21 books before December 2027» · «read 7 books before December 2027» · «read 16 books before December 2027» · «read 6 books before December 2027» · «read 14 books before December 2027» · «read 12 books before December 2027»

### calc
- **→ confirm** × 10: «250 squared» · «120 squared» · «20 squared» · «850 squared» · «2400 squared» · «1200 squared»

### my_money_questions
- **→ chat** × 16: «what are my subscriptions?» · «ليلى عليه كام؟» · «يوسف عليه كام؟» · «ندى عليه كام؟» · «عمر عليه كام؟» · «مصطفى عليه كام؟»
- **→ ask:due** × 1: «how much went on restaurants this week?»

### world_questions
- **→ ask:money** × 1: «is an Apple Watch worth 4400?»

### two_orders
- **→ reminder** × 33: «spent 85 on parking, also remind me in an hour and a half to water the plants» · «spent 1750 on a birthday cake, also remind me tomorrow at noon to print the tickets» · «remind me in half an hour to call David and I paid 1250 for shoes» · «paid 95 for vegetables and remind me to move the car tomorrow at noon» · «remind me in an hour to take my medicine and I paid 550 for a phone cover» · «paid 2500 for diapers and remind me to pay the maid in half an hour»
- **payment N not recorded** × 3: «دفعت 15 الفطار وفكرني كمان ساعة ونص ابعت التقرير» · «دفعت 950 الفطار وفكرني بكرة الساعة 9 الصبح اطبع التذاكر» · «دفعت 120 الفطار وفكرني بعد ساعة اشتري عيش»

### edits_cancels
- **→ life** × 11: «the netflix is 150 now, not 200» · «the netflix is 5200 now, not 5250» · «change the netflix to 480» · «غير الاشتراك ل420» · «edit the netflix amount to 1100» · «edit the netflix amount to 15»
- **→ reminder** × 1: «cancel my reminder to call the bank»
