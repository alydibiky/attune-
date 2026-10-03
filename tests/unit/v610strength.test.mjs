// v6.10 — recorded failure: the 4B model's tests expected 2023-02-28 → 2024-02-28 = 366 days (it is 365).
const CD = await import("../../web-src/code.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const code = `assertEqual(daysBetween('2023-02-28', '2024-02-28'), 366);\nassertEqual(daysBetween('2024-02-28','2024-03-01'), 2);\nconsole.log(1)`;
const f = CD.dateFacts(code);
ok(f[0] === "2023-02-28 → 2024-02-28 = 365 days", "dateFacts: 365 not 366");
ok(f[1] === "2024-02-28 → 2024-03-01 = 2 days", "dateFacts: leap year");
ok(CD.dateFacts("x = 1").length === 0, "dateFacts: none without dates");
process.exit(fail ? 1 : 0);
