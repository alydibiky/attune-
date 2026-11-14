// v9.9.39 (Ali's phone, 14 Nov: group posts, «ممكن», «لا حول ولا قوة» and Scout's alerts were to-dos) — EXACTLY 10,000 chat
// notifications: a person or a group (the two ways WhatsApp / Telegram write a group: "Group: Sender" in the title, or "~Sender: …"
// in the text), a request or not (EN / Egyptian / Franco; "maybe", sayings, news, plans, thanks), sometimes an @-mention, sometimes the
// same message twice. Truth written HERE: a to-do only when ONE person asks YOU (or a group post @-mentions someone), and twice = once.
//     node tests/todojunk/gen.mjs [n]          HELDOUT=1 → the held-out phrasings (heldout.mjs)
import fs from "fs";
const A = await import("../../web-src/autopilot.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 9939 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 555 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PEOPLE = ["Ahmed Salah", "Mama", "Sara", "Omar Khaled", "Dr Hazem Wagdy", "Rowan Soliman", "M. Mohamed Sayed", "Noudy", "Youssef 0100 223 4455", "أحمد صلاح", "ماما", "عم سيد", "Mariam (Work)", "Karim"];
const GROUPS = ["🏠ADDRESS EAST MARKETPLACE", "ADDRESS EAST OWNERS 🏠", "صيانة الاوناش في الضبعة", "Talabat", "Family ❤️", "Work team", "Gym buddies", "شلة الجامعة", "Building 12 residents", "Class of 2015"];
const ASK = H ? H.ask : [
  "please send me the papers", "can you bring bread on your way", "pay the electricity today pls", "call me when you're free", "could you pick up Lina at 5", "transfer 500 to me please", "don't forget the keys",
  "ابعتلي الورق بكرة", "ممكن تبعتلي العنوان", "هات عيش وانت جاي", "كلمني ضروري", "اتصل بيا لما تفضى", "حول لي ٥٠٠ النهارده", "ادفع الكهربا", "متنساش المفاتيح", "لو سمحت ابعت الملف", "ممكن تجيب الدوا",
  "eb3atly el wara2 bokra", "kalemny darory", "please remind Sara about Friday"];
const NOT = H ? H.not : [
  "وكده كده ممكن بكرة اجرب جزء الصيانة", "ممكن نتأخر شوية النهارده", "ممكن يكون الجو حلو بكرة", "لا حول و لا قوة إلا بالله", "لا حول ولا قوة الا بالله حضرتك توجهي", "صباح الخير يا جماعة", "فى حد مهتم يشترى شقة",
  "see you tomorrow", "thanks for calling", "I'll send it tonight", "I sent the money", "the meeting went well", "happy birthday!!", "ok", "haha 😂", "good morning everyone", "Noudy requested a tortilla", "maybe we go Friday",
  "انا في الطريق", "تمام", "هبعتلك بالليل", "الحمد لله", "مبروك", "who is coming tonight?", "nice photo", "15.11 day"];
const seen = new Set(), bad = {}; let pass = 0, made = 0;
const done = new Set();   // the keys already made into to-dos — "twice = once"
while (made < N) {
  const group = rnd() < 0.5, ask = rnd() < 0.5, mention = group && ask && rnd() < 0.2, who = pick(PEOPLE), g = pick(GROUPS);
  let body = ask ? pick(ASK) : pick(NOT); if (mention) body = "@" + pick(["Ali", "Aly", "Ahmed"]) + " " + body;
  const style = group ? pick(["title", "title", "tilde-title", "tilde-text"]) : "person";
  const title = style === "title" ? g + ": " + who : style === "tilde-title" ? g + ": ~" + who.replace(/\s*\d.*$/, "") : style === "tilde-text" ? g : who + (rnd() < 0.2 ? " (2 messages)" : "");
  const text = style === "tilde-text" ? "~" + who.replace(/\s*\d.*$/, "").replace(/\s*\(.*$/, "") + ": " + body : body;
  const app = pick([["WhatsApp", "com.whatsapp"], ["WhatsApp Business", "com.whatsapp.w4b"], ["Telegram", "org.telegram.messenger"]]);
  const id = "k" + made, k = app[0] + "|" + title + "|" + text; if (seen.has(k)) continue; seen.add(k); made++;
  const twice = rnd() < 0.15;
  const n1 = { id, app: app[0], pkg: app[1], title, text, ts: Date.parse("2026-11-14T10:00:00") }, now = Date.parse("2026-11-14T12:00:00");
  const want = ask && (!group || mention);
  const x = A.suggestFrom(n1, { now }), got = !!(x && x.kind === "todo");
  let why = "";
  if (got !== want) why = (want ? "missed: " : "made a to-do: ") + (group ? "group" + (mention ? "+@" : "") : "person") + " · " + (ask ? "ask" : "not") + " · " + body.slice(0, 40);
  else if (got && twice) { const y = A.suggestFrom({ ...n1, id: id + "b", title: title.replace(/ \(2 messages\)$/, "") + " (2 messages)" }, { now }); if (!y || y.key !== x.key) why = "twice = two to-dos · " + body.slice(0, 30); }
  if (why) (bad[why] = bad[why] || []).push(title + " | " + text); else pass++;
}
const md = `# Chat to-dos — ${N} notifications, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT phrasings" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `- **${k}** × ${v.length}: ${v.slice(0, 2).join(" · ")}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 3000));
