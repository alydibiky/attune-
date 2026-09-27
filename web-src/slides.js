/* ---- v5.40 — Slides & Reports: a PowerPoint or a report from one prompt, made on the phone -------
   Ali: "make very good PowerPoint using Attune, using an AI prompt, and be able to make reports".
   The model only WRITES (a plan, then each slide / section, in simple tagged lines a 2–4B model gets
   right); CODE does everything else: it parses and repairs the text, checks figures against the
   sources, picks the design and draws each slide (one shape list → the .pptx AND the preview /
   PDF canvas, so what you see is what you get), and writes the PowerPoint file itself (a zip of
   XML, like the Word writer in convert.js). Pure functions; tests in tests/unit/v540.test.mjs. */
import { zipStore, textToBlocks } from "./convert.js";

// ---- languages & themes ---------------------------------------------------------------------------
export const S_LANGS = { en: "English", ar: "Arabic", fr: "French", de: "German", es: "Spanish", tr: "Turkish", it: "Italian", pt: "Portuguese" };
const WORDS = {
  en: { agenda: "Agenda", thanks: "Thank you", questions: "Questions?", summary: "Executive summary", findings: "Key findings", conclusion: "Conclusions and recommendations", sources: "Sources", contents: "Contents", data: "Data", prepared: "Prepared with Attune", chart: "Chart" },
  ar: { agenda: "المحتويات", thanks: "شكراً لكم", questions: "أسئلة؟", summary: "الملخص التنفيذي", findings: "أهم النتائج", conclusion: "الخلاصة والتوصيات", sources: "المصادر", contents: "المحتويات", data: "البيانات", prepared: "أُعدّ باستخدام Attune", chart: "رسم بياني" },
  fr: { agenda: "Sommaire", thanks: "Merci", questions: "Questions ?", summary: "Résumé", findings: "Points clés", conclusion: "Conclusions et recommandations", sources: "Sources", contents: "Sommaire", data: "Données", prepared: "Préparé avec Attune", chart: "Graphique" },
  de: { agenda: "Agenda", thanks: "Vielen Dank", questions: "Fragen?", summary: "Zusammenfassung", findings: "Wichtigste Ergebnisse", conclusion: "Fazit und Empfehlungen", sources: "Quellen", contents: "Inhalt", data: "Daten", prepared: "Erstellt mit Attune", chart: "Diagramm" },
  es: { agenda: "Agenda", thanks: "Gracias", questions: "¿Preguntas?", summary: "Resumen ejecutivo", findings: "Hallazgos clave", conclusion: "Conclusiones y recomendaciones", sources: "Fuentes", contents: "Contenido", data: "Datos", prepared: "Preparado con Attune", chart: "Gráfico" },
  tr: { agenda: "Gündem", thanks: "Teşekkürler", questions: "Sorular?", summary: "Yönetici özeti", findings: "Temel bulgular", conclusion: "Sonuç ve öneriler", sources: "Kaynaklar", contents: "İçindekiler", data: "Veriler", prepared: "Attune ile hazırlandı", chart: "Grafik" },
  it: { agenda: "Agenda", thanks: "Grazie", questions: "Domande?", summary: "Sintesi", findings: "Risultati principali", conclusion: "Conclusioni e raccomandazioni", sources: "Fonti", contents: "Indice", data: "Dati", prepared: "Preparato con Attune", chart: "Grafico" },
  pt: { agenda: "Agenda", thanks: "Obrigado", questions: "Perguntas?", summary: "Resumo executivo", findings: "Principais conclusões", conclusion: "Conclusões e recomendações", sources: "Fontes", contents: "Índice", data: "Dados", prepared: "Preparado com Attune", chart: "Gráfico" },
};
export const words = (lang) => WORDS[lang] || WORDS.en;
export const isRtl = (lang) => lang === "ar";
/** The language to write in: the one picked, or the prompt's own (Arabic letters → Arabic). */
export function langOf(pick, text) { return pick && pick !== "auto" ? pick : /[؀-ۿ]/.test(String(text || "")) ? "ar" : "en"; }

// colours without "#": bg, card, text, sub (muted text), accent, accent2, cover (cover background), coverText
export const THEMES = {
  midnight: { name: "Midnight", bg: "0F172A", card: "1E293B", text: "F1F5F9", sub: "94A3B8", accent: "2DD4BF", accent2: "F59E0B", cover: "0B1120", coverText: "FFFFFF", onAccent: "0F172A" },
  ocean: { name: "Ocean", bg: "FFFFFF", card: "EFF6FF", text: "0F172A", sub: "475569", accent: "2563EB", accent2: "0EA5E9", cover: "1E3A8A", coverText: "FFFFFF", onAccent: "FFFFFF" },
  emerald: { name: "Emerald", bg: "FFFFFF", card: "ECFDF5", text: "052E16", sub: "4B5563", accent: "059669", accent2: "65A30D", cover: "064E3B", coverText: "FFFFFF", onAccent: "FFFFFF" },
  sunset: { name: "Sunset", bg: "FFFBF5", card: "FFEDD5", text: "1C1917", sub: "57534E", accent: "EA580C", accent2: "DB2777", cover: "7C2D12", coverText: "FFFFFF", onAccent: "FFFFFF" },
  royal: { name: "Royal", bg: "1E1B4B", card: "312E81", text: "EEF2FF", sub: "A5B4FC", accent: "A78BFA", accent2: "F472B6", cover: "13103A", coverText: "FFFFFF", onAccent: "1E1B4B" },
  steel: { name: "Construction", bg: "18181B", card: "27272A", text: "FAFAFA", sub: "A1A1AA", accent: "FACC15", accent2: "F97316", cover: "09090B", coverText: "FFFFFF", onAccent: "18181B" },
  minimal: { name: "Minimal", bg: "FFFFFF", card: "F3F4F6", text: "111827", sub: "6B7280", accent: "111827", accent2: "9CA3AF", cover: "FFFFFF", coverText: "111827", onAccent: "FFFFFF" },
  sand: { name: "Desert", bg: "FAF7F0", card: "F0E8D8", text: "292524", sub: "78716C", accent: "B45309", accent2: "0F766E", cover: "44403C", coverText: "FFFBEB", onAccent: "FFFFFF" },
};

// ---- motion: slide transitions and entrance animations (v5.40 — "themes, transitions and animations if I ask") ----
export const TRANSITIONS = { none: "None", fade: "Fade", push: "Push", wipe: "Wipe", split: "Split", cover: "Cover", zoom: "Zoom" };
export const ANIMATIONS = { none: "None", fade: "Fade in", fly: "Fly in", zoom: "Zoom in" };
const DESIGN_CUE = /\b(theme|design|colou?rs?|style|look|palette|background)\b|ثيم|تيم|تصميم|لون|ألوان|الوان|ستايل|شكل|خلفية/i;
const THEME_WORDS = [
  ["midnight", /\b(dark|night|black)\b.{0,12}\b(blue|navy)\b|أزرق غامق|ازرق غامق|كحلي غامق/i],
  ["steel", /\b(construction|industrial|engineering|crane|yellow)\b|إنشاء|انشاء|صناعي|هندسي|أصفر|اصفر|ونش|أوناش/i],
  ["royal", /\b(purple|violet|royal|luxury|luxurious)\b|بنفسجي|موف|ملكي|فخم/i],
  ["emerald", /\b(green|eco|nature|emerald)\b|أخضر|اخضر|طبيع|بيئ/i],
  ["sunset", /\b(orange|warm|sunset|red)\b|برتقالي|دافي|دافئ|غروب|أحمر|احمر/i],
  ["sand", /\b(desert|sand|beige|brown)\b|صحراوي|صحرا|بيج|بني/i],
  ["minimal", /\b(minimal|minimalist|simple|clean|white|black and white)\b|أبيض|ابيض|بسيط|مينيمال/i],
  ["ocean", /\b(blue|ocean|corporate|navy|professional)\b|أزرق|ازرق|كحلي|رسمي|احترافي/i],
  ["midnight", /\b(dark|night|black)\b|داكن|غامق|أسود|اسود|ليلي|دارك/i],
];
const NO = /\b(no|without|none)\s+(\w+\s+)?|بدون\s+|من غير\s+|مش عايز\s+/i;
/** A request's own words about the look → { theme?, transition?, animation?, trigger? } (English and Egyptian Arabic). */
export function styleFromPrompt(text) {
  const t = String(text || ""), out = {};
  if (DESIGN_CUE.test(t)) for (const [k, re] of THEME_WORDS) if (re.test(t)) { out.theme = k; break; }
  const tr0 = /transition|انتقال|انتقالات|تنقل|ترانزيشن/i, an0 = /animat|انيميشن|أنيميشن|انميشن|حركات|تحريك|متحرك|one by one|واحدة واحدة|واحد واحد|واحدة ورا التانية/i;
  if (new RegExp("(?:" + NO.source + ")(transition|انتقال|ترانزيشن)", "i").test(t)) out.transition = "none";
  else if (tr0.test(t) || /\b(fade|push|wipe|split|zoom|morph)\b.{0,20}\bslides?\b|between (the )?slides/i.test(t)) {
    const m = t.match(/transition.{0,40}|.{0,40}transition|انتقال.{0,30}|ترانزيشن.{0,30}/i), z = m ? m[0] : t;
    out.transition = /push|دفع/i.test(z) ? "push" : /wipe|مسح/i.test(z) ? "wipe" : /split|انقسام|تقسيم/i.test(z) ? "split" : /cover|تغطية/i.test(z) ? "cover" : /zoom|تكبير|زووم/i.test(z) ? "zoom" : "fade";
  }
  if (new RegExp("(?:" + NO.source + ")(animation|انيميشن|أنيميشن|حركات)", "i").test(t)) out.animation = "none";
  else if (an0.test(t) || /\b(fly|flies|flying) in\b|\bappear\b/i.test(t)) {
    const m = t.match(/animat.{0,50}|.{0,40}animat|(انيميشن|أنيميشن|حركات|تحريك).{0,40}|.{0,30}(fly|flies|flying) in.{0,20}/i), z = m ? m[0] : t;
    out.animation = /\bfl(y|ies|ying)\b|طاير|تطير|طيران|تدخل من/i.test(z) ? "fly" : /zoom|تكبير|زووم/i.test(z) ? "zoom" : "fade";
    out.trigger = /automatic|\bauto\b|by (it|them)sel(f|ves)|without click|تلقائي|لوحده|لوحدها|أوتوماتيك|اوتوماتيك/i.test(t) ? "auto" : "click";
  }
  return out;
}

