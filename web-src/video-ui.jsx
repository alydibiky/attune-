/* ---- More → Video Downloader (v5.38) -------------------------------------------------------------
   Paste (or share to Attune) a link → Attune lists the versions (1080p, 720p… audio only) → the one
   you pick is saved by Android's DownloadManager to Movies/Attune. Sites that allow downloading only
   (see video.js); YouTube / TikTok / Instagram / Facebook / X links get a clear "not allowed". */
import React, { useState, useEffect, useRef } from "react";
import { Download, Loader2, X, Check, ClipboardPaste, Play, Film, Music, Link2 } from "lucide-react";
import { tr } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import * as V from "./video.js";

const KEY = "attune:video:v1";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
const store = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 30))); } catch (e) {} };

export function VideoDownloader({ nativeCall, flash, pro, openPlan, initialLink }) {
  const [link, setLink] = useState(initialLink || "");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [found, setFound] = useSticky("video:found", null);      // { title, choices, source }
  const [sel, setSel] = useSticky("video:sel", 0);
  const [list, setList] = useState(load);         // [{id, name, where, status, done, total, audio}]
  const run = useRef(0);
  useSubBack(!!found, () => setFound(null));

  // progress of the downloads still running
  useEffect(() => {
    const active = list.filter((d) => !["done", "failed"].includes(d.status)).map((d) => d.id);
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
    const today = new Date().toISOString().slice(0, 10);
    let used = 0; try { used = JSON.parse(localStorage.getItem("attune:video:day") || "{}")[today] || 0; } catch (e) {}
    if (!pro && used >= 3) { flash && flash(tr("Free includes 3 video downloads a day — Pro is unlimited")); openPlan && openPlan(); return; }
    try {
      const name = V.fileName(found.title, c);
      const r = await nativeCall("videoDownload", { url: c.url, name, audio: !!c.audio, title: found.title });
      const d = { id: r.id, name: r.name || name, where: r.where, status: "pending", done: 0, total: c.size || 0, audio: !!c.audio, q: V.qualityText(c) };
      setList((l) => { const n = [d, ...l]; store(n); return n; });
      try { const u = JSON.parse(localStorage.getItem("attune:video:day") || "{}"); localStorage.setItem("attune:video:day", JSON.stringify({ [today]: (u[today] || 0) + 1 })); } catch (e) {}
      flash && flash(tr("Downloading — you can close Attune, it keeps going"));
      setFound(null); setLink("");
    } catch (e) { setErr(tr(String((e && e.message) || e))); }
  };

  const remove = async (d) => {
    if (!["done", "failed"].includes(d.status)) try { await nativeCall("videoCancel", { id: d.id }); } catch (e) {}
    setList((l) => { const n = l.filter((x) => x.id !== d.id); store(n); return n; });
  };

  const chip = (on) => `w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-start ${on ? "border-teal-600 bg-teal-500/10" : "border-slate-700"}`;
  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="video">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Film size={19} className="text-teal-300" />{tr("Video Downloader")}</h2>
        <p className="text-[12.5px] text-slate-400 leading-relaxed mt-1">{tr("Copy a video's link, paste it here, pick the quality — it's saved to your phone's Movies folder. Works with direct video links, Google Drive, Dropbox, archive.org, Wikimedia Commons and pages that show a plain video.")}</p>
      </div>

      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3">
            <Link2 size={15} className="text-slate-500 shrink-0" />
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") find(); }} dir="ltr" placeholder="https://…" className="flex-1 min-w-0 bg-transparent py-2.5 text-[13px] text-slate-100 outline-none" data-testid="video-link" />
            {link ? <button onClick={() => { setLink(""); setFound(null); setErr(""); }} aria-label={tr("Clear")} className="p-1 text-slate-500"><X size={14} /></button> : null}
          </div>
          <button onClick={paste} className="shrink-0 whitespace-nowrap px-3 rounded-xl border border-slate-700 text-slate-200 flex items-center gap-1.5 text-[13px]" data-testid="video-paste"><ClipboardPaste size={15} />{tr("Paste")}</button>
        </div>
        {busy ? <p className="flex items-center gap-2 text-[12.5px] text-teal-200" data-testid="video-busy"><Loader2 size={14} className="animate-spin" />{busy}</p>
          : !found ? <button onClick={() => find()} disabled={!link.trim()} className="w-full py-2.5 rounded-xl bg-teal-500 disabled:opacity-40 text-slate-950 font-semibold text-sm" data-testid="video-find">{tr("Find the video")}</button> : null}
        {err ? <p className="text-[12.5px] text-rose-300 leading-relaxed" data-testid="video-error">{err}</p> : null}
      </section>

      {found ? (
        <section className="bg-slate-900 rounded-2xl border border-teal-900/60 p-4 space-y-3" data-testid="video-found">
          <div><p className="text-[14px] text-slate-100 font-medium" dir="auto" data-testid="video-title">{found.title}</p><p className="text-[11.5px] text-slate-500">{found.source}</p></div>
          <p className="text-[12px] text-slate-400">{tr("Choose the quality")}</p>
          <div className="space-y-1.5">
            {found.choices.map((c, i) => (
              <button key={c.url + i} onClick={() => setSel(i)} className={chip(sel === i)} data-testid={"video-q-" + i}>
                <span className="flex items-center gap-2 text-[13.5px] text-slate-100">{c.audio ? <Music size={14} className="text-amber-300" /> : <Film size={14} className="text-teal-300" />}{tr(V.qualityText(c))}<span className="text-[11px] text-slate-500 uppercase">{c.ext}</span></span>
                <span className="text-[12px] text-slate-400">{V.sizeText(c.size)}{sel === i ? <Check size={14} className="inline ms-1.5 text-teal-300" /> : null}</span>
              </button>
            ))}
          </div>
          <button onClick={start} className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2" data-testid="video-download"><Download size={16} />{tr("Download")}</button>
          <p className="text-[11px] text-slate-500">{tr("Only download videos you have the right to keep.")}</p>
        </section>
      ) : null}

      {list.length ? (
        <section className="space-y-2" data-testid="video-list">
          <p className="text-[12px] text-slate-400 px-1">{tr("Downloads")}</p>
          {list.map((d) => {
            const pct = d.total ? Math.min(100, Math.round((d.done / d.total) * 100)) : 0;
            return (
              <div key={d.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3 space-y-2" data-testid="video-item">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] text-slate-100 truncate" dir="auto">{d.name}</p>
                  <button onClick={() => remove(d)} aria-label={tr("Remove")} className="p-1 text-slate-500 shrink-0"><X size={14} /></button>
                </div>
                {d.status === "done" ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-emerald-300 flex items-center gap-1"><Check size={13} />{tr("Saved")} · {V.sizeText(d.total)}</span>
                    <button onClick={() => nativeCall("videoOpen", { id: d.id }).catch(() => flash && flash(tr("The file was moved or deleted")))} className="px-3 py-1.5 rounded-lg bg-teal-500 text-slate-950 text-[12.5px] font-semibold flex items-center gap-1" data-testid="video-open"><Play size={13} />{tr("Play")}</button>
                  </div>
                ) : d.status === "failed" ? (
                  <p className="text-[11.5px] text-rose-300">{tr("The download failed — the link may have expired. Find it again and retry.")}</p>
                ) : (
                  <>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-teal-400 transition-all" style={{ width: (pct || 3) + "%" }} /></div>
                    <p className="text-[11px] text-slate-500" data-testid="video-progress">{d.status === "paused" ? tr("Waiting for the internet…") : d.total ? `${pct}% · ${V.sizeText(d.done)} / ${V.sizeText(d.total)}` : tr("Starting…")}</p>
                  </>
                )}
                {d.where ? <p className="text-[10.5px] text-slate-600 truncate" dir="ltr">{d.where}</p> : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
