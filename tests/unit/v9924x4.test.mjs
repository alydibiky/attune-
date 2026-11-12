// v9.9.24 B6 X4 the emergency card: a 2,500 sample of tests/x4/gen.mjs must stay at 100%, a held-out 500, plus blood types written
// in ways the generator never used (written after the fixes) and the rules one by one.
import { run } from "../x4/gen.mjs";
import * as E from "../../web-src/emergency.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated family records: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 2)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out records: " + h.pass + " / 500");
const HELD = [["B+ve", "B+"], ["A-ve", "A-"], ["AB plus", "AB+"], ["O minus", "O-"], ["O Rh(D) positive", "O+"], ["A pos.", "A+"], ["Tipo O+", "O+"], ["B rh +", "B+"],
  ["فصيله الدم أو سالب", "O-"], ["Rh negative A", "A-"], ["A1+", null], ["D+", null], ["O+ or O-", null], ["", null]];
for (const [s, w] of HELD) ok(E.bloodType(s) === w, "held-out blood " + JSON.stringify(s) + " → " + w + " (got " + E.bloodType(s) + ")");
const NOW = Date.parse("2026-11-12T12:00:00");
const baba = { id: "b", name: "Baba", emergency: { blood: "O pos", allergies: ["Penicillin"], doctor: { name: "Dr Hany", phone: "010 2345 6789" }, insurance: { company: "Misr", number: "7712345641" }, call: [{ name: "Ahmed", rel: "brother", phone: "0111" }] } };
const care = { members: [baba], meds: [{ id: "1", member: "b", name: "Concor", strength: "5 mg", dose: "1", times: ["08:00"], start: "2026-01-01" }, { id: "2", member: "b", name: "Augmentin", strength: "1 g", start: "2026-10-01", days: 7 }, { id: "3", member: "b", name: "Old", stopped: true, start: "2026-01-01" }] };
const c = E.cardOf(baba, care, NOW);
ok(c.blood === "O+" && c.meds.length === 1 && /^Concor 5 mg 1 \(08:00\)$/.test(c.meds[0]) && !c.missing.length, "Baba: O+, only Concor (the finished course and the stopped one aren't on it)");
const ar = E.shareText(c, "ar");
ok(/كارت الطوارئ — Baba/.test(ar) && ar.includes("فصيلة الدم: O+") && ar.includes("حساسية: Penicillin") && ar.includes("77…41") && !ar.includes("7712345641"), "shared in Arabic, insurance masked:\n" + ar);
const en = E.shareText([c, E.cardOf({ id: "n", name: "Nada", emergency: {} }, care, NOW)], "en");
ok(en.split("\n\n").length === 2 && !en.includes("No known allergies"), "share all: two cards; Nada's allergies were never filled in → NOT 'no known allergies'");
ok(E.shareText(E.cardOf({ id: "n", name: "Nada", emergency: { noAllergies: true } }, care, NOW), "en").includes("No known allergies"), "…only when 'no allergies' was ticked");
ok(JSON.stringify(E.cardOf({ id: "n", name: "Nada", emergency: {} }, care, NOW).missing) === '["blood","call","doctor","allergies"]', "Nada's card lists what is still missing");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
