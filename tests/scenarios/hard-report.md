# Hard scenario run — 10000 sentences, 7045 right (70.5%)

Every sentence is different; each is checked for WHAT the app does and for the details (amount, direction, hour, person).

| group | sentences | wrong | right % |
|---|---|---|---|
| spend_words | 300 | 300 | 0.0 |
| two_orders | 200 | 200 | 0.0 |
| not_a_payment | 500 | 323 | 35.4 |
| open_call_go | 250 | 161 | 35.6 |
| lists_todos | 350 | 175 | 50.0 |
| remind_mixed | 200 | 82 | 59.0 |
| remind_en_time | 550 | 205 | 62.7 |
| edits_cancels | 140 | 51 | 63.6 |
| multi_spend | 400 | 135 | 66.3 |
| income | 400 | 133 | 66.8 |
| debt_en | 450 | 149 | 66.9 |
| remind_ar_time | 500 | 159 | 68.2 |
| repay | 300 | 89 | 70.3 |
| calc | 350 | 100 | 71.4 |
| debt_ar | 400 | 108 | 73.0 |
| world_questions | 350 | 73 | 79.1 |
| spend_story_en | 450 | 84 | 81.3 |
| spend_short_mix | 450 | 83 | 81.6 |
| my_money_questions | 300 | 45 | 85.0 |
| spend_franco | 400 | 57 | 85.8 |
| remind_repeat | 300 | 42 | 86.0 |
| teach_alert_auto | 200 | 28 | 86.0 |
| plans | 450 | 58 | 87.1 |
| notes_where | 250 | 29 | 88.4 |
| spend_story_ar | 450 | 39 | 91.3 |
| goals | 150 | 11 | 92.7 |
| numbers_not_money | 250 | 16 | 93.6 |
| agents | 400 | 20 | 95.0 |
| deadlines | 250 | 0 | 100.0 |
| smalltalk | 60 | 0 | 100.0 |

## What went wrong (examples of each)

### spend_story_en
- **→ chat** × 39: «I took Omar out and flowers came to 1500» · «135 went on dinner today, way too much» · «60 went on coffee today, way too much» · «I took my brother out and pizza came to 650» · «the laundry with Mohamed last night, 720 in total» · «I took Ahmed out and the plumber came to 550»
- **amount N ≠ N** × 26: «at 8 pm I paid 600 for bus tickets» · «at 7 pm I paid 85 for the internet bill» · «at 2 pm I paid 180 for the laundry» · «this morning I spent 15 on clothes near gate 4» · «at 11 pm I paid 350 for coffee» · «at 1 pm I paid 95 for school books»
- **→ confirm** × 19: «bus tickets with my brother last night, 4500 in total» · «a taxi with Mohamed last night, 300 in total» · «groceries with Laila last night, 2500 in total» · «a taxi with Fatima last night, 850 in total» · «the internet bill with Maria last night, 800 in total» · «petrol with David last night, 150 in total»

### spend_story_ar
- **amount N ≠ N** × 26: «اشتريت 5 قمصان ب420 من سيتي ستارز» · «اشتريت 2 قمصان ب1100 من كارفور» · «اشتريت 2 قمصان ب٣٢٠ من سيتي ستارز» · «اشتريت 2 قمصان ب٤٥٠٠ من كازيون» · «اشتريت 4 قمصان ب850 من النادي» · «اشتريت 2 قمصان ب275 من ستاربكس»
- **→ chat** × 12: «اديت الدليفري 7500 العشا» · «اديت الدليفري 180 الغدا» · «اديت الدليفري 950 السباك» · «اديت الدليفري 1400 الغدا» · «اديت الدليفري 18000 اكل القطة» · «اديت الدليفري ٤٥٠ البيطري»
- **→ life** × 1: «الجيم كلفتني 60 جنيه»

### spend_short_mix
- **→ chat** × 69: «lunch (350)» · «تورتة 15ج» · «mechanic: 320» · «school books (550)» · «😋 new charger 25» · «haircut 1750/-»
- **→ confirm** × 8: «diapers - 350» · «شاحن جديد 25ج» · «haircut   3200  » · «vet   1100  » · «7500 ج شاحن جديد» · «flowers   720  »
- **→ open** × 6: «phone cover 18000 egp.» · «phone cover   800  » · «phone cover 1750 جنيه» · «phone cover   75  » · «phone cover 1250 egp.» · «phone cover   1400  »

