# 100,000 chat orders — 100000 orders, 99996 right (100.00%)

Every order is different (checked). "Left to the model" = the code saw two possible kinds (or a kind only the words show) and the phone's model picks — counted right here only when the right kind is among its choices; the real model is tried on a sample by tests/trials/chat100k-model.mjs. 0 orders (0.0%) were left to the model.

| group | orders | wrong | left to the model | right % |
|---|---|---|---|---|
| indirect_remind_en | 9000 | 3 | 0 | 99.97 |
| two_orders_hard | 6000 | 1 | 0 | 99.98 |
| indirect_remind_ar | 7000 | 0 | 0 | 100.00 |
| corrections | 6000 | 0 | 0 | 100.00 |
| negations | 6000 | 0 | 0 | 100.00 |
| story_spend | 10000 | 0 | 0 | 100.00 |
| open_pages | 5000 | 0 | 0 | 100.00 |
| ai_questions_numbers | 10000 | 0 | 0 | 100.00 |
| own_data_questions | 7000 | 0 | 0 | 100.00 |
| debts_odd | 8000 | 0 | 0 | 100.00 |
| agents_odd | 6000 | 0 | 0 | 100.00 |
| other_languages | 14000 | 0 | 0 | 100.00 |
| franco_hard | 6000 | 0 | 0 | 100.00 |

## What went wrong (examples of each)

### indirect_remind_en
- **time N/N N:N ≠ N/N N:N** × 3: «if you could remind me to email Tom at 9:15 pm that would be great» · «please don't let me forget to call Tom at 18:45» · «can you make sure I email Tom at 9:15 pm»

### two_orders_hard
- **reminder time N/N N:N ≠ N/N N:N** × 1: «paid 950 for a haircut and don't let me forget to call Tom at 18:45»
