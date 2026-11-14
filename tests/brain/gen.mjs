// v9.9.37 BR-4 the Attune brain (Ali: "it already knows and understands everything" — and his rule "no mistakes"). EXACTLY 10,000
// different people's data with the truth worked out here, each checked:
//   money: this month's spent / in and the % against last month to the same day are EXACT; the top category is the real top one
//   people: the amount left is exact (life.js progressOf), "owes you" vs "you owe" never swapped, settled / zero / no-person → no fact
//   papers: only within 60 days, never past, never deleted · messages: only "do" / "reply", only the last 7 days, at most 6
//   agents: the best price is the real lowest, switched-off agents say nothing · bills: only the ones above usual
//   forget hides a fact · "Not right" keeps your words as a fact, first · "how am I doing?" is recognised, "how do I …?" is not
//   the Sunday card: Sunday, or Monday if Sunday was missed, once a week
//     node tests/brain/gen.mjs [count]
const F = await import("../../web-src/lifefacts.js");
const { progressOf } = await import("../../web-src/life.js");
const TOTAL = +(process.argv[2] || 10000);
let seed = 37 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 86400000, iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const CATS = ["food", "transport", "bills", "shopping", "health", "coffee", "groceries"];
const NAMES = ["Sheikh", "Ahmed", "Sara", "Mona", "Omar", "Karim", "سارة", "أحمد"];
const ASK_YES = ["how am I doing?", "How am I doing this month?", "how's my month", "what do you know about me?", "summarize my week", "catch me up", "anything I should know?", "أخباري إيه؟", "انا عامل ايه", "لخصلي الشهر", "تعرف ايه عني؟", "في حاجة لازم اعرفها؟"];
const ASK_NO = ["how do I make pasta?", "how much is the iPhone?", "what is the capital of Peru?", "remind me to call Sara", "lunch 150", "how are you?", "ازاي اعمل كيكة", "Sheikh owes me 500"];
let n = 0, bad = 0; const why = {}, seen = new Set();
const fail = (k, s) => { bad++; (why[k] = why[k] || []).push(s); };
while (n < TOTAL) {
  const now = Date.parse("2026-01-01T10:00:00") + int(0, 600) * DAY + int(0, 12) * 3600000, today = iso(now), d = new Date(now);
  const s = { ledger: { currency: "EGP", txns: [] }, life: { items: [] }, radar: { items: [] }, notes: [], minds: {}, agents: { agents: [] }, bills: [], noticed: [] };
  // money
  const m0 = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), dom = d.getDate();
  let spent = 0, inc = 0, last = 0; const byCat = {};
  for (let k = 0; k < int(0, 30); k++) { const day = int(1, dom), type = rnd() < 0.8 ? "expense" : "income", a = int(10, 5000), cat = pick(CATS);
    s.ledger.txns.push({ type, amount: a, cat, date: iso(new Date(d.getFullYear(), d.getMonth(), day, 12)) }); if (type === "expense") { spent += a; byCat[cat] = (byCat[cat] || 0) + a; } else inc += a; }
  const prevDays = new Date(d.getFullYear(), d.getMonth(), 0).getDate();
  for (let k = 0; k < int(0, 25); k++) { const day = int(1, prevDays), a = int(10, 5000); s.ledger.txns.push({ type: "expense", amount: a, cat: pick(CATS), date: iso(new Date(d.getFullYear(), d.getMonth() - 1, day, 12)) }); if (day <= Math.min(dom, prevDays)) last += a; }
  // people
  const people = [];
  for (let k = 0; k < int(0, 4); k++) { const dir = pick(["in", "out"]), count = pick([1, 1, 4, 8]), amount = int(100, 5000), person = pick(NAMES), kind = count > 1 ? "installment" : pick(["debt", "loan"]);
    const c = { id: "c" + k, kind, dir, person: rnd() < 0.1 ? "" : person, amount, count, total: amount * count, every: count > 1 ? "month" : null, start: count > 1 ? iso(now - int(0, 6) * 30 * DAY) : "", paid: [] , done: rnd() < 0.08 };
    s.life.items.push(c); people.push(c); }
  // papers
  const papers = []; for (let k = 0; k < int(0, 5); k++) { const off = int(-20, 120), st = rnd() < 0.1 ? "deleted" : "active"; const p = { id: "p" + k, title: "Paper " + k, date: iso(now + off * DAY), status: st }; s.radar.items.push(p); papers.push([p, off]); }
  // messages
  const msgs = []; for (let k = 0; k < int(0, 10); k++) { const id = "n" + k, ts = now - int(0, 12) * DAY - int(0, 20) * 3600000, act = pick(["do", "reply", "none", "pay", "attend"]);
    s.notes.push({ id, ts, title: pick(NAMES), app: "WhatsApp", text: "msg " + k }); s.minds[id] = { action: act, who: "" }; msgs.push([id, ts, act]); }
  // agents
  const agents = []; for (let k = 0; k < int(0, 3); k++) { const on = rnd() < 0.85, prices = [int(500, 9000), int(500, 9000), rnd() < 0.2 ? 0 : int(500, 9000)];
    const a = { id: "a" + k, on, what: "Item " + k, below: rnd() < 0.5 ? 8000 : 0, best3: prices.map((p, i) => ({ price: p, site: "S" + i })) }; s.agents.agents.push(a); agents.push(a); }
  // bills
  for (let k = 0; k < int(0, 3); k++) s.bills.push({ label: "Bill " + k, status: pick(["high", "ok", "coming"]), pct: int(5, 80), thisMonth: int(100, 900), usual: int(100, 900) });
  const key = JSON.stringify(s).length + ":" + now + ":" + n; if (seen.has(key)) continue; seen.add(key); n++;
  const mem = rnd() < 0.3 ? { forgot: {} } : {};
  const all = F.facts(s, mem, { now, progress: progressOf }), by = (a) => all.filter((f) => f.area === a);
  // money
  const mf = all.find((f) => f.id.startsWith("money:month"));
  if ((spent || inc) && !mf) fail("no month fact", ""); if (!(spent || inc) && mf) fail("a month fact with no money", "");
  if (mf) { if (mf.nums.spent !== spent || mf.nums.inc !== inc) fail("month numbers wrong", mf.nums.spent + " ≠ " + spent);
    const pct = last > 0 ? Math.round(((spent - last) / last) * 100) : null; if (mf.nums.pct !== pct) fail("month % wrong", mf.nums.pct + " ≠ " + pct + " (last " + last + ")");
    if (pct != null && /more/.test(mf.T[0]) !== (pct >= 0)) fail("more / less swapped", ""); }
  const tf = all.find((f) => f.id.startsWith("money:top"));
  if (spent && tf) { const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]; if (tf.nums.amount !== top[1]) fail("top category wrong", tf.nums.cat + " " + tf.nums.amount + " ≠ " + top[0] + " " + top[1]); }
  // people
  for (const c of people) { const f = all.find((x) => x.id === "people:" + c.id), p = progressOf(c, now), left = p.left != null ? p.left : c.total;
    const should = !c.done && !!c.person && left > 0;
    if (should !== !!f) fail("people fact " + (should ? "missing" : "shown for settled / no person"), JSON.stringify({ person: c.person, done: c.done, left }));
    if (f) { if (Math.abs(f.nums.left - left) > 0.01) fail("amount left wrong", f.nums.left + " ≠ " + left);
      if (c.dir === "in" ? !/owes you/.test(f.T[0]) : !/You still owe/.test(f.T[0])) fail("owes you / you owe swapped", c.dir + " " + f.T[0]); } }
  // papers
  for (const [p, off] of papers) { const f = all.find((x) => x.id.startsWith("paper:" + p.id + ":")); const should = p.status !== "deleted" && off >= 0 && off <= 60;
    if (should !== !!f) fail("paper fact " + (should ? "missing" : "shown (past / far / deleted)"), off + " " + p.status);
    if (f && f.nums.days !== off) fail("paper days wrong", f.nums.days + " ≠ " + off); }
  // messages
  const mFacts = by("messages"), mWant = msgs.filter(([, ts, act]) => now - ts <= 7 * DAY && (act === "do" || act === "reply"));
  if (mFacts.length !== Math.min(6, mWant.length)) fail("messages count", mFacts.length + " ≠ " + Math.min(6, mWant.length));
  if (mFacts.some((f) => !mWant.some(([id]) => f.id === "msg:" + id))) fail("a message fact that isn't do / reply in 7 days", "");
  // agents
  for (const a of agents) { const f = all.find((x) => x.id === "agent:" + a.id); if (!a.on) { if (f) fail("an agent that is off said something", ""); continue; }
    const best = Math.min(...a.best3.filter((o) => o.price > 0).map((o) => o.price)); if (!f || f.nums.price !== best) fail("agent best wrong", (f && f.nums.price) + " ≠ " + best); }
  // bills
  if (by("bills").length !== s.bills.filter((b) => b.status === "high").length) fail("bill facts", "");
  // forget / correct
  if (all.length) { const x = pick(all); const m2 = F.forget({}, x.id, now); if (F.facts(s, m2, { now, progress: progressOf }).some((f) => f.id === x.id)) fail("forget did not hide", x.id);
    const m3 = F.correct({}, x.id, "It's 900, not " + x.id, now), a3 = F.facts(s, m3, { now, progress: progressOf });
    if (a3.some((f) => f.id === x.id) || !a3[0] || !a3[0].mine || !/^It's 900/.test(a3[0].T[1].x)) fail("Not right did not keep the words first", ""); }
  // never a NaN or "undefined" in a fact
  if (all.some((f) => /NaN|undefined/.test(JSON.stringify(f.T || f.text)))) fail("NaN / undefined in a fact", "");
  // the question and the Sunday card
  if (!F.BRAIN_ASK.test(pick(ASK_YES))) fail("missed “how am I doing?”", ""); const no = pick(ASK_NO); if (F.BRAIN_ASK.test(no)) fail("took a normal question", no);
  const wd = d.getDay(), seenW = rnd() < 0.4 ? F.weekKey(now) : "";
  if (F.weeklyDue(now, seenW) !== ((wd === 0 || wd === 1) && !seenW)) fail("Sunday card timing", wd + " " + seenW);
}
console.log(`# The Attune brain v9.9.37 — ${n} people, ${n - bad} right (${(100 * (n - bad) / n).toFixed(2)}%)`);
for (const [k, v] of Object.entries(why)) console.log(`- ${k.slice(0, 140)} × ${v.length}: ${v.slice(0, 3).join(" · ")}`);
