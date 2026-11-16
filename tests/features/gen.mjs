// v10.1 F1 + F3 (Ali, 16 Nov 2026: "a lot of features we added in bulk — I don't know how to find each one") — EXACTLY 10,000
// questions to the Home box, each with the truth written HERE:
//   · "where is / how do I / فين / ازاي / fen …" + a feature said its own way (its name, a word people use, Arabic, Franco, or its name
//     in the app's language: French, Spanish, German, Turkish) → THAT feature (and its place);
//   · a question about a thing you own or put somewhere ("where is my passport?", «حطيت المفاتيح فين») → nothing (Mind answers it);
//   · a sentence that is not a question about the app ("spent 200 on lunch", "remind me at 5") → nothing.
//     node tests/features/gen.mjs [n]      HELDOUT=1 → other wordings written after the code (heldout.mjs)
import fs from "fs";
const F = await import("../../web-src/features.js");
const H = process.env.HELDOUT ? (await import(process.env.HELDOUT === "2" ? "./heldout2.mjs" : "./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 9393 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 61 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const LANGS = {};
for (const l of ["fr", "es", "de", "tr", "pt", "it", "ru", "id", "ja", "zh", "ko", "th"]) { const src = fs.readFileSync(new URL("../../web-src/i18n-" + l + ".js", import.meta.url), "utf8"); const d = {};
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) d[JSON.parse('"' + m[1] + '"')] = JSON.parse('"' + m[2] + '"'); LANGS[l] = d; }
// how people name each feature (never a word two features share)
const SAY = H ? H.say : {
  habits: ["habits", "my habits", "the habit tracker", "العادات", "3adat"], countdowns: ["countdowns", "the countdown", "العد التنازلي"], braindump: ["organise this", "the brain dump", "رتبلي افكاري"],
  focus: ["the focus timer", "focus", "pomodoro", "التايمر"], missions: ["missions", "my goals", "الاهداف"], recall: ["recall", "search my screenshots"], lists: ["my lists", "to-dos", "the checklist", "الليسته"],
  weekplan: ["week plan", "plan my week", "خطة الاسبوع"], tables: ["tables", "the tables"], money: ["money", "my spending", "الفلوس"], planner: ["month plan", "the monthly budget", "خطة الشهر"],
  salary: ["salary plan", "my salary", "المرتب"], split: ["split a bill", "split with friends", "settle up", "قسم الحساب"], automations: ["automations", "rules", "automation"],
  aijobs: ["ai jobs", "night jobs"], donelog: ["done for you", "what attune did by itself", "the undo log"], deal: ["deal check"], timeline: ["follow-ups", "the follow ups", "المتابعات"],
  things: ["warranty", "my receipts", "things I own", "الضمان", "الفواتير", "my things"], life: ["debts", "installments", "the installment plans", "الاقساط", "الديون"], reminders: ["reminders", "my alarms", "التذكيرات"],
  radar: ["deadline radar", "expiry dates", "the passport expiry", "the bank card scan"], errands: ["errands", "my fines", "car licence renewal"], upkeep: ["upkeep", "car service", "الصيانه"],
  guardian: ["money guardian", "scam check", "double charges"], care: ["family health", "medicines", "lab results", "الادويه"], emergency: ["emergency card", "blood type", "الطوارئ"],
  school: ["kids and school", "the class group", "المدرسه"], family: ["family", "العيله"], agents: ["agents", "price watch", "the cheapest price agent"], messages: ["scheduled messages", "auto reply", "send a message later"],
  booklib: ["documents", "my book library", "the library"], people: ["people", "my contacts", "الناس"], keepintouch: ["keep in touch"], occasions: ["birthdays", "occasions", "اعياد الميلاد"], memory: ["mind", "my notes"],
  groups: ["whatsapp groups", "exported chats"], projects: ["projects", "my project", "المشاريع"], travel: ["travel", "my trips", "flight day", "السفر"], map: ["maps", "the map"], metro: ["metro", "المترو"],
  coach: ["homework coach", "homework"], learn: ["learn daily", "the daily lesson"], translate: ["translate", "the translator", "الترجمه"], convert: ["file converter", "pdf to word"], write: ["writing", "rewrite my email"],
  setup: ["set up your life", "setup"], sync: ["sync", "sync with my laptop", "the computer sync", "المزامنه"], backup: ["backup", "restore"], settings: ["settings", "the language", "الاعدادات"], privacy: ["privacy", "the lock"], guide: ["how to use attune"],
};
const EN = H ? H.en : ["where is {x}?", "where are {x}", "where can I find {x}", "how do I open {x}", "find {x}", "where's {x}", "how do i get to {x}", "is there {x}?"];
const AR = H ? H.ar : ["فين {x}؟", "{x} فين", "الاقي {x} فين", "ازاي افتح {x}", "عايز {x} فين"];
const FR = H ? H.fr : ["fen {x}", "{x} fen", "ezay efta7 {x}", "fein {x}"];
const LOC = H ? H.loc : { fr: ["où est {x} ?", "où trouver {x}"], es: ["¿dónde está {x}?", "dónde encuentro {x}"], de: ["wo ist {x}?", "wo finde ich {x}"], tr: ["{x} nerede?", "{x} nerede bulurum"] };
const NOT = H ? H.not : ["where is my passport?", "where did I put my keys", "where did i leave the car keys", "حطيت المفاتيح فين", "where is my wallet", "spent 200 on lunch", "remind me at 5 to call mom",
  "how much did I spend this month", "Ahmed owes me 500", "what's the weather", "call Sara", "who is Hany", "where did I park"];
const fold = (s) => String(s || "").toLowerCase();
const bad = {}; let pass = 0, made = 0, offered = 0; const seen = new Set();
const ids = Object.keys(SAY).filter((id) => F.FEATURES.some((f) => f.id === id));
while (made < N) {
  const kind = rnd() < 0.12 ? "not" : pick(["en", "en", "ar", "fr", "loc"]);
  let q = "", want = null, lang = "en";
  if (kind === "not") q = pick(NOT) + pick(["", " ", "?"]);
  else {
    const id = pick(ids), f = F.FEATURES.find((x) => x.id === id); want = id;
    if (kind === "loc") { lang = pick(Object.keys(LOC)); const name = LANGS[lang][f.name]; if (!name) continue; q = pick(LOC[lang]).replace("{x}", name); }
    else { const phrases = SAY[id].filter((p) => (kind === "ar" ? /[؀-ۿ]/.test(p) : !/[؀-ۿ]/.test(p))); if (!phrases.length) continue; q = pick(kind === "en" ? EN : kind === "ar" ? AR : FR).replace("{x}", pick(phrases)); }
  }
  if (seen.has(q + "|" + lang) && made > 3000 && rnd() < 0.7) continue; seen.add(q + "|" + lang); made++;
  const t = lang === "en" ? (s) => s : (s) => LANGS[lang][s] || s;
  // F3 answers with ONE feature when sure, else 2–3 to tap: right = the sure one is it, or it is among the ones offered; "not about the
  // app" must get nothing at all (no answer, no options)
  const r = F.whereAsk(q, t), got = r && r.f ? r.f.id : r && r.options ? (r.options.find((o) => o.id === want) || r.options[0]).id : null;
  if (r && r.options) offered++;
  // two features that open the same page are the same answer (Upkeep is inside Errands; Emergency inside Health)
  const same = got && want && (got === want || (F.FEATURES.find((x) => x.id === got).open === F.FEATURES.find((x) => x.id === want).open && F.placeLine(F.FEATURES.find((x) => x.id === got)) === F.placeLine(F.FEATURES.find((x) => x.id === want))));
  const why = !want ? (got ? "answered a question that isn't about the app → " + got : "") : !got ? "found nothing for " + want : !same ? "found " + got + " instead of " + want : "";
  if (why) (bad[why.replace(/ → .*/, " → …") + " · " + kind] = bad[why.replace(/ → .*/, " → …") + " · " + kind] || []).push(q + (got ? " → " + got : "")); else pass++;
}
const md = `# Finding a feature (F1 + F3) — ${N} questions, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""} · ${offered} answered with 2–3 to tap\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length} — e.g. ${[...new Set(v)].slice(0, 3).join(" | ")}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? (process.env.HELDOUT === "2" ? "./report-heldout2.md" : "./report-heldout.md") : "./report.md", import.meta.url), md);
console.log(md.slice(0, 6000));