// ---- small text helpers ---------------------------------------------------------------------------
const AR_DIG = /[٠-٩]/g;
const latinDigits = (s) => String(s || "").replace(AR_DIG, (d) => String(d.charCodeAt(0) - 0x0660));
const clean = (s) => String(s || "").replace(/\*\*|__|`/g, "").replace(/^#+\s*/, "").replace(/\s+/g, " ").trim();
const cut = (s, n) => { s = clean(s); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };
const BULLET = /^\s*(?:[-*•▪●◦–]|\d{1,2}[.)]|[٠-٩]{1,2}[.)])\s+/;
/** "Lead: text" / "Lead — text" → {lead, text} (a lead is a short name, ≤ 6 words). */
export function splitLead(s) {
  s = clean(s);
  const m = s.match(/^(.{2,60}?)\s*(?::|：|\s[–—-]\s)\s*(.+)$/);
  if (m && m[1].split(/\s+/).length <= 6 && !/\d[:.]\d/.test(m[1] + ":" + m[2].slice(0, 2))) return { lead: m[1].trim(), text: m[2].trim() };
  return { lead: "", text: s };
}
/** The first number in a string ("EGP 3.5 million" → 3.5, "1,200" → 1200, "١٢٠" → 120), or null. */
export function parseNum(s) {
  const m = latinDigits(s).replace(/(\d)[,٬](?=\d{3}(?!\d))/g, "$1").match(/-?\d+(?:[.٫]\d+)?/);
  return m ? parseFloat(m[0].replace("٫", ".")) : null;
}
// numbers worth checking: 2+ digits (list numbers and "3 steps" are not facts to verify)
const numsIn = (s) => (latinDigits(s).replace(/(\d)[,٬](?=\d{3}(?!\d))/g, "$1").match(/\d+(?:\.\d+)?/g) || []).filter((n) => n.replace(".", "").length >= 2);
const srcNorm = (s) => latinDigits(s).replace(/(\d)[,٬](?=\d{3}(?!\d))/g, "$1");
/** Figures in `text` that appear nowhere in `source` (the prompt + web pages + the file). */
export function unbacked(text, source) {
  const src = srcNorm(source);
  return [...new Set(numsIn(text))].filter((n) => {
    const alt = [n, n.replace(/\.0+$/, ""), /^\d+$/.test(n) && n.length > 3 ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : n];
    return !alt.some((a) => new RegExp("(^|[^\\d.])" + a.replace(".", "\\.") + "(?![\\d])").test(src));
  });
}

/** Chat: does this message ask for a presentation or a report? → "deck" | "report" | null */
export function wantsDoc(text) {
  const t = String(text || "");
  if (/\b(power ?point|pptx|slides?|slide deck|deck|presentation)\b|عرض تقديمي|عرض بوربوينت|باوربوينت|بوربوينت|باور بوينت|شرائح|سلايدز?/i.test(t) && /\b(make|create|build|prepare|write|design|give me|need|want)\b|اعمل|اعملي|عايز|محتاج|جهز|جهّز|صمم|اكتب|ابني/i.test(t)) return "deck";
  if (/\breport\b|تقرير/i.test(t) && /\b(make|create|build|prepare|write|draft|give me|need|want)\b|اعمل|اعملي|عايز|محتاج|جهز|جهّز|اكتب/i.test(t)) return "report";
  return null;
}

// ---- 1. the plan ----------------------------------------------------------------------------------
export const KINDS_TEXT = ["bullets", "two", "steps", "table", "quote"];
export const KINDS_FIG = ["stats", "chart"];
/** Can the deck show figures (stats / chart)? Only when there are real numbers to draw from. */
export const hasFigures = (source) => numsIn(source).length >= 3;

export function outlineMessages({ topic, n, lang, audience, source }) {
  const figs = hasFigures(source);
  const kinds = [
    "bullets (3–5 key points)", "two (a comparison: pros / cons, before / after, option A / option B)",
    "steps (a process, plan or timeline)", "table (a structured comparison)", "quote (one strong key message)",
    ...(figs ? ["stats (3–4 key numbers from the sources)", "chart (numbers to compare, from the sources)"] : []),
  ];
  return [{ role: "user", content:
`You plan a professional slide presentation.
TOPIC: ${topic}${audience ? `\nAUDIENCE: ${audience}` : ""}${source ? `\n\nSOURCES (facts to use):\n${source.slice(0, 3500)}` : ""}

Write exactly this and nothing else:
TITLE: <the presentation's title, at most 8 words>
SUBTITLE: <one short line>
then exactly ${n} lines, one per slide:
1. [type] <slide title, at most 7 words>

Types: ${kinds.join("; ")}.
Rules: tell a story (context → the need → the main content → what to do next); ignore any wishes about colours, design, transitions or animations (the app does those); use at least 3 different types; the LAST slide is [bullets] with the key takeaways; do NOT add a title, agenda or "thank you" slide (the app adds them). Keep the words TITLE, SUBTITLE and the [type] in English. Write the titles in ${S_LANGS[lang] || "English"}.` }];
}

const KIND_WORDS = { bullet: "bullets", bullets: "bullets", points: "bullets", two: "two", compare: "two", comparison: "two", steps: "steps", step: "steps", process: "steps", timeline: "steps",
  table: "table", quote: "quote", stats: "stats", stat: "stats", numbers: "stats", chart: "chart", graph: "chart" };
/** A title's hint: comparisons → two, processes / plans → steps. */
export function kindHint(title) {
  const t = String(title || "");
  if (/\bvs\.?\b|versus|pros|cons|before|after|advantages|compared|مقارنة|مميزات|عيوب|قبل|بعد|مقابل/i.test(t)) return "two";
  if (/steps?|process|plan|timeline|roadmap|how to|phases?|stages?|خطوات|مراحل|خطة|كيف/i.test(t)) return "steps";
  return null;
}
/** The plan's text → { title, subtitle, slides: [{kind, title}] } (always usable; figures kinds only when allowed). */
export function parseOutline(reply, n, { topic = "", figures = false } = {}) {
  const lines = String(reply || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  let title = "", subtitle = "";
  const slides = [];
  for (const l0 of lines) {
    const l = l0.replace(/\*\*/g, "");
    const t = l.match(/^(?:TITLE|العنوان)\s*[:：]\s*(.+)$/i); if (t && !title) { title = clean(t[1]); continue; }
    const s = l.match(/^(?:SUBTITLE|العنوان الفرعي)\s*[:：]\s*(.+)$/i); if (s && !subtitle) { subtitle = clean(s[1]); continue; }
    const m = l.match(/^(?:slide\s*)?(?:\d{1,2}|[٠-٩]{1,2})\s*[.):-]\s*(.+)$/i);
    if (!m) continue;
    let body = m[1], kind = null;
    const k = body.match(/\[\s*([A-Za-z]+)\s*\]|\(\s*([A-Za-z]+)\s*\)\s*$/);
    if (k) { kind = KIND_WORDS[(k[1] || k[2]).toLowerCase()] || null; body = body.replace(k[0], " "); }
    body = clean(body.replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, ""));
    if (!body || /^(title slide|cover|agenda|thank you|questions|q ?& ?a|المحتويات|شكرا|شكراً|أسئلة)/i.test(body)) continue;
    if (!kind || (!figures && KINDS_FIG.includes(kind))) kind = kindHint(body) || "bullets";
    if (slides.some((x) => x.title.toLowerCase() === body.toLowerCase())) continue;
    slides.push({ kind, title: cut(body, 80) });
  }
  if (!title) title = cut(topic || (slides[0] && slides[0].title) || "Presentation", 70);
  // too few slides from the model: a sensible story, by code
  if (slides.length < Math.min(3, n)) {
    const ar = /[؀-ۿ]/.test(title + topic);
    const plan = ar ? [["bullets", "نظرة عامة"], ["bullets", "لماذا هذا مهم"], ["two", "الفرص والتحديات"], ["steps", "خطة العمل"], ["table", "المقارنة"], ["bullets", "أهم النقاط"]]
      : [["bullets", "Overview"], ["bullets", "Why it matters"], ["two", "Opportunities and challenges"], ["steps", "The plan"], ["table", "At a glance"], ["bullets", "Key takeaways"]];
    for (const [kind, t] of plan) if (slides.length < n && !slides.some((x) => x.title === t)) slides.push({ kind, title: t });
  }
  // variety: a deck of only bullet slides looks like a document
  if (slides.length >= 5 && slides.every((s) => s.kind === "bullets")) {
    const mid = slides.slice(1, -1);
    if (mid[1]) mid[1].kind = "two";
    if (mid[3]) mid[3].kind = "steps";
  }
  return { title, subtitle: cut(subtitle, 110), slides: slides.slice(0, n) };
}

// ---- 2. one slide ---------------------------------------------------------------------------------
const FORMATS = {
  bullets: "- <short bold lead, 2–4 words>: <one clear sentence, at most 16 words>\n(3 to 5 lines like that)",
  two: "LEFT: <heading of the first side>\n- <point>\n- <point>\n- <point>\nRIGHT: <heading of the second side>\n- <point>\n- <point>\n- <point>",
  steps: "- <step name, 2–4 words>: <one sentence>\n(3 to 5 steps, in order)",
  table: "<column 1> | <column 2> | <column 3>\n<row> | <row> | <row>\n(a header line, then 3 to 5 rows; 2 to 4 columns; short cells)",
  quote: "QUOTE: <one memorable sentence>\nBY: <who said it — only a real quote from the sources; otherwise write your own key message and leave BY empty>",
  stats: "- <number with its unit, copied exactly from the sources> | <what it means, at most 8 words>\n(3 or 4 lines)",
  chart: "UNIT: <unit of the numbers, e.g. tons, EGP million, %>\n- <label> | <number copied exactly from the sources>\n(3 to 8 lines)\nTAKEAWAY: <one sentence: what the chart shows>",
};
export function slideMessages({ deckTitle, topic, slide, i, n, others, lang, source, audience }) {
  return [{ role: "user", content:
`You write ONE slide of the presentation "${deckTitle}" (topic: ${topic}).${audience ? ` Audience: ${audience}.` : ""}
This is slide ${i} of ${n}: "${slide.title}". The other slides are: ${others.filter((t) => t !== slide.title).join("; ")} — don't repeat their content.${source ? `\n\nSOURCES — use only these facts; copy every number exactly:\n${source}` : "\n\nDon't invent statistics, prices, dates or quotes; general knowledge only."}

Write exactly this format and nothing else:
${FORMATS[slide.kind] || FORMATS.bullets}
NOTES: <2–3 sentences the presenter says on this slide>

Rules: concrete and professional, short lines (a slide is not a page), no ** or # symbols; don't write about the slide design, transitions or animations. Keep the words LEFT, RIGHT, QUOTE, BY, UNIT, TAKEAWAY, NOTES in English. Write the content in ${S_LANGS[lang] || "English"}.` }];
}

