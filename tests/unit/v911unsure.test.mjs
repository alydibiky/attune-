// v9.1 (Ali, 3 Nov, picked A: "strong code, the small model chooses the meaning, and if it's unsure it asks me"): which recordings
// the code is SURE of (instant) and which go to the model / the person.
import { doSure } from "../../web-src/doit.js";
import { learn, learnedKind, judgeMessages, parseJudge } from "../../web-src/understand.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
for (const t of ["lunch 150", "maid 400", "fuel 500", "paid 200 for the plumber", "koshary", "2 eggs and toast", "pizza and cola", "I ate a galaxy bar",
  "koshary for lunch, 80 pounds", "drank 2 glasses of water", "صرفت 300 على البنزين", "كشري", "البواب 200", "weight 82"]) ok(doSure(t), "sure (instant): " + t);
for (const t of ["co 900", "ahmed 500", "zizo 300"]) ok(!doSure(t), "unsure (model, then the person): " + t);
const S = {}; const ls = { getItem: (k) => S[k] ?? null, setItem: (k, v) => { S[k] = String(v); } };
ok(learnedKind("ahmed 500", ls) === null, "nothing learned yet");
learn("ahmed 500", "money-log", ls); ok(learnedKind("ahmed 750", ls) === "money-log", "a pick is remembered for the same shape (another amount)");
learn("zizo 300", "chat", ls); ok(learnedKind("zizo 10", ls) === "chat", "…'Answer it' too");
const m = judgeMessages("ahmed 500", ["money-log", "chat", "unsure"]);
ok(/unsure/.test(m[0].content) && /money-log/.test(m[0].content), "the model may answer 'unsure'");
ok(parseJudge("unsure", ["money-log", "chat", "unsure"]) === "unsure" && parseJudge("money-log", ["money-log", "chat", "unsure"]) === "money-log", "its reply is read");
console.log(bad ? bad + " FAILED" : "PASS v911unsure: sure recordings stay instant; unsure ones go to the model, then the person — and are remembered");
