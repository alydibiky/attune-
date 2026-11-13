# 100,000 chat orders — 100000 orders, 99389 right (99.39%)

Every order is different (checked). "Left to the model" = the code saw two possible kinds (or a kind only the words show) and the phone's model picks — counted right here only when the right kind is among its choices; the real model is tried on a sample by tests/trials/chat100k-model.mjs. 1 orders (0.0%) were left to the model.

| group | orders | wrong | left to the model | right % |
|---|---|---|---|---|
| story_spend | 10000 | 496 | 0 | 95.04 |
| indirect_remind_en | 9000 | 54 | 0 | 99.40 |
| two_orders_hard | 6000 | 31 | 1 | 99.48 |
| own_data_questions | 7000 | 30 | 0 | 99.57 |
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
- **time N/N N:N ≠ N/N N:N** × 54: «heads up at 7:30 am tomorrow: send Laila the photos» · «heads up at 7:30 am tomorrow: check the oven» · «heads up at 7:30 am tomorrow: charge the power bank» · «heads up at 9:15 pm: move the car» · «heads up at 9:15 pm: call the bank» · «heads up at 7:30 am tomorrow: water the plants»

### story_spend
- **→ chat** × 318: «breakfast for 75, invoice 8019» · «dinner for 320, invoice 1297» · «coffee for 15, invoice 7433» · «after the 5-hour meeting in room 404 I grabbed cat food for 15» · «long day, 2 meetings, then the gym for 850 at Spinneys» · «vegetables for 450, invoice 8322»
- **extra amounts N+N** × 165: «long day, 5 meetings, then a haircut for 290 at Costa» · «long day, 3 meetings, then parking for 1400 at Zooba» · «long day, 6 meetings, then a gift for 550 at Carrefour» · «long day, 7 meetings, then the plumber for 3800 at the airport» · «long day, 9 meetings, then tolls for 350 at the airport» · «long day, 5 meetings, then the vet for 1100 at the office canteen»
- **→ reminder** × 13: «بعد اجتماع 2 ساعات في اوضة 416 اشتريت الجيم ب15» · «بعد اجتماع 3 ساعات في اوضة 191 اشتريت الجيم ب60» · «بعد اجتماع 9 ساعات في اوضة 799 اشتريت الجيم ب145» · «بعد اجتماع 4 ساعات في اوضة 444 اشتريت الجيم ب300» · «بعد اجتماع 6 ساعات في اوضة 762 اشتريت الجيم ب450» · «بعد اجتماع 6 ساعات في اوضة 707 اشتريت الجيم ب1400»

### two_orders_hard
- **→ money** × 31: «paid 250 for the gym and don't let me forget to call Ziad in 20 minutes» · «paid 110 for coffee and don't let me forget to call the bank in an hour» · «paid 1500 for groceries and don't let me forget to call the bank in 2 hours» · «paid 2500 for the barber and don't let me forget to call Laila in an hour» · «paid 2500 for the cinema and don't let me forget to call the bank in 20 minutes» · «paid 720 for a metro card and don't let me forget to call the bank in 20 minutes»

### own_data_questions
- **→ chat** × 30: «what's my taxis total since the 1st?» · «what's my restaurants total since the 1st?» · «what's my restaurants total since the 1st?!!» · «btw what's my taxis total since the 1st?» · «btw what's my restaurants total since the 1st?!!» · «what's my taxis total since the 1st?...»
