/* ---- v9.9.40 AP-6 (the new Autopilot, Ali OK'd K5 / AS-2 + "display the full message of everything" — rule 4): questions about
   a chat, answered from the kept messages, never a guess. "When did Address East discuss the garage?", «امتى سكان العمارة اتكلموا عن
   الجراج؟», "what did the cranes group say about the dynamo", "emta el talabat kalemo 3an el laban".
   · chatIn(q, chats) — the chat the question names ("address east" → "🏠ADDRESS EAST OWNERS 🏠"), or by its role words
     ("the building group" → the chat whose role is building).
   · askChat(q, chats, messagesByChat) → { kind: "topic", chat, topic, days: [{ iso, who, n, quote }], ids, total } — every day it came
     up, who wrote, the first message of that day, and the ids of ALL the messages used (the "Show all 23 messages" button).
     For the shopping-list chat, "what are all the talabat?" → { kind: "list" } (the page shows the list itself).
   The "Decided:" line is the phone's AI reading those same messages (AS-2); it is shown above them, never instead of them.
   Pure; tests: tests/chatask/gen.mjs (10,000 questions over made-up histories) + tests/unit/v9940chatask.test.mjs. */

const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[^\p{L}])/gu, "ه").replace(/[ًٌٍَُِّْـ]/g, "")
  .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const STRIP = (w) => w.replace(/^(?:ال|el|al)(?=\S{2,})/i, "").replace(/^(?:the|a|an)$/i, "");
// the same thing said other ways (the person's word → every form to look for)
const SAME = [["garage", "parking", "جراج", "جراش", "الجراج", "باركينج", "الركنه", "ركنه", "garag", "el garage"], ["maintenance", "صيانه", "صيانة", "الصيانه", "sayana", "siana"],
  ["fees", "fee", "subscription", "اشتراك", "اشتراكات", "رسوم", "فلوس الصيانه"], ["water", "مايه", "مية", "ميه", "المية", "المايه", "maya"], ["electricity", "power", "كهربا", "كهرباء", "الكهربا", "kahraba"],
  ["elevator", "lift", "اسانسير", "الاسانسير", "مصعد", "asanseer"], ["gate", "بوابه", "البوابه", "بوابة", "bawaba"], ["security", "guard", "امن", "الامن", "سيكيوريتي", "الحارس", "bawab", "بواب"],
  ["milk", "لبن", "اللبن", "laban"], ["bread", "عيش", "العيش", "3eish"], ["eggs", "egg", "بيض", "البيض", "beid"], ["crane", "cranes", "ونش", "الونش", "اوناش", "الاوناش", "wensh"],
  ["dynamo", "دينامو", "الدينامو"], ["meeting", "اجتماع", "الاجتماع", "meeting"], ["rent", "ايجار", "الايجار"], ["pool", "حمام السباحه", "البيسين", "pool"]];
const forms = (w) => { const f = STRIP(fold(w)); const g = SAME.find((x) => x.some((y) => STRIP(fold(y)) === f)); return [...new Set((g || [w]).map((y) => STRIP(fold(y))).filter((y) => y.length >= 2))]; };
const Q_WORDS = /\b(?:when|what|did|does|do|was|were|has|have|is|are|the|a|an|about|discuss(?:ed)?|talk(?:ed)?|say|said|mention(?:ed)?|chat|group|in|on|of|last|time|times|any|anything|everything|all|ever|they|people|someone|anyone|tell|me|show|find|messages?|ya|attune|emta|eh|amta|kalemo|3an|2alo|fi|el|bta3|bta3et|group)\b|(?:^|\s)(?:امتى|إمتى|امتي|ايه|إيه|اللي|اتكلموا|اتكلمو|اتكلم|قالوا|قال|عن|في|فى|جروب|الجروب|ال|كل|حد|مين|بخصوص|بتاع|بتاعت|يا|اتيون|أتيون|آخر|اخر|مره|مرة|سيرة|جابوا|جاب)(?=\s|$)/gi;

