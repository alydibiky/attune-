/* ---- v9.9.40 AP-3 (the new Autopilot, Ali OK'd K1 — rules 2 and 5): what each chat IS, so Autopilot acts by the chat's role and
   Chat answers "what are all the talabat?" from the right place.
   · readDescription(text) — the person's own words, any of EN / Egyptian / Franco («ده جروب أنا ونودي، بنكتب فيه الحاجات اللي خلصت
     من البيت», "residents' group, only matters if they talk about maintenance, fees or the garage", "work, tell me only if someone
     mentions me", "spam unless I ordered something") → { role, care: [topics], whenMe, people, quiet }. The phone's AI is asked
     only when code finds no role (descPrompt / readDescModel) — and the person always sees "What I understood" first (rule 5).
   · guessRole(chat, messages) — Attune's own reading of a new chat from its messages (K1: shown with "Right?" — never used to act
     before the person says Right).
   · understood(rule, chatName) → the "What I understood" lines, as { t, v } for tr().
   Roles: shopping (a shared list) · building · work · family · friends · person · courier · news · quiet.
   Pure; tests: tests/chatroles/gen.mjs (10,000 descriptions + 10,000 chats) + tests/unit/v9940chatroles.test.mjs. */
import { itemsOf } from "./shoplist.js";
import { noiseOf } from "./chats.js";

export const ROLES_KEY = "attune:chatroles:v1";
export const ROLES = ["orders", "shopping", "building", "work", "family", "friends", "person", "courier", "news", "quiet"];
const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟])/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "");

