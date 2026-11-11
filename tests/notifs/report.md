# Notification run — 10000 notifications, 8424 handled right (84.2%)

- Became money when it is NOT a payment: **855** (added by itself, without a tap: **30**)
- What it is (the kind Recall files it under): 4225 of 4933 right (85.6%)

| area | notifications | wrong | right % | kind wrong |
|---|---|---|---|---|
| sub_future | 300 | 192 | 36.0 | – |
| scam | 300 | 154 | 48.7 | – |
| bills_due | 350 | 164 | 53.1 | – |
| bank_not_money | 600 | 195 | 67.5 | 0 of 18 |
| points_prices | 200 | 62 | 69.0 | – |
| delivery | 600 | 179 | 70.2 | 64 of 600 |
| chat_asks | 300 | 75 | 75.0 | 75 of 300 |
| gov | 200 | 43 | 78.5 | – |
| bank_eg_in | 400 | 81 | 79.8 | 0 of 400 |
| calendar | 250 | 49 | 80.4 | 70 of 250 |
| subscriptions | 400 | 75 | 81.3 | – |
| media | 500 | 80 | 84.0 | – |
| bank_eg_out | 600 | 62 | 89.7 | 16 of 600 |
| email_misc | 200 | 18 | 91.0 | – |
| ads | 700 | 50 | 92.9 | 349 of 615 |
| chat_plain | 450 | 28 | 93.8 | 25 of 450 |
| receipts | 500 | 27 | 94.6 | – |
| bank_world | 700 | 26 | 96.3 | – |
| bank_gulf | 400 | 10 | 97.5 | 9 of 400 |
| security | 250 | 6 | 97.6 | 50 of 250 |
| rides | 250 | 0 | 100.0 | 0 of 250 |
| calls | 300 | 0 | 100.0 | 0 of 300 |
| chat_money | 400 | 0 | 100.0 | – |
| chat_numbers | 250 | 0 | 100.0 | 50 of 250 |
| travel | 250 | 0 | 100.0 | 0 of 250 |
| system | 200 | 0 | 100.0 | – |
| health | 150 | 0 | 100.0 | – |

## What went wrong (examples of each)

### bank_eg_out
- **not read as a payment** × 62: «Messages · Banque du Caire: Your card ending 5654 was used for EGP 8,384 at NOON on 10 Nov» · «Messages · Emirates NBD: Your card ending 6474 was used for EGP 5679.00 at EL EZABY PHARMACY on 10/11» · «Messages · Faisal Bank: Your card ending 6304 was used for EGP 2,917.25 at AMAZON.EG on 10-Nov-2026» · «Messages · Credit Agricole: Your card ending 7324 was used for EGP 1187.00 at UBER on 10/11/2026»
- kind read as **promo** × 16: «Messages · Banque du Caire: تم خصم 3,317 جم من بطاقتك المنتهية ب 7873 لدى AMAZON.EG» · «Messages · HSBC: تم خصم 4,682 جم من بطاقتك المنتهية ب 2372 لدى UBER» · «Messages · AAIB: تم خصم 1,454 جم من بطاقتك المنتهية ب 1599 لدى STARBUCKS»

### bank_eg_in
- **direction out ≠ in** × 81: «Messages · ADIB: تم رد مبلغ ٥٨٬٦٣١ جنيه الى بطاقتك من AMAZON.EG» · «Messages · AAIB: تم رد مبلغ 54412.00 جنيه الى بطاقتك من EL EZABY PHARMACY» · «Messages · NBE: تم رد مبلغ 30,794.00 جنيه الى بطاقتك من CARREFOUR MAADI» · «Messages · AAIB: تم رد مبلغ ١٨٬٣٦٨ جنيه الى بطاقتك من B.TECH»

