/* ---- v9.9.23 X1: the Egyptian national ID number (الرقم القومي, 14 digits) read by code. Its parts are public: the century (2 = 1900s,
   3 = 2000s), the birth date (YYMMDD), the governorate of birth (2 digits, 88 = born abroad), a serial whose last digit is ODD for a man and
   EVEN for a woman, then a check digit. The check digit's formula is not published, so it is NOT used to accept or reject — a number is
   accepted only when its century, a real calendar date (not in the future) and a known governorate all agree; otherwise Attune says
   which part is wrong. Arabic-Indic / Persian digits and spaces are fine. Pure. Tests: tests/egid/gen.mjs (10,000) + tests/unit/v9923egid.test.mjs. */
export const GOVS = { "01": "Cairo", "02": "Alexandria", "03": "Port Said", "04": "Suez", "11": "Damietta", "12": "Dakahlia", "13": "Sharqia", "14": "Qalyubia",
  "15": "Kafr El Sheikh", "16": "Gharbia", "17": "Monufia", "18": "Beheira", "19": "Ismailia", "21": "Giza", "22": "Beni Suef", "23": "Fayoum", "24": "Minya",
  "25": "Asyut", "26": "Sohag", "27": "Qena", "28": "Aswan", "29": "Luxor", "31": "Red Sea", "32": "New Valley", "33": "Matrouh", "34": "North Sinai", "35": "South Sinai", "88": "Born abroad" };
export const GOVS_AR = { "01": "القاهرة", "02": "الإسكندرية", "03": "بورسعيد", "04": "السويس", "11": "دمياط", "12": "الدقهلية", "13": "الشرقية", "14": "القليوبية",
  "15": "كفر الشيخ", "16": "الغربية", "17": "المنوفية", "18": "البحيرة", "19": "الإسماعيلية", "21": "الجيزة", "22": "بني سويف", "23": "الفيوم", "24": "المنيا",
  "25": "أسيوط", "26": "سوهاج", "27": "قنا", "28": "أسوان", "29": "الأقصر", "31": "البحر الأحمر", "32": "الوادي الجديد", "33": "مطروح", "34": "شمال سيناء", "35": "جنوب سيناء", "88": "خارج الجمهورية" };
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
/** The 14-digit numbers in a text (spaces / dashes between groups allowed). */
export function findIds(text) {
  const t = latin(text), out = [], re = /(?<!\d)([23](?:[\s-]?\d){13})(?!\d)/g; let m;
  while ((m = re.exec(t))) out.push(m[1].replace(/[\s-]/g, ""));
  return out;
}
/** One number → { ok, number, birth: "YYYY-MM-DD", governorate, governorateAr, sex: "M" | "F", why } (why says what is wrong). */
export function decodeId(raw, now = Date.now()) {
  const n = latin(raw).replace(/[\s-]/g, "");
  if (!/^\d{14}$/.test(n)) return { ok: false, number: n, why: "length" };
  const c = n[0]; if (c !== "2" && c !== "3") return { ok: false, number: n, why: "century" };
  const y = (c === "2" ? 1900 : 2000) + +n.slice(1, 3), m = +n.slice(3, 5), d = +n.slice(5, 7);
  const dt = new Date(y, m - 1, d);
  if (m < 1 || m > 12 || d < 1 || dt.getMonth() !== m - 1 || dt.getDate() !== d) return { ok: false, number: n, why: "date" };
  if (dt.getTime() > now) return { ok: false, number: n, why: "future" };
  const g = n.slice(7, 9); if (!GOVS[g]) return { ok: false, number: n, why: "governorate" };
  const birth = y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  return { ok: true, number: n, birth, governorate: GOVS[g], governorateAr: GOVS_AR[g], sex: +n[12] % 2 ? "M" : "F" };
}
