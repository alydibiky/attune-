// 1M test part D (TEST_1M.md): EXACTLY 150,000 answers worked out by code, each compared with the truth computed HERE, separately
// (never with the app's own helpers):
//   D1 40,000 calculations (calc.js)           — a random expression tree; the truth from this file's own evaluator
//   D2 40,000 "how much did I spend …"          — a random ledger; the span (today, this week from Saturday, last month, the last N days,
//                                                 a month by name…) and the sum done here
//   D3 20,000 "who owes me / how much does X owe me" — random People & plans; what is left done here
//   D4 15,000 "what's due this week / month"    — random papers and reminders; counted here
//   D5 25,000 reminders' times                   — "in 2 weeks", "tomorrow at 7:30 pm", "on Friday at 10 am", «بعد ساعتين» …
//   D6 10,000 country holidays                  — Easter by the Gregorian computus, Orthodox / Coptic Easter by Meeus' Julian formula,
//                                                 Eids on 1 Shawwal / 10 Dhu al-Hijjah (a scan of the Umm al-Qura calendar), fixed days
//     node tests/onemillion/partD.mjs [scale=1]
import fs from "fs";
const C = await import("../../web-src/calc.js"), M = await import("../../web-src/myledger.js"), LA = await import("../../web-src/lifeask.js");
const A = await import("../../web-src/actions.js"), CO = await import("../../web-src/country.js");
const SCALE = +(process.argv[2] || 1);
let seed = 150000 + 7919 * +(process.env.SEED_SHIFT || 0);
const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 864e5, pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const res = {}; const add = (part, ok, why, ex) => { const r = (res[part] = res[part] || { n: 0, bad: 0, ex: {} }); r.n++; if (!ok) { r.bad++; const e = (r.ex[why] = r.ex[why] || []); if (e.length < 4) e.push(ex); } };
const fmtN = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

// ---- D1 calculations -----------------------------------------------------------------------------------------------------------
function expr(depth) {
  if (depth <= 0 || rnd() < 0.3) { const v = rnd() < 0.7 ? int(1, 9999) : Math.round(rnd() * 99999) / 100; return { v, s: rnd() < 0.3 && v >= 1000 && Number.isInteger(v) ? v.toLocaleString("en-US") : String(v) }; }
  const op = pick(["+", "-", "*", "/", "+", "*"]), a = expr(depth - 1), b = expr(depth - 1);
  if (op === "/" && Math.abs(b.v) < 1e-9) return a;
  const v = op === "+" ? a.v + b.v : op === "-" ? a.v - b.v : op === "*" ? a.v * b.v : a.v / b.v;
  const par = (x) => (x.op && (op === "*" || op === "/" || op === "-") && (x.op === "+" || x.op === "-") ? "(" + x.s + ")" : x.op && op === "/" && (x.op === "*" || x.op === "/") ? "(" + x.s + ")" : x.s);
  const sym = rnd() < 0.15 ? { "*": "×", "/": "÷", "-": "−", "+": "+" }[op] : op;
  return { v, s: (a.op && (op === "*" || op === "/") && (a.op === "+" || a.op === "-") ? "(" + a.s + ")" : a.s) + " " + sym + " " + par(b), op };
}
const N1 = 40000 * SCALE;
for (let i = 0; i < N1; i++) {
  let s, truth; const r = rnd();
  if (r < 0.12) { const p = int(1, 99), x = int(10, 99999); s = pick([`${p}% of ${x}`, `what is ${p}% of ${x}`, `${p} % of ${x.toLocaleString("en-US")}`]); truth = p / 100 * x; }
  else if (r < 0.2) { const x = int(10, 99999), p = int(1, 30), sg = rnd() < 0.5 ? 1 : -1; s = `${x} ${sg > 0 ? "+" : "-"} ${p}%`; truth = x * (1 + sg * p / 100); }
  else if (r < 0.26) { const b = int(2, 12), e = int(2, 4); s = `${b}^${e}`; truth = Math.pow(b, e); }
  else { const e = expr(int(1, 4)); if (!e.op) { i--; continue; } s = pick(["", "", "what is ", "calculate ", "how much is "]) + e.s + pick(["", "", " =", "?"]); truth = e.v; }
  let got; try { got = C.calculate(s); } catch (e) { got = { value: NaN, err: e.message }; }
  const v = got && got.value, ok = got != null && Number.isFinite(v) && Math.abs(v - truth) <= 1e-6 * Math.max(1, Math.abs(truth));
  add("D1 calculations", ok, got == null ? "not read as a sum" : "wrong value", `«${s}» → ${got == null ? "null" : v} (truth ${truth})`);
}

