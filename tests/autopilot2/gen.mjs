// v9.9.40 AP-5 — EXACTLY 10,000 conversations (3–8 messages each) in the kinds of chats Ali has: Talabat (his and Noudy's shopping
// list), Address East (building: maintenance / garage / fees matter), the cranes group (work: his crane, or someone asking him),
// the family group (memes; a real ask), Mama (one person), J&T (courier), and a brand-new group nobody has described yet.
// Each message: noise (photo, link, «صباح الخير», ok, 😂…), list items, "got everything", a topic he cares about, his name, a request,
// or chatter. Truth written HERE per message (keep / ask / items / bought / alert / todo). A conversation is right only if every
// message is. The report counts ACTIONS ON NOISE separately — the bar is 0.
//     node tests/autopilot2/gen.mjs [n]     HELDOUT=1 → texts written after the code (heldout.mjs)
import fs from "fs";
const A = await import("../../web-src/autopilot2.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4444 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 11 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const T = H ? H.t : {
  noise: ["📷 Photo", "Sticker", "https://www.facebook.com/share/p/1abc", "صباح الخير 🌹", "ok", "تمام", "😂😂", "Good morning ☀️", "This message was deleted", "🎤 Voice message (0:08)", "جمعة مباركة"],
  items: ["tortilla", "chicken strips", "عيش وجبنة", "milk, eggs and bread", "اللبن خلص", "dish soap", "رز وزيت"],
  bought: ["got everything", "جبت الطلبات", "جبت كل حاجة ما عدا اللبن", "bought the shopping list"],
  topicAE: ["the garage gate is closed till Saturday", "الصيانة هتبدأ بكرة", "fees for December are due", "مين معاه مفتاح الجراج؟"],
  chatAE: ["anyone selling a car?", "the kids are playing downstairs", "who's coming to the iftar?", "شكرا يا جماعة على المساعدة", "فى حد مهتم يشترى شقة"],
  workMe: ["Ali can you check the crane today?", "@Ali the dynamo is ready", "علي ممكن تبعتلي التقرير"],
  workTopic: ["the crane's hydraulic oil leaked", "الونش محتاج صيانة"],
  workChat: ["we finished the site work", "وكده كده ممكن بكرة اجرب جزء الصيانة", "the truck left at 7"],
  ask: ["can you call me when you're free", "ابعتلي الورق بكرة", "please bring bread on your way"],
  chat: ["how was your day", "I'm home", "انا وصلت", "the weather is nice today", "saw Sara today"],
  courier: ["Your parcel is out for delivery", "to expedite your package pay 25 EGP here"],
};
const ME = ["Ali", "علي", "Aly"];
const CHATS = [
  { k: "talabat", title: "Talabat", group: true, role: { role: "shopping", ok: true }, writers: ["Noudy", "نودي"] },
  { k: "ae", title: "Address East Owners", group: true, role: { role: "building", ok: true, care: ["garage", "maintenance", "fees", "الجراج", "الصيانة"] }, writers: ["Dr Hazem Wagdy", "Rowan Soliman", "~Mona"] },
  { k: "cranes", title: "صيانة الاوناش في الضبعة", group: true, role: { role: "work", ok: true, care: ["crane", "الونش"], whenMe: true }, writers: ["M. Mohamed Sayed Depak", "Ahmed Abd El Mo8ees"] },
  { k: "family", title: "Family ❤️", group: true, role: { role: "family", ok: true }, writers: ["Ahmed", "Mama", "Sara"] },
  { k: "mama", title: "Mama", group: false, role: { role: "person", ok: true } },
  { k: "new", title: "Gym buddies", group: true, role: null, writers: ["Karim", "Omar"] },
  { k: "draft", title: "Emerald Park Owners", group: true, role: { role: "building", ok: false }, writers: ["~Dr/ghada Kotb"] },
];
const truthOf = (ch, kind) => {
  if (kind === "noise") return "keep";
  if (!ch.role) return "ask";
  if (!ch.role.ok) return "keep";
  return { items: "items", bought: "bought", topicAE: "alert", workMe: "alert", workTopic: "alert", ask: ch.group ? "keep" : "todo" }[kind] || "keep";
};
const KINDS = { talabat: ["noise", "items", "items", "bought", "chat"], ae: ["noise", "noise", "topicAE", "chatAE", "chatAE", "ask"], cranes: ["noise", "workMe", "workTopic", "workChat", "ask"], family: ["noise", "noise", "chat", "ask"], mama: ["noise", "ask", "chat"], new: ["noise", "chat", "ask"], draft: ["noise", "topicAE", "chatAE"] };
const textOf = (kind) => pick(T[kind === "chatAE" || kind === "topicAE" || kind === "workMe" || kind === "workTopic" || kind === "workChat" ? kind : kind === "items" || kind === "bought" || kind === "ask" || kind === "noise" || kind === "courier" ? kind : "chat"]);
const seen = new Set(), bad = {}; let pass = 0, made = 0, noiseActs = 0, msgs = 0;
while (made < N) {
  const ch = pick(CHATS), len = 3 + Math.floor(rnd() * 6), convo = [];
  for (let i = 0; i < len; i++) { const kind = pick(KINDS[ch.k]); convo.push({ kind, text: textOf(kind), who: ch.group ? pick(ch.writers) : ch.title }); }
  const key = ch.k + convo.map((x) => x.text).join("|"); if (seen.has(key)) continue; seen.add(key); made++;
  const roles = ch.role ? { ["whatsapp|" + (ch.group ? "g:" : "p:") + ch.title.toLowerCase()]: ch.role } : {};
  let ok = true, why = "";
  for (const m of convo) {
    msgs++;
    const n = ch.group ? { app: "WhatsApp", pkg: "com.whatsapp", title: ch.title, text: m.text, group: true, convo: ch.title, who: m.who.replace(/^~/, "") } : { app: "WhatsApp", pkg: "com.whatsapp", title: ch.title, text: m.text };
    const d = A.decide(n, { roles, me: ME, list: ["لبن", "تورتيا", "عيش", "chicken strips", "milk", "eggs"] });
    const want = truthOf(ch, m.kind), got = d ? d.kind : "none";
    if (m.kind === "noise" && got !== "keep") noiseActs++;
    if (got !== want || !d || !d.from || !d.why) { ok = false; why = why || ch.k + " · " + m.kind + ": " + got + " ≠ " + want + " «" + m.text.slice(0, 40) + "»"; }
  }
  if (ok) pass++; else (bad[why] = bad[why] || []).push(1);
}
const md = `# New Autopilot — ${N} conversations (${msgs} messages), ${pass} fully right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n**Actions on noise: ${noiseActs}** (the bar: 0)\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 3500));