/** The model's slide text → the slide's fields (kind kept; `fixSlide` downgrades what didn't come out). */
export function parseSlide(kind, reply) {
  const out = { kind, notes: "" };
  const lines = String(reply || "").replace(/\r/g, "").split("\n");
  const items = [], rows = [];
  let side = null, notes = [];
  const left = { title: "", items: [] }, right = { title: "", items: [] };
  for (const raw of lines) {
    const l = raw.replace(/\*\*/g, "").trim();
    if (!l) continue;
    if (notes.length || /^(?:NOTES?|ملاحظات|SPEAKER NOTES)\s*[:：]/i.test(l)) { notes.push(l.replace(/^(?:NOTES?|ملاحظات|SPEAKER NOTES)\s*[:：]\s*/i, "")); continue; }
    let m;
    if ((m = l.match(/^(?:LEFT|يسار|الجانب الأول)\s*[:：]\s*(.*)$/i))) { side = left; left.title = clean(m[1]); continue; }
    if ((m = l.match(/^(?:RIGHT|يمين|الجانب الثاني)\s*[:：]\s*(.*)$/i))) { side = right; right.title = clean(m[1]); continue; }
    if ((m = l.match(/^(?:QUOTE|اقتباس)\s*[:：]\s*(.*)$/i))) { out.quote = clean(m[1]).replace(/^["“”«»]+|["“”«»]+$/g, ""); continue; }
    if ((m = l.match(/^(?:BY|القائل)\s*[:：]\s*(.*)$/i))) { out.by = clean(m[1]).replace(/^[—–-]\s*/, ""); continue; }
    if ((m = l.match(/^(?:UNIT|الوحدة)\s*[:：]\s*(.*)$/i))) { out.unit = cut(m[1], 30); continue; }
    if ((m = l.match(/^(?:TAKEAWAY|الخلاصة)\s*[:：]\s*(.*)$/i))) { out.takeaway = cut(m[1], 160); continue; }
    if (/^\|?\s*:?-{2,}/.test(l) && !/[\p{L}\d]/u.test(l.replace(/-/g, ""))) continue;   // markdown table rule
    const b = BULLET.test(l) ? l.replace(BULLET, "") : null;
    if (side && b != null) { side.items.push(cut(b, 110)); continue; }
    if (l.includes("|")) { rows.push(l.replace(/^\||\|$/g, "").split("|").map((c) => cut(c, 60))); if (b != null) items.push(b); continue; }
    if (b != null) items.push(b);
    else if (kind === "quote" && !out.quote && l.length > 12) out.quote = clean(l).replace(/^["“”«»]+|["“”«»]+$/g, "");
    else if (kind === "bullets" || kind === "steps") { if (l.length > 12 && !/:\s*$/.test(l)) items.push(l); }
  }
  out.notes = cut(notes.join(" "), 700);
  if (kind === "two") { out.left = left; out.right = right; }
  if (kind === "table") {
    const w = Math.min(5, Math.max(0, ...rows.map((r) => r.length)));
    out.rows = rows.filter((r) => r.some((c) => c)).map((r) => Array.from({ length: w }, (_, i) => r[i] || "")).slice(0, 8);
  }
  if (kind === "stats") out.stats = items.map((x) => { const [v, ...rest] = x.split("|"); return { value: cut(v, 18), label: cut(rest.join(" "), 70) }; }).filter((s) => s.value && /\d/.test(latinDigits(s.value)) && s.label).slice(0, 4);
  if (kind === "chart") out.bars = items.map((x) => { const p = x.split("|"); return { label: cut(p[0], 28), value: parseNum(p.slice(1).join(" ")), raw: clean(p.slice(1).join(" ")) }; }).filter((b) => b.label && b.value != null && b.value >= 0).slice(0, 8);
  if (kind === "bullets" || kind === "steps") out.bullets = items.map((x) => { const s = splitLead(x); return { lead: cut(s.lead, 40), text: cut(s.text, 150) }; }).filter((x) => x.text).slice(0, 6);
  if (kind === "quote" && !out.quote && items[0]) out.quote = cut(items[0], 200);
  return out;
}

/** A slide that didn't come out in its kind becomes a plain bullet slide (never an empty slide). */
export function fixSlide(s, title) {
  const b = (list) => ({ kind: "bullets", title, notes: s.notes || "", bullets: list.filter((x) => x && x.text).slice(0, 6) });
  if (s.kind === "two" && !(s.left && s.right && s.left.items.length && s.right.items.length)) {
    const all = [...((s.left && s.left.items) || []), ...((s.right && s.right.items) || []), ...((s.bullets || []).map((x) => x.text))];
    return b(all.map((t) => splitLead(t)));
  }
  if (s.kind === "table" && !(s.rows && s.rows.length >= 2 && s.rows[0].length >= 2)) return b((s.rows || []).map((r) => ({ lead: r[0] || "", text: r.slice(1).join(" · ") || r[0] })));
  if (s.kind === "stats" && !(s.stats && s.stats.length >= 2)) return b((s.stats || []).map((x) => ({ lead: x.value, text: x.label })));
  if (s.kind === "chart" && !(s.bars && s.bars.length >= 2 && s.bars.some((x) => x.value > 0))) return b((s.bars || []).map((x) => ({ lead: x.label, text: x.raw || String(x.value) })));
  if (s.kind === "quote" && !s.quote) return b(s.bullets || []);
  if ((s.kind === "bullets" || s.kind === "steps") && !(s.bullets && s.bullets.length)) return { ...s, title, bullets: [] };
  return { ...s, title };
}

/** Figures on a stats / chart slide that the sources don't contain are removed (never drawn). */
export function checkFigures(s, source) {
  let dropped = 0;
  if (s.kind === "stats" && s.stats) { const keep = s.stats.filter((x) => !unbacked(x.value, source).length); dropped = s.stats.length - keep.length; s = { ...s, stats: keep }; }
  if (s.kind === "chart" && s.bars) { const keep = s.bars.filter((x) => !unbacked(x.raw || String(x.value), source).length); dropped = s.bars.length - keep.length; s = { ...s, bars: keep }; }
  return { slide: s, dropped };
}
/** All the text on a slide (for checks, previews and "copy as text"). */
export function slideText(s) {
  return [s.title, ...(s.bullets || []).map((x) => (x.lead ? x.lead + ": " : "") + x.text), s.left && s.left.title, ...((s.left && s.left.items) || []), s.right && s.right.title, ...((s.right && s.right.items) || []),
    ...(s.rows || []).map((r) => r.join(" | ")), ...(s.stats || []).map((x) => x.value + " — " + x.label), ...(s.bars || []).map((x) => x.label + ": " + (x.raw || x.value)), s.takeaway, s.quote, s.by].filter(Boolean).join("\n");
}
/** The whole deck as Markdown text. */
export function deckToText(deck) {
  return [`# ${deck.title}`, deck.subtitle || "", ...deck.slides.map((s, i) => `## ${i + 1}. ${s.title}\n${slideText({ ...s, title: "" })}${s.notes ? `\n(Notes: ${s.notes})` : ""}`)].filter(Boolean).join("\n\n");
}

