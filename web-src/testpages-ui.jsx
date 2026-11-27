/* ---- v10.9.9 B5 (Ali OK'd 27 Nov): Test every page, guided. A panel over the app: on the phone it shrinks to a "Back to the test" pill
   while you try the page; on the computer it stays at the side, next to the page. Logic: testpages.js. */
import React, { useMemo, useRef, useState } from "react";
import { X, Check, ChevronRight, Camera, Share2, Undo2, FlaskConical } from "lucide-react";
import { tr } from "./i18n.js";
import * as TP from "./testpages.js";

const shrink = (file) => new Promise((res) => {   // a screenshot → a small JPEG (≤ 900 px) so many fit in the report
  try { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const k = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement("canvas");
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", 0.62)); }; im.onerror = () => res(""); im.src = fr.result; };
    fr.onerror = () => res(""); fr.readAsDataURL(file); } catch (e) { res(""); } });
const b64of = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return ""; } };

export function TestPages({ open, onClose, pages, stores, version, navTo, wide, native, nativeCall, flash }) {
  // (the example words — "groceries", "passport" — and the page names in the person's language; their own words stay as written)
  const steps = useMemo(() => TP.stepsFor(pages || [], stores || {}).map((x) => ({ ...x, v: Object.fromEntries(Object.entries(x.v).map(([k, v]) => [k, (x.def || []).includes(k) ? tr(v) : v])) })), [pages, stores]);
  const [run, setRun0] = useState(() => { const r = TP.load(); return r && r.version === String(version) ? r : TP.fresh(version); });
  const setRun = (r) => { setRun0(r); TP.save(r); };
  const [mini, setMini] = useState(false), [note, setNote] = useState(""), [wrong, setWrong] = useState(false), [shot, setShot] = useState("");
  const fileRef = useRef(null);
  if (!open) return null;
  const c = TP.counts(run, steps), done = run.idx >= steps.length, s = done ? null : steps[Math.min(run.idx, steps.length - 1)];
  const answer = (r) => { let sh = ""; if (r === "bad" && shot) { sh = s.id; try { localStorage.setItem(TP.SHOT_KEY + s.id, shot); } catch (e) { sh = ""; } }
    setRun(TP.mark(run, steps, s.id, r, r === "bad" ? note : "", sh)); setNote(""); setWrong(false); setShot(""); };
  const tryIt = () => { try { navTo(s.id === "chat" ? "chat" : s.id); } catch (e) {} if (!wide) setMini(true); };
  const share = async () => {
    const shots = {}; for (const st of steps) { const x = run.res[st.id]; if (x && x.shot) { try { const v = localStorage.getItem(TP.SHOT_KEY + st.id); if (v) shots[st.id] = v; } catch (e) {} } }
    const text = TP.reportText(run, steps, tr), html = TP.reportHtml(run, steps, shots, tr), name = "attune-test-" + new Date().toISOString().slice(0, 10) + ".html";
    try { if (native && native.shareFile && nativeCall) { await nativeCall("shareFile", { name, mime: "text/html", b64: b64of(html), text: text.slice(0, 1500) }); return; } } catch (e) {}
    try { if (native && native.share) { native.share(text); return; } } catch (e) {}
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
    try { await navigator.clipboard.writeText(text); flash && flash(tr("The report is saved, and its text copied")); } catch (e) {}
  };
  const restart = () => { for (const st of steps) { try { localStorage.removeItem(TP.SHOT_KEY + st.id); } catch (e) {} } setRun(TP.fresh(version)); };
  const pct = Math.round(((steps.length - c.left) / Math.max(1, steps.length)) * 100);
  if (mini && !wide) return <button onClick={() => setMini(false)} data-testid="test-pill" data-solid=""
    className="calm fixed z-[95] end-3 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)] px-4 min-h-[44px] font-extrabold text-[13.5px] shadow-[0_6px_20px_rgba(0,0,0,.25)] inline-flex items-center gap-2"
    style={{ bottom: "calc(var(--nav-h, 58px) + 96px + env(safe-area-inset-bottom))" }}><FlaskConical size={16} />{tr("Back to the test · {i} of {n}", { i: Math.min(run.idx + 1, steps.length), n: steps.length })}</button>;
  const box = "rounded-[16px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3";
  return (
    <div data-testid="test-pages" data-solid="" role="dialog" aria-label={tr("Test every page")}
      className={"calm fixed z-[95] bg-[var(--c-surf)] text-[var(--c-ink)] border-[var(--c-ln)] shadow-[0_10px_40px_rgba(0,0,0,.25)] flex flex-col " + (wide ? "top-4 bottom-4 end-4 w-[380px] rounded-[20px] border" : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[22px] border-t")}
      style={wide ? undefined : { paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <FlaskConical size={18} className="text-[var(--c-acc)]" /><b className="flex-1 text-[17px]">{tr("Test every page")}</b>
        {!wide ? <button onClick={() => setMini(true)} className="min-h-[40px] px-3 rounded-full text-[13px] font-bold border border-[var(--c-ln)]" data-testid="test-hide">{tr("Hide")}</button> : null}
        <button onClick={onClose} className="w-10 h-10 grid place-items-center rounded-full" aria-label={tr("Close")} data-testid="test-close"><X size={17} /></button>
      </div>
      <div className="px-4"><div className="flex justify-between text-[12px] text-[var(--c-mut)] mb-1"><span>{done ? tr("Done") : tr("Page {i} of {n} · {p}", { i: run.idx + 1, n: steps.length, p: tr(s.label) })}</span><span>{tr("Version {v}", { v: run.version })}</span></div>
        <div className="h-2 rounded-full bg-[var(--c-ln)] overflow-hidden"><i className="block h-full bg-[var(--c-acc)]" style={{ width: pct + "%" }} /></div></div>
      <div className="overflow-y-auto att-scroll px-4 py-3 space-y-3 flex-1">
        {!done ? <>
          <div className={box} data-testid="test-step" data-id={s.id}><b className="block text-[14px] mb-1">{tr("1. Try this")}</b><p className="m-0 text-[15px]" dir="auto">{tr(s.try, s.v)}</p>
            <p className="m-0 mt-2 text-[12.5px] text-[var(--c-mut)]" dir="auto">{tr("Should: {e}", { e: tr(s.expect, s.v) })}</p>
            <button onClick={tryIt} className="mt-2 min-h-[40px] px-3 rounded-full text-[13px] font-bold border border-[var(--c-acc)] text-[var(--c-acc)] inline-flex items-center gap-1" data-testid="test-open">{tr("Open {p}", { p: tr(s.label) })}<ChevronRight size={14} className="rtl:rotate-180" /></button></div>
          <div className={box}><b className="block text-[14px] mb-2">{tr("2. Did it work?")}</b>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => answer("ok")} className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)] font-extrabold inline-flex items-center gap-1.5" data-testid="test-ok"><Check size={16} />{tr("Works")}</button>
              <button onClick={() => setWrong(true)} className={"min-h-[44px] px-4 rounded-[12px] border font-extrabold " + (wrong ? "border-[var(--c-neg)] text-[var(--c-neg)]" : "border-[var(--c-ln)]")} data-testid="test-bad">✗ {tr("Wrong")}</button>
              <button onClick={() => answer("skip")} className="min-h-[44px] px-4 rounded-[12px] border border-[var(--c-ln)] font-bold" data-testid="test-skip">{tr("Skip")}</button></div>
            {wrong ? <div className="mt-3 space-y-2">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} dir="auto" placeholder={tr("What was wrong?")} data-testid="test-note"
                className="w-full min-h-[72px] rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-2.5 text-[15px]" />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="test-shot-input" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) setShot(await shrink(f)); }} />
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => fileRef.current && fileRef.current.click()} className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] text-[13px] font-bold inline-flex items-center gap-1.5" data-testid="test-shot"><Camera size={14} />{shot ? tr("Screenshot added ✓") : tr("Add a screenshot")}</button>
                <button onClick={() => answer("bad")} className="ms-auto min-h-[40px] px-4 rounded-full bg-[var(--c-neg)] text-white text-[13px] font-extrabold" data-testid="test-bad-save">{tr("Save and next")}</button></div>
            </div> : null}
          </div>
          <p className="text-[12px] text-[var(--c-mut)] text-center m-0">{tr("You can stop any time and carry on later.")}</p>
        </> : null}
        <div className={box} data-testid="test-summary"><b className="block text-[14px] mb-1">{tr("{ok} work · {bad} wrong · {skip} skipped · {left} not tried", c)}</b>
          {steps.filter((x) => run.res[x.id]).slice(-6).reverse().map((x) => { const r = run.res[x.id]; return <div key={x.id} className="flex justify-between gap-2 text-[13px] py-1 border-t border-[var(--c-ln)]" data-testid="test-row" data-r={r.r}>
            <span className="truncate" dir="auto">{tr(x.label)}{r.note ? " · " + r.note : ""}</span><b className={r.r === "bad" ? "text-[var(--c-neg)]" : r.r === "ok" ? "text-[var(--c-pos,#1e7a43)]" : "text-[var(--c-mut)]"}>{r.r === "ok" ? "✓" : r.r === "bad" ? "✗" + (r.shot ? " 📷" : "") : "–"}</b></div>; })}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={share} disabled={!Object.keys(run.res).length} className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)] font-extrabold inline-flex items-center gap-1.5 disabled:opacity-40" data-testid="test-share"><Share2 size={15} />{tr("Share the list")}</button>
          <button onClick={restart} className="min-h-[44px] px-3 rounded-[12px] border border-[var(--c-ln)] font-bold inline-flex items-center gap-1.5" data-testid="test-restart"><Undo2 size={14} />{tr("Start again")}</button></div>
        <p className="text-[12px] text-[var(--c-mut)] m-0">{tr("Sends the list and your screenshots through your share sheet. Nothing is sent by itself.")}</p>
      </div>
    </div>);
}
