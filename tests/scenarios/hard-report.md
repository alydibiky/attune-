# Hard scenario run — 10000 sentences, 9929 right (99.3%)

Every sentence is different; each is checked for WHAT the app does and for the details (amount, direction, hour, person).

| group | sentences | wrong | right % |
|---|---|---|---|
| goals | 150 | 11 | 92.7 |
| open_call_go | 250 | 17 | 93.2 |
| teach_alert_auto | 200 | 13 | 93.5 |
| agents | 400 | 13 | 96.8 |
| plans | 450 | 7 | 98.4 |
| multi_spend | 400 | 4 | 99.0 |
| edits_cancels | 140 | 1 | 99.3 |
| lists_todos | 350 | 2 | 99.4 |
| my_money_questions | 300 | 1 | 99.7 |
| world_questions | 350 | 1 | 99.7 |
| spend_short_mix | 450 | 1 | 99.8 |
| spend_story_en | 450 | 0 | 100.0 |
| spend_story_ar | 450 | 0 | 100.0 |
| spend_words | 300 | 0 | 100.0 |
| spend_franco | 400 | 0 | 100.0 |
| income | 400 | 0 | 100.0 |
| not_a_payment | 500 | 0 | 100.0 |
| remind_en_time | 550 | 0 | 100.0 |
| remind_ar_time | 500 | 0 | 100.0 |
| remind_mixed | 200 | 0 | 100.0 |
| remind_repeat | 300 | 0 | 100.0 |
| debt_en | 450 | 0 | 100.0 |
| debt_ar | 400 | 0 | 100.0 |
| repay | 300 | 0 | 100.0 |
| deadlines | 250 | 0 | 100.0 |
| notes_where | 250 | 0 | 100.0 |
| calc | 350 | 0 | 100.0 |
| smalltalk | 60 | 0 | 100.0 |
| numbers_not_money | 250 | 0 | 100.0 |
| two_orders | 200 | 0 | 100.0 |

## What went wrong (examples of each)

### spend_short_mix
- **→ confirm** × 1: «البيطري: 7500»

### multi_spend
- **→ chat** × 4: «today: lunch 480; the vet 150» · «today: breakfast 420; cat food 950» · «صرفت 420 على تورتة وبعدين 480 على فاكهة» · «today: lunch 1750; tolls 120»

### plans
- **→ chat** × 7: «anghami 4500 every month» · «anghami 200 every month» · «anghami 4500 monthly» · «anghami 12000 monthly» · «anghami 99 monthly» · «anghami 350 every month»

### agents
- **→ money** × 12: «book me a hotel in London from 3 to 7 March» · «book me a hotel in Riyadh from 3 to 7 March» · «book me a hotel in Kuala Lumpur from 3 to 7 March» · «book me a hotel in Dubai from 3 to 7 March» · «book me a hotel in Berlin from 3 to 7 March» · «book me a hotel in Madrid from 3 to 7 March»
- **→ where** × 1: «where is my noon order»

### lists_todos
- **→ chat** × 2: «لازم ادفع للشغالة» · «لازم ادفع فاتورة الكهربا»

### open_call_go
- **→ reminder** × 17: «text Laila on telegram: running late» · «text Priya on telegram: running late» · «text Sara on telegram: running late» · «text Aisha on telegram: running late» · «text Fatima on telegram: running late» · «text Youssef on telegram: running late»

### teach_alert_auto
- **→ chat** × 13: «Maria always comes first» · «Priya always comes first» · «Hana always comes first» · «Sara always comes first» · «Youssef always comes first» · «Laila always comes first»

### goals
- **→ chat** × 11: «read 21 books before December 2027» · «read 7 books before December 2027» · «read 16 books before December 2027» · «read 6 books before December 2027» · «read 14 books before December 2027» · «read 12 books before December 2027»

### my_money_questions
- **→ chat** × 1: «what are my subscriptions?»

### world_questions
- **→ ask:money** × 1: «is an Apple Watch worth 4400?»

### edits_cancels
- **→ reminder** × 1: «cancel my reminder to call the bank»
