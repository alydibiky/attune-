/* ---- Spaces: Assistants, Projects, Artifacts and Themes (v5.14) --------------------------
   Pure logic and storage, no React — unit-tested in tests/unit/spaces.test.mjs.

   - Assistants: a saved "who you are talking to" — a name, an emoji and standing
     instructions (like Gemini's Gems). A chat started with one carries its id, and
     its instructions go into every answer's system prompt.
   - Projects: a folder for related chats with shared instructions and knowledge
     (pasted notes, attached text files). Only the passages that match the question
     go to the model — a phone model's window is small, so the whole folder can't.
   - Artifacts: a web page, document or program pulled out of an answer into its
     own full-screen view, saved with versions, shared or saved as a file.
   - Themes: the app's colours come from Tailwind's CSS variables (--color-teal-300 …),
     so a theme swaps the variables on <html> — every screen follows, nothing is rewritten.
   Everything lives in localStorage under attune:* keys, so backups include it.         */

export const ASSISTANTS_KEY = "attune:assistants:v1";
export const PROJECTS_KEY = "attune:projects:v1";
export const ARTIFACTS_KEY = "attune:artifacts:v1";
export const THEME_KEY = "attune:theme:v1";

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
export const newSpaceId = (p) => (p || "s") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---- Chat helpers ------------------------------------------------------------------ */
// A message that leans on the conversation: short, or pointing back at "it /
// this / that / the model / the price". Searched on its own it finds nothing
// useful, so it is rewritten first (v5.14).
export function looksLikeFollowUp(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words <= 4) return true;
  return words <= 14 && /\b(it|its|it's|this|that|these|those|they|them|he|she|the (model|price|same|one|brand|company|version)|which one|and (the|what|how)|what about|how about)\b|(^|\s)(ده|دي|دا|دول|هو|هي|بتاعه|بتاعها|الموديل ده|طيب|وكمان|وايه|و إيه)(\s|[?؟]|$)/i.test(t);
}

/* ---- Assistants ----------------------------------------------------------------------- */
export const BUILTIN_ASSISTANTS = [
  { id: "a-crane", emoji: "🏗️", name: "Crane expert", desc: "Mobile & tower cranes: lifts, load charts, hydraulics, safety",
    instructions: "You are a senior mobile-crane engineer and lift planner (Liebherr, Demag, Grove, Terex, Tadano, XCMG, Sany, Zoomlion). Explain mechanical, hydraulic and electrical systems step by step, very clearly, and give every technical term in English and Egyptian Arabic, e.g. outrigger (رجل التثبيت). For lifts: state assumptions (radius, boom length, counterweight, outrigger base), use the load chart logic, and always add the safety margin and what to check on site. Never invent a capacity figure — say when a chart is needed.",
    starters: ["Explain how a crane's hydraulic telescoping works", "What should I check before a 40 t lift at 12 m radius?", "Why does a crane need counterweight? Explain simply"] },
  { id: "a-turkish", emoji: "🇹🇷", name: "Turkish tutor", desc: "From beginner to native-like, with corrections",
    instructions: "You are a patient Turkish teacher for an Egyptian Arabic speaker who understands Turkish but struggles to build complex sentences. Speak mostly Turkish at the learner's level, explain grammar in simple English with Egyptian Arabic notes. When the learner writes Turkish, first correct every mistake — especially verb tenses — showing wrong → right and a one-line reason, then continue the conversation. End each reply with one short practice question.",
    starters: ["Let's practise: ask me about my day in Turkish", "Explain -miş past tense simply", "Correct this: Dün markete gidiyorum"] },
  { id: "a-web", emoji: "🌐", name: "Website builder", desc: "Complete, good-looking sites and tools from one prompt",
    instructions: "You build complete, professional single-file websites and web apps (HTML + CSS + JS in one file, no internet resources). Always produce the whole file in one ```html block, finished and polished: real content, mobile-first layout, a consistent colour palette, dark mode, working interactions. Never leave placeholders or TODOs.",
    starters: ["A landing page for my crane rental company with services, fleet and a contact form", "A to-do app with categories and due dates", "A loan calculator with a monthly payment table"] },
  { id: "a-accountant", emoji: "📊", name: "Accountant (Egypt)", desc: "Invoices, VAT, zakat, statements — worked out exactly",
    instructions: "You are a careful accountant who knows Egyptian practice (14% VAT, withholding tax, e-invoicing). Work every number step by step, one line per step, and put the total in bold at the end. State the rule or rate you apply. If a figure is missing, ask for it or state your assumption.",
    starters: ["Invoice: 3 cranes × 4 days × 12,500 EGP + 14% VAT", "Explain withholding tax on a service contract", "Make a simple monthly cash-flow table"] },
  { id: "a-writer", emoji: "✍️", name: "Writer", desc: "Emails, reports and posts in English or Arabic",
    instructions: "You write clear, professional text: emails, reports, proposals, posts. Match the language asked (English, Modern Standard Arabic or Egyptian Arabic). Give the finished text first, ready to copy, then at most one line of notes.",
    starters: ["A polite email asking a client to pay an overdue invoice", "A LinkedIn post about our new 500 t crane", "Turn these notes into a short report: "] },
];

