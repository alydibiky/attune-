// v9.9.24 B6 X6 Kids & school: a 2,500 sample of tests/x6/gen.mjs must stay at 100%, a held-out 500, plus messages written by hand after the fixes.
import { run } from "../x6/gen.mjs";
import * as S from "../../web-src/schoolmsg.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated class-group messages: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const NOW = Date.parse("2026-11-12T12:00:00");   // Thursday
const k = (t) => S.readClassMessage(t, NOW).map((x) => [x.kind, x.date, x.amount, x.ask].join("|"));
ok(JSON.stringify(k("Dear parents, the math exam is on Sunday 15 Nov, chapters 3-4. Trip fee 350 EGP by Wednesday. Lab coat needed on Tuesday. No school on Thursday.")) ===
  JSON.stringify(["exam|2026-11-15||", "fee|2026-11-18|350|", "bring|2026-11-17||", "holiday|2026-11-12||which"]), "the mock-up's message: exam 15 Nov (not 15 as money, not chapters 3–4), fee 350 by Wed, lab coat Tue, holiday → which Thursday?");
ok(JSON.stringify(k("السادة أولياء الأمور، امتحان العربي يوم الأحد ١٥ نوفمبر. رسوم الرحلة ٣٥٠ جنيه آخر ميعاد الأربع.")) === JSON.stringify(["exam|2026-11-15||", "fee|2026-11-18|350|"]), "Arabic: «امتحان … ١٥ نوفمبر», «رسوم الرحلة ٣٥٠ جنيه آخر ميعاد الأربع»");
ok(JSON.stringify(k("Chers parents, sortie au musée jeudi 19/11, 15 euros à payer avant lundi.")) === JSON.stringify(["trip|2026-11-19||", "fee|2026-11-16|15|"]), "French: sortie jeudi 19/11; 15 € à payer avant lundi");
ok(k("Reminder: the science quiz is next week.")[0].endsWith("|day"), "an exam with no clear day → asked");
ok(k("Please pay the bus subscription by Monday.")[0] === "fee|2026-11-16||amount", "a fee with no amount → asked how much");
ok(k("Good morning everyone! Hope you had a great weekend.").length === 0, "a greeting with nothing in it → nothing");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
