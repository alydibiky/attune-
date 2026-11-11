/* ---- v9.9.3 Teach Attune (Ali picked L1–L4, 9 Nov 2026: "talk to notifications and teach the app — a Life360 notification says
   Y arrived at X; I tell it Y is my wife and it learns"; "make it really smart so it understands everything I write … it chats with
   me to understand what I mean and take the approval measures"; "integrate L2 / L3 with the others").
   One brain for what you teach, used everywhere (Recall, Home, Chat, voice):
     readTeach(text, ctx)  → what a sentence teaches, or a question back when it is not clear:
        { kind: "who", name, role }        "Nada is my wife" · «نادا مراتي» · "she is my wife" (ctx.name = the notification's person)
        { kind: "rule", rule }              "tell me when my wife gets home" · "never show Yazio" · "put the maid first"
        { kind: "ask", q, choices }         not sure — Attune asks (which name? what do you mean?) instead of saving a guess
     The person is saved on their People card (entities.js, role) — the same card "Which Ahmed?" and Chat use. A rule that needs
     the phone to watch (an arrival) becomes a phone alert (watch.js → WatchMatch.kt, works with Attune closed).
   whoAsk(notes, dir, st) → a name you see often and never told Attune about ("Who is Nada?") — asked once (L3).
   describe(note, dir) → "Your wife (Nada) completed a 13 km drive" (L4); whereIs(q, notes, dir) → Chat's answer.
   Nothing is saved without the person's OK (the screens show "I understood: …" first). Pure; tests: tests/unit/v993noteteach.test.mjs. */
import { fold as foldE, mentions, addCard } from "./entities.js";

export const TEACH_KEY = "attune:noteteach:v1";
export const emptyTeach = () => ({ v: 1, rules: [], asked: [], skip: [] });
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export function loadTeach(st = ls()) { try { return { ...emptyTeach(), ...JSON.parse((st && st.getItem(TEACH_KEY)) || "{}") }; } catch (e) { return emptyTeach(); } }
export function saveTeach(t, st = ls()) { try { st && st.setItem(TEACH_KEY, JSON.stringify(t)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("attune-noteteach")); } catch (e) {} return t; }

const f = (s) => foldE(s).trim();
// what someone is to you — [role key, English, Egyptian Arabic, the words that say it]
export const ROLES = [
  ["wife", "your wife", "مراتك", /\b(my )?(wife|missus)\b|مراتي|زوجتي|مرآتي|المدام|مدامتي|حرمي|mraty|merati/],
  ["husband", "your husband", "جوزك", /\b(my )?husband\b|جوزي|زوجي|gozy/],
  ["mother", "your mother", "مامتك", /\b(my )?(mother|mom|mum|mama)\b|امي|أمي|ماما|مامتي|والدتي|mama/],
  ["father", "your father", "باباك", /\b(my )?(father|dad|papa|baba)\b|ابويا|أبويا|بابا|والدي|baba/],
  ["son", "your son", "ابنك", /\b(my )?son\b|ابني|إبني|ebny/],
  ["daughter", "your daughter", "بنتك", /\b(my )?daughter\b|بنتي|benty/],
  ["brother", "your brother", "أخوك", /\b(my )?brother\b|اخويا|أخويا|اخوي|akhoya/],
  ["sister", "your sister", "أختك", /\b(my )?sister\b|اختي|أختي|okhty/],
  ["boss", "your boss", "مديرك", /\b(my )?(boss|manager)\b|مديري|رئيسي|المدير/],
  ["colleague", "your colleague", "زميلك", /\b(my )?(colleague|coworker|co-worker)\b|زميلي|زميلتي/],
  ["friend", "your friend", "صاحبك", /\b(my )?(friend|bestie|best friend)\b|صاحبي|صاحبتي|صديقي|صديقتي|sa7by/],
  ["client", "your client", "عميلك", /\b(my )?(client|customer)\b|عميلي|العميل|زبوني/],
  ["maid", "your maid", "الشغالة", /\b(my )?(maid|nanny|cleaner)\b|الشغاله|الشغالة|الخدامه|الخدامة|الداده|الدادة/],
  ["driver", "your driver", "السواق", /\b(my )?driver\b|السواق|سواقي/],
  ["family", "family", "من العيلة", /\b(family|relative)\b|قريبي|قريبتي|من العيله|من العيلة/],
];
export const roleOf = (key) => ROLES.find((r) => r[0] === key) || null;
const roleIn = (t) => (ROLES.find((r) => r[3].test(t)) || [null])[0];

