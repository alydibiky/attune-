/* ---- v6.48 Chat runs the app (CHAT_RUNS_APP.md S1; Ali, 21 Oct 2026: "make chat responsible for most things in the app"; Home
   option A). Everything here is pure code, no model:
   - the "/" commands — English names and Egyptian Arabic ones («/حول», «/ترجم», «/افتكر»…), and what each needs;
   - parseCommand: "/translate to Turkish good morning" → { id: "translate", arg: "good morning", to: "tr" };
   - guess: a sentence typed WITHOUT a slash → the things it could mean, each with a score, from the tools' own detectors (passed in:
     the Home "do it" reader, Scout's goal test, the Metro reader…) plus the readers below (to-do, where things are, a place, a trip,
     convert, translate, humanize, remember, find);
   - decide: one clear meaning → do it; two close ones → ASK with the two options (Ali: "if the prompt can mean 2 things it asks him
     with the 2 options and he ticks what he means");
   - learn: the option he ticked is kept for that kind of sentence; after the same answer twice Attune stops asking ("the chat detects
     and understands what the user always wants").
   Tests: tests/unit/v748commands.test.mjs.                                                                                       */

const AR_D = "٠١٢٣٤٥٦٧٨٩";
export const fold = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه")
  .replace(/[ً-ْـ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// id, English name, Egyptian Arabic names, what it needs ("file" | "text" | "any" | ""), a one-line hint (en, ar), heavy = uses the model
export const COMMANDS = [
  { id: "convert", ar: ["حول", "حوّل", "تحويل"], needs: "file", heavy: false, group: "do",
    hint: ["a file → PDF, Word, Excel, photos…", "حوّل ملف لـ PDF أو Word أو Excel…"] },
  { id: "humanize", ar: ["طبيعي", "انسن", "خليه طبيعي"], needs: "text", heavy: true, group: "do",
    hint: ["make text sound like you wrote it", "خلّي الكلام طبيعي كأنك كاتبه"] },
  { id: "translate", ar: ["ترجم", "ترجمه"], needs: "any", heavy: true, group: "do",
    hint: ["text or a file — say the language", "نص أو ملف — قول اللغة"] },
  { id: "scout", ar: ["دور", "دورلي", "كشاف"], needs: "text", heavy: false, group: "do",
    hint: ["find a car, a flat, a part — Scout keeps looking", "دوّرلي على عربية أو شقة أو قطعة غيار"] },
  { id: "travel", ar: ["سفر", "سافر", "سفريه"], needs: "text", heavy: false, group: "do",
    hint: ["a country → your trip page, pinned on Home", "بلد ← صفحة السفرية، متثبتة في الرئيسية"] },
  { id: "map", ar: ["خريطه", "خريطة", "روح", "وديني"], needs: "text", heavy: false, group: "do",
    hint: ["a place → the map and the way", "مكان ← الخريطة والطريق"] },
  { id: "metro", ar: ["مترو"], needs: "text", heavy: false, group: "do",
    hint: ["from … to … → the Metro route", "من … لـ … ← طريق المترو"] },
  { id: "web", ar: ["ابحث", "بحث", "نت"], needs: "text", heavy: true, group: "do",
    hint: ["search the web and answer with sources", "دوّر على النت وجاوب بالمصادر"] },
  { id: "remember", ar: ["افتكر", "احفظ"], needs: "any", heavy: false, group: "mind",
    hint: ["a photo, video, recording or note — “as …”", "صورة أو فيديو أو تسجيل أو ملاحظة — «على إنه …»"] },
  { id: "find", ar: ["لاقي", "هات", "فين"], needs: "text", heavy: false, group: "mind",
    hint: ["bring back anything you kept", "هات أي حاجة حفظتها"] },
  { id: "todo", ar: ["مهام", "مهمه", "تودو"], needs: "", heavy: false, group: "mind",
    hint: ["add to your to-do list, or see it", "ضيف للمهام أو شوفها"] },
  { id: "remind", ar: ["فكرني", "منبه"], needs: "text", heavy: false, group: "mind",
    hint: ["at a time, every day, or when someone messages", "في ميعاد، كل يوم، أو لما حد يبعتلك"] },
  { id: "subtitles", ar: ["ترجمه_فيديو", "سب", "ترجمه-فيديو"], needs: "file", heavy: true, group: "do",
    hint: ["a video → its subtitles (.srt)", "فيديو ← الترجمة المكتوبة (.srt)"] },
];
const BY_NAME = (() => {
  const m = new Map();
  for (const c of COMMANDS) { m.set(c.id, c); for (const a of c.ar) m.set(fold(a), c); }
  m.set("todos", m.get("todo")); m.set("to-do", m.get("todo")); m.set("tasks", m.get("todo")); m.set("subs", m.get("subtitles"));
  m.set("search", m.get("web")); m.set("go", m.get("map")); m.set("trip", m.get("travel")); m.set("note", m.get("remember"));
  return m;
})();
export const commandById = (id) => COMMANDS.find((c) => c.id === id) || null;

/** The commands that start with what was typed after "/" (the list under the box). "" → all of them. */
export function commandsMatching(prefix) {
  const p = fold(String(prefix || "").replace(/^\//, ""));
  if (!p) return COMMANDS.slice();
  return COMMANDS.filter((c) => c.id.startsWith(p) || c.ar.some((a) => fold(a).startsWith(p)));
}

// ---- languages, file formats, countries ----------------------------------------------------------------------------------------
const LANG_WORDS = [["ar", "arabic|عربي|العربي|العربيه"], ["en", "english|انجليزي|الانجليزي|الإنجليزي|انجلش"], ["tr", "turkish|تركي|التركي"], ["fr", "french|فرنساوي|الفرنساوي|فرنسي"],
  ["es", "spanish|اسباني|الاسباني"], ["de", "german|الماني|الالماني"], ["it", "italian|ايطالي|الايطالي"], ["pt", "portuguese|برتغالي"], ["ru", "russian|روسي|الروسي"],
  ["zh", "chinese|صيني|الصيني"], ["ja", "japanese|ياباني"], ["ko", "korean|كوري"], ["hi", "hindi|هندي"], ["ur", "urdu|اردو|الاردو"], ["id", "indonesian|اندونيسي"],
  ["fa", "persian|farsi|فارسي"], ["nl", "dutch|هولندي"]];
/** A language's English name for a job's title ("fr" → "French"). */
export const langName = (code) => { const w = (LANG_WORDS.find((x) => x[0] === code) || [])[1]; return w ? w.split("|")[0][0].toUpperCase() + w.split("|")[0].slice(1) : code; };
/** The language asked for: "to Turkish", «للتركي», "in French" → "tr" / "fr"; null when none is named. */
export function langIn(text) {
  const t = fold(text);
  for (const [code, w] of LANG_WORDS) if (new RegExp(`(^|[\\s/«(])(?:to |into |in |ل|لل|بال|ب)?(?:${w})(?=$|[\\s.,!?؟»)])`).test(t)) return code;
  return null;
}
/** Removes "to Turkish" / «للتركي» from the text to translate. */
export function stripLang(text) {
  let t = String(text || "");
  for (const [, w] of LANG_WORDS) t = t.replace(new RegExp(`(^|\\s)(?:to |into |in )?(?:ل|لل|بال|ب)?(?:${w})(?=$|[\\s.,!?؟:])\\s*:?`, "i"), "$1");
  return t.replace(/^\s*[:\-–]\s*/, "").trim();
}
const FMT = [["pdf", /\bpdf\b|بي دي اف/], ["docx", /\b(word|docx?)\b|وورد|ورد/], ["xlsx", /\b(excel|xlsx?|sheet)\b|اكسل|إكسل/], ["pptx", /\b(powerpoint|pptx?|slides)\b|باوربوينت/],
  ["jpg", /\b(jpe?g|photo|picture|image)\b|صوره|صور/], ["png", /\bpng\b/], ["txt", /\b(text|txt)\b|نص/], ["csv", /\bcsv\b/]];
/** The file type asked for: "to PDF", «لـ وورد» → "pdf" / "docx" (the LAST one named, "Word to PDF" → pdf). */
export function formatIn(text) {
  const t = fold(text); let best = null, at = -1;
  for (const [k, rx] of FMT) { const m = t.match(new RegExp(rx.source, "g")); if (m) { const i = t.lastIndexOf(m[m.length - 1]); if (i > at) { at = i; best = k; } } }
  return best;
}
const ISO = "ad ae af ag al am ao ar at au az ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz ca cd cf cg ch ci cl cm cn co cr cu cv cy cz de dj dk dm do dz ec ee eg er es et fi fj fm fr ga gb gd ge gh gm gn gq gr gt gw gy hn hr ht hu id ie il in iq ir is it jm jo jp ke kg kh ki km kn kp kr kw kz la lb lc li lk lr ls lt lu lv ly ma mc md me mg mh mk ml mm mn mr mt mu mv mw mx my mz na ne ng ni nl no np nr nz om pa pe pg ph pk pl ps pt pw py qa ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz td tg th tj tl tm tn to tr tt tv tz ua ug us uy uz va vc ve vn vu ws ye za zm zw".split(" ");
const C_ALIAS = { tr: "turkey|turkiye|türkiye|تركيا", ae: "uae|emirates|dubai|abu dhabi|الامارات|دبي|ابوظبي", gb: "uk|england|britain|london|انجلترا|بريطانيا|لندن", us: "usa|america|امريكا|أمريكا",
  sa: "saudi|ksa|riyadh|jeddah|السعوديه|الرياض|جده", eg: "egypt|مصر", kr: "korea|كوريا", nl: "holland|هولندا", cz: "czechia", ru: "russia|روسيا", ma: "morocco|المغرب", ge: "georgia|جورجيا",
  my: "malaysia|ماليزيا", id: "indonesia|bali|اندونيسيا|بالي", th: "thailand|تايلاند", mv: "maldives|المالديف", it: "italy|ايطاليا", fr: "france|paris|فرنسا|باريس", de: "germany|المانيا", es: "spain|اسبانيا", gr: "greece|اليونان", jo: "jordan|الاردن", lb: "lebanon|لبنان", qa: "qatar|قطر", kw: "kuwait|الكويت", om: "oman|عمان", bh: "bahrain|البحرين", cn: "china|الصين", jp: "japan|اليابان", in: "india|الهند", pk: "pakistan|باكستان", za: "south africa|جنوب افريقيا" };
let C_NAMES = null;
function countryNames() {
  if (C_NAMES) return C_NAMES;
  const out = [];
  for (const loc of ["en", "ar"]) { let dn = null; try { dn = new Intl.DisplayNames([loc], { type: "region" }); } catch (e) {} if (!dn) continue;
    for (const c of ISO) { try { const n = dn.of(c.toUpperCase()); if (n && n.toUpperCase() !== c.toUpperCase()) out.push([fold(n), c]); } catch (e) {} } }
  for (const [c, w] of Object.entries(C_ALIAS)) for (const n of w.split("|")) out.push([fold(n), c]);
  C_NAMES = out.filter(([n]) => n.length >= 3).sort((a, b) => b[0].length - a[0].length);   // longest first ("south africa" before "africa")
  return C_NAMES;
}
/** The country named in a sentence → its ISO code ("tr"), or null. Words only (no "oman" inside "romania"). */
export function countryIn(text) {
  const t = " " + fold(text).replace(/[.,!?؟:;«»()]/g, " ") + " ";
  for (const [n, c] of countryNames()) if (t.includes(" " + n + " ") || t.includes(" ل" + n + " ") || t.includes(" ب" + n + " ")) return c;
  return null;
}

// ---- the readers for plain sentences ---------------------------------------------------------------------------------------------
const RX = {
  todoAdd: /\b(add|put|write)\b.{1,120}?\b(to|on|in)\s+(my\s+|the\s+)?(to-?do|todo|tasks?)(\s+list)?\b|^\s*(to-?do|todo)\s*[:\-]|(ضيف|حط|اكتب|زود).{1,120}?(المهام|للمهام|مهامي|التودو|للتودو|التو دو|ليسته المهام|قايمه المهام|قائمه المهام|الليسته|لليسته)|^\s*(مهمه|تودو)\s*[:\-]/i,
  todoList: /\b(what('?s| is| are)|show( me)?|list|read)\b.{0,30}\b(to-?do|todo|tasks?)\b|\bmy (to-?do|todo)( list)?\s*[?؟]?$|(ايه|إيه|وريني|هات|قولي).{0,25}(المهام|التودو|مهامي)|^(المهام|مهامي)\s*[?؟]?$/i,
  whereAsk: /\bwhere\b.{0,40}\b(my|the|our)\b|\bwhere (do|did) i (usually )?(put|leave|keep)\b|(فين|حطيت|بحط|بنحط|سبت|سايب).{0,30}(فين|عاده|عادة|دايما)|^(فين)\s+\S+/i,
  whereSet: /^(remember( that)?\s+)?(my|the|our)\s+.{2,40}?\s+(is|are)\s+(now\s+)?(in|on|under|inside|at|behind|beside|next to|in the|on the)\b|\bi (put|left|keep|placed)\s+(my|the)\s+.{2,40}?\s+(in|on|under|inside|at|behind|beside)\b|^(افتكر|خلي في بالك)?\s*(ان|إن)?\s*(ال\S+|\S+ بتاعي|\S+ بتاعتي)\s+(في|على|علي|تحت|جوه|جنب|ورا)\s+|(حطيت|سبت|سايب|شلت)\s+\S+.{0,30}(في|على|علي|تحت|جوه|جنب|ورا)\s+/i,
  mapGo: /\b(how (do|can) i (get|go) to|i (want|need) to go to|take me to|directions to|navigate to|show me .{0,20}on the map|on the map)\b|(عايز|عاوز|محتاج)\s+(اروح|أروح)|(ازاي|إزاي)\s+(اروح|أروح|اوصل|أوصل)|وديني|على الخريطه|فين مكان/i,
  whereIs: /^\s*(where('?s| is| are)|فين)\s+\S+/i,
  travel: /\b(travel(l?ing)? to|trip to|going to|flying to|visit(ing)?|holiday in|vacation in)\b|(مسافر|هسافر|رايح|سفريه|رحله|هروح)\s/i,
  translate: /^\s*translate\b|\btranslate (this|it|that|to|into)\b|\bin (english|arabic|turkish|french)\s*[?؟]?$|^\s*(ترجم|ترجملي|ترجمي)/i,
  humanize: /\bhumani[sz]e\b|\bmake (it|this) sound (human|natural|like me)\b|\bsound less like (ai|a robot)\b|(خلي|خليه|خليها) (الكلام )?(طبيعي|طبيعيه|بشري)/i,
  convert: /\bconvert\b|\bturn (this|it) into\b|\b(to|into) (pdf|word|docx|excel|xlsx)\b|(حول|حوّل|حولي|اعمله|خليه)\s*.{0,20}(pdf|بي دي اف|وورد|ورد|اكسل|إكسل)/i,
  remember: /^\s*(remember|keep|save)\b.{0,20}\b(this|it|that)\b.{0,10}\bas\b|^\s*remember\s*:|^\s*(افتكر|احفظ)\s*(ده|دي|دا|الصوره|الفيديو|التسجيل)?\s*(على انه|علي انه|على انها|انه|إنه|إنها)/i,
  find: /\b(remind me of|show me|find|bring (back|up)|where('?s| is)) (the|my|that)? ?(photo|picture|pic|video|clip|recording|voice note|audio|file|document|screenshot)\b|(فكرني|هات|وريني|لاقيلي)\s*(ب)?(الصوره|صوره|الفيديو|فيديو|التسجيل|تسجيل|الريكورد|الفويس|الملف|ملف)/i,
  note: /^(note|remember|keep in mind|save this|write down)\b[:\s]|^(افتكر|خلي في بالك|احفظ|سجل ملاحظه|ملاحظه)\s*[:\s]/i,
  web: /\b(search (the )?(web|internet|online)|look (it )?up online|google it|latest news on|what('?s| is) the price of)\b|(دور|ابحث)\s*(على|في)\s*(النت|جوجل)|سعر .{2,30} النهارده/i,
};
export const READERS = RX;

/** "add buy milk to my to-do list" → "buy milk"; «ضيف اشتري لبن للمهام» → «اشتري لبن». */
export function todoText(text) {
  let t = String(text || "").trim();
  let m = t.match(/^\s*(?:to-?do|todo|مهمه|مهمة|تودو)\s*[:\-]\s*(.+)$/i); if (m) return m[1].trim();
  m = t.match(/^\s*(?:please\s+)?(?:add|put|write)\s+(.+?)\s+(?:to|on|in)\s+(?:my\s+|the\s+)?(?:to-?do|todo|tasks?)(?:\s+list)?\s*[.!]?$/i); if (m) return m[1].replace(/^["“«]|["”»]$/g, "").trim();
  m = t.match(/^\s*(?:ضيف|حط|اكتب|زود)\s+(.+?)\s+(?:في |على |علي )?(?:للمهام|للتودو|لليستة|لليسته|المهام|التودو|التو دو|ليستة المهام|ليسته المهام|قايمة المهام|قايمه المهام|قائمة المهام|الليستة|الليسته)\s*[.!]?$/); if (m) return m[1].replace(/^["“«]|["”»]$/g, "").trim();
  return "";
}

// what each kind is called on the two answer buttons
export const KIND_LABEL = {
  do: ["Do it in the app", "اعملها في التطبيق"], scout: ["Start a Scout search", "ابدأ بحث في الكشّاف"], metro: ["Metro route", "طريق المترو"], map: ["Show it on the map", "وريني على الخريطة"],
  travel: ["Plan a trip", "خطط لسفرية"], todoAdd: ["Add to my to-do list", "ضيفها للمهام"], todoList: ["Show my to-do list", "وريني المهام"], whereSet: ["Remember where it is", "افتكر مكانها"],
  whereAsk: ["Where I keep it", "مكانها فين"], translate: ["Translate it", "ترجمها"], humanize: ["Make it sound like me", "خليها طبيعية"], convert: ["Convert the file", "حوّل الملف"],
  remember: ["Keep it in Mind", "احفظها في العقل"], find: ["Find what I kept", "هات اللي حفظته"], web: ["Search the web", "دوّر على النت"], chat: ["Ask Chat", "اسأل الشات"],
  automation: ["Make an automation", "اعمل أتمتة"], watch: ["Tell me when they message", "قولي لما يبعت"], mission: ["Start a mission", "ابدأ مهمة"],
};

/**
 * A sentence typed without "/" → what it could mean, best first: [{ kind, score }].
 * ctx (each from the tool's own reader, so nothing is guessed twice): doActions (Home's "do it" found actions), goal (Scout),
 * metro (a Metro question), automation, watch, mission, hasFile (something is attached), things (names kept in "where things are").
 */
export function guess(text, ctx = {}) {
  const t = String(text || "").trim(), f = fold(t);
  if (!t) return [];
  const c = [];
  const T = (rx) => rx.test(t) || rx.test(f);    // the Arabic patterns are written folded (ة → ه, أ → ا)
  const add = (kind, score) => { const o = c.find((x) => x.kind === kind); if (o) o.score = Math.max(o.score, score); else c.push({ kind, score }); };
  if (ctx.metro) add("metro", 0.92);
  if (ctx.automation) add("automation", 0.9);
  if (ctx.watch) add("watch", 0.9);
  if (ctx.mission) add("mission", 0.88);
  if (ctx.goal) add("scout", 0.9);
  if (T(RX.todoAdd) && todoText(t)) add("todoAdd", 0.93);
  else if (T(RX.todoList)) add("todoList", 0.92);
  const mine = /\b(my|our)\b|بتاعي|بتاعتي|بتاعنا/i.test(t);
  const thing = (ctx.things || []).some((n) => n && f.includes(fold(n)));
  if (T(RX.whereSet) && !/[?؟]\s*$/.test(t)) add("whereSet", mine || thing ? 0.86 : 0.62);
  if (T(RX.whereAsk) || (T(RX.whereIs) && (mine || thing))) add("whereAsk", mine || thing ? 0.86 : 0.62);
  if (T(RX.mapGo)) add("map", 0.84);
  else if (T(RX.whereIs) && !mine) add("map", thing ? 0.5 : 0.72);
  const country = countryIn(t);
  if (country && T(RX.travel)) add("travel", 0.8);
  else if (country && f.split(" ").length <= 3) add("travel", 0.55);
  if (country && T(RX.mapGo)) add("travel", 0.7);
  if (T(RX.translate)) add("translate", langIn(t) || ctx.hasFile ? 0.88 : 0.7);
  if (T(RX.humanize)) add("humanize", 0.88);
  if (T(RX.convert)) add("convert", ctx.hasFile && formatIn(t) ? 0.92 : ctx.hasFile ? 0.75 : 0.55);
  if (T(RX.remember) || (ctx.hasFile && /^\s*(remember|keep|save|افتكر|احفظ)\b/i.test(t))) add("remember", 0.88);
  if (T(RX.find)) add("find", 0.86);
  if (T(RX.note)) add("remember", 0.7);      // "remember to call mum" → a note in Mind (a sharper reader above wins)
  if (T(RX.web)) add("web", 0.78);
  if (ctx.doActions) add("do", /[?؟]\s*$/.test(t) ? 0.6 : 0.82);
  add("chat", 0.3);
  // a reminder ("remind me of the passport photo") is a reminder only when it has a time; else it is Find
  return c.sort((a, b) => b.score - a.score);
}

/** The kinds a sentence of this shape is about, plus its first words — what a choice is remembered by. */
export function signature(text, kinds) {
  const words = fold(text).replace(/[^\p{L}\p{N}\s]/gu, " ").split(" ").filter(Boolean).slice(0, 2).join(" ");
  return [...kinds].sort().join("|") + ":" + words;
}
export const PREFS_KEY = "attune:intent:prefs";
export function loadPrefs(store = typeof localStorage !== "undefined" ? localStorage : null) { try { return JSON.parse((store && store.getItem(PREFS_KEY)) || "{}") || {}; } catch (e) { return {}; } }
export function savePrefs(p, store = typeof localStorage !== "undefined" ? localStorage : null) { try { store && store.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {} return p; }
/** He ticked `kind` for this sentence: count it. Two of the same in a row → learned (no more asking); a different one resets. */
export function learn(prefs, sig, kind) {
  const p = { ...(prefs || {}) }, o = p[sig] || {};
  p[sig] = o.kind === kind ? { kind, n: (o.n || 0) + 1 } : { kind, n: 1 };
  return p;
}
export const learned = (prefs, sig) => { const o = (prefs || {})[sig]; return o && o.n >= 2 ? o.kind : null; };

/**
 * One meaning, or two to ask about. → { kind } | { ask: [kindA, kindB], sig } | { kind: "chat" }.
 * Ask only when two real meanings are close (within 0.15, both ≥ 0.5) and he has not taught Attune this kind of sentence.
 */
export function decide(cands, prefs, text) {
  const list = (cands || []).filter((x) => x.kind !== "chat" || cands.length === 1);
  if (!list.length) return { kind: "chat" };
  const [a, b] = list;
  if (!b || a.score - b.score > 0.15 || b.score < 0.5) return { kind: a.kind };
  const sig = signature(text, [a.kind, b.kind]);
  const k = learned(prefs, sig);
  if (k === a.kind || k === b.kind) return { kind: k, learned: true };
  return { ask: [a.kind, b.kind], sig };
}

/** "/translate to Turkish good morning" → { id, cmd, arg, to?, format?, country? }; null when it is not a command. */
export function parseCommand(text) {
  const m = String(text || "").match(/^\s*\/(\S+)\s*([\s\S]*)$/);
  if (!m) return null;
  const c = BY_NAME.get(fold(m[1])) || BY_NAME.get(m[1].toLowerCase());
  if (!c) return { id: null, name: m[1], arg: m[2].trim() };
  const arg = m[2].trim(), out = { id: c.id, cmd: c, arg };
  if (c.id === "translate") { out.to = langIn(arg); out.text = stripLang(arg); }
  if (c.id === "convert") out.format = formatIn(arg);
  if (c.id === "travel") out.country = countryIn(arg);
  if (c.id === "todo") out.add = /^(add|\+|ضيف)\s+/i.test(arg) ? arg.replace(/^(add|\+|ضيف)\s+/i, "").trim() : arg && !/^(list|show|وريني|ايه)$/i.test(arg) ? arg : "";
  return out;
}