### bank_gulf
- **not read as a payment** × 10: «Messages · Doha Bank: ATM withdrawal of QAR 1,753 from card ending 3127. Available balance QAR 39446» · «Messages · QNB: ATM withdrawal of QAR 1,397.00 from card ending 9012. Available balance QAR 26,574.25» · «Messages · QNB: ATM withdrawal of QAR 3409.75 from card ending 7240. Available balance QAR 83536.00» · «Messages · QNB: ATM withdrawal of QAR 63.00 from card ending 6750. Available balance QAR 77862.00»
- kind read as **message** × 9: «Messages · QNB: You have received QAR 756.00 from HANY FAROUK. Ref 99226808» · «Messages · QNB: You have received QAR 295 from HANY FAROUK. Ref 48446693» · «Messages · QNB: You have received QAR 2111.99 from OMAR KHALED. Ref 51998245»

### bank_world
- **amount N ≠ N** × 23: «Messages · NBB: BHD 2,983.250 has been credited to your account 00123***. Balance BHD 1,240.150» · «Messages · NBB: BHD 4,349.250 has been credited to your account 00123***. Balance BHD 1,240.150» · «Messages · NBK: تم خصم 2,004.250 د.ك من بطاقتك رقم ***1122 لدى SULTAN CENTER بتاريخ 10/11/2026. الرصيد المتوفر 845.750 د.ك» · «Messages · NBK: تم خصم 3,338.000 د.ك من بطاقتك رقم ***1122 لدى SULTAN CENTER بتاريخ 10/11/2026. الرصيد المتوفر 845.750 د.ك»
- **not read as a payment** × 3: «Messages · BIAT: Votre compte a été débité de 1.716,000 TND suite à un paiement par carte chez MONOPRIX. Solde: 1 240,300 TND» · «Messages · BIAT: Votre compte a été débité de 2.518,000 TND suite à un paiement par carte chez MONOPRIX. Solde: 1 240,300 TND» · «Messages · BIAT: Votre compte a été débité de 3.316,250 TND suite à un paiement par carte chez MONOPRIX. Solde: 1 240,300 TND»

### bank_not_money
- **became money** × 195: «Messages · AAIB: 397519 is your verification code for AAIB online purchase of EGP 567.00 at TALABAT» · «Messages · ADIB: تم رفض عملية شراء بمبلغ 8,440.50 جنيه من MCDONALDS لعدم كفاية الرصيد» · «Messages · AAIB: Use code 489611 to confirm your transfer of EGP 5,739.00 to OMAR KHALED» · «Messages · QNB: سيتم خصم قسط القرض بمبلغ 8605.75 جنيه يوم 1 ديسمبر»

### receipts
- **read as money IN** × 27: «Gmail · Booking.com: Payment received: EGP 1879.50 for your stay at Hilton Hurghada. Confirmation 47143484» · «Gmail · Booking.com: Payment received: EGP 2,816 for your stay at Hilton Hurghada. Confirmation 16078274» · «Gmail · Booking.com: Payment received: EGP 1663 for your stay at Hilton Hurghada. Confirmation 49491376» · «Gmail · Booking.com: Payment received: EGP 4102.00 for your stay at Steigenberger Cairo. Confirmation 16509372»

### subscriptions
- **no subscription card (only a payment)** × 75: «Gmail · OSN: OSN+: payment of EGP 399 received. Next billing date 10 Dec» · «Gmail · Microsoft: تم خصم 92.99 جنيه قيمة تجديد اشتراك Microsoft 365 Personal» · «Gmail · Google Play: تم خصم 794.00 جنيه قيمة تجديد اشتراك Google One (100 GB)» · «Gmail · Netflix: Netflix: payment of $119.99 received. Next billing date 10 Dec»

### sub_future
- **became money** × 192: «Gmail · Adobe: Reminder: Adobe Creative Cloud renews on 15 Nov. You will be billed EGP 1438.00» · «Gmail · YouTube: Reminder: YouTube Premium renews on 1 Dec. You will be billed EGP 1245» · «Gmail · Duolingo: We couldn't process your payment of EGP 1359.75 for Super Duolingo. Update your payment method» · «Gmail · Notion: We couldn't process your payment of EGP 1067 for Notion Plus. Update your payment method»

