/* ---- v8.7 (Ali picked design A, 29 Oct) the WhatsApp groups library — mode "groups" (it takes Chat X-Ray's place in the menu).
   Library (search box on top · one card per group · "Add a group") → a group (its albums in rows: Rooms / Things, Topics,
   Themes… + More) → an album (a photo grid; news as headlines by month; Hadith as cards) → a photo, full screen (its caption,
   who and when, what the phone saw in it, "Move to another album"). The logic: wagroups.js; the storage: wagroups-store.js;
   the phone's side (photos kept, what is in them): WaGroups.kt. Chat X-Ray's money & promises stay one tap away.   */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Plus, X, Loader2, Trash2, Wallet } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as W from "./wagroups.js";
import * as S from "./wagroups-store.js";
import * as U from "./ui-kit.jsx";
import { unzip } from "./convert.js";

const N = () => (typeof window !== "undefined" && window.AttuneNative) || null;
const onPhone = () => !!(N() && typeof N().waLook === "function");   // the Android app keeps the photos as files (/wa/…)
const KIND_IDS = ["design", "news", "religion", "recipes", "other"];
const nm = (x, ar) => (ar && x.ar ? x.ar : tr(x.en));
const fmtDay = (t, ar) => new Date(t).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtMonth = (t, ar) => new Date(t).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { month: "long", year: "numeric" });

// a photo: a file the phone keeps (/wa/…) in the Android app, a Blob kept in IndexedDB in the browser
function Photo({ gid, file, className = "", alt = "" }) {
  const [src, setSrc] = useState(() => (onPhone() ? "/wa/" + gid + "/" + file : ""));
  useEffect(() => { if (onPhone()) return; let url = "", live = true; S.getPhoto(gid, file).then((b) => { if (b && live) { url = URL.createObjectURL(b); setSrc(url); } }); return () => { live = false; if (url) URL.revokeObjectURL(url); }; }, [gid, file]);
  return src ? <img src={src} alt={alt} loading="lazy" className={className} data-testid="wa-photo" /> : <div className={className + " bg-[var(--c-ln)]"} />;
}

/** Read an export picked by hand (a .zip, or the .txt and its photos) → { name, text, files: [{ name, blob }] }. */
async function readPicked(fileList) {
  const files = [...(fileList || [])]; let text = "", name = "", photos = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const z = await unzip(new Uint8Array(await f.arrayBuffer()));
      for (const [n, bytes] of z) { const b = n.split("/").pop(); if (/\.txt$/i.test(b) && !text) { text = new TextDecoder().decode(bytes); name = b; } else if (/\.(jpe?g|png|webp|gif)$/i.test(b)) photos.push({ name: b, blob: new Blob([bytes], { type: "image/jpeg" }) }); }
    } else if (/\.txt$/i.test(f.name) && !text) { text = await f.text(); name = f.name; }
    else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif)$/i.test(f.name)) photos.push({ name: f.name, blob: f });
  }
  return { name: W.titleOf(name), text, files: photos };
}

