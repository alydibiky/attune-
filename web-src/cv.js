/* ---- v6.10: the CV / Resume page — one set of content, two looks, English or Arabic ---------------------------------------
   Pure logic (no screen, no model): the data model, the HTML of the page (an ATS-safe single column, or a modern
   two-column with a sidebar), a Word version for ATS tools, plain text, and a checker that finds gaps and weak lines
   by code. The phone's own model only helps with WORDING (cv-ai.js); it never decides dates, numbers or names.
   Tests: tests/unit/v615cv.test.mjs.                                                                                   */

export const THEMES = {
  teal: { name: "Teal", accent: "#0f766e", soft: "#e6f4f2", side: "#0f766e", sideText: "#ffffff" },
  navy: { name: "Navy", accent: "#1e3a8a", soft: "#e8edf8", side: "#1e3a8a", sideText: "#ffffff" },
  charcoal: { name: "Charcoal", accent: "#334155", soft: "#eef0f3", side: "#334155", sideText: "#ffffff" },
  burgundy: { name: "Burgundy", accent: "#9f1239", soft: "#fbe9ee", side: "#9f1239", sideText: "#ffffff" },
  green: { name: "Green", accent: "#166534", soft: "#e8f3ec", side: "#166534", sideText: "#ffffff" },
  amber: { name: "Amber", accent: "#b45309", soft: "#fdf1e3", side: "#92400e", sideText: "#ffffff" },
};
export const FONTS = {
  sans: { name: "Sans", stack: `"Segoe UI","Noto Sans","Noto Naskh Arabic",Roboto,Arial,sans-serif` },
  serif: { name: "Serif", stack: `Georgia,"Times New Roman","Noto Naskh Arabic",serif` },
  naskh: { name: "Naskh (Arabic)", stack: `"Noto Naskh Arabic","Amiri","Traditional Arabic","Segoe UI",serif` },
};
export const PAGES = { A4: { w: 210, h: 297 }, Letter: { w: 215.9, h: 279.4 } };
export const SECTION_TYPES = {
  summary: { en: "Professional summary", ar: "نبذة مهنية" },
  experience: { en: "Experience", ar: "الخبرات العملية" },
  education: { en: "Education", ar: "التعليم" },
  skills: { en: "Skills", ar: "المهارات" },
  languages: { en: "Languages", ar: "اللغات" },
  certs: { en: "Certificates", ar: "الشهادات والدورات" },
  projects: { en: "Projects", ar: "المشاريع" },
  custom: { en: "Other", ar: "أخرى" },
};
/** Which sections sit in the sidebar of the modern layout (the rest are the main column). */
const SIDE = new Set(["skills", "languages", "certs"]);

let seq = 0;
const id = (p = "c") => p + Date.now().toString(36) + (seq++).toString(36);

export function newCV(lang = "en", name = "") {
  const ar = lang === "ar";
  const sec = (type, items) => ({ id: id("s"), type, title: SECTION_TYPES[type][ar ? "ar" : "en"], visible: true, items });
  return {
    id: id("cv"), name: name || (ar ? "سيرتي الذاتية" : "My CV"), lang, page: "A4", layout: "ats", theme: "teal", font: ar ? "naskh" : "sans", fontSize: 10.5,
    spacing: "normal", margin: 14, fit: 1, photo: "", showPhoto: false, updated: Date.now(),
    basics: { name: "", title: "", email: "", phone: "", city: "", links: [] },
    sections: [sec("summary", [{ text: "" }]), sec("experience", []), sec("education", []), sec("skills", [{ name: "", items: [] }]), sec("languages", []), sec("certs", [])],
  };
}
export const newItem = (type) => ({
  experience: { role: "", company: "", location: "", start: "", end: "", current: false, bullets: [""] },
  education: { degree: "", school: "", start: "", end: "", note: "" },
  skills: { name: "", items: [] },
  languages: { name: "", level: "" },
  certs: { name: "", issuer: "", year: "" },
  projects: { name: "", link: "", bullets: [""] },
  summary: { text: "" }, custom: { text: "" },
}[type] || { text: "" });
export function addSection(cv, type) {
  const ar = cv.lang === "ar";
  return { ...cv, sections: [...cv.sections, { id: id("s"), type, title: SECTION_TYPES[type][ar ? "ar" : "en"], visible: true, items: type === "summary" || type === "custom" ? [newItem(type)] : [] }] };
}
export function moveSection(cv, sid, dir) {
  const i = cv.sections.findIndex((s) => s.id === sid), j = i + dir;
  if (i < 0 || j < 0 || j >= cv.sections.length) return cv;
  const a = [...cv.sections]; [a[i], a[j]] = [a[j], a[i]];
  return { ...cv, sections: a };
}
/** A copy for another job: new id and name, same content ("Copy for Orascom"). */
export function copyFor(cv, label) { const c = JSON.parse(JSON.stringify(cv)); c.id = id("cv"); c.name = label ? `${cv.name} — ${label}` : cv.name + " (copy)"; c.updated = Date.now(); return c; }

