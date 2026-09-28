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
const PROMISE = /(ه(بعت|عمل|خلص|جيب|حول|دفع|كلم|سلم|وصل|رد)|بكر[ةه]|بعد بكر[ةه]|الأسبوع الجاي|الاسبوع الجاي|آخر الشهر|اخر الشهر|أول الشهر|اول الشهر|(يوم )?(السبت|الأحد|الاحد|الاثنين|الإثنين|التلات|الثلاثاء|الأربع|الاربع|الخميس|الجمعة)|الساعة \d|\d{1,2} ?(الصبح|الصباح|بالليل|العصر|المغرب|الضهر|الظهر)|وعد|موعد|ميعاد|تسليم|deadline|due|promise|i will|i'll|will (send|pay|deliver|call|finish)|tomorrow|next (week|month)|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the end))/i;
const QUESTION = /[?؟]/;

/** The messages worth reading (money, promises, dates, questions) + the one before each. */
export function candidates(messages, since = 0) {
  const keep = new Set();
  messages.forEach((m, k) => {
    if (m.t < since) return;
    if (MONEY.test(m.text) || PROMISE.test(m.text) || QUESTION.test(m.text)) { keep.add(k); if (k > 0) keep.add(k - 1); }
    // the answer to a question is where a booking or a yes lives («ممكن الونش الخميس؟» → «تمام»)
    if (QUESTION.test(m.text) && k + 1 < messages.length) keep.add(k + 1);
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
What counts (Egyptian chats too):
- "owes" = a bill or debt is stated: «حسابه 18000» / «عليك 5000» / «you owe me» / an invoice total → from = the one who must pay.
- "paid" = money WAS sent or received: «حولتلك» «دفعت» «وصلت» «استلمت» «sent» «received». A transfer and its "arrived, thanks" reply are ONE payment — list it once, on the message that sends it.
- «هحولك» «هدفع» «هبعت» «I will pay» is a "promise" (not paid yet), with its amount.
- "from" is always the one who pays or owes, "to" the one who gets the money — NOT who wrote the message.
  Example: #0 Ali: «حسابك 5000» → {"type":"owes","msg":0,"from":"<the other person>","to":"Ali","amount":5000}; #1 Omar: «حولتلك 5000» → {"type":"paid","msg":1,"from":"Omar","to":"Ali","amount":5000}.
- Words: ونش = crane, حساب = bill, الباقي = the rest still owed, فاضل = still left, عربون = deposit.
Rules: "msg" is the number of the message that says it. Copy amounts exactly as written; null when no amount. "due" only when a date or day is said (today is ${fmtDate(today.getTime())}; "tomorrow" = the day after the message's date). No item for greetings or small talk. Empty list if nothing.` },
    { role: "user", content: chunk },
  ];
}

const FUTURE_PAY = /(^|[\s،,.])(ه(حول|دفع|بعت|سلم|ديك|اديك)|حاضر هحول|will (pay|send|transfer)|i'll (pay|send|transfer)|gonna (pay|send))/i;
const DONE_PAY = /(حولت|دفعت|بعتلك|بعت لك|وصلت|وصل|استلمت|اتحول|(have |has )?(paid|sent|transferred|received))/i;
const nums = (s) => (clean(s).match(/\d[\d,.]*/g) || []).map((x) => parseFloat(x.replace(/,(?=\d{3})/g, "").replace(/,/g, "."))).filter((v) => isFinite(v));

/** The model's items, checked against the messages: the quote and date come from the message. */
export function parseItems(raw, byIndex, people) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return []; }
  const items = Array.isArray(j && j.items) ? j.items : [];
  const who = (n) => matchPerson(n, people);
  const out = [];
  for (let it of items) {
    let m = byIndex.get(Number(it.msg));
    // a small model gave a message number that isn't in the chat (Spark said #12 of 6): the message is
    // found by what the item quotes — its amount, or its words — when exactly one message has it
    if (!m) {
      const amt = it.amount == null ? null : Number(String(it.amount).replace(/,/g, ""));
      const all = [...byIndex.values()];
      let hits = amt > 0 ? all.filter((x) => nums(x.text).some((v) => Math.abs(v - amt) < 0.01)) : [];
      if (hits.length !== 1 && it.what && String(it.what).trim().length >= 6) hits = all.filter((x) => x.text.includes(String(it.what).trim()));
      if (hits.length === 1) m = hits[0];
    }
    if (!m) continue;                                              // must point at a real message
    let type = String(it.type || "").toLowerCase();
    if (!["owes", "paid", "promise", "deadline", "order"].includes(type)) continue;
    let amount = it.amount == null ? null : Number(String(it.amount).replace(/,/g, ""));
    if (amount != null && !(amount > 0 && nums(m.text).some((v) => Math.abs(v - amount) < 0.01 || Math.abs(v * 1000 - amount) < 0.01))) amount = null;   // not in the message → not trusted
    let due = /^\d{4}-\d{2}-\d{2}$/.test(String(it.due || "")) ? it.due : null;
    // "paid" on a message that only promises to pay («هحولك 10000 النهارده») is a promise — the money hasn't moved
    if (type === "paid" && FUTURE_PAY.test(m.text) && !DONE_PAY.test(m.text)) type = "promise";
    // who owes whom, from the words: «حسابك / عليك / you owe» written by X → the other one owes X;
    // «عليا / I owe» written by X → X owes. The model often takes the writer as the debtor.
    if (type === "owes") {
      const other = it.to && who(it.to) && who(it.to) !== m.who ? who(it.to) : who(it.from) && who(it.from) !== m.who ? who(it.from) : people.length === 2 ? people.find((p) => p !== m.who) : null;
      if (other && BILL_TO_OTHER.test(m.text) && !BILL_ON_ME.test(m.text)) { it = { ...it, from: other, to: m.who }; }
      else if (other && BILL_ON_ME.test(m.text) && !BILL_TO_OTHER.test(m.text)) { it = { ...it, from: m.who, to: other }; }
    }
    // the same payment twice (the transfer and "arrived, thanks") counts once
    if (type === "paid" && amount != null && out.some((o) => o.type === "paid" && o.amount === amount && Math.abs(o.t - m.t) < 4 * 86400000)) continue;
    out.push({ type, msg: m.i, t: m.t, quote: m.text.slice(0, 300), author: m.who, from: who(it.from) || m.who, to: who(it.to), amount, currency: it.currency ? String(it.currency).toUpperCase().slice(0, 4) : (amount ? "EGP" : null), what: String(it.what || "").slice(0, 80), due });
  }
  return out;
}

/**
 * The safety net under the model: a message that plainly says money WAS sent («حولتلك 10000», "sent you 500")
 * in a chat between two people is a payment from its writer to the other one — added by code when the model
 * left it out. Only clear cases: one amount, a past-tense payment word, no "will".
 */
export function addMissedPayments(items, messages, people) {
  if (!people || people.length !== 2) return items;
  const out = [...items];
  for (const m of messages) {
    if (!DONE_PAY_TO_YOU.test(m.text) || FUTURE_PAY.test(m.text)) continue;
    const v = nums(m.text).filter((x) => x >= 10);
    if (v.length !== 1) continue;
    if (out.some((o) => o.msg === m.i && o.type === "paid") || out.some((o) => o.type === "paid" && o.amount === v[0] && Math.abs(o.t - m.t) < 4 * 86400000)) continue;
    const other = people.find((p) => p !== m.who);
    out.push({ type: "paid", msg: m.i, t: m.t, quote: m.text.slice(0, 300), author: m.who, from: m.who, to: other, amount: v[0], currency: "EGP", what: "transfer", due: null, byCode: true });
  }
  // a booking asked and agreed: «ممكن الونش 50 طن يوم الخميس؟» → «تمام الخميس 7 الصبح» (v6.8, found by Spark)
  for (let k = 0; k + 1 < messages.length; k++) {
    const q = messages[k], a = messages[k + 1];
    if (!QUESTION.test(q.text) || !PROMISE.test(q.text) || a.who === q.who || !YES.test(a.text.trim())) continue;
    if (out.some((o) => o.msg === q.i || o.msg === a.i)) continue;
    out.push({ type: "order", msg: a.i, t: a.t, quote: q.text.slice(0, 200) + " → " + a.text.slice(0, 100), author: a.who, from: q.who, to: a.who, amount: null, currency: null, what: q.text.replace(/[?؟]/g, "").slice(0, 80), due: null, byCode: true });
  }
  return out;
}
const YES = /^(تمام|ماشي|اوكي|أوكي|اوك|أكيد|اكيد|حاضر|موافق|اتفقنا|يب|ايوه|أيوه|ok|okay|sure|done|yes|deal|confirmed)(?![\p{L}])/iu;
const BILL_TO_OTHER = /(حسابك|حسابه|حسابها|عليك|عليكي|عليكو|عليكم|مطلوب منك|you owe|your bill|your invoice|you still owe)/i;
const BILL_ON_ME = /(عليا|عليّا|عليّ |اللي عليا|انا مديون|أنا مديون|i owe|my bill|my debt)/i;
const DONE_PAY_TO_YOU = /(حولتلك|حولت لك|دفعتلك|دفعت لك|بعتلك \d|بعتلك فلوس|sent you|paid you|transferred (you|to you))/i;

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

// ---- v5.41: two questions people really ask (Ali: "what was the conversation about?", "was X mentioned?") ----
const normAr = (s) => clean(s).toLowerCase().replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
/** "about" (an overview of the whole chat) | "mention" (was a word/phrase said?) | "other" */
export function askKind(q) {
  const t = String(q || "").trim();
  if (mentionTerm(t)) return "mention";
  if (/\b(what (was|is|were) (the |this |our )?(chat|conversation|group|discussion)s?( all)? about|what did (we|they) (talk|discuss|say)|summar(y|ise|ize)|overview|main topics?|gist)\b|ملخص|لخص|لخّص|بيتكلموا عن|اتكلمنا عن|اتكلموا عن|الكلام كان عن|المحادثة (كانت )?عن|الشات (كان )?عن|الموضوع (كان )?(إيه|ايه)|المواضيع/i.test(t)) return "about";
  return "other";
}
/** The phrase to look for in "was “LTM 1100” mentioned?", «هل اتقال "العربون"؟», "did anyone mention the deposit" → "LTM 1100" / … */
export function mentionTerm(q) {
  const t = String(q || "").trim();
  const quoted = t.match(/["“”«»'‘’]([^"“”«»'‘’]{1,60})["“”«»'‘’]/);
  const asks = /\b(mention(ed|s)?|said|say|talk(ed)? about|brought up|come up|came up|appear(s|ed)?|written|wrote|any(one|body) (say|said|mention))\b|اتقال|اتذكر|اتكتب|ذكر|قال|قالوا|اتكلم|جه ذكر|موجود|اتجاب سيرة|سيرة/i.test(t);
  if (quoted && asks) return quoted[1].trim();
  if (quoted && /^\s*(was|is|did|هل)\b/i.test(t)) return quoted[1].trim();
  if (!asks) return null;
  let m = t.match(/\b(?:was|were|is)\s+(?:the\s+)?(.{2,50}?)\s+(?:ever\s+)?(?:mentioned|said|brought up|discussed|talked about)\b/i)
    || t.match(/\b(?:mention(?:ed)?|say|said|talk(?:ed)? about|bring up|brought up)\s+(?:the\s+|a\s+|an\s+|any\s+)?(.{2,50}?)\s*(?:\?|$| in (?:the|this) (?:chat|group|conversation))/i)
    || t.match(/(?:اتقال|اتذكر|اتكتب|ذكر|جه ذكر|اتجابت سيرة|سيرة)\s+(?:كلمة\s+)?(.{2,50}?)\s*(?:\?|؟|$| في)/);
  return m ? m[1].replace(/^(anything about|about)\s+/i, "").trim() : null;
}
/** Every message containing the phrase (Arabic spelling variants and case ignored). */
export function findMentions(messages, term) {
  const n = normAr(term);
  if (!n) return [];
  const words = n.split(" ").filter((w) => w.length > 1);
  const exact = messages.filter((m) => normAr(m.text).includes(n));
  if (exact.length) return exact;
  // Arabic: «العربون» also finds «عربون» (the article is often left out in chats)
  const bare = n.split(" ").map((w) => w.replace(/^(ال|وال|بال|لل)(?=\S{2,})/, "")).join(" ");
  if (bare !== n) { const b = messages.filter((m) => normAr(m.text).includes(bare)); if (b.length) return b; }
  if (words.length < 2) return exact;
  return messages.filter((m) => { const t = normAr(m.text); return words.every((w) => t.includes(w)); });   // all the words, in any order
}
/** The answer to "was X mentioned?" — written by code, instantly. */
export function mentionAnswer(term, hits, total, ar) {
  if (!hits.length) return ar ? `لأ — «${term}» مش موجودة في الشات (اتفحصت كل الرسائل: ${total}).` : `No — “${term}” doesn't appear anywhere in this chat (all ${total} messages checked).`;
  const first = hits[0], last = hits[hits.length - 1];
  const who = [...new Set(hits.map((m) => m.who))].slice(0, 4).join(ar ? "، " : ", ");
  return ar ? `أيوه — «${term}» اتذكرت ${hits.length} مرة${hits.length > 1 ? "" : ""}، أول مرة ${fmtDate(first.t)} (${first.who})${hits.length > 1 ? ` وآخر مرة ${fmtDate(last.t)} (${last.who})` : ""}. قالها: ${who}.`
    : `Yes — “${term}” was mentioned ${hits.length} time${hits.length > 1 ? "s" : ""}: first on ${fmtDate(first.t)} by ${first.who}${hits.length > 1 ? `, last on ${fmtDate(last.t)} by ${last.who}` : ""}. Said by: ${who}.`;
}
/** Messages spread over the whole chat (start → end), the longer ones first, within a budget — for an overview. */
export function overviewSample(messages, budget = 6000) {
  const real = messages.filter((m) => m.text && m.text.replace(/\s+/g, " ").length >= 12);
  if (!real.length) return [];
  const slots = 12, per = Math.max(1, Math.ceil(real.length / slots)), pick = new Set();
  let used = 0;
  // from each stretch of the chat, its most substantial messages
  for (let round = 0; round < 6 && used < budget; round++) {
    for (let k = 0; k < slots && used < budget; k++) {
      const part = real.slice(k * per, (k + 1) * per).filter((m) => !pick.has(m.i)).sort((a, b) => b.text.length - a.text.length);
      const m = part[0]; if (!m) continue;
      pick.add(m.i); used += Math.min(400, m.text.length) + 30;
    }
  }
  return real.filter((m) => pick.has(m.i));
}
export function overviewMessages(question, sample, me, total) {
  return [
    { role: "system", content: `You summarise a WhatsApp chat ("${me}" is the phone's owner) from messages sampled across ALL of it (${total} messages in total). Write: one sentence on what the chat is about overall, then the main topics as bullet points in time order, each with its date range and who drove it, citing message numbers like [#12]. Then any open issues (money owed, promises, unanswered questions). Only what the messages show. Answer in the language of the question.` },
    { role: "user", content: "MESSAGES (a sample from start to end):\n" + chunksOf(sample, 100000).join("") + "\nQUESTION: " + question },
  ];
}

export { fmtDate };
