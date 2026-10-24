/* ---- More → Video Downloader (v5.38) -------------------------------------------------------------
   Paste (or share to Attune) a link → Attune lists the versions (1080p, 720p… audio only) → the one
   you pick is saved by Android's DownloadManager to Movies/Attune. Sites that allow downloading only
   (see video.js); YouTube / TikTok / Instagram / Facebook / X links get a clear "not allowed". */
import React, { useState, useEffect, useRef } from "react";
import { logTool } from "./toollog.js";
import { Download, Loader2, X, Check, ClipboardPaste, Play, Film, Music, Link2, Scissors, Captions } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import * as V from "./video.js";
import * as K from "./ui-kit.jsx";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

const KEY = "attune:video:v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
/** v6.37 (W6): cut a part of a saved video, or keep its sound only — copied as-is on the phone (MediaTools.clip). */
function ClipPanel({ d, nativeCall, flash, onMade }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [audio, setAudio] = useState(false);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const go = async () => {
    const r = V.clipRange(from, to); if (r.error) return setErr(tr(r.error));
    setErr(""); setBusy(true);
    try {
      const x = await nativeCall("videoClip", { id: d.id, start: r.start, end: r.end, audio, name: String(d.name || "clip").replace(/\.[a-z0-9]{2,4}$/i, "") });
      onMade({ id: "clip-" + Date.now(), clip: true, uri: x.uri, type: x.type, name: x.name, where: x.where, status: "done", done: x.size, total: x.size, audio });
      flash && flash(tr("Saved to {w}", { w: x.where }));
    } catch (e) { setErr(tr(String((e && e.message) || e))); }
    setBusy(false);
  };
  const box = "w-24 min-h-[44px] bg-[var(--c-surf)] border border-[var(--c-ln)] rounded-[14px] px-2.5 text-[13.5px] font-semibold text-[var(--c-ink)] tabular-nums focus:outline-none focus:border-[var(--c-acc)]";
  return (
    <div className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 space-y-2" data-testid="video-clip">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--c-mut)]">
        <span>{tr("From")}</span><input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="0:00" dir="ltr" inputMode="decimal" className={box} data-testid="video-clip-from" />
        <span>{tr("to")}</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder={tr("the end")} dir="ltr" inputMode="decimal" className={box} data-testid="video-clip-to" />
      </div>
      <label className="flex items-center gap-2 text-[12px] text-[var(--c-ink)]"><input type="checkbox" checked={audio} onChange={(e) => setAudio(e.target.checked)} data-testid="video-clip-audio" />{tr("Sound only (saves to Music)")}</label>
      <button onClick={go} disabled={busy} className="w-full py-2 rounded-[16px] bg-[var(--c-acc)] disabled:opacity-60 text-[var(--c-on-acc)] text-[13px] font-extrabold flex items-center justify-center gap-1.5 min-h-[44px]" data-testid="video-clip-go">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}{audio ? tr("Save the sound") : tr("Save this part")}</button>
      <p className="text-[10.5px] text-[var(--c-mut)]">{tr("Copied as it is, no re-encoding: quick and cool. The part starts at the nearest key frame, so it may begin a second early.")}</p>
      {err ? <p className="text-[11.5px] text-[var(--c-neg)]" data-testid="video-clip-err">{err}</p> : null}
    </div>);
}

/** v6.45 (W6): subtitles for a saved video — the phone's own offline speech recogniser listens piece by piece
 *  (Subtitles.kt), then the pieces become an .srt file (video.js cuesOf / srtOf). The sound never leaves the phone. */
