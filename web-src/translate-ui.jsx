/* ---- v6.27 Translate (mode "translate", All → Files) — text, a photo (the translation drawn over it), or a document (the File
   Converter keeps its layout). Every piece is checked by code (translate.js): numbers / names / codes locked, the target
   script, nothing left untranslated, your glossary; "Extra careful" translates back and compares. Flagged pieces are shown,
   never hidden. Tests: tests/e2e_v727translate.py.                                                                         */
import React, { useEffect, useRef, useState } from "react";
import { Languages, Camera, FileText, Copy, Volume2, Shuffle, ShieldCheck, AlertTriangle, Plus, Trash2, Download } from "lucide-react";
import { openRead } from "./readaloud-ui.jsx";
import { tr, getLang } from "./i18n.js";
import * as T from "./translate.js";
import { speakNow } from "./lesson-ui.jsx";

const field = "w-full rounded-xl px-3 py-2.5 text-[15px] border bg-transparent";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };
const GKEY = "attune:translate:glossary", LKEY = "attune:translate:to";
const RTL = new Set(["ar", "he", "fa", "ur"]);
const guessFrom = (t) => (/[؀-ۿ]/.test(t) ? "ar" : /[Ѐ-ӿ]/.test(t) ? "ru" : /[一-鿿]/.test(t) ? "zh" : /[぀-ヿ]/.test(t) ? "ja" : /[가-힯]/.test(t) ? "ko" : /[ऀ-ॿ]/.test(t) ? "hi" : "en");

/** Draws the translated lines over the photo, each in its own box (background sampled around it). → a data URL. */
export async function overlay(dataUrl, lines, texts, lang) {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = dataUrl; });
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  lines.forEach((l, k) => {
    const t = texts[k]; if (!t || !(l.w > 0 && l.h > 0)) return;
    const x = Math.max(0, l.x - 2), y = Math.max(0, l.y - 2), w = Math.min(c.width - x, l.w + 4), h = Math.min(c.height - y, l.h + 4);
    // the background: the average colour just OUTSIDE the box (its edge), not the letters inside it
    let r = 0, gg = 0, b = 0, n = 0;
    const take = (sx, sy, sw, sh) => { if (sw <= 0 || sh <= 0) return; const px = g.getImageData(Math.max(0, sx), Math.max(0, sy), Math.min(sw, c.width - Math.max(0, sx)), Math.min(sh, c.height - Math.max(0, sy))).data; for (let i = 0; i < px.length; i += 4 * 3) { r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++; } };
    take(x, y - 3, w, 2); take(x, y + h + 1, w, 2); take(x - 3, y, 2, h); take(x + w + 1, y, 2, h);
    if (!n) { r = gg = b = 255; n = 1; }
    r = Math.round(r / n); gg = Math.round(gg / n); b = Math.round(b / n);
    g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(x, y, w, h);
    const dark = r * 0.299 + gg * 0.587 + b * 0.114 < 140;
    g.fillStyle = dark ? "#FFFFFF" : "#111111";
    let size = Math.max(9, Math.round(l.h * 0.82));
    g.font = `600 ${size}px "Figtree","IBM Plex Sans Arabic",sans-serif`;
    while (g.measureText(t).width > w && size > 8) { size--; g.font = `600 ${size}px "Figtree","IBM Plex Sans Arabic",sans-serif`; }
    g.textBaseline = "middle"; g.direction = RTL.has(lang) ? "rtl" : "ltr"; g.textAlign = RTL.has(lang) ? "right" : "left";
    // in a right-to-left line, a Latin / number run ("25 EGP", "INV-1") keeps its own left-to-right order
    const shown = RTL.has(lang) ? t.replace(/[A-Za-z0-9][A-Za-z0-9.,:/%\- ]*[A-Za-z0-9%]|[A-Za-z0-9]/g, (m) => "\u2066" + m + "\u2069") : t;
    g.fillText(shown, RTL.has(lang) ? x + w - 1 : x + 1, y + h / 2, w);
  });
  return c.toDataURL("image/jpeg", 0.9);
}

