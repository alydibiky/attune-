/* ---- v8.8 The connected memory, part 2 (Ali, 30 Oct 2026: "when I ask something in the main chat it has everything … that's
   not just for names, that's for everything"). Every thing kept anywhere in Attune becomes one item on one list — a payment,
   a debt or instalment, a note (Shelf or Mind), a message Recall kept, a reminder, a date, a goal, a medicine, an agent's find —
   and code marks what it is about: the people / places / things on your cards (entities.js), topics (a wedding, Umrah, the car,
   the flat, school, the doctor…) and your goals by name. A question then gets everything linked to what it names, from every
   part of the app, the money summed by code; Chat writes the answer from that and shows where each fact came from.
   Pure (stores in); tests: tests/unit/v880links.test.mjs.                                                                   */
import { resolve, mentions, fold as efold, labelOf } from "./entities.js";
import { progressOf } from "./life.js";

// Topics: what something is about, in English, Egyptian Arabic and Franco. [key, en, ar, words]
export const TOPICS = [
  ["wedding", "Wedding", "الفرح", /\b(wedding|engagement|bride|groom|zaffa|fara7|farah|katb ketab)\b|فرح|الفرح|جواز|الجواز|زفاف|خطوبه|خطوبة|شبكه|شبكة|كتب الكتاب|العروسه|العريس|قاعه|قاعة/i],
  ["umrah", "Umrah & Hajj", "العمرة والحج", /\b(umrah|omra|hajj|haj|makkah|mecca|madinah|medina|haram)\b|عمره|عمرة|العمره|حج|الحج|مكه|مكة|المدينه|الحرم/i],
  ["car", "The car", "العربية", /\b(car|fuel|petrol|gas station|mechanic|garage|tyres?|tires?|oil change|licen[cs]e|kia|toyota|hyundai|nissan|bmw|mercedes|chevrolet|3arabeya)\b|عربيه|عربية|العربيه|بنزين|ميكانيكي|كاوتش|ترخيص|غيار زيت|البنزينه/i],
  ["home", "The flat", "الشقة", /\b(flat|apartment|rent|landlord|building|maintenance fee|sha2a)\b|شقه|شقة|الشقه|ايجار|إيجار|صاحب البيت|العماره|العمارة|صيانه العماره/i],
  ["repairs", "Repairs", "التصليحات", /\b(plumb\w*|electrician|carpenter|painter|repair\w*|fix\w*|leak|sink|ac|air ?con\w*|sabbak|sabak)\b|سباك|السباك|كهربائي|الكهربائي|نجار|النجار|نقاش|تصليح|صلح|صيانه|صيانة|تكييف|التكييف|حنفيه|حنفية/i],
  ["school", "School", "المدرسة", /\b(school|tuition|fees|lessons?|tutor|uniform|books|university|college|madrasa)\b|مدرسه|مدرسة|المدرسه|مصاريف المدرسه|دروس|درس|الجامعه|جامعة|يونيفورم|كتب المدرسه/i],
  ["health", "Health", "الصحة", /\b(doctor|dr\.?|clinic|hospital|medicine|pharmacy|lab|tests?|x-?ray|scan|dentist|sugar|pressure|insulin|hba1c)\b|دكتور|الدكتور|دكتوره|عياده|عيادة|مستشفي|مستشفى|دوا|دواء|صيدليه|صيدلية|تحاليل|تحليل|اشعه|أشعة|سكر|ضغط|سنان|اسنان/i],
  ["travel", "Travel", "السفر", /\b(travel|trip|hotel|flight|airport|booking|visa|holiday|vacation|resort|sahel|sa7el)\b|سفر|السفر|سفريه|رحله|رحلة|فندق|طيران|مطار|تأشيره|فيزا|المصيف|الساحل/i],
  ["groceries", "Groceries", "البقالة", /\b(groceries|supermarket|carrefour|spinneys|hyper|seoudi|kazyon|metro market)\b|سوبر ماركت|السوبر|بقاله|بقالة|كارفور|خضار|فاكهه/i],
  ["food", "Eating out", "الأكل برة", /\b(restaurant|lunch|dinner|delivery|talabat|elmenus|cafe|coffee|starbucks|kfc|mcdonald'?s|pizza)\b|مطعم|غدا|عشا|دليفري|طلبات|قهوه|كافيه/i],
  ["bills", "Bills", "الفواتير", /\b(bill|electricity|water|gas|internet|wifi|vodafone|orange|etisalat|phone bill|recharge)\b|فاتوره|فاتورة|كهربا|كهرباء|مياه|ميه|غاز|انترنت|نت|فودافون|اورنج|اتصالات|شحن/i],
  ["kids", "The kids", "الولاد", /\b(kids?|son|daughter|baby|nursery|diapers|toys)\b|الولاد|العيال|ابني|بنتي|البيبي|حضانه|حضانة|بامبرز|لعب/i],
  ["work", "Work", "الشغل", /\b(work|office|boss|client|meeting|salary|invoice|project|deadline)\b|الشغل|شغل|المكتب|المدير|عميل|اجتماع|مرتب|المرتب|فاتوره العميل|مشروع/i],
  ["gifts", "Gifts", "الهدايا", /\b(gift|present|eidiya|birthday)\b|هديه|هدية|عيديه|عيدية|عيد ميلاد/i],
  ["ramadan", "Ramadan & Eid", "رمضان والعيد", /\b(ramadan|eid|iftar|suhoor|zakat|sadaqa|charity)\b|رمضان|العيد|عيد|فطار|سحور|زكاه|زكاة|صدقه|صدقة/i],
  ["clothes", "Clothes", "اللبس", /\b(clothes|shoes|dress|shirt|zara|h&m|defacto|lc waikiki)\b|لبس|هدوم|جزمه|جزمة|فستان|قميص/i],
  ["gym", "Sport", "الرياضة", /\b(gym|club|training|coach|swim\w*|football|padel)\b|جيم|الجيم|النادي|نادي|تمرين|سباحه|كوره|بادل/i],
];
const TOPIC = new Map(TOPICS.map((t) => [t[0], t]));
export const topicName = (k, ar) => (TOPIC.get(k) ? TOPIC.get(k)[ar ? 2 : 1] : k);

const day = (s) => { const t = Date.parse(String(s || "").slice(0, 10) + "T12:00:00"); return isFinite(t) ? t : 0; };
const short = (s, n = 160) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
/** Everything kept in the app as one list: [{ id, src, ts, title, text, amount?, sign? (+ in / − out), who? (a person's name the
 *  part already knows), open }]. stores = lifeask.loadStores() (+ pots, agents, shelf notes come with memory). */
export function itemsOf(s = {}) {
  const out = [];
  const L = s.ledger || {};
  for (const t of L.txns || []) {
    if (!t || !(t.type === "income" || t.type === "expense")) continue;
    out.push({ id: "tx:" + t.id, src: "money", ts: day(t.date), title: short(t.note || t.cat || "", 80) || (t.type === "income" ? "Income" : "Expense"), text: [t.note, t.cat, t.payee, t.merchant].filter(Boolean).join(" · "),
      amount: +t.amount || 0, sign: t.type === "income" ? 1 : -1, cur: t.currency || L.currency || "", open: "money" });
  }
  for (const c of (s.life && s.life.items) || []) {
    let left = null; try { const p = progressOf(c); left = p && p.left != null ? p.left : null; } catch (e) {}
    out.push({ id: "life:" + c.id, src: "followups", ts: day(c.start) || c.created || 0, title: short([c.person, c.title || c.kind].filter(Boolean).join(" · "), 90), text: [c.person, c.title, c.kind, c.note].filter(Boolean).join(" · "),
      amount: +c.total || +c.amount || 0, sign: c.dir === "in" ? 1 : -1, left, kind: c.kind, done: !!c.done, who: c.person || "", open: "life" });
  }
  for (const r of s.memory || []) {
    if (!r || r.kind === "chat" || (r.meta && r.meta.trashed)) continue;
    out.push({ id: "mem:" + r.id, src: r.meta && r.meta.book ? "notes" : r.kind === "todo" ? "todo" : "mind", ts: r.ts || 0, title: short(r.title, 90), text: short([r.text, r.output && String(r.output).slice(0, 300), r.meta && r.meta.label].filter(Boolean).join(" · "), 600), open: "memory", rec: r.id });
  }
  for (const n of s.notes || []) out.push({ id: "msg:" + (n.id || n.ts + (n.pkg || "")), src: "messages", ts: n.ts || 0, title: short([n.app || n.pkg, n.title].filter(Boolean).join(" · "), 80), text: short(n.text, 400), who: n.title || "", open: "recall" });
  for (const r of s.reminders || []) if (r && (r.text || r.title)) out.push({ id: "rem:" + (r.id || r.at), src: "reminders", ts: +r.at || day(r.date) || 0, title: short(r.text || r.title, 90), text: short(r.text || r.title, 200), open: "reminders" });
  for (const r of (s.radar && s.radar.items) || []) out.push({ id: "date:" + r.id, src: "dates", ts: day(r.date || r.renews), title: short(r.name || r.title, 80), text: short([r.name, r.title, r.note].filter(Boolean).join(" · "), 200), amount: +r.amount || 0, sign: -1, open: "radar" });
  for (const p of (s.pots && s.pots.pots) || []) out.push({ id: "goal:" + p.id, src: "goals", ts: p.created || 0, title: short(p.name, 60), text: short(p.name + " " + (p.kind || ""), 80), amount: +p.target || +p.per || 0, saved: +p.saved || 0, goal: p.name, open: "planner" });
  for (const m of (s.care && s.care.meds) || []) out.push({ id: "med:" + (m.id || m.name), src: "health", ts: m.created || 0, title: short([m.name, m.dose].filter(Boolean).join(" "), 60), text: short([m.name, m.for, m.member, "medicine"].filter(Boolean).join(" · "), 120), who: m.member || "", open: "care" });
  for (const a of (s.agents && s.agents.agents) || []) if (a && a.title) out.push({ id: "agent:" + a.id, src: "agents", ts: a.created || 0, title: short(a.title, 80), text: short([a.title, a.site, (a.best3 || []).map((o) => o.name + " " + o.price).join(" · ")].join(" · "), 300), amount: (a.best3 && a.best3[0] && a.best3[0].price) || 0, open: "agents" });
  return out;
}

/** What one item is about: { people: [card ids], topics: [keys], goals: [names] }. */
export function tagOf(it, dir, goals = []) {
  const hay = [it.title, it.text].join(" "), people = new Set();
  for (const m of mentions(hay + (it.who ? " " + it.who : ""), dir)) if (m.ids.length === 1) people.add(m.ids[0]); else for (const id of m.ids) people.add(id + "?");   // "?" = could be
  const topics = TOPICS.filter((t) => t[3].test(hay)).map((t) => t[0]);
  const f = efold(hay), gs = goals.filter((g) => g && efold(g).trim().length >= 3 && f.includes(efold(g).trim()));
  if (it.src === "goals" && it.goal) gs.push(it.goal);
  return { people: [...people], topics, goals: [...new Set(gs)] };
}

const ASK_SUM = /\b(how much|how many|total|spent|paid|cost|owe|owes|so far)\b|كام|قد ايه|اد ايه|قديش|مجموع|اجمالي|إجمالي|صرفت|دفعت|كلف|كلفني|عليا|ليا|عليه|لحد دلوقتي/i;
const ASK_LAST = /\b(last time|when did|when was|latest|most recent)\b|اخر مره|آخر مرة|اخر مرة|امتى اخر|إمتى آخر|امتي/i;
const ASK_OWE = /\b(owe|owes|owed|debt|lend|lent|borrow)\b|عليا|ليا عند|ليا|عليه|سلف|دين|مديون/i;
/**
 * A question → everything in the app linked to what it names. → null (it names nothing on your cards, no topic, no goal) |
 * { ask: { key, choices: [{ id, label }] } } (which Ahmed?) | { people: [cards], topics, goals, items (newest first, ≤ 40),
 *   money: { out, in, count, cur, last }, owe: { toMe, iOwe, open: [items] }, answer: { en, ar } | null (code could answer it),
 *   block: text for the model, sources: [{ id, src, title, open }] }
 */
export function connect(question, stores = {}, dir = { items: [] }, { now = Date.now(), pick = null } = {}) {
  const q = String(question || "").trim(); if (!q) return null;
  const r = resolve(q, dir, { now });
  if (r.ask && !pick) return { ask: { key: r.ask.key, choices: r.ask.choices.map((id) => ({ id, label: labelOf(dir.items.find((p) => p.id === id)) })) } };
  const ids = new Set(r.found.map((f) => f.id)); if (pick) ids.add(pick);
  const goals = ((stores.pots && stores.pots.pots) || []).map((p) => p.name).filter(Boolean);
  const qTopics = TOPICS.filter((t) => t[3].test(q)).map((t) => t[0]);
  const fq = efold(q), qGoals = goals.filter((g) => efold(g).trim().length >= 3 && fq.includes(efold(g).trim()));
  if (!ids.size && !qTopics.length && !qGoals.length) return null;
  const all = itemsOf(stores);
  const items = [];
  for (const it of all) {
    const t = tagOf(it, dir, goals);
    // "Ahmed — invoice" names an Ahmed without saying which: it counts for the Ahmed asked about (never for one another card holds)
    const byPerson = [...ids].some((id) => t.people.includes(id) || t.people.includes(id + "?"));
    // a topic alone links an item only when the question names no one (else "Ahmed's wedding gift" ≠ every wedding payment)
    const byTopic = !ids.size && qTopics.some((k) => t.topics.includes(k));
    const byGoal = qGoals.some((g) => t.goals.includes(g));
    if (byPerson || byTopic || byGoal) items.push({ ...it, tags: t });
  }
  items.sort((a, b) => b.ts - a.ts);
  const money = items.filter((x) => x.src === "money");
  const out = money.filter((x) => x.sign < 0).reduce((a, x) => a + x.amount, 0), inn = money.filter((x) => x.sign > 0).reduce((a, x) => a + x.amount, 0);
  const debts = items.filter((x) => x.src === "followups" && !x.done && (x.kind === "debt" || x.kind === "installment") && (x.left == null || x.left > 0));
  const toMe = debts.filter((x) => x.sign > 0).reduce((a, x) => a + (x.left != null ? x.left : x.amount), 0), iOwe = debts.filter((x) => x.sign < 0).reduce((a, x) => a + (x.left != null ? x.left : x.amount), 0);
  const cur = (money[0] && money[0].cur) || (stores.ledger && stores.ledger.currency) || "";
  const people = [...ids].map((id) => dir.items.find((p) => p.id === id)).filter(Boolean);
  const name = people.length ? people.map((p) => p.name).join(" & ") : qGoals[0] || (qTopics[0] ? topicName(qTopics[0]) : "");
  const nameAr = people.length ? people.map((p) => p.name).join(" و") : qGoals[0] || (qTopics[0] ? topicName(qTopics[0], true) : "");
  const n = (v) => Math.round(v).toLocaleString("en-US");
  const when = (ts, ar) => (ts ? new Date(ts).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short", year: new Date(ts).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" }) : "");
  // what code can answer by itself (sums, debts, the last time) — exact, at once
  let answer = null;
  if (ASK_OWE.test(q) && debts.length) answer = { en: `${name}: ${toMe ? "owes you " + n(toMe) + " " + cur : ""}${toMe && iOwe ? " · " : ""}${iOwe ? "you owe " + n(iOwe) + " " + cur : ""} (from Follow-ups).`, ar: `${nameAr}: ${toMe ? "ليك عنده " + n(toMe) + " " + cur : ""}${toMe && iOwe ? " · " : ""}${iOwe ? "عليك " + n(iOwe) + " " + cur : ""} (من المتابعات).` };
  else if (ASK_LAST.test(q) && items.length) { const x = items[0]; answer = { en: `Last time: ${when(x.ts)} — ${x.title}${x.amount ? " (" + n(x.amount) + " " + (x.cur || cur) + ")" : ""}.`, ar: `آخر مرة: ${when(x.ts, true)} — ${x.title}${x.amount ? " (" + n(x.amount) + " " + (x.cur || cur) + ")" : ""}.` }; }
  else if (ASK_SUM.test(q) && money.length) answer = { en: `${name}: ${out ? "you paid " + n(out) + " " + cur : ""}${out && inn ? " and " : ""}${inn ? "you got " + n(inn) + " " + cur : ""} — ${money.length} ${money.length === 1 ? "payment" : "payments"} in Money${money.length ? ", the last on " + when(money[0].ts) : ""}.`,
    ar: `${nameAr}: ${out ? "دفعت " + n(out) + " " + cur : ""}${out && inn ? " و" : ""}${inn ? "جالك " + n(inn) + " " + cur : ""} — ${money.length} ${money.length === 1 ? "عملية" : "عمليات"} في الفلوس${money.length ? "، آخرها " + when(money[0].ts, true) : ""}.` };
  const top = items.slice(0, 40);
  const SRC = { money: "Money", followups: "Follow-ups", notes: "Notes", mind: "Mind", todo: "To-do", messages: "Messages", reminders: "Reminders", dates: "Dates", goals: "Goals", health: "Health", agents: "Agents" };
  const block = (people.length ? "Who: " + people.map((p) => labelOf(p) + (p.contact && p.contact.phone ? " (" + p.contact.phone + ")" : "")).join("; ") + "\n" : "")
    + (money.length ? `Money: paid ${n(out)} ${cur}, received ${n(inn)} ${cur}, ${money.length} payments\n` : "")
    + (debts.length ? `Owed: to the user ${n(toMe)} ${cur}, the user owes ${n(iOwe)} ${cur}\n` : "")
    + top.map((x) => `- [${SRC[x.src] || x.src}${x.ts ? ", " + when(x.ts) : ""}] ${x.title}${x.amount ? " — " + n(x.amount) + " " + (x.cur || cur) : ""}${x.text && x.text !== x.title ? " · " + short(x.text, 140) : ""}`).join("\n");
  return { people, topics: qTopics, goals: qGoals, items: top, money: { out, in: inn, count: money.length, cur, last: money[0] || null }, owe: { toMe, iOwe, open: debts },
    answer, block: block ? "From the user's own Attune (everything linked to what they asked; use it, don't invent):\n" + block + "\n\n" : "",
    sources: top.slice(0, 8).map((x) => ({ id: x.id, src: x.src, title: x.title, open: x.open, rec: x.rec })) };
}
