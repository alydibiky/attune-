// v9.9.29 (Ali's Telegram screenshot): everyday messages are never bookings — a 2,500 sample of tests/tr1/notbook.mjs at 100%, a held-out
// 1,000, real bookings still read (a 2,500 sample of tests/tr1/gen.mjs), and Ali's own line by hand.
import { run as notb, NOW } from "../tr1/notbook.mjs";
import { run as real } from "../tr1/gen.mjs";
import * as B from "../../web-src/bookings.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const n = notb(2500, 0); ok(n.pass === 2500, "2,500 news / chats / offers → no booking: " + n.pass + " / 2500 " + JSON.stringify(n.bad.slice(0, 1)));
const h = notb(1000, 50000); ok(h.pass === 1000, "1,000 held-out: " + h.pass + " / 1000");
const r = real(2500, 0); ok(r.pass === 2500, "real bookings still read: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
ok(B.readBooking("عاجل | طيران الاحتلال يقصف قاعدة عسكرية خشبية الليلة الماضية بعد ١١ ليلة من القصف", NOW) === null, "Ali's Telegram line → nothing");
ok(B.readBooking("حريق في فندق هيلتون بالغردقة يوم ١٢ نوفمبر الساعة ٧:٠٠", NOW) === null, "hotel news with a date → nothing");
ok(B.readBooking("Booking.com: Save 20% on your next stay! Book now, valid until 30 Nov 2026", NOW) === null, "an offer → nothing");
ok(B.readBooking("Breaking: flight MS 804 diverted to Cairo on 14 Nov 2026 at 09:30", NOW) === null, "flight news → nothing");
const s = B.readBooking("تم تأكيد حجزك في فندق هيلتون مكة من ٣ مارس ٢٠٢٧ لمدة ٤ ليالي رقم الحجز K7QX2P", NOW);
ok(s && s.kind === "stay" && s.nights === 4 && s.code === "K7QX2P", "a real Arabic hotel booking is still read");
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
