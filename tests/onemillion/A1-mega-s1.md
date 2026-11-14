# 100,000-sentence run — 100000 sentences, 99503 right (99.50%)

Every sentence is different (checked). Each is a hard.mjs sentence typed the way people really type (wake word, filler, thanks, emoji, caps, double spaces) and is checked for WHAT the app does and for the details (amount, direction, hour, person).

| group | sentences | wrong | right % |
|---|---|---|---|
| goals | 1500 | 156 | 89.60 |
| teach_alert_auto | 2000 | 137 | 93.15 |
| my_money_questions | 3000 | 62 | 97.93 |
| multi_spend | 4000 | 32 | 99.20 |
| edits_cancels | 1400 | 11 | 99.21 |
| lists_todos | 3500 | 24 | 99.31 |
| debt_en | 4500 | 25 | 99.44 |
| spend_franco | 4000 | 21 | 99.47 |
| spend_story_ar | 4500 | 13 | 99.71 |
| debt_ar | 4000 | 9 | 99.78 |
| world_questions | 3500 | 7 | 99.80 |
| spend_story_en | 4500 | 0 | 100.00 |
| spend_short_mix | 4500 | 0 | 100.00 |
| spend_words | 3000 | 0 | 100.00 |
| income | 4000 | 0 | 100.00 |
| not_a_payment | 5000 | 0 | 100.00 |
| remind_en_time | 5500 | 0 | 100.00 |
| remind_ar_time | 5000 | 0 | 100.00 |
| remind_mixed | 2000 | 0 | 100.00 |
| remind_repeat | 3000 | 0 | 100.00 |
| repay | 3000 | 0 | 100.00 |
| plans | 4500 | 0 | 100.00 |
| deadlines | 2500 | 0 | 100.00 |
| agents | 4000 | 0 | 100.00 |
| notes_where | 2500 | 0 | 100.00 |
| open_call_go | 2500 | 0 | 100.00 |
| calc | 3500 | 0 | 100.00 |
| smalltalk | 600 | 0 | 100.00 |
| numbers_not_money | 2500 | 0 | 100.00 |
| two_orders | 2000 | 0 | 100.00 |

## What went wrong (examples of each)

### spend_story_ar
- **→ confirm** × 13: «يا عم جزمة مع جوزي امبارح بالليل ١١٠ جنيه 🙏» · «طيب  الحلاق مع مديري امبارح بالليل ٦٠ جنيه!!» · «طيب  خضار مع اختي امبارح بالليل ١٨٠٠٠ جنيه.» · «ورد مع مراتي امبارح بالليل ٢٧٥ جنيه» · «طيب  هدية مع بابا امبارح بالليل ٧٥ جنيه!!» · «طيب دوا مع جوزي امبارح بالليل ٢٢٠٠ جنيه يا معلم»

### spend_franco
- **→ confirm** × 21: «ok el net kan b 1400» · «el net kan b 150 thanks» · «so, el net kan b 2200» · «Attune: el net kan b 350 thx!» · «so, el net kan b 600 🙏» · «um, el net kan b 7500 thanks»

### multi_spend
- **amounts N ≠ N+N** × 19: «بص دفعت 3200 تذاكر الاتوبيس و 5200 الركنة» · «بص  دفعت 1750 الميكانيكي و 110 تذاكر الاتوبيس يا معلم» · «دفعت 1400 تورتة و 3200 تذاكر الاتوبيس لو سمحت» · «يا أتيون، دفعت 150 تذاكر الاتوبيس و 12500 ورد ❤️» · «يا عم دفعت 250 الركنة و 350 تذاكر الاتوبيس شكرا» · «بقولك شاحن جديد 120 وفاتورة الكهربا 60.»
- **→ chat** × 11: «Attune: the gym 5200 ⏎ an uber 180 ⏎ medicine 12500 👍» · «اسمع صرفت 2500 على ورد وبعدين 1100 على بيتزا ميرسي» · «hey attune, صرفت 35 على فاكهة وبعدين 120 على خضار!!» · «ok so the mechanic 45 ⏎ a haircut 175 ⏎ lunch 2200» · «صرفت  1100 على ورد وبعدين 850 على تورتة يا معلم» · «صرفت 1250 على خضار وبعدين 600 على القهوة»
- **→ life** × 2: «يا  اتيون صرفت 480 على الجيم وبعدين 85 على اكل القطة.» · «يا أتيون، اكل القطة 450 والجيم 7500»

### debt_en
- **person “…” ≠ my friend Ali** × 13: «btw borrowed 25000 from my friend ali for clothes pls» · «hi! borrowed 6500 from my friend ali for the plumber ok?» · «ok i'm in debt to my friend ali for 2000!!» · «attune i took 25000 from my friend ali and will return it next month» · «i owe my friend ali 1200, paying 100 a month thanks» · «ok i gave my friend ali 4000 as a loan ok?»
- **every null ≠ month** × 12: «my dad owes me 500, 500 a month thanks» · «attune I owe Omar 500, paying 500 a month» · «attune: i owe my brother 500, paying 500 a month 🙏» · «priya owes me 500, 500 a month!!» · «BTW I OWE MARIA 500, PAYING 500 A MONTH 👍» · «yo I owe Hana 500, paying 500 a month»

### debt_ar
- **→ chat** × 9: «اديت ابن عمي 15000 سلف ❤️» · «يا عم اديت ابن عمي 15000 سلف» · «اديت ابن عمي ٢٠٠٠ سلف ❤️» · «يا اتيون اديت ابن عمي 2000 سلف لو سمحت» · «يا اتيون اديت ابن عمي ١٠٠٠ سلف ميرسي» · «اسمع اديت ابن عمي 10000 سلف...»

### lists_todos
- **→ chat** × 24: «بص لازم ادفع للشغالة.» · «لازم  ادفع للشغالة 🙏» · «يا اتيون لازم ادفع للشغالة...» · «لازم ادفع فاتورة الكهربا 🙏» · «يا  عم لازم ادفع للشغالة ❤️» · «طيب لازم ادفع للشغالة!!»

### teach_alert_auto
- **→ chat** × 137: «hey attune, fatima always comes first» · «attune Sara always comes first pls» · «ok so John always comes first» · «Tom always comes first» · «hey attune, maria always comes first 🙏» · «hey, Chen always comes first»

### goals
- **→ chat** × 156: «read 14 books before December 2027» · «yo read 6 books before December 2027 thx!» · «Attune:  read 8 books before December 2027» · «listen, read 12 books before December 2027!!» · «read 17 books before december 2027» · «read 23 books before December 2027 thx!»

### my_money_questions
- **→ chat** × 62: «what are my subscriptions?» · «quick one - what are my subscriptions?» · «pls what are my subscriptions?» · «ok what are my subscriptions?» · «ok what are my subscriptions? pls» · «hey, what are my subscriptions?»

### world_questions
- **→ ask:money** × 7: «attune is an Apple Watch worth 3500?» · «pls is an Apple Watch worth 5500? ty» · «so, is an Apple Watch worth 3000?» · «hi! is an Apple Watch worth 9600? thanks» · «yo is an Apple Watch worth 12000? thanks» · «ok so is an Apple Watch worth 1500?.»

### edits_cancels
- **→ reminder** × 11: «yo cancel my reminder to call the bank» · «cancel  my reminder to call Tom.» · «um, cancel my reminder to call the bank.» · «ok so cancel my reminder to call the bank thx!» · «pls cancel my reminder to call Ahmed...» · «yo cancel my reminder to call Aisha thx!»
