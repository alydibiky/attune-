/* ---- v9.9.37 BR-4 the Attune brain (Ali picked BR-4: "an agent keeps working 24/7 to understand everything in the app, notifications,
   money, other things, and makes analysis, and when I ask anything it already knows and understands everything"). Code works out what
   it knows from ALL the stores — every time Attune opens and every minute while it is open, and the notifications the model read with
   Attune closed (BG-3) come in on the next open — as short FACTS, each with its numbers and where it came from:
     money     this month spent / in, against last month at the same day; where most of it went
     people    who still owes you (paid n of m, last on …), whom you still owe
     papers    papers ending within 60 days
     messages  people waiting for you (a notification the model / code read as "do" or "reply", the last 7 days)
     agents    each agent's best price and where
     bills     a bill above its usual
     noticed   the best findings of "Attune noticed" (insights.js: rhythms, late, surges, rises, charged twice)
   Nothing here is invented: every number comes from the data. A fact can be forgotten, or corrected ("Not right" → your words are
   kept as a fact of their own, with you as the source). Pure. Tests: tests/brain/gen.mjs (10,000) + tests/unit/v9937brain.test.mjs. */

const DAY = 86400000;
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const num = (v) => Number(v) || 0;
export const n0 = (v) => Math.round(num(v)).toLocaleString("en-US");
const days = (a, b) => Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / DAY);

