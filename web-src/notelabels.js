/* ---- v9.9.11 Teach Attune what a notification is (Ali picked A1 A2 A4 L, 10 Nov 2026: "it should be interactive and ask me, I tell
   it what it is and it understands, so next time it knows"; "integrate them in a good way and make sure it's smart and understands
   anything I type"). The brain for all four:
     sourceOf(n)        → where a notification comes from: a chat / group ("WhatsApp · ما يخص المرتبات"), an SMS sender, or an app
     labelOf(n, teach)  → what the person taught about that source (or null)
     readAnswer(text, src) → what the answer means: { kind: "label", meaning, … } | { kind: "who", … } (a person — noteteach.js)
                          | { kind: "ask", choices } when it can't tell — then the AI (aiPrompt / readAi), then the choices
     asksFrom(notes, teach) → what Attune should ask about (money it isn't sure of, a source it never saw), newest first, once each
     applyLabel / undoLabel / learned(teach) → saved in noteteach's rules (kind "label"); the "What Attune learned" list
   What a label does: notmoney / work / ads / ignore → never read as money (paylog.js) and never asked again; ignore / ads → hidden
   in Recall; mymoney / bank → that source counts as a money source (the payment still needs "the money moved" + the AI's yes);
   bill / delivery / family / important → how it is described. Nothing is saved before "I understood … — Save".
   Pure; tests: tests/unit/v999notelabels.test.mjs. */
import { readTeach, ROLES } from "./noteteach.js";
const ROLE_AR = Object.fromEntries(ROLES.map((r) => [r[0], r[2]]));

const CHAT = /whatsapp|telegram|messenger|com\.facebook\.orca|instagram|securesms|org\.signal|signal|viber|slack|teams|discord|imo|botim|wechat|tencent\.mm|naver\.line|snapchat|skype/i;
const SMS = /messag|\bsms\b|mms|samsung\.android\.messaging|google\.android\.apps\.messaging|رسائل/i;
const fold = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const appName = (n) => String((n && (n.app || n.pkg)) || "").trim();

/** Where it comes from → { key, kind: "chat" | "sms" | "app", name, app }. A chat's name is the group / person (the title before
 *  ": sender" and without "(3 messages)"); an SMS's is its sender; an app's is the app. */
export function sourceOf(n) {
  if (!n) return null;
  const app = appName(n), both = app + " " + String(n.pkg || "");
  const title = String(n.title || "").replace(/\s*\(\d+\s*(?:messages?|رسائل|رسالة|new)[^)]*\)\s*$/i, "").trim();
  if (CHAT.test(both)) { const name = title.split(/:\s/)[0].replace(/\s*@\s*.*$/, "").trim() || app; return { key: "chat:" + fold(app).split(" ")[0] + ":" + fold(name), kind: "chat", name, app, pkg: String(n.pkg || "") }; }
  if (SMS.test(both)) { const name = title || app; return { key: "sms:" + fold(name), kind: "sms", name, app, pkg: String(n.pkg || "") }; }
  return { key: "app:" + fold(n.pkg || app), kind: "app", name: app, app, pkg: String(n.pkg || "") };
}

// what a source can be — [meaning, English, Egyptian Arabic]
export const MEANINGS = [
  ["work", "Work talk — not my money", "كلام شغل — مش فلوسي"],
  ["notmoney", "Not money — just talk", "مش فلوس — كلام بس"],
  ["mymoney", "My money — count it", "فلوسي — احسبها"],
  ["bank", "My bank / wallet", "بنكي / محفظتي"],
  ["bill", "A bill or installment", "فاتورة أو قسط"],
  ["delivery", "Deliveries and orders", "طلبات وتوصيل"],
  ["family", "Family", "العيلة"],
  ["important", "Important — tell me", "مهم — بلغني"],
  ["ads", "Ads and offers — ignore", "إعلانات وعروض — تجاهلها"],
  ["ignore", "Ignore it", "تجاهله"],
];
export const meaningOf = (k) => MEANINGS.find((m) => m[0] === k) || null;
const NOT_MONEY = new Set(["work", "notmoney", "ads", "ignore", "delivery", "family"]);
export const notMoney = (lab) => !!lab && NOT_MONEY.has(lab.meaning);
export const countsAsMoney = (lab) => !!lab && (lab.meaning === "mymoney" || lab.meaning === "bank");
export const hiddenBy = (lab) => !!lab && (lab.meaning === "ignore" || lab.meaning === "ads");