### spend_words
- **→ chat** × 192: «spent seven hundred and fifty on school books» · «فاتورة النت ربعمية جنيه» · «pizza five hundred pounds» · «a phone cover three hundred pounds» · «the electricity bill ten pounds» · «الحلاق بتلتمية جنيه»
- **→ money-ask** × 108: «صرفت سبعين على فاتورة المية» · «I paid seventy for a new charger today» · «صرفت سبعين على دكتور الاسنان» · «dinner cost me two hundred and fifty» · «صرفت تلتمية على تذاكر الاتوبيس» · «I paid six hundred for the plumber today»

### spend_franco
- **→ chat** × 44: «rakna 110 geneh» · «hodoom 300 geneh» · «rakna kalefny 420 geneh» · «dawa b 950 geneh» · «sabak b 35 geneh» · «el 7ala2 kan b 3200»
- **→ confirm** × 10: «el sabak kan b 850» · «el hedeya kan b 650» · «el dawa kan b 720» · «el rakna kan b 25» · «el hodoom kan b 1400» · «el hedeya kan b 850»
- **amount N ≠ N** × 3: «dafa3t lel 7ala2 60» · «dafa3t lel 7ala2 135» · «dafa3t lel 7ala2 220»

### income
- **direction out ≠ in** × 80: «العميل دفعلي 40000» · «abadt 4000» · «the client paid 1000 for overtime» · «العميل دفعلي 15000» · «Karim sent me 500» · «Fatima sent me 5000»
- **→ confirm** × 53: «جالي بونص 1500» · «el morattab nezel 1000» · «el morattab nezel 4000» · «اختي بعتلي 1200» · «el morattab nezel 8000» · «جالي بونص 5000»

### multi_spend
- **amounts N ≠ N+N** × 65: «spent 75 on the plumber and 2200 on parking» · «دفعت 4500 الجيم و 15 الصيدلية» · «دفعت 95 الفطار و 175 العشا» · «دفعت 18000 خضار و 15 دوا» · «spent 1500 on groceries and 180 on the mechanic» · «spent 450 on sushi and 300 on the cinema»
- **amounts N ≠ N+N+N** × 44: «spent 1500 on a gift, 95 on dinner and 135 on the laundry» · «spent 85 on breakfast, 320 on the laundry and 18000 on petrol» · «spent 550 on parking, 75 on petrol and 25 on the electricity bill» · «spent 480 on the gym, 220 on shoes and 175 on a phone cover» · «spent 850 on the vet, 480 on a phone cover and 950 on pizza» · «spent 150 on the dentist, 3200 on the mechanic and 120 on tolls»
- **→ chat** × 17: «today: school books 1100; the barber 120» · «a new charger 720, the mechanic 12500» · «كتب المدرسة 2500، تورتة 1100» · «بامبرز 110 وكتب المدرسة 2500» · «flowers 600 and a haircut 850» · «المغسلة 18000 والميكانيكي 2500»
- **→ calc** × 6: «the laundry 720 + tolls 650» · «lunch 75 + tolls 950» · «the barber 5200 + tolls 850» · «the mechanic 250 + cat food 7500» · «diapers 220 + a new charger 75» · «flowers 2500 + dinner 850»
- **→ life** × 3: «فاتورة النت 25 والغدا 1100» · «الغدا 220، فاتورة النت 1500» · «الغدا 95، فاتورة النت 12500»

### not_a_payment
- **→ money** × 323: «I almost paid 550 for a haircut» · «I didn't pay the 300 for the gym yet» · «طلبوا مني 1750 في فاتورة الكهربا ومدفعتش» · «don't count the 300 for the electricity bill» · «I didn't pay the 85 for the internet bill yet» · «shoes used to cost 25»

### remind_en_time
- **title keeps time words: “…”** × 105: «reminder to charge the power bank this evening at 7» · «wake me tomorrow morning at 8 to renew the car licence» · «I need a reminder in an hour to back up my phone» · «I need a reminder in half an hour to wish Ahmed happy birthday» · «please remind me to back up my phone the day after tomorrow at 10 am» · «remind me tomorrow morning at 8 that I have to call Tom»
- **time N/N N:N ≠ N/N N:N** × 100: «I need a reminder at 10 to 5 pm to call Omar» · «remind me at half past 6 pm that I have to send the report» · «remind me at quarter past 5 pm that I have to buy bread» · «set a reminder in 3 days at 4 pm: wish Priya happy birthday» · «remind me at half past 6 pm that I have to order the cake» · «wake me at quarter past 5 pm to email Priya»

