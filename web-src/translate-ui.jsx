/* ---- v6.27 Translate (mode "translate", All → Files) — text, a photo (the translation drawn over it), or a document (the File
   Converter keeps its layout). Every piece is checked by code (translate.js): numbers / names / codes locked, the target
   script, nothing left untranslated, your glossary; "Extra careful" translates back and compares. Flagged pieces are shown,
   never hidden. Tests: tests/e2e_v727translate.py.                                                                         */
import React, { useEffect, useRef, useState } from "react";
import { Languages, Camera, ImageIcon, FileText, Copy, Volume2, Shuffle, ShieldCheck, AlertTriangle, Plus, Trash2, Download } from "lucide-react";
import { openRead } from "./readaloud-ui.jsx";
import { tr, getLang } from "./i18n.js";
import * as T from "./translate.js";
import { speakNow } from "./lesson-ui.jsx";
import { useSubBack } from "./backstack.js";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";
import { page, cardPad, btnP, btnS, area, label, chip, h1, muted } from "./ui-kit.jsx";

const field = area;
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
    <div className={cardPad + " space-y-3"} data-testid="tr-result">
      <div dir={RTL.has(to) ? "rtl" : "ltr"} className="text-[16px] leading-relaxed space-y-2">
        {res.map((r, i) => <p key={i} className="m-0 rounded-lg" style={r.ok ? {} : { background: "color-mix(in srgb, var(--c-warn) 14%, transparent)", padding: "4px 6px" }} data-testid={r.ok ? "tr-piece" : "tr-flagged"} title={r.why}>{r.text}</p>)}
      </div>
      <p className={"text-[12.5px] m-0 flex items-center gap-1.5 " + (flagged.length ? "c-warn" : "c-pos")} data-testid="tr-badge">
        {flagged.length ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        {flagged.length ? tr("{n} part(s) marked — check them: {why}", { n: flagged.length, why: flagged.map((f) => f.why).filter(Boolean).slice(0, 2).join("; ") }) : tr("Checked: numbers, names and codes kept exactly; written in the right language")}</p>
      <div className="flex gap-2">
        <button className={btnS} onClick={() => onCopy(text)} data-testid="tr-copy"><Copy size={14} />{tr("Copy")}</button>
        <button className={btnS} onClick={() => speakNow(text, { lang: to, native })} data-testid="tr-listen"><Volume2 size={14} />{tr("Listen")}</button>
      </div>
    </div>);
}

