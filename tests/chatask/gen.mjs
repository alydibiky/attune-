// v9.9.40 AP-6 (K5) — EXACTLY 10,000 questions about a chat, each over its own made-up history (15–60 messages in 30 days): the
// topic comes up on chosen days by chosen people, written in English or Arabic forms («الجراج», "parking", "the garage"), among other
// topics; the question names the chat its own way ("address east", "the building group", «سكان العمارة», "el talabat") and the
// topic in another form or language. Truth written HERE: the chat, every day it came up, and how many messages.
//     node tests/chatask/gen.mjs [n]      HELDOUT=1 → wordings written after the code (heldout.mjs)
import fs from "fs";
const Q = await import("../../web-src/chatask.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4545 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 22 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const CHATS = [{ key: "wa|g:ae", chat: "🏠ADDRESS EAST OWNERS 🏠", role: "building" }, { key: "wa|g:talabat", chat: "Talabat", role: "shopping" }, { key: "wa|g:cranes", chat: "صيانة الاوناش في الضبعة", role: "work" }, { key: "wa|g:fam", chat: "Family ❤️", role: "family" }];
const NAMES = { "wa|g:ae": H ? H.aeNames : ["address east", "Address East", "the building group", "سكان العمارة", "ادرس ايست".replace("ادرس ايست", "address east")], "wa|g:talabat": ["talabat", "el talabat", "Talabat"], "wa|g:cranes": H ? H.crNames : ["the cranes group", "صيانة الاوناش", "الاوناش"], "wa|g:fam": ["family", "the family group", "العيلة"] };
const TOPICS = H ? H.topics : [
  { ask: ["the garage", "garage", "الجراج", "parking"], say: ["the garage door is stuck", "الجراج مقفول النهارده", "no parking in the garage tomorrow", "مين راكن في الجراج مكاني؟", "parking spots are full"] },
  { ask: ["maintenance", "الصيانة"], say: ["maintenance starts Monday", "الصيانة هتبدأ يوم الاتنين", "who paid the maintenance?", "فلوس الصيانة اتجمعت"] },
  { ask: ["the elevator", "lift", "الاسانسير"], say: ["the elevator is broken again", "الاسانسير واقف", "lift fixed finally"] },
  { ask: ["water", "المية"], say: ["no water till 5", "المية قاطعة", "water tank cleaning Friday"] },
  { ask: ["milk", "اللبن"], say: ["milk", "اللبن خلص", "get the milk pls"] },
  { ask: ["the crane", "الونش"], say: ["the crane's oil leaked", "الونش عطلان", "crane 2 is ready"] },
];
const OTHER = ["good morning", "who's coming tonight?", "thanks everyone", "the kids are downstairs", "مبروك", "anyone has a plumber?", "تمام", "the meeting is at 8", "the pool opens Sunday"];
const QT = H ? H.qt : { en: ["when did {c} discuss {t}?", "when did {c} talk about {t}", "what did {c} say about {t}?"], ar: ["امتى {c} اتكلموا عن {t}؟", "{c} قالوا ايه عن {t}؟"], fr: ["emta {c} kalemo 3an {t}"] };
const WHO = ["Dr Hazem Wagdy", "Rowan Soliman", "Mona", "Noudy", "M. Mohamed Sayed", "Karim"];
const seen = new Set(), bad = {}; let pass = 0, made = 0;
while (made < N) {
  const c = pick(CHATS), tp = pick(TOPICS), start = Date.parse("2026-10-15T09:00:00"), days = new Set(), msgs = [];
  const k = int(1, 4); while (days.size < k) days.add(int(0, 29));
  let id = 0, want = 0; const wantDays = new Set();
  for (let d = 0; d < 30; d++) {
    const n = int(0, 3);
    for (let i = 0; i < n; i++) msgs.push({ id: "m" + id++, ts: start + d * 864e5 + int(0, 600) * 60000, who: pick(WHO), text: pick(OTHER) });
    if (days.has(d)) { const m = int(1, 3); for (let i = 0; i < m; i++) { msgs.push({ id: "m" + id++, ts: start + d * 864e5 + int(0, 600) * 60000, who: pick(WHO), text: pick(tp.say) }); want++; }
      const dt = new Date(start + d * 864e5); wantDays.add(dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0")); }
  }
  const lang = pick(["en", "en", "ar", "fr"]), q = pick(QT[lang]).replace("{c}", pick(NAMES[c.key])).replace("{t}", pick(tp.ask));
  const key = q + "|" + [...days].join(); if (seen.has(key)) continue; seen.add(key); made++;
  const r = Q.askChat(q, CHATS, { [c.key]: msgs });
  let why = "";
  if (!r) why = "no chat found";
  else if (r.key !== c.key) why = "wrong chat " + r.chat;
  else if (r.kind !== "topic") why = "read as " + r.kind;
  else if (r.total !== want) why = r.total + " messages ≠ " + want;
  else if (r.days.map((x) => x.iso).sort().join() !== [...wantDays].sort().join()) why = "days ≠";
  if (why) { const kk = why + " — «" + q + "»"; (bad[kk] = bad[kk] || []).push(1); } else pass++;
}
const md = `# Asking about a chat — ${N} questions, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 4000));
