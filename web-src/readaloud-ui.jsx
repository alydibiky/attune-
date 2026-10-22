/* ---- v6.27 "Read it to me" — one sheet any page opens (window event "attune-read" { text?, image? }): Home's camera button,
   Chat (a photo with "read it"), Translate (a photo). Voice first: the phone says what the paper is, then reads it all, a
   sentence at a time with the sentence lit up; big buttons; Slower; "Read it in my language" through the checked translator.
   Then it acts: a due date → Deadline Radar, medicines → Family health, a bill → Money. Logic: readaloud.js (all code).    */
import React, { useEffect, useRef, useState } from "react";
import { X, Camera, ImagePlus, Play, Pause, Bell, Pill, Wallet, Languages, Volume2, Sparkles } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as R from "./readaloud.js";
import * as D from "./deadlines.js";
import * as TR from "./translate.js";
import { speakNow, stopSpeaking } from "./lesson-ui.jsx";
import { homeCurrency, dateOrder } from "./locale.js";

export const openRead = (detail) => { try { window.dispatchEvent(new CustomEvent("attune-read", { detail: detail || {} })); } catch (e) {} };
function shrink(file) { return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.88)); }; img.onerror = () => ok(""); img.src = fr.result; }; fr.onerror = () => ok(""); fr.readAsDataURL(file); }); }

