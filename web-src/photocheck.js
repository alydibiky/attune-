/* ---- v9.0 (the real-model photo trial: the phone's model read «الحساب 45000 جنيه» as "000 4500"): a photo answer's numbers are
   checked by code against the digits the phone's own text reader (ML Kit, NativeBridge.readText) found in the same photo. A number
   in the answer that is not in the photo → one line under the answer with the photo's own numbers, to check. Nothing is changed
   silently. Pure; test: tests/unit/v921photocheck.test.mjs. */
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
/** The numbers written in a text: "3,450.00" → "3450", "45000" → "45000"; 2 digits or more (a "7 am" is not checked). */
export function numbersOf(text) {
  const out = [];
  // "45 000" (a space between thousands) is one number
  const t = latin(text).replace(/\b(\d{1,3})((?:[ \u00a0\u202f]\d{3})+)(?!\d)/g, (m, a, b) => a + b.replace(/\s/g, ""));
  for (const m of t.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    let n = m[0].replace(/,(?=\d{3}\b)/g, "").replace(/,/g, "");
    if (/\.\d+$/.test(n) && /\.0+$/.test(n)) n = n.replace(/\.0+$/, "");
    if (n.replace(/\D/g, "").length >= 2) out.push(n);
  }
  return out;
}
/** answer, ocrText → { ok, missing: [numbers in the answer not in the photo], photo: [the photo's numbers] }. ok when there is
 *  nothing to check (the reader found no numbers) or every number matches. */
export function checkPhotoNumbers(answer, ocrText) {
  const photo = [...new Set(numbersOf(ocrText))];
  if (photo.length < 1) return { ok: true, missing: [], photo };
  const have = new Set(photo);
  const missing = [...new Set(numbersOf(answer))].filter((n) => !have.has(n));
  return { ok: !missing.length, missing, photo };
}