/** Money: this month so far vs last month to the same day, and the top category. */
function moneyFacts(L, now) {
  const out = [], txns = ((L && L.txns) || []).filter((t) => t && (t.type === "expense" || t.type === "income") && num(t.amount) > 0 && t.date), cur = (L && L.currency) || "";
  if (!txns.length) return out;
  const d = new Date(now), m0 = iso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), today = iso(now), dom = d.getDate();
  const p0 = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1, 12)), pEnd = iso(new Date(d.getFullYear(), d.getMonth() - 1, Math.min(dom, new Date(d.getFullYear(), d.getMonth(), 0).getDate()), 12));
  const sum = (list, type) => list.filter((t) => t.type === type).reduce((a, t) => a + num(t.amount), 0);
  const now0 = txns.filter((t) => t.date >= m0 && t.date <= today), last0 = txns.filter((t) => t.date >= p0 && t.date <= pEnd);
  const spent = sum(now0, "expense"), inc = sum(now0, "income"), lastSpent = sum(last0, "expense");
  if (spent || inc) {
    const pct = lastSpent > 0 ? Math.round(((spent - lastSpent) / lastSpent) * 100) : null;
    out.push({ id: "money:month:" + m0.slice(0, 7), area: "money", src: "Money", open: "money", weight: 80,
      T: pct == null ? ["This month: {s} spent, {i} in.", { s: n0(spent) + " " + cur, i: n0(inc) + " " + cur }]
        : [pct >= 0 ? "This month: {s} spent, {i} in — {p}% more than last month by this day." : "This month: {s} spent, {i} in — {p}% less than last month by this day.", { s: n0(spent) + " " + cur, i: n0(inc) + " " + cur, p: Math.abs(pct) }],
      nums: { spent, inc, lastSpent, pct } });
    const by = {}; for (const t of now0.filter((x) => x.type === "expense")) { const k = t.cat || "other"; by[k] = by[k] || { a: 0, n: 0 }; by[k].a += num(t.amount); by[k].n++; }
    const top = Object.entries(by).sort((a, b) => b[1].a - a[1].a)[0];
    if (top && spent > 0) out.push({ id: "money:top:" + m0.slice(0, 7) + ":" + top[0], area: "money", src: "Money", open: "money", weight: 60,
      T: ["Most of it went on {c}: {a} ({n} times, {p}% of what you spent).", { c: top[0], a: n0(top[1].a) + " " + cur, n: top[1].n, p: Math.round((top[1].a / spent) * 100) }], nums: { cat: top[0], amount: top[1].a, count: top[1].n } });
  }
  return out;
}
/** People & plans: who owes you, whom you owe (open amounts only). progress(c) = life.js progressOf. */
function peopleFacts(life, now, progress) {
  const out = [];
  for (const c of ((life && life.items) || [])) {
    if (!c || c.done || c.ended || !c.person || !/^(debt|installment|loan|circle)$/.test(c.kind)) continue;
    const p = progress ? progress(c, now) : { paidCount: 0, paidAmount: 0, left: num(c.total || c.amount) };
    const left = p.left != null ? p.left : num(c.total || c.amount) - num(p.paidAmount); if (!(left > 0)) continue;
    const last = (p.schedule || []).filter((x) => x.paid).map((x) => x.date).sort().pop() || "";
    const count = c.count > 1 ? c.count : 0;
    out.push({ id: "people:" + (c.id || c.person) , area: "people", src: "People & plans", open: "life", weight: c.dir === "in" ? 70 : 65, person: c.person,
      T: c.dir === "in" ? (count ? (last ? ["{p} still owes you {l} — {k} of {n} paid, the last on {d}.", { p: c.person, l: n0(left), k: p.paidCount, n: count, d: last }] : ["{p} still owes you {l} — {k} of {n} paid.", { p: c.person, l: n0(left), k: p.paidCount, n: count }]) : ["{p} still owes you {l}.", { p: c.person, l: n0(left) }])
        : ["You still owe {p} {l}.", { p: c.person, l: n0(left) }], nums: { left, dir: c.dir } });
  }
  return out;
}
function paperFacts(radar, now) {
  const out = [], today = iso(now);
  for (const x of ((radar && radar.items) || [])) {
    if (!x || !x.date || x.status === "deleted" || x.status === "done") continue;
    const d = String(x.date).slice(0, 10), n = days(today, d); if (n < 0 || n > 60) continue;
    out.push({ id: "paper:" + (x.id || x.title) + ":" + d, area: "papers", src: "Dates", open: "radar", weight: 90 - n, T: ["{t} ends on {d} — in {n} days.", { t: x.title || x.kind || "", d, n }], nums: { days: n } });
  }
  return out;
}
/** Notifications people are waiting on: the reading says "do" or "reply", from the last 7 days. minds = notifmind readings by id. */
function messageFacts(notes, minds, now) {
  const out = [];
  for (const n of (notes || [])) {
    if (!n || !n.id || now - num(n.ts) > 7 * DAY) continue;
    const m = (minds || {})[String(n.id)]; if (!m || !/^(do|reply)$/.test(m.action || "")) continue;
    const who = m.who || n.title || n.app || "";
    out.push({ id: "msg:" + n.id, area: "messages", src: n.app || "Notifications", open: "recall", weight: 75, person: who,
      T: m.action === "do" ? ["{w} asked you: “{x}”{d}", { w: who, x: String(n.text || "").replace(/\s+/g, " ").slice(0, 90), d: m.due && m.due.date ? " — " + m.due.date : "" }]
        : ["{w} is waiting for your answer: “{x}”", { w: who, x: String(n.text || "").replace(/\s+/g, " ").slice(0, 90) }], nums: {} });
  }
  return out.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 6);
}
function agentFacts(agents) {
  const out = [];
  for (const a of ((agents && agents.agents) || [])) {
    if (!a || a.on === false) continue;
    const best = (a.best3 || []).filter((o) => o && num(o.price) > 0).sort((x, y) => x.price - y.price)[0];
    if (!best) continue;
    out.push({ id: "agent:" + a.id, area: "agents", src: "Agents", open: "agents", weight: 50,
      T: a.below > 0 ? ["{w}: the best is {p} at {s} (your limit {l}).", { w: a.what || a.title || "", p: n0(best.price), s: best.site || "", l: n0(a.below) }] : ["{w}: the best is {p} at {s}.", { w: a.what || a.title || "", p: n0(best.price), s: best.site || "" }],
      nums: { price: best.price } });
  }
  return out;
}
/** bills = bills.js billsOf(ledger) */
function billFacts(bills) {
  return (bills || []).filter((b) => b && b.status === "high").map((b) => ({ id: "bill:" + b.label, area: "bills", src: "Money", open: "money", weight: 72,
    T: ["{b} is {p}% above usual ({a} vs {u}).", { b: b.label, p: b.pct, a: n0(b.thisMonth), u: n0(b.usual) }], nums: { pct: b.pct } }));
}

export const BRAIN_KEY = "attune:brain:v1";
/** Everything Attune knows now, best first, without what the person forgot; their own corrections first of all.
 *  s = { ledger, life, radar, notes, minds, agents, bills, noticed: insights() output, lang } ; mem = { forgot: {id: at}, mine: [{id, text, at}] } */