const QUESTION = /[?؟]\s*$|^(who|what|where|when|is|are|does|did|how|مين|فين|امتى|إمتى|هل|ايه|إيه|ازاي|إزاي)(?![\p{L}])/iu;
const STOP_NAME = /^(she|he|it|this|that|they|her|him|هي|هو|ده|دي|دا|هم|the|a|my|your|is|are)$/i;

/** People mentioned by a role ("my wife") → their card. */
export function byRole(dir, key) { return ((dir && dir.items) || []).filter((p) => p.kind === "person" && p.role === key); }
function nameFromRole(t, dir) { const k = roleIn(t); if (!k) return null; const ps = byRole(dir, k); return ps.length === 1 ? ps[0] : null; }

// ---- L1: "X is my wife" -------------------------------------------------------------------------------------------------------------
function whoSentence(raw, ctx) {
  const t = String(raw || "").replace(/[“”«»"']/g, " ").replace(/\s+/g, " ").trim();
  const role = roleIn(t.toLowerCase()); if (!role) return null;
  // v9.9.18 (the hard run: "the glasses is at my mum's house" taught "glasses" as my mother): a place said with a role is where a thing is
  if (/\b(?:is|are)\s+(?:now\s+)?(?:at|in|on|under|inside|behind|beside|next to)\s+(?:my|our|the)\s+(?:\w+(?:'s|\s+s)\s+)?(?:house|home|place|flat|apartment|car|office|room|bag|drawer)\b|\b(?:at|in)\s+my\s+\w+(?:'s|\s+s)\s+(?:house|home|place|flat|apartment|car|office)\b|(?:في|عند)\s+(?:بيت|شقة|شقه|عربية|عربيه)\s/i.test(t)) return null;
  let name = "", m;
  // "Nada is my wife" · "Nada = wife" · "Nada, my wife" · "this is my wife" / "she's my wife" (the notification's person)
  if ((m = /^(?:and\s+)?([\p{L}][\p{L}'.-]*(?:\s+[\p{L}][\p{L}'.-]*){0,2})\s*(?:is|'s|=|:|,|-)\s*(?:my|our)?\s*/iu.exec(t))) name = m[1];
  // Arabic: «نادا مراتي», «نادا تبقى مراتي», «نادا دي مراتي», «دي مراتي»
  if (!name && (m = /^([؀-ۿ]+(?:\s+[؀-ۿ]+)??)\s+(?:تبقى|تبقي|يبقى|يبقي|دي|ده|هي|هو|=)?\s*(?:مراتي|زوجتي|جوزي|زوجي|امي|أمي|ماما|بابا|ابويا|أبويا|ابني|بنتي|اخويا|أخويا|اختي|أختي|مديري|زميلي|زميلتي|صاحبي|صاحبتي|عميلي|الشغاله|الشغالة|السواق|المدام|قريبي|قريبتي)/.exec(t))) name = m[1];
  name = String(name || "").replace(/\s+(?:is|'s)$/i, "").trim();
  if (!name || STOP_NAME.test(name) || /^(this|that|she|he|it|دي|ده|هي|هو)$/i.test(name)) name = (ctx && ctx.name) || "";
  if (!name) return { kind: "ask", q: "Who do you mean? Write the name, e.g. “Nada is my wife”.", qAr: "تقصد مين؟ اكتب الاسم، مثلاً «نادا مراتي».", choices: [] };
  return { kind: "who", name: name.replace(/^(?:and|و)\s+/i, "").trim(), role };
}

// ---- L2: rules by talking ----------------------------------------------------------------------------------------------------------
const APPS = [["life360", "com.life360.android.safetymapd", /life ?360/i], ["yazio", "com.yazio.android", /yazio|يازيو/i], ["whatsapp", "com.whatsapp", /whats ?app|واتس/i],
  ["telegram", "org.telegram.messenger", /telegram|تليجرام/i], ["gmail", "com.google.android.gm", /gmail|جيميل/i], ["dubizzle", "com.dubizzle.horizontal", /dubizzle|olx|دوبيزل/i],
  ["google", "com.google.android.googlequicksearchbox", /\bgoogle\b|جوجل/i], ["maps", "com.google.android.apps.maps", /\bmaps\b|الخرايط|خرائط/i], ["instagram", "com.instagram.android", /instagram|انستا/i],
  ["facebook", "com.facebook.katana", /facebook|فيسبوك|الفيس/i], ["talabat", "com.talabat", /talabat|طلبات/i], ["amazon", "com.amazon.mShop.android.shopping", /amazon|امازون/i]];
const appIn = (t) => APPS.find((a) => a[2].test(t)) || null;
function ruleSentence(raw, dir) {
  const t = String(raw || "").trim(), low = t.toLowerCase();
  // hide an app: "never show Yazio", "hide dubizzle", «ماتورينيش يازيو», «اخفي إشعارات طلبات»
  if (/\b(never show|don'?t show|hide|stop showing|mute|ignore)\b|ماتورينيش|متورينيش|اخفي|إخفي|خبي|ماتعرضش|متعرضش|تجاهل/i.test(low)) {
    const a = appIn(t); if (a) return { kind: "rule", rule: { kind: "hide", app: a[0], pkg: a[1] } };
    return { kind: "ask", q: "Which app's notifications should I hide?", qAr: "أخفي إشعارات أنهي أبلكيشن؟", choices: [] };
  }
  // first: "put the maid first", "if the maid messages, put it first", «رسايل الشغالة تبقى الأول»
  if (/\b(first|on top|top priority|important)\b|الأول|الاول|فوق خالص|مهم/i.test(low) && !/\b(tell|notify|alert)\b|قولي|نبهني/i.test(low)) {
    const p = nameFromRole(low, dir) || ((mentions(t, dir) || [])[0] ? dir.items.find((x) => x.id === mentions(t, dir)[0].ids[0]) : null);
    if (p) return { kind: "rule", rule: { kind: "first", who: p.name, pid: p.id } };
  }
  // arrivals: "tell me when my wife gets home", "tell me when Nada arrives at work", «قولي لما مراتي توصل البيت»
  const tellMe = /\b(tell|notify|alert|let)\s+me\b|قولي|قول لي|نبهني|عرفني|بلغني/i.test(low);
  const arrive = /\b(gets?|got|arrives?|arrived|reaches|reached|leaves?|left)\b|توصل|وصلت|يوصل|وصل|تخرج|خرجت|يخرج|تمشي|مشيت/i.test(low);
  if (tellMe && arrive) {
    let p = nameFromRole(low, dir);
    if (!p) { const ms = mentions(t, dir) || []; if (ms.length && ms[0].ids.length === 1) p = dir.items.find((x) => x.id === ms[0].ids[0]); }
    const leave = /\b(leaves?|left)\b|تخرج|خرجت|يخرج|تمشي|مشيت/i.test(low);
    const place = (/\b(home|house)\b|البيت|بيت/i.test(low) && "Home") || (/\b(work|office)\b|الشغل|المكتب/i.test(low) && "Work") || (/\b(school|uni|university|college)\b|المدرسة|المدرسه|الجامعة|الجامعه/i.test(low) && "School") || "";
    if (!p) {
      const r = roleIn(low);
      return { kind: "ask", q: r ? "Who is {r}? Tell me once — e.g. “Nada is {k}”." : "Who should I watch for? Write the name.", qv: r ? { r: roleOf(r)[1], k: roleOf(r)[1].replace(/^your /, "my ") } : {}, qAr: r ? `مين ${roleOf(r)[2]}؟ قولي مرة واحدة — مثلاً «نادا ${roleOf(r)[2].replace("ك", "ي")}».` : "أراقب مين؟ اكتب الاسم.", choices: [], needRole: r || "" };
    }
    return { kind: "rule", rule: { kind: leave ? "leave" : "arrive", who: p.name, pid: p.id, place, app: "life360", pkg: APPS[0][1] } };
  }
  return null;
}

/** What a sentence teaches (or a question back). ctx = { name } when it is said on a notification about that person. */
export function readTeach(text, dir = { items: [] }, ctx = {}) {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 240) return null;
  const r = ruleSentence(raw, dir); if (r) return r;
  if (QUESTION.test(raw)) return null;
  return whoSentence(raw, ctx);
}

/** The line the person approves before anything is saved: "Nada = your wife". */
export function understood(x, { ar = false, tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k]) } = {}) {
  if (!x) return "";
  if (x.kind === "ask") return ar ? x.qAr : tr(x.q, Object.fromEntries(Object.entries(x.qv || {}).map(([k, v]) => [k, tr(v, {})])));
  // v9.9.15: a People card's role can be any word the person typed ("driver", "Sheikh") — not only the ones in ROLES; it used to crash
  // the whole Follow-ups screen ("Cannot read properties of null (reading '1')" in What Attune learned)
  if (x.kind === "who") { const r = roleOf(x.role), raw = String(x.role || "").trim(); return ar ? `${x.name} = ${r ? r[2] : raw}` : tr("{n} = {r}", { n: x.name, r: r ? tr(r[1], {}) : raw }); }
  const u = x.rule;
  if (!u) return "";
  if (u.kind === "hide") return ar ? `مش هعرض إشعارات ${u.app} تاني` : tr("I won't show {a} notifications any more", { a: u.app });
  if (u.kind === "first") return ar ? `${u.who} يبقى الأول دايماً` : tr("{n} always comes first", { n: u.who });
  const at = u.place ? (ar ? { Home: "البيت", Work: "الشغل", School: "الجامعة" }[u.place] : tr(u.place, {})) : "";
  if (u.kind === "leave") return ar ? `هقولك لما ${u.who} يمشي${at ? " من " + at : ""}` : tr("I'll tell you when {n} leaves{p}", { n: u.who, p: at ? " — " + at : "" });
  return ar ? `هقولك لما ${u.who} يوصل${at ? " " + at : ""}` : tr("I'll tell you when {n} arrives{p}", { n: u.who, p: at ? " — " + at : "" });
}

/** Saves what was approved → { dir, teach, watch? } (watch = the phone alert to add with watch.js, for arrivals). */
export function applyTeach(x, { dir, teach = emptyTeach(), now = Date.now() } = {}) {
  if (!x || x.kind === "ask") return { dir, teach };
  if (x.kind === "who") {
    const k = f(x.name), have = (dir.items || []).find((p) => p.kind === "person" && (f(p.name) === k || (p.aliases || []).some((a) => f(a) === k)));
    if (have) return { dir: { ...dir, items: dir.items.map((p) => (p.id === have.id ? { ...p, role: x.role } : p)) }, teach: { ...teach, asked: [...new Set([...(teach.asked || []), k])] } };
    return { dir: addCard(dir, { kind: "person", name: x.name, role: x.role }, now).dir, teach: { ...teach, asked: [...new Set([...(teach.asked || []), k])] } };
  }
  const rule = { id: "t" + now.toString(36), on: true, created: now, ...x.rule };
  const out = { dir, teach: { ...teach, rules: [...(teach.rules || []).filter((r) => !(r.kind === rule.kind && r.app === rule.app && r.who === rule.who)), rule] } };
  if (rule.kind === "arrive" || rule.kind === "leave") {
    const words = rule.kind === "arrive" ? ["arrived", "has arrived", "وصل", "وصلت"] : ["left", "has left", "خرج", "خرجت", "مشي"];
    out.watch = { who: [rule.who], app: "pkgs:" + rule.pkg, words: rule.place ? words.map((w) => w + " " + rule.place).concat(words.filter((w) => /[؀-ۿ]/.test(w))) : words, once: false, label: "teach:" + rule.id };
  }
  return out;
}

// ---- reading notifications with what you taught --------------------------------------------------------------------------------------
const PERSON_APPS = /life ?360|whatsapp|telegram|messenger|signal|viber|botim|find my|google family|family link/i;
/** The person a notification is about (Life360 / chat apps put the name in the title). */
export function personOf(n) {
  const title = String((n && n.title) || "").replace(/\s*\(\d+.*\)\s*$/, "").replace(/\s+\d[\d ]*$/, "").trim();
  if (!PERSON_APPS.test(String(n && (n.app || "")) + " " + String(n && (n.pkg || "")))) return "";
  if (!title || title.length > 40 || /\d{2,}|:|·|http/.test(title) || title.split(/\s+/).length > 3) return "";
  return title;
}
export const isHidden = (n, teach) => (teach.rules || []).some((r) => r.on !== false && r.kind === "hide" && (String((n && n.app) || "").toLowerCase().replace(/\s+/g, "").includes(r.app) || String((n && n.pkg) || "") === r.pkg));
/** The card of the person a notification is about, if you told Attune who they are. */
export function cardOf(n, dir) { const nm = personOf(n); if (!nm) return null; const k = f(nm); return ((dir && dir.items) || []).find((p) => p.kind === "person" && p.role && (f(p.name) === k || (p.aliases || []).some((a) => f(a) === k) || f(nm).split(" ")[0] === f(p.name).split(" ")[0])) || null; }

/** L4: "Your wife (Nada) completed a 13 km drive" — or null when nothing was taught about them. */
export function describe(n, dir, { ar = false, tr = (s) => s } = {}) {
  const p = cardOf(n, dir); if (!p) return null;
  const r = roleOf(p.role); if (!r) return null;
  const text = String((n && n.text) || "").replace(/^🏁\s*/, "").trim();
  const who = ar ? `${r[2].replace(/ك$/, "ي")} (${p.name})` : `${tr(r[1]).replace(/^./, (c) => c.toUpperCase())} (${p.name})`;
  return { who, line: `${who} · ${text}`, role: p.role, name: p.name };
}

/** L3: a person's name seen 3+ times in 7 days that you never told Attune about → ask once. */
export function whoAsk(notes = [], dir = { items: [] }, teach = emptyTeach(), now = Date.now()) {
  const count = new Map();
  for (const n of notes) { if ((n.ts || 0) < now - 7 * 864e5) continue; const nm = personOf(n); if (!nm) continue; const k = f(nm); if (!k || k.length < 2) continue; const c = count.get(k) || { name: nm, n: 0, app: n.app || "" }; c.n++; count.set(k, c); }
  const known = new Set(((dir && dir.items) || []).filter((p) => p.role).flatMap((p) => [f(p.name), ...(p.aliases || []).map(f)]));
  const done = new Set([...(teach.asked || []), ...(teach.skip || [])]);
  return [...count.entries()].filter(([k, c]) => c.n >= 3 && !known.has(k) && !done.has(k)).sort((a, b) => b[1].n - a[1].n).map(([, c]) => c)[0] || null;
}
export const skipAsk = (teach, name) => ({ ...teach, skip: [...new Set([...(teach.skip || []), f(name)])] });

/** Chat / voice: "where's my wife?" / «مراتي فين؟» → the newest notification about her, or null. */
export function whereIs(q, notes = [], dir = { items: [] }) {
  const t = String(q || "").toLowerCase();
  if (!/\b(where|where's|wheres|location|arrived|reach(ed)?|got home)\b|فين|وصلت|وصل|مكانها|مكانه/i.test(t)) return null;
  let p = nameFromRole(t, dir);
  if (!p) { const ms = mentions(q, dir) || []; if (ms.length && ms[0].ids.length === 1) p = dir.items.find((x) => x.id === ms[0].ids[0]); }
  if (!p) return null;
  const k = f(p.name).split(" ")[0];
  const n = [...notes].filter((x) => /life ?360|find my|family/i.test(String(x.app || "") + " " + String(x.pkg || "")) && f(personOf(x)).split(" ")[0] === k).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  return { person: p, note: n || null };
}
