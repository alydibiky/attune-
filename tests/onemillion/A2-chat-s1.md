# 100,000 chat orders — 100000 orders, 99366 right (99.37%)

Every order is different (checked). "Left to the model" = the code saw two possible kinds (or a kind only the words show) and the phone's model picks — counted right here only when the right kind is among its choices; the real model is tried on a sample by tests/trials/chat100k-model.mjs. 0 orders (0.0%) were left to the model.

| group | orders | wrong | left to the model | right % |
|---|---|---|---|---|
| story_spend | 10000 | 504 | 0 | 94.96 |
| indirect_remind_en | 9000 | 75 | 0 | 99.17 |
| two_orders_hard | 6000 | 28 | 0 | 99.53 |
| own_data_questions | 7000 | 27 | 0 | 99.61 |
| indirect_remind_ar | 7000 | 0 | 0 | 100.00 |
| corrections | 6000 | 0 | 0 | 100.00 |
| negations | 6000 | 0 | 0 | 100.00 |
| open_pages | 5000 | 0 | 0 | 100.00 |
| ai_questions_numbers | 10000 | 0 | 0 | 100.00 |
| debts_odd | 8000 | 0 | 0 | 100.00 |
| agents_odd | 6000 | 0 | 0 | 100.00 |
| other_languages | 14000 | 0 | 0 | 100.00 |
| franco_hard | 6000 | 0 | 0 | 100.00 |

## What went wrong (examples of each)

### indirect_remind_en
- **time N/N N:N ≠ N/N N:N** × 75: «heads up at 7:30 am tomorrow: feed the cat» · «heads up at 7:30 am tomorrow: water the plants» · «heads up tomorrow at 6:30 in the morning: wish Nada happy birthday» · «heads up tomorrow at 6:30 in the morning: back up my phone» · «heads up at 7:30 am tomorrow: pick up the kids» · «heads up at 9:15 pm: pay the electricity bill»

### story_spend
- **→ chat** × 322: «pizza for 175, invoice 4999» · «a birthday cake for 15, invoice 1955» · «vegetables for 480, invoice 5364» · «long day, 7 meetings, then a birthday cake for 780 at Starbucks» · «long day, 3 meetings, then the gym for 240 at Spinneys» · «after the 4-hour meeting in room 602 I grabbed breakfast for 1750»
- **extra amounts N+N** × 163: «long day, 9 meetings, then tolls for 1100 at Spinneys» · «long day, 3 meetings, then the barber for 85 at Starbucks» · «long day, 4 meetings, then the laundry for 300 at the office canteen» · «long day, 4 meetings, then the vet for 650 at the airport» · «long day, 4 meetings, then tolls for 15 at the office canteen» · «long day, 4 meetings, then lunch for 210 at the club»
- **→ reminder** × 19: «بعد اجتماع 5 ساعات في اوضة 424 اشتريت الجيم ب45» · «بعد اجتماع 7 ساعات في اوضة 319 اشتريت الجيم ب110» · «بعد اجتماع 8 ساعات في اوضة 832 اشتريت الجيم ب75» · «بعد اجتماع 2 ساعات في اوضة 247 اشتريت الجيم ب480» · «بعد اجتماع 8 ساعات في اوضة 750 اشتريت الجيم ب1400» · «بعد اجتماع 9 ساعات في اوضة 707 اشتريت الجيم ب175»

### two_orders_hard
- **→ money** × 27: «paid 150 for a haircut and don't let me forget to call the bank in 2 hours» · «paid 95 for flowers and don't let me forget to call Priya in an hour and a half» · «paid 290 for vegetables and don't let me forget to call Tom in 2 hours» · «paid 350 for car wash and don't let me forget to call the bank in 20 minutes» · «paid 3800 for breakfast and don't let me forget to call David in 20 minutes» · «paid 175 for a metro card and don't let me forget to call Fatima in 20 minutes»
- **reminder time N/N N:N ≠ N/N N:N** × 1: «paid 950 for a haircut and don't let me forget to call Tom at 18:45»

### own_data_questions
- **→ chat** × 27: «what's my taxis total since the 1st?» · «what's my restaurants total since the 1st?» · «what's my restaurants total since the 1st?!!» · «ok so what's my restaurants total since the 1st?» · «what's my taxis total since the 1st? 🙏» · «hey attune, what's my taxis total since the 1st?...»
