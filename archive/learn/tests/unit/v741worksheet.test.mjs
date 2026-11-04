// v6.41 S1: mark a worksheet — each written answer checked by the maths engine.
import * as C from "../../web-src/coach.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const page = "Homework — page 12\n1) 12 + 7 = 19\n2) 3/4 + 1/4 = 1\n3) 8 × 7 = 54\n4) 2x + 3 = 11\nx = 4\n5) 25% of 80 = 30\n6) 15 − 9 =\n7) What is the capital of Egypt?";
const r = C.markWorksheet(C.splitProblems(page));
const st = r.items.map((x) => x.n + ":" + x.status).join(" ");
ok(r.items.length === 7, "7 problems (the 'x = 4' line is problem 4's answer): " + st);
ok(r.items[0].status === "right" && r.items[1].status === "right", "12 + 7 = 19 and 3/4 + 1/4 = 1 are right");
ok(r.items[2].status === "wrong" && r.items[2].correct === "56" && r.items[2].lesson, "8 × 7 = 54 is wrong; the right answer 56 with the steps");
ok(r.items[3].status === "right" && r.items[3].given === "x = 4", "2x + 3 = 11 with x = 4 on the next line → right");
ok(r.items[4].status === "wrong" && r.items[4].correct === "20", "25% of 80 = 30 → wrong, it's 20");
ok(r.items[5].status === "blank" && r.items[5].correct === "6", "15 − 9 = (nothing) → not answered; the answer is ready");
ok(r.items[6].status === "blank" || r.items[6].status === "unsure", "a question the engine can't check is never marked by a guess");
ok(r.right === 3 && r.wrong === 2 && r.score === 60, "score: 3 right of 5 marked = 60");
ok(C.markWorksheet(C.splitProblems("1) 0.5 + 0.25 = 3/4")).items[0].status === "right", "0.75 written as 3/4 is right");
console.log(bad ? bad + " FAILED" : "v741worksheet ok");