// ---- 3. layout: a slide → shapes (1280 × 720 units; one list for the .pptx and the canvas) ---------
export const SW = 1280, SH = 720;
const M = 72;
const cw = (ch, size, bold) => size * (/[؀-ۿ]/.test(ch) ? 0.5 : /[A-Z0-9%$]/.test(ch) ? 0.62 : /[il.,:;'| ]/.test(ch) ? 0.3 : 0.52) * (bold ? 1.06 : 1);
const textW = (s, size, bold) => { let w = 0; for (const ch of String(s)) w += cw(ch, size, bold); return w; };
/** How many lines a text needs in a box `w` wide (word wrap, estimated widths). */
export function linesFor(text, size, w, bold) {
  let lines = 1, cur = 0; const sp = size * 0.3;
  for (const word of String(text || "").split(/\s+/).filter(Boolean)) {
    const ww = textW(word, size, bold);
    if (cur && cur + sp + ww > w) { lines += 1 + Math.floor(ww / w); cur = ww % w; } else cur += (cur ? sp : 0) + ww;
  }
  return lines;
}
/** The biggest font size (≤ max) at which the paragraphs fit the box. */
export function fitSize(paras, w, h, max, min = 12, gap = 0.45, lh = 1.2) {
  for (let s = max; s > min; s--) {
    let tot = 0;
    for (const p of paras) tot += linesFor((p.lead ? p.lead + " " : "") + p.text, s, w - (p.bullet ? s * 1.3 : 0), !!p.boldAll) * s * lh + s * gap;
    if (tot <= h) return s;
  }
  return min;
}
const box = (t, x, y, w, h, o = {}) => ({ t, x, y, w, h, ...o });
const txt = (x, y, w, h, paras, o = {}) => ({ t: "text", x, y, w, h, paras: (Array.isArray(paras) ? paras : [{ text: paras }]).map((p) => (typeof p === "string" ? { text: p } : p)), ...o });

function frame(th, title, i, deckTitle, rtl) {
  const out = [box("rect", 0, 0, SW, SH, { fill: th.bg })];
  out.push(box("ellipse", SW - 230, -150, 380, 380, { fill: th.accent, alpha: 0.07 }));
  out.push(box("rect", M, 56, 56, 6, { fill: th.accent, r: 3 }));
  const size = fitSize([{ text: title }], SW - 2 * M - 120, 80, 40, 24, 0, 1.12);
  out.push(txt(M, 74, SW - 2 * M - 120, 84, [{ text: title }], { size, bold: true, color: th.text, head: true, valign: "m", lh: 1.12 }));
  out.push(txt(M, SH - 46, 760, 24, [{ text: deckTitle }], { size: 13, color: th.sub }));
  out.push(txt(SW - M - 120, SH - 46, 120, 24, [{ text: String(i) }], { size: 13, color: th.sub, align: "r" }));
  return out;
}
const CY = 176, CH = SH - CY - 72;   // the content area under the title

/** Bar chart shapes inside a box (also used for report charts). */
export function chartShapes(bars, x, y, w, h, th, unit) {
  const out = [], k = bars.length, max = Math.max(...bars.map((b) => b.value), 0) || 1;
  const top = unit ? 30 : 6, labelH = 50, band = w / k, bw = Math.min(band * 0.62, 140);
  if (unit) out.push(txt(x, y, w, 24, [{ text: unit }], { size: 15, color: th.sub }));
  const base = y + h - labelH, room = base - (y + top) - 34;
  const hi = bars.reduce((m, b, i) => (b.value > bars[m].value ? i : m), 0);
  bars.forEach((b, i) => {
    const bh = Math.max(3, Math.round((b.value / max) * room)), bx = x + band * i + (band - bw) / 2;
    out.push(box("rect", bx, base - bh, bw, bh, { fill: i === hi ? th.accent2 : th.accent, r: 6 }));
    const v = b.raw && b.raw.length <= 14 ? b.raw : fmtN(b.value);
    out.push(txt(bx - 30, base - bh - 32, bw + 60, 28, [{ text: v }], { size: fitSize([{ text: v }], bw + 60, 28, 20, 11, 0, 1), bold: true, color: th.text, align: "c", valign: "b" }));
    out.push(txt(x + band * i + 4, base + 8, band - 8, labelH - 8, [{ text: b.label }], { size: fitSize([{ text: b.label }], band - 8, labelH - 8, 16, 10, 0, 1.1), color: th.sub, align: "c", lh: 1.1 }));
  });
  out.push(box("rect", x, base, w, 2, { fill: th.sub, alpha: 0.5 }));
  return out;
}
const fmtN = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US") : String(Math.round(v * 100) / 100));

/** One slide → shapes. deck: {title, subtitle, date}; th: a THEMES entry. */
export function layoutSlide(s, th, { i = 1, deckTitle = "", rtl = false, lang = "en" } = {}) {
  const W0 = words(lang);
  let out;
  if (s.kind === "cover" || s.kind === "closing") {
    out = [box("rect", 0, 0, SW, SH, { fill: th.cover }),
      box("ellipse", SW - 560, -200, 820, 820, { fill: th.accent, alpha: 0.16 }),
      box("ellipse", SW - 300, 430, 460, 460, { fill: th.accent2, alpha: 0.14 }),
      box("rect", M, s.kind === "cover" ? 250 : 290, 96, 8, { fill: th.accent, r: 4 })];
    const main = s.kind === "cover" ? s.title : W0.thanks, sub = s.kind === "cover" ? s.subtitle : W0.questions;
    const size = fitSize([{ text: main }], 780, 210, s.kind === "cover" ? 64 : 72, 30, 0, 1.08);
    out.push(txt(M, s.kind === "cover" ? 276 : 316, 780, 214, [{ text: main }], { size, bold: true, color: th.coverText, head: true, lh: 1.08 }));
    if (sub) out.push(txt(M, s.kind === "cover" ? 500 : 420, 780, 80, [{ text: sub }], { size: fitSize([{ text: sub }], 780, 80, 26, 14), color: th.coverText, alpha: 0.85 }));
    out.push(txt(M, SH - 84, 800, 28, [{ text: s.kind === "cover" ? (s.date || "") : deckTitle }], { size: 16, color: th.coverText, alpha: 0.7 }));
    out.slice(4).forEach((x, k) => { x.g = k + 1; });   // animation order: title, subtitle, date
    return rtl ? mirror(out) : out;
  }
  // a slide still being written, or one whose content is missing, is drawn as an (empty) key-points slide
  const ok = { two: s.left && s.right, table: s.rows && s.rows.length && s.rows[0].length, stats: s.stats && s.stats.length, chart: s.bars && s.bars.length, agenda: s.items, quote: true, bullets: true, steps: true }[s.kind];
  if (!ok) s = { ...s, kind: "bullets", bullets: s.bullets || [] };
  out = frame(th, s.title, i, deckTitle, rtl);
  const x = M, y = CY, w = SW - 2 * M, h = CH;
  const card = (cx, cy, cw2, ch2, o = {}) => box("rect", cx, cy, cw2, ch2, { fill: th.card, r: 18, ...o });
  // animation groups: everything added since the last call appears together (a card with its text…)
  let mark = out.length;
  const grp = (g) => { for (let q = mark; q < out.length; q++) out[q].g = g; mark = out.length; };
  if (s.kind === "agenda") {
    const list = s.items || [], cols = list.length > 5 ? 2 : 1, per = Math.ceil(list.length / cols), rowH = Math.min(78, h / per), colW = w / cols;
    list.forEach((t, k) => {
      const cx = x + colW * Math.floor(k / per), cy = y + rowH * (k % per);
      out.push(box("ellipse", cx, cy + (rowH - 46) / 2, 46, 46, { fill: th.accent }));
      out.push(txt(cx, cy + (rowH - 46) / 2, 46, 46, [{ text: String(k + 1) }], { size: 19, bold: true, color: th.onAccent, align: "c", valign: "m" }));
      out.push(txt(cx + 66, cy, colW - 90, rowH, [{ text: t }], { size: fitSize([{ text: t }], colW - 90, rowH, 24, 14, 0), color: th.text, valign: "m" }));
      grp(k + 1);
    });
  } else if (s.kind === "bullets" || s.kind === "steps") {
    const list = s.bullets || [];
    const cards = s.kind === "bullets" && list.length >= 2 && list.length <= 4 && list.every((b) => b.lead) && list.every((b) => b.text.length <= 120);
    if (s.kind === "steps" && list.length >= 2 && list.length <= 5) {
      const n = list.length, band = w / n, cyc = y + 26;
      out.push(box("rect", x + band / 2, cyc + 31, w - band, 4, { fill: th.accent, alpha: 0.35 }));
      list.forEach((b, k) => {
        const cx = x + band * k + band / 2;
        out.push(box("ellipse", cx - 33, cyc, 66, 66, { fill: k === n - 1 ? th.accent2 : th.accent }));
        out.push(txt(cx - 33, cyc, 66, 66, [{ text: String(k + 1) }], { size: 26, bold: true, color: th.onAccent, align: "c", valign: "m" }));
        const lead = b.lead || "", ty = cyc + 90;
        if (lead) out.push(txt(x + band * k + 10, ty, band - 20, 64, [{ text: lead }], { size: fitSize([{ text: lead }], band - 20, 64, 22, 13, 0, 1.1), bold: true, color: th.accent, align: "c", lh: 1.1 }));
        out.push(txt(x + band * k + 10, ty + (lead ? 70 : 0), band - 20, h - (ty - y) - (lead ? 70 : 0), [{ text: b.text }], { size: fitSize([{ text: b.text }], band - 20, h - (ty - y) - 70, 19, 11), color: th.text, align: "c" }));
        grp(k + 1);
      });
    } else if (cards) {
      const n = list.length, cols = n === 4 ? 2 : n, rows = n === 4 ? 2 : 1, gap = 24;
      const cwid = (w - gap * (cols - 1)) / cols, chei = rows === 1 ? Math.min(h, 330) : (h - gap * (rows - 1)) / rows;
      list.forEach((b, k) => {
        const cx = x + (cwid + gap) * (k % cols), cy = y + (chei + gap) * Math.floor(k / cols);
        out.push(card(cx, cy, cwid, chei));
        out.push(box("rect", cx + 24, cy + 24, 40, 6, { fill: k % 2 ? th.accent2 : th.accent, r: 3 }));
        const ls = fitSize([{ text: b.lead }], cwid - 48, 70, 26, 15, 0, 1.1);
        out.push(txt(cx + 24, cy + 44, cwid - 48, 72, [{ text: b.lead }], { size: ls, bold: true, color: th.text, head: true, lh: 1.1 }));
        out.push(txt(cx + 24, cy + 124, cwid - 48, chei - 144, [{ text: b.text }], { size: fitSize([{ text: b.text }], cwid - 48, chei - 144, 21, 12), color: th.text, alpha: 0.9 }));
        grp(k + 1);
      });
    } else {
      const paras = list.map((b) => ({ lead: b.lead, text: b.text, bullet: true }));
      out.push(txt(x, y, w, h, paras, { size: fitSize(paras, w, h, 27, 13, 0.7, 1.22), color: th.text, bulletColor: th.accent, gap: 0.7, lh: 1.22, leadColor: th.accent, byPara: true }));
      grp(1);   // one point at a time (by paragraph)
    }
  } else if (s.kind === "two") {
    const gap = 32, cwid = (w - gap) / 2;
    [[s.left, th.accent], [s.right, th.accent2]].forEach(([side, col], k) => {
      const cx = x + (cwid + gap) * k;
      out.push(card(cx, y, cwid, h));
      out.push(box("rect", cx, y, cwid, 72, { fill: col, r: 18 }));
      out.push(box("rect", cx, y + 40, cwid, 32, { fill: col }));
      out.push(txt(cx + 24, y, cwid - 48, 72, [{ text: side.title || "" }], { size: fitSize([{ text: side.title || "" }], cwid - 48, 64, 26, 14, 0, 1.05), bold: true, color: th.onAccent, valign: "m", head: true }));
      const paras = side.items.map((t) => ({ text: t, bullet: true }));
      out.push(txt(cx + 24, y + 96, cwid - 48, h - 116, paras, { size: fitSize(paras, cwid - 48, h - 116, 23, 12, 0.6), color: th.text, bulletColor: col, gap: 0.6 }));
      grp(k + 1);
    });
  } else if (s.kind === "table") {
    const rows = s.rows, cols = rows[0].length;
    const size = Math.max(12, Math.min(22, Math.floor(520 / (rows.length * 1.9 + cols * 1.5))));
    const rowH = Math.min(h / rows.length, Math.max(46, size * 2.6));
    out.push({ t: "table", x, y, w, h: rowH * rows.length, rows, rowH, size, head: th.accent, onHead: th.onAccent, band: th.card, text: th.text, rtl });
    grp(1);
  } else if (s.kind === "stats") {
    const n = s.stats.length, gap = 24, cwid = (w - gap * (n - 1)) / n, chei = Math.min(h, 330), cy = y + (h - chei) / 2;
    s.stats.forEach((st, k) => {
      const cx = x + (cwid + gap) * k;
      out.push(card(cx, cy, cwid, chei));
      out.push(box("rect", cx, cy, 8, chei, { fill: k % 2 ? th.accent2 : th.accent, r: 4 }));
      out.push(txt(cx + 28, cy + 36, cwid - 52, 110, [{ text: st.value }], { size: fitSize([{ text: st.value }], cwid - 52, 110, 64, 24, 0, 1), bold: true, color: k % 2 ? th.accent2 : th.accent, head: true, valign: "m", lh: 1 }));
      out.push(txt(cx + 28, cy + 160, cwid - 52, chei - 184, [{ text: st.label }], { size: fitSize([{ text: st.label }], cwid - 52, chei - 184, 22, 12), color: th.text }));
      grp(k + 1);
    });
  } else if (s.kind === "chart") {
    const side = s.takeaway ? 360 : 0;
    out.push(...chartShapes(s.bars, x, y, w - (side ? side + 32 : 0), h, th, s.unit));
    grp(1);
    if (side) {
      const cx = x + w - side;
      out.push(card(cx, y + 20, side, h - 40));
      out.push(box("rect", cx + 24, y + 48, 40, 6, { fill: th.accent2, r: 3 }));
      out.push(txt(cx + 24, y + 72, side - 48, h - 112, [{ text: s.takeaway }], { size: fitSize([{ text: s.takeaway }], side - 48, h - 112, 26, 13), color: th.text, bold: true }));
      grp(2);
    }
  } else if (s.kind === "quote") {
    out.push(txt(x, y - 30, 200, 170, [{ text: "“" }], { size: 180, bold: true, color: th.accent, alpha: 0.55, lh: 1 }));
    const q = s.quote || "";
    out.push(txt(x + 90, y + 40, w - 180, h - 150, [{ text: q }], { size: fitSize([{ text: q }], w - 180, h - 150, 42, 20, 0, 1.25), italic: true, color: th.text, head: true, valign: "m", align: "c", lh: 1.25 }));
    grp(1);
    if (s.by) { out.push(txt(x + 90, y + h - 90, w - 180, 40, [{ text: "— " + s.by }], { size: 22, color: th.accent, align: "c", bold: true })); grp(2); }
  }
  return rtl ? mirror(out) : out;
}
// right-to-left decks: every shape mirrored, text aligned right
function mirror(shapes) {
  return shapes.map((s) => {
    const m = { ...s, x: SW - s.x - s.w };
    if (s.t === "text") { m.align = s.align === "c" ? "c" : s.align === "r" ? "l" : "r"; m.rtl = true; }
    return m;
  });
}

/** The deck the UI keeps → the slides shown / saved: cover, agenda, content…, closing. */
export function fullDeck(deck) {
  const W0 = words(deck.lang);
  const body = deck.slides.filter((s) => !s.hidden);
  const list = [{ kind: "cover", title: deck.title, subtitle: deck.subtitle, date: deck.date, notes: deck.coverNotes || "" }];
  if (deck.agenda !== false && body.length >= 4) list.push({ kind: "agenda", title: W0.agenda, items: body.map((s) => s.title) });
  list.push(...body, { kind: "closing", title: W0.thanks, notes: "" });
  return list;
}
export function deckShapes(deck) {
  const th = THEMES[deck.theme] || THEMES.midnight, rtl = isRtl(deck.lang);
  return fullDeck(deck).map((s, k) => ({ slide: s, shapes: layoutSlide(s, th, { i: k + 1, deckTitle: deck.title, rtl, lang: deck.lang }) }));
}

/** The order things appear in: [[{idx, para?}], …] — groups by `g`; a list marked byPara appears point by point. */
export function animSteps(shapes) {
  const gs = [...new Set(shapes.filter((x) => x.g != null).map((x) => x.g))].sort((a, b) => a - b), steps = [];
  for (const g of gs) {
    const members = shapes.map((x, idx) => ({ x, idx })).filter((m) => m.x.g === g);
    const plain = members.filter((m) => !(m.x.byPara && m.x.paras.length > 1)).map((m) => ({ idx: m.idx }));
    const lists = members.filter((m) => m.x.byPara && m.x.paras.length > 1);
    if (!lists.length) { if (plain.length) steps.push(plain); continue; }
    const most = Math.max(...lists.map((m) => m.x.paras.length));
    for (let p = 0; p < most; p++) steps.push([...(p === 0 ? plain : []), ...lists.filter((m) => p < m.x.paras.length).map((m) => ({ idx: m.idx, para: p }))]);
  }
  return steps;
}

// ---- 4. the PowerPoint file (.pptx) -----------------------------------------------------------------
const EMU = 9525;   // 12,192,000 EMU wide / 1280 units
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const E = (v) => Math.round(v * EMU);
const clr = (hex, alpha) => `<a:srgbClr val="${hex}">${alpha != null && alpha < 1 ? `<a:alpha val="${Math.round(alpha * 100000)}"/>` : ""}</a:srgbClr>`;
const GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const langTag = (t) => (/[؀-ۿ]/.test(t) ? "ar-EG" : "en-US");
function runXml(text, o) {
  return `<a:r><a:rPr lang="${langTag(text)}" sz="${Math.round(o.size * 75)}"${o.bold ? ' b="1"' : ""}${o.italic ? ' i="1"' : ""} dirty="0"><a:solidFill>${clr(o.color, o.alpha)}</a:solidFill><a:latin typeface="${o.head ? "Calibri Light" : "Calibri"}"/><a:cs typeface="Arial"/></a:rPr><a:t>${esc(text)}</a:t></a:r>`;
}
function textXml(sh) {
  const algn = sh.align === "c" ? "ctr" : sh.align === "r" ? "r" : "l";
  const paras = sh.paras.map((p) => {
    const lh = Math.round((sh.lh || 1.2) * 100000 / 1.2);
    const bu = p.bullet ? `<a:buClr>${clr(sh.bulletColor || sh.color)}</a:buClr><a:buSzPct val="70000"/><a:buFont typeface="Arial"/><a:buChar char="■"/>` : "<a:buNone/>";
    const ind = p.bullet ? ` marL="${E(sh.size * 1.3)}" indent="-${E(sh.size * 1.3)}"` : "";
    const runs = (p.lead ? runXml(p.lead + (p.bullet ? " " : " "), { ...sh, bold: true, color: sh.leadColor || sh.color }) : "") + runXml(p.text || "", sh);
    return `<a:p><a:pPr algn="${algn}"${sh.rtl ? ' rtl="1"' : ""}${ind}><a:lnSpc><a:spcPct val="${lh}"/></a:lnSpc><a:spcAft><a:spcPts val="${Math.round(sh.size * (sh.gap ?? 0.45) * 75)}"/></a:spcAft>${bu}</a:pPr>${runs}</a:p>`;
  }).join("");
  return `<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="${sh.valign === "m" ? "ctr" : sh.valign === "b" ? "b" : "t"}" rtlCol="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras || '<a:p><a:endParaRPr lang="en-US"/></a:p>'}</p:txBody>`;
}
function shapeXml(sh, id) {
  const xf = `<a:xfrm><a:off x="${E(sh.x)}" y="${E(sh.y)}"/><a:ext cx="${E(Math.max(1, sh.w))}" cy="${E(Math.max(1, sh.h))}"/></a:xfrm>`;
  if (sh.t === "text")
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${xf}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>${textXml(sh)}</p:sp>`;
  if (sh.t === "table") {
    const cols = sh.rows[0].length, colW = Math.floor(E(sh.w) / cols);
    const cell = (t, ri) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr${sh.rtl || /[؀-ۿ]/.test(t) ? ' algn="r" rtl="1"' : ""}/>${runXml(t, { size: sh.size, bold: ri === 0, color: ri === 0 ? sh.onHead : sh.text })}</a:p></a:txBody><a:tcPr marL="${E(12)}" marR="${E(12)}" marT="${E(6)}" marB="${E(6)}" anchor="ctr"><a:solidFill>${clr(ri === 0 ? sh.head : sh.band, ri === 0 || ri % 2 ? 1 : 0.35)}</a:solidFill></a:tcPr></a:tc>`;
    return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${E(sh.x)}" y="${E(sh.y)}"/><a:ext cx="${colW * cols}" cy="${E(sh.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"${sh.rtl ? ' rtl="1"' : ""}/><a:tblGrid>${Array(cols).fill(`<a:gridCol w="${colW}"/>`).join("")}</a:tblGrid>` +
      sh.rows.map((r, ri) => `<a:tr h="${E(sh.rowH)}">${r.map((c) => cell(c, ri)).join("")}</a:tr>`).join("") + `</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  }
  const geom = sh.t === "ellipse" ? '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>'
    : sh.r ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.min(50000, Math.round(sh.r / Math.max(1, Math.min(sh.w, sh.h)) * 100000))}"/></a:avLst></a:prstGeom>` : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xf}${geom}<a:solidFill>${clr(sh.fill, sh.alpha)}</a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="0" anchor="ctr"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;
}
const TRANS_XML = { fade: "<p:fade/>", push: '<p:push dir="u"/>', wipe: '<p:wipe dir="r"/>', split: '<p:split orient="vert" dir="out"/>', cover: '<p:cover dir="l"/>', zoom: "<p:zoom/>" };
/** PowerPoint entrance effects (Fade 10, Fly in 2 / from bottom, Zoom 53) for the steps; on click or one after another. */
export function timingXml(shapes, anim, trigger = "click") {
  const steps = anim && anim !== "none" ? animSteps(shapes) : [];
  if (!steps.length) return "";
  let id = 2; const n = () => ++id;
  const spid = (idx) => idx + 1;   // shape k (k ≥ 1; 0 is the background) is written with id k + 1
  const tgt = (t) => `<p:tgtEl><p:spTgt spid="${spid(t.idx)}">${t.para != null ? `<p:txEl><p:pRg st="${t.para}" end="${t.para}"/></p:txEl>` : ""}</p:spTgt></p:tgtEl>`;
  const [pid, sub] = { fade: [10, 0], fly: [2, 4], zoom: [53, 16] }[anim] || [10, 0];
  const effect = (t, nodeType) => {
    const eid = n();
    const set = `<p:set><p:cBhvr><p:cTn id="${n()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt(t)}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
    const av = (attr, from, to) => `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${n()}" dur="500" fill="hold"/>${tgt(t)}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
    const fade = () => `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${n()}" dur="500"/>${tgt(t)}</p:cBhvr></p:animEffect>`;
    const body = anim === "fly" ? av("ppt_x", "#ppt_x", "#ppt_x") + av("ppt_y", "1+#ppt_h/2", "#ppt_y") : anim === "zoom" ? av("ppt_w", "0", "#ppt_w") + av("ppt_h", "0", "#ppt_h") + fade() : fade();
    return `<p:par><p:cTn id="${eid}" presetID="${pid}" presetClass="entr" presetSubtype="${sub}" fill="hold" grpId="0" nodeType="${nodeType}"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${set}${body}</p:childTnLst></p:cTn></p:par>`;
  };
  const inner = (step, delay, first) => { const pid2 = n(); return `<p:par><p:cTn id="${pid2}" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${step.map((t, k) => effect(t, k ? "withEffect" : first)).join("")}</p:childTnLst></p:cTn></p:par>`; };
  let seq;
  if (trigger === "auto") {
    const oid = n();
    seq = `<p:par><p:cTn id="${oid}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst>${steps.map((st, k) => inner(st, k * 500, "afterEffect")).join("")}</p:childTnLst></p:cTn></p:par>`;
  } else seq = steps.map((st) => { const oid = n(); return `<p:par><p:cTn id="${oid}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>${inner(st, 0, "clickEffect")}</p:childTnLst></p:cTn></p:par>`; }).join("");
  const used = [...new Set(steps.flat().map((t) => t.idx))].sort((a, b) => a - b);
  const bld = used.map((idx) => shapes[idx].t === "table" ? `<p:bldGraphic spid="${spid(idx)}" grpId="0"><p:bldAsOne/></p:bldGraphic>`
    : `<p:bldP spid="${spid(idx)}" grpId="0"${shapes[idx].byPara && shapes[idx].paras.length > 1 ? ' build="p"' : ""}${shapes[idx].t !== "text" ? ' animBg="1"' : ""}/>`).join("");
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${seq}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${bld}</p:bldLst></p:timing>`;
}
function slideXml(shapes, motion = {}) {
  const bg = shapes[0] && shapes[0].t === "rect" && shapes[0].w === SW ? shapes[0].fill : "FFFFFF";
  const trans = TRANS_XML[motion.transition] ? `<p:transition spd="med">${TRANS_XML[motion.transition]}</p:transition>` : "";
  return XML + `<p:sld ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill>${clr(bg)}</a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>${GRP}${shapes.slice(1).map((s, k) => shapeXml(s, k + 2)).join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${trans}${timingXml(shapes, motion.animation, motion.trigger)}</p:sld>`;
}
function themeXml(th, name) {
  const c = (tag, v) => `<a:${tag}><a:srgbClr val="${v}"/></a:${tag}>`;
  const font = '<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface="Arial"/>';
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  return XML + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}"><a:themeElements><a:clrScheme name="Attune">${c("dk1", "000000")}${c("lt1", "FFFFFF")}${c("dk2", "1F2937")}${c("lt2", "F3F4F6")}${c("accent1", th.accent)}${c("accent2", th.accent2)}${c("accent3", "10B981")}${c("accent4", "6366F1")}${c("accent5", "EF4444")}${c("accent6", "8B5CF6")}${c("hlink", "2563EB")}${c("folHlink", "7C3AED")}</a:clrScheme>` +
    `<a:fontScheme name="Attune"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>` +
    `<a:fmtScheme name="Attune"><a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst><a:lnStyleLst>${[1, 2, 3].map(() => `<a:ln w="6350" cap="flat" cmpd="sng" algn="ctr">${fill}<a:prstDash val="solid"/></a:ln>`).join("")}</a:lnStyleLst><a:effectStyleLst>${"<a:effectStyle><a:effectLst/></a:effectStyle>".repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}
const CLRMAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
const rels = (list) => XML + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type.startsWith("http") ? type : REL + type}" Target="${target}"/>`).join("")}</Relationships>`;
const CT = "application/vnd.openxmlformats-officedocument.presentationml.";

/** deck → .pptx bytes (16:9, one blank layout, every slide drawn with shapes, speaker notes). */
export function pptxFromDeck(deck) {
  const th = THEMES[deck.theme] || THEMES.midnight;
  const slides = deckShapes(deck);
  const n = slides.length;
  const files = [];
  const over = [];
  over.push(["/ppt/presentation.xml", CT + "presentation.main+xml"], ["/ppt/slideMasters/slideMaster1.xml", CT + "slideMaster+xml"], ["/ppt/slideLayouts/slideLayout1.xml", CT + "slideLayout+xml"],
    ["/ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml"], ["/ppt/theme/theme2.xml", "application/vnd.openxmlformats-officedocument.theme+xml"],
    ["/ppt/notesMasters/notesMaster1.xml", CT + "notesMaster+xml"], ["/ppt/presProps.xml", CT + "presProps+xml"], ["/ppt/viewProps.xml", CT + "viewProps+xml"], ["/ppt/tableStyles.xml", CT + "tableStyles+xml"],
    ["/docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml"], ["/docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml"]);
  for (let k = 1; k <= n; k++) over.push([`/ppt/slides/slide${k}.xml`, CT + "slide+xml"], [`/ppt/notesSlides/notesSlide${k}.xml`, CT + "notesSlide+xml"]);
  files.push({ name: "[Content_Types].xml", data: XML + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${over.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join("")}</Types>` });
  files.push({ name: "_rels/.rels", data: rels([["rId1", "officeDocument", "ppt/presentation.xml"], ["rId2", "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", "docProps/core.xml"], ["rId3", "extended-properties", "docProps/app.xml"]]) });
  files.push({ name: "docProps/core.xml", data: XML + `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(deck.title)}</dc:title><dc:creator>Attune</dc:creator></cp:coreProperties>` });
  files.push({ name: "docProps/app.xml", data: XML + `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Attune</Application><Slides>${n}</Slides></Properties>` });
  // presentation: rId1 master, rId2..n+1 slides, then notes master, props, theme, table styles
  const pr = [["rId1", "slideMaster", "slideMasters/slideMaster1.xml"]];
  for (let k = 1; k <= n; k++) pr.push(["rId" + (k + 1), "slide", `slides/slide${k}.xml`]);
  const nm = "rId" + (n + 2);
  pr.push([nm, "notesMaster", "notesMasters/notesMaster1.xml"], ["rId" + (n + 3), "presProps", "presProps.xml"], ["rId" + (n + 4), "viewProps", "viewProps.xml"], ["rId" + (n + 5), "theme", "theme/theme1.xml"], ["rId" + (n + 6), "tableStyles", "tableStyles.xml"]);
  files.push({ name: "ppt/_rels/presentation.xml.rels", data: rels(pr) });
  files.push({ name: "ppt/presentation.xml", data: XML + `<p:presentation ${NS} saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="${nm}"/></p:notesMasterIdLst><p:sldIdLst>${slides.map((_, k) => `<p:sldId id="${256 + k}" r:id="rId${k + 2}"/>`).join("")}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>` });
  files.push({ name: "ppt/presProps.xml", data: XML + `<p:presentationPr ${NS}/>` });
  files.push({ name: "ppt/viewProps.xml", data: XML + `<p:viewPr ${NS}><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>` });
  files.push({ name: "ppt/tableStyles.xml", data: XML + `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` });
  files.push({ name: "ppt/theme/theme1.xml", data: themeXml(th, "Attune " + th.name) });
  files.push({ name: "ppt/theme/theme2.xml", data: themeXml(THEMES.minimal, "Attune notes") });
  files.push({ name: "ppt/slideMasters/slideMaster1.xml", data: XML + `<p:sldMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GRP}</p:spTree></p:cSld>${CLRMAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>` });
  files.push({ name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "theme", "../theme/theme1.xml"]]) });
  files.push({ name: "ppt/slideLayouts/slideLayout1.xml", data: XML + `<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>${GRP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>` });
  files.push({ name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: rels([["rId1", "slideMaster", "../slideMasters/slideMaster1.xml"]]) });
  const ph = (id, name, type, x, y, w, h, idx) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="${type}"${idx ? ` idx="${idx}"` : ""}/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>${type === "body" ? '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>' : ""}</p:sp>`;
  files.push({ name: "ppt/notesMasters/notesMaster1.xml", data: XML + `<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GRP}${ph(2, "Slide Image Placeholder 1", "sldImg", 381000, 685800, 6096000, 3429000)}${ph(3, "Notes Placeholder 2", "body", 685800, 4343400, 5486400, 4114800, 1)}</p:spTree></p:cSld>${CLRMAP}</p:notesMaster>` });
  files.push({ name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", data: rels([["rId1", "theme", "../theme/theme2.xml"]]) });
  slides.forEach(({ slide, shapes }, k0) => {
    const k = k0 + 1;
    files.push({ name: `ppt/slides/slide${k}.xml`, data: slideXml(shapes, { transition: deck.transition, animation: deck.animation, trigger: deck.trigger }) });
    files.push({ name: `ppt/slides/_rels/slide${k}.xml.rels`, data: rels([["rId1", "slideLayout", "../slideLayouts/slideLayout1.xml"], ["rId2", "notesSlide", `../notesSlides/notesSlide${k}.xml`]]) });
    const note = slide.notes || "";
    files.push({ name: `ppt/notesSlides/notesSlide${k}.xml`, data: XML + `<p:notes ${NS}><p:cSld><p:spTree>${GRP}<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>${note ? `<a:pPr${/[؀-ۿ]/.test(note) ? ' algn="r" rtl="1"' : ""}/><a:r><a:rPr lang="${langTag(note)}" dirty="0"/><a:t>${esc(note)}</a:t></a:r>` : '<a:endParaRPr lang="en-US"/>'}</a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>` });
    files.push({ name: `ppt/notesSlides/_rels/notesSlide${k}.xml.rels`, data: rels([["rId1", "notesMaster", "../notesMasters/notesMaster1.xml"], ["rId2", "slide", `../slides/slide${k}.xml`]]) });
  });
  return zipStore(files);
}

// ---- 5. reports ---------------------------------------------------------------------------------
export const REPORT_KINDS = {
  business: "business report", research: "research report", status: "project status report", incident: "incident report",
  financial: "financial analysis", market: "market study", technical: "technical report", proposal: "proposal",
};
export function reportOutlineMessages({ topic, kind, n, lang, source }) {
  return [{ role: "user", content:
`You plan a professional ${REPORT_KINDS[kind] || "report"}.
TOPIC: ${topic}${source ? `\n\nMATERIAL (facts to use):\n${source.slice(0, 3500)}` : ""}