function SubsPanel({ d, nativeCall, flash }) {
  const [lang, setLang] = useState(getLang() === "ar" ? "ar" : "en"), [busy, setBusy] = useState(null), [err, setErr] = useState(""), [srt, setSrt] = useState("");
  const go = async () => {
    setErr(""); setSrt(""); setBusy("0 %");
    try {
      const r = await nativeCall("videoSubtitles", { id: d.id, lang: V.speechLang(lang) }, (pct) => setBusy(pct + " %"));
      const cues = V.cuesOf(r.cues || []);
      if (!cues.length) throw new Error(tr("No speech was heard in this video"));
      const text = V.srtOf(cues), name = String(d.name || "video").replace(/\.[a-z0-9]{2,4}$/i, "") + "." + lang + ".srt";
      setSrt(text);
      const s = await nativeCall("saveFile", { name, text, mime: "application/x-subrip" });
      flash && flash(tr("Saved {f}", { f: (s && s.name) || name }));
    } catch (e) { const m = String((e && e.message) || e); if (m !== "Cancelled") setErr(tr(m)); }
    setBusy(null);
  };
  return (
    <div className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 space-y-2" data-testid="video-subs">
      <div className="flex items-center gap-2 text-[12px] text-[var(--c-ink)]">{tr("Spoken in")}
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="min-h-[44px] bg-[var(--c-surf)] border border-[var(--c-ln)] rounded-[14px] px-2.5 text-[13px] font-semibold focus:outline-none focus:border-[var(--c-acc)] placeholder:text-[var(--c-mut)]" data-testid="video-subs-lang">
          <option value="ar">{tr("Arabic (Egypt)")}</option><option value="en">{tr("English")}</option><option value="fr">{tr("French")}</option><option value="es">{tr("Spanish")}</option><option value="tr">{tr("Turkish")}</option></select></div>
      <button onClick={go} disabled={!!busy} className="w-full py-2 rounded-[16px] bg-[var(--c-acc)] disabled:opacity-60 text-[var(--c-on-acc)] text-[13px] font-extrabold flex items-center justify-center gap-1.5 min-h-[44px]" data-testid="video-subs-go">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Captions size={14} />}{busy ? tr("Listening… {p}", { p: busy }) : tr("Make subtitles (.srt)")}</button>
      <p className="text-[10.5px] text-[var(--c-mut)]">{tr("Your phone's own offline speech recogniser listens to the video, piece by piece — the sound never leaves the phone. About as long as the video.")}</p>
      {srt ? <pre className="text-[11px] text-[var(--c-ink)] max-h-40 overflow-y-auto whitespace-pre-wrap" dir="auto" data-testid="video-subs-text">{srt.slice(0, 1500)}</pre> : null}
      {err ? <p className="text-[11.5px] text-[var(--c-neg)]" data-testid="video-subs-err">{err}</p> : null}
    </div>);
}

const store = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))); } catch (e) {} };

