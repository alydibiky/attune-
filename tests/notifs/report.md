# Notification run — 10000 notifications, 10000 handled right (100.0%) — 2649 different shapes [26 of 100]

- Became money when it is NOT a payment: **0** (added by itself, without a tap: **0**)
- Interruptions (v9.9.30 — a question, or a card waiting for a tap, for something Attune could do itself): **0**
- What it is (the kind Recall files it under): 4739 of 4785 right (99.0%)

| area | notifications | wrong | right % | kind wrong |
|---|---|---|---|---|
| bank_composed | 1600 | 0 | 100.0 | 46 of 739 |
| bank_cib_real | 200 | 0 | 100.0 | 0 of 167 |
| bank_eg_out | 250 | 0 | 100.0 | 0 of 232 |
| bank_eg_in | 250 | 0 | 100.0 | 0 of 250 |
| bank_gulf | 250 | 0 | 100.0 | 0 of 250 |
| bank_world | 400 | 0 | 100.0 | – |
| bank_not_money | 300 | 0 | 100.0 | 0 of 11 |
| receipts | 500 | 0 | 100.0 | – |
| subscriptions | 400 | 0 | 100.0 | – |
| sub_future | 300 | 0 | 100.0 | – |
| ads | 400 | 0 | 100.0 | 0 of 344 |
| media | 350 | 0 | 100.0 | – |
| delivery | 500 | 0 | 100.0 | 0 of 492 |
| rides | 250 | 0 | 100.0 | 0 of 250 |
| calls | 300 | 0 | 100.0 | 0 of 300 |
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
- kind read as **promo** × 29: «Messages · BanqueMisr: عزيزي العميل. خصم 13235.25 EGP. ببطاقة رقم **1602. لصالح فوري. في 17/9/26. للاستفسار 19666» · «Messages · HSBC: عميلنا العزيز، ⏎ خصم 85,420 ج.م ⏎ يوم 27 Nov ⏎ بطاقة الخصم المباشر 7974* ⏎ الرصيد 3,169,108.57 EGP ⏎ لو لم تقم» · «Messages · AAIB: عزيزي العميل, خصم 88,235 EGP, من بطاقتك المنتهية بـ 3669, لصالح طلبات, بتاريخ 3-6-2026, لو لم تقم بهذه العملية»
- kind read as **message** × 17: «Messages · ADIB: LE 25075 has been charged ⏎ on 2026-08-21 21:24 ⏎ at KAZYON ⏎ from a/c ****3659 ⏎ Thank you for banking with u» · «Messages · Credit Agricole: Dear Client - L.E 12217 has been charged - from account ending 2386 - 16-2-2026 - Ref 96416957 - Bal: LE 413,1» · «Messages · QNB: L.E 17,198.00 has been charged; 25-10-2026; Txn ID 43845966; at AMAZON.EG; from a/c ****1794; Bal: LE 364625.2»
