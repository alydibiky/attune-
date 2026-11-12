// v9.9.21 T1 brain dump — a 2,500 sample of tests/braindump/gen.mjs (10,000 paragraphs, 20 languages + Franco) must stay ≥ 99%, and a
// held-out set written AFTER the fixes (phrasings the generator never makes: Ali's own example, Egyptian Arabic shortcuts, mixed lines).
import { execFileSync } from "child_process";
import { organise } from "../../web-src/braindump.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../braindump/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const m = /Passed: \*\*(\d+) \/ (\d+)/.exec(out); ok(m && +m[1] / +m[2] >= 0.99, "2,500 generated paragraphs ≥ 99%: " + (m ? m[1] + "/" + m[2] : out.slice(0, 80)));
const now = Date.parse("2026-11-12T10:00:00");   // Thursday
const t = (s) => organise(s, { now }).map((x) => [x.type, x.date, x.time, x.amount, x.items.join("|")].join(" "));
const same = (s, want, what) => { const got = t(s); ok(JSON.stringify(got) === JSON.stringify(want), what + "\n      got " + JSON.stringify(got)); };
// Ali's own example (the combined screen)
same("This week: finish the tender file by Thursday, buy milk + bread, Karim's birthday Saturday — get him a gift under 500, pay the gam'eya 2000 on the 1st, and call the bank tomorrow morning.",
  ["todo 2026-11-12   ", "list    milk|bread", "todo 2026-11-14  500 ", "payment 2026-12-01  2000 ", "reminder 2026-11-13 10:00  "], "Ali's paragraph → 5 things, right types, days, amounts");
same("بكرة: اشتري لبن وعيش، كلم الدكتور الساعة 5 وبعدين ادفع الإيجار 6000 يوم 1. دفعت 85 غدا", ["list 2026-11-13   لبن|عيش", "reminder 2026-11-13 17:00  ", "payment 2026-12-01  6000 ", "spent 2026-11-12  85 "],
  "«بكرة:» covers its sentence only; «الساعة 5» = 5 pm; «غدا» after دفعت is lunch, not tomorrow");
same("خلص السكر والزيت. خلص التقرير بكرة", ["list    السكر|الزيت", "todo 2026-11-13   "], "«خلص السكر» = ran out; «خلص التقرير» = finish the report");
same("ابعت السي في لشركة النور. ابعت لأحمد إني هتأخر الساعة 9", ["todo    ", "reminder  09:00  "], "«ابعت السي في» is a to-do; «ابعت لأحمد … الساعة 9» a reminder");
same("bokra: eshtery laban w 3eish, kalem el doctor el sa3a 6. dafa3t 120 taxi", ["list 2026-11-13   laban|3eish", "reminder 2026-11-13 18:00  ", "spent 2026-11-12  120 "], "Franco: bokra:, w, el sa3a 6 (pm), dafa3t (the 3 is a letter)");
same("Sunday: renew the car licence; Monday pay the electricity bill 850", ["todo 2026-11-15   ", "payment 2026-11-16  850 "], "a day before a colon, then another day");
same("we're out of coffee and sugar\nremind me to call mum at 8:30 pm", ["list    coffee|sugar", "reminder  20:30  "], "out of → list; 8:30 pm → 20:30");
same("mañana: comprar huevos y pan, llamar al banco a las 10, pagar el alquiler 900 el 1", ["list 2026-11-13   huevos|pan", "reminder 2026-11-13 10:00  ", "payment 2026-12-01  900 "], "Spanish day carried after the colon");
same("明天：买牛奶、面包和鸡蛋。打车花了35", ["list 2026-11-13   牛奶|面包|鸡蛋", "spent 2026-11-12  35 "], "Chinese: 、 lists, ： carries the day");
same("Einkaufen: Milch, Eier und Brot kaufen", ["list    Milch|Eier|Brot"], "German verb at the end");
same("idea for the shop logo", ["todo    "], "a thought is kept (never dropped)");
ok(organise("", { now }).length === 0 && organise("   \n  ", { now }).length === 0, "nothing in → nothing out");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