### ads
- **asked about it** × 30: «Gmail · AliExpress: Get EGP 4785.00 off your next order with code SAVE31» · «Gmail · AliExpress: Price drop: burgers on your wishlist now EGP 5,569.25 (was EGP 6,841.00)» · «Messages · noon: Get EGP 4395.75 off your next order with code NEW38» · «Gmail · Careem: Price drop: burgers on your wishlist now EGP 7584.00 (was EGP 1854)»
- **became money** × 20: «Swvl · Swvl: عروض الجمعة البيضاء: خصومات حتى 30٪ والاسعار تبدأ من 5,233 جنيه» · «Messages · Booking.com: عروض الجمعة البيضاء: خصومات حتى 20٪ والاسعار تبدأ من 3,566.00 جنيه» · «Swvl · Swvl: عروض الجمعة البيضاء: خصومات حتى 40٪ والاسعار تبدأ من 2793 جنيه» · «elmenus · elmenus: عروض الجمعة البيضاء: خصومات حتى 50٪ والاسعار تبدأ من 7044 جنيه»
- kind read as **bank** × 247: «Swvl · Swvl: عروض الجمعة البيضاء: خصومات حتى 30٪ والاسعار تبدأ من 5,233 جنيه» · «Messages · Booking.com: عروض الجمعة البيضاء: خصومات حتى 20٪ والاسعار تبدأ من 3,566.00 جنيه» · «Messages · valU: Shop now, pay later: 0% interest for 6 months on orders above EGP 8167.00»
- kind read as **other** × 68: «Zomato · Zomato: Angebot: 60% Rabatt auf sneakers – ab 1126 €» · «Glovo · Glovo: ¡Oferta! 30% de descuento en school supplies desde 5,916 €» · «B.TECH · B.TECH: ¡Oferta! 60% de descuento en school supplies desde 3,497.00 €»
- kind read as **message** × 21: «Messages · Temu: ¡Oferta! 50% de descuento en pizza desde 2,182.99 €» · «Messages · Mrsool: Angebot: 60% Rabatt auf laptops – ab 8,637.00 €» · «Messages · Lazada: توصيل مجاني لأول 4 طلبات! اطلب دلوقتي»
- kind read as **ride** × 12: «Carrefour · Carrefour: ¡Oferta! 30% de descuento en your next ride desde 7924.99 €» · «Vodafone · Vodafone: Offre spéciale: -30% sur your next ride, à partir de 2,048.00 €» · «InstaShop · InstaShop: ¡Oferta! 40% de descuento en your next ride desde 414.99 €»
- kind read as **bill** × 1: «Vodafone · Vodafone: اشترك في باقة فليكس 243 واحصل على ضعف الدقايق بـ 4348.00 جنيه»

### media
- **asked about it** × 42: «Instagram · Instagram: marquesbrownlee shared a reel: I bought a $503,673.99 watch» · «Instagram · Instagram: marquesbrownlee shared a reel: I bought a $543,157 watch» · «Instagram · Instagram: movlogs shared a reel: I bought a $225,220 watch» · «Instagram · Instagram: elzerowebschool shared a reel: I bought a $209685.00 watch»
- **became money** × 38: «Twitch · MrBeast: is live: giving away $895,814.25 to subs» · «YouTube · Marques Brownlee: I spent $342142 on this and regret it» · «YouTube · Supercar Blondie: I spent $453,262 on this and regret it» · «YouTube · Supercar Blondie: I spent $837842 on this and regret it»