### remind_ar_time
- **→ chat** × 77: «اعملي تذكير كمان 20 دقيقة ادفع للشغالة» · «اعملي تذكير بعد بكرة الساعة 10 الصبح انقل العربية» · «اعملي تذكير النهارده الساعة 9 وربع بالليل اجدد رخصة العربية» · «فكريني كمان ربع ساعة اجدد رخصة العربية» · «اعملي تذكير بكرة الساعة 9 الصبح اسلم الواجب» · «فكريني كمان ساعة ونص اطبع التذاكر»
- **→ money** × 42: «فكريني الساعة 6 ونص المغرب اطبع التذاكر» · «اعملي تذكير بكرة الساعة 9 الصبح ادفع فاتورة الكهربا» · «فكريني يوم السبت الساعة 11 الصبح اخد الدوا» · «فكريني بعد 3 ايام الساعة 4 العصر ادفع فاتورة الكهربا» · «متخلنيش انسى اسقي الزرع الساعة 6 ونص المغرب» · «متخلنيش انسى ادفع للشغالة النهارده الساعة 9 وربع بالليل»
- **time N/N N:N ≠ N/N N:N** × 39: «ذكرني بعد 3 ايام الساعة 4 العصر اني اكلم البنك» · «فكرني بعد 3 ايام الساعة 4 العصر انقل العربية» · «فكرني اطبع التذاكر كمان ساعة ونص» · «فكرني كمان ساعة ونص احجز عند الدكتور» · «فكرني اكلم ليلى كمان ساعة ونص» · «فكرني كمان ساعة ونص اسقي الزرع»
- **→ confirm** × 1: «فكريني النهارده الساعة 8 بالليل ابعت التقرير»

### remind_mixed
- **time none ≠ N/N N:N** × 56: «fakarny kaman 20 de2e2a atfy el forn!» · «fakarny yom el gom3a el sa3a 3 el 3asr aroo7 el doctor!» · «fakarny yom el gom3a el sa3a 3 el 3asr aroo7 el doctor ya attune» · «fakarny yom el gom3a el sa3a 3 el 3asr aroo7 el doctor 🙏» · «fakarny enharda el sa3a 8 bel leil akalem Omar!» · «fakarny ba3d bokra el sa3a 10 el sob7 akalem Mohamed 🙏»
- **time N/N N:N ≠ N/N N:N** × 26: «remind me tmrw 5pm to email Nada» · «remind me tmrw 5pm to email Chen» · «remind me tmrw 5pm to email Youssef pls» · «remind me tmrw 5pm to email John pls» · «remind me tmrw 5pm to email Fatima» · «remind me tmrw 5pm to email Tom!»

### remind_repeat
- **not repeating (repeat)** × 42: «every morning at 6 remind me to pay the electricity bill» · «every morning at 9 remind me to wish Sara happy birthday» · «every morning at 7 remind me to call the bank» · «every morning at 9 remind me to back up my phone» · «فكرني كل حد الساعة 8 بالليل اطفي الفرن» · «فكرني كل جمعة الساعة 10 بالليل اطبع التذاكر»

### debt_en
- **→ chat** × 83: «I took 4000 from my mum and will return it next month» · «John still owes me 40000 for the laundry» · «I took 5000 from my wife and will return it next month» · «I gave my neighbour 6500 as a loan» · «Maria has 2000 of mine» · «I have to give my neighbour back 1200»
- **→ money** × 62: «uncle Samir lent me 10000» · «I still owe Mohamed 2500 for the dentist» · «Laila still owes me 4000 for the cinema» · «I still owe John 2500 for the pharmacy» · «I still owe Tom 8000 for petrol» · «Youssef still owes me 25000 for a metro card»
- **person “…” ≠ my friend Ali** × 3: «my friend Ali owes me 500, 250 a month» · «my friend Ali owes me 1200» · «my friend Ali borrowed 2000 from me»
- **person “…” ≠ uncle Samir** × 1: «I owe uncle Samir 700»

### debt_ar
- **→ chat** × 63: «انا عليا 1000 لحسن» · «انا عليا ٢٥٠٠٠ لهنا» · «انا عليا 1200 لمصطفى» · «انا عليا 4000 لحسن» · «انا عليا 6500 لبابا» · «انا عليا 1000 لهنا»
- **→ money** × 40: «خدت من اختي 12000 سلف» · «خدت من كريم 15000 سلف» · «خدت من يوسف ٧٠٠ سلف» · «خدت من ليلى 3000 سلف» · «خدت من فاطمة ٧٠٠ سلف» · «خدت من احمد 5000 سلف»
- **→ ask:teach** × 5: «مراتي لسه مرجعش ال١٠٠٠ اللي استلفهم مني» · «بابا لسه مرجعش ال١٢٠٠٠ اللي استلفهم مني» · «انا عليا ١٥٠٠٠ لصاحبي علي» · «اختي ليه عندي ٢٥٠٠» · «انا عليا ١٥٠٠٠ لبابا»

