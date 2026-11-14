// v9.9.40 AP-1 — EXACTLY 10,000 WhatsApp export files in the formats people's phones write (Android EN 24h/12h, US month-first,
// iPhone [brackets] with seconds, Android in Arabic with Arabic digits, «،» and «ص/م» between direction marks, German dots,
// year-first, Persian digits), 2–40 messages each: multi-line messages, media, deleted messages, system lines, names in Arabic,
// English, Franco and with ~ — and the truth written HERE (author, text, date, time, kind of every message).
// The country tells the reader day-first or month-first only when every date in the file fits both (Attune knows the country).
//     node tests/waexport/gen.mjs [n]          HELDOUT=1 → formats / names / texts written after the reader (heldout.mjs)
import fs from "fs";
const W = await import("../../web-src/waexport.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4040 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 99 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const AR = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]), FA = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const p2 = (n) => String(n).padStart(2, "0");
const NAMES = H ? H.names : ["Noudy", "Ali", "Ahmed Salah", "Dr Hazem Wagdy (Admin , Address East)", "M. Mohamed Sayed Depak", "نودي", "أحمد", "ماما", "Rowan Soliman", "+20 100 223 4455", "Sara 🌸", "Omar.K"];
const TEXTS = H ? H.texts : ["tortilla", "chicken strips", "بيض", "عيش وجبنة", "ok", "Can you call me: it's urgent", "the meeting is at 10:30 - room 4", "eb3atly el location", "😂😂", "https://facebook.com/share/abc", "Time: 9:00, place: gate 2", "لازم ندفع الصيانة: ٥٠٠ جنيه", "Good morning ☀️", "yes: I'll bring it"];
const FMT = H ? H.fmts : ["en24", "en12", "us", "ios", "ar", "ar-latin", "de", "ymd", "fa"];
const seen = new Set(), bad = {}; let pass = 0, made = 0;
function line(fmt, d, author, text) {
  const D = d.getDate(), M = d.getMonth() + 1, Y = d.getFullYear(), h = d.getHours(), m = d.getMinutes(), s = d.getSeconds(), h12 = h % 12 || 12, ap = h < 12 ? "AM" : "PM";
  const who = author === null ? "" : author + ": ";
  switch (fmt) {
    case "en24": return `${p2(D)}/${p2(M)}/${Y}, ${p2(h)}:${p2(m)} - ${who}${text}`;
    case "en12": return `${p2(D)}/${p2(M)}/${Y}, ${h12}:${p2(m)} ${ap.toLowerCase()} - ${who}${text}`;
    case "us": return `${M}/${D}/${String(Y).slice(2)}, ${h12}:${p2(m)} ${ap} - ${who}${text}`;
    case "ios": return `${author !== null && /omitted/.test(text) ? "‎" : ""}[${p2(D)}/${p2(M)}/${Y}, ${p2(h)}:${p2(m)}:${p2(s)}] ${who}${text}`;
    case "ar": return `${AR(D)}‏/${AR(M)}‏/${AR(Y)}، ${AR(h12)}:${AR(p2(m))} ${h < 12 ? "ص" : "م"} - ${who}${text}`;
    case "ar-latin": return `${D}/${M}/${Y}، ${h12}:${p2(m)} ${h < 12 ? "ص" : "م"} - ${who}${text}`;
    case "de": return `${p2(D)}.${p2(M)}.${String(Y).slice(2)}, ${p2(h)}:${p2(m)} - ${who}${text}`;
    case "ymd": return `${Y}-${p2(M)}-${p2(D)} ${p2(h)}:${p2(m)} - ${who}${text}`;
    case "fa": return `${FA(D)}/${FA(M)}/${FA(Y)}، ${FA(p2(h))}:${FA(p2(m))} - ${who}${text}`;
    case "en24dash": return `${p2(D)}-${p2(M)}-${Y} ${p2(h)}:${p2(m)} - ${who}${text}`;
    case "ios12": return `[${D}/${M}/${String(Y).slice(2)}, ${h12}:${p2(m)}:${p2(s)} ${ap}] ${who}${text}`;
    case "arsec": return `${AR(D)}/${AR(M)}/${AR(Y)}، ${AR(h12)}:${AR(p2(m))}:${AR(p2(s))} ${h < 12 ? "صباحًا" : "مساءً"} - ${who}${text}`;
  }
}
const withSec = (f) => f === "ios" || f === "ios12" || f === "arsec";
while (made < N) {
  const fmt = pick(FMT), n = int(2, 40), msgs = []; let t = new Date(2024 + int(0, 2), int(0, 11), int(1, 28), int(0, 23), int(0, 59), int(0, 59)).getTime();
  for (let i = 0; i < n; i++) {
    t += int(1, 3 * 86400) * 1000; const d = new Date(t); if (!withSec(fmt)) d.setSeconds(0, 0); else d.setMilliseconds(0);
    const r = rnd(); let author = pick(NAMES), text = pick(TEXTS), kind = "text";
    if (r < 0.06) { author = null; text = pick(["Messages and calls are end-to-end encrypted. No one outside of this chat can read them.", "Noudy added Ali", "الرسائل والمكالمات مشفرة تمامًا", "You created group “Talabat”"]); kind = "system"; }
    else if (r < 0.14) { text = pick(fmt.startsWith("ios") ? ["image omitted", "sticker omitted", "audio omitted"] : fmt.startsWith("ar") ? ["<تم استبعاد الوسائط>"] : ["<Media omitted>"]); kind = "media"; }
    else if (r < 0.18) { text = pick(fmt.startsWith("ar") ? ["تم حذف هذه الرسالة"] : ["This message was deleted"]); kind = "deleted"; }
    else if (r < 0.30) text = text + "\n" + pick(TEXTS) + (rnd() < 0.3 ? "\n" + pick(TEXTS) : "");
    msgs.push({ d, author, text, kind });
  }
  const fileName = pick(["WhatsApp Chat with Talabat.txt", "محادثة واتساب مع Talabat.txt", "WhatsApp Chat - Address East Owners.txt", "_chat.txt"]);
  const body = msgs.map((x) => line(fmt, x.d, x.author, x.text)).join(pick(["\n", "\r\n"]));
  const key = body.slice(0, 400) + fmt; if (seen.has(key)) continue; seen.add(key); made++;
  const both = msgs.every((x) => x.d.getDate() <= 12);
  const r = W.readExport((rnd() < 0.2 ? "﻿" : "") + body, { fileName, dayFirst: both ? !(fmt === "us") : undefined });
  let why = "";
  if (r.messages.length !== msgs.length) why = fmt + ": " + r.messages.length + " messages read, " + msgs.length + " written";
  else for (let i = 0; i < msgs.length && !why; i++) {
    const a = r.messages[i], b = msgs[i];
    if (a.ts !== b.d.getTime()) why = fmt + ": time " + new Date(a.ts).toISOString() + " ≠ " + b.d.toISOString();
    else if (a.kind !== b.kind) why = fmt + ": kind " + a.kind + " ≠ " + b.kind + " «" + b.text.slice(0, 30) + "»";
    else if ((a.author || null) !== (b.author === null ? null : b.author.replace(/^~\s?/, ""))) why = fmt + ": author «" + a.author + "» ≠ «" + b.author + "»";
    else if (a.text !== b.text.trim()) why = fmt + ": text «" + a.text.slice(0, 40) + "» ≠ «" + b.text.slice(0, 40) + "»";
  }
  if (!why && fileName !== "_chat.txt" && r.chat !== fileName.replace(/^.*(?:with|-|مع)\s*/, "").replace(/\.txt$/, "")) why = "chat name «" + r.chat + "»";
  if (why) { const k = why.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "T").slice(0, 90); (bad[k] = bad[k] || []).push(body.split("\n")[0].slice(0, 80)); } else pass++;
}
const md = `# WhatsApp export reader — ${N} files, ${pass} read exactly (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}: ${v.slice(0, 2).join(" · ")}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 3000));
