// v10.1 P1–P3 (Ali picked P1 P2 P3, 16 Nov 2026) — EXACTLY 10,000 projects, each with made-up chats, notes, tasks, a Money book and a
// People list, and the truth written HERE:
//   P1 dates   — every future day YOU wrote in its chats / notes / open tasks (+ its due date); never a past day, never a day only the
//                assistant suggested, never a day from ANOTHER project's chat, never a done task's day.
//   P2 money   — the payments that are this project's: tagged to it, or whose note names its distinctive word (with "the" / «ال» /
//                punctuation); never the word inside another word, an income, another project's payment, or one before it started.
//   P3 people  — the cards it names in your words; a name two cards share is "maybe", never sure; a name only the assistant said: no.
//     node tests/projlinks/gen.mjs [n]      HELDOUT=1 → other names, words and date forms written after the code (heldout.mjs)
import fs from "fs";
const P = await import("../../web-src/projlinks.js");
const E = await import("../../web-src/entities.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 8181 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 53 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const NOW = Date.parse("2026-11-16T12:00:00"), D = 864e5;
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FMT = H ? H.fmt : [(d) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`, (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`, (d) => iso(d.getTime())];
// [name, its word, a payment note that names it, an Arabic form]
const PROJ = H ? H.proj : [["Umrah · December", "umrah", ["hotel deposit for the Umrah", "Umrah visa fees", "umrah: flights"]], ["Flat Maadi", "maadi", ["tiles for Maadi", "maadi kitchen", "Maadi — paint"]],
  ["Shop sign Dokki", "dokki", ["sign printing dokki", "Dokki electrician"]], ["Thesis 2026", "thesis", ["printing the thesis", "thesis binding"]], ["عمرة ديسمبر", "عمره", ["حجز فندق العمرة", "تأشيرة العمره"]],
  ["Sara's wedding", "sara's", ["gift for Sara's wedding"]], ["Kitchen Zamalek", "zamalek", ["zamalek cabinets", "the Zamalek marble"]]];
const OTHER_NOTES = ["lunch", "fuel", "Talabat", "pharmacy", "Uber to work", "groceries Carrefour", "umrahsss tour ad", "dokkiano cafe", "maadiland", "thesisfirst books"];
const PEOPLE = H ? H.people : [["Hany", "contractor"], ["Noudy", ""], ["Omar", "electrician"], ["Mona", "designer"], ["Karim", "agent"]];
const TWIN = H ? H.twin : "Ahmed";
const bad = {}; let pass = 0, made = 0;
const note = (why, x) => { (bad[why] = bad[why] || []).push(x); };
while (made < N) {
  made++;
  const [pname, word, pnotes] = pick(PROJ), other = pick(PROJ.filter((x) => x[1] !== word));
  const p = { id: "p" + made, name: pname, created: NOW - int(1, 60) * D, budget: pick([0, int(5, 90) * 1000]), knowledge: [], tasks: [] };
  const q = { id: "q" + made, name: other[0] };
  // People: a directory with two Ahmeds
  let dir = E.emptyDir(); const ids = {};
  for (const [n, role] of PEOPLE) { const r = E.addCard(dir, { name: n, role }, NOW); dir = r.dir; ids[n] = r.id; }
  const t1 = E.addCard(dir, { name: TWIN, role: "plumber" }, NOW); dir = t1.dir; const t2 = E.addCard(dir, { name: TWIN, role: "work" }, NOW); dir = t2.dir;
  // ---- dates
  const want = new Set(), chats = [{ id: "c1", projectId: p.id, messages: [] }, { id: "c2", projectId: q.id, messages: [] }];
  for (let i = 0; i < int(1, 5); i++) {
    const fut = NOW + int(1, 200) * D, past = NOW - int(2, 200) * D, f = pick(FMT), where = pick(["user", "note", "task", "asst", "other", "past", "done"]);
    const s = (t) => pick(["The visit is on ", "Deadline ", "We meet on ", "Delivery "]) + f(new Date(t)) + ".";
    if (where === "user") { chats[0].messages.push({ role: "user", text: s(fut) }); want.add(iso(fut)); }
    else if (where === "note") { p.knowledge.push({ name: "n" + i, text: s(fut) }); want.add(iso(fut)); }
    else if (where === "task") { p.tasks.push({ text: "pay before " + f(new Date(fut)), col: "todo" }); want.add(iso(fut)); }
    else if (where === "asst") chats[0].messages.push({ role: "assistant", text: s(fut) });
    else if (where === "other") chats[1].messages.push({ role: "user", text: s(fut) });
    else if (where === "past") chats[0].messages.push({ role: "user", text: s(past) });
    else if (where === "done") p.tasks.push({ text: "pay before " + f(new Date(fut)), col: "done" });
  }
  if (rnd() < 0.3) { p.due = iso(NOW + int(3, 90) * D); want.add(p.due); }
  // ---- money
  const txns = [], mine = new Set(); let id = 0; const tx = (o) => { const x = { id: "t" + id++, type: "expense", amount: int(50, 9000), date: iso(NOW - int(0, 40) * D), note: "", ...o }; txns.push(x); return x; };
  for (let i = 0; i < int(2, 6); i++) mine.add(tx({ note: pick(pnotes), date: iso(Math.max(p.created, NOW - int(0, 25) * D)) }).id);
  if (rnd() < 0.4) mine.add(tx({ note: "deposit", project: p.id }).id);
  for (let i = 0; i < int(2, 8); i++) tx({ note: pick(OTHER_NOTES) });
  for (const n of other[2]) tx({ note: n });
  tx({ type: "income", note: pick(pnotes) }); tx({ type: "transfer", note: pick(pnotes) });
  tx({ note: pick(pnotes), date: iso(p.created - int(45, 120) * D) });
  tx({ note: pick(pnotes), project: q.id });
  // ---- people
  const sure = new Set(), maybe = new Set(), nosure = new Set();
  const [pn] = pick(PEOPLE), [pn2] = pick(PEOPLE);
  chats[0].messages.push({ role: "user", text: `${pn} will come on Sunday` }); sure.add(ids[pn]);
  if (rnd() < 0.5) { p.knowledge.push({ name: "x", text: `Call ${pn2} about the price` }); sure.add(ids[pn2]); }
  if (rnd() < 0.5) { chats[0].messages.push({ role: "user", text: `ask ${TWIN} about the pipes` }); maybe.add(t1.id); maybe.add(t2.id); }
  const [pa] = pick(PEOPLE); if (!sure.has(ids[pa])) { chats[0].messages.push({ role: "assistant", text: `You could also ask ${pa}.` }); nosure.add(ids[pa]); }
  const [pc] = pick(PEOPLE); if (!sure.has(ids[pc])) { chats[1].messages.push({ role: "user", text: `${pc} sent the plan` }); nosure.add(ids[pc]); }
  // ---- check
  const gotD = new Set(P.projectDates(p, chats, NOW).map((x) => x.date));
  const missD = [...want].filter((x) => !gotD.has(x)), extraD = [...gotD].filter((x) => !want.has(x));
  const m = P.projectMoney(p, txns), gotM = new Set(m.items.map((x) => x.id));
  const missM = [...mine].filter((x) => !gotM.has(x)), extraM = [...gotM].filter((x) => !mine.has(x));
  const pp = P.projectPeople(p, chats, dir), surePP = new Set(pp.filter((x) => !x.maybe).map((x) => x.id)), maybePP = new Set(pp.filter((x) => x.maybe).map((x) => x.id));
  const missP = [...sure].filter((x) => !surePP.has(x)), extraP = [...surePP].filter((x) => !sure.has(x)), twinSure = [...maybe].some((x) => surePP.has(x));
  let ok = true;
  if (missD.length) { ok = false; note("P1 missed a date", JSON.stringify({ missD, p, chats: chats[0].messages })); }
  if (extraD.length) { ok = false; note("P1 a date that isn't this project's", JSON.stringify({ extraD, chats })); }
  if (missM.length) { ok = false; note("P2 missed a payment · " + word, JSON.stringify(txns.filter((t) => missM.includes(t.id)))); }
  if (extraM.length) { ok = false; note("P2 counted a payment that isn't the project's · " + word, JSON.stringify(txns.filter((t) => extraM.includes(t.id)))); }
  if (Math.abs(m.spent - txns.filter((t) => mine.has(t.id)).reduce((a, t) => a + t.amount, 0)) > 0.01) { ok = false; note("P2 the total", ""); }
  if (missP.length) { ok = false; note("P3 missed a person", JSON.stringify(missP)); }
  if (extraP.length) { ok = false; note("P3 linked a person who isn't in it", JSON.stringify(extraP)); }
  if (twinSure) { ok = false; note("P3 a shared name taken as sure", ""); }
  if (ok) pass++;
}
const md = `# Projects connected (dates · money · people) — ${N} projects, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 25).map(([k, v]) => `- **${k}** × ${v.length} — e.g. ${String(v[0]).slice(0, 400)}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 5000));