### repay
- **→ chat** × 40: «Priya returned the 40000 he owed me» · «Sara returned the 3000 he owed me» · «Youssef returned the 8000 he owed me» · «Nada returned the 700 he owed me» · «Hassan returned the 700 he owed me» · «I gave Laila back the 6500 I owed»
- **direction out ≠ in (a debt paid back)** × 34: «Sara paid me back 1000» · «Mohamed paid me back 3000» · «Tom paid me back 2500» · «Mona paid back 1500 of what he owes me» · «John paid me back 1000» · «Chen paid back 3000 of what he owes me»
- **direction in ≠ out (a debt paid back)** × 15: «رجعت 8000 لهنا من اللي عليا» · «رجعت 6500 لندى من اللي عليا» · «رجعت 8000 لعمر من اللي عليا» · «رجعت 1000 لاحمد من اللي عليا» · «رجعت 1200 لندى من اللي عليا» · «رجعت 5000 لعمر من اللي عليا»

### plans
- **each payment N ≠ N** × 33: «قسط الموبايل 1500 كل شهر على 12 شهر» · «قسط الموبايل 200 كل شهر على 10 شهر» · «قسط الموبايل 200 كل شهر على 12 شهر» · «قسط الموبايل 600 كل شهر على 12 شهر» · «قسط الموبايل 1500 كل شهر على 24 شهر» · «قسط الموبايل 120 كل شهر على 36 شهر»
- **→ chat** × 16: «car insurance 200 every year» · «car insurance 12000 every year» · «car insurance 49 every year» · «car insurance 350 every year» · «car insurance 1500 every year» · «car insurance 120 every year»
- **→ money** × 9: «بدفع 99 كل شهر للجيم» · «بدفع 12000 كل شهر للجيم» · «بدفع 600 كل شهر للجيم» · «بدفع 120 كل شهر للجيم» · «بدفع 350 كل شهر للجيم» · «بدفع 200 كل شهر للجيم»

### agents
- **→ chat** × 14: «تابعلي سعر iPhone 16» · «تابعلي سعر a Xiaomi scooter» · «تابعلي سعر an Apple Watch» · «تابعلي سعر an iPad Air» · «تابعلي سعر MacBook Air M3» · «تابعلي سعر Samsung S24»
- **→ money** × 5: «عايز فندق في جدة من 3 ل 7 مارس» · «عايز فندق في دبي من 3 ل 7 مارس» · «عايز فندق في باريس من 3 ل 7 مارس» · «عايز فندق في الرياض من 3 ل 7 مارس» · «عايز فندق في اسطنبول من 3 ل 7 مارس»
- **→ ask:money** × 1: «where is my noon order»

### lists_todos
- **→ chat** × 162: «add to my todo print the tickets» · «I need to submit the assignment» · «new task: wish Priya happy birthday» · «I need to email Laila» · «I have to take the laundry out this week» · «I have to email Karim this week»
- **→ agent/order** × 3: «don't forget: order the cake» · «todo: order the cake» · «new task: order the cake»
- **→ reminder** × 3: «add to my todo call the bank» · «new task: call the bank» · «add to my todo call John»
- **→ teach** × 3: «new task: pay the maid» · «don't forget: pay the maid» · «todo: pay the maid»
- **→ money-ask** × 2: «add to my todo pay the maid» · «add to my todo pay the electricity bill»
- **→ ask:money** × 1: «show my shopping list»
- **→ ask:teach** × 1: «I need to pay the maid»

### notes_where
- **→ chat** × 24: «النضارة فين؟» · «where did I put the charger?» · «where did I put the car papers?» · «الباسبور فين؟» · «where did I put the drill?» · «المفاتيح فين؟»
- **→ teach** × 3: «the glasses is at my mum's house» · «the wallet is at my mum's house» · «the headphones is at my mum's house»
- **→ ask:money** × 2: «where is my old phone?» · «where did I put the old phone?»

