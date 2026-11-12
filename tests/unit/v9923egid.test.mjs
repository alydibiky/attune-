// v9.9.23 Egyptian national ID number → birth date, governorate, sex: a 2,500 sample of tests/egid/gen.mjs must stay 100%, + held-out.
import { execFileSync } from "child_process";
import * as E from "../../web-src/egid.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../egid/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/Passed: \*\*2500 \/ 2500/.test(out), "2,500 generated numbers: 100%");
const now = Date.parse("2026-11-12T12:00:00");
const a = E.decodeId("29003150101234", now);   // a man born 15 Mar 1990 in Cairo (last serial digit 3 = odd)
ok(a.ok && a.birth === "1990-03-15" && a.governorate === "Cairo" && a.governorateAr === "القاهرة" && a.sex === "M", "29003150101234 → 15 Mar 1990, Cairo, man");
const b = E.decodeId("٣٠٥٠٧٢٢٢١٠٠٤٦٨", now);   // Arabic-Indic: born 22 Jul 2005 in Giza, serial ends 6 → woman
ok(b.ok && b.birth === "2005-07-22" && b.governorate === "Giza" && b.sex === "F", "Arabic-Indic digits → 22 Jul 2005, Giza, woman");
ok(E.decodeId("29002300101234", now).why === "date", "30 February is rejected (date)");
ok(E.decodeId("32712010101234", now).why === "future", "a birth in 2027 is rejected (future)");
ok(E.decodeId("29003154001234", now).why === "governorate", "governorate 40 doesn't exist");
ok(JSON.stringify(E.findIds("الرقم القومي: 2900 3150 1012 34 — مطابق")) === '["29003150101234"]', "found inside text with spaces");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
