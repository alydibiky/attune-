/* ---- v5.35 — Chat X-Ray: a WhatsApp chat, read on the phone -----------------------------------
   Business in Egypt runs on WhatsApp: who owes whom, what was promised, which deadline was agreed,
   which customer question never got an answer — all buried in long chats. Chat X-Ray reads an
   exported chat (WhatsApp → ⋮ → More → Export chat → Attune, or the .txt file) entirely offline:
     - parseExport: every export format (Android / iPhone, English / Arabic dates, Arabic digits,
       12 / 24 h, multi-line messages) → messages {i, t, who, text};
     - candidates: CODE picks the messages that mention money, promises, dates or questions (and
       the ones just before them) — only those go to the model, so a year-long chat stays fast;
     - the model returns items that POINT AT a message number; the quote and the date shown are
       the message itself, and an amount is kept only if that number is really in the message;
     - ledgerOf (who owes whom, per currency), unanswered questions and stats: by code.
   Pure functions; tests in tests/unit/v535.test.mjs.                                            */

const AR = /[٠-٩]/g;
const clean = (s) => String(s || "").replace(/[‎‏‪-‮⁦-⁩﻿]/g, "").replace(AR, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/،/g, ",");

const HEAD = /^\[?(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([AaPp]\.?\s?[Mm]\.?|ص|م)?\]?\s*(?:[-–]\s*)?([^:\n]{1,80}?):\s?([\s\S]*)$/;
const SYSTEM_HEAD = /^\[?(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})/;

/** An exported chat → { messages:[{i, t, who, text}], people:[names by count], order: "dmy"|"mdy"|"ymd" } */
export function parseExport(raw) {
  const lines = clean(raw).split(/\r?\n/);
  const heads = [];
  for (const l of lines) { const m = l.match(HEAD); if (m) heads.push(m); }
  // day / month order: any first part > 12 → day first; any second part > 12 → month first
  let order = "dmy";
  if (heads.some((m) => m[1].length === 4)) order = "ymd";
  else if (heads.some((m) => +m[2] > 12) && !heads.some((m) => +m[1] > 12)) order = "mdy";
  const out = [];
  let cur = null;
  for (const l of lines) {
    const m = l.match(HEAD);
    if (m && !/^(messages and calls|الرسائل والمكالمات)/i.test(m[9])) {
      let [a, b, c] = [+m[1], +m[2], +m[3]];
      let y, mo, d;
      if (order === "ymd") { y = a; mo = b; d = c; } else if (order === "mdy") { mo = a; d = b; y = c; } else { d = a; mo = b; y = c; }
      if (y < 100) y += 2000;
      let h = +m[4]; const ap = (m[7] || "").toLowerCase();
      if (/^p|م/.test(ap) && h < 12) h += 12;
      if (/^a|ص/.test(ap) && h === 12) h = 0;
      const t = new Date(y, mo - 1, d, h, +m[5], +(m[6] || 0)).getTime();
      cur = { i: out.length, t, who: m[8].trim().replace(/^~\s*/, ""), text: m[9] };
      out.push(cur);
    } else if (cur && !SYSTEM_HEAD.test(l)) {
      cur.text += "\n" + l;                          // a message over several lines
    } else if (SYSTEM_HEAD.test(l)) cur = null;     // "Ali added Hassan", encryption notice …
  }
  for (const x of out) x.text = x.text.replace(/\s+$/, "");
  const count = new Map();
  for (const x of out) count.set(x.who, (count.get(x.who) || 0) + 1);
  const messages = out.filter((x) => x.text && !/^<(media omitted|تم استبعاد الوسائط)>$|^(image|video|audio|sticker|document) omitted$/i.test(x.text.trim()));
  messages.forEach((x, k) => { x.i = k; });        // numbered in order, so "#12" is the 13th message
  return { messages, people: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n), order };
}