// the words of an answer → a meaning. Order matters: "not mine" before "mine", "work" before "money".
const W = (s) => new RegExp(s, "iu");
const RULES = [
  ["ignore", W("(?<![\\p{L}])(ignore|mute|hide|don'?t show|dont show|never show|stop showing|not important|doesn'?t matter|تجاهل|تجاهله|تجاهلها|اتجاهل|متعرضش|ماتعرضش|اخفي|اخفيه|إخفاء|مش مهم|مش مهمه|ملهوش لازمه|سيبك منه|سيبك منها|ignore it|tgahel|mesh mohem)(?![\\p{L}])")],
  ["ads", W("(?<![\\p{L}])(ads?|advert\\w*|spam|offers?|promo\\w*|marketing|إعلان|اعلان|إعلانات|اعلانات|عروض|سبام|تسويق|e3lan|e3lanat)(?![\\p{L}])")],
  ["work", W("(?<![\\p{L}])(work|job|office|company|colleagues?|team|staff|wages|salaries|payroll|accountant|employees?|workers?|site|شغل|الشغل|شغلي|العمل|عملي|الشركه|الشركة|شركتي|المكتب|زملاء|زمايلي|الموظفين|موظفين|العمال|عمال|المرتبات|مرتبات|الرواتب|رواتب|المحاسب|محاسب|الموقع|sho3l|shoghl)(?![\\p{L}])")],
  ["notmoney", W("(not (?:my )?money|not mine|isn'?t mine|not a payment|no payment|not real|just talk(?:ing)?|only talk|chat(?:ting)? about|مش فلوسي|مش فلوس|دي مش فلوس|مش بتاعي|مش بتاعتي|مش ليا|مش ليه|مش دفع|كلام بس|مجرد كلام|بيتكلموا|mesh feloosy|mesh flousy)")],
  ["bank", W("(?<![\\p{L}])(my bank|bank|banque|wallet|instapay|my account|بنكي|البنك|بنك|محفظتي|المحفظه|المحفظة|محفظه|انستاباي|إنستاباي|حسابي|bnky|banky)(?![\\p{L}])")],
  ["bill", W("(?<![\\p{L}])(bill|bills|installment|instalment|loan|subscription|rent|قسط|اقساط|أقساط|فاتوره|فاتورة|فواتير|اشتراك|ايجار|إيجار|قرض|2est|qest)(?![\\p{L}])")],
  ["mymoney", W("(?<![\\p{L}])(mine|my money|my income|my salary|it'?s mine|count it|record it|add it|real payment|فلوسي|بتاعي|بتاعتي|ليا|دخلي|مرتبي|راتبي|احسبها|احسبه|سجلها|سجله|ضيفها|ضيفه|feloosy|flousy|beta3y)(?![\\p{L}])")],
  ["delivery", W("(?<![\\p{L}])(deliver\\w*|orders?|shipping|shipment|parcel|courier|توصيل|الطلب|طلبات|اوردر|أوردر|شحنه|شحنة|الشحن|المندوب|delivery)(?![\\p{L}])")],
  ["family", W("(?<![\\p{L}])(family|relatives|my parents|العيله|العيلة|عيلتي|اهلي|أهلي|قرايبي|3ela)(?![\\p{L}])")],
  ["important", W("(?<![\\p{L}])(important|urgent|tell me|notify me|let me know|always show|مهم|مهمه|مهمة|ضروري|بلغني|قولي|عرفني|خليني اعرف|mohem)(?![\\p{L}])")],
];
const NEG_MONEY = /(not (?:my )?money|not mine|isn'?t mine|مش فلوسي|مش بتاعي|مش ليا|مش فلوس)/i;

/** The person's answer about a source → { kind: "label", meaning, note } | { kind: "who", … } | { kind: "ask", choices }. */
export function readAnswer(text, src = null, { dir = { items: [] }, name = "" } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  // a quick answer button sends its meaning key
  if (meaningOf(raw)) return { kind: "label", meaning: raw, note: "", src };
  // about a person ("Nada is my wife", «دي مراتي») → the People card (noteteach.js)
  const who = readTeach(raw, dir, { name: name || (src && src.kind === "chat" ? src.name : "") });
  const hits = RULES.filter(([, re]) => re.test(raw)).map(([k]) => k);
  // a person AND what their messages mean ("that's my brother, he sends me money every month") → both, approved together
  if (who && who.kind === "who") {
    const m2 = NEG_MONEY.test(raw) ? "notmoney" : /(sends? me|transfers? me|pays? me|gives? me|بيبعتلي|بيحولي|بيحولّي|بيديني|بيدفعلي)/i.test(raw) || hits.includes("mymoney") ? "mymoney" : "";
    return m2 && src ? { kind: "label", meaning: m2, note: raw.slice(0, 120), src, also: who } : who;
  }
  let m = hits[0] || "";
  if (NEG_MONEY.test(raw)) m = hits.includes("work") ? "work" : hits.includes("ignore") ? "ignore" : hits.includes("ads") ? "ads" : "notmoney";
  else if (hits.includes("work") && hits.includes("mymoney") && /\b(salary|مرتبي|راتبي)\b/i.test(raw)) m = "mymoney";   // "it's my salary from work" = mine
  if (!m) return { kind: "ask", choices: MEANINGS.map((x) => x[0]), src, said: raw };
  return { kind: "label", meaning: m, note: raw.slice(0, 120), src };
}

/** The AI's turn when the words didn't say it clearly: one line of JSON with a meaning from the list (or "unclear"). */
export const aiPrompt = (text, src, sample = "") => `The person is teaching their phone assistant what notifications from one source mean.
Source: ${src ? `${src.kind} "${src.name}" in ${src.app}` : "unknown"}
Example notification: ${String(sample || "").replace(/\s+/g, " ").slice(0, 300)}
What the person wrote: ${String(text || "").slice(0, 300)}
Pick the ONE meaning that fits what they wrote: ${MEANINGS.map((m) => m[0] + " (" + m[1] + ")").join(", ")}, or unclear.
Answer with ONE line of JSON only: {"meaning": "..."}`;
export function readAi(out, src, text) {
  const m = /\{[^{}]*\}/.exec(String(out || "")); if (!m) return null;
  let j = null; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  return meaningOf(j.meaning) ? { kind: "label", meaning: j.meaning, note: String(text || "").slice(0, 120), src, byAi: true } : null;
}

/** "I understood: …" — the line approved before saving. */
export function understoodLabel(x, { ar = false, tr = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v || {})[k]) } = {}) {
  if (!x || x.kind !== "label") return "";
  const src = x.src || {}, where = src.kind === "chat" ? (ar ? `رسايل «${src.name}» (${src.app})` : tr("messages in “{n}” ({a})", { n: src.name, a: src.app })) : src.kind === "sms" ? (ar ? `رسايل ${src.name}` : tr("messages from {n}", { n: src.name })) : (ar ? `إشعارات ${src.name}` : tr("{n} notifications", { n: src.name }));
  const mean = meaningOf(x.meaning), what = ar ? mean[2] : tr(mean[1]);
  const after = notMoney(x) ? (ar ? " — عمري ما هحسبها فلوس ولا هسألك عنها تاني" : tr(" — never counted as money, and I won't ask again"))
    : countsAsMoney(x) ? (ar ? " — الفلوس اللي بتتحرك فيها هتتحسب" : tr(" — money that moves in them counts"))
    : x.meaning === "important" ? (ar ? " — هبلغك بيها" : tr(" — I'll tell you about them")) : "";
  const also = x.also ? " · " + (ar ? `${x.also.name} = ${(ROLE_AR[x.also.role] || x.also.role)}` : tr("{n} = {r}", { n: x.also.name, r: tr("your " + x.also.role) })) : "";
  return (ar ? where + " = " : where.charAt(0).toUpperCase() + where.slice(1) + " = ") + what + after + also;
}