// v6.41 (H4): a live interpreter for two people at one phone — the screen is split; the top half faces the person across the
// table (turned round). Each side taps its mic and speaks its own language; the other side reads it (big) and hears it.
// One mic at a time (in turns). All on the phone: the model translates, the phone listens and speaks.
function Interpreter({ llm, native, flash, gloss, close }) {
  const [langs, setLangs] = useState(() => { try { return JSON.parse(localStorage.getItem("attune:interp:v1")) || { a: getLang() === "ar" ? "ar" : "en", b: getLang() === "ar" ? "en" : "ar" }; } catch (e) { return { a: "ar", b: "en" }; } });
  const [said, setSaid] = useState({ a: "", b: "" });     // what each side said (their own words)
  const [heard, setHeard] = useState({ a: "", b: "" });   // what each side reads: the other's words in their language
  const [busy, setBusy] = useState(null);                 // "a" | "b" | null
  const [log, setLog] = useState([]);
  useSubBack(true, close);   // Back closes the interpreter
  // v8.6 (Ali: "took a lot of time to just translate hello"): the model is woken while the first person is still speaking
  useEffect(() => { if (llm) Promise.resolve().then(() => llm([{ role: "user", content: "hi" }], { maxTokens: 1 })).catch(() => {}); }, []);
  useEffect(() => { try { localStorage.setItem("attune:interp:v1", JSON.stringify(langs)); } catch (e) {} }, [langs]);
  const turn = async (side) => {
    if (busy) return;
    if (!native || !native.call || !native.N || !native.N.listen) { flash && flash(tr("Voice input works in the Android app")); return; }
    const other = side === "a" ? "b" : "a";
    setBusy(side); setSaid((x) => ({ ...x, [side]: "" }));
    try {
      const r = await native.call("listen", T.speechTag(langs[side]), (p, stage, d) => { if (stage === "partial") setSaid((x) => ({ ...x, [side]: d })); });
      const text = String((r && r.text) || "").trim();
      if (!text) { setBusy(null); return; }
      setSaid((x) => ({ ...x, [side]: text }));
      setHeard((x) => ({ ...x, [other]: "…" }));
      // v8.6: "hello", «شكرا», "how much is this?" — the phrasebook answers at once; the model only for real sentences
      const quick = T.quickPhrase(text, langs[other]);
      if (!quick && !llm) { setHeard((x) => ({ ...x, [other]: "" })); flash && flash(tr("Install a model in Engine to translate")); setBusy(null); return; }
      const out = quick ? [{ text: quick, ok: true }] : await T.translatePieces([text], (m, o) => llm(m, o), { lang: langs[other], language: T.LANGS[langs[other]] || langs[other], glossary: gloss || [], sourceLanguage: T.LANGS[langs[side]] || "" });
      const t = out && out[0] ? out[0].text : "";
      setHeard((x) => ({ ...x, [other]: t }));
      setLog((l) => [{ side, from: text, to: t, ok: out && out[0] ? out[0].ok : true }, ...l].slice(0, 40));
      if (t) await speakNow(t, { lang: langs[other], native });
    } catch (e) { flash && flash(tr(String((e && e.message) || e))); }
    setBusy(null);
  };
  const Half = ({ side, flip }) => (
    <div className={"flex-1 flex flex-col p-4 gap-3 min-h-0 " + (side === "b" ? "bg-[var(--c-surf)]" : "bg-[var(--c-bg)]")} style={flip ? { transform: "rotate(180deg)" } : {}} data-testid={"interp-" + side}>
      <div className="flex items-center gap-2">
        <select value={langs[side]} onChange={(e) => setLangs({ ...langs, [side]: e.target.value })} className="min-h-[44px] rounded-[14px] bg-[var(--c-surf-2)] border border-[var(--c-ln)] text-[var(--c-ink)] text-[14px] font-bold px-3" data-testid={"interp-lang-" + side}>
          {Object.entries(T.LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="flex-1" />
        {side === "a" ? <button onClick={close} className={btnS} data-testid="interp-close">{tr("Close")}</button> : null}
      </div>
      <p className="flex-1 overflow-y-auto text-[26px] leading-snug text-[var(--c-ink)] m-0" dir={RTL.has(langs[side]) ? "rtl" : "ltr"} data-testid={"interp-heard-" + side}>{heard[side]}</p>
      {said[side] ? <p className="text-[13px] text-[var(--c-mut)] m-0" dir="auto" data-testid={"interp-said-" + side}>{said[side]}</p> : null}
      <button onClick={() => turn(side)} disabled={!!busy && busy !== side} data-testid={"interp-mic-" + side}
        className={"w-full min-h-[56px] py-4 rounded-[22px] text-lg font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 " + (busy === side ? "bg-[var(--c-neg)] text-[var(--c-on-acc)]" : "bg-[var(--c-acc)] text-[var(--c-on-acc)]")}>
        <Volume2 size={20} />{busy === side ? T.LANGS[langs[side]] + " …" : (T.LANGS[langs[side]] || langs[side])}</button>
    </div>);
  return (
    <div className="calm fixed inset-0 z-[70] flex flex-col bg-[var(--c-bg)] text-[var(--c-ink)]" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="interp">
      <Half side="b" flip />
      <div className="h-px bg-[var(--c-ln)]" />
      <Half side="a" />
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
  const fileRef = useRef(null), galRef = useRef(null);
  useEffect(() => { try { localStorage.setItem(LKEY, to); } catch (e) {} }, [to]);
  const saveG = (g) => { setGloss(g); try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch (e) {} };
  const run = async (pieces, from) => {
    if (pieces.length === 1) { const q = T.quickPhrase(pieces[0], to); if (q) return [{ src: pieces[0], text: q, ok: true, why: "" }]; }
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
  if (tab === "talk") return <Interpreter llm={llm} native={native} flash={flash} gloss={gloss} close={() => setTab("text")} />;
  return (
    <div className={page + " rounded-[22px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="translate-page">
      <div><h2 className={h1 + " flex items-center gap-2"}><Languages size={20} className="text-[var(--c-acc)]" />{tr("Translate")}</h2>
        <p data-intro="" className={"m-0 mt-0.5 text-[13px] lg:max-w-[70ch] " + muted}>{tr("Any language, on this phone. Numbers, names and codes can't be changed; every part is checked, and anything doubtful is marked.")}</p></div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
        {[["text", "Text"], ["talk", "Conversation"], ["photo", "Photo"], ["doc", "Document"]].map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={chip(tab === id)} onClick={() => { setTab(id); setRes(null); }} data-testid={"tr-tab-" + id}>{tr(l)}</button>)}
      </div>
      {/* v6.27 computer layout A: what to translate on the left, the translation on the right (stacked on a phone);
          a document opens the File Converter, so its tab keeps one column */}
      <div className={tab === "doc" ? "lg:max-w-2xl" : PANES}><div className={LEFT}>
      <div className="flex items-center gap-2">
        <span className={label}>{tr("Into")}</span>
        <select value={to} onChange={(e) => { setTo(e.target.value); setRes(null); }} className={field + " flex-1"} style={st} data-testid="tr-to">
          {Object.entries(T.LANGS).map(([k, v]) => <option key={k} value={k}>{tr(v)}</option>)}
        </select>
        {tab === "text" && res ? <button className={btnS + " w-11 px-0"} aria-label={tr("Swap")} onClick={() => { const from = guessFrom(text); setText(res.map((r) => r.text).join("\n\n")); setTo(from); setRes(null); }}><Shuffle size={15} /></button> : null}
      </div>
      {tab === "text" ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} dir="auto" placeholder={tr("Type or paste anything…")} className={field} style={st} data-testid="tr-text" />
          <div className="flex items-center gap-3 flex-wrap">
            <button className={btnP} disabled={!text.trim() || !!busy} onClick={go} data-testid="tr-go">{tr("Translate")}</button>
            <label className="flex items-center gap-2 min-h-[44px] text-[13.5px] font-semibold"><input type="checkbox" className="w-4 h-4 accent-[var(--c-acc)]" checked={careful} onChange={(e) => setCareful(e.target.checked)} data-testid="tr-careful" />{tr("Extra careful (slower)")}</label>
            <button className="min-h-[44px] text-[13.5px] font-bold text-[var(--c-acc)]" onClick={() => setShowG((v) => !v)} data-testid="tr-glossary">{tr("My words ({n})", { n: gloss.length })}</button>
          </div>
        </div>) : null}
      {tab === "photo" ? (
        <div className="space-y-2">
          {/* v8.6 (Ali: "add the ability to add a photo from the gallery also"): take one, or pick one already on the phone */}
          <div className="grid grid-cols-2 gap-2">
            <button className={cardPad + " w-full text-center py-6 border-dashed hover:border-[var(--c-acc)]"} onClick={() => fileRef.current && fileRef.current.click()} data-testid="tr-photo"><span className="mx-auto w-12 h-12 rounded-2xl grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)]"><Camera size={22} /></span><span className="block text-[13.5px] font-semibold mt-2">{tr("Take a photo")}</span></button>
            <button className={cardPad + " w-full text-center py-6 border-dashed hover:border-[var(--c-acc)]"} onClick={() => galRef.current && galRef.current.click()} data-testid="tr-gallery"><span className="mx-auto w-12 h-12 rounded-2xl grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)]"><ImageIcon size={22} /></span><span className="block text-[13.5px] font-semibold mt-2">{tr("From the gallery")}</span></button>
          </div>
          <p className={muted + " text-center m-0"}>{tr("Photo of a menu, a sign, a document…")}</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { goPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="tr-file" />
          <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => { goPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="tr-gallery-file" />
          {photo && photo.out ? <div className="space-y-2" data-testid="tr-overlay"><img src={photo.out} alt="" className="w-full rounded-[16px] border border-[var(--c-ln)]" />
            <a href={photo.out} download="translated.jpg" className={btnS}><Download size={14} />{tr("Save the picture")}</a></div> : photo ? <img src={photo.src} alt="" className="max-h-56 rounded-[16px] border border-[var(--c-ln)]" /> : null}
        </div>) : null}
      {tab === "photo" && photo && photo.text ? <button className={btnS} onClick={() => openRead({ text: photo.text, image: photo.src })} data-testid="tr-read"><Volume2 size={14} />{tr("Read it to me")}</button> : null}
      {tab === "doc" ? (
        <div className={cardPad + " space-y-3"} data-testid="tr-doc"><b className="flex items-center gap-2 text-[16px] font-extrabold"><FileText size={16} className="text-[var(--c-acc)]" />{tr("PDF, Word, slides, subtitles…")}</b>
          <p className={"m-0 text-[13.5px] " + muted}>{tr("The File Converter translates the whole file and keeps its layout — tables, headings and pictures stay where they are — with the same checks.")}</p>
          <button className={btnP} onClick={() => openConverter && openConverter(to)} data-testid="tr-open-converter">{tr("Choose a file")}</button></div>) : null}
      {showG ? (
        <div className={cardPad + " space-y-2.5"} data-testid="tr-gloss"><span className={label}>{tr("Always translate these my way")}</span>
          {gloss.map((g, i) => <div key={i} className="flex gap-2 items-center"><input value={g.from} onChange={(e) => saveG(gloss.map((x, k) => (k === i ? { ...x, from: e.target.value } : x)))} placeholder={tr("Word")} className={field} style={st} dir="auto" /><span className="rtl:rotate-180 text-[var(--c-mut)]">→</span><input value={g.to} onChange={(e) => saveG(gloss.map((x, k) => (k === i ? { ...x, to: e.target.value } : x)))} placeholder={tr("My translation")} className={field} style={st} dir="auto" /><button aria-label={tr("Delete")} className="w-11 h-11 shrink-0 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-neg)]" onClick={() => saveG(gloss.filter((_, k) => k !== i))}><Trash2 size={14} /></button></div>)}
          <button className={btnS} onClick={() => saveG([...gloss, { from: "", to: "" }])}><Plus size={14} />{tr("Add")}</button></div>) : null}
      </div><div className={res || busy ? RIGHT : "min-w-0"}>
      {busy ? <p className={"text-[13.5px] " + muted} data-testid="tr-busy">{busy}</p> : null}
      {res ? <Result res={res} to={to} native={native} onCopy={(t) => { try { navigator.clipboard.writeText(t); flash && flash(tr("Copied")); } catch (e) {} }} /> : null}
      {!res && !busy && tab !== "doc" ? <DeskEmpty icon={Languages} title={tr("The translation appears here")} text={tr("Every part is checked: numbers, names and codes kept exactly.")} testid="tr-desk-empty" /> : null}
      </div></div>
    </div>);
}