### delivery
- **became money** × 64: «Amazon Shopping · Refund: We've issued your refund for running shoes. It will arrive on your card in 5–7 days» · «Amazon Shopping · Refund: We've issued your refund for blender. It will arrive on your card in 5–7 days» · «Messages · Mylerz: شحنتك من شي ان خرجت للتوصيل. المبلغ المطلوب 2,420 جنيه» · «Messages · Mylerz: شحنتك من جوميا خرجت للتوصيل. المبلغ المطلوب 2651.99 جنيه»
- **no “…” (delivered)** × 61: «Messages · Bosta: Your shipment from SHEIN will be delivered tomorrow. COD amount EGP 3567.00» · «Messages · Bosta: Your shipment from Zara will be delivered tomorrow. COD amount EGP 2,639.99» · «noon · noon: Your order couldn't be delivered. We'll try again Thursday» · «noon · noon: Your order couldn't be delivered. We'll try again Sunday»
- **no “…” (nothing)** × 54: «noon · noon: تم توصيل طلبك رقم 3533031. قيّم تجربتك» · «noon · noon: تم توصيل طلبك رقم 49617151. قيّم تجربتك» · «noon · noon: تم توصيل طلبك رقم 75511866. قيّم تجربتك» · «noon · noon: تم توصيل طلبك رقم 20602907. قيّم تجربتك»
- kind read as **bank** × 64: «Amazon Shopping · Refund: We've issued your refund for running shoes. It will arrive on your card in 5–7 days» · «Amazon Shopping · Refund: We've issued your refund for blender. It will arrive on your card in 5–7 days» · «Messages · Mylerz: شحنتك من شي ان خرجت للتوصيل. المبلغ المطلوب 2,420 جنيه»

### chat_plain
- **made a “…” card** × 28: «Messenger · Salma: tonight was fun!» · «WhatsApp · John: see you tomorrow!» · «Signal · Karim: I'll call you tomorrow» · «WhatsApp · John Work: see you tomorrow 😊»
- kind read as **delivery** × 25: «WhatsApp · العيلة: Nada: انا في الطريق» · «Telegram · العيلة: Laila: انا في الطريق 👍» · «Signal · Class of 2012: Hany: انا في الطريق..»

### chat_asks
- **no “…” (nothing)** × 75: «Signal · Karim: please transfer the rent tomorrow» · «Telegram · Sara: please pay the electricity bill today» · «WhatsApp · Mostafa Hassan: please pay the electricity bill today» · «Telegram · Omar Work: don't forget to bring the invoice»
- kind read as **bank** × 38: «Signal · Karim: please transfer the rent tomorrow» · «Telegram · Mona: لو سمحت حول المبلغ بكرة» · «WhatsApp · Mama Hassan: لو سمحت حول المبلغ بكرة»
- kind read as **bill** × 37: «Telegram · Sara: please pay the electricity bill today» · «WhatsApp · Mostafa Hassan: please pay the electricity bill today» · «Telegram · Omar Work: don't forget to bring the invoice»

### chat_numbers
- kind read as **flight** × 28: «Telegram · Salma: the gate code is 2745» · «Telegram · Priya: the gate code is 3296» · «Signal · Mama: the gate code is 2657»
- kind read as **appointment** × 12: «Messenger · Mona: the meeting moved to room 457» · «WhatsApp · Dina: the meeting moved to room 273» · «WhatsApp · Priya: the meeting moved to room 165»
- kind read as **delivery** × 10: «WhatsApp · Ziad: order number 58639511» · «WhatsApp · Omar: order number 34998053» · «WhatsApp · Sara: order number 49109693»

### calendar
- **became money** × 49: «Vezeeta · Vezeeta: Your appointment with Dr Mama is confirmed for 12 Nov at 1:30 PM. Fees EGP 1087.00 to be paid at the clinic» · «Vezeeta · Vezeeta: Your appointment with Dr Salma is confirmed for 12 Nov at 3:30 AM. Fees EGP 233.00 to be paid at the clinic» · «Vezeeta · Vezeeta: Your appointment with Dr Hany is confirmed for 12 Nov at 8:00 PM. Fees EGP 542.00 to be paid at the clinic» · «Vezeeta · Vezeeta: Your appointment with Dr Mostafa is confirmed for Thursday at 11:00 AM. Fees EGP 1,436.00 to be paid at the cl»
- kind read as **bank** × 40: «Outlook · Reminder: Budget review (EGP 480,969.00) starts in 15 minutes — Room 127» · «Outlook · Reminder: Budget review (EGP 241,839.00) starts in 15 minutes — Room 214» · «Outlook · Reminder: Budget review (EGP 799,643.00) starts in 15 minutes — Room 374»
- kind read as **other** × 29: «Calendar · Call with the bank: 5:30 AM – 8:00» · «Calendar · Wedding anniversary: All day · tomorrow» · «Calendar · Team sync: 11:00 AM – 10:00»
- kind read as **ride** × 1: «Calendar · School trip: All day · tomorrow»