// ---- saved in noteteach's rules (kind "label"), so one "What Attune learned" list holds everything --------------------------------
export function labelOf(n, teach) {
  const s = sourceOf(n); if (!s) return null;
  return ((teach && teach.rules) || []).find((r) => r.kind === "label" && r.on !== false && r.key === s.key) || null;
}
export function applyLabel(x, teach, now = Date.now()) {
  if (!x || x.kind !== "label" || !x.src) return teach;
  const rule = { id: "l" + now.toString(36), kind: "label", on: true, created: now, key: x.src.key, src: x.src, meaning: x.meaning, note: x.note || "" };
  return { ...teach, rules: [...((teach && teach.rules) || []).filter((r) => !(r.kind === "label" && r.key === rule.key)), rule], asked: [...new Set([...((teach && teach.asked) || []), x.src.key])] };
}
/** Undo: the rule goes, and the source may be asked about again (it is no longer "asked"). */
export function undoLabel(teach, id) {
  const r = ((teach && teach.rules) || []).find((x) => x.id === id), key = r && r.key;
  return { ...teach, rules: ((teach && teach.rules) || []).filter((x) => x.id !== id), asked: ((teach && teach.asked) || []).filter((k) => k !== key) };
}
export const skipSource = (teach, key) => ({ ...teach, skip: [...new Set([...((teach && teach.skip) || []), key])] });

