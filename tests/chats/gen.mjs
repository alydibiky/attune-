// v9.9.40 AP-2 — EXACTLY 10,000 chat notifications: a person or a group (every shape WhatsApp / Telegram write, with and without
// the phone's own fields), a real message or noise (photo, sticker, voice note, a Facebook / YouTube link, "good morning",
// «صباح الخير», "ok", «تمام», 😂, a reaction, a deleted message, a forward), names in English, Arabic, Franco, with ~ and numbers.
// Truth written HERE: the chat, the writer, group or not, and noise or not (and which kind).
//     node tests/chats/gen.mjs [n]          HELDOUT=1 → shapes / names / texts written after the code (heldout.mjs)
import fs from "fs";
const C = await import("../../web-src/chats.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4141 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 77 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const PEOPLE = H ? H.people : ["Noudy", "Mama", "Ahmed Salah", "Sara 🌸", "نودي", "ماما", "أحمد صلاح", "Dr Hazem Wagdy", "M. Mohamed Sayed Depak", "Rowan Soliman", "+20 100 223 4455", "Omar.K", "Karim (work)"];
const GROUPS = H ? H.groups : ["Talabat", "Address East Owners", "🏠ADDRESS EAST MARKETPLACE", "صيانة الاوناش في الضبعة", "Emerald Park Owners", "Family ❤️", "Dibiki Dabaa", "Gym buddies", "شلة الجامعة"];
const REAL = H ? H.real : ["tortilla", "chicken strips", "can you call me", "the meeting is at 5", "بكرة الساعة ٩ عند الجراج", "eb3atly el location", "the garage gate is closed till Saturday", "send me the invoice please", "اللبن خلص", "who has the key?", "I paid the maintenance 500", "خلي بالك الكهربا هتقطع بكرة"];
const NOISE = H ? H.noise : [["📷 Photo", "media"], ["Sticker", "media"], ["🎤 Voice message (0:12)", "media"], ["GIF", "media"], ["صورة", "media"], ["https://www.facebook.com/share/p/1abc", "link"], ["check this https://youtu.be/xyz 😂", "link"], ["Good morning ☀️", "greeting"], ["صباح الخير 🌹", "greeting"], ["جمعة مباركة", "greeting"], ["sabah el fol", "greeting"], ["ok", "ack"], ["تمام", "ack"], ["👍", "emoji"], ["😂😂😂", "emoji"], ["haha", "ack"], ["هههههه", "ack"], ["This message was deleted", "deleted"], ["Reacted ❤️ to \"tortilla\"", "reaction"], ["Forwarded", "forward"], ["3 new messages from 2 chats", "summary"]];
const LOOKS_GROUP = H ? H.looks : ["Note: the gas man comes at 2", "Time: 9:00 at the club", "العنوان: التجمع الخامس", "Price: 450 EGP", "Reminder: pay the internet", "Tomorrow: dentist at 4"];
const APPS = [["WhatsApp", "com.whatsapp"], ["WhatsApp Business", "com.whatsapp.w4b"], ["Telegram", "org.telegram.messenger"]];
const seen = new Set(), bad = {}; let pass = 0, made = 0;
while (made < N) {
  const [app, pkg] = pick(APPS), group = rnd() < 0.55, who = pick(PEOPLE), chat = group ? pick(GROUPS) : who, r = rnd();
  let text, noise = null;
  if (r < 0.45) { const x = pick(NOISE); text = x[0]; noise = x[1]; } else if (!group && r < 0.55) text = pick(LOOKS_GROUP); else text = pick(REAL);
  const plainWho = who.replace(/^~\s?/, ""), nonContact = group && rnd() < 0.25;
  let n, shape;
  if (rnd() < 0.3) { shape = "phone"; n = { app, pkg, title: group ? chat : who, text, group, convo: group ? chat : "", who: plainWho }; }
  else if (!group) { shape = "person"; n = { app, pkg, title: who + (rnd() < 0.2 ? " (" + (2 + Math.floor(rnd() * 5)) + " messages)" : ""), text }; }
  else { shape = pick(["text", "title", "at", "tilde"]); const w = nonContact ? "~" + (rnd() < 0.5 ? "" : " ") + plainWho : plainWho;
    n = shape === "text" ? { app, pkg, title: chat + (rnd() < 0.2 ? " (3 messages)" : ""), text: w + ": " + text } : shape === "title" || shape === "tilde" ? { app, pkg, title: chat + ": " + (shape === "tilde" ? "~ " + plainWho : w), text } : { app, pkg, title: plainWho + " @ " + chat, text }; }
  const key = JSON.stringify(n); if (seen.has(key)) continue; seen.add(key); made++;
  const got = C.chatOf(n), nz = C.noiseOf(got ? got.text : text);
  let why = "";
  if (!got) why = shape + ": not read as a chat";
  else if (got.group !== group) why = shape + ": " + (group ? "a group read as one person" : "one person read as a group") + " — «" + (n.title + " | " + n.text).slice(0, 50) + "»";
  else if (got.chat !== chat) why = shape + ": chat «" + got.chat + "» ≠ «" + chat + "»";
  else if (group && got.who !== plainWho) why = shape + ": writer «" + got.who + "» ≠ «" + plainWho + "»";
  else if (got.text !== text) why = shape + ": text «" + got.text + "» ≠ «" + text + "»";
  else if (nz !== noise) why = (noise ? "noise “" + noise + "” read as " + (nz || "a real message") : "a real message read as noise “" + nz + "”") + " — «" + text + "»";
  if (why) (bad[why] = bad[why] || []).push(app); else pass++;
}
const md = `# Chats — ${N} notifications, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 3500));
