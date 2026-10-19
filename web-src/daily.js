/* ---- Daily: a lesson a day (with quizzes), and a news digest on topics you follow -------
   LEARN  You pick a topic (a language, crane hydraulics, Excel…). The model
          first plans a course from beginner to expert, then writes one
          lesson a day from that plan — each with a picture-like visual the
          app draws (a table, steps, cards, a comparison, bars, a timeline)
          and three key points. Every few lessons there is a quiz; what you
          get wrong comes back as a quick review in the next lessons (spaced
          repetition). A daily notification (and the home-screen widget)
          says what today's lesson is.
   NEWS   You follow topics (a team, a player, economics…). When you open it,
          the phone gathers the last day's articles and the model writes a
          short digest that cites every line — nothing from its own memory.

   Pure logic, no React — unit tested in tests/unit/daily.test.mjs.          */
import { review as fsrsReview, isLearned } from "./fsrs.js";

import { jsonFrom } from "./erp.js";
import { detectLoop, trimLoop, mathToText } from "./quality.js";

export const LEVELS = ["beginner", "intermediate", "advanced"];
const clean = (s, n = 200) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** The local calendar day of a moment, "2026-09-25". */
export function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** The next time "HH:MM" comes round (today if still ahead, else tomorrow). */
export function nextAt(hhmm, now = Date.now()) {
  const [h, m] = String(hhmm || "08:00").split(":").map(Number);
  const d = new Date(now); d.setHours(h || 0, m || 0, 0, 0);
  if (d.getTime() <= now + 30000) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---- courses --------------------------------------------------------------------------
export function newCourse({ topic, level = "beginner", lang = "en", time = "08:00", quizEvery = 5, goal = "" }) {
  return { id: uid("c"), topic: clean(topic, 80), level: LEVELS.includes(level) ? level : "beginner", lang: lang === "ar" ? "ar" : "en",
    goal: clean(goal, 300), time, quizEvery: Math.max(2, Math.min(10, Number(quizEvery) || 5)), created: Date.now(),
    plan: [], lessons: [], quizzes: [], review: [], streak: 0, lastDay: "", notify: true };
}

/* v6.13 — ready courses: a fixed, well-ordered plan, so a course starts at once and never depends on the
   model planning it (Ali: "Turkish from beginner to expert in 30 small lessons"). Lessons are still written
   on the phone, one a day, from these titles. */
export const READY_COURSES = [
  { id: "turkish", emoji: "🇹🇷", topic: "Turkish", level: "beginner", quizEvery: 5,
    title: ["Turkish: beginner to expert in 30 lessons", "التركية: من المبتدئ إلى المتقدم في 30 درسًا"],
    plan: [["The Turkish alphabet and sounds (ç, ş, ğ, ı, ö, ü)", "الأبجدية التركية وأصواتها (ç، ş، ğ، ı، ö، ü)"], ["Greetings and introducing yourself", "التحية وتقديم نفسك"],
      ["Vowel harmony — the key rule of Turkish", "انسجام الحروف المتحركة — القاعدة الأساسية في التركية"], ["Numbers, prices and telling the time", "الأرقام والأسعار ومعرفة الوقت"],
      ["\"To be\": -im, -sin, -dir", "فعل الكينونة: ‎-im، ‎-sin، ‎-dir"], ["Plurals with -ler / -lar", "الجمع بـ ‎-ler / ‎-lar"],
      ["This, that, here, there", "هذا وذاك وهنا وهناك"], ["Possession: my, your, his (-im, -in, -i)", "الملكية: ‎-im، ‎-in، ‎-i"],
      ["Var / yok — there is, there isn't", "var / yok — يوجد ولا يوجد"], ["Present continuous: -iyor", "المضارع المستمر: ‎-iyor"],
      ["Cases 1: -e / -a (to) and -de / -da (at)", "الحالات 1: ‎-e/-a (إلى) و‎-de/-da (في)"], ["Cases 2: -den / -dan (from) and the object -i", "الحالات 2: ‎-den/-dan (من) والمفعول ‎-i"],
      ["Questions with mi and question words", "الأسئلة بـ mi وأدوات الاستفهام"], ["Shopping and bargaining at the bazaar", "التسوق والمساومة في السوق"],
      ["Simple past: -di", "الماضي البسيط: ‎-di"], ["Food, ordering and the restaurant", "الطعام والطلب في المطعم"],
      ["Future: -ecek / -acak", "المستقبل: ‎-ecek / ‎-acak"], ["Directions, transport and travel", "الاتجاهات والمواصلات والسفر"],
      ["The aorist: habits and offers (-ir, -er)", "المضارع العام: العادات والعروض (‎-ir، ‎-er)"], ["Can / can't: -ebil, -eme", "القدرة وعدمها: ‎-ebil، ‎-eme"],
      ["Must and should: -meli, lazım, gerek", "الوجوب والنصيحة: ‎-meli، lazım، gerek"], ["Comparing: daha, en, gibi", "المقارنة: daha، en، gibi"],
      ["Reported past: -miş", "الماضي المنقول: ‎-miş"], ["Conditionals: -se / -sa", "الشرط: ‎-se / ‎-sa"],
      ["Verb nouns: -mek, -me, -diği", "المصادر وصيغ الوصل: ‎-mek، ‎-me، ‎-diği"], ["Relative clauses: -en / -an, -dik", "صيغ الصلة: ‎-en/-an، ‎-dik"],
      ["Linking sentences: -ip, -ince, -ken, -erek", "ربط الجمل: ‎-ip، ‎-ince، ‎-ken، ‎-erek"], ["Polite and formal Turkish at work", "التركية المهذبة والرسمية في العمل"],
      ["Idioms and everyday expressions", "التعابير الاصطلاحية والعبارات اليومية"], ["Speaking like a native: rhythm, fillers and slang", "التحدث كأهل اللغة: الإيقاع والكلمات الرابطة والعامية"]] },
  { id: "english", emoji: "🇬🇧", topic: "English", level: "intermediate", quizEvery: 5,
    title: ["English for work: 30 lessons", "الإنجليزية للعمل: 30 درسًا"],
    plan: [["Present simple vs continuous", "المضارع البسيط والمستمر"], ["Past simple and past continuous", "الماضي البسيط والمستمر"], ["Present perfect: experience and results", "المضارع التام: الخبرة والنتائج"],
      ["Future forms: will, going to, present continuous", "صيغ المستقبل"], ["Articles: a, an, the, no article", "أدوات التعريف والتنكير"], ["Prepositions of time and place", "حروف الجر للزمان والمكان"],
      ["Countable and uncountable nouns", "الأسماء المعدودة وغير المعدودة"], ["Comparatives and superlatives", "صيغ المقارنة والتفضيل"], ["Modal verbs: can, must, should, might", "الأفعال الناقصة"],
      ["Conditionals 0, 1 and 2", "الجمل الشرطية 0 و1 و2"], ["Passive voice in reports", "المبني للمجهول في التقارير"], ["Reported speech", "الكلام المنقول"],
      ["Phrasal verbs for work", "الأفعال المركبة في العمل"], ["Writing a clear email", "كتابة بريد إلكتروني واضح"], ["Polite requests and replies", "الطلبات والردود المهذبة"],
      ["Talking about numbers, prices and dates", "التحدث عن الأرقام والأسعار والتواريخ"], ["Meetings: agreeing and disagreeing", "الاجتماعات: الموافقة والاعتراض"], ["Phone and video calls", "المكالمات الهاتفية والمرئية"],
      ["Describing problems and solutions", "وصف المشكلات والحلول"], ["Negotiating", "التفاوض"], ["Presenting your company", "تقديم شركتك"],
      ["Writing a report", "كتابة تقرير"], ["Linking words: however, therefore, although", "أدوات الربط"], ["Relative clauses: who, which, that", "جمل الصلة"],
      ["Conditionals 3 and mixed", "الشرط الثالث والمختلط"], ["Formal vs informal English", "الإنجليزية الرسمية وغير الرسمية"], ["Common mistakes Arabic speakers make", "أخطاء شائعة لدى متحدثي العربية"],
      ["Pronunciation: stress and linking", "النطق: النبر والوصل"], ["Idioms used at work", "تعابير اصطلاحية في العمل"], ["Job interviews in English", "مقابلات العمل بالإنجليزية"]] },
  { id: "hydraulics", emoji: "🏗️", topic: "Crane hydraulics", level: "beginner", quizEvery: 4,
    title: ["Crane hydraulics: 20 lessons", "هيدروليك الرافعات: 20 درسًا"],
    plan: [["Pressure, flow and force — Pascal's law", "الضغط والتدفق والقوة — قانون باسكال"], ["Hydraulic oil: grades, heat and contamination", "زيت الهيدروليك: الدرجات والحرارة والتلوث"], ["Pumps: gear, vane and piston", "المضخات: التروس والريش والمكابس"],
      ["Variable displacement and load sensing", "الإزاحة المتغيرة واستشعار الحمل"], ["Directional control valves and spools", "صمامات التحكم الاتجاهي والبكرات"], ["Relief and pressure-reducing valves", "صمامات التنفيس وخفض الضغط"],
      ["Counterbalance and holding valves", "صمامات الموازنة والتثبيت"], ["Cylinders: lift, telescope, outriggers", "الأسطوانات: الرفع والتلسكوب وأرجل التثبيت"], ["Hydraulic motors: hoist and slew", "المحركات الهيدروليكية: الونش والدوران"],
      ["Accumulators and filters", "المراكم والمرشحات"], ["Hoses, fittings and seals", "الخراطيم والوصلات والحشوات"], ["Reading a hydraulic circuit diagram", "قراءة مخطط الدائرة الهيدروليكية"],
      ["Proportional and electro-hydraulic control", "التحكم التناسبي والكهروهيدروليكي"], ["The LMI and hydraulic pressure sensors", "جهاز LMI وحساسات الضغط"], ["Drift and creep: finding internal leaks", "الانزلاق والزحف: اكتشاف التسريب الداخلي"],
      ["Cavitation and aeration", "التكهف ودخول الهواء"], ["Overheating: causes and fixes", "ارتفاع الحرارة: الأسباب والحلول"], ["Troubleshooting step by step", "تشخيص الأعطال خطوة بخطوة"],
      ["Maintenance schedule and oil analysis", "جدول الصيانة وتحليل الزيت"], ["Safety: stored energy and lock-out", "السلامة: الطاقة المخزنة والعزل"]] },
];
/** A ready course → a course with its plan in the chosen language (no model call). */
export function readyCourse(id, { lang = "en", time = "08:00" } = {}) {
  const r = READY_COURSES.find((x) => x.id === id); if (!r) return null;
  const i = lang === "ar" ? 1 : 0;
  return { ...newCourse({ topic: r.topic, level: r.level, lang, time, quizEvery: r.quizEvery }), title: r.title[i], plan: r.plan.map((p) => p[i]), ready: r.id };
}

const LANG_NOTE = { en: "Write in clear, simple English.", ar: "اكتب بالعربية الفصحى المبسطة، واذكر المصطلحات التقنية بالإنجليزية بين قوسين." };

export function planMessages(c) {
  return [
    { role: "system", content: `You are an expert teacher planning a daily course. Reply with JSON only: {"title": "<course title>", "lessons": ["<lesson 1 title>", ...]}.
Plan 30 lessons that take a ${c.level} learner step by step towards expert level in the topic. Each lesson is one small idea that fits in 5 minutes; order them so each builds on the ones before; mix explanation with practical use. Titles short and concrete. ${c.lang === "ar" ? "Titles in Arabic." : "Titles in English."}` },
    { role: "user", content: `Topic: ${c.topic}${c.goal ? "\nMy goal: " + c.goal : ""}` },
  ];
}
export function parsePlan(text) {
  const j = jsonFrom(text);
  const list = j && (Array.isArray(j.lessons) ? j.lessons : Array.isArray(j.plan) ? j.plan : null);
  const titles = (list || []).map((x) => clean(typeof x === "string" ? x : x && (x.title || x.name), 90)).filter((x) => x.length > 2);
  if (titles.length >= 5) return { title: clean(j.title, 90), plan: [...new Set(titles)].slice(0, 60) };
  // a numbered list instead of JSON is fine too
  const lines = String(text || "").split("\n").map((l) => l.match(/^\s*\d+[.)-]\s*(.+)$/)).filter(Boolean).map((m) => clean(m[1].replace(/\*+/g, ""), 90));
  if (lines.length >= 5) return { title: "", plan: [...new Set(lines)].slice(0, 60) };
  // v6.8 (Glow 2B): the model repeated one title until the length limit, so the JSON never closed —
  // the titles written before the cut are kept (repeats dropped)
  const cut = String(text || "").match(/"(?:lessons|plan)"\s*:\s*\[([\s\S]*)/);
  if (cut) {
    const got = [...new Set([...cut[1].matchAll(/"((?:[^"\\]|\\.){3,200})"/g)].map((m) => clean(m[1], 90)).filter((x) => x.length > 2))];
    const title = (String(text).match(/"title"\s*:\s*"([^"]{2,120})"/) || [])[1] || "";
    if (got.length >= 5) return { title: clean(title, 90), plan: got.slice(0, 60) };
  }
  return null;
}

const VISUALS = `The visual is drawn by the app; choose the kind that teaches this lesson best:
{"kind":"table","title":"..","columns":["..",".."],"rows":[["..",".."]]}          e.g. a conjugation, a comparison of values
{"kind":"steps","title":"..","items":["..",".."]}                                  e.g. a process, a hydraulic circuit's path
{"kind":"cards","title":"..","items":[{"front":"..","back":"..","note":".."}]}     e.g. new words: word → meaning, example
{"kind":"compare","title":"..","left":{"title":"..","items":[".."]},"right":{"title":"..","items":[".."]}}
{"kind":"bars","title":"..","unit":"..","items":[{"label":"..","value":12}]}
{"kind":"timeline","title":"..","items":[{"when":"..","what":".."}]}`;

/** «{"visual": {…}}, "keyPoints": […]}» — a closing brace too many ends the object early; drop it. */
export function dropExtraBraces(text) {
  let s = String(text || ""), depth = 0, inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (ch === "\\") i++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0 && /^\s*,/.test(s.slice(i + 1))) { s = s.slice(0, i) + s.slice(i + 1); depth = 1; i--; }
    }
  }
  return s;
}
/** A course that teaches a language (Turkish, English, لغة…) — only those get translation + pronunciation lines. */
export function isLanguageCourse(topic) {
  return /\b(language|turkish|english|french|german|spanish|italian|arabic|japanese|chinese|korean|russian|vocabulary|grammar|speak|speaking|conversation|pronunciation)\b|لغ[ةه]|اللغة|تركي|انجليزي|إنجليزي|فرنساوي|فرنسي|ألماني|الماني|اسباني|إسباني|ايطالي|إيطالي|ياباني|صيني|كوري|روسي|مفردات|قواعد|محادثة|نطق/i.test(String(topic || ""));
}
/** The lesson for day n (0-based) of the plan. */
export function lessonMessages(c, n) {
  const title = c.plan[n] || `Lesson ${n + 1}`;
  const before = c.plan.slice(Math.max(0, n - 8), n);
  const review = reviewDue(c);
  return [
    { role: "system", content: `You are a warm, expert teacher writing today's 5-minute lesson of a daily course on "${c.topic}" for a ${c.level} learner. ${LANG_NOTE[c.lang]}
Write the lesson in Markdown: a one-line hook, then 2–4 short sections with ## headings, concrete examples${isLanguageCourse(c.topic) ? " (example sentences with translation and pronunciation)" : " from real work and life"}, and one tiny practice task at the end under "## Try it". No LaTeX. Every fact must be technically correct — a plain true sentence beats a dramatic comparison; no exaggerated claims.${review.length ? " Start with a 2-line \"## Quick review\" of: " + review.join("; ") + "." : ""}
Then, at the very end, a JSON block:
\`\`\`json
{"visual": <one diagram>, "cards": [{"front": "..", "back": "..", "note": ".."}], "keyPoints": ["<3 short things to remember>"]}   (all three keys are required)
\`\`\`
"cards" = 4–6 flashcards of this lesson (front: a word, term or question; back: its meaning or answer; note: a short example).
"visual" = ONE diagram that is not cards — a table, steps, compare, bars or timeline. ${VISUALS}` },
    { role: "user", content: `Lesson ${n + 1}: ${title}` + (before.length ? `\n(Already covered: ${before.join("; ")} — don't repeat them.)` : "") + (c.goal ? `\nMy goal: ${c.goal}` : "") },
  ];
}

