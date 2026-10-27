/* ---- v6.48 What the Home box does with what was typed (CHAT_RUNS_APP.md S1–S7). route() reads a "/" command or a plain sentence
   (commands.js), and returns ONE outcome for the page to show — it never draws anything itself:
     { type: "doit" }                         → the Home "do it" reader handles it (food, money, a reminder, Metro, a Scout goal…)
     { type: "ask", options: [k1, k2], sig }  → two meanings: show both, he ticks one (then route again with { kind })
     { type: "lines", lines: [{ en, ar, open? }] }   → done; a short note (and where to look)
     { type: "confirm", q: { en, ar }, yes, no }      → one yes/no question first (where things are: "not in the drawer any more?")
     { type: "todos", items }                 → the to-do list, tick to finish
     { type: "map", place, metro? }           → the map card ("Open on the map", the Metro route when it helps)
     { type: "job", spec }                    → a job for the queue (jobs.js): convert, humanize, translate
     { type: "found", items, q }              → what Mind kept that fits
     { type: "need", what: "file" | "text", cmd } → the command needs something first
     { type: "chat", text, web?, to? }        → Chat answers (with web search or a language when asked)
     { type: "open", mode }                   → open that app (v6.50: every app from the box)
     { type: "todoAdd", item } · { type: "whereSave", set } · { type: "travel", code } · { type: "rememberNote", text }
     { type: "rememberFiles", files, label }  → the page saves it in Mind / starts the trip / starts a "remember" job
   The page passes `api` (the apps' own readers and stores), so this file stays testable. Tests: tests/unit/v748cmdrun.test.mjs. */
import * as K from "./commands.js";
import * as W from "./whereis.js";

