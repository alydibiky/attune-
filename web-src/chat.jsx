// Chat — Attune's home screen.
//
// One conversation, like the big assistant apps, but everything runs on the
// phone. What you type is first read on the phone itself: a period log goes
// to the Cycle calendar, a bank SMS or transfer receipt to Money — no model
// needed. Everything else goes to the model with the whole conversation, and
// the answer streams in formatted (lists, tables, code) with its thinking
// shown when Think is on.
import React, { useState, useEffect, useRef, useMemo } from "react";
import { tr } from "./i18n.js";
import { ActionCard } from "./actions-ui.jsx";
import { looksLikeCalc, calculate } from "./calc.js";
import { RunBlock } from "./code-ui.jsx";
import { mathToText } from "./quality.js";
import { looksLikeMathProblem, looksLikeCodeTask, arithmeticSlips, fixSlips } from "./verify.js";
import { looksLikeReasoning, DATA_EXT } from "./reason.js";
import { looksLikeImageRequest, pictureSubject } from "./studio.js";
import { loadAssistants, loadProjects, spaceBlock, detectArtifact, looksLikeFollowUp } from "./spaces.js";
import { notesMessages, checkNotes, missingMessages, cleanQuery, pagesFor, FINAL_ADD } from "./research.js";
import { EXPERT_RULES } from "./power.js";
import {
  Send, Square, Mic, ImagePlus, Brain, Globe, Copy, RefreshCw, PenLine, Volume2, Share2, Save, Plus, X, Trash2,
  Loader2, Search, ChevronDown, CheckCircle2, Sparkles, Paperclip, ThumbsDown, FileText, Maximize2,
} from "lucide-react";

const KEY = "attune:chats:v1";
const MAX_CHATS = 100;
const NATIVE = (typeof window !== "undefined" && window.AttuneNative) || null;

// ---- storage -------------------------------------------------------------------
export function loadChats() {
  try { const raw = localStorage.getItem(KEY); lastWritten = raw; const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
// v5.13: chats vanished when the phone's page storage was full — photos are
// big, and one failed save used to silently keep nothing. Now a save that
// doesn't fit first shrinks what is expendable (photos in older chats, then
// in all chats, then the oldest chats), so the text of recent chats is always kept.
const noPhotos = (c) => ({ ...c, messages: (c.messages || []).map((m) => (m.image ? { ...m, image: null, hadImage: true } : m)) });
const clean = (c) => ({ ...c, messages: (c.messages || []).map((m) => (m.streaming ? { ...m, streaming: false, phase: "", text: m.text ? m.text + (m.text.endsWith("(stopped)") ? "" : " …(stopped)") : m.text } : m)) });
function saveChats(list) {
  const base = list.slice(0, MAX_CHATS).map(clean);
  const tries = [
    () => base,
    () => base.map((c, i) => (i < 3 ? c : noPhotos(c))),
    () => base.map(noPhotos),
    () => base.slice(0, 40).map(noPhotos),
    () => base.slice(0, 15).map(noPhotos),
  ];
  for (const t of tries) {
    try { const raw = JSON.stringify(t()); localStorage.setItem(KEY, raw); lastWritten = raw; return true; } catch (e) {}
  }
  return false;
}
// What this page last wrote. A save on the way out is skipped if something
// else changed the chats since (a backup restore, another screen) — never
// write an old copy over newer ones.
let lastWritten = null;
function saveIfOurs(list) {
  let cur = null; try { cur = localStorage.getItem(KEY); } catch (e) {}
  if (lastWritten !== null && cur !== lastWritten) return false;
  if (lastWritten === null && cur && cur !== "[]" && !list.length) return false;
  return saveChats(list);
}
/**
 * Which language to answer in — from the message itself, not the chat so far
 * (v5.13: an English question after Arabic turns got an Arabic answer).
 * → the one line added to what the model reads, or "" if unclear / a translation request.
 */
export function langHint(text) {
  const t = String(text || "");
  if (/\b(translate|translation|in arabic|in english|بالعربي|بالانجليزي|بالإنجليزي|ترجم)\b/i.test(t) || /ترجم|بالعربي|بالإنجليزي|بالانجليزي/.test(t)) return "";
  const ar = (t.match(/[\u0600-\u06FF]/g) || []).length, la = (t.match(/[A-Za-z]/g) || []).length;
  if (ar + la < 3) return "";
  if (ar > la) return "\n\n(اكتب الرد بالعربي — بالمصري لو السؤال بالمصري.)";
  if (la > ar * 3) return "\n\n(Write the reply in English.)";
  return "";
}

/** "What is the maximum load at 20 m radius?", "price of X in this list" — a lookup in a table. */
export function looksLikeTableLookup(text) {
  return /\b(radius|boom|load chart|capacity|counterweight|outrigger|table|chart|row|column|price list|timetable|schedule|rated|lift(ing)?|tons?|at \d+(\.\d+)? ?m)\b|نصف القطر|الذراع|جدول|حمولة|قدرة الرفع|الثقل الموازن/i.test(String(text || ""));
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
/** The last few lines of the model's thinking, while it thinks (no inner scroll box to get stuck in). */
function lastLines(t, n) {
  const lines = String(t || "").trim().split("\n").filter((l) => l.trim());
  const tail = lines.slice(-n).join("\n");
  return tail.length > 600 ? "…" + tail.slice(-600) : tail;
}
function titleFrom(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 46) + "…" : t || "New chat";
}

/** Seconds since it appeared — so a long step (loading, a program running) never looks frozen. */
function Elapsed() {
  const [t0] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(h); }, []);
  const s = Math.floor((Date.now() - t0) / 1000);
  return s >= 3 ? <span className="text-[11px] text-slate-500 tabular-nums shrink-0">· {s < 60 ? s + " s" : Math.floor(s / 60) + " min " + (s % 60) + " s"}</span> : null;
}

