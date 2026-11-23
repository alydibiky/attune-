// v10.9.5: an Arabic "my…" question reaches your own notes (the meaning search) — ASK_PERSONAL was English-only.
import fs from "fs";
const src = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
const grab = (name) => { const m = src.match(new RegExp("const " + name + " = (/.+/[a-z]*);")); return eval(m[1]); };
const EN = grab("ASK_PERSONAL"), AR = grab("ASK_PERSONAL_AR"), mine = (q) => EN.test(q) || AR.test(q);
let n = 0, fail = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log("FAIL " + m); } };
for (const q of ["فاتورة الكهربا الشهر اللي فات كانت كام؟", "دفعت كام للسباك؟", "انا حطيت الباسبور فين؟", "آخر مرة غيرت الزيت امتى", "كتبت ايه عن الاجتماع امبارح؟", "ما الذي دفعته الأسبوع الماضي؟", "what did I pay for the plumber?"]) ok(mine(q), "about your things: " + q);
for (const q of ["ما هي عاصمة فرنسا؟", "الجو عامل ايه النهارده", "اشرحلي النسبية", "who won the match", "كم سعر الدولار"]) ok(!mine(q), "a general question: " + q);
ok(/isPersonal: \(q\) => isPersonalAsk\(q\)/.test(src), "Chat's personal check uses both");
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`); if (fail) process.exitCode = 1;