export function normVisual(v) {
  if (!v || typeof v !== "object") return null;
  const kind = String(v.kind || v.type || "").toLowerCase();
  const title = clean(v.title, 80);
  const arr = (a, n = 12) => (Array.isArray(a) ? a.slice(0, n) : []);
  if (kind === "table") {
    const columns = arr(v.columns, 6).map((x) => clean(x, 40));
    const rows = arr(v.rows, 14).map((r) => (Array.isArray(r) ? r : Object.values(r || {})).slice(0, columns.length || 6).map((x) => clean(x, 60)));
    return columns.length && rows.length ? { kind, title, columns, rows } : null;
  }
  if (kind === "steps") { const items = arr(v.items || v.steps, 8).map((x) => clean(typeof x === "string" ? x : x && (x.text || x.title), 120)).filter(Boolean); return items.length >= 2 ? { kind, title, items } : null; }
  if (kind === "cards") { const items = arr(v.items || v.cards, 10).map((x) => ({ front: clean(x && (x.front || x.term || x.word), 60), back: clean(x && (x.back || x.meaning), 90), note: clean(x && (x.note || x.example), 120) })).filter((x) => x.front && x.back); return items.length ? { kind, title, items } : null; }
  if (kind === "compare") {
    const side = (s) => ({ title: clean(s && s.title, 40), items: arr(s && s.items, 8).map((x) => clean(x, 100)).filter(Boolean) });
    const l = side(v.left), r = side(v.right);
    return l.items.length && r.items.length ? { kind, title, left: l, right: r } : null;
  }
  if (kind === "bars") { const items = arr(v.items, 10).map((x) => ({ label: clean(x && x.label, 30), value: Number(x && x.value) })).filter((x) => x.label && isFinite(x.value)); return items.length >= 2 ? { kind, title, unit: clean(v.unit, 12), items } : null; }
  if (kind === "timeline") { const items = arr(v.items, 10).map((x) => ({ when: clean(x && (x.when || x.date), 30), what: clean(x && (x.what || x.event), 120) })).filter((x) => x.what); return items.length >= 2 ? { kind, title, items } : null; }
  return null;
}

