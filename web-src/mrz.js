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
  // v9.9.38 (the 1M test: 11 % "not found"): a passport's second line can have no "<" at all (the personal number fills it) — a long line
  // that is almost only MRZ letters, digits and "<" is kept; printed words ("PASSPORT", "Surname / Nom") are short or lower-case
  const raw = String(text || "").split(/\n+/);
  const ls = raw.map((r) => [r, cleanLine(r)]).filter(([r, l]) => l.length >= 28 && l.length <= 46 && ((l.match(/</g) || []).length >= 2 || ((l.match(/\d/g) || []).length >= 8 && !/[a-z]/.test(r) && r.replace(/\s/g, "").length - l.length <= 2))).map(([, l]) => l);
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
// v9.9.38 (the 1M test: 5.6 % of numbers were "checked" but wrong): a document number is tried with EVERY look-alike swap. A check digit
// cannot tell G from 6 (16 and 6 differ by 10), and with several look-alikes some mix passes by luck. So: only believable shapes (letters
// as a short prefix and / or one letter at the end — German numbers mix letters and digits, so there any shape), fewest letters first, and
// the WHOLE-LINE check digit (number + dates + extra data) must agree too. Still two answers → "check this", never a guess.
const SWAP = { O: "0", Q: "0", D: "0", I: "1", L: "1", Z: "2", S: "5", G: "6", B: "8", T: "7", "0": "O", "1": "I", "2": "Z", "5": "S", "6": "G", "8": "B" };
function numberCands(raw, cd, country) {
  // a digit the phone read is kept: every extra try is one more chance for a wrong number to pass by luck (the 1M test measured 233 → 23
  // wrong "checked" numbers in 10,000; letting the first character be a letter read as a digit brought it back to 85). A letter read as a
  // digit ("820663465" for "B20663465") therefore fails its check and is asked about — safe, never a wrong number.
  const c = num(cd);
  const tryAll = (first) => { let alts = [""];
    for (const [i, ch] of [...raw].entries()) { const o = SWAP[ch] && (/[A-Z]/.test(ch) || (first && i === 0)) ? [ch, SWAP[ch]] : [ch]; alts = alts.flatMap((a) => o.map((x) => a + x)); if (alts.length > 4096) return []; }
    return [...new Set(alts.filter((t) => checkDigit(t) === c))]; };
  const pass = tryAll(false);
  const mixed = /^D(?:<<|EU)$/.test(country || "");
  // G/6 and L/1 pass the same check digits: a letter in the first place is kept as read (many numbers start with letters — the ICAO
  // specimen is L898902C3), further in a digit is likelier than a letter
  const score = (v) => 10 * [...v].filter((ch, i) => i >= 1 && /[A-Z]/.test(ch)).length + (v[0] !== raw[0] ? 1 : 0);
  // a look-alike letter (O I Z S G B Q D L T) after the first place is the phone's misreading, not part of the number — other letters
  // can be (C in L898902C3); German numbers use look-alike letters too, so there only the check digits decide
  const real = mixed ? pass : pass.filter((v) => ![...v].some((ch, i) => i >= 1 && /[OIZSGBQDLT]/.test(ch)));
  return { list: real.sort((x, y) => score(x) - score(y)), mixed, score };
}
// the number chosen with the whole-line check digit: one answer → OK; none / two → "check this"
function pickNumber(raw, cd, country, compOk) {
  const { list, mixed, score } = numberCands(raw, cd, country);
  const fallback = list[0] || raw;
  if (!list.length) return { v: fallback, ok: false };
  const both = compOk ? list.filter(compOk) : list;
  if (!both.length) return { v: list[0], ok: false };
  if (both.length === 1) return { v: both[0], ok: true };
  if (mixed) return { v: both[0], ok: false };   // a German G / 6: no check digit can tell them apart
  const best = both.filter((v) => score(v) === score(both[0]));
  if (best.length !== 1) return { v: best[0], ok: false };
  // the same number with G / 6 or L / 1 in the first place passes every check digit too: keep what the phone read, and ask
  const twin = both.find((v) => v !== best[0] && v.slice(1) === best[0].slice(1));
  return { v: best[0], ok: !twin };
}
// a date with its check digit (digits only): as read, or with look-alike letters made digits
function checked(raw, cd) { const c = num(cd); for (const t of [raw, num(raw)]) if (checkDigit(t) === c) return { v: t, ok: true }; return { v: num(raw), ok: false }; }
const opts = (x) => [...new Set([x, num(x), alpha(x)])];   // the extra data may be letters or digits
const anyPass = (parts, cd) => { let alts = [""]; for (const p of parts) alts = alts.flatMap((a) => (Array.isArray(p) ? p : [p]).map((x) => a + x)); return alts.some((t) => checkDigit(t) === num(cd)); };
const numberFixed = (raw, f) => (f.ok ? f.v : raw);
/** Read the MRZ → { type, doc, country, surname, given, number, nationality, birth, sex, expiry, ok: {field: bool}, sure } */
export function readMrz(text) {
  const m = findMrz(text); if (!m) return null;
  let doc, country, nm, numF, nat, birthF, sex, expF, opt = "", comp = null;
  if (m.type === "TD3" || m.type === "TD2") {
    const [a, b] = m.lines, n = m.type === "TD3" ? 44 : 36;
    doc = a.slice(0, 2).replace(/<$/, ""); country = alpha(a.slice(2, 5)); nm = names(a.slice(5, n));
    nat = alpha(b.slice(10, 13)); birthF = checked(num(b.slice(13, 19)), b[19], "num"); sex = b[20] === "F" ? "F" : b[20] === "M" ? "M" : "";
    expF = checked(num(b.slice(21, 27)), b[27], "num");
    const dates = num(b.slice(13, 20)) + "", dates2 = num(b.slice(21, 28));
    const compOk = m.type === "TD3" ? (v) => anyPass([v + num(b[9]), dates, dates2, opts(b.slice(28, 43))], b[43])
      : (v) => anyPass([v + num(b[9]), dates, dates2, opts(b.slice(28, 35))], b[35]);
    numF = pickNumber(b.slice(0, 9), b[9], alpha(a.slice(2, 5)), compOk);
    if (m.type === "TD3") { opt = b.slice(28, 42); // (the optional personal number may hold letters — only the dates are digits-only)
      comp = compOk(numF.v); }
  } else {
    const [a, b, c] = m.lines;
    doc = a.slice(0, 2).replace(/<$/, ""); country = alpha(a.slice(2, 5)); opt = a.slice(15, 30);
    numF = pickNumber(a.slice(5, 14), a[14], country, (v) => anyPass([v + num(a[14]), opts(a.slice(15, 30)), num(b.slice(0, 7)), num(b.slice(8, 15)), opts(b.slice(18, 29))], b[29]));
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
