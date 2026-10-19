// v6.41 C3: an automation from a sentence (EN / Egyptian / Franco), and the fired events into the pots.
import * as A from "../../web-src/autom.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
let r = A.parseAutomation("When my salary arrives, put 20% in the car fund and tell me");
ok(r && r.pct === 20 && r.pot === "car fund" && r.words.includes("مرتب") && r.words.includes("salary"), "EN: salary → 20% → car fund (salary words in both languages): " + JSON.stringify(r));
r = A.parseAutomation("لما المرتب ينزل حط ٢٠٪ في صندوق العربية وقولي");
ok(r && r.pct === 20 && r.pot === "العربية" && r.words.includes("salary"), "AR: «لما المرتب ينزل حط ٢٠٪ في صندوق العربية وقولي» → 20% → العربية: " + JSON.stringify(r));
r = A.parseAutomation("لما الانستاباي يوصل حوّل 500 جنيه للطوارئ");
ok(r && r.fixed === 500 && r.pct === 0 && r.pot === "الطوارئ" && r.words.includes("instapay"), "AR fixed: 500 جنيه from InstaPay → الطوارئ: " + JSON.stringify(r));
r = A.parseAutomation("lama el mortab yenzel 7awel 10% le sandou2 el gawaz");
ok(r && r.pct === 10 && r.pot === "gawaz" && r.words.includes("salary"), "Franco: 10% → gawaz: " + JSON.stringify(r));
ok(A.parseAutomation("When the bonus comes in, save 30 percent for the holiday").pct === 30, "“save 30 percent for the holiday”");
ok(A.parseAutomation("remind me to pay rent") === null && A.parseAutomation("when salary arrives put 150% in x") === null, "not an automation / 150% → null");
ok(A.ruleText(A.parseAutomation("When my salary arrives, put 20% in the car fund"), false) === "When salary arrives → 20% to car fund", "in words");
// events → pots
let s = A.addRule(A.emptyState(), A.parseAutomation("When my salary arrives, put 20% in the car fund"), 1);
const id = s.rules[0].id;
const read = (ev) => /credited/.test(ev.text) ? { amount: 18000, direction: "in" } : /debited/.test(ev.text) ? { amount: 50, direction: "out" } : null;
let out = A.applyEvents(s, [{ id: "e1", rule: id, text: "EGP 18,000 credited — Salary", ts: 5 }, { id: "e1", rule: id, text: "EGP 18,000 credited — Salary", ts: 5 }], read);
ok(out.state.pots["car fund"] === 3600 && out.added.length === 1, "18,000 × 20% = 3,600 in the car fund, once (the same event twice)");
out = A.applyEvents(out.state, [{ id: "e1", rule: id, text: "again" }, { id: "e2", rule: id, text: "EGP 50 debited", ts: 6 }, { id: "e3", rule: id, text: "Salary ???", ts: 7 }], read);
ok(out.state.pots["car fund"] === 3600 && out.added.length === 1 && out.added[0].confirm, "done events skipped; money OUT never feeds the pot; unreadable → asks to confirm");
const t = A.takeOut(out.state, "car fund", 1000, 9, "car service");
ok(t.pots["car fund"] === 2600 && t.log[0].amount === -1000, "take 1,000 out");
console.log(bad ? bad + " FAILED" : "v741autom ok");
