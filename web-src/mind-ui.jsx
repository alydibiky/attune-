/* ---- v6.8 Mind (replaces the Memory screen) ----------------------------------------------------
   Ali: "instead of memory, an app like mymind but much better". A private visual board of everything
   you keep; it files itself (mind.js). The two parts of the old Memory screen that are not "things
   you kept" — promises found in them, and Your words — are its other two tabs, unchanged.        */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Brain, Search, Sparkles, Link2, Star, Bell, Trash2, X, Plus, ClipboardPaste, Copy, ExternalLink, Share2, Loader2, Shuffle, Folder, ImagePlus, Send, Check, Camera } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as M from "./mind.js";
import { useSubBack } from "./backstack.js";
import { Md } from "./chat.jsx";

/* ---- thumbnails: small JPEGs in IndexedDB (the records stay small text in localStorage) ---- */
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((ok, bad) => {
    try {
      const r = indexedDB.open("attune-mind", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("thumbs");
      r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
    } catch (e) { bad(e); }
  });
  return dbP;
}
async function thumbPut(id, url) { try { const d = await db(); await new Promise((ok) => { const t = d.transaction("thumbs", "readwrite"); t.objectStore("thumbs").put(url, id); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {} }
async function thumbGet(id) { try { const d = await db(); return await new Promise((ok) => { const q = d.transaction("thumbs").objectStore("thumbs").get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } }
async function thumbDel(id) { try { const d = await db(); const t = d.transaction("thumbs", "readwrite"); t.objectStore("thumbs").delete(id); t.objectStore("thumbs").delete(id + ":full"); } catch (e) {} }
/** v6.10 — a photo kept from anywhere in the app (chat, Instant) keeps the PICTURE too: a small thumbnail for the
 *  board and a 1280 px copy to open full size. image = { data (base64), media }. Never throws. */
export async function keepPicture(id, image) {
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = "data:" + (image.media || "image/jpeg") + ";base64," + image.data; });
    const shrink = (px, q) => { const k = Math.min(1, px / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q); };
    await thumbPut(id, shrink(420, 0.72));
    await thumbPut(id + ":full", shrink(1280, 0.85));
    return true;
  } catch (e) { return false; }
}

/** A picture → a small thumbnail (for the board) and a 1280 px copy (for the model to read). */
function readPicture(file) {
  return new Promise((ok, bad) => {
    const fr = new FileReader();
    fr.onerror = () => bad(new Error("Couldn't read that picture"));
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const shrink = (px, q) => { const k = Math.min(1, px / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", q); };
        const big = shrink(1280, 0.85);
        ok({ thumb: shrink(420, 0.72), media: "image/jpeg", data: big.split(",")[1] });
      };
      img.onerror = () => bad(new Error("Couldn't read that picture"));
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
const PHOTO_PROMPT = `You file a photo in someone's private notebook. Reply with ONLY JSON:
{"title":"3-8 words naming what it shows","summary":"one sentence: what is in it","tags":["3 to 5 topic words"],"text":"every word written in the photo, exactly, or empty"}
Only what is really in the photo. Title, summary and tags in the language of any writing in it, else English.`;

function useThumb(rec) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let on = true; if (rec && rec.meta && rec.meta.thumb) thumbGet(rec.id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [rec && rec.id, rec && rec.meta && rec.meta.thumb]);
  return url;
}
const dateText = (ts) => new Date(ts).toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short", year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
const kindLabel = (k) => { const x = M.KINDS[k] || M.KINDS.note; return getLang() === "ar" ? x.ar : x.en; };

/* ---- one card on the board: each kind looks like what it is ---- */
function Card({ rec, open }) {
  const kind = M.kindOf(rec);
  const thumb = useThumb(rec);
  const title = M.titleOf(rec);
  const tags = M.tagsOf(rec).slice(0, 3);
  const lp = kind === "link" ? M.linkParts(rec.text) : null;
  const body = String(rec.text || "");
  return (
    <button onClick={() => open(rec)} data-testid="mind-card" data-kind={kind}
      className="mb-3 w-full break-inside-avoid text-start bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-teal-600 transition-colors">
      {thumb ? <img src={thumb} alt="" className="w-full block" /> : null}
      <div className="p-3">
        {kind === "quote" ? (
          <p className="font-serif text-[15px] leading-relaxed text-slate-100" dir="auto">{body.slice(0, 280)}</p>
        ) : kind === "link" && lp ? (
          <>
            <p className="text-[11px] text-teal-400 flex items-center gap-1"><Link2 size={11} /> {lp.site}</p>
            <p className="text-sm text-slate-100 mt-1 line-clamp-3" dir="auto">{title && !/^https?:/.test(title) ? title : lp.path || lp.url}</p>
          </>
        ) : kind === "product" ? (
          <>
            <p className="text-sm text-slate-100 line-clamp-3" dir="auto">{title}</p>
            {M.priceIn(body) ? <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300" dir="ltr">{M.priceIn(body)}</span> : null}
          </>
        ) : kind === "todo" ? (
          <div className="space-y-1">
            {body.split("\n").filter((l) => l.trim()).slice(0, 5).map((l, i) => (
              <p key={i} className="text-[13px] text-slate-200 flex gap-1.5" dir="auto"><span className="text-slate-500">☐</span>{l.replace(/^\s*(-\s*)?\[ ?[x ]?\]\s*|^\s*[-•☐☑]\s*/i, "")}</p>
            ))}
          </div>
        ) : (
          <>
            {title ? <p className="text-sm font-medium text-slate-100 line-clamp-2" dir="auto">{title}</p> : null}
            {kind !== "photo" || !thumb ? <p className="text-[12px] text-slate-400 mt-1 line-clamp-4 whitespace-pre-line" dir="auto">{(rec.meta && rec.meta.summary) || rec.output || body}</p> : null}
          </>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] text-slate-500">{M.KINDS[kind].icon} {dateText(rec.ts)}</span>
          {rec.pinned ? <Star size={10} className="text-amber-400" /> : null}
          {tags.map((t) => <span key={t} className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400">#{t}</span>)}
        </div>
      </div>
    </button>
  );
}

/* ---- an open item ---- */
function Detail({ rec, close, update, forget, togglePin, openRec, search, findPromises, scheduleReminder, flash, askAbout }) {
  useSubBack(true, close);
  const kind = M.kindOf(rec);
  const thumb = useThumb(rec);
  const [tagIn, setTagIn] = useState("");
  const [bigUrl, setBigUrl] = useState(null);
  const [editTitle, setEditTitle] = useState(null);
  const [when, setWhen] = useState("");
  const m = rec.meta || {};
  const lp = M.linkParts(rec.text);
  const sim = useMemo(() => M.similar(rec, search, 4), [rec.id, rec.meta]);
  const setMeta = (patch) => update(rec.id, (r) => ({ ...r, meta: { ...(r.meta || {}), ...patch } }));
  const addTag = () => { const t = M.normTag(tagIn); if (!t) return; setMeta({ myTags: [...new Set([...(m.myTags || []), t])], hidden: (m.hidden || []).filter((x) => x !== t) }); setTagIn(""); };
  const dropTag = (t) => setMeta({ myTags: (m.myTags || []).filter((x) => x !== t), hidden: [...new Set([...(m.hidden || []), t])] });
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-3 overflow-auto" onClick={close}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full my-6 overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="mind-detail">
        {thumb ? <img src={thumb} alt={tr("Open the photo")} onClick={() => thumbGet(rec.id + ":full").then((u) => setBigUrl(u || thumb))} className="w-full max-h-80 object-contain bg-black cursor-zoom-in" data-testid="mind-photo" /> : null}
        {bigUrl ? (
          <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center" onClick={() => setBigUrl(null)} data-testid="mind-photo-big">
            <img src={bigUrl} alt="" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-3 end-3 p-2 rounded-full bg-black/60 text-white" aria-label={tr("Close")}><X size={20} /></button>
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-teal-400">{M.KINDS[kind].icon} {kindLabel(kind)} · {new Date(rec.ts).toLocaleString()}</p>
              {editTitle != null ? (
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} dir="auto"
                  onBlur={() => { setMeta({ myTitle: editTitle.trim() || undefined }); setEditTitle(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-base text-white" />
              ) : (
                <h3 onClick={() => setEditTitle(M.titleOf(rec))} className="text-base font-semibold text-white mt-0.5 cursor-text" dir="auto" title={tr("Tap to rename")}>{M.titleOf(rec) || tr("Untitled")}</h3>
              )}
            </div>
            <button onClick={close} className="-m-2 p-2 rounded-full text-slate-500 hover:text-slate-300" aria-label={tr("Close")}><X size={18} /></button>
          </div>
          {m.summary ? <p className="text-sm text-slate-300 mb-3 flex gap-1.5" dir="auto"><Sparkles size={13} className="text-teal-400 mt-0.5 shrink-0" />{m.summary}</p> : null}
          {lp ? <a href={lp.url} target="_blank" rel="noreferrer" className="text-xs text-teal-400 flex items-center gap-1 mb-3 break-all"><ExternalLink size={12} /> {lp.url}</a> : null}
          {rec.text && !(kind === "link" && rec.text.trim() === (lp && lp.url)) ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-3 max-h-64 overflow-auto">
              {/\|.*\|/.test(rec.text) || /^#{1,4}\s|\*\*/m.test(rec.text) ? <div className="text-sm text-slate-200 leading-relaxed"><Md text={rec.text} runnable={false} /></div>
                : <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed" dir="auto">{rec.text}</p>}
            </div>
          ) : null}
          {rec.output ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{tr("What it answered")}</p>
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-3 max-h-64 overflow-auto">
                <div className="text-sm text-teal-50 leading-relaxed"><Md text={rec.output} runnable={false} /></div>
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {M.tagsOf(rec).map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex items-center gap-1">#{t}
                <button onClick={() => dropTag(t)} className="text-slate-500 hover:text-red-400" aria-label={tr("Remove tag")}><X size={10} /></button></span>
            ))}
            <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTag(); }} placeholder={tr("+ tag")} dir="auto"
              data-testid="mind-tag-in" className="w-24 bg-transparent border-b border-slate-700 text-xs text-slate-200 px-1 py-0.5 focus:outline-none focus:border-teal-500" />
          </div>
          <textarea value={m.myNote || ""} onChange={(e) => setMeta({ myNote: e.target.value })} rows={2} dir="auto"
            placeholder={tr("Your note on this (why you kept it)…")}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-slate-100 placeholder-slate-600 mb-3 focus:outline-none focus:border-teal-500" />

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => togglePin(rec.id)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-amber-500">
              <Star size={12} className={`inline me-1 ${rec.pinned ? "text-amber-400" : ""}`} />{rec.pinned ? tr("Unpin") : tr("Pin")}</button>
            <button onClick={() => { try { navigator.clipboard.writeText([rec.text, rec.output].filter(Boolean).join("\n\n")); } catch (e) {} flash(tr("Copied")); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500"><Copy size={12} className="inline me-1" />{tr("Copy")}</button>
            {navigator.share ? <button onClick={() => navigator.share({ title: M.titleOf(rec), text: rec.text }).catch(() => {})}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500"><Share2 size={12} className="inline me-1" />{tr("Share")}</button> : null}
            <button onClick={() => askAbout(rec)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500"><Brain size={12} className="inline me-1" />{tr("Ask about this")}</button>
            <button onClick={() => findPromises(rec)} className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:border-teal-500">{tr("Find promises in this")}</button>
            <button onClick={() => forget(rec.id)} data-testid="mind-forget"
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:border-red-800 hover:text-red-400 ms-auto"><Trash2 size={12} className="inline me-1" />{tr("Forget")}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-800">
            <Bell size={13} className="text-slate-500" />
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200" />
            <button disabled={!when} data-testid="mind-remind"
              onClick={() => { const at = new Date(when).getTime(); if (!(at > Date.now())) return flash(tr("Pick a time in the future")); scheduleReminder({ id: "m-" + rec.id, at, title: M.titleOf(rec) || tr("From your Mind"), body: (m.summary || rec.text || "").slice(0, 140), repeat: "none", created: Date.now(), source: "mind" }); setMeta({ remindAt: at }); flash(tr("I'll remind you")); }}
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-semibold disabled:opacity-40">{tr("Remind me")}</button>
            {m.remindAt && m.remindAt > Date.now() ? <span className="text-[11px] text-teal-400">{tr("Reminder set")}: {new Date(m.remindAt).toLocaleString()}</span> : null}
          </div>
          {sim.length ? (
            <div className="mt-4">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">{tr("Similar in your Mind")}</p>
              <div className="grid grid-cols-2 gap-2">
                {sim.map((r) => (
                  <button key={r.id} onClick={() => openRec(r)} className="text-start bg-slate-950 border border-slate-800 rounded-xl p-2 hover:border-teal-600">
                    <p className="text-[11px] text-slate-500">{M.KINDS[M.kindOf(r)].icon} {dateText(r.ts)}</p>
                    <p className="text-xs text-slate-200 line-clamp-2" dir="auto">{M.titleOf(r)}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const SPACES_KEY = "attune:mind:spaces:v1";
const loadSpaces = () => { try { const v = JSON.parse(localStorage.getItem(SPACES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveSpaces = (v) => { try { localStorage.setItem(SPACES_KEY, JSON.stringify(v.slice(0, 30))); } catch (e) {} };

/**
 * The Mind screen.
 * records/remember/update/forget/togglePin: the app's memory store. search(q, n): its BM25 search.
 * llm(messages, image, o): the on-phone model. ask(question, found): "ask your memory" answer text.
 * promisesPanel / wordsPanel: the old Memory screen's other two parts, shown as tabs.
 */
export function MindPage({ records, remember, update, forget, togglePin, search, llm, modelReady, ask, findCommitments, scheduleReminder, pro, openPlan, openEngine, flash, promisesPanel, wordsPanel, promiseCount, shareBanner, note, external, clearExternal }) {
  const ar = getLang() === "ar";
  const [tab, setTab] = useState("mind");
  const [add, setAdd] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(null);
  const [kind, setKind] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState("");
  const [answer, setAnswer] = useState(null);
  const [spaces, setSpaces] = useState(loadSpaces);
  const [filing, setFiling] = useState(null);
  const [dropping, setDropping] = useState(false);
  const fileRef = useRef(null);
  const recsRef = useRef(records); recsRef.current = records;

  // another screen asked to open an item (a promise's "from:", Home's recent items)
  useEffect(() => { if (external) { setTab("mind"); setOpenId(external.id); clearExternal && clearExternal(); } }, [external]);
  const openRec = records.find((r) => r.id === openId) || null;
  const now = Date.now();
  const res = useMemo(() => M.mindSearch(records, q + (kind ? " " + kindWord(kind) : ""), search, { now, tag }), [records, q, tag, kind]);
  const items = res.items;
  const counts = useMemo(() => M.kindCounts(records), [records]);
  const auto = useMemo(() => M.autoSpaces(records), [records]);
  const past = useMemo(() => (q || tag || kind ? [] : M.resurface(records, now, 3)), [records.length, q, tag, kind, Math.floor(now / 86400000)]);
  const looksLikeQuestion = /\?|؟|^(what|when|where|who|how|which|did|do|is|was|how much|كام|امتى|فين|مين|ايه|إيه|هل|ازاي|إزاي)\b/i.test(q.trim());

  // ---- the background filer: while this screen is open and the model is loaded, it reads one new
  // item at a time (a title, a line, tags). Nothing waits on it; search works before it's done.
  useEffect(() => {
    if (!modelReady || !pro || busy) return;
    const next = M.needsFiling(records, 1)[0];
    if (!next) { setFiling(null); return; }
    let on = true;
    const t = setTimeout(async () => {
      setFiling(next.id);
      let parsed = null;
      try { parsed = M.parseTagReply(await llm(M.tagMessages(next), null, { json: true, maxTokens: 220, temperature: 0.2 }), next); } catch (e) {}
      if (!on) return;
      update(next.id, (r) => M.fileRecord(r, parsed));
      setFiling(null);
    }, 1500);
    return () => { on = false; clearTimeout(t); };
  }, [records, modelReady, pro, busy]);

  const keep = (text, extra = {}) => {
    const t = String(text || "").trim();
    if (!t) return flash(tr("Nothing to keep"));
    const base = { kind: "note", title: t.split("\n")[0].slice(0, 70), text: t, output: "", tags: [], ...extra };
    const k = M.kindOf(base);
    const r = remember({ ...base, meta: { ...(extra.meta || {}), mindKind: k } });
    flash(tr("Kept in your Mind"));
    if (pro && modelReady && findCommitments && t.length > 20) findCommitments(t, r.id, true);   // never pops Engine open just for keeping a note
    return r;
  };
  const keepPhoto = async (file) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) return flash(tr("That picture is too large"));
    setBusy(tr("Reading the photo…"));
    try {
      const p = await readPicture(file);
      let j = null;
      if (modelReady) {
        try { const raw = await llm([{ role: "system", content: PHOTO_PROMPT }, { role: "user", content: "The photo:" }], { media: p.media, data: p.data }, { json: true, maxTokens: 500, temperature: 0.1 }); j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) { j = null; }
      }
      const text = (j && String(j.text || "").trim()) || "";
      const r = remember({ kind: "photo", title: (j && j.title) || file.name || tr("Photo"), text: text || (j && j.summary) || "", output: "", tags: [],
        meta: { thumb: true, mindKind: "photo", ...(j ? { aiTitle: String(j.title || "").slice(0, 80), summary: String(j.summary || "").slice(0, 200), aiTags: (Array.isArray(j.tags) ? j.tags : []).map(M.normTag).filter(Boolean).slice(0, 5), aiAt: Date.now() } : {}) } });
      await thumbPut(r.id, p.thumb);
      await thumbPut(r.id + ":full", "data:image/jpeg;base64," + p.data);
      update(r.id, (x) => ({ ...x }));   // re-render with the thumbnail
      flash(j ? tr("Photo kept — and read") : tr("Photo kept (load a model to have it read)"));
      if (pro && modelReady && text.length > 20 && findCommitments) findCommitments(text, r.id, true);
    } catch (e) { flash(String((e && e.message) || e).slice(0, 90)); }
    finally { setBusy(""); }
  };
  const doAsk = async (question, only) => {
    if (!modelReady) return openEngine();
    const found = only ? [{ rec: only }] : search(question, 5);
    setBusy(tr("Reading your Mind…")); setAnswer(null);
    try {
      const text = await ask(question, found.slice(0, 5));
      setAnswer({ q: question, text, sources: found.slice(0, 5).map((h) => h.rec) });
    } catch (e) { flash(String((e && e.message) || e).slice(0, 90)); }
    finally { setBusy(""); }
  };
  const saveSpace = () => {
    const name = (q || tag || "").trim(); if (!name) return;
    const next = [{ id: Date.now().toString(36), name, q, tag }, ...spaces.filter((s) => s.name !== name)];
    setSpaces(next); saveSpaces(next); flash(tr("Saved as a Space"));
  };
  const removeSpace = (id) => { const next = spaces.filter((s) => s.id !== id); setSpaces(next); saveSpaces(next); };
  const doForget = (id) => { thumbDel(id); forget(id); setOpenId(null); };

  const chip = (on) => `text-xs px-3 py-1.5 rounded-full border whitespace-nowrap ${on ? "bg-teal-500 text-slate-950 border-teal-500 font-semibold" : "bg-slate-900 border-slate-800 text-slate-300 hover:border-teal-600"}`;

  return (
    <div className="space-y-4 att-in" data-testid="mind-page">
      <div className="flex items-center gap-2">
        <Brain size={20} className="text-teal-400" />
        <h2 className="text-lg font-semibold text-white">{tr("Mind")}</h2>
        <span className="text-[11px] text-slate-500">{records.length} {tr("kept · private, on this phone")}</span>
      </div>
      <div className="flex gap-1.5">
        {[["mind", tr("Everything")], ["promises", tr("Promises") + (promiseCount ? ` (${promiseCount})` : "")], ["words", tr("Your words")]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} data-testid={"mind-tab-" + id} className={chip(tab === id)}>{label}</button>
        ))}
      </div>
      {shareBanner}
      {note}

      {tab === "promises" ? promisesPanel : tab === "words" ? wordsPanel : (
        <>
          {/* keep anything */}
          <section className={`bg-slate-900 rounded-2xl border p-3 ${dropping ? "border-teal-500" : "border-slate-800"}`}
            onDragOver={(e) => { e.preventDefault(); setDropping(true); }} onDragLeave={() => setDropping(false)}
            onDrop={async (e) => {
              e.preventDefault(); setDropping(false);
              const f = e.dataTransfer.files && e.dataTransfer.files[0];
              if (f && /^image\//.test(f.type)) return keepPhoto(f);
              if (f && (/^text|json|csv|md/.test(f.type) || /\.(txt|md|csv|json|log)$/i.test(f.name))) return keep(await f.text(), { title: f.name });
              const t = e.dataTransfer.getData("text"); if (t) keep(t);
            }}>
            <textarea value={add} onChange={(e) => setAdd(e.target.value)} rows={2} dir="auto" data-testid="mind-add"
              placeholder={tr("Keep anything — a note, a link, a quote, a price, a number, an idea…")}
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none" />
            <div className="flex items-center gap-1.5">
              <button onClick={() => { if (keep(add)) setAdd(""); }} data-testid="mind-keep" className="text-xs px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 font-semibold"><Plus size={12} className="inline me-1" />{tr("Keep")}</button>
              <button onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t && t.trim()) setAdd(t.trim()); else flash(tr("Clipboard is empty")); } catch (e) { flash(tr("Allow clipboard access, or paste manually")); } }}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"><ClipboardPaste size={12} className="inline me-1" />{tr("Paste")}</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300"><Camera size={12} className="inline me-1" />{tr("Photo")}</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="mind-photo" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; keepPhoto(f); }} />
              {busy ? <span className="text-[11px] text-teal-400 flex items-center gap-1 ms-auto"><Loader2 size={12} className="animate-spin" />{busy}</span>
                : filing ? <span className="text-[11px] text-slate-500 flex items-center gap-1 ms-auto"><Sparkles size={11} />{tr("filing…")}</span> : null}
            </div>
          </section>

          {!pro ? (
            <p className="text-[11px] text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-2.5">
              {tr("Free: keep and search everything. Pro: it files each item by itself (title, summary, tags), reads your photos and answers questions from your Mind.")}
              <button onClick={openPlan} className="text-teal-400 ms-1">{tr("See Pro")}</button>
            </p>
          ) : null}

          {/* search / ask */}
          <div>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-2xl px-3 focus-within:border-teal-500">
              <Search size={15} className="text-slate-500" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setAnswer(null); }} dir="auto" data-testid="mind-search"
                onKeyDown={(e) => { if (e.key === "Enter" && looksLikeQuestion && pro) doAsk(q); }}
                placeholder={tr("Search or ask — “crane photos last month”, «لينكات الونش»")}
                className="flex-1 bg-transparent py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none" />
              {q ? <button onClick={() => { setQ(""); setAnswer(null); }} className="text-slate-500"><X size={14} /></button> : null}
            </div>
            {q.trim() ? (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <button onClick={() => (pro ? doAsk(q) : openPlan())} data-testid="mind-ask" className="text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 border border-teal-800 text-teal-200"><Brain size={12} className="inline me-1" />{tr("Ask your Mind")}</button>
                <button onClick={saveSpace} className="text-xs px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"><Folder size={12} className="inline me-1" />{tr("Save as a Space")}</button>
                {res.filters.kind || res.filters.from != null || res.filters.pinned ? (
                  <span className="text-[11px] text-slate-500">{tr("Showing")}: {[res.filters.kind && kindLabel(res.filters.kind), res.filters.from != null && `${dateText(res.filters.from)} – ${dateText(Math.min(res.filters.to, Date.now()))}`, res.filters.pinned && tr("pinned"), res.filters.words && `“${res.filters.words}”`].filter(Boolean).join(" · ")}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {answer ? (
            <section className="bg-slate-900 border border-teal-900/60 rounded-2xl p-4" data-testid="mind-answer">
              <p className="text-[11px] text-teal-400 mb-1 flex items-center gap-1"><Brain size={12} /> {answer.q}</p>
              <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed" dir="auto">{answer.text}</p>
              {answer.sources.length ? (
                <>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-3 mb-1.5">{tr("From these items in your Mind")}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {answer.sources.map((r) => (
                      <button key={r.id} onClick={() => setOpenId(r.id)} className="shrink-0 w-40 text-start bg-slate-950 border border-slate-800 rounded-xl p-2 hover:border-teal-600">
                        <p className="text-[10px] text-slate-500">{M.KINDS[M.kindOf(r)].icon} {dateText(r.ts)}</p>
                        <p className="text-xs text-slate-200 line-clamp-2" dir="auto">{M.titleOf(r)}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : <p className="text-[11px] text-slate-500 mt-2">{tr("Nothing in your Mind matched — so this is not from your items.")}</p>}
            </section>
          ) : null}

          {/* kinds, then Spaces */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button onClick={() => { setKind(null); setTag(null); }} className={chip(!kind && !tag)}>{tr("All")}</button>
            {counts.map((c) => (
              <button key={c.kind} onClick={() => { setKind(kind === c.kind ? null : c.kind); setTag(null); }} data-testid={"mind-kind-" + c.kind} className={chip(kind === c.kind)}>
                {M.KINDS[c.kind].icon} {kindLabel(c.kind)} <span className="opacity-60">{c.count}</span></button>
            ))}
          </div>
          {auto.length || spaces.length ? (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid="mind-spaces">
              {spaces.map((s) => (
                <span key={s.id} className="flex items-center">
                  <button onClick={() => { setQ(s.q || ""); setTag(s.tag || null); setKind(null); }} className={chip(q === s.q && tag === s.tag)}><Folder size={11} className="inline me-1" />{s.name}</button>
                  <button onClick={() => removeSpace(s.id)} className="text-slate-600 hover:text-red-400 -ms-1 px-1" aria-label={tr("Remove")}><X size={11} /></button>
                </span>
              ))}
              {auto.map((s) => (
                <button key={s.tag} onClick={() => { setTag(tag === s.tag ? null : s.tag); setKind(null); }} className={chip(tag === s.tag)}>#{s.tag} <span className="opacity-60">{s.count}</span></button>
              ))}
            </div>
          ) : null}

          {past.length ? (
            <section>
              <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1"><Shuffle size={12} /> {tr("From your past")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {past.map(({ rec, why }) => (
                  <button key={rec.id} onClick={() => setOpenId(rec.id)} className="shrink-0 w-48 text-start bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-3 hover:border-teal-600">
                    <p className="text-[10px] text-amber-300">{tr(why)} · {dateText(rec.ts)}</p>
                    <p className="text-sm text-slate-100 line-clamp-3 mt-1" dir="auto">{M.titleOf(rec)}</p>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* the board */}
          {items.length ? (
            <div className="columns-2 sm:columns-3 gap-3" data-testid="mind-board">
              {items.map((r) => <Card key={r.id} rec={r} open={(x) => setOpenId(x.id)} />)}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-10 leading-relaxed">
              {records.length ? tr("Nothing matches that.") : <>{tr("Your Mind is empty.")}<br /><span className="text-xs">{tr("Keep a note, a link or a photo above — or share anything to Attune from another app.")}</span></>}
            </p>
          )}
        </>
      )}

      {openRec ? (
        <Detail rec={openRec} close={() => setOpenId(null)} update={update} forget={doForget} togglePin={togglePin} openRec={(r) => setOpenId(r.id)}
          search={search} scheduleReminder={scheduleReminder} flash={flash}
          findPromises={(r) => (pro ? findCommitments(r.text, r.id) : openPlan())}
          askAbout={(r) => { setOpenId(null); setQ(""); const qq = ar ? "إيه أهم حاجة في ده؟" : "What matters in this?"; if (pro) doAsk(qq, r); else openPlan(); }} />
      ) : null}
    </div>
  );
}
// a kind chip adds its word to the search, so the same parser does all the filtering
function kindWord(k) { return { note: "notes", link: "links", photo: "photos", quote: "quotes", product: "products", recipe: "recipes", todo: "tasks", contact: "contacts", place: "places", code: "code", answer: "answers" }[k] || ""; }