Write exactly this and nothing else:
TITLE: <the report's title, at most 10 words>
SUBTITLE: <one line: what it covers, for whom>
then exactly ${n} numbered section headings in a logical order, e.g.
1. <heading>

Do NOT include an executive summary, conclusion, recommendations or sources section (the app adds them). Keep TITLE and SUBTITLE in English; write the headings in ${S_LANGS[lang] || "English"}.` }];
}
/** → { title, subtitle, sections: [heading] } */
export function parseReportOutline(reply, n, topic = "") {
  const lines = String(reply || "").replace(/\r/g, "").split("\n").map((l) => l.replace(/\*\*/g, "").trim()).filter(Boolean);
  let title = "", subtitle = ""; const secs = [];
  for (const l of lines) {
    const t = l.match(/^(?:TITLE|العنوان)\s*[:：]\s*(.+)$/i); if (t && !title) { title = clean(t[1]); continue; }
    const s = l.match(/^(?:SUBTITLE|العنوان الفرعي)\s*[:：]\s*(.+)$/i); if (s && !subtitle) { subtitle = clean(s[1]); continue; }
    const m = l.match(/^(?:#{1,3}\s*)?(?:\d{1,2}|[٠-٩]{1,2})\s*[.):-]\s*(.+)$/);
    if (m) { const h = cut(m[1].replace(/\[[^\]]*\]/g, ""), 90); if (h && !/executive summary|conclusion|recommendation|sources|الملخص|الخلاصة|التوصيات|المصادر/i.test(h) && !secs.includes(h)) secs.push(h); }
  }
  if (!title) title = cut(topic || "Report", 90);
  if (secs.length < 2) {
    const ar = /[؀-ۿ]/.test(title + topic);
    for (const h of ar ? ["الخلفية", "الوضع الحالي", "التحليل", "المخاطر والفرص"] : ["Background", "Current situation", "Analysis", "Risks and opportunities"]) if (secs.length < n && !secs.includes(h)) secs.push(h);
  }
  return { title, subtitle: cut(subtitle, 140), sections: secs.slice(0, n) };
}
export function sectionMessages({ title, topic, kind, heading, i, n, others, lang, source, words: nWords = 250, conclusion = false }) {
  return [{ role: "user", content:
`You write ${conclusion ? "the CONCLUSIONS AND RECOMMENDATIONS" : `section ${i} of ${n}, "${heading}",`} of the ${REPORT_KINDS[kind] || "report"} "${title}" (topic: ${topic}).${conclusion ? `\nThe sections were: ${others.join("; ")}.` : ` The other sections are: ${others.filter((h) => h !== heading).join("; ")} — don't repeat them.`}${source ? `\n\nMATERIAL — use only these facts; copy every number exactly:\n${source}` : "\n\nNo sources were given: don't invent statistics, prices, dates, names or quotes; where a figure would be needed, say what should be measured."}