export function loadAssistants() {
  const mine = read(ASSISTANTS_KEY, []);
  return [...(Array.isArray(mine) ? mine : []), ...BUILTIN_ASSISTANTS];
}
export function saveCustomAssistants(list) {
  return write(ASSISTANTS_KEY, (list || []).filter((a) => a && !a.builtin && !BUILTIN_ASSISTANTS.some((b) => b.id === a.id)).slice(0, 50));
}
export function upsertAssistant(a) {
  const mine = read(ASSISTANTS_KEY, []).filter((x) => x.id !== a.id);
  const clean = { id: a.id || newSpaceId("a"), emoji: (a.emoji || "✨").slice(0, 4), name: String(a.name || "").trim().slice(0, 40) || "My assistant",
    desc: String(a.desc || "").trim().slice(0, 90), instructions: String(a.instructions || "").trim().slice(0, 4000),
    starters: (a.starters || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4) };
  saveCustomAssistants([clean, ...mine]);
  return clean;
}
export function deleteAssistant(id) { saveCustomAssistants(read(ASSISTANTS_KEY, []).filter((x) => x.id !== id)); }
export const isBuiltinAssistant = (id) => BUILTIN_ASSISTANTS.some((b) => b.id === id);

/* ---- Projects ------------------------------------------------------------------------- */
export function loadProjects() { const v = read(PROJECTS_KEY, []); return Array.isArray(v) ? v : []; }
export function saveProjectList(list) { return write(PROJECTS_KEY, (list || []).slice(0, 40)); }
export function upsertProject(p) {
  const list = loadProjects().filter((x) => x.id !== p.id);
  const clean = { id: p.id || newSpaceId("p"), emoji: (p.emoji || "📁").slice(0, 4), name: String(p.name || "").trim().slice(0, 50) || "Project",
    instructions: String(p.instructions || "").trim().slice(0, 4000),
    knowledge: (p.knowledge || []).map((k) => ({ id: k.id || newSpaceId("k"), name: String(k.name || "Note").slice(0, 80), text: String(k.text || "").slice(0, 200000) })).filter((k) => k.text.trim()),
    created: p.created || Date.now(), updated: Date.now() };
  if (!saveProjectList([clean, ...list])) return null;       // storage full
  return clean;
}
export function deleteProject(id) { saveProjectList(loadProjects().filter((x) => x.id !== id)); }

