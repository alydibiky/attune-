// v6.27 "Money tracks itself": payment notifications (read on the phone by PayListener.kt) → entries to confirm in Money.
import { readNotification, inbox, toTxns } from "../../web-src/paylog.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const t0 = new Date("2026-10-13T08:12:00").getTime();
const Q = [
  { id: "1", app: "CIB", title: "CIB", text: "Your card ending 1234 was charged EGP 350.00 at CARREFOUR", ts: t0 },
  { id: "2", app: "InstaPay", title: "InstaPay", text: "You have received EGP 1,000.00 from AHMED MOHAMED", ts: t0 + 3600000 },
  { id: "3", app: "NBE", title: "البنك الأهلي", text: "تم خصم 600 جنيه من حسابك مقابل شراء من WATANIYA", ts: t0 + 7200000 },
  { id: "4", app: "CIB", title: "CIB", text: "Your OTP is 482913. Do not share it.", ts: t0 + 10 },
  { id: "5", app: "CIB", title: "CIB", text: "Your available balance is EGP 48,250.00", ts: t0 + 20 },
  { id: "6", app: "Talabat", title: "Talabat", text: "50% off today only! Order now, win EGP 500", ts: t0 + 30 },
  { id: "7", app: "InstaPay", title: "InstaPay", text: "Transfer of EGP 350.00 to CARREFOUR completed", ts: t0 + 120000 },   // the same payment, notified twice
  { id: "8", app: "Vodafone Cash", title: "Vodafone Cash", text: "تم تحويل 250 ج.م إلى 01012345678", ts: t0 + 9000000 },
];
const e = readNotification(Q[0]);
ok(e && e.amount === 350 && e.direction === "out" && e.party === "CARREFOUR" && e.app === "CIB", "a card payment → −350 at Carrefour: " + JSON.stringify(e && { a: e.amount, d: e.direction, p: e.party }));
ok(readNotification(Q[1]).direction === "in" && readNotification(Q[1]).amount === 1000, "InstaPay money received → +1,000");
ok(readNotification(Q[2]).amount === 600 && readNotification(Q[2]).direction === "out", "Arabic «تم خصم 600 جنيه» → −600");
ok(readNotification(Q[3]) === null, "a one-time code is never a payment");
ok(readNotification(Q[4]) === null, "a balance alone is not a payment");
ok(readNotification(Q[5]) === null, "an advert with amounts is not a payment");
const box = inbox(Q);
ok(box.length === 4 && box.filter((x) => x.amount === 350).length === 1, "the same payment from the bank AND InstaPay is listed once: " + box.map((x) => x.amount).join(", "));
ok(box[0].amount === 250, "newest first");
ok(inbox(Q, ["1", "2", "3", "7", "8"]).length === 0, "added or dismissed ones are not listed again");
const tx = toTxns([readNotification(Q[0]), readNotification(Q[1])]);
ok(tx[0].type === "expense" && tx[0].amount === 350 && tx[0].note === "CARREFOUR · CIB" && tx[0].date === "2026-10-13" && tx[1].type === "income", "entries for Money: " + JSON.stringify(tx[0]));
// ---- by itself: only sure ones; written into Money's ledger like Money does ----
const P = await import("../../web-src/paylog.js");
const sure = P.autoPick(inbox(Q));
ok(sure.length === 3 && !sure.some((x) => x.amount === 250), "only the sure ones are added by themselves (the Vodafone Cash transfer with no name waits for a tap): " + sure.map((x) => x.amount).join(", "));
const led = { currency: "EGP", accounts: [{ id: "u", currency: "USD" }, { id: "c", currency: "EGP" }], txns: [{ id: "old" }] };
const r = P.appendToLedger(led, toTxns(sure), t0);
ok(r.ids.length === 3 && r.ledger.txns.length === 4 && r.ledger.txns.every((x) => x.id === "old" || x.account === "c"), "written into Money's ledger, in the EGP account");
ok(led.txns.length === 1, "the old ledger object is untouched (a new one is returned)");
ok(P.appendToLedger(null, toTxns(sure)).ids.length === 0, "no ledger yet → nothing written");
ok(P.categorise("CARREFOUR", "out") === "groceries" && P.categorise("WATANIYA fuel", "out") === "transport" && P.categorise("Seoudi Market", "out") === "groceries" && P.categorise("صيدلية العزبي", "out") === "health" && P.categorise("AHMED MOHAMED", "in") === "other" && P.categorise("Salary October", "in") === "salary", "payments get a category: Carrefour/Seoudi → groceries, Wataniya → transport, El Ezaby → health, a person → other, salary → salary");
ok(r.ledger.txns.find((x) => x.amount === 350).cat === "groceries", "the Carrefour payment lands in Groceries");
console.log(fail ? fail + " FAILED" : "v727paylog ok");
process.exit(fail ? 1 : 0);