Write about ${nWords} words in Markdown: ${conclusion ? "a short conclusion paragraph, then numbered, specific, actionable recommendations (who does what)." : "clear paragraphs; ### sub-headings if useful; bullet lists for lists; a table (rows written as cell | cell | cell, with a header row) when comparing things or giving figures."}
Do not write the section's own heading. Professional, precise, no filler. Write in ${S_LANGS[lang] || "English"}.` }];
}
export function summaryMessages({ title, lang, body }) {
  return [{ role: "user", content:
`Here is the report "${title}":
${body}

Write its EXECUTIVE SUMMARY: one paragraph of 4–6 sentences (the purpose, the main findings, the main recommendation), then the line "FINDINGS:" and 3–5 bullet points "- <finding>". Use only what the report says; copy figures exactly. Keep the word FINDINGS in English. Write in ${S_LANGS[lang] || "English"}.` }];
}
/** The summary reply → { text, findings[] } */
export function parseSummary(reply) {
  const [a, b = ""] = String(reply || "").split(/^\s*(?:\*\*|#+\s*)?(?:FINDINGS|KEY FINDINGS|أهم النتائج|النتائج)(?:\*\*)?\s*[:：]?\s*(?:\*\*)?\s*$/im);
  const text = clean(a.replace(/^\s*(?:#+\s*)?executive summary\s*[:：]?/i, "").replace(/\n+/g, " "));
  const findings = b.split("\n").map((l) => l.trim()).filter((l) => BULLET.test(l)).map((l) => clean(l.replace(BULLET, ""))).filter(Boolean).slice(0, 6);
  return { text, findings };
}
/** A section's Markdown → blocks (its own heading dropped; # headings become sub-headings). */
export function sectionBlocks(md, heading) {
  const b = textToBlocks(String(md || "").replace(/^\s*(?:NOTES?|SECTION)\s*[:：].*$/gim, ""));
  const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\d]+/gu, "");
  while (b.length && /^h\d$/.test(b[0].type) && (norm(b[0].text) === norm(heading) || norm(b[0].text).includes(norm(heading)))) b.shift();
  return b.map((x) => (/^h[12]$/.test(x.type) ? { ...x, type: "h3" } : x));
}

// a sheet (rows, first = header) → facts computed by code, and a chart of the first number column
export function dataSummary(rows0, name = "data") {
  const rows = (rows0 || []).filter((r) => r && r.some((c) => String(c ?? "").trim()));
  if (rows.length < 2) return null;
  const head = rows[0].map((h, i) => String(h || "").trim() || "Column " + (i + 1)), body = rows.slice(1);
  const isNum = (v) => v != null && String(v).trim() !== "" && parseNum(String(v)) != null && /^[\s$€£\-+]*[\d٠-٩][\d٠-٩,٬.٫\s]*%?\s*[A-Za-z؀-ۿ]{0,4}$/.test(String(v).trim());
  const numCols = head.map((_, i) => i).filter((i) => body.filter((r) => isNum(r[i])).length >= Math.max(2, body.length * 0.6));
  const textCol = head.findIndex((_, i) => !numCols.includes(i) && body.filter((r) => String(r[i] || "").trim()).length >= body.length * 0.6);
  const lines = [`${name}: ${body.length} rows, columns: ${head.join(", ")}.`];
  const r2 = (v) => Math.round(v * 100) / 100;
  for (const c of numCols.slice(0, 6)) {
    const v = body.map((r) => parseNum(String(r[c]))).filter((x) => x != null);
    const sum = v.reduce((a, b) => a + b, 0);
    lines.push(`${head[c]}: total ${fmtN(r2(sum))}, average ${fmtN(r2(sum / v.length))}, lowest ${fmtN(Math.min(...v))}, highest ${fmtN(Math.max(...v))}.`);
    if (textCol >= 0) {
      // the same name on several rows (a crane with two jobs): its total too
      const by = new Map();
      for (const r of body) { const k = String(r[textCol] || "").trim(), x = parseNum(String(r[c])); if (k && x != null) by.set(k, (by.get(k) || 0) + x); }
      if (by.size < body.length && by.size <= 15) lines.push(`${head[c]} by ${head[textCol]}: ${[...by].map(([k, v]) => `${k} ${fmtN(r2(v))}`).join(", ")}.`);
      const top = [...body].filter((r) => isNum(r[c])).sort((a, b) => parseNum(String(b[c])) - parseNum(String(a[c]))).slice(0, 3);
      lines.push(`Highest ${head[c]}: ${top.map((r) => `${r[textCol]} (${r[c]})`).join(", ")}.`);
    }
  }
  let chart = null;
  if (numCols.length && textCol >= 0) {
    const c = numCols[0];
    // same label twice (e.g. a month per row per crane) → added up
    const sums = new Map();
    for (const r of body) { const k = cut(String(r[textCol] || ""), 28); const v = parseNum(String(r[c])); if (k && v != null && v >= 0) sums.set(k, (sums.get(k) || 0) + v); }
    const bars = [...sums].map(([label, value]) => ({ label, value: r2(value) }));
    const top = bars.length > 10 ? [...bars].sort((a, b) => b.value - a.value).slice(0, 10) : bars;
    if (top.length >= 2) chart = { title: `${head[c]} — ${head[textCol]}`, bars: top, unit: head[c] };
  }
  return { text: lines.join("\n"), chart, table: [head, ...body.slice(0, 20).map((r) => head.map((_, i) => String(r[i] ?? "")))], rows: body.length };
}

/** The report → blocks for Word / PDF: cover, contents, summary, chart, sections, conclusion, sources, data. */
export function reportBlocks(rep, { chartImage } = {}) {
  const W0 = words(rep.lang), out = [];
  out.push({ type: "title", text: rep.title });
  if (rep.subtitle) out.push({ type: "subtitle", text: rep.subtitle });
  out.push({ type: "p", text: [rep.date, W0.prepared].filter(Boolean).join(" · ") });
  const heads = [W0.summary, ...rep.sections.map((s) => s.heading), W0.conclusion, ...(rep.sources && rep.sources.length ? [W0.sources] : []), ...(rep.data ? [W0.data] : [])];
  out.push({ type: "h2", text: W0.contents });
  heads.forEach((h, i) => out.push({ type: "li", text: `${i + 1}. ${h}` }));
  out.push({ type: "pagebreak" });
  out.push({ type: "h1", text: `1. ${W0.summary}` });
  if (rep.summary && rep.summary.text) out.push({ type: "p", text: rep.summary.text });
  if (rep.summary && rep.summary.findings.length) { out.push({ type: "h3", text: W0.findings }); rep.summary.findings.forEach((f) => out.push({ type: "li", text: f })); }
  if (chartImage && rep.data && rep.data.chart) { out.push({ type: "image", ...chartImage }); out.push({ type: "caption", text: `${W0.chart}: ${rep.data.chart.title}` }); }
  rep.sections.forEach((s, i) => { out.push({ type: "h1", text: `${i + 2}. ${s.heading}` }); out.push(...(s.blocks || [])); });
  out.push({ type: "h1", text: `${rep.sections.length + 2}. ${W0.conclusion}` });
  out.push(...(rep.conclusion || []));
  let k = rep.sections.length + 3;
  if (rep.sources && rep.sources.length) { out.push({ type: "h1", text: `${k++}. ${W0.sources}` }); rep.sources.forEach((s, i) => out.push({ type: "li", text: `[${i + 1}] ${s.title} — ${s.url}` })); }
  if (rep.data) { out.push({ type: "h1", text: `${k}. ${W0.data}` }); out.push({ type: "p", text: rep.data.text }); if (rep.data.table) out.push({ type: "table", rows: rep.data.table }); }
  return out;
}
/** A report's body text (for the summary prompt and the checks), shortened to `max` characters. */
export function reportText(rep, max = 6000) {
  const t = rep.sections.map((s) => `## ${s.heading}\n${(s.blocks || []).map((b) => (b.type === "table" ? b.rows.map((r) => r.join(" | ")).join("\n") : b.text)).join("\n")}`).join("\n\n");
  return t.length > max ? t.slice(0, max) + "…" : t;
}

/** A slide → the same tagged text the model writes (so a person can edit it and it is parsed back). */
export function slideToText(s) {
  if (s.kind === "two") return [`LEFT: ${(s.left && s.left.title) || ""}`, ...((s.left && s.left.items) || []).map((t) => "- " + t), `RIGHT: ${(s.right && s.right.title) || ""}`, ...((s.right && s.right.items) || []).map((t) => "- " + t)].join("\n");
  if (s.kind === "table") return (s.rows || []).map((r) => r.join(" | ")).join("\n");
  if (s.kind === "stats") return (s.stats || []).map((x) => `- ${x.value} | ${x.label}`).join("\n");
  if (s.kind === "chart") return [s.unit ? "UNIT: " + s.unit : "", ...(s.bars || []).map((b) => `- ${b.label} | ${b.raw || b.value}`), s.takeaway ? "TAKEAWAY: " + s.takeaway : ""].filter(Boolean).join("\n");
  if (s.kind === "quote") return `QUOTE: ${s.quote || ""}\nBY: ${s.by || ""}`;
  return (s.bullets || []).map((b) => "- " + (b.lead ? b.lead + ": " : "") + b.text).join("\n");
}

const sentences = (t) => String(t || "").split(/(?<=[.!?؟])\s+/).map((x) => x.trim()).filter((x) => x.length > 20);
/** A finished report → a presentation (by code, no AI): findings, a slide per section, the chart, recommendations. */
export function deckFromReport(rep) {
  const W0 = words(rep.lang), slides = [];
  if (rep.summary && rep.summary.findings.length >= 2) slides.push({ kind: "bullets", title: W0.findings, bullets: rep.summary.findings.slice(0, 5).map((f) => { const s = splitLead(f); return { lead: cut(s.lead, 40), text: cut(s.text, 150) }; }), notes: cut(rep.summary.text, 700) });
  if (rep.data && rep.data.chart) slides.push({ kind: "chart", title: cut(rep.data.chart.title, 80), bars: rep.data.chart.bars.slice(0, 8), unit: cut(rep.data.chart.unit, 30), notes: "" });
  for (const sec of rep.sections) {
    const bl = sec.blocks || [];
    const lis = bl.filter((b) => b.type === "li").map((b) => splitLead(b.text));
    const tbl = bl.find((b) => b.type === "table" && b.rows.length >= 3 && b.rows.length <= 8 && b.rows[0].length <= 5);
    const paras = bl.filter((b) => b.type === "p").map((b) => b.text);
    const notes = cut(paras.join(" "), 700);
    if (tbl && lis.length < 2) { slides.push({ kind: "table", title: sec.heading, rows: tbl.rows.map((r) => r.map((c) => cut(c, 60))), notes }); continue; }
    const pts = lis.length >= 2 ? lis : paras.flatMap(sentences).slice(0, 4).map((t) => ({ lead: "", text: t }));
    slides.push({ kind: "bullets", title: sec.heading, bullets: pts.slice(0, 5).map((p) => ({ lead: cut(p.lead, 40), text: cut(p.text, 150) })), notes });
  }
  const recs = (rep.conclusion || []).filter((b) => b.type === "li").map((b) => splitLead(b.text));
  if (recs.length >= 2) slides.push({ kind: "steps", title: W0.conclusion, bullets: recs.slice(0, 5).map((p) => ({ lead: cut(p.lead, 40), text: cut(p.text, 150) })), notes: "" });
  return { title: rep.title, subtitle: rep.subtitle, lang: rep.lang, date: rep.date, theme: "ocean", slides: slides.filter((s) => (s.bullets ? s.bullets.length : true)) };
}