/** "…markdown… ```json {visual, keyPoints}```" → { body, visual, keyPoints } */
export function parseLesson(text) {
  const t = String(text || "");
  // the JSON block at the end — tolerant of a stray backtick («}`»), a missing closing fence, or no fence at all
  const m = t.match(/```(?:json)?\s*(\{[\s\S]*\})`*\s*(```)?\s*$/) || t.match(/```(?:json)?\s*(\{[\s\S]*?"(?:keyPoints|visual)"[\s\S]*\})`*\s*```/)
    || t.match(/\n(\{\s*"(?:visual|keyPoints)"[\s\S]*\})\s*$/);
  let body = (m ? t.slice(0, m.index) : t).trim();
  const j = m ? jsonFrom(m[1]) || jsonFrom(dropExtraBraces(m[1])) : null;
  let keyPoints = j && Array.isArray(j.keyPoints) ? j.keyPoints.map((x) => clean(x, 160)).filter(Boolean).slice(0, 5) : [];
  if (!keyPoints.length) {       // fall back to a "Key points" list in the text
    const k = body.match(/##\s*(key points|remember|تذكر|أهم النقاط)[^\n]*\n([\s\S]*?)(\n##|$)/i);
    if (k) keyPoints = k[2].split("\n").map((l) => clean(l.replace(/^\s*[-*•\d.)]+\s*/, ""), 160)).filter(Boolean).slice(0, 5);
  }
  let visual = j ? normVisual(j.visual) : null;
  // v6.34 (Ali: "diagrams and flashcards inside the lesson"): the flashcards are their own list; a "cards" visual goes there
  let cards = j && Array.isArray(j.cards) ? (normVisual({ kind: "cards", items: j.cards }) || { items: [] }).items.slice(0, 8) : [];
  if (visual && visual.kind === "cards") { if (!cards.length) cards = visual.items; visual = null; }
  if (!keyPoints.length && cards.length >= 2) keyPoints = cards.map((x) => clean(x.back ? `${x.front}: ${x.back}` : x.front, 160)).filter(Boolean).slice(0, 3);   // the flashcards are the key facts
  if (!keyPoints.length && visual) {   // the model left them out: the visual's steps / timeline are the lesson's key facts
    const items = visual.kind === "cards" ? visual.items.map((x) => (x.back ? `${x.front}: ${x.back}` : x.front))
      : visual.kind === "steps" ? visual.items : visual.kind === "timeline" ? visual.items.map((x) => `${x.when}: ${x.what}`) : [];
    keyPoints = items.map((x) => clean(x, 160)).filter(Boolean).slice(0, 3);
  }
  if (!keyPoints.length) {             // else the first sentence of each section
    keyPoints = [...body.matchAll(/^##\s*([^\n]+)\n+([^\n]+)/gm)].filter((m) => !/try it|جر[ّ]?ب|quick review|مراجعة/i.test(m[1]))
      .map((m) => clean(m[2].replace(/^\s*[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").split(/(?<=[.!؟?])\s/)[0], 160)).filter(Boolean).slice(0, 3);
  }
  body = body.replace(/\$\$?([^$\n]+)\$\$?/g, "$1");
  return { body, visual, keyPoints, cards };
}

// v6.28 spaced repetition: a missed question is reviewed in a lesson, then again after 2, 5, 12 and 30 days (each time a little
// further apart, the way memory holds best); after the last review it is learned and leaves the list. Missed again in a quiz → it
// starts over. c.review stays the list of what to review (text); c.srs holds when each comes back: { [text]: { box, due } }.
export const SRS_DAYS = [2, 5, 12, 30];
/** Up to two review items due now, the most overdue first. */
export function reviewDue(c, now = Date.now(), max = 2) {
  const srs = c.srs || {};
  return (c.review || []).filter((t) => !srs[t] || srs[t].due <= now).sort((a, b) => ((srs[a] || {}).due || 0) - ((srs[b] || {}).due || 0)).slice(0, max);
}
/** How many are waiting, and when the next one comes back (for the course screen). */
export function reviewStatus(c, now = Date.now()) {
  const srs = c.srs || {}, list = c.review || [];
  const due = list.filter((t) => !srs[t] || srs[t].due <= now).length;
  const later = list.filter((t) => srs[t] && srs[t].due > now).map((t) => srs[t].due).sort((a, b) => a - b);
  const learned = c.learned || 0;
  return { due, waiting: list.length - due, next: later[0] || null, learned };
}
export function addLesson(c, n, parsed, { now = Date.now() } = {}) {
  const lesson = { n, title: c.plan[n] || `Lesson ${n + 1}`, ...parsed, made: now, day: "", done: false };
  const reviewed = reviewDue(c, now), srs = { ...(c.srs || {}) };
  let learned = c.learned || 0;
  const done = [];
  for (const t of reviewed) {
    const box = ((srs[t] && srs[t].box) || 0) + 1;
    if (box > SRS_DAYS.length) { delete srs[t]; done.push(t); learned++; } else srs[t] = { box, due: now + SRS_DAYS[box - 1] * 86400000 };
  }
  return { ...c, lessons: [...c.lessons.filter((l) => l.n !== n), lesson].sort((a, b) => a.n - b.n), review: (c.review || []).filter((x) => !done.includes(x)), srs, learned };
}

/** The lesson to show today: one already opened today, else the next not done (if made). */
export function todaysLesson(c, now = Date.now()) {
  const today = dayKey(now);
  return c.lessons.find((l) => l.day === today) || c.lessons.find((l) => !l.done) || null;
}
export function nextIndex(c) { return c.lessons.length ? Math.max(...c.lessons.map((l) => l.n)) + 1 : 0; }

/** Mark a lesson read today; keeps a streak of days in a row. */
export function markDone(c, n, now = Date.now()) {
  const today = dayKey(now), yest = dayKey(now - 86400000);
  const lessons = c.lessons.map((l) => (l.n === n ? { ...l, done: true, day: l.day || today } : l));
  const streak = c.lastDay === today ? c.streak : c.lastDay === yest ? c.streak + 1 : 1;
  const l = c.lessons.find((x) => x.n === n), was = c.lessons.find((x) => x.n === n && x.done);
  const c2 = { ...c, lessons, streak, lastDay: today };
  return l && !was ? addCards(c2, cardsFromLesson(l), n, { now }) : c2;
}
export function openLesson(c, n, now = Date.now()) {
  return { ...c, lessons: c.lessons.map((l) => (l.n === n && !l.day ? { ...l, day: dayKey(now) } : l)) };
}

// ---- quizzes --------------------------------------------------------------------------------
export function quizDue(c) {
  const lastQuizAt = c.quizzes.length ? c.quizzes[c.quizzes.length - 1].after : -1;
  const done = c.lessons.filter((l) => l.done && l.n > lastQuizAt);
  return done.length >= c.quizEvery ? done : null;
}
export function quizMessages(c, lessons) {
  return [
    { role: "system", content: `Write a quiz on these lessons of a course on "${c.topic}" (${c.level}). ${c.lang === "ar" ? "Questions in Arabic." : "Questions in English."} Reply with JSON only:
{"questions": [{"q": "<question>", "options": ["<A>", "<B>", "<C>", "<D>"], "answer": <index 0-3 of the correct option>, "why": "<one-line explanation>"}]}
Write 5 questions that test understanding and use, not memorised wording. Exactly one option is correct; the wrong options must be plausible. Check each answer twice.` },
    { role: "user", content: lessons.map((l) => `Lesson ${l.n + 1}: ${l.title}\nKey points: ${(l.keyPoints || []).join("; ")}\n${String(l.body || "").slice(0, 700)}`).join("\n\n") },
  ];
}
function rng(seed) { let s = 0; for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
/** Valid questions only; options shuffled (small models like to put the answer first). */
export function parseQuiz(text, seed = "q") {
  const j = jsonFrom(text);
  const list = j && (Array.isArray(j.questions) ? j.questions : Array.isArray(j) ? j : null);
  const r = rng(seed);
  const out = [];
  for (const x of list || []) {
    const options = (Array.isArray(x && x.options) ? x.options : []).map((o) => clean(String(o).replace(/^[A-D][.)]\s*/, ""), 140));
    let a = typeof x.answer === "number" ? x.answer : /^[A-D]$/i.test(String(x.answer || "").trim()) ? "ABCD".indexOf(String(x.answer).trim().toUpperCase()) : options.findIndex((o) => o === clean(x.answer, 140));
    if (!x.q && !x.question) continue;
    if (options.length < 3 || options.length > 5 || new Set(options).size !== options.length || a < 0 || a >= options.length) continue;
    const order = options.map((o, i) => [r(), i]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    out.push({ q: clean(x.q || x.question, 300), options: order.map((i) => options[i]), answer: order.indexOf(a), why: clean(x.why || x.explanation, 300) });
  }
  return out.slice(0, 8);
}
/** A finished quiz: the score, and what was missed goes into the review list. */
export function finishQuiz(c0, quiz, picks, { now = Date.now() } = {}) {
  // v6.28: a missed question also becomes a card in the review deck (due now — it is reviewed first)
  const c = addCards(c0, quiz.questions.filter((q, i) => picks[i] !== q.answer).map((q) => ({ front: q.q, back: q.options[q.answer], note: q.why || "" })), Math.max(...quiz.lessons), { now, due: now });
  const right = quiz.questions.filter((q, i) => picks[i] === q.answer).length;
  const missed = quiz.questions.filter((q, i) => picks[i] !== q.answer).map((q) => clean(`${q.q} → ${q.options[q.answer]}`, 200));
  const rec = { after: Math.max(...quiz.lessons), score: right, total: quiz.questions.length, at: now };
  // (missed again → back to the start of the schedule; the list keeps up to 30)
  const srs = { ...(c.srs || {}) }; for (const t of missed) srs[t] = { box: 0, due: now };
  const review = [...missed, ...(c.review || []).filter((t) => !missed.includes(t))].slice(0, 30);
  for (const t of Object.keys(srs)) if (!review.includes(t)) delete srs[t];
  return { course: { ...c, quizzes: [...c.quizzes, rec], review, srs }, right, missed };
}

// ---- v6.28 the review deck: flash cards made BY CODE from each lesson, reviewed with no model ------------------------
// Ali: "finish Learn daily and rework its logic". A lesson read → its word cards, table rows, timeline and "term: meaning" key
// points become cards; a missed quiz question becomes a card too. Each card comes back after 1, 3, 7, 16 and 35 days while you
// know it, and starts over when you don't. The review needs no model, so it works on any phone, offline, every day.
export const CARD_DAYS = [1, 3, 7, 16, 35];   // (the old fixed schedule; v6.32 uses FSRS — kept so old cards carry over)
const DAY = 86400000;
const cardId = (front) => "k" + [...String(front).toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36);
/** One lesson → up to 8 cards {front, back, note}: only what the lesson itself states — nothing is invented. */
export function cardsFromLesson(l) {
  const out = [], v = l && l.visual;
  const add = (front, back, note = "") => { front = clean(front, 90); back = clean(back, 160); if (front.length >= 1 && back.length >= 1 && front.toLowerCase() !== back.toLowerCase() && !out.some((x) => x.front.toLowerCase() === front.toLowerCase())) out.push({ front, back, note: clean(note, 140) }); };
  for (const x of (l && l.cards) || []) add(x.front, x.back, x.note);
  if (v && v.kind === "cards") for (const x of v.items) add(x.front, x.back, x.note);
  if (v && v.kind === "table" && v.columns.length >= 2) for (const r of v.rows) add(r[0], r.slice(1).map((x, i) => (v.columns.length > 2 ? v.columns[i + 1] + ": " : "") + x).join(" · "), v.columns.length === 2 ? v.columns[0] + " → " + v.columns[1] : "");
  if (v && v.kind === "timeline") for (const x of v.items) if (x.when) add(x.when, x.what);
  if (v && v.kind === "steps" && v.items.length >= 2) add(v.title || l.title, v.items.map((x, i) => i + 1 + ". " + x).join("  "), "");
  for (const k of (l && l.keyPoints) || []) { const m = String(k).match(/^\s*([^:—=]{1,60}?)\s*(?::|—|=| - )\s*(.{2,})$/); if (m) add(m[1], m[2]); }
  return out.slice(0, 8);
}
/** Cards into the deck (a card already there keeps its place in the schedule). The first review is the next day. */
export function addCards(c, cards, n, { now = Date.now(), due = now + DAY } = {}) {
  const deck = [...(c.cards || [])];
  for (const x of cards) if (!deck.some((d) => d.id === cardId(x.front))) deck.push({ id: cardId(x.front), ...x, n, box: 0, due });
  return { ...c, cards: deck.slice(-400) };
}
/** The cards to review now, the most overdue first (at most 20 a day — a short session is one people keep doing). */
export function cardsDue(c, now = Date.now(), max = 20) {
  return (c.cards || []).filter((k) => k.due <= now).sort((a, b) => a.due - b.due).slice(0, max);
}
/** v6.32 FSRS: knew it (or a grade 1–4) → the card's memory stability and difficulty are updated from the answer and the real time
    since its last review, and it comes back when recall would fall to 90 % (fsrs.js). Didn't → tomorrow again. A card stable for
    half a year or more is learned for good and leaves the deck. Old box cards carry over without losing their progress. */
export function gradeCard(c, id, knew, now = Date.now()) {
  let learnedCards = c.learnedCards || 0;
  const cards = [];
  for (const k of c.cards || []) {
    if (k.id !== id) { cards.push(k); continue; }
    const k2 = fsrsReview(k, knew, now);
    if (isLearned(k2)) { learnedCards++; continue; }
    cards.push(k2);
  }
  return { ...c, cards, learnedCards };
}
/** The days in a row, as it stands today: a missed day breaks it (the saved number only changes when a lesson is read). */
export function streakNow(c, now = Date.now()) {
  return c.lastDay === dayKey(now) || c.lastDay === dayKey(now - DAY) ? c.streak || 0 : 0;
}
/** Today for one course, in order: review the cards → today's lesson → the quiz. Each step: {kind, done, …}. */
export function todayPlan(c, now = Date.now()) {
  const steps = [], due = cardsDue(c, now).length, reviewedToday = c.reviewDay === dayKey(now);
  if (due || reviewedToday) steps.push({ kind: "review", n: due, done: !due });
  const t = todaysLesson(c, now), next = nextIndex(c);
  if (t) steps.push({ kind: "lesson", lesson: t, done: !!t.done });
  else if (next < c.plan.length) steps.push({ kind: "lesson", n: next, title: c.plan[next], done: false, needsWriting: true });
  const q = quizDue(c);
  if (q) steps.push({ kind: "quiz", lessons: q, done: false });
  const doneN = c.lessons.filter((l) => l.done).length;
  return { steps, left: steps.filter((x) => !x.done).length, finished: doneN >= c.plan.length && c.plan.length > 0 && !q && !due };
}
/** Plain words of a text, for comparing (letters in any language, 3+ long). */
const wordsOf = (t) => new Set((String(t || "").toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) || []));
/** All a lesson says: body, key points, visual. */
export function lessonText(l) {
  const v = l.visual, vis = !v ? "" : JSON.stringify(v);
  return [l.title, l.body, ...(l.keyPoints || []), vis].join("\n");
}
/** v6.28 code check on a written quiz: a question is dropped when the lessons back a WRONG option and say nothing of the right one
   (the model mis-marked it), or when two options are the same once trimmed. What stays is safer to score. */
export function groundQuiz(questions, lessons) {
  const known = wordsOf(lessons.map(lessonText).join("\n"));
  const support = (o) => { const w = [...wordsOf(o)]; return w.length ? w.filter((x) => known.has(x)).length / w.length : null; };
  return questions.filter((q) => {
    const norm = q.options.map((o) => o.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
    if (new Set(norm).size !== norm.length) return false;
    const right = support(q.options[q.answer]);
    if (right === null || right > 0) return true;
    return !q.options.some((o, i) => i !== q.answer && (support(o) || 0) >= 0.6);
  });
}

/** What the notification and the widget say. */
export function lessonNotice(c) {
  const next = c.lessons.find((l) => !l.done);
  const n = next ? next.n : nextIndex(c);
  const title = next ? next.title : c.plan[n] || "";
  const cards = cardsDue(c, nextAt(c.time) + 60000).length;
  const extra = (quizDue(c) ? (c.lang === "ar" ? " — ومعه اختبار قصير" : " — and a short quiz") : "") + (cards ? (c.lang === "ar" ? ` · ${cards === 1 ? "بطاقة واحدة" : cards + " بطاقات"} للمراجعة` : ` · ${cards} card${cards === 1 ? "" : "s"} to review`) : "");
  return { title: `${c.topic} · ${c.lang === "ar" ? "الدرس" : "Lesson"} ${n + 1}`, body: title ? title + extra : (c.lang === "ar" ? "درس اليوم جاهز" : "Today's lesson is waiting") + extra };
}

// ---- news -------------------------------------------------------------------------------------
export function newTopic({ query, lang = "en", time = "08:30" }) {
  return { id: uid("n"), query: clean(query, 80), lang: lang === "ar" ? "ar" : "en", time, created: Date.now(), digests: [], notify: true };
}
const normTitle = (t) => String(t || "").toLowerCase().replace(/\s[-–|]\s[^-–|]+$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function simTitle(a, b) {
  const A = new Set(normTitle(a).split(" ").filter((w) => w.length > 2)), B = new Set(normTitle(b).split(" ").filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let k = 0; for (const w of A) if (B.has(w)) k++;
  return k / Math.min(A.size, B.size);
}
/** Articles from the feed + pages read: newest first, the same story told twice kept once, yesterday's stories dropped. */
export function mergeNews(items, seen = [], { now = Date.now(), maxAgeH = 36 } = {}) {
  const out = [];
  const sorted = [...(items || [])].filter((x) => x && x.title && x.url).sort((a, b) => (b.date || 0) - (a.date || 0));
  for (const it of sorted) {
    if (it.date && now - it.date > maxAgeH * 3600000) continue;
    if (seen.some((s) => s === it.url || simTitle(s, it.title) >= 0.8)) continue;
    if (out.some((o) => o.url === it.url || simTitle(o.title, it.title) >= 0.7)) continue;
    out.push({ title: clean(it.title, 200), url: it.url, source: clean(it.source, 60), date: it.date || 0, text: clean(it.text || it.snippet || "", 1500) });
    if (out.length >= 12) break;
  }
  return out;
}
export function digestMessages(topic, items, { now = Date.now() } = {}) {
  const ar = topic.lang === "ar";
  return [
    { role: "system", content: `You write a short daily news digest about "${topic.query}" from the articles below ONLY. Today is ${new Date(now).toDateString()}.
Rules: use only facts stated in the articles; never add facts from memory; every bullet ends with its source numbers like [2] or [1][4]; if articles disagree, say so; attribute claims to whoever made them and keep the wording neutral — no opinions of your own; skip articles that are not really about "${topic.query}". ${ar ? "اكتب بالعربية." : "Write in English."}
Format: a one-line headline summary in bold, then 3–6 bullets (most important first), then — only if something is scheduled — a line starting "${ar ? "القادم:" : "Coming up:"}". No other text. If none of the articles is really about the topic, reply exactly: NOTHING NEW` },
    { role: "user", content: items.map((it, i) => `[${i + 1}] ${it.title}${it.source ? " — " + it.source : ""}${it.date ? " (" + new Date(it.date).toISOString().slice(0, 16).replace("T", " ") + " UTC)" : ""}\n${it.text || ""}`).join("\n\n") },
  ];
}
/** Remove citations to sources that don't exist; count lines with no source at all. */
export function checkCitations(text, n) {
  let bad = 0;
  const out = String(text || "").replace(/\[(\d+)\]/g, (m, k) => (Number(k) >= 1 && Number(k) <= n ? m : (bad++, "")));
  const bullets = out.split("\n").filter((l) => /^\s*[-*•]\s+/.test(l));
  const unsourced = bullets.filter((l) => !/\[\d+\]/.test(l)).length;
  return { text: out, removed: bad, unsourced, bullets: bullets.length };
}
export function addDigest(t, d) {
  return { ...t, digests: [d, ...t.digests.filter((x) => x.day !== d.day)].slice(0, 7) };
}
export function newsNotice(t) {
  const d = t.digests[0];
  const head = d && d.text ? clean(String(d.text).split("\n")[0].replace(/\*+/g, ""), 140) : "";
  return { title: `${t.query} · ${t.lang === "ar" ? "أخبار اليوم" : "today's news"}`, body: head && d.day === dayKey() ? head : (t.lang === "ar" ? "افتح لجمع أخبار آخر 24 ساعة" : "Tap to gather the last 24 hours") };
}

/* ---- v6.34 (Ali): every lesson shows a diagram AND flashcards; a course is not stuck at 30 lessons ---------------------------- */
/** The lesson's diagram: the model's (not cards), else a map of the lesson made from its own ## headings (honest: only what it says). */
export function lessonDiagram(l) {
  if (!l) return null;
  if (l.visual && l.visual.kind !== "cards") return l.visual;
  const heads = [...String(l.body || "").matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => clean(m[1].replace(/[*_`]/g, ""), 80)).filter((h) => !/^(try it|quick review|جرّب|جرب|مراجعة سريعة)/i.test(h));
  return heads.length >= 2 ? { kind: "steps", title: l.title, items: heads.slice(0, 6) } : null;
}
/** The lesson's flashcards: the model's, else the ones code makes from the lesson (the same that go into the review deck). */
export function lessonCards(l) {
  const own = (l && l.cards) || [];
  return (own.length >= 2 ? own : cardsFromLesson(l)).slice(0, 8);
}
/** How many lessons are planned but not written yet; at 3 or fewer the course plans its next part. */
export const lessonsLeft = (c) => Math.max(0, (c.plan || []).length - nextIndex(c));
export const MAX_PLAN = 300, MORE_N = 20;
export const needsMore = (c) => !c.pack && (c.plan || []).length > 0 && (c.plan || []).length < MAX_PLAN && lessonsLeft(c) <= 3;
/** The next part of a course: 20 more lessons after the ones planned, towards expert (a language goes on to fluent). */
export function moreMessages(c, n = MORE_N) {
  const done = c.plan.slice(-40);
  return [
    { role: "system", content: `You are an expert teacher continuing a daily course. Reply with JSON only: {"lessons": ["<lesson title>", ...]}.
Plan the NEXT ${n} lessons of this course, continuing straight after the last one — the next level, a ${c.level} learner who has done all of the lessons below and is going on towards expert${isLanguageCourse(c.topic) ? " (for a language: from where the learner is now towards fluent — new grammar, more words, real conversations, reading and listening, in a good order)" : ""}. Each lesson is one small idea that fits in 5 minutes; never repeat a lesson below. Titles short and concrete. ${c.lang === "ar" ? "Titles in Arabic." : "Titles in English."}` },
    { role: "user", content: `Course: ${c.title || c.topic}\nLessons so far (${c.plan.length}), the last ones:\n${done.map((t, i) => `${c.plan.length - done.length + i + 1}. ${t}`).join("\n")}` },
  ];
}
/** The model's answer → the course with the new lessons added (repeats of a planned title dropped); null when it gave none. */
export function addMore(c, text) {
  const p = parsePlan(text); if (!p) return null;
  const have = new Set(c.plan.map((t) => t.toLowerCase().trim()));
  const fresh = p.plan.filter((t) => !have.has(t.toLowerCase().trim())).slice(0, MORE_N);
  return fresh.length >= 3 ? { ...c, plan: [...c.plan, ...fresh].slice(0, MAX_PLAN), parts: (c.parts || 1) + 1 } : null;
}

/* ---- v6.34 (Ali: "make the lessons very good coding so the models don't glitch"): the lesson is checked and repaired by CODE.
   One pipeline (writeLesson) for the Learn page and the background writer:
     1. write → 2. clean the body (loops, leftover JSON / fences, LaTeX, "Sure, here is…", the title echoed, a sentence cut off)
     3. check it (long enough, two sections, the course's language, no loop) → one stricter retry when it fails
     4. the diagram / flashcards JSON broken or missing → a second short request under a GRAMMAR (the engine can only write valid
        JSON) → 5. still missing → made by code from the lesson itself (key points, flashcards, "Try it").                       */
const META = /^(sure|certainly|of course|here(?:'s| is) (?:your|the|today'?s)|okay|ok,|absolutely|great!|as an ai|i hope this|let me know|feel free|happy learning|بالتأكيد|إليك|اليك|طبعًا|طبعا|حسنًا|حسنا)\b/i;
const arShare = (t) => { const a = (String(t).match(/[؀-ۿ]/g) || []).length, l = (String(t).match(/[A-Za-z]/g) || []).length; return a + l ? a / (a + l) : 0; };
/** The body, cleaned: → { body, fixed: [what was repaired] }. Pure. */
export function cleanLessonBody(body, title = "") {
  let t = String(body || "").replace(/\r/g, ""), fixed = [];
  const lp = detectLoop(t); if (lp.loop) { t = trimLoop(t, lp.cut); fixed.push("loop"); }
  const t0 = t; t = t.replace(/```(?:json)?[\s\S]*$/i, "").replace(/\n\{\s*"(?:visual|cards|keyPoints)"[\s\S]*$/, ""); if (t !== t0) fixed.push("json");
  const t1 = t; t = mathToText(t); if (t !== t1) fixed.push("latex");
  let lines = t.split("\n");
  while (lines.length && (!lines[0].trim() || META.test(lines[0].trim().replace(/^[#*\s]+/, "")))) { if (lines[0].trim()) fixed.push("meta"); lines.shift(); }
  // "# Lesson 3: Numbers" / the title repeated as the first line (the app shows the title already)
  const norm = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (lines.length && (/^#\s/.test(lines[0]) || /^(lesson|الدرس)\s*\d+/i.test(lines[0].replace(/^[#*\s]+/, "")) || (title && norm(lines[0]) === norm(title)))) { lines.shift(); fixed.push("title"); }
  while (lines.length && META.test(lines[lines.length - 1].trim())) { lines.pop(); fixed.push("meta"); }
  // the same paragraph twice → once
  const seen = new Set(), paras = lines.join("\n").split(/\n{2,}/).filter((pp) => { const k = norm(pp); if (k.length > 30 && seen.has(k)) { fixed.push("repeat"); return false; } seen.add(k); return true; });
  t = paras.join("\n\n").trim();
  // …and the same long line twice (also when one copy sits under a heading); tables and code are left alone
  const seenL = new Set(); let inCode = false;
  t = t.split("\n").filter((ln) => { const tl = ln.trim(); if (/^```/.test(tl)) inCode = !inCode; if (inCode || tl.startsWith("|") || /^#/.test(tl)) return true;
    const k = norm(tl); if (k.length > 30 && seenL.has(k)) { fixed.push("repeat"); return false; } if (k.length > 30) seenL.add(k); return true; }).join("\n").replace(/\n{3,}/g, "\n\n");
  // a last sentence cut off by the length limit → dropped (a heading, list item or table row is kept as it is)
  const last = t.split("\n").pop() || "";
  if (last.length > 25 && !/[.!?؟:)"»”*\d]$/.test(last.trim()) && !/^\s*([-*•|#]|\d+[.)])/.test(last)) { const cut = Math.max(t.lastIndexOf(". "), t.lastIndexOf("؟ "), t.lastIndexOf("! "), t.lastIndexOf(".\n")); if (cut > t.length * 0.6) { t = t.slice(0, cut + 1); fixed.push("cut"); } }
  return { body: t.replace(/\n{3,}/g, "\n\n"), fixed: [...new Set(fixed)] };
}
/** What is wrong with a lesson, as codes ([] = good): short, sections, language, loop. Pure. */
export function lessonProblems(p, c) {
  const body = String((p && p.body) || ""), out = [];
  if (body.length < 200) out.push("short");   // (a real 5-minute lesson is ~1,500 characters; under 200 is a failed one)
  if ((body.match(/^#{2,3}\s+\S/gm) || []).length < 2) out.push("sections");
  const ar = arShare(body);
  // an Arabic course must be mostly Arabic; an English one mostly not (a language course quotes the language it teaches, so it's freer)
  if (c && c.lang === "ar" && ar < (isLanguageCourse(c.topic) ? 0.25 : 0.45)) out.push("language");
  if (c && c.lang !== "ar" && ar > (isLanguageCourse(c.topic) ? 0.75 : 0.4)) out.push("language");
  if (detectLoop(body).loop) out.push("loop");
  return out;
}
/** The grammar for the lesson's extras: {"visual":{"kind":"steps"|"table",…},"cards":[3–6],"keyPoints":[3]} — always valid JSON. */
export const EXTRAS_GRAMMAR = String.raw`root ::= "{" ws "\"visual\":" ws visual "," ws "\"cards\":" ws "[" ws card ("," ws card){2,5} ws "]" "," ws "\"keyPoints\":" ws "[" ws str "," ws str "," ws str ws "]" ws "}"
visual ::= steps | table
steps ::= "{" ws "\"kind\":" ws "\"steps\"" "," ws "\"title\":" ws str "," ws "\"items\":" ws "[" ws str ("," ws str){1,5} ws "]" ws "}"
table ::= "{" ws "\"kind\":" ws "\"table\"" "," ws "\"title\":" ws str "," ws "\"columns\":" ws "[" ws str "," ws str ws "]" "," ws "\"rows\":" ws "[" ws row ("," ws row){1,7} ws "]" ws "}"
row ::= "[" ws str "," ws str ws "]"
card ::= "{" ws "\"front\":" ws str "," ws "\"back\":" ws str "," ws "\"note\":" ws str ws "}"
str ::= "\"" ch{1,80} "\""
ch ::= [^"\\\x00-\x1f] | "\\" ["\\/nt]
ws ::= [ ]?`;
export function extrasMessages(c, title, body) {
  return [{ role: "system", content: `From the lesson below, make: one diagram ("steps" for a process or order of ideas, "table" for words / forms / values side by side), 3–6 flashcards (front: a word, term or question from the lesson; back: its meaning or answer; note: a short example), and 3 key points. Only what the lesson says. ${c.lang === "ar" ? "Write in Arabic (keep terms in the language taught)." : "Write in English (keep terms in the language taught)."} JSON only.` },
    { role: "user", content: `Lesson: ${title}\n\n${String(body).slice(0, 3500)}` }];
}
/** Key points by code: the first sentence under each ## heading (or the first sentences). */
export function codeKeyPoints(body) {
  const out = [], secs = String(body || "").split(/^#{2,3}\s+.+$/m).slice(1);
  for (const sec of secs.length ? secs : [String(body || "")]) {
    const sent = sec.replace(/[*_`>#|-]+/g, " ").replace(/\s+/g, " ").trim().split(/(?<=[.!?؟])\s+/)[0];
    if (sent && sent.length >= 12 && !/^(try it|جرب)/i.test(sent)) out.push(clean(sent, 140));
    if (out.length >= 3) break;
  }
  return out;
}
/** A "## Try it" by code when the lesson has none: say / recall its flashcards, or its key points in your own words. */
export function codeTryIt(p, c) {
  const cards = (p.cards || []).slice(0, 3), ar = c && c.lang === "ar";
  if (cards.length >= 2) return ar ? `## جرّب\nبدون النظر، ما معنى: ${cards.map((x) => "**" + x.front + "**").join("، ")}؟` : `## Try it\nWithout looking: what do ${cards.map((x) => "**" + x.front + "**").join(", ")} mean?`;
  const k = (p.keyPoints || [])[0];
  return k ? (ar ? `## جرّب\nاشرح بكلماتك: ${k}` : `## Try it\nExplain in your own words: ${k}`) : "";
}
/** The whole pipeline. llm(messages, { maxTokens, temperature, grammar?, onToken? }) → text. → the parsed lesson, or null. */
export async function writeLesson(llm, c, n, { onToken, onStage } = {}) {
  const title = c.plan[n] || `Lesson ${n + 1}`;
  let best = null;
  for (let k = 0; k < 2; k++) {
    onStage && onStage(k ? "retry" : "write");
    const msgs = lessonMessages(c, n);
    if (k) msgs[0] = { ...msgs[0], content: msgs[0].content + `\n\nIMPORTANT: the last try came out ${best ? best.problems.join(", ") : "empty"}. Write at least 4 full paragraphs under 2–4 "## " headings${c.lang === "ar" ? ", in Arabic" : ", in English"}; no repeated sentences; end with the JSON block.` };
    const raw = await llm(msgs, { maxTokens: 1600, temperature: k ? 0.3 : 0.4, onToken });
    const p = parseLesson(raw), cl = cleanLessonBody(p.body, title);
    const q = { ...p, body: cl.body, fixed: cl.fixed };
    q.problems = lessonProblems(q, c);
    // (the wrong language or a loop is worse than a short lesson)
    const W = { language: 4, loop: 3, short: 2, sections: 1 }, score = (x) => x.problems.reduce((a, k) => a + (W[k] || 1), 0);
    if (!best || score(q) < score(best) || (score(q) === score(best) && q.body.length > best.body.length)) best = q;
    if (!q.problems.length) break;
  }
  if (!best || best.body.length < 120) return null;
  // the extras: broken or missing → one short request under the grammar
  // (only when the JSON gave nothing: a lesson with flashcards but no diagram gets its map by code — one model call less)
  if (!best.visual && (best.cards || []).length < 2) {
    onStage && onStage("extras");
    try {
      const j = jsonFrom(await llm(extrasMessages(c, title, best.body), { maxTokens: 1000, temperature: 0.2, grammar: EXTRAS_GRAMMAR }));
      if (j) {
        if (!best.visual) best.visual = normVisual(j.visual);
        if ((best.cards || []).length < 3) { const cs = (normVisual({ kind: "cards", items: j.cards || [] }) || { items: [] }).items; if (cs.length) best.cards = cs; }
        if (!(best.keyPoints || []).length && Array.isArray(j.keyPoints)) best.keyPoints = j.keyPoints.map((x) => clean(x, 160)).filter(Boolean).slice(0, 5);
      }
    } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
  }
  // still missing → made by code from the lesson itself
  if (!(best.keyPoints || []).length) best.keyPoints = codeKeyPoints(best.body);
  if ((best.cards || []).length < 2) best.cards = cardsFromLesson(best);
  if (!/^#{2,3}\s+(try it|جرّب|جرب)/im.test(best.body)) { const tr = codeTryIt(best, c); if (tr) best.body += "\n\n" + tr; }
  const { problems, ...lesson } = best;
  return { ...lesson, checked: problems };
}

/* ---- v6.41 (upgrade D4) — news story threads. The same story over several days becomes one thread: each day's headlines with
   their sources (how each source tells it), and "What changed since yesterday" written only from the two days' articles.
   Threads are found by code: two headlines share at least two telling words (not the topic's own words, not small words). */
const NSTOP = new Set(("the and for with from that this after over into amid about says said will have has was were are its their " +
  "new news more than what when how why who why top live update updates report reports video photos watch today yesterday week " +
  "في من على عن إلى الى مع بعد قبل هذا هذه التي الذي كان كانت أن ان يوم اليوم أمس خلال بين حول عاجل تقرير فيديو صور اخبار أخبار").split(/\s+/));
const tw = (title, skip) => new Set(normTitle(title).replace(/[أإآ]/g, "ا").replace(/ة\b/g, "ه").split(" ").map((w) => w.replace(/^(ال|وال|بال)/, ""))
  .filter((w) => w.length > 2 && !NSTOP.has(w) && !skip.has(w) && !/^\d{1,2}$/.test(w)));
/** → [{ id, title, days: [day…] newest first, byDay: { day: [items] }, sources: [..], today }] spanning 2+ days, newest first. */
export function newsThreads(digests, query = "", today = dayKey()) {
  const skip = tw(query, new Set());
  const items = [];
  for (const d of digests || []) for (const it of d.items || []) items.push({ ...it, day: d.day, w: tw(it.title, skip) });
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    let k = 0; for (const w of items[i].w) if (items[j].w.has(w)) k++;
    if (k >= 2) parent[find(i)] = find(j);
  }
  const groups = new Map();
  items.forEach((it, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it); });
  const out = [];
  for (const g of groups.values()) {
    const days = [...new Set(g.map((x) => x.day))].sort().reverse();
    if (days.length < 2) continue;
    const byDay = {}; for (const d of days) byDay[d] = g.filter((x) => x.day === d).map(({ w, ...x }) => x);
    const newest = byDay[days[0]][0];
    out.push({ id: "th-" + days[days.length - 1] + "-" + normTitle(newest.title).slice(0, 24).replace(/ /g, "-"), title: newest.title, days, byDay,
      sources: [...new Set(g.map((x) => x.source).filter(Boolean))], today: days[0] === today });
  }
  return out.sort((a, b) => b.days[0].localeCompare(a.days[0]) || b.days.length - a.days.length).slice(0, 8);
}
/** The two latest days of a thread → messages for "what changed", citing [n] over the listed articles. */
export function changeMessages(th, lang = "en") {
  const [d1, d0] = th.days;
  const list = [...(th.byDay[d0] || []).map((x) => ({ ...x, when: "before" })), ...(th.byDay[d1] || []).map((x) => ({ ...x, when: "latest" }))];
  return { items: list, messages: [
    { role: "system", content: `Say what is NEW in the latest articles compared with the earlier ones, about one news story. Use ONLY the articles. 2–4 bullets, most important first, each ending with its source numbers like [3]. If sources disagree or tell it differently, say who says what. Neutral wording, no opinions. ${lang === "ar" ? "اكتب بالعربية المصرية البسيطة." : "Write in English."} If nothing is really new, reply exactly: NOTHING NEW` },
    { role: "user", content: list.map((x, i) => `[${i + 1}] (${x.when === "latest" ? d1 : d0}) ${x.title}${x.source ? " — " + x.source : ""}\n${x.text || ""}`).join("\n\n") },
  ] };
}