const MONEY = /(egp|le\b|جنيه|جنية|\$|usd|دولار|€|ريال|درهم|فلوس|مبلغ|حساب|تحويل|حو(ّ)?ل|دفع|ادفع|هدفع|دفعت|عليك|عليا|ليك|ليا|سلف|قرض|فاتورة|عربون|قسط|باقي|الباقي|مقدم|invoice|pay|paid|owe|owed|transfer|deposit|loan|balance|remaining|instapay|انستا|فودافون كاش|vodafone cash|\d{3,})/i;
const PROMISE = /(ه(بعت|عمل|خلص|جيب|حول|دفع|كلم|سلم|وصل|رد)|بكر[ةه]|بعد بكر[ةه]|الأسبوع الجاي|الاسبوع الجاي|آخر الشهر|اخر الشهر|أول الشهر|اول الشهر|يوم (السبت|الأحد|الاحد|الاثنين|الإثنين|التلات|الثلاثاء|الأربع|الاربع|الخميس|الجمعة)|وعد|موعد|ميعاد|تسليم|deadline|due|promise|i will|i'll|will (send|pay|deliver|call|finish)|tomorrow|next (week|month)|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the end))/i;
const QUESTION = /[?؟]/;

/** The messages worth reading (money, promises, dates, questions) + the one before each. */
export function candidates(messages, since = 0) {
  const keep = new Set();
  messages.forEach((m, k) => {
    if (m.t < since) return;
    if (MONEY.test(m.text) || PROMISE.test(m.text) || QUESTION.test(m.text)) { keep.add(k); if (k > 0) keep.add(k - 1); }
  });
  return [...keep].sort((a, b) => a - b).map((k) => messages[k]);
}

const fmtDate = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/** Messages → chunks of numbered lines ("#12 2026-09-27 Hassan: …") up to maxChars each. */
export function chunksOf(msgs, maxChars = 2400) {
  const out = []; let cur = "";
  for (const m of msgs) {
    const line = "#" + m.i + " " + fmtDate(m.t) + " " + m.who + ": " + m.text.replace(/\s+/g, " ").slice(0, 400) + "\n";
    if (cur && cur.length + line.length > maxChars) { out.push(cur); cur = ""; }
    cur += line;
  }
  if (cur) out.push(cur);
  return out;
}

/** The prompt that finds money, promises and deadlines in one chunk (JSON). */
export function extractMessages(chunk, me, people, today = new Date()) {
  return [
    { role: "system", content: `You read part of a WhatsApp chat. Each line starts with the message number (#12), its date and who wrote it. "${me}" is the phone's owner. People in the chat: ${people.slice(0, 12).join(", ")}.
Find: money owed or lent ("owes"), money paid or transferred ("paid"), promises to do something ("promise"), agreed dates or deadlines ("deadline"), orders placed ("order").
Reply with ONLY a JSON object: {"items":[{"type":"owes|paid|promise|deadline|order","msg":12,"from":"who owes / pays / promises","to":"to whom","amount":number or null,"currency":"EGP|USD|…" or null,"what":"a few words","due":"YYYY-MM-DD" or null}]}
Rules: "msg" is the number of the message that says it. Copy amounts exactly as written; null when no amount. "due" only when a date or day is said (today is ${fmtDate(today.getTime())}; "tomorrow" = the day after the message's date). No item for greetings or small talk. Empty list if nothing.` },
    { role: "user", content: chunk },
  ];
}

const nums = (s) => (clean(s).match(/\d[\d,.]*/g) || []).map((x) => parseFloat(x.replace(/,(?=\d{3})/g, "").replace(/,/g, "."))).filter((v) => isFinite(v));

/** The model's items, checked against the messages: the quote and date come from the message. */
export function parseItems(raw, byIndex, people) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return []; }
  const items = Array.isArray(j && j.items) ? j.items : [];
  const who = (n) => matchPerson(n, people);
  const out = [];
  for (const it of items) {
    const m = byIndex.get(Number(it.msg));
    if (!m) continue;                                              // must point at a real message
    const type = String(it.type || "").toLowerCase();
    if (!["owes", "paid", "promise", "deadline", "order"].includes(type)) continue;
    let amount = it.amount == null ? null : Number(String(it.amount).replace(/,/g, ""));
    if (amount != null && !(amount > 0 && nums(m.text).some((v) => Math.abs(v - amount) < 0.01 || Math.abs(v * 1000 - amount) < 0.01))) amount = null;   // not in the message → not trusted
    let due = /^\d{4}-\d{2}-\d{2}$/.test(String(it.due || "")) ? it.due : null;
    out.push({ type, msg: m.i, t: m.t, quote: m.text.slice(0, 300), author: m.who, from: who(it.from) || m.who, to: who(it.to), amount, currency: it.currency ? String(it.currency).toUpperCase().slice(0, 4) : (amount ? "EGP" : null), what: String(it.what || "").slice(0, 80), due });
  }
  return out;
}