// ---- D2 money questions --------------------------------------------------------------------------------------------------------
const CATS = { food: "food", transport: "transport", shopping: "shopping", health: "health", coffee: "coffee", groceries: "groceries", bills: "bills" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function spanTruth(kind, n, today, mo) {
  const d = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const t = d(today), sat = new Date(t); sat.setDate(t.getDate() - ((t.getDay() + 1) % 7));   // a week starts on Saturday (Egypt)
  if (kind === "today") return [t, t];
  if (kind === "yesterday") { const y = new Date(t); y.setDate(t.getDate() - 1); return [y, y]; }
  if (kind === "this week") return [sat, t];
  if (kind === "last week") { const e = new Date(sat); e.setDate(sat.getDate() - 1); const f = new Date(e); f.setDate(e.getDate() - 6); return [f, e]; }
  if (kind === "this month") return [new Date(t.getFullYear(), t.getMonth(), 1), t];
  if (kind === "last month") return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)];
  if (kind === "this year") return [new Date(t.getFullYear(), 0, 1), t];
  if (kind === "lastN") { const f = new Date(t); f.setDate(t.getDate() - (n - 1)); return [f, t]; }
  if (kind === "month") { const y = mo > t.getMonth() ? t.getFullYear() - 1 : t.getFullYear(), f = new Date(y, mo, 1), e = new Date(y, mo + 1, 0); return [f, e > t ? t : e]; }
}
const N2 = 40000 * SCALE;
for (let i = 0; i < N2; i++) {
  const today = new Date(2026, int(0, 11), int(1, 28), 12), txns = [];
  for (let k = 0, K = int(5, 60); k < K; k++) { const dd = new Date(today); dd.setDate(today.getDate() - int(0, 200)); const inc = rnd() < 0.12;
    txns.push({ id: "t" + k, type: inc ? "income" : "expense", amount: inc ? int(1000, 30000) : rnd() < 0.8 ? int(5, 3000) : Math.round(rnd() * 500000) / 100, cat: inc ? "salary" : pick(Object.keys(CATS)), account: "c", date: iso(dd), note: "x" + k }); }
  const L = { currency: "EGP", accounts: [{ id: "c", name: "CIB", currency: "EGP", start: 1000 }], txns };
  const kind = pick(["today", "yesterday", "this week", "last week", "this month", "last month", "this year", "lastN", "month"]), n = int(2, 45), mo = int(0, 11);
  const cat = rnd() < 0.5 ? pick(Object.keys(CATS)) : null, earn = !cat && rnd() < 0.15;
  const per = kind === "lastN" ? `in the last ${n} days` : kind === "month" ? `in ${MONTHS[mo]}` : kind;
  const q = earn ? `how much did I earn ${per}?` : pick([`how much did I spend${cat ? " on " + cat : ""} ${per}?`, `what did I spend${cat ? " on " + cat : ""} ${per}?`, `total spent${cat ? " on " + cat : ""} ${per}`]);
  const [f, e] = spanTruth(kind, n, today, mo), F = iso(f), E = iso(e);
  const truth = Math.round(txns.filter((t) => t.date >= F && t.date <= E && t.type === (earn ? "income" : "expense") && (!cat || t.cat === cat)).reduce((a, t) => a + t.amount, 0) * 100) / 100;
  let a; try { a = M.answerMyMoney(q, L, { now: today.getTime(), short: true }); } catch (err) { a = { total: NaN, err: err.message }; }
  const got = a && typeof a.total === "number" ? Math.round(a.total * 100) / 100 : (a && /Nothing (spent|received)/.test(a.text || "") ? 0 : NaN);
  const spanOk = !a || !a.span || (a.span.from === F && a.span.to === E);
  add("D2 money questions", got === truth && spanOk, !spanOk ? "wrong span" : "wrong total", `«${q}» on ${iso(today)} → ${got} (${a && a.span ? a.span.from + "…" + a.span.to : ""}) truth ${truth} (${F}…${E})`);
}