### bills_due
- **the bill was missed (no card, no date)** × 82: «Fawry · myFawry: You have a new gas bill: EGP 648 due 5 Dec» · «Messages · STC: فاتورتك لشهر اكتوبر بمبلغ 2898.00 ر.س مستحقة بتاريخ 20 نوفمبر» · «Fawry · myFawry: You have a new gas bill: EGP 3,223 due 1 Dec» · «Messages · Water Co: Your water bill of EGP 173 is overdue. Please pay before 5 Dec»
- **a bill that is only DUE became money** × 82: «Messages · NGC: فاتورة الغاز لشهر اكتوبر 2227 جنيه. آخر ميعاد للسداد 15 نوفمبر» · «Messages · Orange: فاتورتك 1580 جنيه مستحقة السداد قبل 20 نوفمبر» · «e& · e&: Your postpaid bill EGP 75 is now due. Pay before 25 Nov to avoid suspension» · «Messages · Orange: فاتورتك 215.00 جنيه مستحقة السداد قبل 1 ديسمبر»

### security
- **asked about it** × 6: «Gmail · Google: 2-Step Verification was turned on for your account» · «Instagram · Google: 2-Step Verification was turned on for your account» · «Google · Google: 2-Step Verification was turned on for your account» · «Apple · Google: 2-Step Verification was turned on for your account»
- kind read as **other** × 34: «Microsoft Authenticator · Microsoft Authenticator: Is it you trying to sign in? Tap to confirm» · «Apple · Google: Is it you trying to sign in? Tap to confirm» · «Apple · Google: Your recovery email was changed»
- kind read as **email** × 8: «Gmail · Gmail: Is it you trying to sign in? Tap to confirm» · «Gmail · Google: Your recovery email was changed» · «Gmail · Google: Is it you trying to sign in? Tap to confirm»
- kind read as **message** × 8: «Instagram · Google: Is it you trying to sign in? Tap to confirm» · «Instagram · Instagram: Is it you trying to sign in? Tap to confirm» · «Instagram · Instagram: Your recovery email was changed»

### scam
- **became money** × 154: «Messages · +44 7983588626: URGENT: EGP 3,756.00 was debited from your account. If not you, cancel here http://vodafone-gift.win» · «Messages · +44 7975335867: Hi mum, I lost my phone, this is my new number. Can you send me EGP 6,013 today?» · «Messages · 01075063145: عزيزي العميل تم خصم 6,198.50 جنيه من حسابك لالغاء العملية اضغط https://instapay-eg.help/r88» · «Messages · 01061781196: عزيزي العميل تم خصم 2426.00 جنيه من حسابك لالغاء العملية اضغط bit.ly/3xK931»

### gov
- **became money** × 43: «Messages · Tax Authority: A traffic fine of EGP 1,631.00 was recorded on your vehicle. Pay before 30 Nov to avoid doubling» · «Messages · MOI: A traffic fine of EGP 2825 was recorded on your vehicle. Pay before 30 Nov to avoid doubling» · «Messages · Tax Authority: A traffic fine of EGP 740.50 was recorded on your vehicle. Pay before 30 Nov to avoid doubling» · «Messages · NTRA: A traffic fine of EGP 1,272.50 was recorded on your vehicle. Pay before 30 Nov to avoid doubling»

### points_prices
- **asked about it** × 62: «Binance · Binance: BTC is up 3% — now $86186.00» · «Thndr · Thndr: COMI is up 5.1% today at EGP 85» · «Coinbase · Coinbase: ETH fell 4% in the last hour to $3083.75» · «TradingView · TradingView: AAPL crossed $235.00»

### email_misc
- **became money** × 18: «Gmail · Substack: New post: how I paid off $4165.00 of debt» · «Gmail · Substack: New post: how I paid off $18094.00 of debt» · «Gmail · Substack: New post: how I paid off $14413 of debt» · «Gmail · Substack: New post: how I paid off $30454.00 of debt»
