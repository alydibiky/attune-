// Chat — Attune's home screen.
//
// One conversation, like the big assistant apps, but everything runs on the
// phone. What you type is first read on the phone itself: a period log goes
// to the Cycle calendar, a bank SMS or transfer receipt to Money — no model
// needed. Everything else goes to the model with the whole conversation, and
// the answer streams in formatted (lists, tables, code) with its thinking
// shown when Think is on.
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send, Square, Mic, ImagePlus, Brain, Globe, Copy, RefreshCw, PenLine, Volume2, Share2, Save, Plus, X, Trash2,
  Loader2, Search, ChevronDown, CheckCircle2, Sparkles,
} from "lucide-react";

const KEY = "attune:chats:v1";
const MAX_CHATS = 100;
const NATIVE = (typeof window !== "undefined" && window.AttuneNative) || null;

// ---- storage -------------------------------------------------------------------
function loadChats() {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
function saveChats(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CHATS))); } catch (e) {
    // Full storage: drop the oldest half and try once more.
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, Math.floor(MAX_CHATS / 2)))); } catch (e2) {}
  }
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function titleFrom(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 46) + "…" : t || "New chat";
}

// ---- Markdown, drawn as real elements (never as HTML strings) -------------------
function inline(text, keyBase) {
  const out = [];
  const re = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\)|\*[^*\n]+\*|_[^_\n]+_)/g;
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
      out.push(<a key={key} href={m[2]} target="_blank" rel="noreferrer" className="text-teal-300 underline decoration-dotted">{label}</a>);
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Md({ text }) {
  const blocks = useMemo(() => {
    const lines = String(text || "").replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {                                   // code block
        const lang = l.trim().slice(3);
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push({ t: "code", lang, text: body.join("\n") });
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
          <div key={k} className="relative">
            <pre className="att-scroll bg-slate-950 border border-slate-800 rounded-xl p-3 text-[13px] font-mono text-teal-50 overflow-x-auto whitespace-pre" dir="ltr">{b.text}</pre>
            <button onClick={() => { try { navigator.clipboard.writeText(b.text); } catch (e) {} }}
              className="absolute top-1.5 right-1.5 text-[10px] px-2 py-1 rounded-md bg-slate-800 text-slate-300">copy</button>
          </div>
        );
        if (b.t === "table") return (
          <div key={k} className="att-scroll overflow-x-auto rounded-xl border border-slate-800">
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

// ---- the system prompt: one, stable, so the phone can reuse it between turns ----
function systemPrompt(profileText, accuracy) {
  const d = new Date();
  return `You are Attune, a capable personal assistant. You run entirely on the user's own phone: nothing they say leaves it.

How to answer:
- Answer directly. No preamble, no restating the question, no "certainly", no offer to help further at the end.
- Match the user's language and dialect. If they write Egyptian Arabic, answer in natural Egyptian Arabic; if English, English. If they ask for another language, use it.
- Use Markdown when it helps reading on a phone: short paragraphs, bullet or numbered lists for steps and options, a table only when comparing several things on the same points, **bold** for the key figure or conclusion. No headings on short answers.
- Be as long as the question needs and no longer. Calculations: result first, then the working.
- If a photo is attached, read it carefully and base the answer on what is actually visible.
- If something is ambiguous, make the most reasonable assumption and state it in one short line.
- Today is ${d.toDateString()}.

${accuracy || ""}
${profileText ? "\n" + profileText : ""}`;
}

// What to offer after an answer, so the next step is one tap.
function followUps(msg) {
  const t = String(msg.text || "");
  const arabic = /[؀-ۿ]/.test(t.slice(0, 400));
  const out = [];
  if (t.length > 500) out.push(["Shorter", arabic ? "اختصرها في نقاط قليلة." : "Make that shorter — just the key points."]);
  else out.push(["More detail", arabic ? "اشرح بتفصيل أكتر." : "Go into more detail."]);
  out.push([arabic ? "Translate to English" : "Translate to Arabic", arabic ? "Translate your last answer into English." : "ترجم ردك الأخير للعربي (مصري)."]);
  out.push(["Explain simply", arabic ? "اشرحها ببساطة كأني مش متخصص." : "Explain that simply, as if I have no background."]);
  if (/\d/.test(t) && /(total|price|cost|egp|usd|جنيه|سعر|اجمالي|إجمالي)/i.test(t)) out.push(["Check the maths", arabic ? "راجع الحسابات خطوة بخطوة." : "Double-check the calculations step by step."]);
  return out.slice(0, 4);
}

const STARTERS = [
  ["✉️", "Reply to a message", "Write a polite reply to this message: "],
  ["🌍", "Translate", "Translate into English: "],
  ["📝", "Summarise", "Summarise this in 3 bullets: "],
  ["🏗️", "Crane question", "What should I check on a mobile crane's outriggers before a 40 t lift?"],
  ["🧮", "Work it out", "3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?"],
  ["🩸", "Log my period", "My period started this morning, medium flow"],
];

// ---- the screen --------------------------------------------------------------------
export function ChatHome({ api, drawerOpen, setDrawerOpen, newChatSignal, composerSeed, clearComposerSeed }) {
  const [chats, setChats] = useState(() => loadChats());
  const [activeId, setActiveId] = useState(() => { const c = loadChats(); return c[0] && (Date.now() - (c[0].updated || 0) < 6 * 3600e3) ? c[0].id : null; });
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
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

  const chat = chats.find((c) => c.id === activeId) || null;
  const messages = chat ? chat.messages : [];

  // Persist, lightly: not on every streamed word, only when the list settles.
  useEffect(() => { if (!busy) saveChats(chats); }, [chats, busy]);
  useEffect(() => { if (newChatSignal) { stop(); setActiveId(null); setText(""); setImage(null); } }, [newChatSignal]);
  useEffect(() => { if (composerSeed) { setText(composerSeed); clearComposerSeed && clearComposerSeed(); setTimeout(() => taRef.current && taRef.current.focus(), 50); } }, [composerSeed]);

  // Follow the answer as it streams, unless the reader scrolled up to read.
  useEffect(() => {
    const onScroll = () => {
      const gap = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      stickRef.current = gap < 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => { if (stickRef.current && bottomRef.current) bottomRef.current.scrollIntoView({ block: "end" }); }, [messages]);

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
    setChats((list) => [{ id, title: titleFrom(firstText), created: Date.now(), updated: Date.now(), messages: [] }, ...list]);
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
    const budget = maxHistoryChars == null ? Math.max(1500, Math.min(9000, (ctx - 3000) * 2)) : maxHistoryChars;
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
    return [{ role: "system", content: systemPrompt(api.profileText(), api.accuracy) }, ...kept, { role: "user", content: userContent }];
  };

  const ask = async (raw, opts) => {
    const o = opts || {};
    const typed = String(raw != null ? raw : text).trim();
    const route = !o.noRoute;
    const img = o.image !== undefined ? o.image : image;
    if (!typed && !img) return;
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

    // 2. The model, with the whole conversation.
    if (!api.canUseAI()) return;
    const cid = ensureChat(typed || "Photo");
    const history = o.history || (chat ? chat.messages : []);
    const userMsg = o.reuseUser || { id: newId(), role: "user", text: typed, image: img ? img.url : null };
    const aiId = newId();
    const run = ++runRef.current;
    const t0 = Date.now();
    const useThink = think ? "force" : api.deepThink();
    setChats((list) => {
      const exists = list.some((c) => c.id === cid);
      const base = exists ? list : [{ id: cid, title: titleFrom(typed || "Photo"), created: Date.now(), updated: Date.now(), messages: [] }, ...list];
      return base.map((c) => (c.id === cid ? { ...c, updated: Date.now(),
        messages: [...history, userMsg, { id: aiId, role: "assistant", text: "", thinking: "", streaming: true, phase: api.webOn ? "Searching the web…" : "Reading…" }] } : c));
    });
    setText(""); setImage(null); setBusy(true); stickRef.current = true;

    let raf = 0, pend = null;
    const flush = () => { raf = 0; if (!pend || runRef.current !== run) return; const p = pend; pend = null;
      patchMsg(cid, aiId, { text: p.text, thinking: p.thinking, phase: p.text ? "" : p.thinking ? "Thinking…" : "Reading…" }); };
    const onToken = (tx, th) => { pend = { text: tx, thinking: th }; if (!raf) raf = requestAnimationFrame(flush); };
    const onStatus = (s) => { if (runRef.current === run) patchMsg(cid, aiId, { phase: s }); };

    try {
      let content = typed || "What is in this photo? Read it and tell me what matters.";
      let sources = null, via = null;
      if (api.webOn && typed) {
        const look = await api.webLookup(typed);
        if (runRef.current !== run) return;
        if (look.hits && look.hits.length) {
          sources = look.hits; via = look.via;
          onStatus("Reading " + look.hits.length + " sources…");
          content = api.groundedPrompt(typed, look.hits);
        }
      } else if (typed && api.isPersonal(typed)) {
        const found = api.memSearch(typed);
        if (found.length) content = api.withRecords(typed, found);
      }
      let answer;
      try {
        answer = await api.run(buildMessages(history, content), img, { onToken, onStatus, think: useThink });
      } catch (e) {
        // Still too long for the model's window: answer with no earlier turns
        // rather than fail.
        if (!/longer than this model can read|context/i.test(String(e && e.message))) throw e;
        onStatus("Long chat — answering from this message alone…");
        answer = await api.run(buildMessages([], content, 0), img, { onToken, onStatus, think: useThink });
      }
      if (runRef.current !== run) return;
      if (raf) cancelAnimationFrame(raf);
      const st = api.lastStats();
      patchMsg(cid, aiId, { text: answer, streaming: false, phase: "", sources, via, secs: Math.round((Date.now() - t0) / 1000), stats: st });
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
    } catch (e) { api.flash("Read-aloud isn't available on this phone"); }
  };
  const share = (m) => {
    try { if (NATIVE && NATIVE.share) NATIVE.share(m.text); else if (navigator.share) navigator.share({ text: m.text }); else { navigator.clipboard.writeText(m.text); api.flash("Copied"); } } catch (e) {}
  };
  const voice = async () => {
    if (listening) { try { NATIVE.stopListening(); } catch (e) {} return; }
    if (!NATIVE || !NATIVE.listen) return api.flash("Voice input works in the Android app");
    const before = text ? text.replace(/\s+$/, "") + " " : "";
    setListening(true);
    try {
      const r = await api.listen(/[؀-ۿ]/.test(text) || api.prefersArabic() ? "ar-EG" : "", (p) => setText(before + p));
      if (r) setText(before + r);
    } catch (e) { api.flash(String((e && e.message) || e).slice(0, 100)); }
    finally { setListening(false); }
  };
  const pickImage = (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return api.flash("That photo is too large");
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); setImage({ data: url.split(",")[1], media: file.type || "image/jpeg", url }); };
    r.readAsDataURL(file);
  };

  const shownChats = chats.filter((c) => !q.trim() || (c.title + " " + c.messages.map((m) => m.text).join(" ")).toLowerCase().includes(q.toLowerCase()));
  const lastAi = [...messages].reverse().find((m) => m.role === "assistant" && !m.card);

  return (
    <div className="pb-44">
      {/* ---- history drawer ---- */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex" onClick={() => setDrawerOpen(false)}>
          <div className="w-[86%] max-w-sm h-full bg-slate-900 border-e border-slate-800 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-800 flex items-center gap-2">
              <button onClick={() => { setActiveId(null); setDrawerOpen(false); }} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-500 text-slate-950 text-sm font-semibold"><Plus size={16} /> New chat</button>
              <button onClick={() => setDrawerOpen(false)} className="att-icon-btn"><X size={18} /></button>
            </div>
            <div className="px-3 pt-3">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3">
                <Search size={14} className="text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" dir="auto"
                  className="flex-1 bg-transparent py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none" />
              </div>
            </div>
            <div className="att-scroll flex-1 overflow-y-auto p-2">
              {shownChats.length === 0 ? <p className="text-xs text-slate-500 p-3">No chats yet.</p> : shownChats.map((c) => (
                <div key={c.id} className={`group flex items-center gap-1 rounded-xl ${c.id === activeId ? "bg-slate-800" : ""}`}>
                  {renaming === c.id ? (
                    <input autoFocus defaultValue={c.title} dir="auto" onBlur={(e) => { const v = e.target.value.trim(); if (v) patchChat(c.id, (x) => ({ ...x, title: v })); setRenaming(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
                      className="flex-1 bg-slate-950 border border-teal-700 rounded-lg px-2 py-2 text-sm text-slate-100" />
                  ) : (
                    <button onClick={() => { setActiveId(c.id); setDrawerOpen(false); }} className="flex-1 min-w-0 text-start px-3 py-2.5">
                      <span dir="auto" className="block text-sm text-slate-200 truncate">{c.title}</span>
                      <span className="block text-[10px] text-slate-500">{new Date(c.updated).toLocaleDateString([], { day: "numeric", month: "short" })} · {c.messages.length} messages</span>
                    </button>
                  )}
                  <button onClick={() => setRenaming(c.id)} className="p-2 text-slate-500" title="Rename"><PenLine size={14} /></button>
                  <button onClick={() => { setChats((l) => l.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null); }} className="p-2 text-slate-500" title="Delete"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 p-3 border-t border-slate-800">Chats are saved on this phone only.</p>
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
      ) : null}

      {/* ---- empty state ---- */}
      {messages.length === 0 ? (
        <div className="pt-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-800 text-teal-300 mb-3"><Sparkles size={22} /></div>
          <p className="text-lg text-white font-semibold">What can I help with?</p>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">Type, speak or add a photo. Runs on your phone — works with no signal.</p>
          <div className="grid grid-cols-2 gap-2 mt-5 text-start">
            {STARTERS.map(([ic, label, seed]) => (
              <button key={label} onClick={() => { setText(seed); setTimeout(() => taRef.current && taRef.current.focus(), 30); }}
                className="rounded-xl border border-slate-800 bg-slate-900 p-3 active:border-teal-600">
                <span className="text-lg">{ic}</span>
                <span className="block text-sm text-slate-200 mt-1">{label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ---- the conversation ---- */}
      <div className="space-y-4 pt-2">
        {messages.map((m, idx) => m.role === "user" ? (
          <div key={m.id} className="flex flex-col items-end">
            {m.image ? <img src={m.image} alt="" className="max-w-[70%] max-h-56 rounded-2xl mb-1.5 border border-slate-800 object-cover" /> : null}
            {m.text ? <div dir="auto" className="max-w-[85%] bg-teal-600/25 border border-teal-800/60 text-slate-100 rounded-2xl rounded-ee-md px-3.5 py-2.5 text-[15px] whitespace-pre-wrap leading-relaxed">{m.text}</div> : null}
            {!busy ? <button onClick={() => editFrom(idx)} className="mt-1 text-[11px] text-slate-500 flex items-center gap-1 px-1"><PenLine size={11} /> Edit</button> : null}
          </div>
        ) : m.card ? (
          <div key={m.id} className={`rounded-2xl border p-3.5 ${m.card.tone === "rose" ? "border-rose-800/70 bg-rose-500/5" : "border-emerald-800/70 bg-emerald-500/5"}`}>
            <p dir="auto" className="text-sm font-medium text-slate-100 flex items-center gap-1.5"><CheckCircle2 size={15} className={m.card.tone === "rose" ? "text-rose-300" : "text-emerald-300"} /> {m.card.title}</p>
            {m.card.detail ? <p dir="auto" className="text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">{m.card.detail}</p> : null}
            {(m.card.actions || []).length ? (
              <div className="flex gap-2 mt-2.5 flex-wrap">
                {m.card.actions.map(([label, act], i) => (
                  <button key={act} onClick={() => cardAction(m, act)}
                    className={`text-xs px-3 py-2 rounded-lg ${i === 0 ? "bg-teal-500 text-slate-950 font-medium" : "border border-slate-700 text-slate-300"}`}>{label}</button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div key={m.id} className="group">
            {m.thinking ? (
              <div className="mb-2">
                <button onClick={() => setOpenThought((o) => ({ ...o, [m.id]: !o[m.id] }))} className="flex items-center gap-1.5 text-[12px] text-slate-400">
                  <Brain size={13} className={m.streaming && !m.text ? "text-teal-300 animate-pulse" : ""} />
                  {m.streaming && !m.text ? "Thinking…" : "Thought" + (m.secs ? " for " + m.secs + " s" : "")}
                  <ChevronDown size={13} className={openThought[m.id] ? "rotate-180" : ""} />
                </button>
                {(openThought[m.id] || (m.streaming && !m.text)) ? (
                  <p dir="auto" className="att-scroll mt-1.5 ps-3 border-s-2 border-slate-800 text-[12px] text-slate-500 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {openThought[m.id] ? m.thinking : m.thinking.slice(-500)}</p>
                ) : null}
              </div>
            ) : null}
            {m.streaming && !m.text && !m.thinking ? (
              <div className="flex items-center gap-2 text-sm text-teal-300/90 py-1"><Loader2 size={15} className="animate-spin" /> {m.phase || "Reading…"}</div>
            ) : null}
            {m.text ? <Md text={m.text + (m.streaming ? " ▍" : "")} /> : null}
            {m.error ? <p className="text-sm text-amber-300/90 mt-1">{m.error}</p> : null}
            {m.sources && m.sources.length ? (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-slate-500">Sources{m.via ? " · via " + m.via : ""}</p>
                {m.sources.map((h, i) => <a key={i} href={h.url} target="_blank" rel="noreferrer" className="block text-[12px] text-teal-300/90 truncate">[{i + 1}] {h.title}</a>)}
              </div>
            ) : null}
            {!m.streaming && m.text ? (
              <div className="flex items-center gap-0.5 mt-1.5 -ms-2 text-slate-500">
                <button onClick={() => { try { navigator.clipboard.writeText(m.text); } catch (e) {} api.flash("Copied"); }} className="p-2" title="Copy"><Copy size={15} /></button>
                <button onClick={() => regenerate(idx)} className="p-2" title="Regenerate" disabled={busy}><RefreshCw size={15} /></button>
                <button onClick={() => speak(m)} className={`p-2 ${speakingId === m.id ? "text-teal-300" : ""}`} title="Read aloud"><Volume2 size={15} /></button>
                <button onClick={() => share(m)} className="p-2" title="Share"><Share2 size={15} /></button>
                <button onClick={() => { api.remember({ kind: "note", title: m.text.slice(0, 60), text: m.text, output: "", tags: ["saved"] }); api.flash("Saved to Memory"); }} className="p-2" title="Save to Memory"><Save size={15} /></button>
                {m.stats && m.stats.tps ? <span className="text-[10px] text-slate-600 ms-1">{m.stats.tps} tokens/s</span> : null}
              </div>
            ) : null}
          </div>
        ))}

        {/* next step, one tap */}
        {!busy && lastAi && lastAi === messages[messages.length - 1] && lastAi.text && !lastAi.error ? (
          <div className="att-chips flex gap-1.5 overflow-x-auto pb-1">
            {(() => { const u = messages[messages.length - 2]; return u && u.image ? (
              <button onClick={() => api.photoToMoney(u.image)} className="shrink-0 text-xs px-3 py-2 rounded-full border border-emerald-800 text-emerald-200 bg-emerald-500/10">💳 Add to Money</button>
            ) : null; })()}
            {followUps(lastAi).map(([label, prompt]) => (
              <button key={label} onClick={() => ask(prompt)} className="shrink-0 text-xs px-3 py-2 rounded-full border border-slate-700 text-slate-300 active:border-teal-600">{label}</button>
            ))}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* ---- composer, pinned above the bottom bar ---- */}
      <div className="fixed left-0 right-0 z-40 px-3 pb-2 pt-2 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent" style={{ bottom: "calc(58px + env(safe-area-inset-bottom))" }}>
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-xl">
          {image ? (
            <div className="relative inline-block mb-2 ms-1">
              <img src={image.url} alt="" className="h-16 rounded-lg border border-slate-700" />
              <button onClick={() => setImage(null)} className="absolute -top-2 -end-2 bg-slate-800 border border-slate-600 rounded-full p-0.5 text-slate-200"><X size={13} /></button>
            </div>
          ) : null}
          <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} dir="auto"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); ask(); } }}
            placeholder={listening ? "Listening…" : "Message Attune"}
            className="att-scroll w-full bg-transparent px-2 py-1.5 text-[16px] leading-relaxed text-slate-100 placeholder-slate-500 resize-none focus:outline-none max-h-[180px]" />
          <div className="flex items-center gap-1">
            <label className="p-2 rounded-full text-slate-400 active:bg-slate-800" title="Photo">
              <ImagePlus size={19} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files && e.target.files[0]); e.target.value = ""; }} />
            </label>
            <button onClick={() => setThink((v) => !v)} className={`px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1 border ${think ? "border-teal-600 text-teal-300 bg-teal-500/10" : "border-slate-700 text-slate-400"}`} title="Think first">
              <Brain size={14} /> Think</button>
            <button onClick={api.toggleWeb} className={`px-2.5 py-1.5 rounded-full text-xs flex items-center gap-1 border ${api.webOn ? "border-teal-600 text-teal-300 bg-teal-500/10" : "border-slate-700 text-slate-400"}`} title="Search the web">
              <Globe size={14} /> Web</button>
            <div className="flex-1" />
            {busy ? (
              <button onClick={stop} className="w-10 h-10 rounded-full bg-slate-100 text-slate-950 flex items-center justify-center" title="Stop"><Square size={15} /></button>
            ) : text.trim() || image ? (
              <button onClick={() => ask()} className="w-10 h-10 rounded-full bg-teal-500 text-slate-950 flex items-center justify-center" title="Send"><Send size={17} /></button>
            ) : (
              <button onClick={voice} className={`w-10 h-10 rounded-full flex items-center justify-center ${listening ? "bg-rose-500 text-white animate-pulse" : "bg-slate-800 text-slate-200"}`} title="Speak"><Mic size={18} /></button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