// ---- D3 who owes me ------------------------------------------------------------------------------------------------------------
const PEOPLE = ["Ahmed", "Sara", "Omar", "Mona", "Karim", "Laila", "Youssef", "Nada", "Hany", "Dina"];
const N3 = 20000 * SCALE;
for (let i = 0; i < N3; i++) {
  const now = new Date(2026, int(0, 11), int(1, 28), 12).getTime(), items = [], left = {};
  for (let k = 0, K = int(1, 8); k < K; k++) { const who = pick(PEOPLE), dir = rnd() < 0.7 ? "in" : "out";
    if (rnd() < 0.55) { const count = int(2, 24), amount = int(1, 40) * 250, paid = [...new Set(Array.from({ length: int(0, count) }, () => int(0, count - 1)))];
      items.push({ id: "i" + k, kind: "installment", person: who, dir, amount, count, total: amount * count, every: "month", start: iso(new Date(now - int(0, 400) * DAY)), currency: "EGP", paid, title: "" });
      if (dir === "in") left[who] = (left[who] || 0) + amount * (count - paid.length); }
    else { const amount = int(1, 400) * 50, paid = rnd() < 0.25 ? [0] : [];
      items.push({ id: "i" + k, kind: "debt", person: who, dir, amount, count: 0, total: 0, every: null, start: "", currency: "EGP", paid, title: "" });
      if (dir === "in") left[who] = (left[who] || 0) + (paid.length ? 0 : amount); } }
  const total = Object.values(left).reduce((a, x) => a + x, 0), people = Object.values(left).filter((x) => x > 0).length;
  const one = rnd() < 0.4 ? pick(PEOPLE) : null;
  const q = one ? pick([`how much does ${one} owe me?`, `does ${one} owe me money?`]) : pick(["who owes me money?", "how much am I owed?", "who owes me?"]);
  let a; try { a = LA.askLife(q, { life: { items } }, { now }); } catch (err) { a = { en: "ERR " + err.message }; }
  const en = (a && a.en) || "", m = /([\d,]+(?:\.\d+)?) EGP/.exec(en), got = m ? +m[1].replace(/,/g, "") : /nothing|nobody|no one/i.test(en) ? 0 : NaN;
  const want = one ? left[one] || 0 : total;
  add("D3 who owes me", got === want, "wrong amount", `«${q}» → ${en.slice(0, 90)} (truth ${want}${one ? "" : ", " + people + " people"})`);
}

// ---- D4 what's due -------------------------------------------------------------------------------------------------------------
const N4 = 15000 * SCALE;
for (let i = 0; i < N4; i++) {
  const now = new Date(2026, int(0, 11), int(1, 28), int(8, 20), int(0, 59)).getTime(), today = iso(new Date(now));
  const word = pick(["this week", "this month", "soon"]), span = word === "this week" ? 7 : word === "this month" ? 31 : 30, until = iso(new Date(now + span * DAY));
  const radar = Array.from({ length: int(0, 8) }, (_, k) => ({ id: "r" + k, title: "Paper " + k, date: iso(new Date(now + int(-20, 60) * DAY)), status: rnd() < 0.2 ? "done" : "open" }));
  const reminders = Array.from({ length: int(0, 8) }, (_, k) => ({ id: "m" + k, title: "Call " + k, at: now + int(-5 * 24, 60 * 24) * 36e5 }));
  const truth = radar.filter((x) => x.status !== "done" && x.date <= until).length + reminders.filter((r) => r.at >= now && r.at <= now + span * DAY).length;
  const late = radar.filter((x) => x.status !== "done" && x.date < today).length;
  const q = pick([`what's due ${word}?`, `what do I have to pay ${word}?`, `what's coming up ${word}?`]);
  let a; try { a = LA.askLife(q, { radar: { items: radar }, life: { items: [] }, reminders }, { now }); } catch (err) { a = { en: "ERR " + err.message }; }
  const en = (a && a.en) || "", m = /^(\d+) things? in the next (\d+) days(?:, (\d+) already late)?/.exec(en), got = m ? +m[1] : /^Nothing is due/.test(en) ? 0 : NaN, gotLate = m && m[3] ? +m[3] : 0;
  add("D4 what's due", got === truth && gotLate === late && (!m || +m[2] === span), a && a.kind !== "due" ? "not read as 'what's due' (" + (a && a.kind) + ")" : "wrong count", `«${q}» → ${en.slice(0, 80)} (truth ${truth}, ${late} late, ${span} days)`);
}

