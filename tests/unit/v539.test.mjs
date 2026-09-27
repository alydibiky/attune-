// Unit tests for v5.39: translating a document while keeping its shape (web-src/convert.js).
import * as C from "../../web-src/convert.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const blocks = [{ type: "h1", text: "Rental offer" }, { type: "p", text: "Dear Hassan,\nplease find our offer." }, { type: "li", text: "Operator included" },
  { type: "table", rows: [["Crane", "Price (EGP)"], ["LTM 1100", "32,000"], ["50 t", "18,000"]] }, { type: "p", text: "2026-10-01" }];
const units = C.translateUnits(blocks);
eq(units.map((u) => u.text), ["Rental offer", "Dear Hassan,\nplease find our offer.", "Operator included", "Crane", "Price (EGP)", "LTM 1100"], "pieces to translate: text and word cells; numbers-only cells and dates are not sent");
eq(C.batchUnits(units, 40), [[0], [1], [2, 3], [4, 5]], "pieces are grouped into batches under the size limit");
const msg = C.translateMessages(["Dear Hassan,\nplease find our offer.", "Crane"], "Arabic");
eq([/into Arabic/.test(msg[0].content), msg[1].content], [true, "[[1]] Dear Hassan, <br> please find our offer.\n[[2]] Crane"], "the prompt numbers each piece and carries line breaks as <br>");
eq(C.parseTranslated("Sure!\n[[2]] ونش\n[[1]] عزيزي حسن، <br> مرفق عرضنا.\n[[3]] زيادة", 2), ["عزيزي حسن،\nمرفق عرضنا.", "ونش"], "the reply is read by number (order, chatter and extra numbers don't matter)");
eq(C.parseTranslated("[[1]] عرض", 2), ["عرض", null], "a skipped piece is noticed");
eq(C.parseTranslated("عرض إيجار", 1), ["عرض إيجار"], "a single piece answered without its marker is still used");
const out = C.applyTranslations(blocks, units, ["عرض إيجار", "عزيزي حسن،\nمرفق عرضنا.", "المشغّل مشمول", "الونش", "السعر (جنيه)", null]);
eq(out[3].rows, [["الونش", "السعر (جنيه)"], ["LTM 1100", "32,000"], ["50 t", "18,000"]], "translations go back into the same table cells; numbers untouched; a missing one stays as it was");
eq([out[0].type, out[0].text, blocks[0].text], ["h1", "عرض إيجار", "Rental offer"], "headings stay headings; the original blocks are not changed");
eq(C.KINDS.pdf.targets.includes("translate") && C.KINDS.srt.targets.includes("translate") && !C.KINDS.xlsx.targets.includes("translate"), true, "PDF, Word… and subtitles can be translated");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