/** Everything Attune learned, newest first: labels, people's roles (from the People cards) and the other rules (hide / alerts). */
export function learned(teach, dir = { items: [] }) {
  const rules = ((teach && teach.rules) || []).filter((r) => r.on !== false).map((r) => ({ id: r.id, type: r.kind, rule: r, ts: r.created || 0 }));
  const people = ((dir && dir.items) || []).filter((p) => p.kind === "person" && p.role).map((p) => ({ id: "p:" + p.id, type: "who", person: p, ts: p.created || 0 }));
  return [...rules, ...people].sort((a, b) => b.ts - a.ts);
}

// ---- what to ask about ------------------------------------------------------------------------------------------------------------
const MONEYISH = /[\d٠-٩][\d٠-٩,.٬٫]*\s*(?:جنيه|جنيها|ج\.م|جم|egp|le\b|l\.e|\$|usd|eur|sar|aed|ريال|درهم|دولار)|(?:egp|le|l\.e|\$|usd)\s*[\d٠-٩]/i;
/** Notifications Attune should ask about, once per source: money in a chat / an unknown app (never a known label, never twice).
 *  → [{ id, src, n, why: "money" }] newest first, at most `max`. A bank app's money is NOT asked here (the payment check handles it). */
export function asksFrom(notes = [], teach = { rules: [], asked: [], skip: [] }, { max = 3, bankish = () => false, now = Date.now() } = {}) {
  const done = new Set([...(teach.asked || []), ...(teach.skip || [])]), seen = new Set(), out = [];
  for (const n of [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    if ((n.ts || 0) < now - 14 * 864e5) continue;
    const s = sourceOf(n); if (!s || seen.has(s.key) || done.has(s.key) || labelOf(n, teach)) continue;
    const text = String(n.title || "") + " " + String(n.text || "");
    if (!MONEYISH.test(text) || bankish(n)) continue;
    seen.add(s.key); out.push({ id: "ask:" + s.key, src: s, n, why: "money" });
    if (out.length >= max) break;
  }
  return out;
}

/** A2: what the phone must never ask about — the chats already taught ([{ pkg, name }]). */
export const phoneKnown = (teach) => ((teach && teach.rules) || []).filter((r) => r.kind === "label" && r.on !== false && r.src && r.src.kind === "chat" && r.src.pkg).map((r) => ({ pkg: r.src.pkg, name: r.src.name }));
