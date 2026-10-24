/* ---- v6.8 Mind (replaces the Memory screen) ----------------------------------------------------
   Ali: "instead of memory, an app like mymind but much better". A private visual board of everything
   you keep; it files itself (mind.js). The two parts of the old Memory screen that are not "things
   you kept" — promises found in them, and Your words — are its other two tabs, unchanged.        */
import { mediaGet, clock } from "./mediastore.js";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Brain, Search, Sparkles, Link2, Star, Bell, Trash2, X, Plus, ClipboardPaste, Copy, ExternalLink, Share2, Loader2, Shuffle, Folder, ImagePlus, Send, Check, Camera, ChevronLeft } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as M from "./mind.js";
import { useSubBack } from "./backstack.js";
import { Md } from "./chat.jsx";
import { page, btnP, btnS, btnDanger, inp, area, label as kLabel, h1, chip as kChip } from "./ui-kit.jsx";
import { mindReport } from "./learning-report.js";   // v7.7 (Gemini's Area 5): the Mind Report
import { MindCalmTop, MindReport, SeeAll } from "./learning-report-ui.jsx";
import { useDesktopWide } from "./side-ui.jsx";

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
export async function thumbPut(id, url) { try { const d = await db(); await new Promise((ok) => { const t = d.transaction("thumbs", "readwrite"); t.objectStore("thumbs").put(url, id); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {} }
export async function thumbGet(id) { try { const d = await db(); return await new Promise((ok) => { const q = d.transaction("thumbs").objectStore("thumbs").get(id); q.onsuccess = () => ok(q.result || null); q.onerror = () => ok(null); }); } catch (e) { return null; } }
export async function thumbDel(id) { try { const d = await db(); const t = d.transaction("thumbs", "readwrite"); t.objectStore("thumbs").delete(id); t.objectStore("thumbs").delete(id + ":full"); } catch (e) {} }
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

/* ---- one card on the wall (v6.32 look A, Ali: "Mind page: A"): each kind looks like what it is — a photo or a link's
   preview on top, a small kind label, the title, one line under it. A photo's main colour is read once from its thumbnail. */
function Card({ rec, open, update }) {
  const kind = M.kindOf(rec);
  const thumb = useThumb(rec);
  const title = M.titleOf(rec);
  const tags = M.tagsOf(rec).slice(0, 2);
  const lp = kind === "link" ? M.linkParts(rec.text) : null;
  const body = String(rec.text || "");
  useEffect(() => {
    if (!thumb || !update || (rec.meta && rec.meta.colour)) return;
    const img = new Image();
    img.onload = () => { try { const c = document.createElement("canvas"); c.width = 16; c.height = 16; const x = c.getContext("2d"); x.drawImage(img, 0, 0, 16, 16);
      const col = M.mainColour(x.getImageData(0, 0, 16, 16).data); if (col) update(rec.id, (r) => ({ ...r, meta: { ...(r.meta || {}), colour: col } })); } catch (e) {} };
    img.src = thumb;
  }, [thumb]);
  const label = <p className={kLabel + " !text-[10px] mb-1"}>{kindLabel(kind).replace(/s$/, "")}</p>;
  const sub = (rec.meta && rec.meta.summary) || rec.output || "";
  const hue = lp ? M.siteHue(lp.site) : 0;
  return (
    <button onClick={() => open(rec)} data-testid="mind-card" data-kind={kind}
      className="mb-2.5 w-full break-inside-avoid text-start bg-[var(--c-surf)] border border-[var(--c-ln)] rounded-[22px] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:border-[var(--c-acc)] transition-colors duration-150">
      {thumb ? <img src={thumb} alt="" className="w-full block" />
        : lp ? <div className="h-20 flex items-end p-2.5" style={{ background: `linear-gradient(135deg, hsl(${hue} 35% 26%), hsl(${(hue + 40) % 360} 45% 42%))` }}>
            <span className="text-[22px] font-bold text-white/85 leading-none">{(lp.site || "?").replace(/^www\./, "").charAt(0).toUpperCase()}</span></div> : null}
      <div className="p-3.5">
        {kind === "quote" ? (
          <>{label}<p className="font-serif text-[15px] leading-relaxed text-[var(--c-ink)]" dir="auto">“{body.replace(/^\s*["“«]+|["”»]+\s*$/g, "").slice(0, 280)}”</p></>
        ) : kind === "link" && lp ? (
          <>
            <p className="text-[13.5px] font-extrabold text-[var(--c-ink)] line-clamp-3" dir="auto">{title && !/^https?:/.test(title) ? title : lp.path || lp.url}</p>
            <p className="text-[11.5px] text-[var(--c-mut)] mt-0.5 flex items-center gap-1"><Link2 size={11} /> {lp.site}</p>
          </>
        ) : kind === "product" ? (
          <>{label}
            <p className="text-[13.5px] font-extrabold text-[var(--c-ink)] line-clamp-3" dir="auto">{title}</p>
            {M.priceIn(body) ? <span className="inline-block mt-1.5 text-[11.5px] font-extrabold tabular-nums px-2.5 py-0.5 rounded-full bg-[var(--c-soft)] text-[var(--c-pos)] border border-[var(--c-pos)]/30" dir="ltr">{M.priceIn(body)}</span> : null}
          </>
        ) : kind === "todo" && rec.meta && rec.meta.todo ? (
          /* v6.48: a to-do added from Home ("add … to my to-do list") — tick it done here too */
          <>{label}<button onClick={(e) => { e.stopPropagation(); update(rec.id, (r) => ({ ...r, meta: { ...(r.meta || {}), done: !(r.meta && r.meta.done), doneAt: Date.now() } })); }} className="w-full flex items-center gap-2 text-start min-h-[40px]" data-testid="mind-todo-tick">
            <span className={"w-5 h-5 rounded-md shrink-0 grid place-items-center " + (rec.meta.done ? "bg-[var(--c-acc)]" : "border-2 border-[var(--c-acc)]")}>{rec.meta.done ? <Check size={13} className="text-[var(--c-on-acc)]" /> : null}</span>
            <span className={"text-[13.5px] " + (rec.meta.done ? "line-through text-[var(--c-mut)]" : "text-[var(--c-ink)]")} dir="auto">{rec.title || rec.text}</span></button></>
        ) : kind === "todo" ? (
          <>{label}<div className="space-y-1">
            {body.split("\n").filter((l) => l.trim()).slice(0, 5).map((l, i) => (
              <p key={i} className="text-[13px] text-[var(--c-ink)] flex gap-1.5" dir="auto"><span className="text-[var(--c-mut)]">☐</span>{l.replace(/^\s*(-\s*)?\[ ?[x ]?\]\s*|^\s*[-•☐☑]\s*/i, "")}</p>
            ))}
          </div></>
        ) : kind === "photo" && thumb ? (
          title && !/\.(png|jpe?g|webp|heic|gif)$/i.test(title) ? <p className="text-[13.5px] font-extrabold text-[var(--c-ink)] line-clamp-2" dir="auto">{title}</p> : null
        ) : (
          <>{label}
            {title ? <p className="text-[13.5px] font-extrabold text-[var(--c-ink)] line-clamp-3" dir="auto">{title}</p> : null}
            {(sub || body) && (sub || body).trim() !== title.trim() ? <p className="text-[12px] text-[var(--c-mut)] mt-1 line-clamp-3 whitespace-pre-line" dir="auto">{sub || body}</p> : null}
          </>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10.5px] font-semibold tabular-nums text-[var(--c-mut)]">{dateText(rec.ts)}</span>
          {rec.pinned ? <Star size={10} className="text-[var(--c-warn)]" /> : null}
          {rec.meta && rec.meta.colour && M.COLOURS[rec.meta.colour] ? <i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: M.COLOURS[rec.meta.colour].hex }} /> : null}
          {tags.map((t) => <span key={t} className="text-[10px] text-[var(--c-mut)]">#{t}</span>)}
        </div>
      </div>
    </button>
  );
}

/* ---- an open item ---- */
/* v6.48 (CHAT_RUNS_APP.md S8): a video or recording kept with /remember — it plays here, from the second Home's /find found
   ("attune:mind:seek"), and the words said in it are listed with their times (tap one to jump there). */
function MediaView({ rec }) {
  const m = rec.meta || {};
  const [url, setUrl] = useState(null);
  const el = useRef(null);
  const [seek] = useState(() => { try { const v = localStorage.getItem("attune:mind:seek"); localStorage.removeItem("attune:mind:seek"); return v ? +v : null; } catch (e) { return null; } });
  useEffect(() => { let on = true, u = null; mediaGet(rec.id).then((b) => { if (on && b) { u = URL.createObjectURL(b); setUrl(u); } }); return () => { on = false; if (u) URL.revokeObjectURL(u); }; }, [rec.id]);
  const go = (ms) => { const v = el.current; if (!v) return; try { v.currentTime = ms / 1000; v.play(); } catch (e) {} };
  const Tag = rec.kind === "video" ? "video" : "audio";
  return <div className="bg-black" data-testid="mind-media">
    {url ? <Tag ref={el} src={url} controls playsInline className="w-full max-h-80" onLoadedMetadata={() => { if (seek != null) go(seek); }} data-testid="mind-player" />
      : <p className="text-[12.5px] text-[var(--c-mut)] p-3 m-0">{m.noCopy ? tr("Only the words were kept — the file was too big to keep a copy.") : tr("The file is not on this phone.")}</p>}
    {(m.cues || []).length ? <div className="max-h-44 overflow-auto px-3 py-2 space-y-1 bg-[var(--c-bg)]" data-testid="mind-cues">
      {m.cues.map((c, i) => <button key={i} onClick={() => go(c.start)} className={"w-full text-start text-[12.5px] flex gap-2 " + (seek != null && c.start === seek ? "text-[var(--c-acc)]" : "text-[var(--c-ink)]")} data-testid="mind-cue">
        <span className="text-[var(--c-mut)] shrink-0 w-10" dir="ltr">{clock(c.start)}</span><span dir="auto">{c.text}</span></button>)}
    </div> : m.saidError ? <p className="text-[12px] text-[var(--c-warn)] px-3 py-2 m-0">{tr(m.saidError)}</p> : null}
  </div>;
}

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
      <div className="calm bg-[var(--c-surf)] text-[var(--c-ink)] border border-[var(--c-ln)] rounded-[22px] max-w-2xl w-full my-6 overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="mind-detail">
        {thumb ? <img src={thumb} alt={tr("Open the photo")} onClick={() => thumbGet(rec.id + ":full").then((u) => setBigUrl(u || thumb))} className="w-full max-h-80 object-contain bg-black cursor-zoom-in" data-testid="mind-photo" /> : null}
        {kind === "video" || kind === "audio" ? <MediaView rec={rec} /> : null}
        {bigUrl ? (
          <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center" onClick={() => setBigUrl(null)} data-testid="mind-photo-big">
            <img src={bigUrl} alt="" className="max-w-full max-h-full object-contain" />
            <button className="absolute top-3 end-3 w-11 h-11 grid place-items-center rounded-full bg-black/60 text-white" aria-label={tr("Close")}><X size={20} /></button>
          </div>
        ) : null}
        <div className="p-5">
          <div className="flex items-start gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] font-bold tabular-nums text-[var(--c-acc)]">{M.KINDS[kind].icon} {kindLabel(kind)} · {new Date(rec.ts).toLocaleString()}</p>
              {editTitle != null ? (
                <input autoFocus value={editTitle} onChange={(e) => setEditTitle(e.target.value)} dir="auto"
                  onBlur={() => { setMeta({ myTitle: editTitle.trim() || undefined }); setEditTitle(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className={inp + " mt-1 !text-base"} />
              ) : (
                <h3 onClick={() => setEditTitle(M.titleOf(rec))} className="text-[18px] font-extrabold tracking-tight text-[var(--c-ink)] mt-0.5 cursor-text" dir="auto" title={tr("Tap to rename")}>{M.titleOf(rec) || tr("Untitled")}</h3>
              )}
            </div>
            <button onClick={close} className="-m-2 w-11 h-11 grid place-items-center rounded-full text-[var(--c-mut)] hover:text-[var(--c-ink)]" aria-label={tr("Close")}><X size={18} /></button>
          </div>
          {m.summary ? <p className="text-sm text-[var(--c-ink)] mb-3 flex gap-1.5" dir="auto"><Sparkles size={13} className="text-[var(--c-acc)] mt-0.5 shrink-0" />{m.summary}</p> : null}
          {lp ? <a href={lp.url} target="_blank" rel="noreferrer" className="text-xs text-[var(--c-acc)] flex items-center gap-1 mb-3 break-all"><ExternalLink size={12} /> {lp.url}</a> : null}
          {rec.text && !(kind === "link" && rec.text.trim() === (lp && lp.url)) ? (
            <div className="bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[16px] p-3.5 mb-3 max-h-64 overflow-auto">
              {/\|.*\|/.test(rec.text) || /^#{1,4}\s|\*\*/m.test(rec.text) ? <div className="text-sm text-[var(--c-ink)] leading-relaxed"><Md text={rec.text} runnable={false} /></div>
                : <p className="text-sm text-[var(--c-ink)] whitespace-pre-wrap leading-relaxed" dir="auto">{rec.text}</p>}
            </div>
          ) : null}
          {rec.output ? (
            <>
              <p className={kLabel + " mb-1"}>{tr("What it answered")}</p>
              <div className="bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[16px] p-3.5 mb-3 max-h-64 overflow-auto">
                <div className="text-sm text-[var(--c-acc)] leading-relaxed"><Md text={rec.output} runnable={false} /></div>
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {M.tagsOf(rec).map((t) => (
              <span key={t} className="text-xs font-bold ps-2.5 rounded-full bg-[var(--c-surf-2)] text-[var(--c-ink)] flex items-center gap-0.5">#{t}
                <button onClick={() => dropTag(t)} className="w-8 h-8 grid place-items-center rounded-full text-[var(--c-mut)] hover:text-[var(--c-neg)]" aria-label={tr("Remove tag")}><X size={11} /></button></span>
            ))}
            <input value={tagIn} onChange={(e) => setTagIn(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTag(); }} placeholder={tr("+ tag")} dir="auto"
              data-testid="mind-tag-in" className="w-28 min-h-[36px] bg-transparent border-b border-[var(--c-ln)] text-[13px] text-[var(--c-ink)] px-1 py-0.5 focus:outline-none focus:border-[var(--c-acc)]" />
          </div>
          <textarea value={m.myNote || ""} onChange={(e) => setMeta({ myNote: e.target.value })} rows={2} dir="auto"
            placeholder={tr("Your note on this (why you kept it)…")}
            className={area + " mb-3 !text-[14px]"} />

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => togglePin(rec.id)} className={btnS + " hover:!border-[var(--c-warn)]"}>
              <Star size={12} className={`inline me-1 ${rec.pinned ? "text-[var(--c-warn)]" : ""}`} />{rec.pinned ? tr("Unpin") : tr("Pin")}</button>
            <button onClick={() => { try { navigator.clipboard.writeText([rec.text, rec.output].filter(Boolean).join("\n\n")); } catch (e) {} flash(tr("Copied")); }}
              className={btnS}><Copy size={12} className="inline me-1" />{tr("Copy")}</button>
            {navigator.share ? <button onClick={() => navigator.share({ title: M.titleOf(rec), text: rec.text }).catch(() => {})}
              className={btnS}><Share2 size={12} className="inline me-1" />{tr("Share")}</button> : null}
            <button onClick={() => askAbout(rec)} className={btnS}><Brain size={12} className="inline me-1" />{tr("Ask about this")}</button>
            <button onClick={() => findPromises(rec)} className={btnS}>{tr("Find promises in this")}</button>
            <button onClick={() => forget(rec.id)} data-testid="mind-forget"
              className={btnS + " !text-[var(--c-mut)] hover:!border-[var(--c-neg)] hover:!text-[var(--c-neg)] ms-auto"}><Trash2 size={12} className="inline me-1" />{tr("Forget")}</button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-[var(--c-ln)]">
            <Bell size={13} className="text-[var(--c-mut)]" />
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inp + " !w-auto !text-[13px]"} />
            <button disabled={!when} data-testid="mind-remind"
              onClick={() => { const at = new Date(when).getTime(); if (!(at > Date.now())) return flash(tr("Pick a time in the future")); scheduleReminder({ id: "m-" + rec.id, at, title: M.titleOf(rec) || tr("From your Mind"), body: (m.summary || rec.text || "").slice(0, 140), repeat: "none", created: Date.now(), source: "mind" }); setMeta({ remindAt: at }); flash(tr("I'll remind you")); }}
              className={btnP + " !h-11 !min-h-[44px] !text-[14px]"}>{tr("Remind me")}</button>
            {m.remindAt && m.remindAt > Date.now() ? <span className="text-[11.5px] font-bold tabular-nums text-[var(--c-acc)]">{tr("Reminder set")}: {new Date(m.remindAt).toLocaleString()}</span> : null}
          </div>
          {sim.length ? (
            <div className="mt-4">
              <p className={kLabel + " mb-1.5"}>{tr("Similar in your Mind")}</p>
              <div className="grid grid-cols-2 gap-2">
                {sim.map((r) => (
                  <button key={r.id} onClick={() => openRec(r)} className="text-start min-h-[56px] bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[16px] p-2.5 hover:border-[var(--c-acc)]">
                    <p className="text-[11px] text-[var(--c-mut)]">{M.KINDS[M.kindOf(r)].icon} {dateText(r.ts)}</p>
                    <p className="text-xs text-[var(--c-ink)] line-clamp-2" dir="auto">{M.titleOf(r)}</p>
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
// v6.15 look C: each space tile has its own calm colour (text stays ≥ 4.5:1 on it)
const loadSpaces = () => { try { const v = JSON.parse(localStorage.getItem(SPACES_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveSpaces = (v) => { try { localStorage.setItem(SPACES_KEY, JSON.stringify(v.slice(0, 30))); } catch (e) {} };

/**
 * The Mind screen.
 * records/remember/update/forget/togglePin: the app's memory store. search(q, n): its BM25 search.
 * llm(messages, image, o): the on-phone model. ask(question, found): "ask your memory" answer text.
 * promisesPanel / wordsPanel: the old Memory screen's other two parts, shown as tabs.
 */
export function MindPage({ records, remember, update, forget, togglePin, search, llm, modelReady, ask, findCommitments, scheduleReminder, pro, openPlan, openEngine, flash, promisesPanel, wordsPanel, promiseCount, shareBanner, note, external, clearExternal, commits = [], onPromiseDone = null, openRecall = null }) {
  const ar = getLang() === "ar";
  const [tab, setTab] = useState("mind");
  const wide = useDesktopWide();
  const [rep, setRep] = useState(false);   // v7.7: the Mind Report (phone); on a computer it sits beside the wall
  useSubBack(rep, () => setRep(false));
  const mrep = useMemo(() => mindReport(records, commits, Date.now()), [records, commits]);
  const [add, setAdd] = useState("");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState(null);
  const [kind, setKind] = useState(null);
  const [colour, setColour] = useState(null);
  // v6.48: Home's /find opens the item it found (cmdbox-ui → "attune:mind:open")
  const [openId, setOpenId] = useState(() => { try { const v = localStorage.getItem("attune:mind:open"); if (v) { localStorage.removeItem("attune:mind:open"); return v; } } catch (e) {} return null; });
  const [busy, setBusy] = useState("");
  const [answer, setAnswer] = useState(null);
  const [spaces, setSpaces] = useState(loadSpaces);
  const [filing, setFiling] = useState(null);
  const [dropping, setDropping] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hidePast, setHidePast] = useState(false);
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
  const filterOn = !!(kind || tag || colour || q.trim());
  const colours = useMemo(() => M.colourCounts(records), [records]);
  const shown = colour ? items.filter((r) => r.meta && r.meta.colour === colour) : items;
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

  const chip = (on) => kChip(on) + " shrink-0";

  return (
    <div className={page + " space-y-4 att-in pb-20"} data-testid="mind-page">
      <div className="flex items-center gap-2">
        <h2 className={h1 + " text-[var(--c-ink)] flex items-center gap-2"}><Brain size={20} className="text-[var(--c-acc)]" />{tr("Mind")}</h2>
        <span className="text-[11.5px] font-semibold tabular-nums text-[var(--c-mut)]">{records.length} {tr("kept · private, on this phone")}</span>
      </div>
      {shareBanner}
      {note}

      {/* v6.32 look A (the wall): search, then one row of chips — kinds, promises, your words, colours, spaces — then the wall */}
      {tab === "mind" ? (
        <div>
          <div className="flex items-center gap-2 min-h-[48px] bg-[var(--c-surf)] border border-[var(--c-ln)] rounded-[16px] ps-3.5 pe-1 focus-within:border-[var(--c-acc)] transition-colors duration-150">
            <Search size={15} className="text-[var(--c-mut)]" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setAnswer(null); }} dir="auto" data-testid="mind-search"
              onKeyDown={(e) => { if (e.key === "Enter" && looksLikeQuestion && pro) doAsk(q); }}
              placeholder={tr("Search or ask — “wedding photos last month”, «لينكات الشقة»")}
              className="flex-1 min-w-0 bg-transparent py-2.5 text-[15px] font-semibold text-[var(--c-ink)] placeholder:text-[var(--c-mut)] placeholder:font-normal focus:outline-none" />
            {q ? <button onClick={() => { setQ(""); setAnswer(null); }} className="w-11 h-11 grid place-items-center rounded-[14px] text-[var(--c-mut)]"><X size={16} /></button> : null}
          </div>
          {q.trim() ? (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button onClick={() => (pro ? doAsk(q) : openPlan())} data-testid="mind-ask" className={btnS + " !bg-[var(--c-soft)] !border-[var(--c-acc)]/40 !text-[var(--c-acc)]"}><Brain size={12} className="inline me-1" />{tr("Ask your Mind")}</button>
              <button onClick={saveSpace} className={btnS}><Folder size={12} className="inline me-1" />{tr("Save as a Space")}</button>
              {res.filters.kind || res.filters.from != null || res.filters.pinned ? (
                <span className="text-[11px] text-[var(--c-mut)]">{tr("Showing")}: {[res.filters.kind && kindLabel(res.filters.kind), res.filters.from != null && `${dateText(res.filters.from)} – ${dateText(Math.min(res.filters.to, Date.now()))}`, res.filters.pinned && tr("pinned"), res.filters.words && `“${res.filters.words}”`].filter(Boolean).join(" · ")}</span>
              ) : null}
            </div>
          ) : null}
        </div>) : null}

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]" data-testid="mind-spaces">
        <button onClick={() => { setTab("mind"); setKind(null); setTag(null); setColour(null); setQ(""); setAnswer(null); }} data-testid="mind-all" className={chip(tab === "mind" && !filterOn)}>{tr("All")}</button>
        {counts.map((c) => <button key={c.kind} onClick={() => { setTab("mind"); setKind(kind === c.kind ? null : c.kind); setTag(null); }} data-testid={"mind-kind-" + c.kind} className={chip(tab === "mind" && kind === c.kind)}>{kindLabel(c.kind)}</button>)}
        <button onClick={() => setTab("promises")} data-testid="mind-tab-promises" className={chip(tab === "promises")}>{tr("Promises")}{promiseCount ? ` (${promiseCount})` : ""}</button>
        <button onClick={() => setTab("words")} data-testid="mind-tab-words" className={chip(tab === "words")}>{tr("Your words")}</button>
        {colours.map((c) => <button key={c.colour} onClick={() => { setTab("mind"); setColour(colour === c.colour ? null : c.colour); }} data-testid={"mind-colour-" + c.colour} aria-label={M.COLOURS[c.colour][ar ? "ar" : "en"]}
          className={"shrink-0 w-10 h-10 rounded-full border-2 " + (colour === c.colour ? "border-[var(--c-acc)]" : "border-[var(--c-ln)]")} style={{ background: M.COLOURS[c.colour].hex }} />)}
        {spaces.map((sp) => <span key={sp.id} className="relative shrink-0"><button onClick={() => { setTab("mind"); setQ(sp.q || ""); setTag(sp.tag || null); setKind(null); }} className={chip(false) + " pe-6"} dir="auto"><Folder size={11} className="inline me-1" />{sp.name}</button>
          <button onClick={() => removeSpace(sp.id)} className="absolute top-1/2 -translate-y-1/2 end-0.5 w-8 h-8 grid place-items-center rounded-full text-[var(--c-mut)]" aria-label={tr("Remove")}><X size={12} /></button></span>)}
        {auto.map((t) => <button key={t.tag} onClick={() => { setTab("mind"); setTag(tag === t.tag ? null : t.tag); setKind(null); }} className={chip(tab === "mind" && tag === t.tag)} dir="auto">#{t.tag}</button>)}
      </div>

      {rep && !wide ? <MindReport rep={mrep} back={() => setRep(false)} open={(id) => { setRep(false); setOpenId(id); }} onDone={onPromiseDone} />
        : tab === "promises" ? promisesPanel : tab === "words" ? wordsPanel : (
        <>
          {/* keep anything — v6.15 (look C): a sheet from the + button */}
          {adding ? <div className="fixed inset-0 z-[60] bg-black/60 flex items-end" onClick={() => setAdding(false)}>
          <section onClick={(e) => e.stopPropagation()} className={`calm w-full bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[22px] border-t p-4 pb-6 space-y-2.5 ${dropping ? "border-[var(--c-acc)]" : "border-[var(--c-ln)]"}`} data-testid="mind-add-sheet"
            onDragOver={(e) => { e.preventDefault(); setDropping(true); }} onDragLeave={() => setDropping(false)}
            onDrop={async (e) => {
              e.preventDefault(); setDropping(false);
              const f = e.dataTransfer.files && e.dataTransfer.files[0];
              if (f && /^image\//.test(f.type)) return keepPhoto(f);
              if (f && (/^text|json|csv|md/.test(f.type) || /\.(txt|md|csv|json|log)$/i.test(f.name))) return keep(await f.text(), { title: f.name });
              const t = e.dataTransfer.getData("text"); if (t) keep(t);
            }}>
            <p className="text-[16px] font-extrabold text-[var(--c-ink)]">{tr("Keep something")}</p>
            <textarea autoFocus value={add} onChange={(e) => setAdd(e.target.value)} rows={3} dir="auto" data-testid="mind-add"
              placeholder={tr("Keep anything — a note, a link, a quote, a price, a number, an idea…")}
              className={area + " resize-none"} />
            <div className="flex items-center gap-1.5">
              <button onClick={() => { if (keep(add)) { setAdd(""); setAdding(false); } }} data-testid="mind-keep" className={btnP + " !h-11 !min-h-[44px] !text-[14px]"}><Plus size={15} />{tr("Keep")}</button>
              <button onClick={async () => { try { const t = await navigator.clipboard.readText(); if (t && t.trim()) setAdd(t.trim()); else flash(tr("Clipboard is empty")); } catch (e) { flash(tr("Allow clipboard access, or paste manually")); } }}
                className={btnS}><ClipboardPaste size={12} className="inline me-1" />{tr("Paste")}</button>
              <button onClick={() => fileRef.current && fileRef.current.click()} className={btnS}><Camera size={12} className="inline me-1" />{tr("Photo")}</button>
            </div>
          </section></div> : null}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="mind-photo" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; setAdding(false); keepPhoto(f); }} />
          {busy ? <p className="text-[11px] text-[var(--c-acc)] flex items-center gap-1"><Loader2 size={12} className="animate-spin" />{busy}</p>
            : filing ? <p className="text-[11px] text-[var(--c-mut)] flex items-center gap-1"><Sparkles size={11} />{tr("filing…")}</p> : null}
          <button onClick={() => setAdding(true)} aria-label={tr("Keep something")} data-testid="mind-new"
            className="fixed z-40 end-5 bottom-24 lg:bottom-8 lg:end-8 w-14 h-14 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] flex items-center justify-center shadow-xl shadow-black/40"><Plus size={26} /></button>

          {!pro && records.length ? (
            <p className="text-[11px] text-[var(--c-mut)]">
              {tr("Free: keep and search everything. Pro: it files each item by itself (title, summary, tags), reads your photos and answers questions from your Mind.")}
              <button onClick={openPlan} className="text-[var(--c-acc)] font-bold underline ms-1 min-h-[36px]">{tr("See Pro")}</button>
            </p>
          ) : null}

          {answer ? (
            <section className="bg-[var(--c-surf)] border border-[var(--c-acc)]/40 rounded-[22px] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)]" data-testid="mind-answer">
              <p className="text-[12px] font-bold text-[var(--c-acc)] mb-1.5 flex items-center gap-1"><Brain size={13} /> {answer.q}</p>
              {/\|.*\|/.test(answer.text) || /^#{1,4}\s|\*\*|^\s*[-*] /m.test(answer.text) ? <div className="text-sm text-[var(--c-ink)] leading-relaxed"><Md text={answer.text} runnable={false} /></div>
                : <p className="text-sm text-[var(--c-ink)] whitespace-pre-wrap leading-relaxed" dir="auto">{answer.text}</p>}
              {answer.sources.length ? (
                <>
                  <p className={kLabel + " mt-3 mb-1.5"}>{tr("From these items in your Mind")}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {answer.sources.map((r) => (
                      <button key={r.id} onClick={() => setOpenId(r.id)} className="shrink-0 w-40 min-h-[56px] text-start bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[16px] p-2.5 hover:border-[var(--c-acc)]">
                        <p className="text-[10px] text-[var(--c-mut)]">{M.KINDS[M.kindOf(r)].icon} {dateText(r.ts)}</p>
                        <p className="text-xs text-[var(--c-ink)] line-clamp-2" dir="auto">{M.titleOf(r)}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : <p className="text-[11px] text-[var(--c-mut)] mt-2">{tr("Nothing in your Mind matched — so this is not from your items.")}</p>}
            </section>
          ) : null}

          {filterOn ? <p className="text-[11.5px] font-semibold tabular-nums text-[var(--c-mut)]" data-testid="mind-count">{shown.length} {tr(shown.length === 1 ? "item" : "items")}</p> : null}

          {!filterOn && !answer ? <MindCalmTop rep={mrep} wide={wide} onDone={(id) => onPromiseDone && onPromiseDone(id)} openRecall={openRecall} /> : null}
          {!wide && !filterOn && records.length ? <SeeAll testid="mind-open-report" onClick={() => setRep(true)} title={tr("See all → Mind Report")} sub={T2("{w} kept this week · {d} promises due", { w: mrep.week, d: mrep.due })} cta={tr("Report")} /> : null}
          {/* the wall — v7.7: on a computer the Mind Report sits beside it */}
          <div className={wide && records.length ? "grid grid-cols-[minmax(0,1fr)_380px] gap-4 items-start" : ""}><div className="min-w-0">
          {shown.length ? (
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-2.5" data-testid="mind-board">
              {past.length && !hidePast && !filterOn ? (() => { const { rec, why } = past[0]; return (
                <div className="mb-2.5 break-inside-avoid rounded-[22px] p-3.5 border border-[var(--c-acc)]/40 bg-[var(--c-soft)]" data-testid="mind-past">
                  <button onClick={() => setOpenId(rec.id)} className="w-full text-start">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--c-acc)] flex items-center gap-1"><Shuffle size={10} /> {tr("From your past")}</p>
                    <p className="text-[13.5px] text-[var(--c-ink)] font-extrabold line-clamp-3 mt-1" dir="auto">{M.titleOf(rec)}</p>
                    <p className="text-[11px] text-[var(--c-mut)] mt-0.5">{/past/i.test(why) ? "" : tr(why) + " · "}{dateText(rec.ts)}</p>
                  </button>
                  <div className="flex gap-1.5 mt-2">
                    <button onClick={() => { if (!rec.pinned) togglePin(rec.id); setHidePast(true); flash(tr("Pinned")); }} className="min-h-[40px] text-[12.5px] font-bold px-3 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)]">{tr("Keep")}</button>
                    <button onClick={() => setHidePast(true)} className="min-h-[40px] text-[12.5px] font-bold px-3 rounded-[12px] text-[var(--c-mut)]">{tr("Not now")}</button>
                  </div>
                </div>); })() : null}
              {shown.map((r) => <Card key={r.id} rec={r} update={update} open={(x) => setOpenId(x.id)} />)}
            </div>
          ) : (
            <p className="text-sm font-semibold text-[var(--c-mut)] text-center py-10 px-4 leading-relaxed rounded-[22px] border border-dashed border-[var(--c-ln)]">
              {records.length ? tr("Nothing matches that.") : <>{tr("Your Mind is empty.")}<br /><span className="text-xs">{tr("Keep a note, a link or a photo with + — or share anything to Attune from another app.")}</span></>}
            </p>
          )}
          </div>{wide && records.length ? <div className={"calm rounded-[22px] border border-[var(--c-acc)]/50 bg-[var(--c-surf-2)] p-3"}><MindReport compact rep={mrep} open={(id) => setOpenId(id)} onDone={onPromiseDone} /></div> : null}</div>
        </>
      )}

      {openRec ? (
        <Detail rec={openRec} close={() => setOpenId(null)} update={update} forget={doForget} togglePin={togglePin} openRec={(r) => setOpenId(r.id)}
          search={search} scheduleReminder={scheduleReminder} flash={flash}
          findPromises={(r) => (pro ? findCommitments(r.text, r.id) : openPlan())}
          askAbout={(r) => { setOpenId(null); setQ(""); const qq = ar ? "ما أهم شيء في هذا؟" : "What matters in this?"; if (pro) doAsk(qq, r); else openPlan(); }} />
      ) : null}
    </div>
  );
}
const T2 = (k, v) => tr(k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, "\u2066" + b + "\u2069"])));
// a kind chip adds its word to the search, so the same parser does all the filtering
function kindWord(k) { return { note: "notes", link: "links", photo: "photos", quote: "quotes", product: "products", recipe: "recipes", todo: "tasks", contact: "contacts", place: "places", code: "code", answer: "answers" }[k] || ""; }
