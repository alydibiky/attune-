// v6.12 (item 5) — engineering answers at expert level: the engineering skill is added once, fits Ali's cavitation question,
// brings the right facts (anti-cavitation make-up valves, meter-out / counterbalance), and stays out of a crane quote.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const S = await import("../../web-src/userskills.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const list = S.seedOnce();
ok(list.length === 1 && list[0].command === "/engineer" && list[0].reference.length > 1000, "added once on first start, with its facts library");
S.save([]); ok(S.seedOnce().length === 0, "deleted by the person → not added again");
const sk = S.makeSkill(S.CATALOGUE.find((x) => x.id === "hydraulics"), { source: "catalogue" });
const q = "In an electro-hydraulic closed-loop positioning system, the valve shows cavitation during high-speed deceleration. Give two direct fixes without reducing velocity.";
const m = S.matchSkills(q, [sk]);
ok(m.matches && m.matches.length === 1, "Ali's cavitation question picks it by itself");
const ref = S.relevantReference(sk, q);
ok(/make-up check valves/.test(ref) && /counterbalance/i.test(ref) && /meter-in/.test(ref), "the facts sent: the starved meter-in side, make-up valves, meter-out / counterbalance control");
const b = S.skillBlock(m.matches, q);
ok(/mechanism/.test(b) && /increase pressure/.test(b), "the instructions ask for the mechanism first and forbid generic advice");
{ const r = S.matchSkills("Write a quote for a 50 t crane for 3 days", [sk]); ok(!r || !(r.matches || []).length, "a crane quote does not pick it"); }
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
