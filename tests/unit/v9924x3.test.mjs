// v9.9.24 B6 X3 What I own: a 2,500 sample of tests/x3/gen.mjs must stay at 100%, a held-out 500, plus receipts and boxes written by hand
// after the fixes (never in the generator).
import { run } from "../x3/gen.mjs";
import * as T from "../../web-src/things.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated receipts and boxes: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const NOW = Date.parse("2026-11-12T12:00:00");
const a = T.readReceipt(["B.TECH Maadi", "Tax invoice 004512", "Date: 02/10/2026", "Samsung TV 55\" UA55 18,500.00", "VAT 14% 2,271.93", "TOTAL 18,500.00", "Warranty 2 years"], NOW);
ok(a.price === 18500 && a.sure.price && a.date === "2026-10-02" && a.until === "2028-10-02" && /Samsung TV/.test(a.name) && a.store === "B.TECH Maadi", "B.TECH TV: 18,500 (total line), 2 Oct 2026, warranty → 2 Oct 2028");
const b = T.readReceipt(["كارفور المعادي", "٠٢/١٠/٢٠٢٦", "غسالة توشيبا ٨ كيلو ١٢٬٤٩٩", "الإجمالي ١٢٬٤٩٩", "ضمان سنتين"], NOW);
ok(b.price === 12499 && b.sure.price && b.warrantyMonths === 24 && /غسالة/.test(b.name), "Arabic receipt: 12,499 from «الإجمالي», «ضمان سنتين» = 24 months");
const c = T.readReceipt(["Raya Shop", "Date 01/09/2026", "Mixer 1,250", "Return by 15/09/2026"], NOW);
ok(!c.sure.price && !c.sure.date, "no total line and two dates → price and date marked 'check' (yellow), not guessed as sure");
const d = T.readReceipt(["Fnac", "12.08.26", "Casque Sony 249,00", "TOTAL 249.00", "Garantie 24 mois"], NOW);
ok(d.date === "2026-08-12" && d.warrantyMonths === 24, "French: 12.08.26 → 12 Aug 2026, «garantie 24 mois»");
ok(T.readBox("IMEI 356938035643809").imei === "356938035643809", "a right IMEI is taken");
ok(T.readBox("IMEI 356938035643808").imei === "", "an IMEI with one wrong digit is NOT taken (its check digit)");
ok(T.readBox("الرقم المسلسل: ٠B7K3CAR600123X").serial === "0B7K3CAR600123X", "«الرقم المسلسل» with an Arabic-Indic digit");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
