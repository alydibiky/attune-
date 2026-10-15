// v6.28 Slides & Reports: big numbers in report tables are grouped by code; codes and years are left alone.
import * as S from "../../web-src/slides.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(S.groupNum("910000") === "910,000" && S.groupNum("1234567.5") === "1,234,567.5", "910000 → 910,000");
ok(S.groupNum("2026") === "2026" && S.groupNum("1100") === "1100" && S.groupNum("LTM 1100") === "LTM 1100", "years, model numbers and words stay as they are");
const b = S.sectionBlocks("Revenue\n\nCrane | Revenue EGP\nAC 500 | 910000\nLTM 1100 | 600000", "Revenue");
const t = b.find((x) => x.type === "table");
ok(t && t.rows[0][1] === "Revenue EGP" && t.rows[1][1] === "910,000" && t.rows[2][0] === "LTM 1100", "a section's table: figures grouped, the header and the crane names untouched");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
