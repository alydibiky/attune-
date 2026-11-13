# Notification comprehension — real model

Model: qwen3.5-4b · 104 notifications · 11.6 s each on this machine (4 CPU cores) · not JSON: 0 · invented number / date dropped by the checker: 7

| set | n | code alone | model alone | code + model |
|---|---|---|---|---|
| 10k-sure | 2 | 100.0% | 50.0% | 100.0% |
| 10k-unsure | 6 | 83.3% | 16.7% | 16.7% |
| heldout | 60 | 100.0% | 31.7% | 95.0% |
| heldout2 | 36 | 91.7% | 25.0% | 80.6% |

(right = kind, reason and what to do all right)

## Still wrong after code + model
- [10k-unsure] want school/info/none · code school/info/none · model school/info/read · «Classroom: Your teacher posted grades for Math»
- [10k-unsure] want food/info/none · code food/info/none · model delivery/info/none · «talabat: طلبك من Mo'men بيتجهز»
- [10k-unsure] want email/question/reply · code email/request/reply · model email/invite/attend · «Tarek Hassan: ممكن نتقابل يوم 20 نوفمبر الساعة 18:00 نراجع الخطة؟»
- [10k-unsure] want school/info/none · code school/info/none · model school/info/read · «Classroom: Ton professeur a publié les notes de maths»
- [10k-unsure] want email/question/reply · code email/question/reply · model email/invite/attend · «Dina Hassan: ¿Nos vemos mañana a las 09:30 para revisar el plan?»
- [heldout] want food/info/none · code food/info/none · model delivery/info/pickup · «elmenus: Your food is on the way 🛵»
- [heldout] want school/info/none · code school/info/none · model school/info/read · «Classroom: Ms. Heba posted a new announcement in Science 2A»
- [heldout] want email/question/reply · code email/question/reply · model email/invite/attend · «Hany Fouad: Do you have time on Thursday to discuss the contract?»
- [heldout2] want chat/info/none · code chat/info/none · model travel/greeting/none · «Sherif: Just landed ✈️»
- [heldout2] want chat/info/none · code chat/info/none · model work/info/none · «Work team: Nada: The client paid the 50,000 deposit today 🎉»
- [heldout2] want food/info/none · code food/info/none · model delivery/alert/pickup · «talabat: Your rider is 5 minutes away 🛵»
- [heldout2] want job/info/none · code job/info/none · model job/offer/check · «Wuzzuf: 5 new jobs match your profile: Accountant»
- [heldout2] want chat/request/do · code chat/info/none · model work/request/reply · «Дима: Пришли мне, пожалуйста, договор завтра»
- [heldout2] want chat/request/do · code chat/info/none · model work/request/submit · «小王: 明天请把合同发给我»
- [heldout2] want chat/invite/reply · code chat/info/none · model social/invite/attend · «Yuki: 土曜日の夕食に来ませんか？»
