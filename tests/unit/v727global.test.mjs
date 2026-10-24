// v6.27 "make everything global" — the payment reader (paytext.js) in many countries, currencies, number formats
// and languages; nothing Egyptian is lost (v610 / v727paylog keep their checks).
import { createRequire } from "module";
const { parsePayment, payNumber, payCurrency } = createRequire(import.meta.url)("../../web-src/yusr/paytext.js");
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const P = (t, o) => parsePayment(t, o) || {};
const is = (t, amount, cur, dir, o) => { const p = P(t, o); ok(p.amount === amount && p.currency === cur && p.direction === dir, `${t.slice(0, 70)} → ${p.amount} ${p.currency} ${p.direction}`); };
// numbers
ok(payNumber("1.234,56") === 1234.56 && payNumber("1,234.56") === 1234.56 && payNumber("12,50") === 12.5 && payNumber("1 234,56") === 1234.56, "1.234,56 · 1,234.56 · 12,50 · 1 234,56");
ok(payNumber("1,23,456.00") === 123456 && payNumber("150.000") === 150000 && payNumber("12.500", "KWD") === 12.5 && payNumber("1'250.00") === 1250, "India 1,23,456 · Rp 150.000 · 12.500 KWD · Swiss 1'250.00");
// the world's bank messages
is("Chase: You made a $42.17 transaction with STARBUCKS on 03/14/2026", 42.17, "USD", "out");
is("Your account was debited £25.00 at TESCO STORES", 25, "GBP", "out");
is("Paiement de 12,50 € chez Carrefour avec votre carte", 12.5, "EUR", "out");
is("Pago con tarjeta de 1.234,56 EUR en MERCADONA", 1234.56, "EUR", "out");
is("Compra aprovada: R$ 89,90 no cartão final 1234 - IFOOD", 89.9, "BRL", "out");
is("Pix recebido de Maria Souza: R$ 250,00", 250, "BRL", "in");
is("Kartenzahlung 23,40 EUR bei REWE", 23.4, "EUR", "out");
is("Gutschrift: 1.500,00 EUR von Max Mustermann", 1500, "EUR", "in");
is("Kartınızdan 350,00 TL harcama yapılmıştır. MIGROS", 350, "TRY", "out");
is("Rs. 1,250.00 debited from A/c XX1234 on 12-10-26 to VPA zomato@icici. Avl Bal: Rs 23,456.78", 1250, "INR", "out");
is("INR 50,000.00 credited to your A/c XX9876 by NEFT from RAHUL SHARMA", 50000, "INR", "in");
is("Pembayaran Rp 150.000 ke TOKOPEDIA berhasil", 150000, "IDR", "out");
is("Dana masuk Rp 2.500.000 dari BUDI SANTOSO", 2500000, "IDR", "in");
is("Pagamento ricevuto: 45,00 € da Luca Rossi", 45, "EUR", "in");
is("Списано 1 250,00 ₽ Пятёрочка. Баланс: 10 000 ₽", 1250, "RUB", "out");
is("Your card was charged 12.500 KWD at The Avenues", 12.5, "KWD", "out");
is("You paid C$18.40 to Tim Hortons", 18.4, "CAD", "out");
is("Sent $30.00 to John Smith", 30, "CAD", "out", { home: "CAD" });
is("M-PESA: Confirmed. Ksh1,200.00 sent to JANE WANJIKU", 1200, "KES", "out");
is("Debit alert: NGN 15,000.00 POS purchase at SHOPRITE", 15000, "NGN", "out");
is("Retiro en cajero por $2,000.00 MXN", 2000, "MXN", "out");
is("تم خصم 250 جنيه من حسابك لدى كارفور", 250, "EGP", "out");
is("تم خصم 45.500 د.ك من بطاقتك", 45.5, "KWD", "out");
is("Your Netflix payment of 549 THB was successful", 549, "THB", "out");
// declined anywhere is not a payment
for (const t of ["Paiement refusé: 30,00 € chez FNAC", "Pago rechazado por 20,00 EUR", "Zahlung abgelehnt: 15,00 EUR", "İşlem reddedildi 100 TL", "Transaksi gagal Rp 50.000"])
  ok(P(t).ok === false, "declined: " + t);
// never a currency from a common word
for (const t of ["le magasin est fermé", "da Roma", "lei è qui", "회원 가입"]) ok(payCurrency(t) === null, "no currency in «" + t + "»");
// the date: day-first unless the region writes month-first
// (the local calendar day — toISOString() is UTC and moved the day back east of Greenwich, e.g. in Cairo)
const d = (t, o) => { const x = new Date(P(t, o).date); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
ok(d("Paid $5 on 03/04/2026", { order: "mdy" }) === "2026-03-04" && d("Paid 5 EUR on 03/04/2026") === "2026-04-03" && d("Paid $5 on 02/13/2026") === "2026-02-13", "03/04 by region; 02/13 is month-first anywhere");

// ---- People & plans in other languages and currencies ----
const { parseLife } = await import("../../web-src/life.js");
const now = new Date("2026-10-13T12:00:00").getTime();
const L = (t, cur = "USD") => parseLife(t, { now, currency: cur }) || {};
const lw = (t, exp, cur) => { const r = L(t, cur); const badk = Object.entries(exp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v)); ok(!badk.length, `«${t}» → ${JSON.stringify({ kind: r.kind, person: r.person, dir: r.dir, amount: r.amount, count: r.count, every: r.every, currency: r.currency, start: r.start })}`); };
lw("John owes me $1,200, $100 a month for a year", { kind: "installment", person: "John", dir: "in", amount: 100, count: 12, currency: "USD" });
lw("Juan me debe 600 €, 50 al mes", { kind: "installment", person: "Juan", dir: "in", amount: 50, count: 12, every: "month", currency: "EUR" }, "EUR");
lw("Pierre me doit 300 €", { kind: "debt", person: "Pierre", dir: "in", amount: 300, currency: "EUR" }, "EUR");
lw("Emprestei para Ana R$ 1.500,00 em 3 parcelas", { kind: "installment", person: "Ana", dir: "in", amount: 500, count: 3, currency: "BRL" }, "BRL");
lw("Ich schulde Max 250 €", { kind: "debt", person: "Max", dir: "out", amount: 250, currency: "EUR" }, "EUR");
lw("Netflix 15.99 every month", { kind: "subscription", amount: 15.99, every: "month", currency: "USD" });
lw("Alquiler 900 € cada mes", { kind: "rent", amount: 900, every: "month", currency: "EUR" }, "EUR");
lw("Mehmet bana borçlu 2.000 TL", { kind: "debt", person: "Mehmet", dir: "in", amount: 2000, currency: "TRY" }, "TRY");
lw("Budi berutang kepada saya Rp 500.000", { kind: "debt", person: "Budi", dir: "in", amount: 500000, currency: "IDR" }, "IDR");
lw("Rahul owes me ₹5,000 from 15 November", { kind: "debt", person: "Rahul", dir: "in", amount: 5000, currency: "INR", start: "2026-11-15" }, "INR");
lw("Sara pays me 200 a month from 1 de diciembre for 6 months", { kind: "installment", person: "Sara", amount: 200, count: 6, start: "2026-12-01" });
ok(L("The market is open").kind === undefined && L("I'm married since March").kind === undefined, "no amount, no commitment ('market' / 'married' are not March)");
console.log(bad ? bad + " FAILED" : "v727global ok");