// Words that carry meaning (English and Arabic), for matching a question to passages.
const STOP = new Set("the a an and or of to in on for with is are was were be it this that what how why when which who me my i you your we our do does did can could should would will from at by as about into than then there here".split(" "));
export function words(t) {
  return String(t || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
}
/** Split a document into ~chunk-sized passages on paragraph/line breaks. */
export function chunks(text, size = 900) {
  const parts = String(text || "").replace(/\r/g, "").split(/\n{2,}|(?<=\.)\s+(?=[A-Z؀-ۿ])/);
  const out = []; let cur = "";
  for (const p of parts) {
    if ((cur + "\n" + p).length > size && cur) { out.push(cur.trim()); cur = ""; }
    if (p.length > size) { for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size).trim()); continue; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}
/** The passages of a project's knowledge that best match the question, within a budget. */
export function knowledgeFor(project, question, budget = 3500) {
  const docs = (project && project.knowledge) || [];
  if (!docs.length) return [];
  const all = [];
  for (const d of docs) chunks(d.text).forEach((c, i) => all.push({ doc: d.name, i, text: c }));
  const total = all.reduce((n, c) => n + c.text.length, 0);
  if (total <= budget) return all;                            // small: everything fits
  const q = new Set(words(question));
  const scored = all.map((c) => {
    const w = words(c.text); let hit = 0;
    for (const x of w) if (q.has(x)) hit++;
    return { ...c, score: hit / Math.sqrt(w.length + 5) };
  }).sort((a, b) => b.score - a.score);
  const out = []; let used = 0;
  for (const c of scored) {
    if (c.score <= 0 && out.length) break;
    if (used + c.text.length > budget) continue;
    out.push(c); used += c.text.length;
  }
  return out.sort((a, b) => (a.doc === b.doc ? a.i - b.i : 0));
}

/** The extra system-prompt block for a chat that belongs to an assistant and/or project. */
export function spaceBlock({ assistant, project, question }) {
  const parts = [];
  if (assistant && assistant.instructions) parts.push(`YOUR ROLE — you are "${assistant.name}":\n${assistant.instructions}`);
  if (project) {
    if (project.instructions) parts.push(`PROJECT "${project.name}" — standing instructions:\n${project.instructions}`);
    const k = knowledgeFor(project, question);
    if (k.length) parts.push(`PROJECT KNOWLEDGE (the user's own files and notes — use them when relevant and say which file you used, e.g. "from ${k[0].doc}"; if they don't cover the question, say so and answer normally):\n` +
      k.map((c) => `[${c.doc}]\n${c.text}`).join("\n\n"));
  }
  return parts.join("\n\n");
}

/* ---- Artifacts ------------------------------------------------------------------------ */
const FENCE_RE = /```([\w+-]*)[^\n]*\n([\s\S]*?)\n```/g;
function titleOf(content, kind) {
  if (kind === "html") {
    const t = content.match(/<title>([^<]{1,80})<\/title>/i) || content.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i);
    return t ? t[1].trim() : "Web page";
  }
  const h = content.match(/^#{1,3}\s+(.{1,80})$/m) || content.match(/^\*\*(.{3,80})\*\*/m);
  return h ? h[1].replace(/[*#]/g, "").trim() : (kind === "code" ? "Program" : "Document");
}
/**
 * What in an answer is worth opening as an artifact:
 *   a complete web page (```html with <html>/<body>/<script>/<style>) → html
 *   a program of 15+ lines → code
 *   a long structured document (≥ 900 chars with headings, a table or many list items) → doc
 */
export function detectArtifact(text) {
  const s = String(text || "");
  let m; FENCE_RE.lastIndex = 0;
  let best = null;
  while ((m = FENCE_RE.exec(s))) {
    const lang = (m[1] || "").toLowerCase(), body = m[2];
    if ((lang === "html" || /^\s*<!doctype html|<html[\s>]/i.test(body)) && /<(body|script|style|div|main|section)[\s>]/i.test(body))
      return { kind: "html", lang: "html", title: titleOf(body, "html"), content: body };
    if (body.split("\n").length >= 15 && (!best || body.length > best.content.length)) best = { kind: "code", lang: lang || "text", title: titleOf(s, "code"), content: body };
  }
  if (best) return best;
  const plain = s.replace(FENCE_RE, "");
  const structure = (plain.match(/^#{1,3}\s/mg) || []).length * 2 + (/\n\|.+\|\n\|[\s:|-]+\|/.test(plain) ? 3 : 0) + Math.min(4, (plain.match(/^\s*(?:[-*]|\d+\.)\s/mg) || []).length / 3);
  if (plain.length >= 900 && structure >= 3) return { kind: "doc", lang: "markdown", title: titleOf(plain, "doc"), content: s.trim() };
  return null;
}
export function loadArtifacts() { const v = read(ARTIFACTS_KEY, []); return Array.isArray(v) ? v : []; }
/** Save an artifact; the same id (or the same title and kind) adds a new version. → saved item or null */
export function saveArtifact(a) {
  const list = loadArtifacts();
  const same = list.find((x) => (a.id && x.id === a.id) || (!a.id && x.title === a.title && x.kind === a.kind));
  let item;
  if (same) {
    const versions = same.versions || [];
    if (versions.length && versions[versions.length - 1].content === a.content) return same;   // unchanged
    item = { ...same, updated: Date.now(), versions: [...versions, { content: a.content, ts: Date.now() }].slice(-10) };
  } else {
    item = { id: newSpaceId("art"), kind: a.kind, lang: a.lang, title: String(a.title || "Untitled").slice(0, 80), created: Date.now(), updated: Date.now(),
      versions: [{ content: a.content, ts: Date.now() }] };
  }
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 60);
  // Full storage: drop old versions, then the oldest artifacts, rather than fail.
  if (write(ARTIFACTS_KEY, next)) return item;
  const slim = next.map((x) => ({ ...x, versions: x.versions.slice(-1) }));
  for (let n = slim.length; n > 0; n = Math.floor(n * 0.7)) if (write(ARTIFACTS_KEY, slim.slice(0, n))) return item;
  return null;
}
export function deleteArtifact(id) { write(ARTIFACTS_KEY, loadArtifacts().filter((x) => x.id !== id)); }
export const latest = (a) => (a && a.versions && a.versions.length ? a.versions[a.versions.length - 1].content : "");
export function fileNameFor(a) {
  const base = String(a.title || "artifact").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
  const ext = a.kind === "html" ? "html" : a.kind === "doc" ? "md" : ({ python: "py", javascript: "js", js: "js", py: "py", css: "css", json: "json", sql: "sql", kotlin: "kt", java: "java" }[a.lang] || "txt");
  return base + "." + ext;
}

/* ---- Themes --------------------------------------------------------------------------- */
// Tailwind 4's default palette (oklch), only the families a theme needs.
export const PALETTES = {"teal":{"50":"oklch(98.4% 0.014 180.72)","100":"oklch(95.3% 0.051 180.801)","200":"oklch(91% 0.096 180.426)","300":"oklch(85.5% 0.138 181.071)","400":"oklch(77.7% 0.152 181.912)","500":"oklch(70.4% 0.14 182.503)","600":"oklch(60% 0.118 184.704)","700":"oklch(51.1% 0.096 186.391)","800":"oklch(43.7% 0.078 188.216)","900":"oklch(38.6% 0.063 188.416)","950":"oklch(27.7% 0.046 192.524)"},"violet":{"50":"oklch(96.9% 0.016 293.756)","100":"oklch(94.3% 0.029 294.588)","200":"oklch(89.4% 0.057 293.283)","300":"oklch(81.1% 0.111 293.571)","400":"oklch(70.2% 0.183 293.541)","500":"oklch(60.6% 0.25 292.717)","600":"oklch(54.1% 0.281 293.009)","700":"oklch(49.1% 0.27 292.581)","800":"oklch(43.2% 0.232 292.759)","900":"oklch(38% 0.189 293.745)","950":"oklch(28.3% 0.141 291.089)"},"blue":{"50":"oklch(97% 0.014 254.604)","100":"oklch(93.2% 0.032 255.585)","200":"oklch(88.2% 0.059 254.128)","300":"oklch(80.9% 0.105 251.813)","400":"oklch(70.7% 0.165 254.624)","500":"oklch(62.3% 0.214 259.815)","600":"oklch(54.6% 0.245 262.881)","700":"oklch(48.8% 0.243 264.376)","800":"oklch(42.4% 0.199 265.638)","900":"oklch(37.9% 0.146 265.522)","950":"oklch(28.2% 0.091 267.935)"},"amber":{"50":"oklch(98.7% 0.022 95.277)","100":"oklch(96.2% 0.059 95.617)","200":"oklch(92.4% 0.12 95.746)","300":"oklch(87.9% 0.169 91.605)","400":"oklch(82.8% 0.189 84.429)","500":"oklch(76.9% 0.188 70.08)","600":"oklch(66.6% 0.179 58.318)","700":"oklch(55.5% 0.163 48.998)","800":"oklch(47.3% 0.137 46.201)","900":"oklch(41.4% 0.112 45.904)","950":"oklch(27.9% 0.077 45.635)"},"rose":{"50":"oklch(96.9% 0.015 12.422)","100":"oklch(94.1% 0.03 12.58)","200":"oklch(89.2% 0.058 10.001)","300":"oklch(81% 0.117 11.638)","400":"oklch(71.2% 0.194 13.428)","500":"oklch(64.5% 0.246 16.439)","600":"oklch(58.6% 0.253 17.585)","700":"oklch(51.4% 0.222 16.935)","800":"oklch(45.5% 0.188 13.697)","900":"oklch(41% 0.159 10.272)","950":"oklch(27.1% 0.105 12.094)"},"emerald":{"50":"oklch(97.9% 0.021 166.113)","100":"oklch(95% 0.052 163.051)","200":"oklch(90.5% 0.093 164.15)","300":"oklch(84.5% 0.143 164.978)","400":"oklch(76.5% 0.177 163.223)","500":"oklch(69.6% 0.17 162.48)","600":"oklch(59.6% 0.145 163.225)","700":"oklch(50.8% 0.118 165.612)","800":"oklch(43.2% 0.095 166.913)","900":"oklch(37.8% 0.077 168.94)","950":"oklch(26.2% 0.051 172.552)"},"indigo":{"50":"oklch(96.2% 0.018 272.314)","100":"oklch(93% 0.034 272.788)","200":"oklch(87% 0.065 274.039)","300":"oklch(78.5% 0.115 274.713)","400":"oklch(67.3% 0.182 276.935)","500":"oklch(58.5% 0.233 277.117)","600":"oklch(51.1% 0.262 276.966)","700":"oklch(45.7% 0.24 277.023)","800":"oklch(39.8% 0.195 277.366)","900":"oklch(35.9% 0.144 278.697)","950":"oklch(25.7% 0.09 281.288)"},"orange":{"50":"oklch(98% 0.016 73.684)","100":"oklch(95.4% 0.038 75.164)","200":"oklch(90.1% 0.076 70.697)","300":"oklch(83.7% 0.128 66.29)","400":"oklch(75% 0.183 55.934)","500":"oklch(70.5% 0.213 47.604)","600":"oklch(64.6% 0.222 41.116)","700":"oklch(55.3% 0.195 38.402)","800":"oklch(47% 0.157 37.304)","900":"oklch(40.8% 0.123 38.172)","950":"oklch(26.6% 0.079 36.259)"},"sky":{"50":"oklch(97.7% 0.013 236.62)","100":"oklch(95.1% 0.026 236.824)","200":"oklch(90.1% 0.058 230.902)","300":"oklch(82.8% 0.111 230.318)","400":"oklch(74.6% 0.16 232.661)","500":"oklch(68.5% 0.169 237.323)","600":"oklch(58.8% 0.158 241.966)","700":"oklch(50% 0.134 242.749)","800":"oklch(44.3% 0.11 240.79)","900":"oklch(39.1% 0.09 240.876)","950":"oklch(29.3% 0.066 243.157)"},"slate":{"50":"oklch(98.4% 0.003 247.858)","100":"oklch(96.8% 0.007 247.896)","200":"oklch(92.9% 0.013 255.508)","300":"oklch(86.9% 0.022 252.894)","400":"oklch(70.4% 0.04 256.788)","500":"oklch(55.4% 0.046 257.417)","600":"oklch(44.6% 0.043 257.281)","700":"oklch(37.2% 0.044 257.287)","800":"oklch(27.9% 0.041 260.031)","900":"oklch(20.8% 0.042 265.755)","950":"oklch(12.9% 0.042 264.695)"},"zinc":{"50":"oklch(98.5% 0 none)","100":"oklch(96.7% 0.001 286.375)","200":"oklch(92% 0.004 286.32)","300":"oklch(87.1% 0.006 286.286)","400":"oklch(70.5% 0.015 286.067)","500":"oklch(55.2% 0.016 285.938)","600":"oklch(44.2% 0.017 285.786)","700":"oklch(37% 0.013 285.805)","800":"oklch(27.4% 0.006 286.033)","900":"oklch(21% 0.006 285.885)","950":"oklch(14.1% 0.005 285.823)"},"stone":{"50":"oklch(98.5% 0.001 106.423)","100":"oklch(97% 0.001 106.424)","200":"oklch(92.3% 0.003 48.717)","300":"oklch(86.9% 0.005 56.366)","400":"oklch(70.9% 0.01 56.259)","500":"oklch(55.3% 0.013 58.071)","600":"oklch(44.4% 0.011 73.639)","700":"oklch(37.4% 0.01 67.558)","800":"oklch(26.8% 0.007 34.298)","900":"oklch(21.6% 0.006 56.043)","950":"oklch(14.7% 0.004 49.25)"},"red":{"50":"oklch(97.1% 0.013 17.38)","100":"oklch(93.6% 0.032 17.717)","200":"oklch(88.5% 0.062 18.334)","300":"oklch(80.8% 0.114 19.571)","400":"oklch(70.4% 0.191 22.216)","500":"oklch(63.7% 0.237 25.331)","600":"oklch(57.7% 0.245 27.325)","700":"oklch(50.5% 0.213 27.518)","800":"oklch(44.4% 0.177 26.899)","900":"oklch(39.6% 0.141 25.723)","950":"oklch(25.8% 0.092 26.042)"}};
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
export const ACCENTS = [
  ["teal", "Teal"], ["violet", "Violet"], ["blue", "Blue"], ["indigo", "Indigo"], ["emerald", "Green"], ["amber", "Amber"], ["orange", "Orange"], ["rose", "Rose"],
];
export const BACKGROUNDS = [
  ["slate", "Midnight"], ["black", "Black (OLED)"], ["zinc", "Graphite"], ["stone", "Warm"], ["light", "Light"],
];
export function loadTheme() { const t = read(THEME_KEY, {}); return { accent: t.accent || "teal", bg: t.bg || "slate" }; }
export function saveTheme(t) { write(THEME_KEY, { accent: t.accent || "teal", bg: t.bg || "slate" }); }

/**
 * The CSS variables for a theme, as { "--color-teal-300": "oklch(…)", … }.
 * The app is written with teal as its accent and slate as its surfaces, so a theme
 * points those names at other colours. Light mode flips every scale (50 ↔ 950), so
 * "slate-950 background, slate-100 text" becomes a light page with dark text, and
 * "teal-300 text" becomes a deep accent that reads on white.
 */
export function themeVars(theme) {
  const t = theme || {};
  const accent = PALETTES[t.accent] ? t.accent : "teal";
  const bg = t.bg || "slate";
  const vars = {};
  const light = bg === "light";
  const flip = (i) => (light ? SHADES.length - 1 - i : i);
  const setScale = (name, from) => SHADES.forEach((s, i) => { vars[`--color-${name}-${s}`] = PALETTES[from][SHADES[flip(i)]]; });
  if (accent !== "teal" || light) setScale("teal", accent);
  const surface = bg === "zinc" || bg === "stone" ? bg : "slate";
  if (surface !== "slate" || light) setScale("slate", surface);
  if (bg === "black") {
    vars["--color-slate-950"] = "#000000";
    vars["--color-slate-900"] = "oklch(17% 0.01 265)";
    vars["--color-slate-800"] = "oklch(23% 0.015 265)";
  }
  if (light) {
    for (const fam of ["amber", "rose", "emerald", "sky", "violet", "red"]) setScale(fam, fam);
    vars["--color-white"] = PALETTES.slate["950"];
    vars["--color-black"] = "#ffffff";
    vars["--att-bg"] = "#f8fafc";
  }
  return vars;
}
const APPLIED = new Set();
/** Put a theme on the page (and the Android status bar colour via <meta name=theme-color>). */
export function applyTheme(theme, doc) {
  const d = doc || (typeof document !== "undefined" ? document : null);
  if (!d) return {};
  const root = d.documentElement, vars = themeVars(theme);
  for (const k of APPLIED) if (!(k in vars)) root.style.removeProperty(k);
  APPLIED.clear();
  for (const [k, v] of Object.entries(vars)) { root.style.setProperty(k, v); APPLIED.add(k); }
  const light = (theme || {}).bg === "light";
  root.classList.toggle("att-light", light);
  root.style.colorScheme = light ? "light" : "dark";
  try {
    const bgc = light ? "#f8fafc" : (theme || {}).bg === "black" ? "#000000" : getComputedStyle(root).getPropertyValue("--color-slate-950") || "#020618";
    let m = d.querySelector('meta[name="theme-color"]');
    if (!m) { m = d.createElement("meta"); m.name = "theme-color"; d.head.appendChild(m); }
    m.content = bgc.trim();
  } catch (e) {}
  return vars;
}