export function facts(s = {}, mem = {}, { now = Date.now(), progress = null } = {}) {
  const all = [
    ...((mem.mine || []).map((x) => ({ id: x.id, area: "mine", src: "You", open: "brain", weight: 100, T: ["You said: {x}", { x: x.text }], mine: true, at: x.at }))),
    ...moneyFacts(s.ledger, now), ...peopleFacts(s.life, now, progress), ...paperFacts(s.radar, now), ...messageFacts(s.notes, s.minds, now),
    ...agentFacts(s.agents), ...billFacts(s.bills),
    ...((s.noticed || []).slice(0, 4).map((x) => ({ id: "noticed:" + x.id, area: "noticed", src: "Attune noticed", open: x.open || "home", weight: Math.min(95, x.score || 50), text: s.lang === "ar" ? x.ar : x.en }))),
  ];
  const forgot = mem.forgot || {};
  return all.filter((f) => !forgot[f.id]).sort((a, b) => b.weight - a.weight);
}
/** The other facts about the same person as `f` (for "Not right"). */
export const sameSubject = (f, list = [], text = (x) => x.text || "") => !f || !f.person ? [] : list.filter((x) => x.id !== f.id && (x.person === f.person || String(text(x)).includes(f.person))).map((x) => x.id);
/** Forget one fact (it comes back only if its numbers change into a new fact). */
export const forget = (mem = {}, id, now = Date.now()) => ({ ...mem, forgot: { ...(mem.forgot || {}), [id]: now } });
/** "Not right": the fact is forgotten and the person's own words are kept as a fact, with them as the source. */
export function correct(mem = {}, id, text, now = Date.now(), related = []) {
  // (v9.9.37: a correction about Sheikh also hides the other facts about Sheikh — "Attune noticed: Sheikh has owed you 19,500…")
  const t = String(text || "").trim().slice(0, 300); let m = forget(mem, id, now); for (const r of related || []) m = forget(m, r, now);
  return t ? { ...m, mine: [...(m.mine || []), { id: "mine:" + now.toString(36), text: t, at: now }] } : m;
}

/** "How am I doing?" / «أخباري إيه؟» / "what do you know about me?" → the brain answers by code, at once. */
export const BRAIN_ASK = /^\s*(?:so\s+)?(?:how am i doing|how'?s my (?:month|life|money)|what do you know about me|what(?:'s| is) going on(?: with me)?|summari[sz]e my (?:life|month|week)|give me (?:a|my) summary|my summary|catch me up|anything i should know)\b|^\s*(?:أخباري|اخباري|أنا عامل إيه|انا عامل ايه|إيه الأخبار|ايه الاخبار|إيه أخباري|ايه اخباري|تعرف إيه عني|تعرف ايه عني|لخصلي (?:حياتي|الشهر|الاسبوع|الأسبوع)|فيه حاجة لازم أعرفها|في حاجة لازم اعرفها)/i;

/* ---- the Sunday analysis (Pro) — the week in a few lines ------------------------------------------------------------------------ */
export function weekly(s = {}, { now = Date.now() } = {}) {
  const txns = ((s.ledger && s.ledger.txns) || []).filter((t) => t && t.type === "expense" && num(t.amount) > 0 && t.date), cur = (s.ledger && s.ledger.currency) || "";
  const w0 = iso(now - 6 * DAY), w1 = iso(now - 13 * DAY), today = iso(now);
  const thisW = txns.filter((t) => t.date >= w0 && t.date <= today).reduce((a, t) => a + num(t.amount), 0);
  const lastW = txns.filter((t) => t.date >= w1 && t.date < w0).reduce((a, t) => a + num(t.amount), 0);
  const waiting = messageFacts(s.notes, s.minds, now).length;
  const papers = paperFacts(s.radar, now).filter((f) => f.nums.days <= 30).length;
  return { spent: thisW, last: lastW, pct: lastW > 0 ? Math.round(((thisW - lastW) / lastW) * 100) : null, cur, waiting, papers };
}
/** Show the Sunday card today? (Sunday, or Monday when Sunday was missed; once a week) */
export const weekKey = (now = Date.now()) => iso(now - (new Date(now).getDay() === 1 ? DAY : 0));   // the Sunday it belongs to
export function weeklyDue(now = Date.now(), seenWeek = "") {
  const d = new Date(now);
  return (d.getDay() === 0 || d.getDay() === 1) && seenWeek !== weekKey(now);
}