export function VideoDownloader({ nativeCall, flash, pro, openPlan, initialLink, subsForFile = null }) {
  // v6.48 (Ali: "how can I access video subtitles?"): subtitles for ANY video or recording on the phone, not only downloaded ones —
  // a job (jobs.js "subtitles"); the .srt shows on Home with Save
  const anyRef = useRef(null);
  const [link, setLink] = useState(initialLink || "");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [found, setFound] = useSticky("video:found", null);      // { title, choices, source }
  const [sel, setSel] = useSticky("video:sel", 0);
  const [list, setList] = useState(load);         // [{id, name, where, status, done, total, audio}] (+ clip, uri, type for cuts)
  const [cut, setCut] = useState(null);           // the download whose Cut panel is open
  const [subs, setSubs] = useState(null);         // v6.45: the download whose Subtitles panel is open
  const canSubs = (() => { try { return !!(window.AttuneNative && window.AttuneNative.subtitlesAvailable && window.AttuneNative.subtitlesAvailable()); } catch (e) { return false; } })();
  const run = useRef(0);
  useSubBack(!!found, () => setFound(null));

  // progress of the downloads still running
  useEffect(() => {
    const active = list.filter((d) => !d.clip && !["done", "failed"].includes(d.status)).map((d) => d.id);
    if (!active.length || !nativeCall) return;
    const t = setInterval(async () => {
      try {
        const r = await nativeCall("videoStatus", { ids: active });
        setList((l) => { const n = l.map((d) => { const s = (r.items || []).find((x) => x.id === d.id); return s ? { ...d, ...s } : d; }); store(n); return n; });
      } catch (e) {}
    }, 1000);
    return () => clearInterval(t);
  }, [list.map((d) => d.id + d.status).join(","), !!nativeCall]);

  useEffect(() => { if (initialLink) { setLink(initialLink); find(initialLink); } }, [initialLink]);

  const paste = async () => {
    try { const r = await nativeCall("clipboardText", {}); if (r.text) { setLink(r.text); find(r.text); } else flash && flash(tr("The clipboard is empty — copy the video's link first")); }
    catch (e) { flash && flash(tr("Long-press the box and choose Paste")); }
  };

  const find = async (raw) => {
    const c = V.classify(raw != null ? raw : link);
    setErr(""); setFound(null); setSel(0);
    if (c.kind === "bad") { setErr(tr("That isn't a link. Copy the video's link (it starts with https://) and paste it here.")); return; }
    if (c.kind === "blocked") { setErr(tr("{site} doesn't allow its videos to be downloaded, so Attune can't save them (Google Play removes apps that do). Links that work: direct video links, Google Drive, Dropbox, archive.org, Wikimedia Commons, and pages that show a plain video file.", { site: tr(c.site) })); return; }
    if (c.kind === "stream") { setErr(tr("That's a live-stream link (.m3u8) — it's streamed in pieces and can't be saved as one file.")); return; }
    if (!nativeCall) { setErr(tr("Downloading works in the Android app.")); return; }
    const id = ++run.current, alive = () => run.current === id;
    setBusy(tr("Looking for the video…"));
    try {
      let choices = [], title = "", source = "";
      if (c.kind === "archive") {
        const r = await nativeCall("videoGet", { url: "https://archive.org/metadata/" + encodeURIComponent(c.id) });
        choices = V.archiveChoices(JSON.parse(r.text || "{}"), c.id); title = choices.title; source = "archive.org";
      } else if (c.kind === "commons") {
        const r = await nativeCall("videoGet", { url: V.commonsApi(c.title) });
        choices = V.commonsChoices(JSON.parse(r.text || "{}")); title = choices.title; source = "Wikimedia Commons";
      } else {
        let url = c.kind === "drive" ? V.driveUrl(c.id) : c.url;
        let p = await nativeCall("videoProbe", { url });
        if (c.kind === "drive" && /html/.test(p.type)) {
          const page = await nativeCall("videoGet", { url });
          const next = V.driveConfirm(page.text, page.url);
          if (!next) throw new Error(tr("Google Drive didn't give the file — make sure it's shared as \"Anyone with the link\"."));
          url = next; p = await nativeCall("videoProbe", { url });
        }
        if (/^(video|audio)\//.test(p.type) || (c.kind !== "page" && /octet-stream/.test(p.type))) {
          const name = p.name || decodeURIComponent(p.url.split(/[?#]/)[0].split("/").pop() || "");
          choices = [{ url: p.url, height: V.heightOf(name), ext: (name.match(/\.([a-z0-9]{2,4})$/i) || [])[1] || (p.type.split("/")[1] || "mp4").replace("quicktime", "mov").replace("mpeg", "mp3"), audio: /^audio\//.test(p.type) || /\.(mp3|m4a|ogg|opus|wav|flac)$/i.test(name), size: p.size, label: "" }];
          title = name.replace(/\.[a-z0-9]{2,4}$/i, ""); source = V.classify(p.url).kind === "direct" ? new URL(p.url).hostname.replace(/^www\./, "") : c.kind;
        } else if (c.kind === "page") {
          const page = await nativeCall("videoGet", { url });
          const pc = V.pageChoices(page.text, page.url);
          const emb = (page.text.match(/<iframe[^>]+src="([^"]+)"/gi) || []).map((x) => V.classify(x.match(/src="([^"]+)"/i)[1])).find((k) => k.kind === "blocked");
          if (!pc.length) {
            if (emb) throw new Error(tr("This page plays a {site} video, which can't be downloaded.", { site: tr(emb.site) }));
            if (pc.hls) throw new Error(tr("This page streams its video in pieces (HLS), which can't be saved as one file."));
            throw new Error(tr("No downloadable video was found on that page."));
          }
          choices = pc; title = pc.title; source = new URL(page.url).hostname.replace(/^www\./, "");
          // sizes of the first few versions
          await Promise.all(choices.slice(0, 6).map(async (x) => { if (!x.size) try { const q = await nativeCall("videoProbe", { url: x.url }); x.size = q.size; } catch (e) {} }));
        } else throw new Error(tr("That link didn't give a video file (the site sent {t}).", { t: p.type || "?" }));
      }
      if (!alive()) return;
      choices = V.sortChoices(choices);
      if (!choices.length) throw new Error(tr("No downloadable video was found there."));
      setFound({ title: title || "video", choices, source });
    } catch (e) { if (alive()) setErr(tr(String((e && e.message) || e))); }
    finally { if (alive()) setBusy(null); }
  };

  const start = async () => {
    const c = found && found.choices[sel];
    if (!c) return;
    // v6.32 (Ali, Play policy option A): video downloads are not sold — no daily limit, not on the Pro list or the store text
    try {
      const name = V.fileName(found.title, c);
      const r = await nativeCall("videoDownload", { url: c.url, name, audio: !!c.audio, title: found.title });
      const d = { id: r.id, name: r.name || name, where: r.where, status: "pending", done: 0, total: c.size || 0, audio: !!c.audio, q: V.qualityText(c) };
      setList((l) => { const n = [d, ...l]; store(n); return n; });
      flash && flash(tr("Downloading — you can close Attune, it keeps going"));
      try { logTool({ mode: "video", title: String(found.title || d.name).slice(0, 70), kind: c.audio ? "audio" : d.q, mb: c.size ? Math.round((c.size / 1048576) * 10) / 10 : 0 }); } catch (e) {}   // v7.8 the Tools report
      setFound(null); setLink("");
    } catch (e) { setErr(tr(String((e && e.message) || e))); }
  };

  const remove = async (d) => {
    if (!["done", "failed"].includes(d.status)) try { await nativeCall("videoCancel", { id: d.id }); } catch (e) {}
    setList((l) => { const n = l.filter((x) => x.id !== d.id); store(n); return n; });
  };

  const chip = (on) => `w-full min-h-[48px] flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-[16px] border text-start transition-colors duration-150 ${on ? "border-[var(--c-acc-2)] bg-[var(--c-surf-2)]" : "border-[var(--c-ln)]"}`;
  return (
    <div className="calm text-[var(--c-ink)] space-y-4 max-w-2xl mx-auto" data-testid="video">
      <div className="px-1">
        <h2 className={K.h1 + " flex items-center gap-2"}><Film size={19} className="text-[var(--c-acc)]" />{tr("Video Downloader")}</h2>
        <p data-intro="" className="text-[12.5px] text-[var(--c-mut)] leading-relaxed mt-1 lg:max-w-[75ch]">{tr("Copy a video's link, paste it here, pick the quality — it's saved to your phone's Movies folder. Works with direct video links, Google Drive, Dropbox, archive.org, Wikimedia Commons and pages that show a plain video.")}</p>
      </div>

      {/* v6.27 computer layout (option A): the link on the left; the versions found and the downloads on the right */}
      <div className={PANES}><div className={LEFT}>
      {subsForFile ? <section className="bg-[var(--c-surf)] rounded-[22px] border border-[var(--c-ln)] p-3 mb-3 flex items-center gap-3" data-testid="video-subs-any">
        <Captions size={18} className="text-[var(--c-acc)] shrink-0" />
        <span className="flex-1 min-w-0"><b className="block text-[13.5px] text-[var(--c-ink)]">{tr("Subtitles for a video on this phone")}</b>
          <span className="block text-[12px] text-[var(--c-mut)]">{tr("Any video or recording → an .srt file. Or type /subtitles on Home.")}</span></span>
        <button onClick={() => anyRef.current && anyRef.current.click()} className={K.btnP + " shrink-0 !h-11 !min-h-[44px] !px-4 !text-[13.5px]"} data-testid="video-subs-pick">{tr("Choose")}</button>
        <input ref={anyRef} type="file" accept="video/*,audio/*" className="hidden" data-testid="video-subs-file" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) subsForFile(f); }} />
      </section> : null}
      <section className="bg-[var(--c-surf)] rounded-[22px] border border-[var(--c-ln)] p-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 min-h-[44px] flex items-center gap-2 bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-[14px] px-3 focus-within:border-[var(--c-acc)] transition-colors duration-150">
            <Link2 size={15} className="text-[var(--c-mut)] shrink-0" />
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") find(); }} dir="ltr" placeholder="https://…" className="flex-1 min-w-0 bg-transparent py-2.5 text-[13px] text-[var(--c-ink)] outline-none" data-testid="video-link" />
            {link ? <button onClick={() => { setLink(""); setFound(null); setErr(""); }} aria-label={tr("Clear")} className="w-9 h-9 grid place-items-center text-[var(--c-mut)]"><X size={14} /></button> : null}
          </div>
          <button onClick={paste} className={K.btnS + " shrink-0 whitespace-nowrap"} data-testid="video-paste"><ClipboardPaste size={15} />{tr("Paste")}</button>
        </div>
        {busy ? <p className="flex items-center gap-2 text-[12.5px] text-[var(--c-acc)]" data-testid="video-busy"><Loader2 size={14} className="animate-spin" />{busy}</p>
          : !found ? <button onClick={() => find()} disabled={!link.trim()} className={K.btnP + " w-full"} data-testid="video-find">{tr("Find the video")}</button> : null}
        {err ? <p className="text-[12.5px] text-[var(--c-neg)] leading-relaxed" data-testid="video-error">{err}</p> : null}
      </section>
      </div><div className={RIGHT + (found || list.length ? "" : " hidden lg:block")}>
      {!found && !list.length ? <DeskEmpty icon={Film} title={tr("The video's versions appear here")} text={tr("Paste a link and tap Find the video — then pick the quality to download.")} /> : null}

      {found ? (
        <section className={K.cardPad + " space-y-3 !border-[var(--c-acc)]/50"} data-testid="video-found">
          <div><p className="text-[15px] text-[var(--c-ink)] font-extrabold" dir="auto" data-testid="video-title">{found.title}</p><p className="text-[11.5px] text-[var(--c-mut)]">{found.source}</p></div>
          <p className={K.label}>{tr("Choose the quality")}</p>
          <div className="space-y-1.5">
            {found.choices.map((c, i) => (
              <button key={c.url + i} onClick={() => setSel(i)} className={chip(sel === i)} data-testid={"video-q-" + i}>
                <span className="flex items-center gap-2 text-[13.5px] text-[var(--c-ink)]">{c.audio ? <Music size={14} className="text-[var(--c-warn)]" /> : <Film size={14} className="text-[var(--c-acc)]" />}{tr(V.qualityText(c))}<span className="text-[11px] text-[var(--c-mut)] uppercase">{c.ext}</span></span>
                <span className="text-[12px] text-[var(--c-mut)]">{V.sizeText(c.size)}{sel === i ? <Check size={14} className="inline ms-1.5 text-[var(--c-acc)]" /> : null}</span>
              </button>
            ))}
          </div>
          <button onClick={start} className={K.btnP + " w-full"} data-testid="video-download"><Download size={16} />{tr("Download")}</button>
          <p className="text-[11px] text-[var(--c-mut)]">{tr("Only download videos you have the right to keep.")}</p>
        </section>
      ) : null}

      {list.length ? (
        <section className="space-y-2" data-testid="video-list">
          <p className={K.label + " px-1"}>{tr("Downloads")}</p>
          {list.map((d) => {
            const pct = d.total ? Math.min(100, Math.round((d.done / d.total) * 100)) : 0;
            return (
              <div key={d.id} className={K.card + " p-3.5 space-y-2"} data-testid="video-item">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-extrabold text-[var(--c-ink)] truncate" dir="auto">{d.name}</p>
                  <button onClick={() => remove(d)} aria-label={tr("Remove")} className="w-10 h-10 -m-1 grid place-items-center rounded-[12px] text-[var(--c-mut)] shrink-0"><X size={14} /></button>
                </div>
                {d.status === "done" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-[var(--c-pos)] flex items-center gap-1"><Check size={13} />{tr("Saved")} · {V.sizeText(d.total)}</span>
                    <span className="flex items-center gap-1.5">
                      {!d.clip && !d.audio && nativeCall && canSubs ? <button onClick={() => setSubs(subs === d.id ? null : d.id)} className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] text-[var(--c-ink)] text-[12.5px] font-bold flex items-center gap-1" data-testid="video-subs-open"><Captions size={13} />{tr("Subtitles")}</button> : null}
                      {!d.clip && nativeCall ? <button onClick={() => setCut(cut === d.id ? null : d.id)} className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] text-[var(--c-ink)] text-[12.5px] font-bold flex items-center gap-1" data-testid="video-cut"><Scissors size={13} />{tr("Cut")}</button> : null}
                      <button onClick={() => nativeCall("videoOpen", d.clip ? { uri: d.uri, type: d.type } : { id: d.id }).catch(() => flash && flash(tr("The file was moved or deleted")))} className="px-3 py-1.5 rounded-[16px] bg-[var(--c-acc)] text-[var(--c-on-acc)] text-[12.5px] font-extrabold flex items-center gap-1 min-h-[44px]" data-testid="video-open"><Play size={13} />{tr("Play")}</button>
                    </span>
                  </div>
                ) : d.status === "failed" ? (
                  <p className="text-[11.5px] text-[var(--c-neg)]">{tr("The download failed — the link may have expired. Find it again and retry.")}</p>
                ) : (
                  <>
                    <div className="h-1.5 bg-[var(--c-surf-2)] rounded-full overflow-hidden"><div className="h-full bg-[var(--c-acc)] transition-all" style={{ width: (pct || 3) + "%" }} /></div>
                    <p className="text-[11px] text-[var(--c-mut)]" data-testid="video-progress">{d.status === "paused" ? tr("Waiting for the internet…") : d.total ? `${pct}% · ${V.sizeText(d.done)} / ${V.sizeText(d.total)}` : tr("Starting…")}</p>
                  </>
                )}
                {cut === d.id && d.status === "done" ? <ClipPanel d={d} nativeCall={nativeCall} flash={flash} onMade={(c) => { setCut(null); setList((l) => { const n = [c, ...l]; store(n); return n; }); }} /> : null}
                {subs === d.id && d.status === "done" ? <SubsPanel d={d} nativeCall={nativeCall} flash={flash} /> : null}
                {d.where ? <p className="text-[10.5px] text-[var(--c-mut)] truncate" dir="ltr">{d.where}</p> : null}
              </div>
            );
          })}
        </section>
      ) : null}
      </div></div>
    </div>
  );
}