// the role words — in the order they are tried (the first that fits wins; "shopping list with my wife" is shopping, not family)
const ROLE_W = [
  ["quiet", /\b(?:spam|junk|ignore (?:it|this|them|everything)|mute|useless|not important|never (?:tell|show)|nothing important)\b|مش مهم(?! غير| الا| إلا| بس)|تجاهل(?:ه|ها)?(?!\s+(?:غير|الا|إلا))|سبام|ملوش لازمة|مالوش لازمة|ezh2|msh mohem(?! gher| ella)|mesh mohem(?! gher| ella)/i],
  // v10.2 (Ali, 17 Nov: "It's a group I put on all orders I buy" — Change did nothing): a record of what YOU bought is not a list
  // of things to buy — every message is kept (ask "when did I order …?"), nothing goes on a list
  ["orders", /\b(?:(?:all |the |my )?(?:orders?|things|stuff|everything|what|items?)\s+(?:that\s+)?(?:i|we)\s+(?:buy|bought|order|ordered|purchase|purchased|get|got)|(?:i|we)\s+(?:put|post|save|keep|log|record|write)\s+(?:in |on )?(?:it |here )?(?:all |every |each )?(?:(?:the|my|our)\s+)?(?:orders?|purchases?|receipts?)|my (?:orders|purchases|receipts)|purchases?(?: log| record| history)?|order (?:log|history|record)|receipts?)\b|(?:الطلبات|طلبات|الحاجات|كل حاجه|كل حاجة|كل اللي)\s+(?:اللي\s+)?(?:بشتريها|بشتريه|بشتري|اشتريتها|اشتريته|اشتريت|بطلبها|بطلبه|بطلب|طلبتها|طلبته|طلبت|بجيبها|جبتها)|مشترياتي|مشتريات|فواتيري|طلباتي اللي|اللي بشتريه|اللي اشتريته|el talabat elly bashtereha|moshtarayaty/i],
  ["shopping", /\b(?:shopping|groceries|grocery|what(?:'s| is) missing|ran out|run out|things to buy|to buy|missing (?:things|stuff|items)|our list|the list|supermarket)\b|طلبات(?!\s+(?:الشغل|العملاء))|الحاجات اللي (?:خلصت|ناقصه|ناقصة|محتاجينها)|اللي خلص|اللي ناقص|نشتري|نجيب(?:ها)?|البقاله|البقالة|السوبر ?ماركت|المشتريات|lista|el 7agat elly 5elset|talabat el beit|nesh?tery|el ta?labat/i],
  ["building", /\b(?:residents?|owners?|building|compound|neighbou?rs?|tenants?|hoa|apartment block|landlord)\b|سكان|السكان|ملاك|الملاك|اتحاد|العماره|العمارة|الكمبوند|الكومباوند|كمبوند|الجيران|جيران|البرج|sokan|el sokkan|el omara|el compound|el geran/i],
  ["work", /\b(?:work|job|office|site|project|client|clients|team|colleagues|business|company|cranes?|staff)\b|شغل|الشغل|الموقع|المشروع|العملاء|عملاء|المكتب|الشركه|الشركة|الزملاء|زمايل|الونش|الاوناش|الصيانه بتاعت الاوناش|sho?3?'?ol|el shoghl|el mawke3|el mashroo3/i],
  ["family", /\b(?:family|parents|relatives|cousins|siblings|my mom|my dad|my mum)\b|عيله|العيله|الاسره|الأسرة|اهلي|أهلي|العيلة|عيلة|3eela|el 3ela|ahly/i],
  ["friends", /\b(?:friends|buddies|mates|uni|college|school (?:friends|group)|gym)\b|صحاب|اصحاب|الشله|الشلة|شله|شلة|الجامعه|الجامعة|so7ab|el shella/i],
  ["courier", /\b(?:delivery|courier|shipping|parcel|package|orders? (?:from|updates)|aramex|bosta|dhl|j&t)\b|شحن|توصيل|مندوب|الطرد|الشحنه|الشحنة|delivery|ta?wseel/i],
  ["news", /\b(?:news|offers?|ads|adverts?|promotions?|deals|channel|announcements?)\b|اخبار|أخبار|عروض|اعلانات|إعلانات|قناه|قناة/i],
  ["person", /\b(?:my (?:wife|husband|son|daughter|brother|sister|mother|father|boss|friend|driver|doctor|maid|nanny|partner))\b|مراتي|جوزي|ابني|بنتي|اخويا|اختي|امي|ابويا|مديري|صاحبي|السواق|الدكتور|الشغاله|الشغالة|merati|gozy/i],
];
// "only if / tell me when / unless / غير لو / بس لو …" → the topics that matter
const CARE_LEAD = /\b(?:only (?:if|when|about)|tell me (?:if|when|only (?:if|when))|let me know (?:if|when)|unless|except (?:if|when)|matters? (?:only )?(?:if|when)|important (?:only )?(?:if|when)|care about)\s+(?:they |someone |anyone |it |people )?(?:talk(?:s|ing)? about|mention(?:s)?|discuss(?:es|ing)?|say(?:s)? (?:something )?about|is about|it's about|about)?\s*|(?:غير لو|إلا لو|الا لو|بس لو|لو حد|لو اتكلموا عن|لو اتكلمو عن|لو قالوا|لو فيه|قولي لو|عرفني لو|نبهني لو|gher law|ella law|bas law|2oly law)\s*(?:(?:حد|اتكلموا عن|اتكلمو عن|اتكلم عن|اتكلموا في|قال|قالوا|جاب سيرة|فيه|كلام عن|kalemo 3an|2al)\s+)*/i;
const CARE_STOP = /\s*(?:\.|$|;|\bbut\b|\bthe rest\b|\bother(?:wise| than that)\b|والباقي|غير كده|غير كدا)/i;
const ME_W = /\b(?:(?:mentions?|tags?|asks?|calls?|says?) me|my name|to me directly|me directly|@me|asks? me (?:something|anything|directly)|for me)\b|(?:يكلمني|يسألني|يسالني|اسمي|منشن|يقولي|يندهني|يطلب مني|ليا انا|ykalemny|yes2alny)/i;
const SPLIT = /\s*(?:,|،|\bor\b|\band\b|\s+أو\s+|\s+او\s+|\s+و(?=[ء-ي])|\s+w\s+|\/)\s*/i;
const TOPIC_JUNK = /^(?:something|anything|stuff|things|it|that|them|حاجة|حاجه|حاجات|اي حاجة|أي حاجة|حد|ده|دي)$/i;
const PEOPLE = /\b(?:me and|with|between me and)\s+(?:my\s+)?([\p{L}][\p{L}' ]{1,30}?)(?=\s*(?:,|\.|;|$|\bwe\b|\bwhere\b|\bto\b|\bfor\b|\bwho\b))|(?:أنا و|انا و|بيني وبين|مع)\s*([ء-ي]{2,}(?:\s+[ء-ي]{2,})?)/iu;

export function readDescription(text0) {
  const text = String(text0 || "").replace(/\s+/g, " ").trim(), t = fold(text);
  if (!text) return null;
  // the role is what the chat IS — the words before "only if …" / "or if someone mentions me"; the topics after it never set it
  // ("family group, only if someone mentions my crane" is family, not work)
  const cm = CARE_LEAD.exec(text), mm = ME_W.exec(text);
  const cut = Math.min(cm ? cm.index : text.length, mm ? Math.max(0, mm.index - 12) : text.length);
  // «مش مهم غير لو …» / "not important unless …" — the "not important" belongs to the "unless", it is not the chat's role
  const head = text.slice(0, cut).replace(/[\s,،]*(?:مش مهم|مالوش لازمة|ملوش لازمة|not important|doesn't matter|ignore it|msh mohem|mesh mohem)[\s,،]*$/i, ""), th = fold(head);
  let role = "";
  for (const [r, re] of ROLE_W) if (re.test(th) || re.test(head)) { role = r; break; }
  if (!role) for (const [r, re] of ROLE_W) if (re.test(t) || re.test(text)) { role = r; break; }
  // "spam unless I ordered something" / «مش مهم غير لو …» — quiet with an exception is not quiet
  const care = [];
  if (cm) {
    const rest = text.slice(cm.index + cm[0].length), stop = CARE_STOP.exec(rest), span = stop ? rest.slice(0, stop.index) : rest;
    for (const x of span.split(SPLIT)) { const w = x.replace(/^(?:the|my|our|a|an|ال)\s+/i, "").replace(/[\s.!؟?,،\p{Extended_Pictographic}️]+$/u, "").trim(); if (w && w.length <= 30 && !TOPIC_JUNK.test(w) && !ME_W.test(w) && !/^(?:i|me|انا|أنا)\b/i.test(w)) care.push(w); }
  }
  const whenMe = ME_W.test(text);
  const pm = PEOPLE.exec(text), people = pm ? [(pm[1] || pm[2] || "").trim()].filter((x) => x && !/^(?:the|my|our|ال)$/i.test(x)) : [];
  if (role === "quiet" && (care.length || whenMe || cm))   // any "unless / except / غير لو" — even "unless I ordered something" — makes it not "never"
  role = /order|طلب|اوردر/i.test(text) ? "courier" : "news";
  return { role: role || "", care: [...new Set(care)].slice(0, 8), whenMe, people, unsure: !role };
}

/** For the phone's AI when code finds no role: one line of JSON back (readDescModel checks it). */
export function descPrompt(text, chatName = "") {
  return [{ role: "system", content: "You read how a person describes one of their chats. Reply with ONE line of JSON: {\"role\": one of " + ROLES.join("|") + ", \"care\": [short topics that matter, in the person's words], \"whenMe\": true if they want to know when someone mentions or asks them}. shopping = a shared list of things to buy; building = residents / owners / compound; quiet = never matters." },
    { role: "user", content: (chatName ? "Chat: " + chatName + "\n" : "") + "Their words: " + String(text || "").slice(0, 400) }];
}
export function readDescModel(out) {
  try { const j = JSON.parse(String(out || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "")); if (!ROLES.includes(j.role)) return null;
    return { role: j.role, care: (Array.isArray(j.care) ? j.care : []).map((x) => String(x).slice(0, 30)).filter(Boolean).slice(0, 8), whenMe: !!j.whenMe, people: [], unsure: false, by: "model" }; } catch (e) { return null; }
}

/** Attune's own guess from a chat's messages (K1) — { role, sure, because: {t, v} }. */
export function guessRole(chat = {}, messages = []) {
  const name = String(chat.chat || chat.name || ""), real = messages.filter((m) => m && !noiseOf(m.text));
  const writers = new Set(messages.map((m) => m.who || m.author).filter(Boolean));
  const byName = readDescription(name);
  if (byName && byName.role && byName.role !== "person" && byName.role !== "quiet") return { role: byName.role, sure: false, because: { t: "from the chat's name “{n}”", v: { n: name } } };
  if (real.length >= 2) {   // (2 are enough to SUGGEST it — a guess is only ever shown with "Right?", never acted on)
    const listy = real.filter((m) => itemsOf(m.text).length > 0 && String(m.text).length <= 60).length;
    if (listy / real.length >= 0.6 && writers.size <= 4) return { role: "shopping", sure: false, because: { t: "{n} of {m} messages are things to buy", v: { n: listy, m: real.length } } };
  }
  if (!chat.group) return { role: "person", sure: false, because: { t: "a chat with one person", v: {} } };
  if (writers.size >= 15) return { role: "building", sure: false, because: { t: "a big group ({n} people)", v: { n: writers.size } } };
  return { role: "", sure: false, because: { t: "not sure yet", v: {} } };
}

const ROLE_LINE = { orders: "{c} = a record of the orders you buy", shopping: "{c} = a shared shopping list", building: "{c} = your building's group", work: "{c} = a work group", family: "{c} = your family", friends: "{c} = your friends", person: "{c} = a chat with one person", courier: "{c} = deliveries and orders", news: "{c} = news and offers", quiet: "{c} = never important" };
const DOES = { orders: "Every message is kept — ask “when did I order …?” — nothing goes on a list", shopping: "Each message → an item on your Shopping list", building: "Usually: messages are only kept, no cards", work: "Usually: messages are only kept, no cards", family: "Memes and news are kept quietly; real requests to you are shown", friends: "Messages are kept quietly", person: "Real requests to you become to-dos (with the message and Undo)", courier: "Delivery dates → Follow-ups; payment requests are checked for scams", news: "Messages are kept quietly", quiet: "Messages are only kept — never a card" };
/** The "What I understood" lines for this chat: [{ t, v }] (tr() each). */
export function understood(rule, chatName) {
  if (!rule || !rule.role) return [{ t: "Not sure what {c} is yet — tell me in your words", v: { c: chatName } }];
  const out = [{ t: ROLE_LINE[rule.role], v: { c: chatName } }];
  if (rule.people && rule.people.length) out.push({ t: "People: you and {p}", v: { p: rule.people.join(", ") } });
  out.push({ t: DOES[rule.role], v: {} });
  if (rule.care && rule.care.length) out.push({ t: "Tell you when: {x}", v: { x: rule.care.join(" · ") } });
  if (rule.whenMe) out.push({ t: "Tell you when someone mentions you or asks you", v: {} });
  return out;
}

// ---- the store: { [chatKey]: { role, care, whenMe, people, desc, by: "you" | "attune" | "model", ok: bool, at } } -------------
export function loadRoles(s = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((s && s.getItem(ROLES_KEY)) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
export function saveRole(key, rule, s = typeof localStorage !== "undefined" ? localStorage : null) {
  const all = loadRoles(s); all[key] = { ...(all[key] || {}), ...rule, at: Date.now() }; try { s && s.setItem(ROLES_KEY, JSON.stringify(all)); } catch (e) {} return all;
}
/** The role Autopilot may ACT on: only one the person confirmed (rule 2 — a guess is shown, never acted on). */
export const confirmedRole = (roles, key) => { const r = roles && roles[key]; return r && r.ok ? r : null; };