export function WaLibrary({ incoming, clearIncoming, flash, openXray }) {
  const ar = getLang() === "ar";
  const [groups, setGroups] = useState(null);
  const [at, setAt] = useState({ at: "home" });          // home · group · album
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [viewer, setViewer] = useState(null);            // { gid, item }
  const fileRef = useRef(null);
  const reload = async () => setGroups(await S.loadGroups());
  useEffect(() => { reload(); }, []);
  const byId = useMemo(() => Object.fromEntries((groups || []).map((g) => [g.id, g])), [groups]);

  // a new export (shared from WhatsApp, or picked): merged into its group, then the phone looks at the new photos
  const take = async ({ gid, name, text, files = [], blobs = [] }) => {
    if (!text) return;
    setBusy(tr("Reading the chat…"));
    const id = gid || W.groupIdOf(name);
    const old = (await S.loadGroups()).find((g) => g.id === id);
    const fresh = W.itemsOf(text, files);
    for (const b of blobs) await S.putPhoto(id, b.name, b.blob);
    const m = W.mergeItems(old ? old.items : [], fresh);
    // a photo that arrived now makes an older item "has" too
    const have = new Set(files); for (const it of m.items) if (it.file && have.has(it.file)) it.has = true;
    const g = { id, title: (old && old.title) || name || "WhatsApp group", items: m.items, seen: (old && old.seen) || {}, moves: (old && old.moves) || {}, kindSet: old && old.kindSet, updated: Date.now() };
    g.kind = g.kindSet || W.kindOf(g.items, { title: g.title, seen: g.seen });
    await S.saveGroup(g); await S.saveRaw(id, text);
    await reload(); setBusy(""); setAt({ at: "group", gid: id });
    flash && flash(old ? tr("{n} new in {g}", { n: m.added, g: g.title }) : tr("{g}: {n} messages and photos sorted", { g: g.title, n: m.items.length }));
    look(g);
  };
  // the phone looks at the photos it hasn't seen (what is in them + the words written in them), 150 at a time
  const look = async (g0) => {
    const n = N(); if (!n || typeof n.waLook !== "function" || !window.__attuneNativeCall) return;
    let g = g0;
    for (;;) {
      const todo = W.unseen(g.items, g.seen).slice(0, 150); if (!todo.length) break;
      setBusy(tr("Looking at the photos… {n} left", { n: W.unseen(g.items, g.seen).length }));
      let r = null; try { r = await window.__attuneNativeCall("waLook", { gid: g.id, names: todo }); } catch (e) { break; }
      const seen = { ...g.seen, ...((r && r.seen) || {}) }; for (const f of todo) if (!seen[f]) seen[f] = { labels: [], text: "" };
      g = { ...g, seen, kind: g.kindSet || W.kindOf(g.items, { title: g.title, seen }) };
      await S.saveGroup(g); await reload();
    }
    setBusy("");
  };
  useEffect(() => {
    if (!incoming) return;
    const d = incoming; clearIncoming && clearIncoming();
    take({ gid: d.gid, name: d.name ? W.titleOf(d.name) : "", text: d.text, files: d.files || [] });
  }, [incoming]);
  const pick = async (list) => {
    if (!list || !list.length) return;
    setBusy(tr("Reading the chat…"));
    try { const r = await readPicked(list); if (!r.text) { setBusy(""); return flash && flash(tr("No WhatsApp chat in that — export it with “Export chat” first")); }
      await take({ name: r.name, text: r.text, files: r.files.map((f) => f.name), blobs: r.files }); }
    catch (e) { setBusy(""); flash && flash(tr("Couldn't read that file")); }
  };

  if (groups == null) return <div className={U.page + " p-6"}><Loader2 className="animate-spin" /></div>;
  const g = at.gid ? byId[at.gid] : null;
  const found = q.trim() ? W.searchLibrary({ groups: g ? [g] : groups }, q) : null;
  const header = (title, back, extra) => <div className="flex items-center gap-2 mb-3">
    {back ? <button onClick={back} aria-label={tr("Back")} className="w-11 h-11 grid place-items-center rounded-full" data-testid="wa-back"><ArrowLeft size={20} className="rtl:rotate-180" /></button> : null}
    <h1 className={U.h1 + " flex-1 truncate"} dir="auto">{title}</h1>{extra}</div>;
  const searchBox = <div className="flex items-center gap-2 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] px-4 mb-3">
    <Search size={16} className="text-[var(--c-mut)] shrink-0" />
    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={g ? tr("Search this group…") : tr("Search all your groups — “grey sofa”, «حديث عن الصبر»…")} dir="auto" className="flex-1 min-w-0 bg-transparent py-3 text-[15px] focus:outline-none" data-testid="wa-search" />
    {q ? <button onClick={() => setQ("")} aria-label={tr("Clear")} className="w-9 h-9 grid place-items-center"><X size={15} /></button> : null}</div>;
  const busyLine = busy ? <p className={"m-0 mb-3 text-[12.5px] font-semibold flex items-center gap-2 " + U.muted} data-testid="wa-busy"><Loader2 size={14} className="animate-spin" />{busy}</p> : null;
  const results = found ? <Results found={found} ar={ar} onOpen={(r) => setViewer({ gid: r.group.id, item: r.item })} /> : null;

  // ---- an album
  if (g && at.at === "album") {
    const A = W.albumsOf(g.items, g.kind, { seen: g.seen, moves: g.moves });
    const album = [...A.rows.flatMap((r) => r.albums), ...(A.more ? [A.more] : [])].find((a) => a.id === at.aid) || { en: "More", ids: [] };
    const items = album.ids.map((id) => g.items.find((x) => x.id === id)).filter(Boolean);
    return <div className={U.page + " px-4 py-3"} data-testid="wa-album">
      {header(nm(album, ar) + " · " + items.length, () => { setQ(""); setAt({ at: "group", gid: g.id }); })}
      {searchBox}{busyLine}{results || <AlbumBody g={g} items={items} ar={ar} open={(it) => setViewer({ gid: g.id, item: it })} />}
      {viewer ? <Viewer g={byId[viewer.gid]} item={viewer.item} ar={ar} close={() => setViewer(null)} move={async (it, aid) => { const ng = { ...g, moves: { ...g.moves, [it.id]: aid } }; await S.saveGroup(ng); await reload(); setViewer(null); }} /> : null}
    </div>;
  }
  // ---- a group: its albums
  if (g) {
    const A = W.albumsOf(g.items, g.kind, { seen: g.seen, moves: g.moves });
    const setKind = async (k) => { const ng = { ...g, kind: k, kindSet: k, moves: {} }; await S.saveGroup(ng); await reload(); };
    const photos = g.items.filter((x) => x.kind === "photo").length;
    return <div className={U.page + " px-4 py-3"} data-testid="wa-group">
      {header(g.title, () => { setQ(""); setAt({ at: "home" }); })}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" data-testid="wa-kinds">
        {KIND_IDS.map((k) => <button key={k} onClick={() => setKind(k)} className={U.chip(g.kind === k) + " !min-h-[36px] !h-9 !px-3 !text-[12.5px]"} data-testid={"wa-kind-" + k}>{nm(W.KINDS[k], ar)}</button>)}
      </div>
      <p className={"m-0 mb-3 text-[12.5px] " + U.muted}>{tr("{n} messages · {p} photos · updated {d}", { n: g.items.length, p: photos, d: fmtDay(g.updated, ar) })}</p>
      {searchBox}{busyLine}
      {results || <>
        {A.rows.map((r) => <section key={r.en} className="mb-4">
          <p className={U.label + " mb-2"} style={{ color: "var(--c-acc)" }}>{nm(r, ar)}</p>
          <div className="grid grid-cols-2 gap-2.5">{r.albums.map((a) => <AlbumTile key={a.id} g={g} a={a} ar={ar} open={() => setAt({ at: "album", gid: g.id, aid: a.id })} />)}</div>
        </section>)}
        {A.more ? <section className="mb-4"><div className="grid grid-cols-2 gap-2.5"><AlbumTile g={g} a={A.more} ar={ar} open={() => setAt({ at: "album", gid: g.id, aid: "more" })} /></div></section> : null}
        <div className="flex flex-wrap gap-2 mt-2">
          {openXray ? <button onClick={async () => openXray({ text: (await S.loadRaw(g.id)) || "", name: g.title })} className={U.btnS} data-testid="wa-xray"><Wallet size={14} />{tr("Money & promises in this chat")}</button> : null}
          <button onClick={async () => { if (!window.confirm(tr("Remove {g} from Attune? (WhatsApp keeps it)", { g: g.title }))) return; await S.deleteGroup(g.id); try { N() && N().waForget && N().waForget(g.id); } catch (e) {} await reload(); setAt({ at: "home" }); }} className={U.btnS + " " + U.muted} data-testid="wa-remove"><Trash2 size={14} />{tr("Remove")}</button>
        </div>
      </>}
      {viewer ? <Viewer g={byId[viewer.gid]} item={viewer.item} ar={ar} close={() => setViewer(null)} move={async (it, aid) => { const ng = { ...g, moves: { ...g.moves, [it.id]: aid } }; await S.saveGroup(ng); await reload(); setViewer(null); }} /> : null}
    </div>;
  }
  // ---- the library
  return <div className={U.page + " px-4 py-3"} data-testid="wa-library">
    {header(tr("WhatsApp groups"), null)}
    {groups.length ? searchBox : null}{busyLine}
    {results || <>
      <div className="grid grid-cols-1 gap-3">
        {groups.map((x) => <GroupCard key={x.id} g={x} ar={ar} open={() => setAt({ at: "group", gid: x.id })} />)}
      </div>
      <div className={U.cardPad + " mt-3 space-y-2"} data-testid="wa-add">
        <p className="m-0 text-[14px] font-extrabold flex items-center gap-2"><Plus size={16} className="text-[var(--c-acc)]" />{tr("Add a group")}</p>
        <ol className={"m-0 ps-5 text-[13px] leading-relaxed " + U.muted}>
          <li>{tr("In WhatsApp open the group → ⋮ → More → Export chat")}</li>
          <li>{tr("Choose “Include media” (with the photos)")}</li>
          <li>{tr("Choose Attune — it reads everything on this phone and sorts it into albums")}</li>
        </ol>
        <p className={"m-0 text-[12px] " + U.muted}>{tr("Export again any time — only what's new is added.")}</p>
        <button onClick={() => fileRef.current && fileRef.current.click()} className={U.btnS} data-testid="wa-pick">{tr("Or pick the exported file")}</button>
        <input ref={fileRef} type="file" multiple accept=".zip,.txt,image/*" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} data-testid="wa-file" />
      </div>
    </>}
    {viewer ? <Viewer g={byId[viewer.gid]} item={viewer.item} ar={ar} close={() => setViewer(null)} /> : null}
  </div>;
}

