# Notification run (HARD) — 10000 notifications, 9987 handled right (99.9%) — 4220 different shapes [42 of 100]

- Became money when it is NOT a payment: **0** (added by itself, without a tap: **0**)
- Interruptions (v9.9.30 — a question, or a card waiting for a tap, for something Attune could do itself): **2**
- What it is (the kind Recall files it under): 4707 of 4745 right (99.2%)

| area | notifications | wrong | right % | kind wrong |
|---|---|---|---|---|
| calls | 300 | 11 | 96.3 | 0 of 300 |
| bank_world | 400 | 1 | 99.8 | – |
| delivery | 500 | 1 | 99.8 | 0 of 481 |
| bank_composed | 1600 | 0 | 100.0 | 34 of 708 |
| bank_cib_real | 200 | 0 | 100.0 | 0 of 168 |
| bank_eg_out | 250 | 0 | 100.0 | 0 of 237 |
| bank_eg_in | 250 | 0 | 100.0 | 4 of 250 |
| bank_gulf | 250 | 0 | 100.0 | 0 of 250 |
| bank_not_money | 300 | 0 | 100.0 | 0 of 12 |
| receipts | 500 | 0 | 100.0 | – |
| subscriptions | 400 | 0 | 100.0 | – |
| sub_future | 300 | 0 | 100.0 | – |
| ads | 400 | 0 | 100.0 | 0 of 339 |
| media | 350 | 0 | 100.0 | – |
| rides | 250 | 0 | 100.0 | 0 of 250 |
| chat_plain | 450 | 0 | 100.0 | 0 of 450 |
| chat_asks | 300 | 0 | 100.0 | 0 of 300 |
| chat_money | 400 | 0 | 100.0 | – |
| chat_numbers | 250 | 0 | 100.0 | 0 of 250 |
| calendar | 250 | 0 | 100.0 | 0 of 250 |
| bills_due | 350 | 0 | 100.0 | – |
| travel | 250 | 0 | 100.0 | 0 of 250 |
| security | 250 | 0 | 100.0 | 0 of 250 |
| system | 200 | 0 | 100.0 | – |
| health | 150 | 0 | 100.0 | – |
| scam | 300 | 0 | 100.0 | – |
| gov | 200 | 0 | 100.0 | – |
| points_prices | 200 | 0 | 100.0 | – |
| email_misc | 200 | 0 | 100.0 | – |

## What went wrong (examples of each)

### bank_composed
- kind read as **message** × 18: «Messages · ALEXBANK: Dear Client - L.E 19,005 has been charged - to B.TECH - from a/c ****8970 - Bal: EGP201,984.49 - Not you? Call» · «Messages · CIB: DEAR CLIENT. LE 33,094.99 HAS BEEN CHARGED. ON 7-10-2026. AT HYPER ONE. FROM ACCOUNT ENDING 1650. NOT YOU? CAL» · «Messages · AAIB: تم دفع 35592 ج.م لصالح التوحيد والنور من حسابك رقم ****5580 شكرا لاستخدامك خدماتنا»
- kind read as **promo** × 16: «Messages · AAIB: يرجى العلم انه. خصم 17193 LE. من حسابك المنتهي بـ ********1119. في 2/12/26. لصالح التوحيد والنور. لو لم تقم به» · «Messages · AAIB: خصم 23,744.00 ج.م, ⏎ من حسابك المنتهي بـ ********2127, بتاريخ 16/8/26, رقم مرجعي 99670059, شكرا لاستخدامك خدما» · «Messages · Banque du Caire: يرجى العلم انه. خصم 9668.00 ج.م. من حسابك المنتهي بـ ********2454. لصالح أوبر. رقم العملية 14261998»

### bank_eg_in
- kind read as **other** × 4: «Vodafone Cash · Vodafone Cash: وصلك ٧٢٨٥٫٠٠ جم من 01025981822 على فودافون كاش» · «Vodafone Cash · Vodafone Cash: وصلك ٤٢,٤٠٦.٠٠ جم من ٠١٠٥٤٨٠٨٥٢٧ على فودافون كاش» · «Vodafone Cash · Vodafone Cash: وصلك 2513.00 جم من 01068627603 على فودافون كاش»

### bank_world
- **amount N ≠ N** × 1: «Messages · Meezan: ‏RS.2,048 DEBITED FROM A/C *5678 VIA RAAST TRANSFER TO USMAN KHAN ON ‎10-11-2026. BAL RS.18,400»

### delivery
- **no “…” (nothing)** × 1: «noon · noon: تم شحن طلبك وهيوصل يوم الإحد»

### calls
- **no “…” (nothing)** × 11: «Phone · Missed call: JOHN » · «Phone · Missed call: YOUSSEF WORK» · «Phone · Missed call: BABA WORK» · «Phone · Missed call: SALMA WORK»
