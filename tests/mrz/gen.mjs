// v9.9.22 X1 — exactly 10,000 machine-readable zones (passports TD3, ID cards TD1, visas TD2) of many countries, with the noise a phone's
// text reader adds: look-alike swaps (O/0, I/1, S/5, B/8, Z/2, G/6), « for <, spaces, the printed page above. Half the documents also get
// one character truly misread inside a checked field. The oracle (built here): a field marked OK is NEVER wrong; look-alike noise is fixed
// exactly ("sure"); a true misread is never "sure". node tests/mrz/gen.mjs [n]
import fs from "fs";
const M = await import(process.env.MRZ || "../../web-src/mrz.js");
const N = +(process.argv[2] || 10000);
let seed = 9; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648), int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
const W = [7, 3, 1], val = (c) => (c === "<" ? 0 : /\d/.test(c) ? +c : c.charCodeAt(0) - 55), cd = (s) => String([...s].reduce((a, c, i) => a + val(c) * W[i % 3], 0) % 10);
const C = ["EGY", "SAU", "ARE", "GBR", "USA", "FRA", "DEU", "TUR", "IND", "PAK", "IDN", "NGA", "KEN", "BRA", "MAR", "JOR", "D<<", "CHN", "JPN", "KOR"];
const SUR = ["ELDIBIKY", "MOHAMED", "SMITH", "OCONNOR", "NGUYEN", "GARCIA LOPEZ", "AL RASHID", "KIM", "MUELLER", "OKAFOR", "SILVA"], GIV = ["ALI", "NADA", "JOHN PAUL", "MARIAM", "WEI", "AHMED SAMIR", "FATIMA", "LUCAS", "AISHA"];
const pad = (s, n) => (s + "<".repeat(n)).slice(0, n), d6 = (y, m, d) => String(y % 100).padStart(2, "0") + String(m).padStart(2, "0") + String(d).padStart(2, "0");
const iso = (y, m, d) => y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
const LOOK = { "0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G", O: "0", I: "1", S: "5", B: "8", Z: "2", G: "6" };
function make() {
  const type = pick(["TD3", "TD3", "TD1", "TD2"]), country = pick(C), nat = pick(C), sur = pick(SUR), giv = pick(GIV), sex = pick(["M", "F", "<"]);
  const by = int(1940, 2015), bm = int(1, 12), bd = int(1, 28), ey = int(2026, 2040), em = int(1, 12), ed = int(1, 28);
  const number = type === "TD1" ? pick(["A", "B", "X"]) + String(int(10000000, 99999999)) : String(int(10000000, 99999999)) + pick(["", "A"]);
  const nm = pad(number, 9), name = sur.replace(/ /g, "<") + "<<" + giv.replace(/ /g, "<");
  let lines;
  if (type === "TD3") { const l1 = pad("P<" + country + name, 44), body = nm + cd(nm) + nat + d6(by, bm, bd) + cd(d6(by, bm, bd)) + sex + d6(ey, em, ed) + cd(d6(ey, em, ed)) + (() => { const o = pad(rnd() < 0.5 ? "" : pick(["ZE184226B", "A1B2C3", "29001011234567"].map((x) => x.slice(0, 14))), 14); return o + cd(o); })();
    const comp = cd(body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43)); lines = [l1, body + comp]; }
  else if (type === "TD2") { const l1 = pad("I<" + country + name, 36), b = nm + cd(nm) + nat + d6(by, bm, bd) + cd(d6(by, bm, bd)) + sex + d6(ey, em, ed) + cd(d6(ey, em, ed)) + pad("", 7); lines = [l1, b + cd(b.slice(0, 10) + b.slice(13, 20) + b.slice(21, 35))]; }
  else { const l1 = pad("I<" + country + nm + cd(nm), 30), l2 = pad(d6(by, bm, bd) + cd(d6(by, bm, bd)) + sex + d6(ey, em, ed) + cd(d6(ey, em, ed)) + nat, 29); lines = [l1, l2 + cd(l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29)), pad(name, 30)]; }
  const truth = { type, country, nationality: nat, surname: sur, given: giv, number, birth: iso(by, bm, bd), expiry: iso(ey, em, ed), sex: sex === "<" ? "" : sex };
  // noise: look-alike swaps (fixable) anywhere in number / dates / names; one TRUE misread (a digit for another digit) in half
  const hard = rnd() < 0.5; let where = null;
  const noisy = lines.map((l, li) => [...l].map((c, ci) => { if (rnd() < 0.06 && LOOK[c] && !(type !== "TD1" && li === 0 && ci < 5) && !(type === "TD1" && li === 0 && ci < 5)) return LOOK[c]; if (c === "<" && rnd() < 0.08) return "«"; return c; }).join(""));
  if (hard) { // a digit inside the number / birth / expiry changed to a DIFFERENT digit (not a look-alike)
    const spots = type === "TD3" || type === "TD2" ? [["number", 1, int(0, 7)], ["birth", 1, int(13, 18)], ["expiry", 1, int(21, 26)]] : [["number", 0, int(6, 13)], ["birth", 1, int(0, 5)], ["expiry", 1, int(8, 13)]];
    const [f, li, ci] = pick(spots), l = [...noisy[li]], c0 = lines[li][ci]; if (/\d/.test(c0)) { let d; do d = String(int(0, 9)); while (d === c0); l[ci] = d; noisy[li] = l.join(""); where = f; } }
  const page = pick(["", "PASSPORT\nREPUBLIC\nSurname / Nom\n" + sur + "\nGiven names\n" + giv + "\n", "IDENTITY CARD\n" + giv + " " + sur + "\n"]);
  const text = page + noisy.map((l) => (rnd() < 0.3 ? l.replace(/(.{10})/g, "$1 ") : l)).join("\n");
  return { text, truth, where };
}
let pass = 0; const miss = {};
for (let i = 0; i < N; i++) {
  const { text, truth, where } = make(); let r, why = "";
  try { r = M.readMrz(text); } catch (e) { why = "crash " + e.message; }
  if (!why && !r) why = "not found";
  if (!why) {
    if (r.ok.number && r.number !== truth.number) why = "number marked OK but wrong";
    else if (r.ok.birth && r.birth !== truth.birth) why = "birth marked OK but wrong";
    else if (r.ok.expiry && r.expiry !== truth.expiry) why = "expiry marked OK but wrong";
    else if (where && r.sure) why = "a true misread (" + where + ") was called sure";
    else if (where && r.ok[where]) why = "the misread field was marked OK";
    else if (!where && !r.sure) why = "look-alike noise not fixed (not sure)";
    else if (!where && (r.number !== truth.number || r.birth !== truth.birth || r.expiry !== truth.expiry)) why = "look-alike noise: wrong value";
    else if (r.surname !== truth.surname || r.given !== truth.given) why = "name wrong";
    else if (r.nationality !== truth.nationality.replace(/<+$/, "").padEnd(3, "<") && r.nationality.replace(/<+/g, "") !== truth.nationality.replace(/<+/g, "")) why = "nationality wrong";
    else if (r.sex !== truth.sex) why = "sex wrong";
  }
  if (!why) pass++; else (miss[why] = miss[why] || []).push(i);
}
const rep = ["# MRZ — " + N + " documents", "", "Passed: **" + pass + " / " + N + " (" + (100 * pass / N).toFixed(2) + "%)**", "", ...Object.entries(miss).map(([k, l]) => "- " + k + " — " + l.length)].join("\n");
if (N === 10000) fs.writeFileSync(new URL("./report.md", import.meta.url), rep + "\n");
console.log(rep);
