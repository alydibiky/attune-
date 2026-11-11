// v9.9.16 (Ali, 11 Nov 2026: "the chat and your code should deal with any type of notifications" + "every country like Egypt"):
// bank / wallet / card messages the way they arrive in each of the app's 30 countries, in that country's languages. Written from the
// well-known shapes of these messages (amount · currency · card or account tail · merchant · balance) — the wording differs by bank,
// so the READER must not depend on one template. [country, app, sender/title, text, direction, amount, currency]
export const WORLD = [
  // ---- Egypt
  ["eg", "Messages", "CIB", "Your debit card ending 1234 was charged EGP 350.00 at CARREFOUR MAADI on 10/11 at 14:22. Available balance EGP 12,450.75", "out", 350, "EGP"],
  ["eg", "Messages", "NBE", "تم خصم مبلغ 1,250.00 جنيه من حسابكم رقم ****5678 عملية شراء من فوري بتاريخ 10/11/2026 الرصيد المتاح 8,300.50 جنيه", "out", 1250, "EGP"],
  ["eg", "InstaPay", "InstaPay", "You received EGP 3,000.00 from AHMED MOHAMED to your account ****4321. Ref 123456789012", "in", 3000, "EGP"],
  ["eg", "Messages", "VF-Cash", "تم استلام مبلغ 500 جنيه من رقم 01001234567 رصيدك الحالي 1,820.25 جنيه", "in", 500, "EGP"],
  // ---- Saudi Arabia
  ["sa", "Messages", "AlRajhiBank", "شراء عبر نقاط البيع\nبطاقة: 1234*; مدى\nمبلغ: SAR 45.00\nلدى: PANDA\nفي: 2026-11-10 13:05", "out", 45, "SAR"],
  ["sa", "Messages", "SNB-AlAhli", "شراء إنترنت\nبطاقة *4321 فيزا\nمبلغ 299.00 ر.س\nلدى NOON.COM\nفي 10/11/26 21:40\nرصيد 5,410.20 ر.س", "out", 299, "SAR"],
  ["sa", "Messages", "AlRajhiBank", "حوالة واردة محلية\nمبلغ: SAR 8,500.00\nإلى: 1234*\nمن: شركة المراعي\nفي: 2026-11-01 09:00", "in", 8500, "SAR"],
  ["sa", "STC Pay", "stc pay", "تم الدفع بنجاح بمبلغ 62.50 ر.س لدى جرير", "out", 62.5, "SAR"],
  ["sa", "Messages", "RiyadBank", "POS Purchase\nCard: *9876\nAmount: SAR 120.75\nAt: STARBUCKS RIYADH\nOn: 2026-11-10 08:15", "out", 120.75, "SAR"],
  // ---- UAE
  ["ae", "Messages", "EmiratesNBD", "Purchase of AED 215.50 with Debit Card ending 4521 at CARREFOUR MOE, DUBAI. Avl Bal is AED 7,845.10", "out", 215.5, "AED"],
  ["ae", "Messages", "ADCB", "Your salary of AED 12,000.00 has been credited to your account XXX1234 on 28/10/2026. Available balance AED 14,220.35", "in", 12000, "AED"],
  ["ae", "Messages", "FAB", "AED 89.00 has been debited from your FAB card ending 7788 at TALABAT on 10-Nov-2026. Available limit AED 9,911.00", "out", 89, "AED"],
  ["ae", "Messages", "Mashreq", "تم خصم مبلغ 150.00 درهم من بطاقتك المنتهية بـ 3344 لدى ENOC. الرصيد المتاح 2,310.00 درهم", "out", 150, "AED"],
  // ---- Kuwait, Qatar, Bahrain, Oman, Jordan, Lebanon
  ["kw", "Messages", "NBK", "تم خصم 12.500 د.ك من بطاقتك رقم ***1122 لدى SULTAN CENTER بتاريخ 10/11/2026. الرصيد المتوفر 845.750 د.ك", "out", 12.5, "KWD"],
  ["kw", "Messages", "KFH", "An amount of KWD 250.000 has been credited to your account ending 5566. Available balance KWD 1,102.300", "in", 250, "KWD"],
  ["qa", "Messages", "QNB", "A purchase of QAR 340.00 was made on your card ending 9090 at LULU HYPERMARKET on 10/11/2026. Available balance QAR 6,120.00", "out", 340, "QAR"],
  ["qa", "Messages", "CBQ", "تم إيداع مبلغ 9,500.00 ر.ق في حسابك رقم ****7711 راتب شهر أكتوبر", "in", 9500, "QAR"],
  ["bh", "BenefitPay", "BenefitPay", "You have paid BHD 4.500 to JASMIS via BenefitPay", "out", 4.5, "BHD"],
  ["bh", "Messages", "NBB", "BHD 600.000 has been credited to your account 00123***. Balance BHD 1,240.150", "in", 600, "BHD"],
  ["om", "Messages", "BankMuscat", "Your A/c XXXX1234 is debited OMR 25.500 on 10/11/2026 for POS purchase at LULU. Available balance OMR 512.300", "out", 25.5, "OMR"],
  ["jo", "Messages", "ArabBank", "تم خصم مبلغ 35.750 دينار من حسابك ****2211 حركة شراء لدى كارفور. الرصيد 410.250 دينار", "out", 35.75, "JOD"],
  ["jo", "CliQ", "CliQ", "You have received JOD 120.000 from OMAR SALEH via CliQ", "in", 120, "JOD"],
  ["lb", "Messages", "BankAudi", "A purchase of USD 48.00 was made with your card ending 1010 at SPINNEYS BEIRUT. Available balance USD 1,200.00", "out", 48, "USD"],
  // ---- North Africa (French / Arabic)
  ["ma", "Messages", "AttijariWafa", "Paiement par carte de 245,00 MAD chez MARJANE le 10/11/2026. Solde disponible 3 410,50 MAD", "out", 245, "MAD"],
  ["ma", "Messages", "CIH BANK", "Virement recu de 5 000,00 DH de la part de SOCIETE ABC. Nouveau solde 8 410,50 DH", "in", 5000, "MAD"],
  ["dz", "BaridiMob", "BaridiMob", "Vous avez effectué un paiement de 2 500,00 DZD. Votre nouveau solde est de 14 300,00 DZD", "out", 2500, "DZD"],
  ["tn", "Messages", "BIAT", "Votre compte a été débité de 85,500 TND suite à un paiement par carte chez MONOPRIX. Solde: 1 240,300 TND", "out", 85.5, "TND"],
  // ---- Turkey
  ["tr", "Messages", "GARANTI BBVA", "1234 ile biten kartinizla 10.11.2026 14:05 tarihinde MIGROS'ta 245,90 TL harcama yapilmistir. Kullanilabilir limit: 8.754,10 TL", "out", 245.9, "TRY"],
  ["tr", "Messages", "ISBANK", "Hesabiniza 10.11.2026 tarihinde AHMET YILMAZ tarafindan 3.500,00 TL havale gelmistir. Bakiye: 12.340,55 TL", "in", 3500, "TRY"],
  ["tr", "Messages", "AKBANK", "****5678 nolu kartinizdan 10.11.2026 tarihinde TRENDYOL isyerinden 1.299,00 TL tutarinda alisveris yapilmistir.", "out", 1299, "TRY"],
  // ---- Pakistan, India
  ["pk", "Messages", "HBL", "Dear Customer, PKR 2,500.00 has been debited from your A/C ***1234 on 10-NOV-26 for POS purchase at IMTIAZ. Avl Bal PKR 45,300.00", "out", 2500, "PKR"],
  ["pk", "JazzCash", "JazzCash", "You have received Rs. 5,000.00 from ALI RAZA 03001234567 in your JazzCash Mobile Account. TID: 123456789", "in", 5000, "PKR"],
  ["pk", "Messages", "Meezan", "Rs.1,200 debited from A/C *5678 via Raast transfer to USMAN KHAN on 10-11-2026. Bal Rs.18,400", "out", 1200, "PKR"],
  ["in", "Messages", "AD-HDFCBK", "HDFC Bank: Rs.2500.00 debited from A/c **3545 on 10-11-26 to VPA swiggy@icici (UPI Ref No 631012345678). Not you? Call 18002586161", "out", 2500, "INR"],
  ["in", "Messages", "JM-SBIUPI", "Dear UPI user A/C X1234 debited by 450.0 on date 10Nov26 trf to ZOMATO Refno 631098765432. If not u? call 1800111109. -SBI", "out", 450, "INR"],
  ["in", "Messages", "VM-ICICIB", "ICICI Bank Acct XX789 credited with Rs 35,000.00 on 01-Nov-26 from ACME PVT LTD. UPI:630512345678-ICICI Bank.", "in", 35000, "INR"],
  ["in", "Google Pay", "Google Pay", "You paid ₹320.00 to Sharma Kirana Store", "out", 320, "INR"],
  ["in", "Messages", "AX-AXISBK", "INR 1,899.00 spent on Axis Bank Card no. XX4455 at AMAZON on 10-11-26 19:20:11 IST. Avl Lmt INR 78,101.00", "out", 1899, "INR"],
  // ---- Indonesia, Malaysia
  ["id", "BCA mobile", "m-BCA", "Transfer ke BUDI SANTOSO Rp 250.000,00 berhasil. 10/11 14:05", "out", 250000, "IDR"],
  ["id", "Messages", "BRI", "Rek ****1234 telah didebet Rp1.500.000 pada 10/11/26 untuk pembelian di TOKOPEDIA. Saldo Rp3.250.000", "out", 1500000, "IDR"],
  ["id", "GoPay", "GoPay", "Kamu menerima Rp75.000 dari SITI. Saldo GoPay kamu sekarang Rp210.000", "in", 75000, "IDR"],
  ["my", "Messages", "Maybank", "RM45.90 was charged on your card ending 1234 at TESCO PJ on 10/11/26. Available limit RM4,954.10", "out", 45.9, "MYR"],
  ["my", "Touch 'n Go eWallet", "TNG eWallet", "You have received RM120.00 from AHMAD via DuitNow", "in", 120, "MYR"],
  // ---- US, UK, Canada
  ["us", "Chase", "Chase", "You made a $54.20 transaction with WHOLE FOODS on Nov 10, 2026 at 2:14 PM ET", "out", 54.2, "USD"],
  ["us", "Venmo", "Venmo", "Sarah Johnson paid you $25.00 — dinner", "in", 25, "USD"],
  ["us", "Messages", "BofA", "Bank of America: A direct deposit of $2,450.00 was credited to your account ending 4411.", "in", 2450, "USD"],
  ["gb", "Monzo", "Monzo", "£12.50 at Tesco. You've spent £48.20 today", "out", 12.5, "GBP"],
  ["gb", "Messages", "Barclays", "A payment of £350.00 has been made from your account ending 2211 to J SMITH on 10 Nov.", "out", 350, "GBP"],
  ["ca", "Messages", "TD", "TD: A purchase of $86.45 was made on your card ending 9912 at LOBLAWS on Nov 10.", "out", 86.45, "CAD"],
  ["ca", "Interac", "Interac e-Transfer", "You've received $200.00 from MARIE TREMBLAY and it has been automatically deposited.", "in", 200, "CAD"],
  // ---- Europe
  ["de", "Sparkasse", "Sparkasse", "Kartenzahlung: 23,49 EUR bei REWE am 10.11.2026. Neuer Kontostand: 1.204,51 EUR", "out", 23.49, "EUR"],
  ["de", "N26", "N26", "Du hast 850,00 € von Max Mustermann erhalten", "in", 850, "EUR"],
  ["fr", "Messages", "BNP Paribas", "Paiement par carte de 42,90 EUR chez CARREFOUR le 10/11/2026. Solde: 1 310,25 EUR", "out", 42.9, "EUR"],
  ["fr", "Lydia", "Lydia", "Vous avez reçu 30,00 € de Julie", "in", 30, "EUR"],
  ["es", "BBVA", "BBVA", "Compra de 18,75 EUR en MERCADONA con tu tarjeta *1234 el 10/11/2026", "out", 18.75, "EUR"],
  ["es", "Bizum", "Bizum", "Has recibido un Bizum de 20,00 € de Carlos", "in", 20, "EUR"],
  ["it", "Intesa Sanpaolo", "Intesa Sanpaolo", "Pagamento di 36,40 EUR con carta *5678 presso ESSELUNGA il 10/11/2026", "out", 36.4, "EUR"],
  ["it", "Messages", "UniCredit", "Accredito di 1.650,00 EUR sul conto ****1122 - STIPENDIO", "in", 1650, "EUR"],
  ["pt", "MB WAY", "MB WAY", "Pagou 12,30 EUR em PINGO DOCE com MB WAY", "out", 12.3, "EUR"],
  ["nl", "ING", "ING", "Je hebt € 27,95 betaald aan Albert Heijn", "out", 27.95, "EUR"],
  ["nl", "Tikkie", "Tikkie", "Je hebt € 15,00 ontvangen van Sanne", "in", 15, "EUR"],
  // ---- Brazil, Mexico
  ["br", "Nubank", "Nubank", "Compra de R$ 89,90 aprovada em IFOOD", "out", 89.9, "BRL"],
  ["br", "Nubank", "Nubank", "Você recebeu um Pix de R$ 250,00 de Maria Silva", "in", 250, "BRL"],
  ["mx", "BBVA México", "BBVA", "Compra por $450.00 MXN en OXXO con tu tarjeta terminación 1234. 10/11/2026", "out", 450, "MXN"],
  ["mx", "Messages", "Banorte", "Recibiste una transferencia SPEI por $3,200.00 de JUAN PEREZ", "in", 3200, "MXN"],
  // ---- Nigeria, South Africa
  ["ng", "Messages", "GTBank", "Acct: ****1234 Amt: NGN15,000.00 DR Desc: POS/WEB PURCHASE SHOPRITE Avail Bal: NGN84,300.50 Date: 10-Nov-2026", "out", 15000, "NGN"],
  ["ng", "OPay", "OPay", "You have received ₦5,000.00 from CHINEDU OKAFOR", "in", 5000, "NGN"],
  ["ng", "Messages", "AccessBank", "Credit Amt: NGN120,000.00 Acc: 012****789 Desc: SALARY OCT Bal: NGN131,400.00", "in", 120000, "NGN"],
  ["za", "Messages", "FNB", "FNB :-) R350.00 paid from Cheq a/c..1234 @ Checkers Sandton. Avail R4,210. 10Nov 14:02", "out", 350, "ZAR"],
  ["za", "Capitec", "Capitec", "Capitec: R1,500.00 received from T NKOSI into acc ..5678. Bal R6,320.45", "in", 1500, "ZAR"],
];
// what must NEVER become a payment, in the same languages
export const NOT_PAYMENTS = [
  ["sa", "Messages", "AlRajhiBank", "رمز التحقق 482913 لعملية شراء بمبلغ SAR 299.00 لدى NOON. لا تشارك الرمز مع أحد"],
  ["ae", "Messages", "EmiratesNBD", "Your OTP is 771204 for AED 215.50 at CARREFOUR. Do not share it."],
  ["in", "Messages", "AD-HDFCBK", "OTP is 554321 for txn of INR 1,899.00 at AMAZON on card ending 4455. Valid till 19:30. Do not share OTP"],
  ["tr", "Messages", "GARANTI BBVA", "Sifreniz 918273. 1.299,00 TL tutarindaki TRENDYOL isleminiz icin kullaniniz."],
  ["eg", "Messages", "Vodafone", "استمتع بخصم 50% على باقات الإنترنت بـ 100 جنيه فقط! اطلب #100*"],
  ["us", "Messages", "Chase", "Chase: Your statement is ready. Minimum payment of $35.00 is due on Nov 28."],
  ["de", "Sparkasse", "Sparkasse", "Ihr Kontostand beträgt 1.204,51 EUR"],
  ["br", "Nubank", "Nubank", "Sua fatura de R$ 1.240,00 vence em 15/11"],
  ["id", "Messages", "BCA", "Kode OTP Anda 123456 untuk transaksi Rp 250.000. Jangan berikan kepada siapapun"],
  ["gb", "Monzo", "Monzo", "Get £5 when you invite a friend to Monzo"],
];