// ---- Markdown, drawn as real elements (never as HTML strings) -------------------
function inline(text, keyBase) {
  const out = [];
  // _italic_ and __bold__ only as whole words: second_largest_distinct and
  // file_name stay as written.
  const re = /(\*\*[^*\n]+\*\*|(?<![\w\\])__[^_\n]+__(?![\w])|`[^`\n]+`|\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\)|(?<![\w*\\])\*(?![\s*])[^*\n]+(?<!\s)\*(?![\w*])|(?<![\w\\])_(?![\s_])[^_\n]+(?<!\s)_(?![\w]))/g;
  let last = 0, m, k = 0;
  const s = String(text || "");
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const tok = m[0];
    const key = keyBase + "-" + k++;
    if (tok.startsWith("**") || tok.startsWith("__")) out.push(<strong key={key} className="font-semibold text-white">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key} className="px-1 py-0.5 rounded bg-slate-800 text-teal-200 text-[0.9em] font-mono">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const label = tok.slice(1, tok.indexOf("]("));
      out.push(<a key={key} href={m[2]} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-dotted">{tr(label)}</a>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

const LANG_LABEL = { py: "Python", python: "Python", python3: "Python", js: "JavaScript", javascript: "JavaScript", html: "HTML", htm: "HTML",
  css: "CSS", json: "JSON", sql: "SQL", bash: "Shell", sh: "Shell", kotlin: "Kotlin", java: "Java", ts: "TypeScript", typescript: "TypeScript", xml: "XML", csv: "CSV" };
/** A code box: the language on top, a Copy that says it copied, the code scrolling sideways inside. */
function CodeBox({ lang, text }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    try { if (NATIVE && NATIVE.copy) NATIVE.copy(text); else navigator.clipboard.writeText(text); } catch (e) { try { navigator.clipboard.writeText(text); } catch (x) {} }
    setDone(true); setTimeout(() => setDone(false), 1400);
  };
  const label = LANG_LABEL[String(lang || "").trim().toLowerCase()] || (lang ? String(lang).trim() : tr("Code"));
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden" data-testid="code-box">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800">
        <span className="text-[11px] text-slate-400 font-medium">{label}</span>
        <button onClick={copy} className="text-[11px] px-2 py-0.5 rounded-md text-slate-300 active:bg-slate-800 flex items-center gap-1">
          {done ? <CheckCircle2 size={12} className="text-emerald-300" /> : <Copy size={12} />}{done ? tr("Copied") : tr("Copy")}</button>
      </div>
      <pre className="att-hscroll p-3 text-[13px] leading-relaxed font-mono text-teal-50 overflow-x-auto whitespace-pre m-0" dir="ltr">{text}</pre>
    </div>
  );
}

function MdView({ text, runnable = true }) {
  const blocks = useMemo(() => {
    const lines = mathToText(String(text || "")).replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {                                   // code block
        let lang = l.trim().slice(3).trim();
        const body = [];
        i++;
        // Only a bare ``` closes a block. A "```python" right after the
        // opening line is the model opening it twice: that one is dropped
        // (it used to close the block, leaving an empty box and the code
        // spilling out below as plain text).
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          const f = lines[i].match(/^\s*```\s*([\w+#.-]+)\s*$/);
          if (f && !body.some((x) => x.trim())) { lang = lang || f[1]; body.length = 0; i++; continue; }
          body.push(lines[i++]);
        }
        const closed = i < lines.length;
        i++;
        if (!body.some((x) => x.trim()) && !closed) continue;
        out.push({ t: "code", lang, text: body.join("\n"), closed });
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {   // table
        const row = (x) => x.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        const head = row(l);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
        out.push({ t: "table", head, rows });
        continue;
      }
      let m;
      if ((m = l.match(/^\s{0,3}(#{1,4})\s+(.*)$/))) { out.push({ t: "h", level: m[1].length, text: m[2] }); i++; continue; }
      if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(l)) { out.push({ t: "hr" }); i++; continue; }
      if (/^\s*>/.test(l)) {
        const body = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
        out.push({ t: "quote", text: body.join("\n") });
        continue;
      }
      if (/^\s*([-*•+]|\d+[.)])\s+/.test(l)) {                      // list
        const ordered = /^\s*\d+[.)]/.test(l);
        const items = [];
        while (i < lines.length && /^\s*([-*•+]|\d+[.)])\s+/.test(lines[i])) {
          const ind = (lines[i].match(/^\s*/) || [""])[0].length;
          items.push({ ind: ind >= 2 ? 1 : 0, text: lines[i].replace(/^\s*([-*•+]|\d+[.)])\s+/, ""), n: (lines[i].match(/^\s*(\d+)/) || [])[1] });
          i++;
          // a wrapped continuation line belongs to the item above
          while (i < lines.length && lines[i].trim() && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*•+]|\d+[.)])\s+/.test(lines[i])) {
            items[items.length - 1].text += " " + lines[i].trim(); i++;
          }
        }
        out.push({ t: ordered ? "ol" : "ul", items });
        continue;
      }
      if (!l.trim()) { i++; continue; }
      const para = [l];
      i++;
      while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,4}\s|>|([-*•+]|\d+[.)])\s+|\|.*\|\s*$)/.test(lines[i])) para.push(lines[i++]);
      out.push({ t: "p", text: para.join("\n") });
    }
    return out;
  }, [text]);

  return (
    <div className="att-md space-y-2.5 text-[15px] leading-relaxed text-slate-100">
      {blocks.map((b, bi) => {
        const k = "b" + bi;
        if (b.t === "code") return (
          <div key={k}>
            <CodeBox lang={b.lang} text={b.text} />
            {b.closed && runnable && /^(py|python3?|js|javascript|html?)$/i.test(b.lang.trim()) && b.text.trim() ? <RunBlock lang={b.lang.trim()} code={b.text} /> : null}
          </div>
        );
        if (b.t === "table") return (
          <div key={k} className="att-hscroll overflow-x-auto rounded-xl border border-slate-800" data-testid="md-table">
            <table className="min-w-full text-[13px]" dir="auto">
              <thead className="bg-slate-800/70"><tr>{b.head.map((h, i) => <th key={i} className="px-3 py-2 text-start font-semibold text-slate-100 whitespace-nowrap">{inline(h, k + "h" + i)}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, ri) => <tr key={ri} className="border-t border-slate-800">{r.map((c, ci) => <td key={ci} className="px-3 py-2 align-top text-slate-200">{inline(c, k + "c" + ri + ci)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
        if (b.t === "h") return <p key={k} dir="auto" className={`${b.level <= 2 ? "text-base" : "text-[15px]"} font-semibold text-white pt-1`}>{inline(b.text, k)}</p>;
        if (b.t === "hr") return <hr key={k} className="border-slate-800" />;
        if (b.t === "quote") return <blockquote key={k} dir="auto" className="border-s-2 border-teal-700 ps-3 text-slate-300 whitespace-pre-wrap">{inline(b.text, k)}</blockquote>;
        if (b.t === "ul" || b.t === "ol") return (
          <div key={k} dir="auto" className="space-y-1">
            {b.items.map((it, ii) => (
              <div key={ii} className={`flex gap-2 ${it.ind ? "ms-5" : ""}`}>
                <span className="shrink-0 text-teal-400 min-w-[1.1rem]">{b.t === "ol" ? (it.n || ii + 1) + "." : "•"}</span>
                <span className="min-w-0">{inline(it.text, k + "i" + ii)}</span>
              </div>
            ))}
          </div>
        );
        return <p key={k} dir="auto" className="whitespace-pre-wrap">{inline(b.text, k)}</p>;
      })}
    </div>
  );
}
// v5.16: an answer already on screen is not drawn again every time the
// streaming one grows — on a long chat that was most of the work (and heat).
export const Md = React.memo(MdView);

// ---- the system prompt: one, stable, so the phone can reuse it between turns ----
export function systemPrompt(profileText, accuracy) {
  const d = new Date();
  return `You are Attune, a capable personal assistant. You run entirely on the user's own phone: nothing they say leaves it.

How to answer:
- Answer directly. No preamble, no restating the question, no "certainly", no offer to help further at the end.
- Match the user's language and dialect. If they write Egyptian Arabic, answer in natural Egyptian Arabic; if English, English. If they ask for another language, use it.
- Use Markdown when it helps reading on a phone: short paragraphs, bullet or numbered lists for steps and options, a table only when comparing several things on the same points, **bold** for the key figure or conclusion. No headings on short answers.
- Shape of a good answer: the direct answer FIRST, in **bold**, in one line. Then the details that actually help — key facts, numbers, differences, what to do next — as a few bullets. Comparing two or more things ("is X the same as Y", "X vs Y", "which is better") → one line verdict, then a table of the key differences. A greeting or a yes/no fact stays one or two lines; don't pad.
- Calculations: write the short working FIRST, one step per line, then the total in bold on the last line. Never state a total before you have worked it out.
- Write the answer once. Never repeat it, and never add a "correction" of your own answer — check each step before writing it.
- Write maths as plain text a phone can show: 1/x = 1/30, x², 3 × 4, √2. Never LaTeX, never $ signs around formulas.
- If the question is a trick, or impossible as stated, say so plainly in the first line and explain why.
- If the user says you were wrong, check their point on its merits: agree and fix it if they are right, explain briefly if they are not. Keep the whole conversation in mind.
- If a photo is attached, read it carefully and base the answer on what is actually visible. "What is this?" about a machine, vehicle or product: name the type, then the most likely brand and model from visible clues (colour scheme, logos, badges, cab shape, number of axles, boom type, text), how sure you are, and 3–5 useful facts about it (e.g. for a crane: capacity class, boom type, typical use). Never stop at a generic label like "a mobile crane".
- If something is ambiguous, make the most reasonable assumption and state it in one short line.
- Today is ${d.toDateString()}.

${accuracy || ""}
${profileText ? "\n" + profileText : ""}`;
}

// What to offer after an answer, so the next step is one tap.
function followUps(msg, prevUser) {
  // v5.16: suggestions that fit the answer just given (a comparison, steps, an
  // email, a photo …) instead of the same three every time.
  const t = String(msg.text || "");
  const ar = /[؀-ۿ]/.test(t.slice(0, 400));
  const P = (en, arT, pEn, pAr) => [en, ar ? pAr : pEn];     // label: app language (tr); question: the answer's language
  const out = [];
  const photo = prevUser && prevUser.image;
  if (photo) {
    out.push(P("Exact model?", "الموديل بالظبط؟", "Which exact model and year is it most likely? Say which clues you used and how sure you are.", "إيه الموديل والسنة الأقرب بالظبط؟ قولّي استنتجت ده من إيه وقد إيه متأكد."));
    out.push(P("Specifications", "المواصفات", "Give its main specifications in a table.", "اديني أهم مواصفاته في جدول."));
  }
  switch (msg.skill) {
    case "compare": out.push(P("Which should I choose?", "أختار أنهي؟", "For my use, which one should I choose and why?", "لاستخدامي، أختار أنهي وليه؟"), P("Price difference", "فرق السعر", "What is the typical price difference between them?", "إيه فرق السعر التقريبي بينهم؟")); break;
    case "steps": out.push(P("What can go wrong?", "إيه اللي ممكن يغلط؟", "What are the common mistakes and risks in these steps?", "إيه الأخطاء والمخاطر الشائعة في الخطوات دي؟"), P("Checklist", "قائمة مراجعة", "Turn these steps into a short checklist I can tick.", "حوّل الخطوات دي لقائمة مراجعة قصيرة.")); break;
    case "explain": out.push(P("Real example", "مثال حقيقي", "Give me a real-world example with numbers.", "اديني مثال حقيقي بالأرقام."), P("Explain simply", "ببساطة", "Explain that simply, as if I have no background.", "اشرحها ببساطة كأني مش متخصص.")); break;
    case "email": out.push(P("More formal", "رسمي أكتر", "Make it more formal.", "خليها رسمية أكتر."), P("Shorter", "أقصر", "Make it shorter.", "اختصرها.")); break;
    case "list": out.push(P("More on #1", "تفاصيل الأول", "Tell me more about the first option.", "قولّي تفاصيل أكتر عن أول اختيار.")); break;
    case "plan": out.push(P("As a checklist", "قائمة مراجعة", "Turn the plan into a checklist.", "حوّل الخطة لقائمة مراجعة.")); break;
    case "translate": out.push(P("Translate back", "ترجم تاني للتأكد", "Translate it back so I can check the meaning.", "ترجمها تاني للغة الأصلية عشان أتأكد من المعنى.")); break;
    default: break;
  }
  if (t.length > 700) out.push(P("Shorter", "أقصر", "Make that shorter — just the key points.", "اختصرها في نقاط قليلة."));
  else if (!msg.skill || msg.skill !== "explain") out.push(P("More detail", "تفاصيل أكتر", "Go into more detail.", "اشرح بتفصيل أكتر."));
  if (/\d/.test(t) && /(total|price|cost|egp|usd|جنيه|سعر|اجمالي|إجمالي)/i.test(t)) out.push(P("Check the maths", "راجع الحساب", "Double-check the calculations step by step.", "راجع الحسابات خطوة بخطوة."));
  out.push([ar ? "Translate to English" : "Translate to Arabic", ar ? "Translate your last answer into English." : "ترجم ردك الأخير للعربي (مصري)."]);
  const seen = new Set();
  return out.filter(([l]) => !seen.has(l) && seen.add(l)).slice(0, 4);
}

const STARTERS = [
  ["✉️", "Reply to a message", "Write a polite reply to this message: "],
  ["🌍", "Translate", "Translate into English: "],
  ["📝", "Summarise", "Summarise this in 3 bullets: "],
  ["🏗️", "Crane question", "What should I check on a mobile crane's outriggers before a 40 t lift?"],
  ["🧮", "Work it out", "3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?"],
  ["📚", "Explain simply", "Explain simply how outrigger pads spread a crane's load on soft ground"],
];

// ---- the screen --------------------------------------------------------------------
export function ChatHome({ api, drawerOpen, setDrawerOpen, newChatSignal, composerSeed, clearComposerSeed, spaceSeed, clearSpaceSeed, openChatId, clearOpenChat }) {
  const [chats, setChats] = useState(() => loadChats());
  const [activeId, setActiveId] = useState(() => { const c = loadChats(); return c[0] && (Date.now() - (c[0].updated || 0) < 6 * 3600e3) ? c[0].id : null; });
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [attached, setAttached] = useState(null);     // { name, b64, size, text? } — a spreadsheet or document
  const [teaching, setTeaching] = useState(null);     // { id, corrected, note } — 👎 → the right answer
  // 👎 → a correction is checked before it is learned: people can be wrong too.
  const saveTeach = (m, idx, corrected, note, checked) => {
    const u = messages[idx - 1];
    const ok = api.teach({ input: (u && u.text) || "", was: m.text, corrected, note, checked });
    if (ok) { patchMsg(chat.id, m.id, { taught: true }); api.flash(checked === "right" ? tr("Checked — you're right. Learned for next time")
      : checked === "preference" ? tr("Learned — Chat will answer your way on similar questions") : tr("Learned — Chat will use this on similar questions")); }
    else api.flash(tr("That is the same as the answer — nothing to learn"));
    setTeaching(null);
  };
  const checkTeach = async (m, idx) => {
    const t = teaching; const u = messages[idx - 1];
    const entry = { input: (u && u.text) || "", was: m.text, corrected: t.corrected.trim(), note: t.note.trim() };
    if (!api.checkCorrection) { saveTeach(m, idx, entry.corrected, entry.note, "unchecked"); return; }
    setTeaching({ ...t, checking: true, step: "" });
    let r;
    try { r = await api.checkCorrection(entry, { onStep: (x) => setTeaching((c) => (c && c.id === t.id ? { ...c, step: x } : c)) }); }
    catch (e) { r = { verdict: "unsure", reason: tr("Could not check it: {e}", { e: String((e && e.message) || e) }), save: false }; }
    if (r.save) { saveTeach(m, idx, entry.corrected, entry.note, r.verdict); return; }
    setTeaching((c) => (c && c.id === t.id ? { ...c, checking: false, result: r } : c));
  };
  const [busy, setBusy] = useState(false);
  const [think, setThink] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [q, setQ] = useState("");                       // search in history
  const [renaming, setRenaming] = useState(null);
  const [openThought, setOpenThought] = useState({});
  const runRef = useRef(0);
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const stickRef = useRef(true);
  const [typing, setTyping] = useState(false);
  useEffect(() => () => document.documentElement.classList.remove("att-typing"), []);
  // The space under the last answer follows the composer's REAL height (a
  // photo or file chip makes it taller) so its buttons and follow-up chips
  // are never hidden behind it (v5.14; was a fixed 176 px).
  const composerRef = useRef(null);
  const [padB, setPadB] = useState(200);
  useEffect(() => {
    const el = composerRef.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const h = el.getBoundingClientRect().height; if (h) setPadB(Math.round(h + 58 + 24)); });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  const chat = chats.find((c) => c.id === activeId) || null;
  // The answer finished (or was stopped): read what was typed meanwhile.
  useEffect(() => {
    if (busy || !queued.length) return;
    const q = queued; setQueued([]);
    const t = setTimeout(() => ask(q.map((x) => x.text).join("\n\n"), { queuedDuring: true }), 60);
    return () => clearTimeout(t);
  }, [busy]);
  useEffect(() => { setQueued([]); }, [activeId]);
  const messages = chat ? chat.messages : [];
  // v5.14: the assistant (like a Gem) and/or project this chat belongs to. A
  // new chat started from Assistants/Projects waits in `pending` until its
  // first message creates it.
  const [pending, setPending] = useState(null);
  // v5.16: messages typed WHILE an answer is being written wait here, and are
  // read as soon as it finishes — with that answer in view, so "also add the
  // prices" updates it instead of starting over.
  const [queued, setQueued] = useState([]);
  const spaceIds = chat ? { assistantId: chat.assistantId || null, projectId: chat.projectId || null } : (pending || { assistantId: null, projectId: null });
  const assistant = useMemo(() => (spaceIds.assistantId ? loadAssistants().find((a) => a.id === spaceIds.assistantId) || null : null), [spaceIds.assistantId, spaceSeed]);
  const project = useMemo(() => (spaceIds.projectId ? loadProjects().find((p) => p.id === spaceIds.projectId) || null : null), [spaceIds.projectId, spaceSeed]);
  const spaceRef = useRef({}); spaceRef.current = { assistant, project, ids: spaceIds };
  useEffect(() => {
    if (!spaceSeed) return;
    stop(); setActiveId(null); setImage(null);
    setPending({ assistantId: spaceSeed.assistantId || null, projectId: spaceSeed.projectId || null });
    setText(spaceSeed.starter || "");
    clearSpaceSeed && clearSpaceSeed();
  }, [spaceSeed]);
  useEffect(() => { if (openChatId) { stop(); setActiveId(openChatId); setPending(null); clearOpenChat && clearOpenChat(); } }, [openChatId]);

  // Persist, lightly: not on every streamed word, only when the list settles.
  useEffect(() => { if (!busy) saveIfOurs(chats); }, [chats, busy]);
  // Leaving the app (Home, another app, the screen off) saves everything at
  // once — even mid-answer — so nothing is lost if Android closes the page
  // while it is in the background. Coming back repaints the screen and
  // re-reads the text box (text pasted or dictated while away shows at once).
  const chatsRef = useRef(chats); chatsRef.current = chats;
  useEffect(() => {
    const save = () => saveIfOurs(chatsRef.current);
    const back = () => {
      const el = taRef.current;
      if (el && el.value !== undefined) setText((t) => (el.value !== t ? el.value : t));
      const h = document.documentElement;
      h.classList.add("att-repaint");
      requestAnimationFrame(() => requestAnimationFrame(() => h.classList.remove("att-repaint")));
    };
    const vis = () => { if (document.hidden) save(); else back(); };
    window.addEventListener("attune-pause", save);
    window.addEventListener("pagehide", save);
    window.addEventListener("attune-resume", back);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener("attune-pause", save); window.removeEventListener("pagehide", save);
      window.removeEventListener("attune-resume", back); document.removeEventListener("visibilitychange", vis); };
  }, []);
  // Only a NEW tap on "+" starts a new chat — not the screen opening again with
  // an old signal (that wiped an assistant/project chat just picked; v5.15).
  const seenSignal = useRef(newChatSignal);
  useEffect(() => {
    if (newChatSignal === seenSignal.current) return;
    seenSignal.current = newChatSignal;
    stop(); setActiveId(null); setText(""); setImage(null); setPending(null);
  }, [newChatSignal]);
  useEffect(() => { if (composerSeed) { setText(composerSeed); clearComposerSeed && clearComposerSeed(); setTimeout(() => taRef.current && taRef.current.focus(), 50); } }, [composerSeed]);

  // Follow the answer as it streams — but the moment the reader touches the
  // screen or scrolls up, stop following (v5.10: before, every new word
  // pulled the page back down while you were trying to read). Following
  // starts again only when they are back at the bottom, or tap ↓.
  const [following, setFollowing] = useState(true);
  const touching = useRef(false);
  const lastAuto = useRef(0);
  const gapNow = () => document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
  useEffect(() => {
    const set = (v) => { if (stickRef.current !== v) { stickRef.current = v; setFollowing(v); } };
    const onScroll = () => {
      if (Date.now() - lastAuto.current < 120 && !touching.current) return;   // our own scroll
      set(gapNow() < 48);
    };
    const onDown = () => { touching.current = true; };
    const onUp = () => { touching.current = false; set(gapNow() < 48); };
    const onWheel = (e) => { if (e.deltaY < 0) set(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", onDown, { passive: true });
    window.addEventListener("touchend", onUp, { passive: true });
    window.addEventListener("touchcancel", onUp, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchend", onUp); window.removeEventListener("touchcancel", onUp); window.removeEventListener("wheel", onWheel); };
  }, []);
  const toBottom = () => { lastAuto.current = Date.now(); window.scrollTo(0, document.documentElement.scrollHeight); };
  useEffect(() => { if (stickRef.current && !touching.current) toBottom(); }, [messages]);

  // Grow the text box with what is typed, up to a limit.
  useEffect(() => {
    const t = taRef.current; if (!t) return;
    t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px";
  }, [text]);

  const patchChat = (id, fn) => setChats((list) => list.map((c) => (c.id === id ? fn(c) : c)));
  const patchMsg = (cid, mid, fields) => patchChat(cid, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === mid ? { ...m, ...fields } : m)) }));

  const ensureChat = (firstText) => {
    if (chat) return chat.id;
    const id = newId();
    const sp = spaceRef.current.ids || {};
    setChats((list) => [{ id, title: titleFrom(firstText), created: Date.now(), updated: Date.now(), messages: [], assistantId: sp.assistantId || undefined, projectId: sp.projectId || undefined }, ...list]);
    setActiveId(id);
    return id;
  };

  function stop() {
    runRef.current++;
    api.abort();
    setBusy(false);
  }

  // Build the conversation the model sees: the stable system prompt, the last
  // turns (text only; older photos become "[photo]"), then the new message.
  // Earlier turns as plain user/assistant pairs (for the reasoning route).
  const pairsOf = (history) => buildMessages(history, "x").filter((m) => m.role !== "system").slice(0, -1).slice(-6);
  const buildMessages = (history, userContent, maxHistoryChars) => {
    // Only complete exchanges (a question and its answer) are sent, so the
    // turns always alternate — a stopped answer, a logged period or a
    // payment card never leaves two questions in a row, which chat formats reject.
    const pairs = [];
    for (let i = 0; i + 1 < history.length; i++) {
      const u = history[i], a = history[i + 1];
      if (u.role === "user" && a.role === "assistant" && !a.card && !a.error && a.text) { pairs.push(u, a); i++; }
    }
    // Earlier turns share a fixed budget (about 2,500 tokens on a phone's
    // 8K window), newest first, so a long chat never overflows the model's
    // memory — the oldest turns simply drop out of what it sees.
    const ctx = (api.contextTokens && api.contextTokens()) || 8192;
    const budget = maxHistoryChars == null ? Math.max(1500, Math.min(9000, (ctx - 4300) * 2)) : maxHistoryChars;   // (room left for a full-page answer)
    const kept = [];
    let used = 0;
    for (let i = pairs.length - 2; i >= 0 && kept.length < 20; i -= 2) {
      const u = pairs[i], a = pairs[i + 1];
      const ut = (u.image ? "[photo] " : "") + String(u.text || "").slice(0, 1200);
      const at = String(a.text || "").replace(/ …\(stopped\)$/, "").slice(0, 1800);
      if (used + ut.length + at.length > budget) break;
      used += ut.length + at.length;
      kept.unshift({ role: "user", content: ut }, { role: "assistant", content: at });
    }
    const sp = spaceRef.current;
    const block = sp.assistant || sp.project ? spaceBlock({ assistant: sp.assistant, project: sp.project, question: typeof userContent === "string" ? userContent.slice(0, 600) : "" }) : "";
    // v5.23: strong models (Expert / Master level) work to a professional standard
    const pw = api.power ? api.power() : null;
    return [{ role: "system", content: systemPrompt(api.profileText(), api.accuracy) + (pw && pw.expert ? "\n\n" + EXPERT_RULES : "") + (block ? "\n\n" + block : "") }, ...kept, { role: "user", content: userContent }];
  };

  const ask = async (raw, opts) => {
    const o = opts || {};
    const typed = String(raw != null ? raw : text).trim();
    const fileAtt = o.file !== undefined ? o.file : attached;
    const route = !o.noRoute && !fileAtt;
    const img = o.image !== undefined ? o.image : image;
    if (!typed && !img && !fileAtt) return;
    if (busy && raw == null && !img && !fileAtt && !o.now) {
      setQueued((q) => [...q, { id: newId(), text: typed }]);
      setText("");
      return;
    }
    if (busy) stop();

    // 1. Things the phone files away by itself, instantly, no model.
    if (route && !img && api.isPeriodLog(typed)) {
      const cid = ensureChat(typed);
      const r = api.logPeriod(typed);
      patchChat(cid, (c) => ({ ...c, updated: Date.now(), messages: [...c.messages,
        { id: newId(), role: "user", text: typed },
        { id: newId(), role: "assistant", card: { tone: "rose", title: r.title, detail: r.detail, actions: [["Open the calendar", "cycle"], ["Undo", "undo"]] }, undo: r.undo }] }));
      setText("");
      return;
    }
    const pay = route && !img ? api.parsePayment(typed) : null;
    if (pay && pay.ok && typed.length < 600 && !/[?؟]\s*$/.test(typed)) {
      const cid = ensureChat(typed);
      patchChat(cid, (c) => ({ ...c, updated: Date.now(), messages: [...c.messages,
        { id: newId(), role: "user", text: typed },
        { id: newId(), role: "assistant", card: { tone: "emerald",
          title: "Payment found: " + (pay.direction === "out" ? "−" : "+") + pay.amount + " " + (pay.currency || "") + (pay.party ? " · " + pay.party : ""),
          detail: "Add it to your ledger in Money? You'll pick the account and confirm there.", actions: [["Add to Money", "money"], ["Just answer", "answer"]] },
          payText: typed }] }));
      setText("");
      return;
    }

    // Plain arithmetic: exact and instant, worked out here — no model, no wait.
    if (route && !img && looksLikeCalc(typed)) {
      const c = calculate(typed);
      if (c) {
        const cid = ensureChat(typed);
        patchChat(cid, (ch) => ({ ...ch, updated: Date.now(), messages: [...ch.messages,
          { id: newId(), role: "user", text: typed },
          { id: newId(), role: "assistant", text: c.markdown, calc: true, askText: typed }] }));
        setText("");
        return;
      }
    }

    // "Draw a crane at sunset": pictures are made in Studio, on the phone.
    if (route && !img && looksLikeImageRequest(typed)) {
      const cid = ensureChat(typed);
      const subject = pictureSubject(typed);
      patchChat(cid, (c) => ({ ...c, updated: Date.now(), messages: [...c.messages,
        { id: newId(), role: "user", text: typed },
        { id: newId(), role: "assistant", card: { tone: "violet", title: "A picture — Studio draws it on this phone", detail: subject,
          actions: [["Draw it in Studio", "studio"], ["Just answer", "answer"]] }, studioPrompt: subject }] }));
      setText("");
      return;
    }

    // Something to set on the phone: a reminder, alarm, timer, calendar event,
    // WhatsApp message or call. Read into a card; nothing happens until confirmed.
    if (route && !img && api.looksLikeAction && api.looksLikeAction(typed)) {
      const cid = ensureChat(typed);
      const mid = newId();
      patchChat(cid, (c) => ({ ...c, updated: Date.now(), messages: [...c.messages,
        { id: newId(), role: "user", text: typed },
        { id: mid, role: "assistant", actionCard: true, status: "reading", askText: typed }] }));
      setText("");
      const r = await api.readAction(typed);
      patchMsg(cid, mid, { status: "ready", action: r.action, via: r.via });
      return;
    }

    // 2. The model, with the whole conversation.
    if (!api.canUseAI()) return;
    const cid = ensureChat(typed || "Photo");
    const history = o.history || (chat ? chat.messages : []);
    // A follow-up about a photo sent a moment ago ("what year is it?") gets
    // that photo again — otherwise the model answers without seeing it.
    let carried = null;
    if (!img && typed) {
      const recent = history.slice(-4).filter((m) => m.role === "user");
      const withPic = recent.reverse().find((m) => m.image);
      if (withPic && /^data:/.test(withPic.image)) carried = { url: withPic.image, media: (withPic.image.match(/^data:([^;]+)/) || [])[1] || "image/jpeg", data: withPic.image.split(",")[1] };
    }
    const userMsg = o.reuseUser || { id: newId(), role: "user", text: typed || (fileAtt ? tr("What's in this file? Summarise what matters.") : ""), image: img ? img.url : null, file: fileAtt ? fileAtt.name : null };
    const aiId = newId();
    const run = ++runRef.current;
    const t0 = Date.now();
    // v5.23: a strong model thinks first on hard questions by itself (reasoning, maths, code)
    const pw0 = api.power ? api.power() : null;
    const useThink = think ? "force" : (pw0 && pw0.thinkHard && typed && (looksLikeReasoning(typed) || looksLikeMathProblem(typed)) ? "force" : api.deepThink());
    setChats((list) => {
      const exists = list.some((c) => c.id === cid);
      const sp = spaceRef.current.ids || {};
      const base = exists ? list : [{ id: cid, title: titleFrom(typed || "Photo"), created: Date.now(), updated: Date.now(), messages: [], assistantId: sp.assistantId || undefined, projectId: sp.projectId || undefined }, ...list];
      return base.map((c) => (c.id === cid ? { ...c, updated: Date.now(),
        messages: [...history, userMsg, { id: aiId, role: "assistant", text: "", thinking: "", streaming: true, phase: api.webOn ? "Searching the web…" : "Reading…" }] } : c));
    });
    setText(""); setImage(null); setAttached(null); setBusy(true); stickRef.current = true;

    let raf = 0, pend = null;
    const flush = () => { raf = 0; if (!pend || runRef.current !== run) return; const p = pend; pend = null;
      patchMsg(cid, aiId, { text: p.text, thinking: p.thinking, phase: p.text ? "" : p.thinking ? "Thinking…" : "Reading…" }); };
    // v5.16: the screen is updated about 10× a second while words stream in,
    // not on every frame — the same text on screen, a fraction of the work
    // (a phone that stays cool and a page that doesn't stutter).
    let lastFlush = 0;
    const onToken = (tx, th) => { pend = { text: tx, thinking: th };
      if (!raf) { const wait = Math.max(0, 90 - (Date.now() - lastFlush)); raf = setTimeout(() => { lastFlush = Date.now(); flush(); }, wait); } };
    const onStatus = (s) => { if (runRef.current === run) patchMsg(cid, aiId, { phase: s }); };

    try {
      let content = typed || (fileAtt ? userMsg.text : "What is in this photo? Read it and tell me what matters.");
      let sources = null, via = null, research = null;
      const pic = img || carried;
      if (api.webOn && typed) {
        // With a photo, LOOK first: search for what is in the picture, not
        // for the words "what is this car".
        let query = typed, asked = typed;
        // A short follow-up ("What model", "how much?", "and in 2024?") means
        // nothing on its own — the search engine got the literal words "What
        // model" and returned dictionary pages. It is first rewritten into a
        // full search from the conversation (and the photo it is about). (v5.14)
        const prev = pairsOf(history).slice(-4);
        if (!img && prev.length && looksLikeFollowUp(typed)) {
          onStatus("Understanding the question…");
          try {
            const ctx = prev.map((m) => (m.role === "user" ? "User: " : "Assistant: ") + String(m.content || "").slice(0, 400)).join("\n");
            const rw = await api.run([{ role: "user", content: "Conversation so far:\n" + ctx + "\n\nNew message: " + typed +
              "\n\nRewrite the new message as ONE complete web search query that makes sense on its own: replace \"it/this/that/the model\" with the actual thing being discussed" +
              (carried ? " (look at the photo: name the brand, model and type you can see or recognise)" : "") +
              ". Keep the user's language. Reply with the query only, no quotes." }], carried, { think: false, maxTokens: 50, temperature: 0.1 });
            if (runRef.current !== run) return;
            const q2 = String(rw || "").split("\n")[0].replace(/^["'“]|["'”]$/g, "").replace(/^(query|search)\s*:\s*/i, "").trim().slice(0, 160);
            if (q2 && q2.length > typed.length) { query = q2; asked = q2 + " — (" + typed + ")"; }
          } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
        }
        if (img) {
          onStatus("Looking at the photo…");
          try {
            const seen = await api.run([{ role: "user", content: "Look at the photo. In one short line, name exactly what it shows — for a product give brand and model if you can read or recognise them (badges, logos, text). No other words." }], img, { think: false, maxTokens: 60, temperature: 0.2 });
            if (runRef.current !== run) return;
            const named = String(seen || "").replace(/\s+/g, " ").trim().slice(0, 140);
            if (named) query = named + " " + typed;
          } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
        }
        onStatus("Searching the web…");
        const question = asked + (query !== asked ? " " + query : "");
        const photoNote = img || carried ? "\n\n(A photo is attached: first say what it shows, then use the passages. If the passages don't cover it, answer from the photo and say so.)" : "";
        // v5.20 — DEEP RESEARCH: the pages are read ONE AT A TIME, each into
        // checked notes; what's missing is searched once more; the answer is
        // written from all the notes (research.js).
        const pwR = api.power ? api.power() : { pages: 8, round2: 3 };
        const look = api.webPages ? await api.webPages(query, Math.min(pwR.pages, pagesFor(question))) : await api.webLookup(query, question);
        if (runRef.current !== run) return;
        if (look.hits && look.hits.length && api.webPages) {
          const notesSrc = [], tR = Date.now(); let read = 0;
          const readPages = async (hits, cap) => {
            const list = hits.slice(0, cap);
            for (let i = 0; i < list.length; i++) {
              if (Date.now() - tR > 170000) break;               // never more than ~3 minutes
              const h = list[i];
              onStatus(tr("Reading page {i} of {n} — {t}", { i: i + 1, n: list.length, t: String(h.title || h.url).slice(0, 48) }));
              const pass = api.rankOne(question, h);
              if (!pass || pass.length < 60) continue;
              let notes = "";
              try { notes = await api.run(notesMessages(question, { ...h, text: pass }), null, { think: false, maxTokens: 700, temperature: 0.1, copy: true }); }
              catch (e) { if (String(e && e.message) === "Stopped") throw e; continue; }
              if (runRef.current !== run) return false;
              read++;
              const ck = checkNotes(notes, h.text);
              if (ck.kept) notesSrc.push({ title: h.title, url: h.url, text: ck.text, source: h.source });
            }
            return true;
          };
          if ((await readPages(look.hits, pagesFor(question))) === false) return;
          if (notesSrc.length && Date.now() - tR < 150000) {
            try {
              onStatus(tr("Checking what is still missing…"));
              const q2 = cleanQuery(await api.run(missingMessages(question, notesSrc.map((n) => n.text).join("\n")), null, { think: false, maxTokens: 40, temperature: 0.1 }));
              if (runRef.current !== run) return;
              if (q2) {
                onStatus(tr("Searching again for: {q}", { q: q2 }));
                const more = await api.webPages(q2, Math.max(4, pwR.round2));
                if (runRef.current !== run) return;
                const seen = new Set(look.hits.map((h) => h.url));
                if ((await readPages((more.hits || []).filter((h) => !seen.has(h.url)), pwR.round2 || 3)) === false) return;
              }
            } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
          }
          if (notesSrc.length) {
            sources = notesSrc; via = look.via; research = { pages: read, withFacts: notesSrc.length };
            onStatus(tr("Writing the full answer from {n} pages…", { n: notesSrc.length }));
            content = api.groundedPrompt(asked, notesSrc) + FINAL_ADD + photoNote;
          } else {
            const ranked = api.rankAll(question, look.hits);
            sources = ranked; via = look.via;
            content = api.groundedPrompt(asked, ranked) + photoNote;
          }
        } else if (look.hits && look.hits.length) {
          sources = look.hits; via = look.via;
          onStatus("Reading " + look.hits.length + " sources…");
          content = api.groundedPrompt(asked, look.hits) + photoNote;
        }
      } else if (typed && api.isPersonal(typed)) {
        const found = api.memSearch(typed);
        if (found.length) content = api.withRecords(typed, found);
      }
      let answer, extra = {};
      if (research) extra.research = research;
      const q = typed || userMsg.text;
      // A spreadsheet/CSV: answered by a program the phone runs on the file.
      // A text document: its text goes to the model with the question.
      if (fileAtt && api.analyzeFile && !/\.(txt|md|json)$/i.test(fileAtt.name)) {
        try {
          const r = await api.analyzeFile(q, fileAtt, { onStep: (s) => onStatus(s), onToken: (tx) => onToken(tx, "") });
          if (runRef.current !== run) return;
          if (r && r.ok) { answer = r.text; extra.computed = { code: r.code, output: r.output, file: fileAtt.name }; }
          else if (r && r.why) {
            extra.fileNote = r.why;
            // v5.13: never hand the question to the model without the file —
            // it then said "I do not have access to any records". What the
            // phone could see of the file goes with it instead, clearly marked.
            if (r.profile) content = `The user attached "${fileAtt.name}". Computing on it failed (${r.why}). This is what the file looks like (only the first rows):\n<<<\n${String(r.profile).slice(0, 3500)}\n>>>\nAnswer from this if you can; if the question needs every row (a total, an average), say plainly that the full calculation failed and what the user can try (for example saving the file as .xlsx).\n\n${q}`;
            else answer = tr("I couldn't open {f} on the phone: {why}\n\nTry saving it as .xlsx or .csv and attach it again.", { f: fileAtt.name, why: String(r.why).replace(/^Could not open the file:\s*/, "") });
          }
        } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
      } else if (fileAtt && fileAtt.text != null) {
        content = `The user attached the file "${fileAtt.name}":\n<<<\n${fileAtt.text.slice(0, 14000)}\n>>>\n\n${q}`;
      }
      // Corrections the user taught before, on questions like this one.
      const shots = !fileAtt && api.learnFor ? api.learnFor(q) : null;
      if (shots && shots.n) { content = shots.block + "\n\nREQUEST:\n" + content; extra.learnedUsed = shots.n; }
      // Word problems and coding requests are checked by running code on the
      // phone before the answer is shown (verify.js / code.js). If the check
      // cannot run, the question simply goes to the model as usual below.
      // "and with 5 cranes?" after a sum: worked out WITH the earlier question,
      // not as a question on its own. (v5.16)
      const prevQ = [...history].reverse().find((m) => m.role === "user" && m.text);
      const mathQ = prevQ && /[0-9٠-٩]/.test(typed) && looksLikeFollowUp(typed) && (looksLikeMathProblem(prevQ.text) || looksLikeCalc(prevQ.text))
        ? prevQ.text + "\nFollow-up (answer this, using the question above): " + typed : typed;
      if (route && !img && !sources && api.verifyMath && looksLikeMathProblem(mathQ)) {
        try {
          const r = await api.verifyMath(mathQ + langHint(typed), { onStep: (s) => onStatus(s), onToken: (tx) => onToken(tx, "") });
          if (runRef.current !== run) return;
          if (r && r.ok) { answer = r.text; extra.verified = { code: r.code, output: r.output, answer: r.answer }; }
        } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
      } else if (route && !img && !sources && api.reasonVote && !think && !spaceRef.current.assistant && looksLikeReasoning(typed) && !looksLikeCodeTask(typed)) {
        // Riddles, logic, physical reasoning: several tries, a vote, a strict check.
        try {
          const r = await api.reasonVote(typed + langHint(typed), pairsOf(history), { onStep: (s) => onStatus(s), onToken: (tx) => onToken(tx, "") });
          if (runRef.current !== run) return;
          if (r && r.text) { answer = r.text; extra.reasoned = { votes: r.votes, total: r.total, checked: r.checked }; }
        } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
      } else if (route && !img && !sources && api.codeTask && looksLikeCodeTask(typed)) {
        try {
          // While it writes: the model's own ```python fence (and anything
          // before it) is dropped, so the preview is ONE code box — not an
          // empty box with the code spilling out below it as plain text.
          const livePreview = (tx) => {
            let s = String(tx || "").replace(/\r/g, "");
            const f = s.search(/```[^\n]*\n/);
            if (f >= 0) s = s.slice(s.indexOf("\n", f) + 1);
            s = s.split(/\n\s*```/)[0];
            return "```\n" + s.split("\n").slice(-30).join("\n") + "\n```";
          };
          const r = await api.codeTask(typed, { onStep: (s) => onStatus(s), onToken: (tx) => onToken(livePreview(tx), "") });
          if (runRef.current !== run) return;
          if (r && r.code) {
            answer = (r.ok ? "" : tr("I couldn't make every test pass yet — here is the closest version; tap “Test & fix in Code” to keep going.") + "\n\n") + "```" + r.lang + "\n" + r.code + "\n```";
            extra.codeCheck = { ok: r.ok, tests: r.tests, rounds: r.rounds, lang: r.lang };
          }
        } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
      }
      // A photo of a table (a crane load chart, a price list, a timetable):
      // the model first copies the exact row and column it needs, then
      // answers from what it copied — reading the whole chart "at a glance"
      // is where small models invent numbers (v5.13).
      if (pic && typed && looksLikeTableLookup(typed)) {
        content += "\n\n(How to answer from the photo: 1) Name the table and its units exactly as printed. 2) Find the ROW for the value asked (e.g. radius 20 m) and COPY that whole row, cell by cell, with the column headers above each cell. 3) Answer from the copied row only — say which column (e.g. boom length) gives the maximum. 4) If the digits are too small to read with certainty, say so instead of guessing.)";
        extra.fromPhotoTable = true;
      }
      // v5.15: a recipe for this kind of question (compare → verdict + table,
      // how-to → numbered steps, email → the finished text …). Only for answers
      // the model writes directly — maths, code, web and photo questions have
      // their own checked routes and shapes.
      if (answer == null && typed && !sources && !pic && !fileAtt && api.skillFor) {
        const sk = api.skillFor(typed);
        if (sk) { content += sk.block; extra.skill = sk.id; }
      }
      if (o.queuedDuring) content = "(I sent this while you were still writing your last answer. If it adds to or changes that answer, write the complete UPDATED answer with the change included — don't just acknowledge it. If it is a new question, simply answer it.)\n\n" + content;
      content += langHint(typed);
      if (answer == null) try {
        // Copying from sources, a file or project knowledge: no anti-repeat
        // penalties (they mangled copied numbers). (v5.17)
        const copy = !!sources || !!fileAtt || !!(spaceRef.current.project && (spaceRef.current.project.knowledge || []).length);
        answer = await api.run(buildMessages(history, content), pic, { onToken, onStatus, think: useThink, copy });
      } catch (e) {
        // Still too long for the model's window: answer with no earlier turns
        // rather than fail.
        if (!/longer than this model can read|context/i.test(String(e && e.message))) throw e;
        onStatus("Long chat — answering from this message alone…");
        answer = await api.run(buildMessages([], content, 0), pic, { onToken, onStatus, think: useThink });
      }
      if (runRef.current !== run) return;
      // A web answer with a number no source contains ("June 200005"): asked
      // once more, told exactly which numbers were not in the sources.
      if (sources && api.groundedAudit && answer) {
        const au = api.groundedAudit(answer, sources, typed);
        if (au.fabricated.length) {
          patchMsg(cid, aiId, { phase: tr("Checking the numbers against the sources…") });
          try {
            const fixMsg = content + "\n\nYOUR FIRST ANSWER WAS:\n" + answer + "\n\nThese numbers in it are NOT in the passages: " + au.fabricated.slice(0, 6).join(", ") +
              ". Write the answer again using only numbers, versions and dates exactly as the passages write them.";
            const again = await api.run(buildMessages([], fixMsg, 0), null, { onToken, onStatus, think: false, temperature: 0.2, copy: true });
            if (runRef.current !== run) return;
            const au2 = api.groundedAudit(again, sources, typed);
            if (again && au2.fabricated.length < au.fabricated.length) answer = again;
            if (au2.fabricated.length) extra.unsourced = au2.fabricated.slice(0, 4);
          } catch (e) { if (String(e && e.message) === "Stopped") throw e; extra.unsourced = au.fabricated.slice(0, 4); }
        }
      }
      // A sum in the answer that doesn't add up ("25,000 × 4 = 10,000"): the
      // question is worked out again as a program the phone runs, and that
      // answer replaces the slip. (v5.13)
      let st = api.lastStats();
      // v5.17: checked whenever the ANSWER has sums — "And with 5 cranes" has
      // one digit, so the old "question needs 2 digits" rule let 500,000 +
      // 70,000 = 453,000 through.
      if (!extra.verified && !extra.computed && !extra.codeCheck && !img && !sources && typed && api.verifyMath && /=/.test(answer || "")) {
        const slips = arithmeticSlips(answer);
        if (slips.length) {
          extra.slips = slips;
          if (raf) { clearTimeout(raf); raf = 0; } pend = null;
          patchMsg(cid, aiId, { text: "", thinking: "", phase: tr("Found a slip in the sums — re-checking by running code…") });
          try {
            const r = await api.verifyMath(mathQ + langHint(typed), { onStep: (s) => onStatus(s), onToken: (tx) => onToken(tx, "") });
            if (runRef.current !== run) return;
            if (r && r.ok && r.text) { answer = r.text; extra.verified = { code: r.code, output: r.output, answer: r.answer }; extra.fixedSlip = true; st = api.lastStats(); }
          } catch (e) { if (String(e && e.message) === "Stopped") throw e; }
          // Re-checking could not run (no Python yet, or it failed): the wrong
          // results are corrected in the text itself rather than shown as they are.
          if (!extra.fixedSlip) {
            const f = fixSlips(answer, slips);
            if (f.fixed) { answer = f.text; extra.fixedSlip = true; }
          }
        }
      }
      if (raf) clearTimeout(raf);
      patchMsg(cid, aiId, { text: answer, streaming: false, phase: "", sources, via, secs: Math.round((Date.now() - t0) / 1000), stats: st, ...extra });
      api.spend();
      api.remember({ kind: "chat", title: (typed || "Photo").slice(0, 70), text: typed || "(photo)", output: answer, tags: ["chat"] });
    } catch (e) {
      const msg = String((e && e.message) || e);
      if (runRef.current !== run && msg !== "Stopped") return;
      patchChat(cid, (c) => ({ ...c, messages: c.messages.map((m) => {
        if (m.id !== aiId) return m;
        if (msg === "Stopped") return { ...m, streaming: false, phase: "", text: m.text ? m.text + " …(stopped)" : "", error: m.text ? null : "Stopped." };
        return { ...m, streaming: false, phase: "", error: msg };
      }) }));
    } finally {
      if (runRef.current === run) setBusy(false);
    }
  };

  // An answer cut by the length limit carries on in the SAME bubble.
  const continueAnswer = async (aiIdx) => {
    const m = messages[aiIdx]; if (!m || busy || !api.canUseAI()) return;
    const cid = chat.id, run = ++runRef.current;
    const before = String(m.text || "").replace(/ …\(stopped\)$/, "");
    const hist = messages.slice(0, aiIdx + 1).map((x) => (x.id === m.id ? { ...x, text: before } : x));
    const prompt = /[؀-ۿ]/.test(before.slice(0, 300)) ? "كمّل من المكان اللي وقفت عنده بالظبط. متكررش أي حاجة كتبتها، وابدأ بالكلمة اللي بعدها على طول."
      : "Continue exactly where you stopped. Do not repeat anything you already wrote — start with the very next word.";
    patchMsg(cid, m.id, { streaming: true, phase: "", stats: { ...(m.stats || {}), cut: false } });
    setBusy(true); stickRef.current = true;
    const glue = (a, b) => { const t = String(b || "").replace(/^\s+/, ""); return a + (/\s$/.test(a) || /^[,.;:!?)\]]/.test(t) ? "" : (/\n\s*$/.test(a) ? "" : " ")) + t; };
    try {
      let last = 0;
      const more = await api.run(buildMessages(hist, prompt), null, { onToken: (tx) => { const t = Date.now(); if (runRef.current === run && t - last > 90) { last = t; patchMsg(cid, m.id, { text: glue(before, tx) }); } } });
      if (runRef.current !== run) return;
      const st = api.lastStats();
      patchMsg(cid, m.id, { text: glue(before, more), streaming: false, phase: "", stats: st });
    } catch (e) {
      if (runRef.current === run) patchMsg(cid, m.id, { streaming: false, phase: "", text: before });
    } finally { if (runRef.current === run) setBusy(false); }
  };

  const regenerate = (aiIdx) => {
    const ms = messages;
    const u = ms[aiIdx - 1];
    if (!u || u.role !== "user") return;
    ask(u.text, { history: ms.slice(0, aiIdx - 1), reuseUser: u, image: null });
  };
  const editFrom = (userIdx) => {
    const u = messages[userIdx];
    stop();
    patchChat(chat.id, (c) => ({ ...c, messages: c.messages.slice(0, userIdx) }));
    setText(u.text || "");
    setTimeout(() => taRef.current && taRef.current.focus(), 50);
  };
  const cardAction = (m, act) => {
    if (act === "cycle") api.openTab("cycle");
    else if (act === "undo") { m.undo && m.undo(); patchMsg(chat.id, m.id, { card: { ...m.card, title: "Removed", detail: "", actions: [] } }); }
    else if (act === "money") api.sendToMoney(m.payText);
    else if (act === "studio") window.dispatchEvent(new CustomEvent("attune-studio", { detail: { prompt: m.studioPrompt || "" } }));
    else if (act === "answer") {
      const at = messages.findIndex((x) => x.id === m.id);
      const u = messages[at - 1];
      const hist = messages.slice(0, at - 1);
      patchChat(chat.id, (c) => ({ ...c, messages: hist }));
      setTimeout(() => ask(u.text, { history: hist, noRoute: true }), 0);
    }
  };
  const speak = (m) => {
    if (speakingId === m.id) { try { NATIVE ? NATIVE.stopSpeaking() : window.speechSynthesis.cancel(); } catch (e) {} setSpeakingId(null); return; }
    const plain = String(m.text).replace(/[*_`#>|]/g, "").replace(/\n{2,}/g, "\n");
    const lang = /[؀-ۿ]/.test(plain.slice(0, 300)) ? "ar-EG" : "en-US";
    try {
      if (NATIVE && NATIVE.speak) NATIVE.speak(plain, lang);
      else { const u = new SpeechSynthesisUtterance(plain); u.lang = lang; u.onend = () => setSpeakingId(null); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }
      setSpeakingId(m.id);
    } catch (e) { api.flash(tr("Read-aloud isn't available on this phone")); }
  };
  const share = (m) => {
    try { if (NATIVE && NATIVE.share) NATIVE.share(m.text); else if (navigator.share) navigator.share({ text: m.text }); else { navigator.clipboard.writeText(m.text); api.flash(tr("Copied")); } } catch (e) {}
  };
  const voice = async () => {
    if (listening) { try { NATIVE.stopListening(); } catch (e) {} return; }
    if (!NATIVE || !NATIVE.listen) return api.flash(tr("Voice input works in the Android app"));
    const before = text ? text.replace(/\s+$/, "") + " " : "";
    setListening(true);
    try {
      const r = await api.listen(/[؀-ۿ]/.test(text) || api.prefersArabic() ? "ar-EG" : "", (p) => setText(before + p));
      if (r) setText(before + r);
    } catch (e) { api.flash(String((e && e.message) || e).slice(0, 100)); }
    finally { setListening(false); }
  };
  // A spreadsheet or document: kept as bytes for the Python sandbox (and as
  // text too for a plain document).
  const pickFile = (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) return api.flash(tr("That file is too large (15 MB at most)"));
    const r = new FileReader();
    r.onload = () => {
      const bytes = new Uint8Array(r.result);
      let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const att = { name: file.name, size: file.size, b64: btoa(bin) };
      if (/\.(txt|md|json|csv|tsv)$/i.test(file.name)) { try { att.text = new TextDecoder("utf-8").decode(bytes); } catch (e) {} }
      setAttached(att);
    };
    r.readAsArrayBuffer(file);
  };
  // A photo is shrunk to at most 1280 px before it is used: the model sees
  // the same detail (it reads photos at about this size anyway), it reaches
  // the model faster, and a chat full of photos doesn't fill the phone's storage.
  const pickImage = (file) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return api.flash(tr("That photo is too large"));
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height));
        const c = document.createElement("canvas"); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.88);
        setImage({ data: url.split(",")[1], media: "image/jpeg", url });
      };
      im.onerror = () => setImage({ data: src.split(",")[1], media: file.type || "image/jpeg", url: src });
      im.src = src;
    };
    r.readAsDataURL(file);
  };

  const shownChats = chats.filter((c) => !q.trim() || (c.title + " " + c.messages.map((m) => m.text).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const lastAi = [...messages].reverse().find((m) => m.role === "assistant" && !m.card && !m.actionCard);

  return (
    <div className="pb-44" style={{ paddingBottom: "calc(" + padB + "px + env(safe-area-inset-bottom))" }}>
      {/* ---- history drawer ---- */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="w-[86%] max-w-sm h-full bg-slate-900 border-e border-slate-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 flex items-center gap-2">
              <button onClick={() => { setActiveId(null); setDrawerOpen(false); }} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-sm font-semibold"><Plus size={16} /> {tr("New chat")}</button>
              <button onClick={() => setDrawerOpen(false)} className="att-icon-btn"><X size={18} /></button>
            </div>
            <div className="px-3 pt-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3">
                <Search size={14} className="text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search chats")} dir="auto"
                  className="flex-1 bg-transparent py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none" />
              </div>
            </div>
            <div className="att-scroll flex-1 overflow-y-auto p-2">
              {shownChats.length === 0 ? <p className="text-xs text-slate-500 p-3">{tr("No chats yet.")}</p> : shownChats.map((c) => (
                <div key={c.id} className={`group flex items-center gap-1 rounded-xl ${c.id === activeId ? "bg-slate-800" : ""}`}>
                  {renaming === c.id ? (
                    <input autoFocus defaultValue={c.title} dir="auto" onBlur={(e) => { const v = e.target.value.trim(); if (v) patchChat(c.id, (x) => ({ ...x, title: v })); setRenaming(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                      className="flex-1 bg-slate-950 border border-teal-700 rounded-lg px-2 py-2 text-sm text-slate-100" />
                  ) : (
                    <button onClick={() => { setActiveId(c.id); setDrawerOpen(false); }} className="flex-1 min-w-0 text-start px-3 py-2.5">
                      <span dir="auto" className="block text-sm text-slate-200 truncate">{c.projectId || c.assistantId ? <span className="me-1" data-testid="chat-space-mark">{c.projectId ? "📁" : "✨"}</span> : null}{tr(c.title)}</span>
                      <span className="block text-[10px] text-slate-500">{new Date(c.updated).toLocaleDateString([], { day: "numeric", month: "short" })} · {c.messages.length} messages</span>
                    </button>
                  )}
                  <button onClick={() => setRenaming(c.id)} className="p-2 text-slate-500" title={tr("Rename")}><PenLine size={14} /></button>
                  <button onClick={() => { setChats((l) => l.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null); }} className="p-2 text-slate-500" title={tr("Delete")}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 p-3 border-t border-slate-800">{tr("Chats are saved on this phone only.")}</p>
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
      ) : null}

      {/* ---- empty state ---- */}
      {messages.length === 0 && (assistant || project) ? (
        <div className="pt-6 text-center" data-testid="space-empty">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-800 text-3xl mb-3">{(assistant || project).emoji}</div>
          <p className="text-lg text-white font-semibold" dir="auto">{tr((assistant || project).name)}</p>
          {assistant && project ? <p className="text-[12px] text-slate-400 mt-0.5">{tr("in")} {project.emoji} {project.name}</p> : null}
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed" dir="auto">
            {assistant ? tr(assistant.desc || "") : tr("Chats in this project share its instructions and {n} files.", { n: (project.knowledge || []).length })}</p>
          {(assistant && assistant.starters && assistant.starters.length) ? (
            <div className="grid gap-2 mt-5 text-start">
              {assistant.starters.map((st) => (
                <button key={st} onClick={() => { setText(tr(st)); setTimeout(() => taRef.current && taRef.current.focus(), 30); }}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 active:border-teal-600" dir="auto">{tr(st)}</button>
              ))}
            </div>
          ) : null}
          <button onClick={() => { setPending(null); setText(""); }} className="mt-4 text-[12px] text-slate-500 underline underline-offset-2">{tr("Leave — normal chat")}</button>
        </div>
      ) : messages.length === 0 ? (
        <div className="pt-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-800 text-teal-300 mb-3"><Sparkles size={22} /></div>
          <p className="text-lg text-white font-semibold">{tr("What can I help with?")}</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">{tr("Type, speak or add a photo. Runs on your phone — works with no signal.")}</p>
          <div className="grid grid-cols-2 gap-2 mt-5 text-start">
            {STARTERS.map(([ic, label, seed]) => (
              <button key={label} onClick={() => { setText(tr(seed)); setTimeout(() => taRef.current && taRef.current.focus(), 30); }}
                className="rounded-xl border border-slate-800 bg-slate-900 p-3 active:border-teal-600">
                <span className="text-lg">{tr(ic)}</span>
                <span className="block text-sm text-slate-200 mt-1">{tr(label)}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- the conversation ---- */}
      {messages.length && (assistant || project) ? (
        <div className="flex justify-center pt-1" data-testid="space-chip">
          <span className="text-[11px] px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-slate-300" dir="auto">
            {assistant ? assistant.emoji + " " + tr(assistant.name) : ""}{assistant && project ? " · " : ""}{project ? project.emoji + " " + project.name : ""}</span>
        </div>
      ) : null}
      <div className="space-y-4 pt-2">
        {messages.map((m, idx) => m.role === "user" ? (
          <div key={m.id} className="att-msg flex flex-col items-end">
            {m.image ? <img src={m.image} alt="" className="max-w-[70%] max-h-56 rounded-2xl mb-1.5 border border-slate-800 object-cover" /> : null}
            {!m.image && m.hadImage ? <span className="mb-1.5 text-[11px] text-slate-500 px-2 py-1 rounded-lg border border-slate-800">🖼 {tr("photo (removed to save space)")}</span> : null}
            {m.file ? <span className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[12px] text-slate-200"><FileText size={13} className="text-teal-300" />{m.file}</span> : null}
            {m.text ? <div dir="auto" className="max-w-[85%] bg-teal-600/25 border border-teal-800/60 text-slate-100 rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[15px] whitespace-pre-wrap leading-relaxed">{m.text}</div> : null}
            {!busy ? <button onClick={() => editFrom(idx)} className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 px-1"><PenLine size={11} /> {tr("Edit")}</button> : null}
          </div>
        ) : m.actionCard ? (
          <ActionCard key={m.id + ":" + (m.status || "")} msg={m}
            onDo={async (a) => {
              const res = await api.doAction(a);
              if (res.ok) patchMsg(chat.id, m.id, { status: "done", action: a, doneText: res.text });
              else api.flash(res.error || tr("Could not do that"));
            }}
            onCancel={() => patchMsg(chat.id, m.id, { status: "cancelled" })}
            onAnswer={() => {
              const at = messages.findIndex((x) => x.id === m.id);
              const hist = messages.slice(0, Math.max(0, at - 1));
              patchChat(chat.id, (c) => ({ ...c, messages: hist }));
              setTimeout(() => ask(m.askText, { history: hist, noRoute: true }), 0);
            }} />
        ) : m.card ? (
          <div key={m.id} data-testid={"card-" + (m.card.tone || "")} className={`rounded-2xl border p-3.5 ${m.card.tone === "rose" ? "border-rose-800/70 bg-rose-500/5" : m.card.tone === "violet" ? "border-violet-800/70 bg-violet-500/5" : "border-emerald-800/70 bg-emerald-500/5"}`}>
            <p dir="auto" className="text-sm font-medium text-slate-100 flex items-center gap-1.5"><CheckCircle2 size={15} className={m.card.tone === "rose" ? "text-rose-300" : m.card.tone === "violet" ? "text-violet-300" : "text-emerald-300"} /> {tr(m.card.title)}</p>
            {m.card.detail ? <p dir="auto" className="text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{tr(m.card.detail)}</p> : null}
            {(m.card.actions || []).length ? (
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {m.card.actions.map(([label, act], i) => (
                  <button key={act} onClick={() => cardAction(m, act)}
                    className={`text-xs px-3 py-2 rounded-lg ${i === 0 ? "bg-teal-500 text-slate-950 font-medium" : "border border-slate-700 text-slate-300"}`}>{tr(label)}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div key={m.id} className="group att-msg">
            {m.thinking ? (
              <div className="mb-2">
                <button onClick={() => setOpenThought((o) => ({ ...o, [m.id]: !o[m.id] }))} className="flex items-center gap-1.5 text-[12px] text-slate-400">
                  <Brain size={13} className={m.streaming && !m.text ? "text-teal-300 animate-pulse" : ""} />
                  {m.streaming && !m.text ? tr("Thinking…") : "Thought" + (m.secs ? " for " + m.secs + " s" : "")}
                  <ChevronDown size={13} className={openThought[m.id] ? "rotate-180" : ""} />
                </button>
                {(openThought[m.id] || (m.streaming && !m.text)) ? (
                  <p dir="auto" className="mt-1.5 ps-3 border-s-2 border-slate-800 text-[12px] text-slate-500 whitespace-pre-wrap leading-relaxed" data-testid="thinking-text">
                    {openThought[m.id] ? m.thinking : lastLines(m.thinking, 6)}</p>
                ) : null}
              </div>
            ) : null}
            {m.streaming && !m.text && !m.thinking ? (
              <div className="flex items-center gap-2 text-sm text-teal-300/90 py-1" data-testid="phase"><Loader2 size={15} className="animate-spin shrink-0" /> <span className="min-w-0">{m.phase || tr("Reading…")}</span> <Elapsed /></div>
            ) : null}
            {m.text ? <Md text={m.text + (m.streaming ? " ▍" : "")} /> : null}
            {m.calc ? (
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500" data-testid="calc-note">
                <span>⚡ {tr("Worked out on the phone — exact, instant, no model")}</span>
                <button onClick={() => { const at = messages.findIndex((x) => x.id === m.id); const hist = messages.slice(0, Math.max(0, at - 1));
                  patchChat(chat.id, (c) => ({ ...c, messages: hist })); setTimeout(() => ask(m.askText, { history: hist, noRoute: true }), 0); }}
                  className="ms-auto underline underline-offset-2">{tr("Ask the model")}</button>
              </div>
            ) : null}
            {m.verified ? (
              <div className="mt-1.5 text-[11px]" data-testid="verified">
                <button onClick={() => setOpenThought((o) => ({ ...o, ["v" + m.id]: !o["v" + m.id] }))} className="text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={12} />{tr("Checked by running code on this phone")} <ChevronDown size={11} className={openThought["v" + m.id] ? "rotate-180" : ""} /></button>
                {openThought["v" + m.id] ? <Md text={"```python\n" + m.verified.code + "\n```\n\n" + tr("It printed:") + "\n```\n" + String(m.verified.output || "").trim() + "\n```"} /> : null}
              </div>
            ) : null}
            {m.fromPhotoTable && !m.streaming ? <p className="mt-1 text-[11px] text-amber-300/90" data-testid="photo-table-note">⚠ {tr("Numbers read from a photo — check them against the chart before a lift")}</p> : null}
            {m.unsourced ?<p className="mt-1 text-[11px] text-amber-300" data-testid="unsourced">⚠ {tr("Not found in the sources")}: {m.unsourced.join(", ")}</p> : null}
            {m.fixedSlip ? <p className="mt-1 text-[11px] text-sky-300" data-testid="slip-fixed">{tr("The first answer had a wrong sum — re-done by running code")}</p> : null}
            {m.slips && !m.fixedSlip ? <p className="mt-1 text-[11px] text-amber-300" data-testid="slip-note">⚠ {tr("Check this sum")}: {m.slips[0].expr} → {Number(m.slips[0].right.toFixed(4)).toLocaleString("en-US")}</p> : null}
            {m.reasoned ? (
              <p className="mt-1.5 text-[11px] text-emerald-300 flex items-center gap-1" data-testid="reasoned"><CheckCircle2 size={12} />
                {m.reasoned.checked === "corrected" ? tr("Checked — the reviewer fixed a mistake") : m.reasoned.checked === "judged" ? tr("{n} tries disagreed — weighed and checked", { n: m.reasoned.total })
                  : tr("{v} of {n} tries agreed · checked", { v: m.reasoned.votes, n: m.reasoned.total })}</p>
            ) : null}
            {m.computed ? (
              <div className="mt-1.5 text-[11px]" data-testid="computed">
                <button onClick={() => setOpenThought((o) => ({ ...o, ["c" + m.id]: !o["c" + m.id] }))} className="text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={12} />{tr("Computed from {f} on this phone", { f: m.computed.file })} <ChevronDown size={11} className={openThought["c" + m.id] ? "rotate-180" : ""} /></button>
                {openThought["c" + m.id] ? <Md text={"```python\n" + m.computed.code + "\n```\n\n" + tr("It printed:") + "\n```\n" + String(m.computed.output || "").trim() + "\n```"} /> : null}
              </div>
            ) : null}
            {m.fileNote ? <p className="mt-1 text-[11px] text-amber-300">{tr(m.fileNote)}</p> : null}
            {m.learnedUsed ? <p className="mt-1 text-[11px] text-sky-300" data-testid="learned-used">{tr("Used {n} of your corrections", { n: m.learnedUsed })}</p> : null}
            {(() => {
              // v5.14: a web page, program or long document in the answer opens
              // as an artifact — full screen, saved with versions, shared as a file.
              const art = !m.streaming && m.text ? detectArtifact(m.text) : null;
              if (!art) return null;
              const kindLabel = art.kind === "html" ? tr("Web page") : art.kind === "doc" ? tr("Document") : tr("Program");
              return (
                <button data-testid="artifact-card" onClick={() => window.dispatchEvent(new CustomEvent("attune-artifact", { detail: { ...art, chatId: chat && chat.id } }))}
                  className="mt-2 w-full flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3 text-start active:border-teal-600">
                  <span className="w-10 h-10 shrink-0 rounded-lg bg-teal-500/10 border border-teal-800 flex items-center justify-center text-lg">{art.kind === "html" ? "🌐" : art.kind === "doc" ? "📄" : "⌨️"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-slate-100 truncate" dir="auto">{art.title}</span>
                    <span className="block text-[11px] text-slate-500">{kindLabel} · {tr("tap to open full screen")}</span>
                  </span>
                  <Maximize2 size={16} className="text-teal-300 shrink-0" />
                </button>
              );
            })()}
            {m.codeCheck ? (
              <p className={`mt-1.5 text-[11px] flex items-center gap-1 ${m.codeCheck.ok ? "text-emerald-300" : "text-amber-300"}`} data-testid="code-check">
                <CheckCircle2 size={12} />{m.codeCheck.ok ? (m.codeCheck.tests ? tr("Tested on this phone: {n} passed", { n: m.codeCheck.tests }) : tr("Ran on this phone")) : tr("Not passing yet")}
                {m.codeCheck.rounds ? " · " + tr("fixed {n}×", { n: m.codeCheck.rounds }) : ""}</p>
            ) : null}
            {m.error ? <p className="text-sm text-amber-300/90 mt-1">{m.error}</p> : null}
            {teaching && teaching.id === m.id ? (
              <div className="mt-2 rounded-xl border border-sky-900 bg-sky-500/5 p-3" data-testid="teach-form">
                <p className="text-[12px] text-sky-200">{tr("What should it have said? Attune double-checks your correction first, and learns it only if it holds up.")}</p>
                <textarea value={teaching.corrected} onChange={(e) => setTeaching({ ...teaching, corrected: e.target.value })} rows={3} dir="auto" data-testid="teach-right"
                  placeholder={tr("The right answer")} className="w-full mt-2 bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm text-slate-100 placeholder-slate-600" />
                <input value={teaching.note} onChange={(e) => setTeaching({ ...teaching, note: e.target.value })} dir="auto" data-testid="teach-why"
                  placeholder={tr("Why (optional) — e.g. “the marble falls out when the glass is turned over”")} className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[13px] text-slate-100 placeholder-slate-600" />
                {teaching.result ? (() => { const r = teaching.result; const tone = r.verdict === "wrong" ? "amber" : r.verdict === "partly" ? "sky" : "slate";
                  const label = { wrong: "Checked — I don't think the correction is right", partly: "Checked — your correction is partly right", unsure: "Couldn't confirm your correction" }[r.verdict] || "Checked";
                  return (
                  <div className={`mt-2 rounded-lg border p-2.5 text-[13px] ${tone === "amber" ? "border-amber-800 bg-amber-500/10 text-amber-100" : tone === "sky" ? "border-sky-800 bg-sky-500/10 text-sky-100" : "border-slate-700 bg-slate-800/40 text-slate-200"}`} data-testid="teach-verdict">
                    <p className="font-semibold">{tr(label)}{r.how === "computed" ? " · " + tr("computed on this phone") : ""}</p>
                    {r.reason ? <p className="mt-1" dir="auto">{r.reason}</p> : null}
                    {r.answer && r.verdict !== "unsure" ? <p className="mt-1" dir="auto"><span className="text-slate-400">{tr("Checked answer")}: </span><b>{r.answer}</b></p> : null}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.verdict === "partly" && r.answer ? <button data-testid="teach-save-checked" className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold"
                        onClick={() => saveTeach(m, idx, r.answer, r.reason, r.verdict)}>{tr("Learn the checked answer")}</button> : null}
                      <button data-testid="teach-force" className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 text-xs"
                        onClick={() => saveTeach(m, idx, teaching.corrected.trim(), teaching.note.trim(), "kept")}>{tr("I'm sure — learn mine anyway")}</button>
                      <button onClick={() => setTeaching({ ...teaching, result: null })} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs">{tr("Edit my correction")}</button>
                    </div>
                  </div>); })() : (
                <div className="flex gap-2 mt-2 items-center">
                  <button disabled={!teaching.corrected.trim() || teaching.checking} data-testid="teach-save" className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-semibold disabled:opacity-40"
                    onClick={() => checkTeach(m, idx)}>{teaching.checking ? tr("Checking…") : tr("Check & teach")}</button>
                  <button onClick={() => setTeaching(null)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs">{tr("Cancel")}</button>
                  {teaching.checking ? <span className="text-[11px] text-sky-300" data-testid="teach-step">{teaching.step || tr("Double-checking your correction…")}</span> : null}
                </div>)}
              </div>
            ) : null}
            {m.sources && m.sources.length ? (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-slate-500">{tr("Sources")}{m.via ? " · via " + m.via : ""}{m.research ? " · " + tr("read {p} pages one by one, facts from {n}", { p: m.research.pages, n: m.research.withFacts }) : ""}</p>
                {m.sources.map((h, i) => <a key={i} href={h.url} target="_blank" rel="noreferrer" className="block text-[12px] text-teal-300/90 truncate">[{i + 1}] {tr(h.title)}</a>)}
              </div>
            ) : null}
            {!m.streaming && m.text ? (
              <div className="flex items-center gap-0.5 mt-1.5 -ms-2 text-slate-500">
                <button onClick={() => { try { navigator.clipboard.writeText(m.text); } catch (e) {} api.flash(tr("Copied")); }} className="p-2" title={tr("Copy")}><Copy size={15} /></button>
                <button onClick={() => regenerate(idx)} className="p-2" title={tr("Regenerate")} disabled={busy}><RefreshCw size={15} /></button>
                <button onClick={() => speak(m)} className={`p-2 ${speakingId === m.id ? "text-teal-300" : ""}`} title={tr("Read aloud")}><Volume2 size={15} /></button>
                <button onClick={() => share(m)} className="p-2" title={tr("Share")}><Share2 size={15} /></button>
                <button onClick={() => { api.remember({ kind: "note", title: m.text.slice(0, 60), text: m.text, output: "", tags: ["saved"] }); api.flash(tr("Saved to Memory")); }} className="p-2" title={tr("Save to Memory")}><Save size={15} /></button>
                {api.teach ? <button onClick={() => setTeaching(teaching && teaching.id === m.id ? null : { id: m.id, corrected: "", note: "" })} data-testid="teach"
                  className={`p-2 ${m.taught ? "text-sky-300" : ""}`} title={tr("Wrong? Teach the right answer")}><ThumbsDown size={15} /></button> : null}
                {m.stats && m.stats.tps && !(m.stats.tokens && m.stats.tokens < 16) ? <span className="text-[10px] text-slate-600 ms-1">{m.stats.tps} {tr("tokens/s")}</span> : null}
                {m.stats && m.stats.cut ? <span className="text-[10px] text-amber-300/90 ms-1" data-testid="cut-note">{tr("long answer — tap Continue")}</span> : null}
                {m.stats && m.stats.looped ?<span className="text-[10px] text-amber-400/80 ms-1" data-testid="loop-note">{tr("stopped a repeat")}</span> : null}
                {m.stats && m.stats.tps != null && m.stats.tps < 3 && !(m.stats.tokens && m.stats.tokens < 40) && !m.image && api.openSpeed ? (
                  <button onClick={api.openSpeed} className="text-[10px] text-amber-300 underline underline-offset-2 ms-1" data-testid="slow-hint">{tr("unusually slow — why?")}</button>) : null}
              </div>
            ) : null}
          </div>
        ))}

        {/* next step, one tap */}
        {queued.length ? (
          <div className="flex flex-col items-end gap-1.5" data-testid="queued">
            {queued.map((q) => (
              <div key={q.id} className="max-w-[85%] flex flex-col items-end">
                <div dir="auto" className="bg-slate-800/70 border border-dashed border-slate-600 text-slate-200 rounded-2xl rounded-ee-md px-3.5 py-2 text-[15px] whitespace-pre-wrap">{q.text}</div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span>{tr("Waiting — read when this answer is done")}</span>
                  <button onClick={() => { const all = queued.map((x) => x.text).join("\n\n"); setQueued([]); ask(all, { queuedDuring: true, now: true }); }} className="text-teal-300" data-testid="queued-now">{tr("Send now")}</button>
                  <button onClick={() => setQueued((l) => l.filter((x) => x.id !== q.id))} className="p-0.5" title={tr("Remove")}><X size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!busy && lastAi && lastAi === messages[messages.length - 1] && lastAi.text && !lastAi.error ? (
          <div className="att-chips flex gap-1.5 overflow-x-auto pb-1">
            {(() => { const u = messages[messages.length - 2]; return u && u.image ? (
              <button onClick={() => api.photoToMoney(u.image)} className="shrink-0 text-xs px-3 py-2 rounded-full border border-emerald-800 text-emerald-200 bg-emerald-500/10">{tr("💳 Add to Money")}</button>
            ) : null; })()}
            {lastAi.stats && lastAi.stats.cut ? (
              <button onClick={() => continueAnswer(messages.length - 1)} data-testid="continue"
                className="shrink-0 text-xs px-3 py-2 rounded-full border border-teal-600 text-teal-200 bg-teal-500/10 font-medium">{tr("Continue ▸")}</button>
            ) : null}
            {followUps(lastAi, messages[messages.length - 2]).map(([label, prompt]) => (
              <button key={label} onClick={() => ask(prompt)} className="shrink-0 text-xs px-3 py-2 rounded-full border border-slate-700 text-slate-300 active:border-teal-600">{tr(label)}</button>
            ))}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* ---- jump to the newest words ---- */}
      {!following && messages.length ? (
        <button onClick={() => { stickRef.current = true; setFollowing(true); lastAuto.current = Date.now() + 600; try { window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }); } catch (e) { toBottom(); } }} data-testid="jump-bottom"
          className="fixed z-40 end-4 w-10 h-10 rounded-full bg-slate-800 border border-slate-600 text-slate-100 shadow-lg flex items-center justify-center"
          style={{ bottom: typing ? "calc(118px + env(safe-area-inset-bottom))" : "calc(" + (padB + 4) + "px + env(safe-area-inset-bottom))" }} title={tr("Newest")}><ChevronDown size={18} /></button>
      ) : null}

      {/* ---- composer, pinned above the bottom bar (or at the very bottom
           while typing — the bottom bar steps aside for the keyboard) ---- */}
      <div ref={composerRef} className={`fixed start-0 end-0 ${typing ? "z-[60]" : "z-40"} px-3 pb-2 pt-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent`} data-testid="composer"
        style={{ bottom: typing ? "env(safe-area-inset-bottom)" : "calc(58px + env(safe-area-inset-bottom))" }}>
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-xl">
          {attached ? (
            <div className="inline-flex items-center gap-1.5 mb-2 ms-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[12px] text-slate-200" data-testid="attached">
              <FileText size={13} className="text-teal-300" /><span className="max-w-[200px] truncate">{attached.name}</span>
              <button onClick={() => setAttached(null)} className="text-slate-400"><X size={12} /></button>
            </div>
          ) : null}
          {image ? (
            <div className="relative inline-block mb-2 ms-1">
              <img src={image.url} alt="" className="h-16 rounded-lg border border-slate-700" />
              <button onClick={() => setImage(null)} className="absolute -top-2 -end-2 bg-slate-800 border border-slate-600 rounded-full p-0.5 text-slate-200"><X size={13} /></button>
            </div>
          ) : null}
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} dir="auto" data-testid="chat-input"
            onInput={(e) => { const v = e.currentTarget.value; if (v !== text) setText(v); }}
            // Pasted text: some Android keyboards paste without a normal input
            // event — read the box again right after, so it shows at once.
            onPaste={() => { setTimeout(() => { const el = taRef.current; if (el) setText(el.value); }, 0); setTimeout(() => { const el = taRef.current; if (el) setText(el.value); }, 120); }}
            onFocus={() => { setTyping(true); document.documentElement.classList.add("att-typing"); setTimeout(() => { try { taRef.current.scrollIntoView({ block: "nearest" }); } catch (e) {} }, 250); }}
            // (after a moment: a tap on Send closes the keyboard first, and the
            // text box must not move away from under the finger before the tap lands)
            onBlur={() => { setTimeout(() => { if (document.activeElement !== taRef.current) { setTyping(false); document.documentElement.classList.remove("att-typing"); } }, 300); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia && window.matchMedia(tr("(pointer: fine)")).matches) { e.preventDefault(); ask(); } }}
            placeholder={listening ? tr("Listening…") : tr("Message Attune")}
            className="att-scroll w-full bg-transparent px-2 py-1.5 text-[16px] leading-relaxed text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-[180px]" />
          <div className="flex items-center gap-1">
            <label className="p-2 rounded-full text-slate-400 active:bg-slate-800" title={tr("Photo")}>
              <ImagePlus size={19} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files && e.target.files[0]); e.target.value = ""; }} />
            </label>
            <label className="p-2 rounded-full text-slate-400 active:bg-slate-800" title={tr("Spreadsheet or document")}>
              <Paperclip size={18} />
              <input type="file" accept=".csv,.tsv,.xlsx,.xlsm,.xls,.json,.txt,.md" className="hidden" data-testid="attach-file" onChange={(e) => { pickFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
            </label>
            <button onClick={() => setThink((v) => !v)} className={`px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1 border ${think ? "border-teal-600 text-teal-300 bg-teal-500/10" : "border-slate-700 text-slate-400"}`} title={tr("Think first")}>
              <Brain size={14} /> {tr("Think")}</button>
            <button onClick={api.toggleWeb} className={`px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1 border ${api.webOn ? "border-teal-600 text-teal-300 bg-teal-500/10" : "border-slate-700 text-slate-400"}`} title={tr("Search the web")}>
              <Globe size={14} /> {tr("Web")}</button>
            <div className="flex-1" />
            {busy && text.trim() ? (
              <button onClick={() => ask()} className="w-10 h-10 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center me-1" title={tr("Send")} data-testid="queue-send"><Send size={17} /></button>
            ) : null}
            {busy ? (
              <button onClick={stop} className="w-10 h-10 rounded-full bg-slate-100 text-slate-950 flex items-center justify-center" title={tr("Stop")}><Square size={15} /></button>
            ) : text.trim() || image ? (
              <button onClick={() => ask()} className="w-10 h-10 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center" title={tr("Send")}><Send size={17} /></button>
            ) : (
              <button onClick={voice} className={`w-10 h-10 rounded-full flex items-center justify-center ${listening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-800 text-slate-200"}`} title={tr("Speak")}><Mic size={18} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
