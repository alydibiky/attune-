// v9.9.23 — exactly 10,000 Egyptian national ID numbers: real ones (any birth date 1930–today, every governorate, both sexes) and broken
// ones (a month 13, 30 February, a future birth, an unknown governorate, 13 digits, century 4), written in Latin or Arabic-Indic digits,
// with spaces / dashes, inside other text. Oracle: real → exact birth date, governorate and sex; broken → rejected with the right reason.
import fs from "fs";
const E = await import(process.env.EGID || "../../web-src/egid.js");
const N = +(process.argv[2] || 10000), now = Date.parse("2026-11-12T12:00:00");
let seed = 17; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648), int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = (l) => l[Math.floor(rnd() * l.length)];
const AR = "٠١٢٣٤٥٦٧٨٩", G = Object.keys(E.GOVS), pad = (n, k = 2) => String(n).padStart(k, "0");
let pass = 0; const miss = {};
for (let i = 0; i < N; i++) {
  const y = int(1930, 2026), mm = int(1, 12), dim = new Date(y, mm, 0).getDate(), dd = int(1, dim), g = pick(G), male = rnd() < 0.5;
  let num = (y >= 2000 ? "3" : "2") + pad(y % 100) + pad(mm) + pad(dd) + g + pad(int(0, 999), 3) + String(int(0, 4) * 2 + (male ? 1 : 0)) + String(int(0, 9)), why = null;
  const born = new Date(y, mm - 1, dd).getTime();
  const r = rnd();
  if (r < 0.08) { num = num.slice(0, 3) + "13" + num.slice(5); why = "date"; }
  else if (r < 0.14) { num = num.slice(0, 3) + "02" + "30" + num.slice(7); why = "date"; }
  else if (r < 0.2) { num = num.slice(0, 7) + pick(["05", "40", "77", "99", "20"]) + num.slice(9); why = "governorate"; }
  else if (r < 0.24) { num = "4" + num.slice(1); why = "century"; }
  else if (r < 0.28) { num = num.slice(0, 13); why = "length"; }
  else if (r < 0.32) { num = "3" + pad(int(27, 40)) + num.slice(3); why = "future"; }
  else if (born > now) why = "future";
  const shown = (rnd() < 0.4 ? [...num].map((c) => AR[c]).join("") : num).replace(/(.{4})/g, (m) => (rnd() < 0.3 ? m + pick([" ", "-"]) : m));
  const text = pick(["", "الرقم القومي ", "National ID: ", "بطاقة رقم "]) + shown + pick(["", "\nمحافظة", " · ok"]);
  let res; const found = E.findIds(text); res = E.decodeId(found[0] || shown);
  let bad = "";
  if (!why) { if (!res.ok) bad = "a real number rejected (" + res.why + ")"; else if (res.birth !== y + "-" + pad(mm) + "-" + pad(dd)) bad = "birth date wrong"; else if (res.governorate !== E.GOVS[g]) bad = "governorate wrong"; else if (res.sex !== (male ? "M" : "F")) bad = "sex wrong"; else if (found.length !== 1) bad = "not found in the text"; }
  else if (res.ok) bad = "a broken number (" + why + ") accepted";
  else if (res.why !== why && !(why === "length" && found.length === 0)) bad = "wrong reason: " + res.why + " for " + why;
  if (!bad) pass++; else (miss[bad] = miss[bad] || []).push(i);
}
const rep = ["# Egyptian national ID — " + N, "", "Passed: **" + pass + " / " + N + " (" + (100 * pass / N).toFixed(2) + "%)**", "", ...Object.entries(miss).map(([k, l]) => "- " + k + " — " + l.length)].join("\n");
if (N === 10000) fs.writeFileSync(new URL("./report.md", import.meta.url), rep + "\n");
console.log(rep);
