// v9.9.24 B6 X4 the emergency card: exactly 10,000 family records. Each person has a blood type written the way people write it
// (O+, "o pos", "A negative", «أو موجب», «AB سالب», "groupe sanguin O négatif", "A Rh positivo", "O型 Rh阳性", "AB형 Rh음성", "0+", …) or
// something unclear ("not sure", "A", "O+/-"), medicines in Family health that are current / stopped / a finished course / not started
// yet / another family member's, allergies (or ticked 'none', or not filled in — then the card must NOT say 'no known allergies'), doctor, insurance, people to call — and the card is shared in one of 20
// languages. Checked: the blood type is exactly right or marked "check" (never guessed); the medicines are exactly today's own;
// what is missing is listed; the shared text has every value under the reader's own words, the insurance number masked (never whole).
const E = await import(process.env.X4 || "../../web-src/emergency.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const NOW = Date.parse("2026-11-12T12:00:00"), DAY = 864e5, iso = (t) => new Date(t).toISOString().slice(0, 10);
const G = ["A", "B", "AB", "O"];
const WRITE = [   // (group, +/-) → how it is written
  (g, p) => g + (p ? "+" : "-"), (g, p) => g.toLowerCase() + (p ? "+" : "-"), (g, p) => g + " " + (p ? "pos" : "neg"), (g, p) => g + " " + (p ? "positive" : "negative"),
  (g, p) => g + " Rh" + (p ? "+" : "-"), (g, p) => "Blood type: " + g + (p ? "+" : "-"), (g, p) => (g === "O" ? "0" : g) + (p ? "+" : "-"),
  (g, p) => ({ A: "ايه", B: "بي", AB: "اي بي", O: "أو" })[g] + " " + (p ? "موجب" : "سالب"), (g, p) => "فصيلة الدم " + g + (p ? "+" : "-"), (g, p) => g + " " + (p ? "موجب" : "سالب"),
  (g, p) => "groupe sanguin " + g + " " + (p ? "positif" : "négatif"), (g, p) => g + " Rh " + (p ? "positivo" : "negativo"), (g, p) => g + " " + (p ? "positiv" : "negativ"),
  (g, p) => g + "型 Rh" + (p ? "阳性" : "阴性"), (g, p) => g + "형 Rh" + (p ? "양성" : "음성"), (g, p) => g + " " + (p ? "pozitif" : "negatif"), (g, p) => "گروه خونی " + g + " " + (p ? "مثبت" : "منفی"),
  (g, p) => g + " (" + (p ? "+" : "-") + ")", (g, p) => "  " + g + " rh" + (p ? "+" : "-") + " ", (g, p) => (p ? "positive " : "negative ") + g];
const UNCLEAR = ["not sure", "A", "O+/-", "مش عارف", "?", "AB", "B pos neg", "type 1"];
const LANGS = Object.keys(E.LABELS);
const MEDS = ["Concor", "Glucophage", "Lipitor", "Augmentin", "Panadol", "Nexium", "Eltroxin", "Aspocid"];
export function make(i) {
  const r = rng(i * 40503 + 11), pick = (a) => a[Math.floor(r() * a.length)];
  const me = { id: "p" + i, name: pick(["Baba", "Mama", "Nada", "Ali", "Teta", "Omar", "منى", "يوسف"]) }, other = { id: "q" + i, name: "Other" };
  let want = null, blood = "";
  const bk = r(); if (bk < 0.75) { const g = pick(G), p = r() < 0.7; want = g + (p ? "+" : "-"); blood = pick(WRITE)(g, p); } else if (bk < 0.9) blood = pick(UNCLEAR);
  const meds = [], wantMeds = [];
  for (let k = 0; k < 1 + Math.floor(r() * 5); k++) {
    const kind = pick(["now", "now", "stopped", "finished", "later", "other", "course"]), name = pick(MEDS) + " " + k;
    const m = { id: "m" + i + "_" + k, member: kind === "other" ? other.id : me.id, name, strength: (5 * (1 + Math.floor(r() * 10))) + " mg", dose: "1", times: r() < 0.5 ? ["08:00"] : [], days: 0, start: iso(NOW - 30 * DAY) };
    if (kind === "stopped") m.stopped = true;
    if (kind === "finished") { m.days = 7; m.start = iso(NOW - 20 * DAY); }
    if (kind === "later") m.start = iso(NOW + 3 * DAY);
    if (kind === "course") { m.days = 10; m.start = iso(NOW - 3 * DAY); }
    meds.push(m); if (kind === "now" || kind === "course") wantMeds.push(name);
  }
  const allergies = r() < 0.5 ? [pick(["Penicillin", "بنسلين", "Peanuts", "Aspirin"])] : [];
  const doctor = r() < 0.6 ? { name: "Dr " + pick(["Hany", "Sara", "Karim"]), phone: "010" + Math.floor(10000000 + r() * 89999999) } : null;
  const insurance = r() < 0.5 ? { company: pick(["Misr", "AXA", "Allianz"]), number: String(Math.floor(1e9 + r() * 8e9)) } : null;
  const call = r() < 0.7 ? [{ name: pick(["Ahmed", "Mona"]), phone: "011" + Math.floor(10000000 + r() * 89999999), rel: pick(["brother", "wife", ""]) }] : [];
  const noAllergies = !allergies.length && r() < 0.5;
  me.emergency = { blood, allergies, noAllergies, doctor, insurance, call };
  return { me, care: { members: [me, other], meds }, want, blood, wantMeds, lang: pick(LANGS), allergies, noAllergies, doctor, insurance, call };
}
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i), card = E.cardOf(c.me, c.care, NOW), why = [];
    if (c.want) { if (!(card.bloodSure && card.blood === c.want)) why.push("blood " + JSON.stringify(c.blood) + " → " + card.blood + (card.bloodSure ? "" : " (check)")); }
    else if (card.bloodSure) why.push("unclear blood " + JSON.stringify(c.blood) + " guessed as " + card.blood);
    const got = card.meds.map((l) => l.split(" ").slice(0, 2).join(" ")).sort(), exp = [...c.wantMeds].sort();
    if (JSON.stringify(got) !== JSON.stringify(exp)) why.push("meds " + JSON.stringify(got) + " ≠ " + JSON.stringify(exp));
    const miss = [!c.blood.trim() && "blood", !c.call.length && "call", !c.doctor && "doctor", !c.allergies.length && !c.noAllergies && "allergies"].filter(Boolean);
    if (JSON.stringify(card.missing) !== JSON.stringify(miss)) why.push("missing " + card.missing + " ≠ " + miss);
    const L = E.LABELS[c.lang], t = E.shareText(card, c.lang);
    if (!t.includes(L[0]) || !t.includes(c.me.name)) why.push("title");
    if (c.blood.trim() && !t.includes(L[1] + ": " + card.blood)) why.push("blood line");
    for (const m of card.meds) if (!t.includes(m)) why.push("med line");
    if (c.allergies.length ? !t.includes(L[3] + ": " + c.allergies[0]) : c.noAllergies ? !t.includes(L[4]) : t.includes(L[4])) why.push("allergy line (never 'no known allergies' unless ticked)");
    if (c.doctor && !t.includes(c.doctor.phone)) why.push("doctor phone");
    if (c.insurance && (t.includes(c.insurance.number) || !t.includes(c.insurance.number.slice(-2)))) why.push("insurance not masked");
    if (c.call.length && !t.includes(c.call[0].phone)) why.push("call phone");
    if (why.length) { if (bad.length < 6) bad.push({ i, lang: c.lang, why }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
