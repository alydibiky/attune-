// v10.5 the interactive widgets (Ali OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S). EXACTLY 10,000 situations, COMPOSED from
// parts in random order: a day (reminders on time / late / tomorrow / done, bills due today / tomorrow / paid / paid by someone else,
// to-dos), lists of every size with ticked items, medicines with doses taken / late / later, agents with price histories and links,
// papers, a trip, birthdays, a bank SMS waiting, the hour of the day; then the TAPS made on the home screen in random order — Done,
// +1h, Paid, tick / untick / clear, Taken, Pause, Remind, Add ✓ — some sent TWICE (a tap kept by the phone and the page both); and the
// words typed in the small box ("cheese, pickles and bread", «٢٠٠ كشري»), made HARD by tests/lib/hard.mjs (human: they are typed).
// Each case says what every card must show and what every tap must change; checked against widgets2.js.
//     node tests/widgets/gen.mjs [count]           SEED_SHIFT=n → another set (held-out: heldout.mjs)
import * as W from "../../web-src/widgets2.js";
import { harden, shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";

const HARD = process.env.HARD !== "0";
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261119 + 7907 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1)), chance = (p) => rnd() < p;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const pad = (n) => String(n).padStart(2, "0"), isoDay = (t) => { const d = new Date(t); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const TITLES = ["The maid comes", "Call the bank", "Gym", "Pick up Mama", "Pay the internet", "Meeting with Karim", "Pharmacy", "اتصل بالبنك", "ميعاد الدكتور", "Renew the car licence", "Send the report", "Water the plants", "Buy bread", "Zoom with the team"];
  const ITEMS = ["Salsa", "Foul", "Lettuce", "Cucumber", "Tomatoes", "Bread", "Eggs", "Milk", "Cheese", "Tahina", "Pickles", "Rice", "Water", "جبنة", "عيش", "طماطم", "لبن", "Passport", "Charger", "Sunscreen"];
  const MEDS = ["Vitamin D", "Panadol", "Concor 5", "Glucophage", "Omega 3", "Augmentin"];
  const WHO = ["Mama", "Sara", "Karim", "Ahmed", "Nada", "Baba", "Omar"];
  const out = [], shapes = []; let right = 0; const wrong = [];
  for (let i = 0; i < total; i++) {
    const day0 = Date.parse("2026-11-" + pad(int(2, 27)) + "T00:00:00") + shift * 3 * 864e5, hour = int(0, 23), now = day0 + hour * 36e5 + int(0, 59) * 6e4;
    const today = isoDay(now), end = day0 + 864e5 - 1, errs = [], parts = [];
    // ---------- your day
    const reminders = [], want = [];
    for (let k = int(0, 7); k > 0; k--) {
      const kind = pick(["future", "late", "old", "tomorrow", "done", "deleted"]), id = "r" + i + "-" + k, title = pick(TITLES) + (chance(0.3) ? " " + int(2, 99) : "");
      const at = kind === "future" ? now + int(1, Math.max(1, Math.floor((end - now) / 6e4))) * 6e4 : kind === "late" ? now - int(1, 11 * 60) * 6e4 : kind === "old" ? now - int(13, 40) * 36e5 : kind === "tomorrow" ? end + int(1, 20) * 36e5 : now + int(-300, 300) * 6e4;
      reminders.push({ id, title, at, ...(kind === "done" ? { done: true } : {}), ...(kind === "deleted" ? { deleted: true } : {}) });
      if ((kind === "future" && at <= end) || kind === "late") want.push({ id: "rem:" + id, at }); parts.push("rem-" + kind);
    }
    const life = { items: [] };
    for (let k = int(0, 3); k > 0; k--) {
      const kind = pick(["today", "tomorrow", "paid", "other", "in"]), cid = "c" + i + "-" + k, amt = int(50, 3000);
      const start = kind === "tomorrow" ? isoDay(now + 864e5) : today;
      life.items.push({ id: cid, kind: "bill", dir: kind === "in" ? "in" : "out", amount: amt, count: 1, total: amt, every: null, start, title: pick(["Electricity", "Internet", "Gas", "Rent", "Club"]), person: "", paid: kind === "paid" ? [0] : [], currency: "", ...(kind === "other" ? { payer: "dad" } : {}) });
      if (kind === "today") want.push({ id: "bill:" + cid + ":0", at: end - 1 }); parts.push("bill-" + kind);
    }
    const todos = []; for (let k = int(0, 3); k > 0; k--) { const id = "t" + i + "-" + k, done = chance(0.25); todos.push({ id, title: pick(TITLES), meta: { todo: true, done } }); if (!done) want.push({ id: "todo:" + id, at: end }); parts.push("todo" + (done ? "-done" : "")); }
    shuffle(reminders);
    const dayC = W.dayCard({ reminders, todos, life, now });
    const expIds = want.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 3).map((x) => x.id);
    if (dayC.rows.map((r) => r.id).join() !== expIds.join()) errs.push("day rows " + dayC.rows.map((r) => r.id).join() + " ≠ " + expIds.join());
    if (dayC.rows.some((r) => !r.btns.length || (r.id.startsWith("bill:") && r.btns[0][0] !== "paid") || (r.id.startsWith("rem:") && !r.btns.some((b) => b[0] === "snooze")))) errs.push("day buttons");
    if (!want.length && dayC.side) errs.push("day side when empty");
    // ---------- lists
    const lists = { lists: [] };
    for (let k = int(0, 3); k > 0; k--) {
      const n = int(0, 16), items = Array.from({ length: n }, (_, j) => ({ id: "i" + j, text: pick(ITEMS) + (chance(0.2) ? " ×" + int(2, 6) : ""), done: chance(0.4) }));
      lists.lists.push({ id: "l" + k, name: pick(["Talabat", "Travel", "Pharmacy", "Carrefour", "طلبات"]), emoji: pick(["🛒", "", "✈"]), items, repeat: { every: "once" }, created: now - 864e5 });
    }
    const LD = W.listsData(lists, { now });
    for (const l of LD) { const src = lists.lists.find((x) => x.id === l.id), left = src.items.filter((x) => !x.done).length;
      if (l.left !== left || l.items.length !== Math.min(60, src.items.length)) errs.push("list counts " + l.id);
      const firstDone = l.items.findIndex((x) => x.done); if (firstDone >= 0 && l.items.slice(firstDone).some((x) => !x.done)) errs.push("list order " + l.id); }
    parts.push("lists" + lists.lists.length);
    // ---------- medicine
    const care = { members: [{ id: "p1", name: "Mama" }], meds: [], taken: {} }; let expMed = null; const nowHm = pad(new Date(now).getHours()) + ":" + pad(new Date(now).getMinutes());
    for (let k = int(0, 2); k > 0; k--) { const times = [...new Set(Array.from({ length: int(1, 3) }, () => pad(int(6, 23)) + ":" + pick(["00", "30"])))].sort(); care.meds.push({ id: "m" + k, name: pick(MEDS), member: chance(0.5) ? "p1" : "", times, start: isoDay(now - 3 * 864e5) }); }
    for (const m of care.meds) for (const tm of m.times) if (chance(0.35)) care.taken[m.id + "|" + today + "|" + tm] = now - 1000;
    { const all = []; for (const m of care.meds) for (const tm of m.times) { const key = m.id + "|" + today + "|" + tm, taken = !!care.taken[key]; const late = !taken && tm < nowHm && ((+nowHm.slice(0, 2) * 60 + +nowHm.slice(3)) - (+tm.slice(0, 2) * 60 + +tm.slice(3))) >= 60; all.push({ key, tm, taken, late }); }
      all.sort((a, b) => a.tm.localeCompare(b.tm)); expMed = all.find((x) => !x.taken && (x.late || x.tm >= nowHm)) || null; }
    const medC = W.medCard(care, { now });
    if ((medC.rows[0] || {}).id !== (expMed ? "med:" + expMed.key : undefined)) errs.push("med " + JSON.stringify(medC.rows[0] && medC.rows[0].id) + " ≠ " + (expMed && expMed.key));
    parts.push("meds" + care.meds.length);
    // ---------- agents
    const agents = { agents: [] };
    for (let k = int(0, 4); k > 0; k--) {
      const checks = Array.from({ length: int(0, 5) }, (_, j) => ({ at: now - int(1, 72) * 36e5 + j, price: chance(0.8) ? int(15000, 26000) : 0, name: "PS5", href: chance(0.7) ? "https://www.noon.com/egypt-en/ps5-" + k + "/p" : "", site: "noon.com" }));
      agents.agents.push({ id: "a" + k, kind: "watch", what: pick(["PS5", "Hotel near the Haram", "AirPods Pro", "Flight to Istanbul"]), on: chance(0.85), checks, currency: "EGP" });
    }
    const agC = W.agentsCard(agents, { now });
    const onN = agents.agents.filter((a) => a.on !== false).length;
    if (agC.rows.length !== Math.min(3, onN)) errs.push("agents rows " + agC.rows.length + " ≠ " + Math.min(3, onN));
    for (const r of agC.rows) { const u = r.btns.find((b) => b[0].startsWith("url:")); if (u && !/^url:https:\/\//.test(u[0])) errs.push("agents url"); }
    // ---------- papers / trip / next
    const radar = { items: Array.from({ length: int(0, 4) }, (_, k) => ({ id: "d" + k, title: pick(["Passport", "Car licence", "ID card", "Insurance"]), date: isoDay(now + int(-30, 300) * 864e5), status: chance(0.15) ? "done" : "" })) };
    const expP = radar.items.filter((x) => x.date >= today && x.status !== "done").sort((a, b) => a.date.localeCompare(b.date))[0];
    const pC = W.papersCard(radar, { now });
    if ((pC.rows[0] || {}).id !== (expP ? "paper:" + expP.id : undefined)) errs.push("papers");
    const trip = chance(0.6) ? { country: pick(["TR", "AE", "SA"]), depart: isoDay(now + int(-5, 60) * 864e5) } : {};
    const tC = W.tripCard(trip, { now }); if (!!tC.rows.length !== !!(trip.depart && trip.depart >= today)) errs.push("trip");
    const dates = Array.from({ length: int(0, 3) }, (_, k) => ({ id: "x" + k, who: pick(WHO), kind: pick(["birthday", "anniversary"]), md: pad(int(1, 12)) + "-" + pad(int(1, 28)) }));
    const nC = W.nextCard(dates, { now }); if (!!nC.rows.length !== !!dates.length) errs.push("next");
    // ---------- money + the stack
    const pending = chance(0.35) ? [{ id: "q" + i, amount: int(20, 9000), direction: chance(0.8) ? "out" : "in", party: pick(["CARREFOUR", "UBER", ""]), from: pick(["CIB", "NBE"]) }] : [];
    const safe = chance(0.85) ? { today: int(0, 3000), cur: "EGP", spentToday: int(0, 2000) } : null;
    const mC = W.moneyCard({ safe, pending, salaryDay: chance(0.7) ? 25 : 0 });
    if (pending.length && (mC.rows[0] || {}).id !== "bank:" + pending[0].id) errs.push("money pending");
    if (!pending.length && mC.rows.length) errs.push("money row without SMS");
    const medDueIn = expMed ? ((+expMed.tm.slice(0, 2) * 60 + +expMed.tm.slice(3)) - (+nowHm.slice(0, 2) * 60 + +nowHm.slice(3))) : null;
    const agentBetter = chance(0.3), placeList = LD.length && chance(0.2) ? LD[0].id : "";
    const S = W.stackData({ day: dayC, money: mC, agents: agC, med: medC, papers: pC, trip: tC, next: nC, lists: LD }, { bankWaiting: !!pending.length, medDueIn, agentBetter, placeList }, { now, spentToday: safe ? safe.spentToday : 0, left: dayC.rows.length });
    // the first page, by the rule (independent of the code above)
    const first = placeList ? "list" : pending.length ? "money" : medDueIn != null && medDueIn <= 60 && medC.rows.length ? "med" : agentBetter && agC.rows.length ? "agents" : (hour >= 22 || hour < 3) ? "night" : (hour >= 5 && hour < 12) ? "day" : "day";
    if ((S.pages[0] || {}).kind !== first) errs.push("stack first " + (S.pages[0] || {}).kind + " ≠ " + first);
    if (new Set(S.pages.map((p) => p.kind)).size !== S.pages.length) errs.push("stack twice");
    parts.push("stack-" + first);
    // ---------- the taps (random order, some twice)
    const acts = [], expect = { done: new Set(), snooze: new Set(), paid: new Set(), taken: new Set(), pause: new Set(), ticks: {} };
    for (const r of dayC.rows) if (chance(0.5)) { const a = r.btns[r.btns.length - 1][0]; acts.push({ w: "day", a, id: r.id, at: now + int(1, 99) * 1000 });
      if (a === "done" && r.id.startsWith("rem:")) expect.done.add(r.id.slice(4)); if (a === "paid") expect.paid.add(r.id); }
      else if (r.id.startsWith("rem:") && chance(0.3)) { acts.push({ w: "day", a: "snooze", id: r.id, at: now + 5000 }); expect.snooze.add(r.id.slice(4)); }
    for (const l of LD) for (const it of l.items) if (chance(0.15)) { const a = it.done ? "untick" : "tick"; acts.push({ w: "list", a, id: "list:" + l.id + ":" + it.id, at: now + int(1, 99) * 1000 }); expect.ticks[l.id + ":" + it.id] = a === "tick"; }
    if (medC.rows.length && chance(0.5)) { acts.push({ w: "med", a: "taken", id: medC.rows[0].id, at: now + 1000 }); expect.taken.add(medC.rows[0].id.slice(4)); }
    for (const r of agC.rows) if (chance(0.3)) { acts.push({ w: "agents", a: "pause", id: r.id, at: now + 2000 }); expect.pause.add(r.id.slice(6)); }
    const bankAdd = pending.length && chance(0.6) ? (acts.push({ w: "money", a: "add", id: "bank:" + pending[0].id, at: now + 3000 }), 1) : 0;
    const twice = acts.filter(() => chance(0.25)).map((x) => ({ ...x }));   // the same tap delivered again
    const seenBefore = acts.length && chance(0.2) ? [W.actKey(acts[0])] : [];   // one already applied by an earlier run
    const all = shuffle([...acts, ...twice]);
    const R = W.applyActs(all, { reminders, lists, life, care, agents }, { now, seen: seenBefore });
    const skip0 = seenBefore[0];
    const was = (pred) => acts.some((x) => W.actKey(x) !== skip0 && pred(x));
    for (const id of expect.done) { if (!was((x) => x.id === "rem:" + id && x.a === "done")) continue; const r = (R.stores.reminders || reminders).find((x) => x.id === id); if (!r || !r.done) errs.push("rem not done"); }
    for (const id of expect.snooze) { if (!was((x) => x.id === "rem:" + id && x.a === "snooze")) continue; const r0 = reminders.find((x) => x.id === id), r = (R.stores.reminders || []).find((x) => x.id === id); if (!r || r.at !== Math.max(r0.at, acts.find((x) => x.id === "rem:" + id && x.a === "snooze").at) + 36e5) errs.push("snooze once, +1h: " + (r && (r.at - r0.at) / 36e5)); }
    for (const id of expect.paid) { if (!was((x) => x.id === id)) continue; const [, cid] = id.split(":"); const c = (R.stores.life || life).items.find((x) => x.id === cid); if (!c || !(c.paid || []).includes(0)) errs.push("bill not paid"); }
    for (const [k, v] of Object.entries(expect.ticks)) { const [lid, iid] = k.split(":"); if (!was((x) => x.id === "list:" + lid + ":" + iid)) continue; const l = (R.stores.lists || lists).lists.find((x) => x.id === lid); const it = l && l.items.find((x) => x.id === iid); if (!it || it.done !== v) errs.push("list tick " + k + " " + (it && it.done) + "≠" + v); }
    for (const k of expect.taken) { if (!was((x) => x.id === "med:" + k)) continue; if (!((R.stores.care || care).taken || {})[k]) errs.push("not taken"); }
    for (const id of expect.pause) { if (!was((x) => x.id === "agent:" + id)) continue; const a = (R.stores.agents || agents).agents.find((x) => x.id === id); if (!a || a.on !== false) errs.push("not paused"); }
    if (bankAdd && was((x) => x.a === "add") && R.bankAdd.join() !== pending[0].id) errs.push("bank add " + R.bankAdd.join());
    if (R.done.length !== new Set(all.map(W.actKey)).size - (skip0 && all.some((x) => W.actKey(x) === skip0) ? 1 : 0)) errs.push("each tap once: " + R.done.length);
    // ---------- the small box: what is typed (HARD = what people really type)
    const items = shuffle([...new Set(Array.from({ length: int(1, 5) }, () => pick(ITEMS)))]);
    const seps = items.map((_, k) => (k === items.length - 1 ? "" : k === items.length - 2 ? pick([" and ", ", ", " و ", " & ", "، "]) : pick([", ", "، ", ",", "\n"])));
    let typed = items.map((x, k) => x + seps[k]).join("");
    if (HARD) typed = harden(typed, rnd, { human: true, allowCut: false, allowCase: false, keep: null });
    const got = W.itemsOf(typed).map((s) => s.replace(/[‎‏]/g, "").replace(/\s*(?:😊|🙏|!!|تمام|شكرا|thanks|ok|\(1\/2\)|🔔)\s*$/u, "").replace(/\s+/g, " ").trim()).filter(Boolean);
    const norm = (s) => s.replace(/[أإآ]/g, "ا").replace(/ة$/, "ه").replace(/ى$/, "ي").toLowerCase();
    if (got.map(norm).join("|") !== items.map(norm).join("|")) errs.push("items " + JSON.stringify(typed) + " → " + JSON.stringify(got));
    const amt = int(5, 25000), note = pick(["koshary", "Uber", "كشري", "lunch with Sara", "بنزين", "gift"]), amtS = pick([String(amt), amt.toLocaleString("en-US"), String(amt).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])]);
    const spent = pick([`${amtS} ${note}`, `${note} ${amtS}`, `${amtS} on ${note}`, `${amtS} EGP ${note}`, `${note} ${amtS} جنيه`]);
    const sp = W.spendOf(HARD ? harden(spent, rnd, { human: true, allowCut: false, keep: /\d[\d,]*/ }) : spent);
    if (!sp || sp.amount !== amt) errs.push("spend " + spent + " → " + JSON.stringify(sp));
    shapes.push(parts.join("|") + "|" + shapeOf(typed) + "|" + shapeOf(spent) + "|" + all.map((x) => x.w + x.a).join(","));
    if (!errs.length) right++; else if (wrong.length < 30) wrong.push({ i, hour, errs });
  }
  const sh = shapeReport(shapes);
  if (!quiet) { console.log(`widgets: ${right} / ${total} right (${(100 * right / total).toFixed(2)} %) · ${HARD ? "HARD" : "easy"} · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
    for (const w of wrong.slice(0, 15)) console.log("  WRONG #" + w.i + " (" + w.hour + "h): " + w.errs.join(" · ").slice(0, 400)); }
  return { right, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