function GroupCard({ g, ar, open }) {
  const covers = [...g.items].reverse().filter((x) => x.kind === "photo" && x.has).slice(0, 4);
  const last = [...g.items].reverse().find((x) => x.text);
  return <button onClick={open} className={U.card + " w-full text-start overflow-hidden"} data-testid="wa-group-card">
    {covers.length ? <div className="grid grid-cols-4 gap-0.5 h-24">{covers.map((c) => <Photo key={c.id} gid={g.id} file={c.file} className="w-full h-24 object-cover" />)}</div> : null}
    <div className="p-3.5">
      <div className="flex items-center gap-2"><b className="flex-1 truncate text-[15.5px] font-extrabold" dir="auto">{g.title}</b><span className={U.tag("green")}>{nm(W.KINDS[g.kind] || W.KINDS.other, ar)}</span></div>
      <p className={"m-0 mt-0.5 text-[12.5px] truncate " + U.muted} dir="auto">{tr("{n} items", { n: g.items.length })}{last ? " · " + W.headline(last.text) : ""}</p>
    </div></button>;
}
function AlbumTile({ g, a, ar, open }) {
  return <button onClick={open} className={U.card + " text-start overflow-hidden"} data-testid={"wa-album-" + a.id}>
    {a.cover ? <Photo gid={g.id} file={a.cover} className="w-full h-28 object-cover" /> : <div className="w-full h-28 grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] text-[28px] font-black">{nm(a, ar).charAt(0)}</div>}
    <div className="px-3 py-2"><b className="block truncate text-[14px] font-extrabold">{nm(a, ar)}</b><span className={"text-[12px] tabular-nums " + U.muted}>{a.count}</span></div></button>;
}
function AlbumBody({ g, items, ar, open }) {
  const [n, setN] = useState(90);
  const shown = items.slice(0, n);
  if (g.kind === "news") {
    let month = "";
    return <div className="space-y-2" data-testid="wa-news">{shown.map((it) => { const m = fmtMonth(it.t, ar), head = m !== month ? (month = m) : null;
      return <React.Fragment key={it.id}>{head ? <p className={U.label + " pt-2"}>{head}</p> : null}
        <button onClick={() => open(it)} className={U.card + " w-full text-start p-3 flex gap-3"} data-testid="wa-news-item">
          {it.kind === "photo" && it.has ? <Photo gid={g.id} file={it.file} className="w-16 h-16 rounded-[12px] object-cover shrink-0" /> : null}
          <span className="flex-1 min-w-0"><b className="block text-[14px] font-bold leading-snug" dir="auto">{W.headline(it.text) || tr("Photo")}</b><span className={"text-[11.5px] " + U.muted}>{fmtDay(it.t, ar)}</span></span></button></React.Fragment>; })}
      {items.length > n ? <button onClick={() => setN(n + 90)} className={U.btnS + " w-full"}>{tr("Show more")}</button> : null}</div>;
  }
  if (g.kind === "religion") {
    return <div className="space-y-2.5" data-testid="wa-hadith">{shown.map((it) => { const h = W.hadithOf(it.text);
      return <button key={it.id} onClick={() => open(it)} className={U.card + " w-full text-start p-4"} data-testid="wa-hadith-card">
        {it.kind === "photo" && it.has ? <Photo gid={g.id} file={it.file} className="w-full max-h-64 object-cover rounded-[12px] mb-2" /> : null}
        {h.isHadith && h.narrator ? <p className={"m-0 text-[12px] font-bold " + U.muted} dir="auto">{tr("Narrated by {n}", { n: h.narrator })}</p> : null}
        <p className="m-0 mt-1 text-[15px] leading-loose whitespace-pre-wrap" dir="auto">{h.isHadith ? h.text : it.text}</p>
        {h.isHadith && (h.source || h.grade) ? <p className="m-0 mt-2 text-[12px] font-extrabold text-[var(--c-acc)]" dir="auto">{[h.source && tr("Reported by {s}", { s: h.source }), h.grade].filter(Boolean).join(" · ")}</p> : null}
      </button>; })}
      {items.length > n ? <button onClick={() => setN(n + 90)} className={U.btnS + " w-full"}>{tr("Show more")}</button> : null}</div>;
  }
  const photos = shown.filter((x) => x.kind === "photo" && x.has), notes = shown.filter((x) => !(x.kind === "photo" && x.has));
  return <div data-testid="wa-grid">
    {photos.length ? <div className="grid grid-cols-3 gap-1 mb-3">{photos.map((it) => <button key={it.id} onClick={() => open(it)} className="relative aspect-square overflow-hidden rounded-[8px]" data-testid="wa-grid-photo"><Photo gid={g.id} file={it.file} className="w-full h-full object-cover" /></button>)}</div> : null}
    <div className="space-y-2">{notes.map((it) => <button key={it.id} onClick={() => open(it)} className={U.card + " w-full text-start p-3"} data-testid="wa-note">
      <p className="m-0 text-[14px] leading-relaxed whitespace-pre-wrap line-clamp-4" dir="auto">{it.text || it.file}</p><span className={"text-[11.5px] " + U.muted}>{fmtDay(it.t, ar)}</span></button>)}</div>
    {items.length > n ? <button onClick={() => setN(n + 90)} className={U.btnS + " w-full mt-3"}>{tr("Show more")}</button> : null}
  </div>;
}
function Results({ found, ar, onOpen }) {
  if (!found.length) return <p className={U.cardPad + " text-[13px] text-center " + U.muted} data-testid="wa-none">{tr("Nothing found — try other words")}</p>;
  return <div className="space-y-2" data-testid="wa-results">{found.slice(0, 60).map((r) => <button key={r.group.id + r.item.id} onClick={() => onOpen(r)} className={U.card + " w-full text-start p-3 flex gap-3"} data-testid="wa-result">
    {r.item.kind === "photo" && r.item.has ? <Photo gid={r.group.id} file={r.item.file} className="w-16 h-16 rounded-[12px] object-cover shrink-0" /> : null}
    <span className="flex-1 min-w-0"><span className={"block text-[11.5px] font-bold " + U.muted}>{r.group.title} · {fmtDay(r.item.t, ar)}</span>
      <span className="block text-[14px] leading-snug line-clamp-3" dir="auto">{r.item.text || r.snip || tr("Photo")}</span></span></button>)}</div>;
}
function Viewer({ g, item, ar, close, move }) {
  if (!g || !item) return null;
  const s = g.seen && g.seen[item.file], K = W.KINDS[g.kind] || W.KINDS.other, albums = K.rows.flatMap((r) => r.albums);
  return <div className="fixed inset-0 z-[70] bg-black/90 flex flex-col" data-testid="wa-viewer">
    <div className="flex justify-end p-2"><button onClick={close} aria-label={tr("Close")} className="w-11 h-11 grid place-items-center text-white"><X size={22} /></button></div>
    <div className="flex-1 min-h-0 grid place-items-center px-2">{item.kind === "photo" && item.has ? <Photo gid={g.id} file={item.file} className="max-w-full max-h-full object-contain" /> : null}</div>
    <div className="bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[20px] p-4 max-h-[45vh] overflow-y-auto space-y-2">
      {item.text ? <p className="m-0 text-[15px] leading-relaxed whitespace-pre-wrap" dir="auto">{item.text}</p> : null}
      <p className={"m-0 text-[12px] " + U.muted}>{item.who} · {fmtDay(item.t, ar)}</p>
      {s && s.labels && s.labels.length ? <div className="flex flex-wrap gap-1">{s.labels.slice(0, 6).map((l) => <span key={l.text || l} className={U.tag("gray")}>{l.text || l}</span>)}</div> : null}
      {move && albums.length ? <label className={"block text-[12px] font-bold " + U.muted}>{tr("Move to another album")}
        <select onChange={(e) => e.target.value && move(item, e.target.value)} defaultValue="" className={U.inp + " mt-1"} data-testid="wa-move">
          <option value="">—</option>{albums.map((a) => <option key={a.id} value={a.id}>{nm(a, ar)}</option>)}</select></label> : null}
    </div></div>;
}
