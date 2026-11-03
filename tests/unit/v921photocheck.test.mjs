// v9.0 (the real-model photo trial: «45000» read as "000 4500"): a photo answer's numbers are checked against the phone's text reader.
import { checkPhotoNumbers, numbersOf } from "../../web-src/photocheck.js";
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x !== undefined ? "  " + JSON.stringify(x) : "")); } };
const ocr = "ملاحظة الموقع\nالونش 70 طن يوصل السبت 7 الصبح\nالحساب 45000 جنيه\nالمسؤول: م. كريم";
let r = checkPhotoNumbers("الونش 70 طن يومصل السبت 7 الصباح\nالحساب 000 4500 جنيه", ocr);
ok(!r.ok && r.missing.includes("4500") && r.photo.includes("45000"), "«000 4500» is not in the photo → flagged, with the photo's 45000", r);
r = checkPhotoNumbers("الونش 70 طن — الحساب 45,000 جنيه", ocr); ok(r.ok, "45,000 = 45000 → fine", r);
r = checkPhotoNumbers("Anker 737 Power Bank 3,450.00 · USB-C cable 150.00 · Total 4,104", "B.TECH Receipt 00481 28/09/2026 Anker 737 Power Bank 3,450.00 USB-C cable 1m 150.00 Subtotal 3,600.00 VAT 14% 504.00 TOTAL 4,104.00");
ok(r.ok, "the receipt's numbers all match (3,450.00 = 3450, 4,104 = 4104.00)", r);
r = checkPhotoNumbers("Total 4,140", "TOTAL 4,104.00"); ok(!r.ok && r.missing[0] === "4140", "a total read wrong (4,140 vs 4,104) is flagged", r);
r = checkPhotoNumbers("a cat on a sofa, about 2 years old", ""); ok(r.ok, "no numbers in the photo → nothing to check");
ok(numbersOf("١٢٬٥٠٠ و 7 و 3,450.00").join() === "12500,3450", "Arabic digits; one-digit numbers are not checked");
ok(checkPhotoNumbers("the bill is 45 000 EGP", ocr).ok, "«45 000» with a space is 45000");
console.log(bad ? bad + " FAILED" : "PASS v921photocheck: a photo answer's numbers are checked against the photo");