function ReadSheet({ init, readText, llm, native, remind, flash, onClose }) {
  const ui = getLang() === "ar" ? "ar" : "en";
  const [img, setImg] = useState(init.image || "");
  const [text, setText] = useState(init.text || "");
  const [busy, setBusy] = useState("");
  const [shown, setShown] = useState("");          // the text being read (the paper, or its translation)
  const [at, setAt] = useState(-1), [playing, setPlaying] = useState(""), [slow, setSlow] = useState(false);   // playing: "" | "say" | "all"
  const [plain, setPlain] = useState("");
  const run = useRef(0), cam = useRef(null), pick = useRef(null);
  const facts = text ? R.factsOf(text, { now: Date.now(), home: homeCurrency(), order: dateOrder() }) : null;
  const ex = facts ? R.explain(facts, ui) : null;
  const lines = R.sentences(shown || text);
  const voiceLang = R.langOf(shown || text);
  const stop = () => { run.current++; stopSpeaking(native); setPlaying(""); setAt(-1); };
  const play = async (list, lang, from = 0, what = "all") => {
    stopSpeaking(native); const me = ++run.current; setPlaying(what);
    for (let i = from; i < list.length; i++) { if (run.current !== me) return; if (what === "all") setAt(i); await speakNow(list[i], { lang, rate: slow ? 0.75 : 0.95, native }); }
    if (run.current === me) { setPlaying(""); setAt(-1); }
  };
  useEffect(() => () => { run.current++; stopSpeaking(native); }, []);
  const ocr = async (dataUrl) => {
    setBusy(tr("Reading the paper…")); let t = "";
    try { const r = readText ? await readText(dataUrl.split(",")[1]) : null; t = (r && r.text) || ""; } catch (e) {}
    setBusy("");
    if (!t.trim()) { flash && flash(tr("Couldn't read any writing — hold the phone closer, in good light")); return; }
    setText(t); setShown(""); setPlain("");
  };
  useEffect(() => { if (img && !text) ocr(img); }, []);
  // as soon as the paper is read: say what it is (in the person's language), by code
  useEffect(() => { if (ex && ex.say.length) play(ex.say, ui, 0, "say"); }, [text]);
  const onFile = async (file) => { if (!file) return; const u = await shrink(file); if (!u) return; setImg(u); setText(""); await ocr(u); };
  const translate = async () => {
    if (!llm) return flash && flash(tr("Load a model in Engine to translate"));
    stop(); setBusy(tr("Translating…"));
    try { const res = await TR.translatePieces(R.sentences(text), llm, { lang: ui, language: ui === "ar" ? "Arabic" : "English" }); setShown(res.map((r) => r.text).join("\n")); }
    catch (e) { flash && flash(tr("Couldn't translate it")); }
    setBusy("");
  };
  const explainAI = async () => { if (!llm) return; setBusy(tr("Explaining…")); try { const out = await llm(R.explainPrompt(text, ui), null, { maxTokens: 220, temperature: 0.1 }); setPlain(String(out || "").trim()); } catch (e) {} setBusy(""); };
  const doAct = (a) => {
    if (a.type === "radar") { let d = D.loadRadar(); const r = D.addDeadline(d, { ...a.item, source: "read" }); D.saveRadar(r.data); if (!r.dup) { const rem = D.radarReminder(r.item); if (rem && remind) remind(rem); } flash && flash(r.dup ? tr("Already in Deadline Radar") : tr("Added to Deadline Radar — you'll be reminded")); }
    if (a.type === "care") { onClose(); window.dispatchEvent(new CustomEvent("attune-care", { detail: { text } })); }
    if (a.type === "money") { onClose(); window.dispatchEvent(new CustomEvent("attune-money", { detail: { text } })); }
  };
  const ACT = { radar: [Bell, "Remind me"], care: [Pill, "Add to Family health"], money: [Wallet, "Add to Money"] };
  const big = "min-h-[56px] rounded-2xl px-4 inline-flex items-center justify-center gap-2 text-[16px] font-semibold border-0 cursor-pointer";
  return (
    <div className="calm fixed inset-0 z-[80] flex items-end md:items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={() => { stop(); onClose(); }} data-testid="read-sheet" role="dialog" aria-label={tr("Read it to me")}>
      <div className="w-full md:max-w-2xl max-h-[94vh] overflow-auto rounded-t-[26px] md:rounded-[26px] p-4 md:p-6 space-y-3" style={{ background: "var(--c-bg)", color: "var(--c-ink)", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><b className="text-[18px] flex items-center gap-2"><Volume2 size={20} className="c-acc" />{tr("Read it to me")}</b>
          <button onClick={() => { stop(); onClose(); }} className="c-ic border-0 cursor-pointer" aria-label={tr("Close")} data-testid="read-close"><X size={16} /></button></div>
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onFile(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="read-camera-input" />
        <input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="read-file-input" />
        {!text && !busy ? (<div className="space-y-3 py-2">
          <p className="c-sub m-0 text-[14px]">{tr("Point the camera at any paper — a bill, a letter, a medicine box, a sign. I'll read it to you and tell you what to do.")}</p>
          <div className="grid md:grid-cols-2 gap-3">
            <button className={big} style={{ background: "var(--c-acc)", color: "var(--c-on-acc)" }} onClick={() => cam.current && cam.current.click()} data-testid="read-camera"><Camera size={22} />{tr("Take a photo")}</button>
            <button className={big} style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} onClick={() => pick.current && pick.current.click()} data-testid="read-pick"><ImagePlus size={22} />{tr("Choose a photo")}</button>
          </div></div>) : null}
        {busy ? <div className="flex flex-col items-center gap-3 py-6" aria-busy="true"><span className="w-16 h-16 rounded-full fit-pulse" style={{ background: "var(--c-acc)", opacity: 0.4 }} /><p className="m-0 text-[15px]">{busy}</p></div> : null}
        {text && ex ? (<>
          <div className="c-card space-y-1.5" data-testid="read-what">
            {ex.say.map((s, i) => <p key={i} className={"m-0 " + (i === 0 ? "text-[17px] font-bold" : "text-[15px]")} dir="auto">{s}</p>)}
            {ex.todo.map((s, i) => <p key={"t" + i} className="m-0 c-warn text-[14px]" dir="auto">{s}</p>)}
            {plain ? <p className="m-0 text-[14px] pt-1" dir="auto" data-testid="read-plain"><Sparkles size={13} className="inline me-1 c-acc" />{plain}<span className="c-sub block">{tr("Explained by the AI from the paper — check anything important with someone you trust.")}</span></p> : null}
            {ex.actions.length ? <div className="flex flex-wrap gap-2 pt-1">{ex.actions.map((a, i) => { const [Ic, l] = ACT[a.type]; return <button key={i} className="c-btn inline-flex items-center gap-1.5 min-h-[44px]" onClick={() => doAct(a)} data-testid={"read-act-" + a.type}><Ic size={16} />{tr(l)}{a.type === "radar" && a.item.date ? " · " + a.item.date : ""}</button>; })}</div> : null}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={big + " flex-1"} style={{ background: "var(--c-acc)", color: "var(--c-on-acc)" }} onClick={() => (playing === "all" ? stop() : play(lines, voiceLang, 0, "all"))} data-testid="read-play">{playing === "all" ? <Pause size={22} /> : <Play size={22} />}{playing === "all" ? tr("Pause") : tr("Read it all")}</button>
            <button className={big} style={{ background: slow ? "var(--c-acc-2)" : "var(--c-soft)", color: slow ? "var(--c-on-acc-2)" : "var(--c-acc)" }} onClick={() => setSlow((v) => !v)} aria-pressed={slow} data-testid="read-slow">{tr("Slower")}</button>
          </div>
          <div className="flex gap-3 flex-wrap">
            {voiceLang !== ui ? <button className="c-sub underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" onClick={translate} data-testid="read-translate"><Languages size={14} />{tr("Read it in my language")}</button> : null}
            {llm ? <button className="c-sub underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" onClick={explainAI} data-testid="read-explain"><Sparkles size={14} />{tr("Explain it simply")}</button> : null}
            <button className="c-sub underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" onClick={() => { stop(); setText(""); setImg(""); setShown(""); }}><Camera size={14} />{tr("Another paper")}</button>
          </div>
          <div className="c-card space-y-1" data-testid="read-text">
            {lines.map((s, i) => <p key={i} className="m-0 text-[17px] leading-relaxed rounded-[10px] px-1.5 cursor-pointer" dir="auto" style={{ background: i === at ? "var(--c-soft)" : "transparent", fontWeight: i === at ? 700 : 400 }} onClick={() => play(lines, voiceLang, i, "all")}>{s}</p>)}
          </div>
          {img ? <img src={img} alt="" className="w-full rounded-[22px] max-h-64 object-contain" style={{ background: "var(--c-surf)" }} /> : null}
        </>) : null}
      </div>
    </div>);
}

/** Mounted once in the app. */
export function ReadHost(props) {
  const [d, setD] = useState(null);
  useEffect(() => { const on = (e) => setD({ ...(e.detail || {}), k: Date.now() }); window.addEventListener("attune-read", on); return () => window.removeEventListener("attune-read", on); }, []);
  if (!d) return null;
  return <ReadSheet key={d.k} init={d} {...props} onClose={() => setD(null)} />;
}
