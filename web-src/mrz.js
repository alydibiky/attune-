/* ---- v9.9.22 X1 paperwork (Ali: "upload the photo of the passport … it fills out all info instead of me inputting everything").
   Passports (TD3, 2 lines × 44), ID cards (TD1, 3 × 30) and visas / older IDs (TD2, 2 × 36) carry a machine-readable zone (ICAO 9303)
   with CHECK DIGITS, so it is read by code — offline, exact — and a field whose check digit fails is never guessed: it is marked
   "check this" for the person to confirm. The phone's text reader (ML Kit) gives the lines; the usual misreadings are fixed first
   (O↔0, I↔1, B↔8, S↔5, Z↔2, G↔6 by where letters or digits must be; "«", "‹", "K<", spaces).
   Pure. Tests: tests/mrz/gen.mjs (10,000 documents with OCR noise) + tests/unit/v9922mrz.test.mjs.
   (The layout and check-digit rule are the public ICAO 9303 standard; the idea of fixing by field type is common to open MRZ readers
   such as the MIT-licensed "mrz" package by cheminfo — no code taken.)                                                            */
const W = [7, 3, 1];
const val = (c) => (c === "<" ? 0 : /[0-9]/.test(c) ? +c : c.charCodeAt(0) - 55);
export const checkDigit = (s) => String([...s].reduce((a, c, i) => a + val(c) * W[i % 3], 0) % 10);
const TO_NUM = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8", T: "7" };
const TO_ALPHA = { "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };
const num = (s) => [...s].map((c) => TO_NUM[c] || c).join("");
const alpha = (s) => [...s].map((c) => TO_ALPHA[c] || c).join("");
/** One raw OCR line → MRZ characters only. */
export function cleanLine(l) {
  return String(l || "").toUpperCase().replace(/[«‹＜〈]/g, "<").replace(/\s+/g, "").replace(/[^A-Z0-9<]/g, "");
}
/** The MRZ lines found in a page's text (2 × 44, 2 × 36 or 3 × 30), tolerant of one char too many / too few. */
export function findMrz(text) {
  const ls = String(text || "").split(/\n+/).map(cleanLine).filter((l) => l.length >= 28 && (l.match(/</g) || []).length >= 2);
  const fit = (l, n) => (l.length === n ? l : l.length === n + 1 ? l.slice(0, n) : l.length === n - 1 ? l + "<" : null);
  for (let i = 0; i + 1 < ls.length; i++) { const a = fit(ls[i], 44), b = fit(ls[i + 1], 44); if (a && b && /^[PV]/.test(a)) return { type: "TD3", lines: [a, b] }; }
  for (let i = 0; i + 2 < ls.length; i++) { const a = fit(ls[i], 30), b = fit(ls[i + 1], 30), c = fit(ls[i + 2], 30); if (a && b && c && /^[ACI]/.test(a)) return { type: "TD1", lines: [a, b, c] }; }
  for (let i = 0; i + 1 < ls.length; i++) { const a = fit(ls[i], 36), b = fit(ls[i + 1], 36); if (a && b && /^[ACIPV]/.test(a)) return { type: "TD2", lines: [a, b] }; }
  return null;
}
const date6 = (s, future) => { if (!/^\d{6}$/.test(s)) return null; const yy = +s.slice(0, 2), mm = +s.slice(2, 4), dd = +s.slice(4, 6); if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const now = new Date().getFullYear() % 100; const y = future ? 2000 + yy : yy > now ? 1900 + yy : 2000 + yy; return y + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0"); };
const names = (s) => { const [sur, giv = ""] = alpha(s).split("<<"); const t = (x) => x.replace(/<+/g, " ").trim(); return { surname: t(sur), given: t(giv) }; };
// a field with its check digit: try the text as read, then with letters / digits fixed; ok = the check digit agrees
function checked(raw, cd, kind) {
  const c = num(cd), tries = kind === "num" ? [raw, num(raw)] : [raw, num(raw), alpha(raw)];
  for (const t of tries) if (checkDigit(t) === c) return { v: t, ok: true };
  return { v: kind === "num" ? num(raw) : raw, ok: false };
}
const numberFixed = (raw, f) => (f.ok ? f.v : raw);
/** Read the MRZ → { type, doc, country, surname, given, number, nationality, birth, sex, expiry, ok: {field: bool}, sure } */
export function readMrz(text) {
  const m = findMrz(text); if (!m) return null;
  let doc, country, nm, numF, nat, birthF, sex, expF, opt = "", comp = null;
  if (m.type === "TD3" || m.type === "TD2") {
    const [a, b] = m.lines, n = m.type === "TD3" ? 44 : 36;
    doc = a.slice(0, 2).replace(/<$/, ""); country = alpha(a.slice(2, 5)); nm = names(a.slice(5, n));
    numF = checked(b.slice(0, 9), b[9], "mix"); nat = alpha(b.slice(10, 13)); birthF = checked(num(b.slice(13, 19)), b[19], "num"); sex = b[20] === "F" ? "F" : b[20] === "M" ? "M" : "";
    expF = checked(num(b.slice(21, 27)), b[27], "num");
    if (m.type === "TD3") { opt = b.slice(28, 42); // (the optional personal number may hold letters — only the dates are digits-only)
      comp = num(b[43]) === checkDigit(numberFixed(b.slice(0, 9), numF) + num(b[9]) + num(b.slice(13, 20)) + num(b.slice(21, 28)) + b.slice(28, 43)); }
  } else {
    const [a, b, c] = m.lines;
    doc = a.slice(0, 2).replace(/<$/, ""); country = alpha(a.slice(2, 5)); numF = checked(a.slice(5, 14), a[14], "mix"); opt = a.slice(15, 30);
    birthF = checked(num(b.slice(0, 6)), b[6], "num"); sex = b[7] === "F" ? "F" : b[7] === "M" ? "M" : ""; expF = checked(num(b.slice(8, 14)), b[14], "num"); nat = alpha(b.slice(15, 18));
    nm = names(c);
  }
  const ok = { number: numF.ok, birth: birthF.ok && !!date6(birthF.v, false), expiry: expF.ok && !!date6(expF.v, true) };
  return { type: m.type, doc: doc === "P" ? "passport" : /^I|^A|^C/.test(doc) ? "id" : doc === "V" ? "visa" : doc.toLowerCase(),
    country, surname: nm.surname, given: nm.given, number: numF.v.replace(/<+/g, ""), nationality: nat, birth: date6(birthF.v, false), sex, expiry: date6(expF.v, true),
    personal: opt.replace(/<+/g, "").trim(), ok: { ...ok, personal: comp == null ? null : comp }, sure: ok.number && ok.birth && ok.expiry };   // (each of the three has its own check digit; the whole-line one also covers the personal number, shown as "check" when it fails)
}
/** For the Dates page: the reminder days for a document (6 months before a passport ends — many countries ask for 6 months left — and 30 days). */
export const remindBefore = (r) => (r && r.doc === "passport" ? [183, 30] : [60, 14]);
