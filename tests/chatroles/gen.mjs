// v9.9.40 AP-3 (rule 5 "describe a chat in your own words") — EXACTLY 10,000 descriptions people write about their chats, in
// English, Egyptian Arabic and Franco: a role (shopping list, building, work, family, friends, one person, courier, news, never
// important), sometimes who is in it, sometimes "only if they talk about X, Y or Z", sometimes "or if someone mentions me".
// Truth written HERE: the role, the topics (exactly), and "mentions me".
//     node tests/chatroles/gen.mjs [n]        HELDOUT=1 → wordings written after the code (heldout.mjs)
import fs from "fs";
const R = await import("../../web-src/chatroles.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4343 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 33 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], shuffle = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const ROLE = H ? H.role : {
  shopping: { en: ["our shopping list", "me and Noudy write what ran out at home", "groceries we need to buy", "the list of things to buy"], ar: ["ده جروب أنا ونودي، بنكتب فيه الحاجات اللي خلصت من البيت", "طلبات البيت", "الحاجات اللي ناقصة عشان نجيبها"], fr: ["talabat el beit", "el 7agat elly 5elset"] },
  building: { en: ["the residents' group", "building owners", "our compound group", "neighbours chat"], ar: ["جروب السكان", "اتحاد الملاك", "جروب الكمبوند", "الجيران"], fr: ["gروب el sokkan".replace("g", "g"), "el compound"] },
  work: { en: ["work group", "the cranes site team", "project chat with the client", "office group"], ar: ["جروب الشغل", "جروب الموقع", "المشروع", "الزملاء"], fr: ["el shoghl", "group el mawke3"] },
  family: { en: ["family group", "my parents and cousins"], ar: ["جروب العيلة", "اهلي"], fr: ["group el 3ela"] },
  friends: { en: ["friends from uni", "my gym buddies"], ar: ["الشلة", "صحاب الجامعة"], fr: ["el shella"] },
  courier: { en: ["delivery updates", "the courier"], ar: ["الشحن", "مندوب التوصيل"], fr: [] },
  news: { en: ["news channel", "offers and ads"], ar: ["عروض", "اخبار"], fr: [] },
  quiet: { en: ["spam", "useless group, ignore it", "not important at all"], ar: ["مش مهم خالص", "تجاهله"], fr: ["msh mohem"] },
};
const TOPICS = H ? H.topics : { en: ["maintenance", "fees", "the garage", "water", "electricity", "security", "the elevator", "my crane", "payments", "the gate"], ar: ["الصيانة", "الفلوس", "الجراج", "المية", "الكهربا", "الأمن", "الأسانسير", "البوابة"] };
const CARE = H ? H.care : { en: ["only if they talk about {t}", "tell me only when someone mentions {t}", "it matters only if it's about {t}"], ar: ["مش مهم غير لو اتكلموا عن {t}", "بس لو اتكلموا عن {t}", "قولي لو حد قال {t}"] };
const ME = H ? H.me : { en: ["or if someone mentions me", "or asks me directly"], ar: ["أو لو حد يسألني", "أو لو حد منشن اسمي"] };
const seen = new Set(), bad = {}; let pass = 0, made = 0;
const ROLES = Object.keys(ROLE);
while (made < N) {
  const role = pick(ROLES), lang = pick(["en", "en", "ar", "ar", "fr"]), opts = ROLE[role][lang].length ? ROLE[role][lang] : ROLE[role].en, L = lang === "fr" ? "en" : lang;
  let s = pick(opts), care = [], me = false;
  const canCare = ["building", "work", "family", "friends", "courier", "news"].includes(role);
  if (canCare && rnd() < 0.6) { care = shuffle(TOPICS[L]).slice(0, 1 + Math.floor(rnd() * 3)); const list = L === "ar" ? care.join(" أو ") : care.length === 1 ? care[0] : care.slice(0, -1).join(", ") + " or " + care[care.length - 1]; s += (L === "ar" ? "، " : ", ") + pick(CARE[L]).replace("{t}", list); }
  if (canCare && rnd() < 0.3) { me = true; s += (L === "ar" ? " " : " ") + pick(ME[L]); }
  if (rnd() < 0.2) s = s.charAt(0).toUpperCase() + s.slice(1) + pick([".", "", " 🙏"]);
  if (seen.has(s)) continue; seen.add(s); made++;
  const r = R.readDescription(s);
  const norm = (x) => x.replace(/^(?:the|my|ال)\s*/i, "").replace(/^ال/, "").toLowerCase();
  const wantCare = care.map(norm).sort().join("|"), gotCare = (r.care || []).map(norm).sort().join("|");
  let why = "";
  const wantRole = role === "quiet" && (care.length || me) ? "news" : role;
  if (r.role !== wantRole) why = "role " + (r.role || "none") + " ≠ " + wantRole;
  else if (gotCare !== wantCare) why = "topics «" + gotCare + "» ≠ «" + wantCare + "»";
  else if (r.whenMe !== me) why = "mentions me " + r.whenMe + " ≠ " + me;
  if (why && process.env.DBG && (globalThis.__d = (globalThis.__d || 0) + 1) <= 8) console.log("DBG", s, "→", JSON.stringify(r.care), "want", JSON.stringify(care), r.role, r.whenMe, me);
  if (why) { const k = why.replace(/«[^»]*»/g, "«…»") + " — «" + s.slice(0, 70) + "»"; (bad[k] = bad[k] || []).push(1); } else pass++;
}
const md = `# Chat descriptions — ${N} descriptions, ${pass} understood right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 4000));
if (process.env.SHOW) { for (const s of process.env.SHOW.split("|")) console.log(s, "→", JSON.stringify(R.readDescription(s))); }
