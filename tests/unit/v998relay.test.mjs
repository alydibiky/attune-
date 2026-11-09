// v9.9.8 M2: small models as a relay — the memory rule and the strict meaning pick.
import * as R from "../../web-src/relay.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const GB = 1024 ** 3;
ok(R.helperAllowed({ helperBytes: 0.44 * GB, chatBytes: 2.8 * GB, freeBytes: 2 * GB }).ok, "meaning model (0.44 GB) next to Core (2.8 GB) with 2 GB free → allowed");
ok(R.helperAllowed({ helperBytes: 0.44 * GB, chatBytes: 2.8 * GB, freeBytes: 1.0 * GB }).why === "memory", "…with only 1 GB free → not now (the chat model needs room)");
ok(R.helperAllowed({ helperBytes: 2.7 * GB, chatBytes: 0.5 * GB, freeBytes: 8 * GB }).why === "big", "a 4B model is never a helper");
ok(R.helperAllowed({ helperBytes: 0.5 * GB, chatBytes: 2.8 * GB, otherBytes: 1.4 * GB, freeBytes: 8 * GB }).why === "two-big", "never two models over ~1.5 B together");
const v = (a) => Float32Array.from(a);
const recs = [
  { id: "1", kind: "note", title: "Electricity", text: "electricity bill 850 for October", ts: 3 },
  { id: "2", kind: "note", title: "Gym", text: "leg day on Monday", ts: 2 },
  { id: "3", kind: "note", title: "Car", text: "parked on level -2, pillar B7", ts: 1 },
];
const vec = { 1: v([1, 0, 0]), 2: v([0, 1, 0]), 3: v([0, 0, 1]) };
const qv = v([0.95, 0.05, 0.1]);   // «فاتورة الكهربا كام» — no word in common with "electricity bill"
let got = R.meaningPick("فاتورة الكهربا كام", recs, (r) => vec[r.id], qv);
ok(got.length === 1 && got[0].rec.id === "1" && got[0].sim > R.MEAN_ALONE, "Arabic question finds the English electricity note by meaning alone (very close)");
got = R.meaningPick("فاتورة الكهربا كام", recs, (r) => vec[r.id], v([0.6, 0.55, 0.58]));
ok(got.length === 0, "strict: only loosely close, no shared word → nothing is passed as 'yours'");
got = R.meaningPick("where did I leave the car", recs, (r) => vec[r.id], v([0.55, 0.55, 0.6]));
ok(got.length === 1 && got[0].rec.id === "3" && got[0].words === 1, "a shared word ('car') lets a moderately close note in");
ok(R.meaningPick("x", recs, () => null, qv).length === 0, "no stored numbers → nothing (words still work)");
const m = R.mergeFound([{ rec: recs[1] }], [{ rec: recs[1], sim: 0.9 }, { rec: recs[0], sim: 0.8 }], 3);
ok(m.length === 2 && m[0].rec.id === "2" && m[1].rec.id === "1" && m[1].byMeaning, "word hits first, meaning hits added once, marked");
ok(R.docIdOf({ id: "a" }) === "m:a", "the stored numbers are found under Recall's id for the record");
if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("ALL PASSED");