const L = (en, ar, open) => ({ en, ar, ...(open ? { open } : {}) });
/** The place in "I want to go to Cairo Tower" / «عايز اروح برج القاهرة» / "where is Maadi station?". */
export function placeOf(text) {
  return String(text || "").trim().replace(/[?؟.!]+$/, "")
    .replace(/^(please\s+)?(how (do|can) i (get|go) to|i (want|need) to go to|take me to|directions to|navigate to|show me|where('?s| is| are)|find)\s+/i, "")
    .replace(/\s+on the map$/i, "")
    .replace(/^(انا\s+)?((عايز|عاوز|محتاج)\s+(اروح|أروح)|(ازاي|إزاي)\s+(اروح|أروح|اوصل|أوصل)|وديني|فين مكان|فين|مكان)\s+/, "")
    .replace(/\s+على الخريطه$|\s+على الخريطة$/, "")
    .replace(/^(to|ل|لـ)\s+/i, "").trim();
}
const mindTodos = (records) => (records || []).filter((r) => r && r.meta && r.meta.todo);
/** The open to-dos, oldest first (the list as he wrote it). */
export const openTodos = (records) => mindTodos(records).filter((r) => !r.meta.done).sort((a, b) => a.ts - b.ts);
/** Mind items that fit a "find" (words; the page adds meaning when the model is there). */
export function findIn(records, q, search) {
  const words = K.fold(q).replace(/\b(remind me of|show me|find|bring back|the|my|that|of|photo|picture|video|recording|file)\b/g, " ")
    .replace(/(فكرني|هات|وريني|لاقيلي|بال|ب|الصوره|صوره|الفيديو|فيديو|التسجيل|تسجيل|الملف|ملف|بتاعه|بتاعة|بتاعت)(?=\s|$)/g, " ").split(" ").filter((w) => w.length >= 2);
  const media = /photo|picture|pic|صوره|صورة/i.test(q) ? "photo" : /video|clip|فيديو/i.test(q) ? "video" : /recording|voice|audio|تسجيل|ريكورد|فويس/i.test(q) ? "audio" : null;
  const scored = (search ? search(words.join(" ")) : records || []).map((r) => {
    const hay = K.fold([r.title, r.text, (r.tags || []).join(" "), r.meta && r.meta.label, r.meta && (r.meta.said || (r.meta.cues || []).map((c) => c.text).join(" ")), r.meta && r.meta.seen].filter(Boolean).join(" "));
    const n = words.filter((w) => hay.includes(w)).length;
    const kindOk = !media || r.kind === media || (r.meta && r.meta.media === media);
    return { r, n: n + (kindOk && media ? 0.5 : 0) };
  }).filter((x) => x.n >= 1 && (!media || x.r.kind === media || (x.r.meta && x.r.meta.media === media) || x.n >= 2));
  // a video or recording: the moment the words are said (Ali: "it recalls it" — Mind opens it playing from there)
  const at = (r) => {
    let best = null, n = 0;
    for (const c of (r.meta && r.meta.cues) || []) { const t = K.fold(c.text); const k = words.filter((w) => t.includes(w)).length; if (k > n) { n = k; best = c; } }
    if (!best) return r;
    const s = Math.round(best.start / 1000);
    return { ...r, meta: { ...r.meta, at: best.start, atText: Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"), atSaid: best.text } };
  };
  return scored.sort((a, b) => b.n - a.n || b.r.ts - a.r.ts).slice(0, 6).map((x) => at(x.r));
}

/**
 * route(text, { files, api, prefs, kind }) → outcome (above). `kind` = the option he ticked (skips the guessing).
 * api: { detect(text) → { doActions, goal, metro, automation, watch, mission }, records(), translateTo(text) → default language,
 *        metroAsk(text) }
 */
export function route(text, { files = [], api = {}, prefs = {}, kind = null } = {}) {
  const t = String(text || "").trim();
  const cmd = kind ? null : K.parseCommand(t);
  if (cmd && !cmd.id && api.isSkill && api.isSkill(t)) return { type: "chat", text: t };   // the person's own Skill ("/quote …") → Chat runs it
  if (cmd && !cmd.id) return { type: "lines", lines: [L(`There is no /${cmd.name} — type / to see what Attune can do.`, `مفيش أمر /${cmd.name} — اكتب / وشوف الأوامر.`)] };
  if (cmd) return runKind(cmd.id, cmd.arg, { cmd, files, api, slash: true });
  if (!t && !files.length) return null;
  if (kind) return runKind(kind, t, { files, api });
  const det = (api.detect && api.detect(t)) || {};
  const records = (api.records && api.records()) || [];
  const g = K.guess(t, { ...det, hasFile: files.length > 0, things: W.thingsKnown(records) });
  const d = K.decide(g, prefs, t);
  if (d.ask) return { type: "ask", options: d.ask, sig: d.sig, text: t };
  return runKind(d.kind, t, { files, api });
}

function runKind(kind, text, { cmd = null, files = [], api = {}, slash = false } = {}) {
  const records = (api.records && api.records()) || [];
  const arg = String(text || "").trim();
  switch (kind) {
    case "do": case "metro": case "automation": case "watch": case "mission": case "remind": case "agent":
      return { type: "doit", text: arg };
    case "note": return arg ? { type: "rememberNote", text: arg } : { type: "need", what: "text", cmd: "remember" };
    case "scout":
      return { type: "doit", text: slash ? (/^(find|look|دور|ابحث)/i.test(arg) ? arg : "find me " + arg) : arg, scout: true };
    case "todo": {
      const add = cmd ? cmd.add : "";
      if (add) return { type: "todoAdd", item: add };
      return { type: "todos", items: openTodos(records) };
    }
    case "todoAdd": { const item = K.todoText(arg) || arg; return item ? { type: "todoAdd", item } : { type: "need", what: "text", cmd: "todo" }; }
    case "todoList": return { type: "todos", items: openTodos(records) };
    case "whereSet": {
      const set = W.parseWhereSet(arg);
      if (!set) return { type: "chat", text: arg };
      const plan = W.planSet(records, set);
      if (plan.same) return { type: "lines", lines: [L(`I already have it: ${set.thing} — ${set.place}.`, `عارفة: ${set.thing} — ${set.place}.`, "memory")] };
      if (plan.ask) return { type: "confirm", q: L(`So the ${set.thing} is not ${plan.was} any more?`, `يعني ${set.thing} مبقاش ${plan.was}؟`), set, was: plan.was };
      return { type: "whereSave", set };
    }
    case "whereAsk": {
      const q = W.parseWhereAsk(arg) || { thing: arg.replace(/^(where('?s| is)|فين)\s+/i, "").replace(/[?؟]$/, ""), usual: false };
      const a = W.whereAnswer(records, q);
      return a ? { type: "lines", lines: [{ ...a, open: "memory" }] }
        : { type: "lines", lines: [L(`I don't know where the ${q.thing} is yet. Tell me once — “my ${q.thing} is in the drawer” — and I'll remember.`, `لسه معرفش ${q.thing} فين. قولّي مرة — «${q.thing} في الدرج» — وهفتكر.`)] };
    }
    case "map": {
      const place = placeOf(arg);
      if (!place) return { type: "need", what: "text", cmd: "map" };
      const m = api.metroAsk ? api.metroAsk(arg) : null;
      return { type: "map", place, ...(m ? { metro: m } : {}) };
    }
    case "travel": {
      const code = (cmd && cmd.country) || K.countryIn(arg);
      if (!code) return { type: "need", what: "text", cmd: "travel" };
      return { type: "travel", code };
    }
    case "translate": {
      const to = (cmd && cmd.to) || K.langIn(arg) || (api.translateTo ? api.translateTo(arg) : "en");
      const body = cmd ? cmd.text : K.stripLang(arg.replace(/^\s*(please\s+)?(translate|ترجم(لي)?|ترجمي)\s*(this|it|that|ده|دي|دا)?\s*[:\-]?\s*/i, ""));
      if (files.length) return { type: "job", spec: { kind: "convert", heavy: true, title: `Translate ${files[0].name} → ${K.langName(to)}`, input: { files, format: "translate", to, name: files[0].name } } };
      if (!body) return { type: "need", what: "text", cmd: "translate" };
      return { type: "job", spec: { kind: "translate", heavy: true, title: `${K.langName(to)}: ${body.slice(0, 40)}`, input: { text: body, to } } };
    }
    case "humanize": {
      const body = cmd ? cmd.arg : arg.replace(/^\s*(please\s+)?(humani[sz]e|make (it|this) sound (human|natural|like me))\s*(this|it)?\s*[:\-]?\s*/i, "");
      if (!body || body.length < 12) return { type: "need", what: "text", cmd: "humanize" };
      return { type: "job", spec: { kind: "humanize", heavy: true, title: `Humanize: ${body.slice(0, 40)}`, input: { text: body } } };
    }
    case "convert": {
      if (!files.length) return { type: "need", what: "file", cmd: "convert" };
      const format = (cmd && cmd.format) || K.formatIn(arg) || "pdf";
      return { type: "job", spec: { kind: "convert", heavy: false, title: `${files.length > 1 ? files.length + " files" : files[0].name} → ${format.toUpperCase()}`, input: { files, format, name: files[0].name } } };
    }
    case "subtitles":
      if (!files.length) return { type: "need", what: "file", cmd: "subtitles" };
      return { type: "job", spec: { kind: "subtitles", heavy: true, title: `Subtitles: ${files[0].name}`, input: { files, name: files[0].name, text: arg } } };
    case "remember": {
      const label = arg.replace(/^\s*(remember|keep|save|افتكر|احفظ)\s*(this|it|that|ده|دي|دا)?\s*(as|على انه|علي انه|على انها|انه|إنه|إنها)?\s*[:\-]?\s*/i, "").trim();
      if (files.length) return { type: "rememberFiles", files, label };
      const w = W.parseWhereSet(arg);
      if (w) return runKind("whereSet", arg, { api });
      if (!label) return { type: "need", what: "text", cmd: "remember" };
      return { type: "rememberNote", text: label };
    }
    case "find": {
      const q = cmd ? arg : arg;
      if (!q) return { type: "need", what: "text", cmd: "find" };
      const wq = W.parseWhereAsk(q); if (wq && W.whereNow(records, wq.thing)) return runKind("whereAsk", q, { api });
      return { type: "found", q, items: findIn(records, q, api.search) };
    }
    case "open": {   // v6.50 every app from the box: "/money", "open fit", «افتح الفلوس»
      const a = cmd && cmd.app ? K.apps().find((x) => x.id === cmd.app) : K.appNamed(arg.replace(/^\s*show me\s+(?=(my\s+)?report)/i, "").replace(/^\s*(?:please\s+)?(?:open|go to|show me|take me to|افتح|افتحلي|روح على|وديني على|وريني)\s+/i, "").replace(/[.!]$/, ""));
      return a ? { type: "open", mode: a.id, name: a } : { type: "chat", text: arg };
    }
    case "web": return { type: "chat", text: arg, web: true };
    default: return { type: "chat", text: arg };
  }
}
