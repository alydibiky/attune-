# Notification comprehension — real model

Model: qwen3.5-4b · 104 notifications · 13.3 s each on this machine (4 CPU cores) · not JSON: 0 · invented number / date dropped by the checker: 7

| set | n | code alone | model alone | code + model |
|---|---|---|---|---|
| 10k-sure | 2 | 100.0% | 100.0% | 100.0% |
| 10k-unsure | 6 | 83.3% | 50.0% | 83.3% |
| heldout | 60 | 100.0% | 68.3% | 100.0% |
| heldout2 | 36 | 91.7% | 63.9% | 97.2% |

(right = kind, reason and what to do all right)

## Still wrong after code + model
- [10k-unsure] want email/question/reply · code email/request/reply · model email/invite/reply · «Tarek Hassan: ممكن نتقابل يوم 20 نوفمبر الساعة 18:00 نراجع الخطة؟»
- [heldout2] want chat/info/none · code chat/info/none · model chat/confirm/none · «Work team: Nada: The client paid the 50,000 deposit today 🎉»