### open_call_go
- **→ reminder** × 144: «كلم منى» · «ابعت لزياد واتساب اني جاي» · «اتصل بدينا» · «whatsapp Nada» · «text Laila on telegram: running late» · «call Mohamed»
- **→ chat** × 17: «open Documents» · «go to Money» · «go to Follow-ups» · «go to Agents» · «open Money» · «افتح الفلوس»

### teach_alert_auto
- **→ chat** × 28: «Maria always comes first» · «Priya always comes first» · «Hana always comes first» · «alert me if Tom calls» · «alert me if John calls» · «alert me if Karim calls»

### goals
- **→ chat** × 11: «read 21 books before December 2027» · «read 7 books before December 2027» · «read 16 books before December 2027» · «read 6 books before December 2027» · «read 14 books before December 2027» · «read 12 books before December 2027»

### calc
- **→ chat** × 84: «12 في 30» · «12 على 5» · «4 percent of 2400» · «what's 5% off 25?» · «split 7200 between 3 people» · «what's 15% off 48?»
- **→ confirm** × 16: «250 squared» · «120 squared» · «half of 850» · «20 squared» · «850 squared» · «2400 squared»

### my_money_questions
- **→ chat** × 44: «what are my subscriptions?» · «how much is left in my budget?» · «فاضلي كام الشهر ده؟» · «ليلى عليه كام؟» · «total spent on groceries today» · «معايا كام؟»
- **→ ask:due** × 1: «how much went on restaurants this week?»

### world_questions
- **→ money** × 34: «ترجم "دفعت 2200 في السباك" للانجليزي» · «correct my grammar: i payed 1400 for the internet bill yesterday» · «correct my grammar: i payed 3200 for the vet yesterday» · «translate "I paid 180 for petrol" to French» · «correct my grammar: i payed 450 for the vet yesterday» · «ترجم "دفعت 75 في شاحن جديد" للانجليزي»
- **→ agent/watch** × 23: «ايه احسن موبايل تحت 11000؟» · «ايه احسن لابتوب تحت 2500؟» · «ايه احسن لابتوب تحت 1250000؟» · «ايه احسن لابتوب تحت 12000؟» · «ايه احسن موبايل تحت 9500؟» · «ايه احسن تابلت تحت 65000؟»
- **→ ask:teach** × 9: «tell me a story about a man who owed his friend 220» · «tell me a story about a man who owed his friend 450» · «tell me a story about a man who owed his friend 3200» · «tell me a story about a man who owed his friend 650» · «tell me a story about a man who owed his friend 480» · «tell me a story about a man who owed his friend 2200»
- **→ reminder** × 6: «how do I remind my team about deadlines?» · «what does "remind me tomorrow" mean in French?» · «what does "remind me tomorrow" mean in Turkish?» · «what does "remind me tomorrow" mean in Italian?» · «what does "remind me tomorrow" mean in German?» · «what does "remind me tomorrow" mean in Spanish?»
- **→ ask:money** × 1: «is an Apple Watch worth 4400?»

### numbers_not_money
- **→ money** × 10: «رقم الرحلة 450» · «رقم الرحلة 404» · «رقم الرحلة 819» · «رقم الرحلة 463» · «رقم الرحلة 691» · «رقم الرحلة 761»
- **→ reminder** × 6: «call me on 01014597157» · «call me on 01027397395» · «call me on 01025688838» · «call me on 01017057521» · «call me on 01060143609» · «call me on 01033321032»

### two_orders
- **→ reminder** × 200: «spent 3200 on an uber, also remind me the day after tomorrow at 10 am to send the report» · «جزمة 550 جنيه، وفكرني احجز عند الدكتور بكرة الساعة 9 الصبح» · «spent 135 on the dentist, also remind me tomorrow at 9 am to buy bread» · «القهوة 1100 جنيه، وفكرني اجيب العيال يوم الجمعة الساعة 3 العصر» · «paid 600 for tolls and remind me to check the oven in 2 hours» · «remind me tonight at 8 to charge the power bank and I paid 60 for petrol»

### edits_cancels
- **→ money** × 39: «لا غلط كانت 2200» · «edit the internet amount to 220» · «غير الايجار ل5200» · «edit the rent amount to 600» · «لا غلط كانت 120» · «لا غلط كانت 720»
- **→ life** × 11: «the netflix is 150 now, not 200» · «the netflix is 5200 now, not 5250» · «change the netflix to 480» · «غير الاشتراك ل420» · «edit the netflix amount to 1100» · «edit the netflix amount to 15»
- **→ reminder** × 1: «cancel my reminder to call the bank»