function Result({ res, to, native, onCopy }) {
  const flagged = res.filter((r) => !r.ok);
  const text = res.map((r) => r.text).join("\n\n");
  return (
    <div className="c-card space-y-2" data-testid="tr-result">
      <div dir={RTL.has(to) ? "rtl" : "ltr"} className="text-[16px] leading-relaxed space-y-2">
        {res.map((r, i) => <p key={i} className="m-0 rounded-lg" style={r.ok ? {} : { background: "rgba(227,164,74,.14)", padding: "4px 6px" }} data-testid={r.ok ? "tr-piece" : "tr-flagged"} title={r.why}>{r.text}</p>)}
      </div>
      <p className={"text-[12.5px] m-0 flex items-center gap-1.5 " + (flagged.length ? "c-warn" : "c-pos")} data-testid="tr-badge">
        {flagged.length ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        {flagged.length ? tr("{n} part(s) marked — check them: {why}", { n: flagged.length, why: flagged.map((f) => f.why).filter(Boolean).slice(0, 2).join("; ") }) : tr("Checked: numbers, names and codes kept exactly; written in the right language")}</p>
      <div className="flex gap-2">
        <button className="c-pill flex items-center gap-1" onClick={() => onCopy(text)} data-testid="tr-copy"><Copy size={13} />{tr("Copy")}</button>
        <button className="c-pill flex items-center gap-1" onClick={() => speakNow(text, { lang: to, native })} data-testid="tr-listen"><Volume2 size={13} />{tr("Listen")}</button>
      </div>
    </div>);
}

export function TranslatePage({ llm, readText, native, openConverter, flash }) {
  const [tab, setTab] = useState("text");
  const [to, setTo] = useState(() => { try { return localStorage.getItem(LKEY) || (getLang() === "ar" ? "en" : "ar"); } catch (e) { return "ar"; } });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [careful, setCareful] = useState(false);
  const [gloss, setGloss] = useState(() => { try { return JSON.parse(localStorage.getItem(GKEY) || "[]"); } catch (e) { return []; } });
  const [showG, setShowG] = useState(false);
  const [photo, setPhoto] = useState(null);   // { src, out }
  const fileRef = useRef(null);
  useEffect(() => { try { localStorage.setItem(LKEY, to); } catch (e) {} }, [to]);
  const saveG = (g) => { setGloss(g); try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch (e) {} };
  const run = async (pieces, from) => {
    if (!llm) { flash && flash(tr("Install a model in Engine to translate")); return null; }
    const out = await T.translatePieces(pieces, (m, o) => llm(m, o), { lang: to, language: T.LANGS[to] || to, glossary: gloss, careful, sourceLanguage: T.LANGS[from] || "the original language",
      onProgress: (i, n) => setBusy(tr("Translating — part {i} of {n}…", { i: i + 1, n })) });
    setBusy(""); return out;
  };
  const go = async () => { const ps = T.piecesOf(text); if (!ps.length) return; setRes(null); setRes(await run(ps, guessFrom(text))); };
  const goPhoto = async (file) => {
    if (!file) return;
    const src = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(file); });
    setPhoto({ src, out: null }); setRes(null); setBusy(tr("Reading the photo…"));
    let r = null; try { r = readText ? await readText(String(src).split(",")[1]) : null; } catch (e) {}
    const said = (r && r.text) || ""; setPhoto({ src, out: null, text: said });
    const lines = ((r && r.lines) || []).filter((l) => /\p{L}{2,}/u.test(l.text || ""));
    if (!lines.length) { setBusy(""); if (r && r.text) { const out = await run(T.piecesOf(r.text), guessFrom(r.text)); if (out) setRes(out); } else flash && flash(tr("No text found in the photo")); return; }
    const out = await run(lines.map((l) => l.text), guessFrom(lines.map((l) => l.text).join(" ")));
    if (!out) return;
    setRes(out);
    // the boxes are in the photo's own pixels; the photo we draw on is the same file
    try { setPhoto({ src, text: said, out: await overlay(src, lines, out.map((x) => x.text), to) }); } catch (e) {}
  };
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="translate-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Languages size={20} className="c-acc" />{tr("Translate")}</h2>
        <p className="c-sub m-0">{tr("Any language, on this phone. Numbers, names and codes can't be changed; every part is checked, and anything doubtful is marked.")}</p></div>
      <div className="flex gap-4 border-b" style={{ borderColor: "var(--c-ln)" }} role="tablist">
        {[["text", "Text"], ["photo", "Photo"], ["doc", "Document"]].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className="c-tab pb-2" onClick={() => { setTab(id); setRes(null); }} data-testid={"tr-tab-" + id}>{tr(l)}</button>)}
      </div>
      <div className="flex items-center gap-2">
        <span className="c-sub text-[13px]">{tr("Into")}</span>
        <select value={to} onChange={(e) => { setTo(e.target.value); setRes(null); }} className={field + " flex-1"} style={st} data-testid="tr-to">
          {Object.entries(T.LANGS).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
        </select>
        {tab === "text" && res ? <button className="c-ic" aria-label={tr("Swap")} onClick={() => { const from = guessFrom(text); setText(res.map((r) => r.text).join("\n\n")); setTo(from); setRes(null); }}><Shuffle size={15} /></button> : null}
      </div>
      {tab === "text" ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} dir="auto" placeholder={tr("Type or paste anything…")} className={field} style={st} data-testid="tr-text" />
          <div className="flex items-center gap-3 flex-wrap">
            <button className="c-btn" disabled={!text.trim() || !!busy} onClick={go} data-testid="tr-go">{tr("Translate")}</button>
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" checked={careful} onChange={(e) => setCareful(e.target.checked)} data-testid="tr-careful" />{tr("Extra careful (slower)")}</label>
            <button className="c-sub text-[13px] underline" onClick={() => setShowG((v) => !v)} data-testid="tr-glossary">{tr("My words ({n})", { n: gloss.length })}</button>
          </div>
        </div>) : null}
      {tab === "photo" ? (
        <div className="space-y-2">
          <button className="c-card w-full text-center py-4" onClick={() => fileRef.current && fileRef.current.click()} data-testid="tr-photo"><Camera size={20} className="c-acc mx-auto" /><span className="block text-[13px] mt-1">{tr("Photo of a menu, a sign, a document…")}</span></button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { goPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="tr-file" />
          {photo && photo.out ? <div className="space-y-2" data-testid="tr-overlay"><img src={photo.out} alt="" className="w-full rounded-xl" />
            <a href={photo.out} download="translated.jpg" className="c-pill inline-flex items-center gap-1"><Download size={13} />{tr("Save the picture")}</a></div> : photo ? <img src={photo.src} alt="" className="max-h-56 rounded-xl" /> : null}
        </div>) : null}
      {tab === "photo" && photo && photo.text ? <button className="c-pill inline-flex items-center gap-1" style={{ fontSize: 13, padding: "6px 12px", border: 0, cursor: "pointer" }} onClick={() => openRead({ text: photo.text, image: photo.src })} data-testid="tr-read"><Volume2 size={14} />{tr("Read it to me")}</button> : null}
      {tab === "doc" ? (
        <div className="c-card space-y-2" data-testid="tr-doc"><b className="flex items-center gap-2"><FileText size={16} className="c-acc" />{tr("PDF, Word, slides, subtitles…")}</b>
          <p className="c-sub m-0 text-[13.5px]">{tr("The File Converter translates the whole file and keeps its layout — tables, headings and pictures stay where they are — with the same checks.")}</p>
          <button className="c-btn" onClick={() => openConverter && openConverter(to)} data-testid="tr-open-converter">{tr("Choose a file")}</button></div>) : null}
      {showG ? (
        <div className="c-card space-y-2" data-testid="tr-gloss"><span className="c-lbl">{tr("Always translate these my way")}</span>
          {gloss.map((g, i) => <div key={i} className="flex gap-2 items-center"><input value={g.from} onChange={(e) => saveG(gloss.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)))} placeholder={tr("Word")} className={field} style={st} dir="auto" /><span>→</span><input value={g.to} onChange={(e) => saveG(gloss.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)))} placeholder={tr("My translation")} className={field} style={st} dir="auto" /><button aria-label={tr("Delete")} onClick={() => saveG(gloss.filter((_, k) => k !== i))}><Trash2 size={14} /></button></div>)}
          <button className="c-pill inline-flex items-center gap-1" onClick={() => saveG([...gloss, { from: "", to: "" }])}><Plus size={13} />{tr("Add")}</button></div>) : null}
      {busy ? <p className="c-sub" data-testid="tr-busy">{busy}</p> : null}
      {res ? <Result res={res} to={to} native={native} onCopy={(t) => { try { navigator.clipboard.writeText(t); flash && flash(tr("Copied")); } catch (e) {} }} /> : null}
    </div>);
}