// (the 10,000-question run: the cranes group is NAMED «صيانة الاوناش» — "maintenance" — so a question about maintenance in another
// group pointed at it) the question is split where the topic starts: "when did {chat} discuss | {topic}", «امتى {chat} اتكلموا عن | {topic}»
const SEP = /\s(?:discuss(?:ed)?|talk(?:ed)?\s+about|say\s+about|said\s+about|mention(?:ed)?|write\s+about|wrote\s+about|اتكلموا\s+عن|اتكلمو\s+عن|اتكلم\s+عن|اتكلموا\s+في|قالوا\s+(?:ايه|إيه)\s+عن|قالوا\s+عن|قال\s+(?:ايه|إيه)\s+عن|جابوا\s+سيرة|kalemo\s+3an|2alo\s+eh\s+3an|2alo\s+3an)\s/i;
export function splitQ(q) { const t = " " + String(q || "") + " ", m = SEP.exec(t); return m ? [t.slice(0, m.index), t.slice(m.index + m[0].length)] : [String(q || ""), ""]; }
/** The chat the question names: { key, chat } or null. chats: [{ key, chat, role }] */
export function chatIn(q0, chats = []) {
  const q = splitQ(q0)[0], t = " " + fold(q) + " ";
  let best = null, score = 0;
  for (const c of chats) {
    const words = fold(c.chat).split(" ").filter((w) => w.length >= 3 && !/^(?:group|chat|جروب)$/.test(w));
    const hit = words.filter((w) => t.includes(" " + w + " ") || t.includes(" " + STRIP(w) + " ") || t.includes(" ال" + w + " ")).length;
    const s = words.length ? hit / words.length + hit * 0.01 : 0;
    if (hit && s > score) { best = c; score = s; }
  }
  if (best) return best;
  const R = [["building", /\b(?:building|residents?|owners?|compound|neighbou?rs?)\b|سكان|السكان|العماره|الكمبوند|الجيران|الملاك/], ["shopping", /\b(?:shopping|groceries|grocery list)\b|الطلبات|طلبات البيت/], ["work", /\b(?:work|site|cranes?)\b|الشغل|الموقع|الاوناش/], ["family", /\bfamily\b|العيله|العيلة/]];
  for (const [role, re] of R) if (re.test(fold(q))) { const c = chats.find((x) => x.role === role); if (c) return c; }
  return null;
}
/** The topic words of the question (without the chat's name and the question words). */
export function topicOf(q0, chat) {
  const [head, tail] = splitQ(q0), q = tail || q0;
  let t = fold(q);
  if (tail) return t.replace(Q_WORDS, " ").split(" ").map(STRIP).filter((w) => w.length >= 2 && !/^\d+$/.test(w)).slice(0, 4);
  for (const w of fold(chat && chat.chat).split(" ")) if (w.length >= 3) t = (" " + t + " ").replace(new RegExp(" (?:ال)?" + w + " ", "g"), " ").trim();
  t = t.replace(/\b(?:address east|owners|residents|building|compound)\b|سكان العماره|سكان|العماره|الكمبوند/g, " ");
  return t.replace(Q_WORDS, " ").split(" ").map(STRIP).filter((w) => w.length >= 2 && !/^\d+$/.test(w)).slice(0, 4);
}
const iso = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/** messagesByChat: { [key]: [{ id, ts, who, text }] } (oldest first or not — sorted here). */
export function askChat(q, chats = [], messagesByChat = {}) {
  const c = chatIn(q, chats); if (!c) return null;
  const all = (messagesByChat[c.key] || []).slice().sort((a, b) => a.ts - b.ts);
  if (c.role === "shopping" && /\b(?:all|everything|what(?:'s| is| are)|list|items)\b|ايه|كل|الطلبات/.test(fold(q)) && topicOf(q, c).length === 0) return { kind: "list", chat: c.chat, key: c.key };
  const words = topicOf(q, c); if (!words.length) return { kind: "chat", chat: c.chat, key: c.key, total: all.length };
  const groups = words.map(forms);
  const used = all.filter((m) => { const t = " " + fold(m.text).split(" ").map(STRIP).join(" ") + " "; return groups.every((g) => g.some((f) => t.includes(" " + f + " ") || f.length >= 4 && t.includes(f))); });
  const days = [];
  for (const m of used) { const d = iso(m.ts); let day = days.find((x) => x.iso === d); if (!day) { day = { iso: d, who: [], n: 0, quote: { who: m.who, text: m.text, id: m.id } }; days.push(day); } day.n++; if (m.who && !day.who.includes(m.who)) day.who.push(m.who); }
  return { kind: "topic", chat: c.chat, key: c.key, topic: words.join(" "), days, ids: used.map((m) => m.id), total: used.length };
}