// ---- D5 reminders' times -------------------------------------------------------------------------------------------------------
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], TASKS = ["call Sara", "pay the rent", "take my medicine", "send the report", "water the plants"];
const h12 = (h) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " am" : " pm");
const N5 = 25000 * SCALE;
for (let i = 0; i < N5; i++) {
  const nowD = new Date(2026, int(0, 11), int(1, 28), int(7, 21), int(0, 59)), now = nowD.getTime(), task = pick(TASKS), H = int(6, 22), Mi = pick([0, 0, 15, 30, 45]);
  const at = (d, h, m) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
  const tm = Mi ? (H % 12 === 0 ? 12 : H % 12) + ":" + pad(Mi) + (H < 12 ? " am" : " pm") : h12(H);
  let s, truth; const r = rnd();
  if (r < 0.12) { const n = int(2, 175); s = `remind me in ${n} minutes to ${task}`; truth = now + n * 6e4; }
  else if (r < 0.22) { const n = int(1, 12); s = `remind me in ${n} hour${n > 1 ? "s" : ""} to ${task}`; truth = now + n * 36e5; }
  else if (r < 0.36) { const d = new Date(nowD); d.setDate(d.getDate() + 1); s = pick([`remind me tomorrow at ${tm} to ${task}`, `remind me at ${tm} tomorrow to ${task}`]); truth = at(d, H, Mi); }
  else if (r < 0.48) { const w = int(0, 6), d = new Date(nowD); let diff = (w - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); s = `remind me on ${WD[w]} at ${tm} to ${task}`; truth = at(d, H, Mi); }
  else if (r < 0.6) { const n = int(2, 30), d = new Date(nowD); d.setDate(d.getDate() + n); const withT = rnd() < 0.5; s = `remind me in ${n} days${withT ? " at " + tm : ""} to ${task}`; truth = withT ? at(d, H, Mi) : at(d, 9, 0); }
  else if (r < 0.7) { const n = int(1, 6), d = new Date(nowD); d.setDate(d.getDate() + 7 * n); s = `remind me in ${n === 1 ? "a week" : n + " weeks"} to ${task}`; truth = at(d, 9, 0); }
  else if (r < 0.82) { const mo = int(0, 11), dd = int(1, 28); let y = nowD.getFullYear(); if (at(new Date(y, mo, dd), H, Mi) <= now) y++; s = `remind me on ${dd} ${MONTHS[mo]} at ${tm} to ${task}`; truth = at(new Date(y, mo, dd), H, Mi); }
  else if (r < 0.9) { const n = int(2, 10); s = `فكرني بعد ${n} ساعات ${pick(["اكلم سارة", "ادفع الايجار", "اخد الدوا"])}`; truth = now + n * 36e5; }
  else { const d = new Date(nowD); d.setDate(d.getDate() + 1); const hh = int(7, 11); s = `فكرني بكرة الساعة ${hh} الصبح ${pick(["اكلم سارة", "ادفع الايجار", "اخد الدوا"])}`; truth = at(d, hh, 0); }
  let q; try { q = A.quickAction(s, now); } catch (err) { q = { at: NaN, err: err.message }; }
  // a day and month whose time has already gone today may be next year's — or the app may say so and ask ("That time has already passed")
  const asked = q && (q.problems || []).some((p) => /already passed/i.test(p)) && /on \d+ [A-Z]/.test(s) && new Date(truth).getFullYear() > nowD.getFullYear();
  const ok = q && q.kind === "reminder" && (Math.abs(q.at - truth) < 6e4 || asked);
  add("D5 reminder times", ok, !q || q.kind !== "reminder" ? "not a reminder (" + (q && q.kind) + ")" : "wrong time", `«${s}» at ${nowD.toString().slice(0, 21)} → ${q && q.at ? new Date(q.at).toString().slice(0, 21) : "none"} (truth ${new Date(truth).toString().slice(0, 21)})`);
}

