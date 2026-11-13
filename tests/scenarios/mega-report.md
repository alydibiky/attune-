# 100,000-sentence run — 100000 sentences, 99533 right (99.53%)

Every sentence is different (checked). Each is a hard.mjs sentence typed the way people really type (wake word, filler, thanks, emoji, caps, double spaces) and is checked for WHAT the app does and for the details (amount, direction, hour, person).

| group | sentences | wrong | right % |
|---|---|---|---|
| goals | 1500 | 150 | 90.00 |
| teach_alert_auto | 2000 | 129 | 93.55 |
| my_money_questions | 3000 | 73 | 97.57 |
| edits_cancels | 1400 | 11 | 99.21 |
| multi_spend | 4000 | 22 | 99.45 |
| spend_franco | 4000 | 20 | 99.50 |
| debt_en | 4500 | 21 | 99.53 |
| lists_todos | 3500 | 12 | 99.66 |
| spend_story_ar | 4500 | 12 | 99.73 |
| world_questions | 3500 | 8 | 99.77 |
| debt_ar | 4000 | 8 | 99.80 |
| remind_en_time | 5500 | 1 | 99.98 |
| spend_story_en | 4500 | 0 | 100.00 |
| spend_short_mix | 4500 | 0 | 100.00 |
| spend_words | 3000 | 0 | 100.00 |
| income | 4000 | 0 | 100.00 |
| not_a_payment | 5000 | 0 | 100.00 |
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
- **→ confirm** × 12: «هدية  مع اخويا امبارح بالليل ٨٠٠ جنيه.» · «يا عم المغسلة مع بابا امبارح بالليل ٩٥ جنيه لو سمحت» · «يا عم العشا مع ماما امبارح بالليل ٤٥٠٠ جنيه يا معلم» · «بقولك ايه، الركنة مع بابا امبارح بالليل ١٣٥ جنيه» · «يا عم الركنة مع اختي امبارح بالليل ٥٢٠٠ جنيه...» · «يا  أتيون، الحلاق مع اختي امبارح بالليل ١٥٠٠ جنيه ❤️»

### spend_franco
- **→ confirm** × 20: «el net kan b 300 thanks» · «el net kan b 220 thanks» · «pls el net kan b 300...» · «ok el net kan b 60» · «hey attune, el net kan b 150» · «btw el net kan b 600 🙏»

### multi_spend
- **amounts N ≠ N+N** × 12: «معلش  دفعت 1250 تذاكر الاتوبيس و 950 خضار!!» · «دفعت 480 تذاكر الاتوبيس و 35 السباك 🙏» · «دفعت 110 تذاكر الاتوبيس و 85 الغدا» · «اسمع دفعت 4500 تذاكر الاتوبيس و 175 البيطري!!» · «اسمع دفعت 85 تذاكر الاتوبيس و 4500 بنزين!!» · «hey  attune, دفعت 450 الصيدلية و 350 تذاكر الاتوبيس ميرسي»
- **→ chat** × 10: «صرفت 1500 على خضار وبعدين 180 على فاكهة...» · «ok tolls 15 ⏎ dinner 75 ⏎ the laundry 2500.» · «quick one - tolls 4500 ⏎ lunch 350 ⏎ the laundry 180...» · «بص صرفت 85 على فاكهة وبعدين 120 على خضار» · «ok so the plumber 75 ⏎ the vet 480 ⏎ lunch 420.» · «صرفت  275 على القهوة وبعدين 25 على بيتزا لو سمحت»

### remind_en_time
- **time N/N N:N ≠ N/N N:N** × 1: «so, please remind me to email Tom at 18:45»

### debt_en
- **person “…” ≠ my friend Ali** × 16: «ok i borrowed 12000 from my friend ali 👍» · «my friend ali lent me 1000» · «i owe my friend ali 25000, paying 500 a month 👍» · «hi! my friend ali needs to return my 10000» · «btw i took 12000 from my friend ali and will return it next month ok?» · «um, my friend ali lent me 1500 👍»
- **every null ≠ month** × 5: «my boss owes me 500, 500 a month!!» · «listen, Tom owes me 500, 500 a month.» · «ok i owe ziad 500, paying 500 a month!!» · «um,  I owe John 500, paying 500 a month 🙏» · «um, I owe my wife 500, paying 500 a month ok?»

### debt_ar
- **→ chat** × 8: «بقولك  ايه، اديت ابن عمي 25000 سلف شكرا» · «اديت ابن عمي ١٠٠٠٠ سلف!!» · «معلش  اديت ابن عمي ١٠٠٠٠ سلف...» · «طيب اديت ابن عمي ٥٠٠٠ سلف ❤️» · «يا  أتيون، اديت ابن عمي 12000 سلف ميرسي» · «hey attune, اديت ابن عمي 2500 سلف»

### lists_todos
- **→ chat** × 12: «اسمع لازم ادفع فاتورة الكهربا لو سمحت» · «لازم ادفع فاتورة الكهربا.» · «لازم ادفع للشغالة!!» · «اسمع لازم ادفع فاتورة الكهربا!!» · «يا  أتيون، لازم ادفع فاتورة الكهربا شكرا» · «يا اتيون لازم ادفع فاتورة الكهربا ❤️»

### teach_alert_auto
- **→ chat** × 129: «Attune: Tom always comes first thx!» · «Hana always comes first» · «um, Maria always comes first thanks» · «so, omar always comes first thx!» · «btw Mona always comes first thx!» · «quick one - Mona always comes first 🙏»

### goals
- **→ chat** × 150: «read 10 books before December 2027 👍» · «quick one - read 19 books before December 2027» · «read 9 books before December 2027 👍» · «hey, read 21 books before December 2027 thx!» · «pls read 17 books before december 2027!!» · «BTW READ 6 BOOKS BEFORE DECEMBER 2027!!»

### my_money_questions
- **→ chat** × 73: «what are my subscriptions? pls» · «btw what are my subscriptions? 🙏» · «quick one - what are my subscriptions? 👍» · «hey, what are my subscriptions?» · «quick one - what are my subscriptions?» · «hi! what are my subscriptions?»

### world_questions
- **→ ask:money** × 8: «is an apple watch worth 13000? 👍» · «ok so is an Apple Watch worth 28000? pls» · «btw is an Apple Watch worth 5500?» · «listen, is an apple watch worth 1500? ty» · «um, is an Apple Watch worth 900? ty» · «um, is an Apple Watch worth 2200? thanks»

### edits_cancels
- **→ reminder** × 11: «cancel my reminder to call john...» · «cancel my reminder to call Laila» · «so, cancel my reminder to call the bank» · «listen, cancel my reminder to call the bank thx!» · «BTW CANCEL MY REMINDER TO CALL YOUSSEF» · «cancel my reminder to call the bank!!»
