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

import { jsonFrom } from "./erp.js";

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
  const review = (c.review || []).slice(0, 2);
  return [
    { role: "system", content: `You are a warm, expert teacher writing today's 5-minute lesson of a daily course on "${c.topic}" for a ${c.level} learner. ${LANG_NOTE[c.lang]}
Write the lesson in Markdown: a one-line hook, then 2–4 short sections with ## headings, concrete examples${isLanguageCourse(c.topic) ? " (example sentences with translation and pronunciation)" : " from real work and life"}, and one tiny practice task at the end under "## Try it". No LaTeX. Every fact must be technically correct — a plain true sentence beats a dramatic comparison; no exaggerated claims.${review.length ? " Start with a 2-line \"## Quick review\" of: " + review.join("; ") + "." : ""}
Then, at the very end, a JSON block:
\`\`\`json
{"visual": <one visual>, "keyPoints": ["<3 short things to remember>"]}   (both keys are required)
\`\`\`
${VISUALS}` },
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
  const visual = j ? normVisual(j.visual) : null;
  if (!keyPoints.length && visual) {   // the model left them out: the visual's cards / steps are the lesson's key facts
    const items = visual.kind === "cards" ? visual.items.map((x) => (x.back ? `${x.front}: ${x.back}` : x.front))
      : visual.kind === "steps" ? visual.items : visual.kind === "timeline" ? visual.items.map((x) => `${x.when}: ${x.what}`) : [];
    keyPoints = items.map((x) => clean(x, 160)).filter(Boolean).slice(0, 3);
  }
  if (!keyPoints.length) {             // else the first sentence of each section
    keyPoints = [...body.matchAll(/^##\s*([^\n]+)\n+([^\n]+)/gm)].filter((m) => !/try it|جر[ّ]?ب|quick review|مراجعة/i.test(m[1]))
      .map((m) => clean(m[2].replace(/^\s*[-*•\d.)]+\s*/, "").replace(/\*\*/g, "").split(/(?<=[.!؟?])\s/)[0], 160)).filter(Boolean).slice(0, 3);
  }
  body = body.replace(/\$\$?([^$\n]+)\$\$?/g, "$1");
  return { body, visual, keyPoints };
}

export function addLesson(c, n, parsed, { now = Date.now() } = {}) {
  const lesson = { n, title: c.plan[n] || `Lesson ${n + 1}`, ...parsed, made: now, day: "", done: false };
  const reviewed = (c.review || []).slice(0, 2);
  return { ...c, lessons: [...c.lessons.filter((l) => l.n !== n), lesson].sort((a, b) => a.n - b.n), review: (c.review || []).filter((x) => !reviewed.includes(x)) };
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
  return { ...c, lessons, streak, lastDay: today };
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
export function finishQuiz(c, quiz, picks, { now = Date.now() } = {}) {
  const right = quiz.questions.filter((q, i) => picks[i] === q.answer).length;
  const missed = quiz.questions.filter((q, i) => picks[i] !== q.answer).map((q) => clean(`${q.q} → ${q.options[q.answer]}`, 200));
  const rec = { after: Math.max(...quiz.lessons), score: right, total: quiz.questions.length, at: now };
  return { course: { ...c, quizzes: [...c.quizzes, rec], review: [...missed, ...(c.review || [])].slice(0, 12) }, right, missed };
}

/** What the notification and the widget say. */
export function lessonNotice(c) {
  const next = c.lessons.find((l) => !l.done);
  const n = next ? next.n : nextIndex(c);
  const title = next ? next.title : c.plan[n] || "";
  return { title: `${c.topic} · ${c.lang === "ar" ? "الدرس" : "Lesson"} ${n + 1}`, body: title ? title + (quizDue(c) ? (c.lang === "ar" ? " — ومعاه اختبار قصير" : " — and a short quiz") : "") : (c.lang === "ar" ? "درس اليوم جاهز" : "Today's lesson is waiting") };
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
