// v9.9.24 X1 business card → People card: a 2,500 sample of tests/x1card/gen.mjs must stay at 100%, a held-out 500, plus cards written by hand.
import { run } from "../x1card/gen.mjs";
import * as B from "../../web-src/bizcard.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated cards: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out cards: " + h.pass + " / 500");
const a = B.readCard("Ahmed Kamal\nSales Manager\nRaya Trading Co.\nMob: +20 100 123 4567\nTel: 02 2345 6789\nFax: 02 2345 6790\nahmed.kamal@raya.com\nwww.raya.com");
ok(a.name === "Ahmed Kamal" && a.title === "Sales Manager" && a.company === "Raya Trading Co." && a.phone === "+20 100 123 4567" && a.email === "ahmed.kamal@raya.com" && a.website === "www.raya.com", "English card: every field, the mobile saved (not the fax)");
const b = B.readCard("م. محمود السيد\nمدير المشروعات\nشركة النيل للمقاولات\nموبايل: ٠١٠٠١٢٣٤٥٦٧\nفاكس: ٠٢٢٣٤٥٦٧٨٩");
ok(b.name === "محمود السيد" && b.title === "مدير المشروعات" && b.company === "شركة النيل للمقاولات" && b.phone === "01001234567", "Arabic card: «م. محمود السيد» → محمود السيد, Arabic-digit mobile");
const c = B.readCard("مهندس أول\nسارة فوزي\nمجموعة دلتا\nجوال: 0551234567");
ok(c.name === "سارة فوزي" && c.title === "مهندس أول", "«مهندس أول» is a title (senior engineer), not «Eng. أول»");
const d = B.readCard("Fax: 02 2345 6790\ninfo@shop.com");
ok(d.phone === "" && !d.sure.name, "only a fax and no name → no phone saved, the name left to fill");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