/** The closest name in the chat ("hassan" → "Hassan Ali"). */
export function matchPerson(name, people) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return people.find((p) => p.toLowerCase() === n) || people.find((p) => p.toLowerCase().includes(n) || n.includes(p.toLowerCase())) || null;
}

/** Who owes the phone's owner (+) and whom the owner owes (−), per person and currency — by code. */
export function ledgerOf(items, me) {
  const book = new Map();   // person → Map(currency → { net, entries })
  const add = (person, cur, v, it) => {
    if (!person || person === me) return;
    if (!book.has(person)) book.set(person, new Map());
    const b = book.get(person);
    if (!b.has(cur)) b.set(cur, { net: 0, entries: [] });
    const e = b.get(cur); e.net += v; e.entries.push(it);
  };
  for (const it of items) {
    if (it.amount == null || !["owes", "paid"].includes(it.type)) continue;
    const cur = it.currency || "EGP";
    // "owes": from owes to.   "paid": from paid to (settles what from owed to).
    if (it.type === "owes") {
      if (it.to === me) add(it.from, cur, +it.amount, it);
      else if (it.from === me) add(it.to, cur, -it.amount, it);
    } else {
      if (it.to === me) add(it.from, cur, -it.amount, it);
      else if (it.from === me) add(it.to, cur, +it.amount, it);
    }
  }
  const rows = [];
  for (const [person, curs] of book) for (const [cur, e] of curs) rows.push({ person, currency: cur, net: Math.round(e.net * 100) / 100, entries: e.entries });
  return rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

/** Questions to the owner that got no answer from the owner within a day (last 60 days). */
export function unanswered(messages, me, now = Date.now()) {
  const out = [];
  for (let k = 0; k < messages.length; k++) {
    const m = messages[k];
    if (m.who === me || !QUESTION.test(m.text) || now - m.t > 60 * 86400000 || m.text.trim().length < 6) continue;
    const reply = messages.slice(k + 1).find((x) => x.who === me);
    if (!reply || reply.t - m.t > 86400000) out.push({ msg: m.i, t: m.t, who: m.who, quote: m.text.slice(0, 240) });
  }
  return out.slice(-15).reverse();
}

/** Messages per person, the first and last day, the busiest weekday — by code. */
export function statsOf(messages) {
  const per = new Map(), days = new Array(7).fill(0);
  for (const m of messages) { per.set(m.who, (per.get(m.who) || 0) + 1); days[new Date(m.t).getDay()]++; }
  const busiest = days.indexOf(Math.max(...days));
  return { total: messages.length, per: [...per.entries()].sort((a, b) => b[1] - a[1]), first: messages.length ? messages[0].t : null, last: messages.length ? messages[messages.length - 1].t : null, busiestDay: busiest };
}

/** The messages that best match a question (word overlap, names count double), with neighbours. */
export function searchChat(messages, question, n = 24) {
  const words = [...new Set(clean(question).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))];
  if (!words.length) return messages.slice(-n);
  const scored = messages.map((m, k) => {
    const t = clean(m.text).toLowerCase();
    let s = 0; for (const w of words) if (t.includes(w)) s += /\d/.test(w) ? 2 : 1;
    if (words.some((w) => m.who.toLowerCase().includes(w))) s += 1;
    return { k, s };
  }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.k - a.k).slice(0, Math.ceil(n / 2));
  const keep = new Set();
  for (const { k } of scored) { keep.add(k); if (k > 0) keep.add(k - 1); if (k + 1 < messages.length) keep.add(k + 1); }
  return [...keep].sort((a, b) => a - b).slice(0, n).map((k) => messages[k]);
}

/** The prompt that answers a question from the matching messages, citing #numbers. */
export function askMessages(question, msgs, me) {
  return [
    { role: "system", content: `Answer the question ONLY from these WhatsApp messages ("${me}" is the phone's owner). Cite the message number like [#12] after each fact. If the messages don't say, answer that in one line. Answer in the language of the question.` },
    { role: "user", content: "MESSAGES:\n" + chunksOf(msgs, 100000).join("") + "\nQUESTION: " + question },
  ];
}

export { fmtDate };
