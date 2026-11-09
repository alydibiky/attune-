// v9.9.7 W1 (Ali OK'd): "Do it on the web" — the task read, the site, the steps; it fills date / time / people; never pays
import assert from "node:assert/strict";
import * as W from "../../web-src/webtask.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
const NOW = Date.parse("2026-11-10T12:00:00");   // Tuesday
let x = W.readWebTask("book a padel court Friday 8pm near me", NOW);
ok(x && x.verb === "book" && x.what === "padel court" && x.date === "2026-11-13" && x.time === "20:00" && x.near, "“book a padel court Friday 8pm near me” → padel court · Fri 13 Nov · 20:00 · near me");
ok(x.url.startsWith("https://www.google.com/search?q=book%20padel%20court%20near%20me") && x.searched, "no known site → a web search to find it (the person picks the site)");
x = W.readWebTask("reserve a table for 4 at Sachi tomorrow at 9:30 pm", NOW);
ok(x.people === 4 && x.time === "21:30" && x.date === "2026-11-11" && /table/.test(x.what), "“reserve a table for 4 … tomorrow at 9:30 pm” → 4 people, 21:30, tomorrow");
x = W.readWebTask("renew my car licence", NOW);
ok(x && x.url === "https://digital.gov.eg/" && x.site === "Digital Egypt" && !x.searched, "“renew my car licence” → Digital Egypt");
x = W.readWebTask("احجزلي ملعب بادل يوم الجمعة الساعة ٨ بالليل", NOW);
ok(x && x.time === "20:00" && x.date === "2026-11-13" && /ملعب بادل/.test(x.what), "«احجزلي ملعب بادل يوم الجمعة الساعة ٨ بالليل» → Fri 20:00");
ok(W.readWebTask("book a hotel near the Haram", NOW) === null && W.readWebTask("book an uber to the airport", NOW) === null, "hotels and rides stay with Agents / W2");
ok(W.readWebTask("can I book a court?", NOW) === null, "a question is not a task");
const f = W.fillFor({ first: "Ali", phone: "0100" }, { date: "2026-11-13", time: "20:00", people: 4 });
ok(f.first === "Ali" && f.taskDate === "2026-11-13" && f.taskTime === "20:00" && f.taskPeople === "4", "the browser fills the saved details + the task's date, time and people");
let s = W.stepsFor(W.readWebTask("book a padel court Friday 8pm", NOW));
ok(s.map((x) => x.state).join() === "done,wait,wait,wait", "before: understood ✓, the rest waiting");
s = W.stepsFor(W.readWebTask("book a padel court Friday 8pm", NOW), { filled: 3, payment: true });
ok(s[2].state === "done" && s[2].n === 3 && s[3].state === "you", "after: 3 fields filled ✓, payment page → your turn (Attune never pays)");
console.log("ALL PASSED v997webtask (" + n + " checks)");