// ---- dates ------------------------------------------------------------------------------------------------------------
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
/** "2021-03" → "Mar 2021" / "مارس 2021"; "2021" → "2021"; anything else as written. */
export function fmtDate(v, lang = "en") {
  const t = String(v || "").trim(); if (!t) return "";
  const m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${(lang === "ar" ? MON_AR : MON_EN)[+m[2] - 1]} ${m[1]}`;
  return t;
}
export function fmtRange(it, lang = "en") {
  const a = fmtDate(it.start, lang), b = it.current ? (lang === "ar" ? "حتى الآن" : "Present") : fmtDate(it.end, lang);
  return a && b ? `${a} – ${b}` : a || b;
}
const monthIndex = (v) => { const m = /^(\d{4})-(\d{1,2})$/.exec(String(v || "")); return m ? +m[1] * 12 + (+m[2] - 1) : /^\d{4}$/.test(String(v || "")) ? +v * 12 : null; };

// ---- the page --------------------------------------------------------------------------------------------------------
const esc = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SP = { compact: 0.78, normal: 1, airy: 1.28 };
const filled = (s) => s.visible !== false && (s.items || []).some((it) => Object.values(it).some((v) => (Array.isArray(v) ? v.some((x) => (typeof x === "string" ? x.trim() : x && (x.name || x.items))) : typeof v === "string" ? v.trim() : false)));
const bullets = (arr) => { const b = (arr || []).map((x) => String(x).trim()).filter(Boolean); return b.length ? `<ul>${b.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; };

function sectionHtml(s, cv, inSide) {
  const L = cv.lang;
  const head = `<h2>${esc(s.title)}</h2>`;
  const list = s.items || [];
  let body = "";
  if (s.type === "summary" || s.type === "custom") body = list.map((it) => (it.text ? `<p>${esc(it.text).replace(/\n/g, "<br>")}</p>` : "")).join("");
  else if (s.type === "experience") body = list.filter((it) => it.role || it.company).map((it) => `<div class="item"><div class="row"><b>${esc(it.role)}</b><span class="when">${esc(fmtRange(it, L))}</span></div><div class="sub">${esc([it.company, it.location].filter(Boolean).join(" · "))}</div>${bullets(it.bullets)}</div>`).join("");
  else if (s.type === "education") body = list.filter((it) => it.degree || it.school).map((it) => `<div class="item"><div class="row"><b>${esc(it.degree)}</b><span class="when">${esc(fmtRange(it, L))}</span></div><div class="sub">${esc(it.school)}</div>${it.note ? `<p>${esc(it.note)}</p>` : ""}</div>`).join("");
  else if (s.type === "skills") body = list.filter((it) => it.name || (it.items || []).length).map((it) => (inSide
    ? `<div class="item">${it.name ? `<b>${esc(it.name)}</b>` : ""}<div class="chips">${(it.items || []).map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>`
    : `<p>${it.name ? `<b>${esc(it.name)}:</b> ` : ""}${esc((it.items || []).join(", "))}</p>`)).join("");
  else if (s.type === "languages") body = list.filter((it) => it.name).map((it) => `<div class="row"><span>${esc(it.name)}</span><span class="when">${esc(it.level)}</span></div>`).join("");
  else if (s.type === "certs") body = list.filter((it) => it.name).map((it) => `<div class="item"><div class="row"><b>${esc(it.name)}</b><span class="when">${esc(it.year)}</span></div>${it.issuer ? `<div class="sub">${esc(it.issuer)}</div>` : ""}</div>`).join("");
  else if (s.type === "projects") body = list.filter((it) => it.name).map((it) => `<div class="item"><div class="row"><b>${esc(it.name)}</b>${it.link ? `<span class="when">${esc(it.link)}</span>` : ""}</div>${bullets(it.bullets)}</div>`).join("");
  return body ? `<section>${head}${body}</section>` : "";
}

/** The whole CV as one HTML page (A4 / Letter), ready to preview or to print to PDF. `scale` shrinks the text to fit pages. */
export function cvHtml(cv, { scale = 1 } = {}) {
  const T = THEMES[cv.theme] || THEMES.teal, F = FONTS[cv.font] || FONTS.sans, P = PAGES[cv.page] || PAGES.A4;
  const rtl = cv.lang === "ar", b = cv.basics || {}, modern = cv.layout === "modern";
  const secs = (cv.sections || []).filter(filled);
  const sp = SP[cv.spacing] || 1, fs = (cv.fontSize || 10.5) * scale, m = cv.margin ?? 14;
  const contact = [b.email, b.phone, b.city, ...(b.links || []).map((l) => l.url || l.label)].filter(Boolean);
  const photo = cv.showPhoto && cv.photo ? `<img class="photo" src="${esc(cv.photo)}" alt="">` : "";
  const css = `
@page{size:${P.w}mm ${P.h}mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:${F.stack};font-size:${fs}pt;line-height:${(1.32 * (0.9 + sp * 0.1)).toFixed(3)};color:#111827;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:${P.w}mm;min-height:${P.h}mm;padding:${m}mm;margin:0 auto;background:#fff}
h1{font-size:${(fs * 2.1).toFixed(1)}pt;margin:0;line-height:1.1;color:${T.accent}}
.title{font-size:${(fs * 1.15).toFixed(1)}pt;color:#374151;margin-top:${(2 * sp).toFixed(1)}px}
.contact{margin-top:${(6 * sp).toFixed(1)}px;color:#374151;font-size:${(fs * 0.95).toFixed(1)}pt}
.contact span+span::before{content:" · ";color:#9ca3af}
section{margin-top:${(13 * sp).toFixed(1)}px}
h2{font-size:${(fs * 1.05).toFixed(1)}pt;text-transform:uppercase;letter-spacing:.06em;color:${T.accent};border-bottom:1.2px solid ${T.accent};padding-bottom:2px;margin:0 0 ${(6 * sp).toFixed(1)}px}
.item{margin-bottom:${(8 * sp).toFixed(1)}px;break-inside:avoid}
.row{display:flex;justify-content:space-between;gap:10px}
.when{color:#4b5563;white-space:nowrap;font-size:${(fs * 0.92).toFixed(1)}pt}
.sub{color:#374151}
p{margin:0 0 ${(4 * sp).toFixed(1)}px}
ul{margin:${(3 * sp).toFixed(1)}px 0 0;padding-${rtl ? "right" : "left"}:${(fs * 1.5).toFixed(1)}pt}
li{margin-bottom:${(2 * sp).toFixed(1)}px}
.photo{width:${(fs * 7).toFixed(0)}pt;height:${(fs * 7).toFixed(0)}pt;object-fit:cover;border-radius:${modern ? "50%" : "6px"}}
${modern ? `
.cols{display:flex;min-height:${P.h - 2 * m}mm;margin:-${m}mm;${rtl ? "flex-direction:row-reverse" : ""}}
.side{width:34%;background:${T.side};color:${T.sideText};padding:${m}mm ${m * 0.7}mm}
.main{flex:1;padding:${m}mm}
.side h1{color:${T.sideText};font-size:${(fs * 1.7).toFixed(1)}pt}
.side .title,.side .contact,.side .sub,.side .when{color:${T.sideText};opacity:.88}
.side h2{color:${T.sideText};border-color:rgba(255,255,255,.55)}
.side .contact span{display:block}.side .contact span+span::before{content:""}
.chips span{display:inline-block;background:rgba(255,255,255,.16);border-radius:10px;padding:1px 8px;margin:0 3px 4px 0;font-size:${(fs * 0.92).toFixed(1)}pt}
.side .row{flex-direction:column;gap:0}` : ""}
`;
  let inner;
  if (modern) {
    const side = secs.filter((s) => SIDE.has(s.type)), main = secs.filter((s) => !SIDE.has(s.type));
    inner = `<div class="cols"><div class="side">${photo ? `<div style="margin-bottom:10px">${photo}</div>` : ""}<h1>${esc(b.name)}</h1>${b.title ? `<div class="title">${esc(b.title)}</div>` : ""}<div class="contact">${contact.map((c) => `<span>${esc(c)}</span>`).join("")}</div>${side.map((s) => sectionHtml(s, cv, true)).join("")}</div><div class="main">${main.map((s) => sectionHtml(s, cv, false)).join("")}</div></div>`;
  } else {
    inner = `<header class="row" style="align-items:center"><div><h1>${esc(b.name)}</h1>${b.title ? `<div class="title">${esc(b.title)}</div>` : ""}<div class="contact">${contact.map((c) => `<span>${esc(c)}</span>`).join("")}</div></div>${photo}</header>${secs.map((s) => sectionHtml(s, cv, false)).join("")}`;
  }
  return `<!doctype html><html lang="${cv.lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(b.name || cv.name)}</title><style>${css}</style></head><body><div class="page">${inner}</div></body></html>`;
}

// ---- plain text and Word (ATS tools read these best) ----------------------------------------------------------------------
export function cvText(cv) {
  const b = cv.basics || {}, L = cv.lang, out = [b.name, b.title, [b.email, b.phone, b.city, ...(b.links || []).map((l) => l.url || l.label)].filter(Boolean).join(" | ")].filter(Boolean);
  for (const s of (cv.sections || []).filter(filled)) {
    out.push("", s.title.toUpperCase());
    for (const it of s.items) {
      if (s.type === "summary" || s.type === "custom") { if (it.text) out.push(it.text); }
      else if (s.type === "experience") { out.push([it.role, [it.company, it.location].filter(Boolean).join(", "), fmtRange(it, L)].filter(Boolean).join(" | ")); (it.bullets || []).filter((x) => String(x).trim()).forEach((x) => out.push("- " + x)); }
      else if (s.type === "education") out.push([it.degree, it.school, fmtRange(it, L)].filter(Boolean).join(" | "), ...(it.note ? [it.note] : []));
      else if (s.type === "skills") out.push((it.name ? it.name + ": " : "") + (it.items || []).join(", "));
      else if (s.type === "languages") out.push([it.name, it.level].filter(Boolean).join(" - "));
      else if (s.type === "certs") out.push([it.name, it.issuer, it.year].filter(Boolean).join(" | "));
      else if (s.type === "projects") { out.push([it.name, it.link].filter(Boolean).join(" | ")); (it.bullets || []).filter((x) => String(x).trim()).forEach((x) => out.push("- " + x)); }
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
/** Blocks for convert.js's Word writer: one column, real headings and bullets, no tables (what ATS parsers like). */
export function cvBlocks(cv) {
  const b = cv.basics || {}, L = cv.lang, rtl = cv.lang === "ar", blocks = [];
  const p = (text, o = {}) => blocks.push({ type: "p", text, size: o.size || cv.fontSize || 10.5, ...(o.b ? { runs: [{ t: text, b: true }] } : {}), ...(rtl ? { rtl: true, align: "right" } : {}), before: o.before || 0 });
  if (b.name) blocks.push({ type: "title", text: b.name, ...(rtl ? { rtl: true } : {}) });
  if (b.title) p(b.title, { size: (cv.fontSize || 10.5) + 1.5 });
  const c = [b.email, b.phone, b.city, ...(b.links || []).map((l) => l.url || l.label)].filter(Boolean).join("  |  "); if (c) p(c);
  for (const s of (cv.sections || []).filter(filled)) {
    blocks.push({ type: "h2", text: s.title, ...(rtl ? { rtl: true } : {}) });
    for (const it of s.items) {
      if (s.type === "summary" || s.type === "custom") { if (it.text) p(it.text); }
      else if (s.type === "experience") { p([it.role, [it.company, it.location].filter(Boolean).join(", ")].filter(Boolean).join(" — ") + (fmtRange(it, L) ? "   (" + fmtRange(it, L) + ")" : ""), { b: true, before: 4 }); (it.bullets || []).filter((x) => String(x).trim()).forEach((x) => blocks.push({ type: "li", text: x, ...(rtl ? { rtl: true } : {}) })); }
      else if (s.type === "education") p([it.degree, it.school].filter(Boolean).join(" — ") + (fmtRange(it, L) ? "   (" + fmtRange(it, L) + ")" : ""), { before: 3 });
      else if (s.type === "skills") p((it.name ? it.name + ": " : "") + (it.items || []).join(", "));
      else if (s.type === "languages") p([it.name, it.level].filter(Boolean).join(" — "));
      else if (s.type === "certs") p([it.name, it.issuer, it.year].filter(Boolean).join(" — "));
      else if (s.type === "projects") { p([it.name, it.link].filter(Boolean).join(" — "), { b: true, before: 3 }); (it.bullets || []).filter((x) => String(x).trim()).forEach((x) => blocks.push({ type: "li", text: x })); }
    }
  }
  return blocks;
}

// ---- the checker: gaps and weak lines, found by code --------------------------------------------------------------------------
const WEAK_START = /^(i|we|my|responsible for|worked on|helped|tried|was)\b/i;
const HAS_NUMBER = /\d/;
/** → [{ level: "warn"|"tip", where, en, ar }] */
export function checkCV(cv) {
  const out = [], b = cv.basics || {}, secs = cv.sections || [];
  const add = (level, where, en, ar) => out.push({ level, where, en, ar });
  if (!b.name) add("warn", "basics", "Add your name", "ضيف اسمك");
  if (!b.email && !b.phone) add("warn", "basics", "Add an email or a phone number so employers can reach you", "ضيف إيميل أو رقم تليفون عشان أصحاب الشغل يوصلولك");
  const get = (t) => secs.filter((s) => s.type === t && s.visible !== false);
  if (!get("summary").some((s) => (s.items[0] || {}).text)) add("tip", "summary", "A 2–3 line summary at the top helps a recruiter decide quickly", "نبذة من ٢–٣ سطور فوق بتساعد المسؤول يقرر بسرعة");
  const exp = get("experience").flatMap((s) => s.items).filter((it) => it.role || it.company);
  if (!exp.length) add("warn", "experience", "No experience yet — add your jobs, or projects if you are starting out", "مفيش خبرات لسه — ضيف شغلك، أو مشاريع لو لسه بتبدأ");
  const spans = [];
  for (const it of exp) {
    const where = (it.role || it.company || "experience");
    const a = monthIndex(it.start), e = it.current ? monthIndex(new Date().toISOString().slice(0, 7)) : monthIndex(it.end);
    if (!it.start) add("tip", where, `“${where}”: add the start date`, `«${where}»: ضيف تاريخ البداية`);
    if (!it.current && !it.end && it.start) add("tip", where, `“${where}”: add the end date, or tick “current”`, `«${where}»: ضيف تاريخ النهاية، أو علّم «حتى الآن»`);
    if (a != null && e != null && e < a) add("warn", where, `“${where}”: the end date is before the start date`, `«${where}»: تاريخ النهاية قبل البداية`);
    if (a != null && e != null && e >= a) spans.push({ a, e, where });
    const bl = (it.bullets || []).map((x) => String(x).trim()).filter(Boolean);
    if (!bl.length) add("tip", where, `“${where}”: add 2–4 bullet points of what you achieved`, `«${where}»: ضيف ٢–٤ نقاط بإنجازاتك`);
    bl.forEach((x, i) => {
      if (WEAK_START.test(x)) add("tip", where, `“${where}”: start bullet ${i + 1} with an action verb (Led, Reduced, Built…), not “${x.split(" ")[0]}”`, `«${where}»: ابدأ النقطة ${i + 1} بفعل إنجاز مش «${x.split(" ")[0]}»`);
      if (x.split(/\s+/).length > 28) add("tip", where, `“${where}”: bullet ${i + 1} is long — keep it under about 25 words`, `«${where}»: النقطة ${i + 1} طويلة — خليها أقل من ٢٥ كلمة تقريبًا`);
    });
    if (bl.length && !bl.some((x) => HAS_NUMBER.test(x))) add("tip", where, `“${where}”: add a number (how many, how much, how fast)`, `«${where}»: ضيف رقم (كام، قد إيه، بسرعة قد إيه)`);
  }
  // gaps between jobs longer than 6 months, and overlaps
  spans.sort((x, y) => x.a - y.a);
  for (let i = 1; i < spans.length; i++) {
    const gap = spans[i].a - spans[i - 1].e;
    if (gap > 6) add("tip", spans[i].where, `A gap of about ${gap} months before “${spans[i].where}” — a short note can explain it`, `فجوة حوالي ${gap} شهر قبل «${spans[i].where}» — ملاحظة قصيرة ممكن توضحها`);
  }
  const edu = get("education").flatMap((s) => s.items).filter((it) => it.degree || it.school);
  if (!edu.length) add("tip", "education", "Add your education or training", "ضيف تعليمك أو تدريبك");
  if (!get("skills").some((s) => s.items.some((it) => (it.items || []).length))) add("tip", "skills", "List 6–10 skills that match the jobs you want", "اكتب ٦–١٠ مهارات مناسبة للشغل اللي عايزه");
  const words = cvText(cv).split(/\s+/).length;
  if (words > 750) add("tip", "length", `About ${words} words: more than two pages. Keep the best 10–15 years.`, `حوالي ${words} كلمة: أكتر من صفحتين. خليك في أحسن ١٠–١٥ سنة.`);
  return out;
}

/** The text scale that makes the CV fit `pages` pages: measured by the caller (content height / page height). */
export function fitScale(contentMm, pageMm, pages) { const avail = pageMm * pages; return contentMm <= avail ? 1 : Math.max(0.72, Math.round((avail / contentMm) * 100) / 100); }

// ---- many CVs on the phone --------------------------------------------------------------------------------------------------------
const KEY = "attune:cv:v1";
export const loadAll = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
export const saveAll = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40))); return true; } catch (e) { return false; } };