// ---- D6 holidays ---------------------------------------------------------------------------------------------------------------
function easterG(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
function easterO(y) { const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7, mo = Math.floor((d + e + 114) / 31), da = ((d + e + 114) % 31) + 1; const j = new Date(y, mo - 1, da); j.setDate(j.getDate() + (y >= 2100 ? 14 : 13)); return j; }   // Julian → Gregorian
const HF = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" });
const hij = (d) => { const p = HF.formatToParts(d), g = (t) => +((p.find((x) => x.type === t) || {}).value || 0); return [g("month"), g("day")]; };
const EAS_OFF = { "Good Friday": -2, "Easter Sunday": 0, "Easter Monday": 1, "Ascension Day": 39, "Whit Monday": 50, "Corpus Christi": 60 };
const ISL_DAY = { "Islamic New Year": [1, 1], "Ashura": null, "The Prophet's Birthday": [3, 12], "Isra and Mi'raj": [7, 27], "Arafat Day": [12, 9], "Eid al-Fitr": [10, 1], "Eid al-Adha": [12, 10] };
const codes = Object.keys(CO.COUNTRIES), N6 = 10000 * SCALE;
for (let i = 0; i < N6; i++) {
  const code = pick(codes), y = int(2000, 2099); let hs; try { hs = CO.holidays(code, y); } catch (err) { add("D6 holidays", false, "crash", code + " " + y + " " + err.message); continue; }
  const why = [];
  const sorted = hs.every((h, k) => k === 0 || hs[k - 1].date <= h.date), inYear = hs.every((h) => h.date.startsWith(String(y)));
  if (!sorted) why.push("not in order"); if (!inYear) why.push("a date outside " + y);
  for (const h of hs) { const d = new Date(+h.date.slice(0, 4), +h.date.slice(5, 7) - 1, +h.date.slice(8, 10));
    if (h.name in EAS_OFF && !/Orthodox|Coptic/i.test(h.name)) { const e = easterG(y); e.setDate(e.getDate() + EAS_OFF[h.name]); if (iso(e) !== h.date && !(code === "EG" || code === "ET")) why.push(h.name + " " + h.date + " ≠ " + iso(e)); }
    if (/Coptic|Orthodox/i.test(h.name) && /Easter/i.test(h.name) && !/Monday/i.test(h.name)) { const e = easterO(y); if (iso(e) !== h.date) why.push(h.name + " " + h.date + " ≠ " + iso(e)); }
    if (h.lunar && ISL_DAY[h.name]) { const [hm, hd] = hij(d), [wm, wd] = ISL_DAY[h.name], off = (h.day || 1) - 1; const first = new Date(d); first.setDate(d.getDate() - off); const [fm, fd] = hij(first);
      if (!(fm === wm && fd === wd) && !(h.name === "Eid al-Fitr" && fm === 9 && fd === 29)) why.push(h.name + " day " + (off + 1) + " " + h.date + " is Hijri " + fm + "/" + fd + " (want " + wm + "/" + wd + ")"); void hm; void hd; } }
  add("D6 holidays", !why.length, why[0] ? why[0].replace(/\d{4}-\d\d-\d\d/g, "D").replace(/\d+\/\d+/g, "m/d").slice(0, 70) : "", code + " " + y + ": " + why.slice(0, 2).join(" · "));
}

const parts = Object.entries(res), total = parts.reduce((a, [, r]) => a + r.n, 0), bad = parts.reduce((a, [, r]) => a + r.bad, 0);
let md = `# 1M part D — ${total} answers by code against the truth worked out separately: ${total - bad} right (${(100 * (total - bad) / total).toFixed(3)}%)\n\n| part | cases | wrong | right % |\n|---|---|---|---|\n`;
for (const [k, r] of parts) md += `| ${k} | ${r.n} | ${r.bad} | ${(100 * (r.n - r.bad) / r.n).toFixed(3)} |\n`;
md += "\n## What went wrong\n"; for (const [k, r] of parts) if (r.bad) { md += `\n### ${k}\n`; for (const [w, e] of Object.entries(r.ex)) md += `- **${w}**: ${e.map((x) => x.replace(/\|/g, "/")).join(" · ")}\n`; }
if (SCALE === 1) fs.writeFileSync(new URL("./D-answers" + (+process.env.SEED_SHIFT ? "-s" + process.env.SEED_SHIFT : "") + ".md", import.meta.url), md);
console.log(md.split("\n## What")[0]);
if (process.env.D_SHOW) console.log(md.split("\n## What")[1] || "");
