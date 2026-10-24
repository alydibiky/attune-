// v7.9 (Ali picked Automations design A + "make more than one automation"): ready rules switched on with one tap, and several
// of your own at once (one per line).
import { READY, readyOn, parseMany, parseAutomation, addRule, emptyState } from "../../web-src/autom.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(READY.every(([, en, ar]) => parseAutomation(en) && parseAutomation(ar)), "every ready rule is understood, in English and Arabic");
let s = emptyState();
ok(!readyOn(s, READY[0][1]), "a ready rule is off at first");
s = addRule(s, parseAutomation(READY[0][1]), 1);
ok(!!readyOn(s, READY[0][1]) && !readyOn(s, READY[1][1]), "switched on → it shows on; the others stay off");
const m = parseMany("When my salary arrives, put 20% in Savings\nلما المكافأة تنزل حط 50% في التوفير\nbuy milk");
ok(m.rules.length === 2 && m.bad.join() === "buy milk", "two automations from two lines; a line that isn't one is reported");
let t = emptyState(); for (const [i, r] of m.rules.entries()) t = addRule(t, r, 10 + i);
ok(t.rules.length === 2 && new Set(t.rules.map((r) => r.id)).size === 2, "both are kept, each with its own id");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
