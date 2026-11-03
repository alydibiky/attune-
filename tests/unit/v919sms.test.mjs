// v9.0 (Ali: "99 percent accurate"): bank and wallet messages (CIB, Banque Misr, InstaPay, Vodafone Cash, NBE, salary) read right —
// the amount (never the balance), in or out, who; a one-time code is never a payment.
import { parsePayment } from "../../web-src/yusr/paytext.js";
let bad = 0; const now = Date.parse("2026-11-03T10:00:00");
const C = [["Your CIB card ending 1234 was charged EGP 1,250.00 at CARREFOUR MAADI on 03/11/2026", "out", 1250, "CARREFOUR"],
  ["تم خصم مبلغ 450.00 جنيه من حسابك رقم ***5678 لدى بنك مصر في 03/11", "out", 450, ""], ["InstaPay: You have received EGP 3,000.00 from AHMED MOHAMED. Ref 123456", "in", 3000, "AHMED"],
  ["تم تحويل 500 جنيه إلى 01012345678 بنجاح. رصيدك الحالي 2,340 جنيه. فودافون كاش", "out", 500, ""], ["NBE: Purchase of EGP 89.50 at UBER *TRIP. Available balance EGP 12,430.20", "out", 89.5, "UBER"],
  ["تم ايداع راتب بمبلغ 25,000 جنيه في حسابك", "in", 25000, ""]];
for (const [t, dir, amt, who] of C) { const r = parsePayment(t, { now }); if (!(r.ok && r.direction === dir && r.amount === amt && (!who || String(r.party || "").includes(who)))) { bad++; console.log(`FAIL "${t}" → ${JSON.stringify([r.ok, r.direction, r.amount, r.party])}`); } }
if (parsePayment("Your OTP is 482913. Do not share it.", { now }).ok) { bad++; console.log("FAIL a one-time code became a payment"); }
console.log(bad ? bad + " FAILED" : `PASS v919sms: ${C.length} bank / wallet messages read right; a one-time code is never a payment`);
