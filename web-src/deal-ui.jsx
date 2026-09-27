/* ---- More → Deal Check (v5.33) ---------------------------------------------------------------
   "Before you pay or sign, ask Attune." Paste an offer / seller's message, or add a screenshot;
   the logic (true cost, real interest, market price, scam signs, verdict) is in deal.js — code,
   not the model. The model reads the offer into fields and writes the reply to the seller. */
import React, { useState, useRef } from "react";
import { ShieldCheck, ImagePlus, X, Loader2, Check, Copy, Send, AlertTriangle, Trash2, Calculator, Search } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as D from "./deal.js";
import { useSubBack, useSticky } from "./backstack.js";

const HKEY = "attune:deals:v1";
const loadH = () => { try { const v = JSON.parse(localStorage.getItem(HKEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveH = (v) => { try { localStorage.setItem(HKEY, JSON.stringify(v.slice(0, 20))); } catch (e) {} };

const LEVELS = {
  scam: { en: "Looks like a scam", ar: "شكلها نصب", cls: "border-rose-700 bg-rose-500/10 text-rose-200", dot: "bg-rose-400" },
  risky: { en: "Risky — be careful", ar: "فيها مخاطرة — خلي بالك", cls: "border-amber-700 bg-amber-500/10 text-amber-200", dot: "bg-amber-400" },
  overpriced: { en: "Overpriced", ar: "غالية", cls: "border-orange-700 bg-orange-500/10 text-orange-200", dot: "bg-orange-400" },
  fair: { en: "Fair price", ar: "سعر معقول", cls: "border-sky-700 bg-sky-500/10 text-sky-200", dot: "bg-sky-400" },
  good: { en: "Good deal", ar: "صفقة كويسة", cls: "border-emerald-700 bg-emerald-500/10 text-emerald-200", dot: "bg-emerald-400" },
  unknown: { en: "No red flags found", ar: "مفيش علامات خطر واضحة", cls: "border-slate-700 bg-slate-800/40 text-slate-200", dot: "bg-slate-400" },
};
const STEPS = ["Reading the offer", "Working out the real cost", "Checking market prices", "Looking for traps", "Writing your reply"];

/** A photo → {media, data, url}, shrunk to 1280 px so the model reads it quickly. */
function readPhoto(file) {
  return new Promise((ok, bad) => {
    const r = new FileReader();
    r.onerror = () => bad(new Error("Couldn't read that picture"));
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1280 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.88);
        ok({ media: "image/jpeg", data: url.split(",")[1], url });
      };
      img.onerror = () => bad(new Error("Couldn't read that picture"));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

export function DealCheck({ llm, webPages, native, flash, openEngine, modelReady, pro, openPlan }) {
  const ar = getLang() === "ar";
  const L = (x) => (ar ? x.ar : x.en);
  const [text, setText] = useSticky("deal:text", "");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(-1);
  const [res, setRes] = useSticky("deal:res", null);
  useSubBack(!!res, () => setRes(null));   // v5.34: Back → a new check
  const [err, setErr] = useState("");
  const [hist, setHist] = useState(loadH);
  const run = useRef(0);
  const fileRef = useRef(null);
  const fmt = (v, cur) => (v == null || !isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US") + (cur ? " " + cur : ""));

  const check = async () => {
    if (!text.trim() && !photo) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    // Free: 3 checks a day; Pro: unlimited
    const today = new Date().toISOString().slice(0, 10);
    const usedToday = hist.filter((h) => h.day === today).length;
    if (!pro && usedToday >= 3) { flash && flash(tr("Free includes 3 deal checks a day — Pro is unlimited")); openPlan && openPlan(); return; }
    const me = ++run.current;
    setBusy(true); setErr(""); setRes(null); setStep(0);
    const alive = () => run.current === me;
    try {
      // 1. the model reads the offer into fields (JSON)
      let terms = null;
      try { terms = D.parseTerms(await llm(D.extractMessages(text.trim(), !!photo), photo, { json: true, maxTokens: 500, temperature: 0 })); }
      catch (e) { if (photo && /photo/i.test(String(e.message))) throw e; }
      if (!alive()) return;
      const allText = [text, terms && terms.text, terms && terms.claims.join(". ")].filter(Boolean).join("\n");
      if (!terms) {       // no model reading: what code can find in the text itself
        const p = D.pricesIn(text)[0];
        terms = { item: text.trim().split("\n")[0].slice(0, 80), kind: "other", price: p ? p.value : null, currency: p ? p.cur : null, cash: null, down: null, monthly: null, months: null, fees: null, seller: null, claims: [], text: "" };
      }
      // v5.41: installment plans are read by code from the text itself (the model mixed up "X or N × M")
      const plans = D.plansIn(text);
      if (plans.length) {
        const pl0 = plans[0];
        terms.monthly = pl0.monthly; terms.months = pl0.months;
        if (pl0.cash) { terms.cash = pl0.cash; terms.down = pl0.down || 0; }
        else if (pl0.down != null) terms.down = pl0.down;
        else if (terms.down && terms.down === terms.cash) terms.down = 0;
      }
      if (!terms.currency) terms.currency = (D.pricesIn(allText)[0] || {}).cur || (ar ? "EGP" : null);
      // 2. the real cost of an installment plan — by code
      setStep(1);
      const plan = D.planCost({ cash: terms.cash || terms.price, down: terms.down || 0, monthly: terms.monthly, months: terms.months, fees: terms.fees || 0 });
      // 3. the market price from the web — by code
      setStep(2);
      let market = null, sources = [];
      if (webPages && terms.item && terms.kind !== "investment") {
        try {
          const r = await webPages(D.marketQuery(terms.item, ar ? "ar" : "en"), 6);
          if (!alive()) return;
          const mf = D.marketFrom((r && r.hits) || [], terms.currency, terms.cash || terms.price);
          market = mf.market; sources = mf.sources.map((h) => ({ title: String(h.title || "").slice(0, 80), url: h.url }));
        } catch (e) {}
      }
      // 4. scam and trap signs — by code
      setStep(3);
      const signs = D.scamSigns(allText);
      const mm = D.priceMismatch(text, plans[0]);
      if (mm) signs.push({ id: "two-prices", weight: 2, en: `Two very different prices in one offer (${Math.round(mm.hi).toLocaleString("en-US")} and ${Math.round(mm.lo).toLocaleString("en-US")}) — ask which is real; a bait price is a common trick.`,
        ar: `سعرين مختلفين جدًا في نفس العرض (${Math.round(mm.hi).toLocaleString("en-US")} و ${Math.round(mm.lo).toLocaleString("en-US")}) — اسأل أنهي الحقيقي؛ السعر الطُعم حيلة مشهورة.` });
      const v = D.verdict({ price: terms.cash || terms.price, cur: terms.currency, market, plan, signs, claimsZero: signs.some((s) => s.id === "zero-interest") });
      const qs = D.questionsFor(v, signs, terms.kind);
      // 5. the reply to the seller — written by the model
      setStep(4);
      let msg = "";
      try { msg = await llm(D.messageMessages(terms, v, ar ? "ar" : "en", qs), null, { maxTokens: 320, temperature: 0.4 }); } catch (e) {}
      if (!alive()) return;
      const out = { id: Date.now().toString(36), day: today, at: Date.now(), terms, plan, market, sources, signs, v, qs, msg: String(msg || "").trim(), input: text.trim().slice(0, 400), photo: !!photo };
      setRes(out);
      const h2 = [out, ...hist].slice(0, 20); setHist(h2); saveH(h2);
    } catch (e) {
      if (alive()) setErr(tr(String((e && e.message) || e)));
    } finally { if (alive()) { setBusy(false); setStep(-1); } }
  };

  const sendWhatsApp = (m) => {
    if (native && native.intent) { try { native.intent(JSON.stringify({ kind: "whatsapp", message: m })); return; } catch (e) {} }
    window.open("https://wa.me/?text=" + encodeURIComponent(m), "_blank");
  };

  const lv = res ? LEVELS[res.v.level] || LEVELS.unknown : null;
  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="deal">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><ShieldCheck size={19} className="text-emerald-300" />{tr("Deal Check")}</h2>
        <p className="text-[12.5px] text-slate-400 leading-relaxed mt-1">{tr("Before you pay or sign: paste the offer, the seller's message or an installment plan — or add a screenshot. Attune works out the real cost, checks the market price, looks for scam signs and writes your reply.")}</p>
      </div>

      <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" rows={5} data-testid="deal-input"
          placeholder={tr("e.g. “iPhone 15 Pro 256GB, like new, 38,000 EGP, deposit on Vodafone Cash to hold it”  ·  “12,400 EGP or 3 × 4,133 with valU”")}
          className="att-scroll w-full min-h-[7rem] max-h-[40vh] bg-slate-950 border border-slate-800 rounded-xl p-3 text-[15px] leading-relaxed text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-emerald-500" />
        {photo ? (
          <div className="relative mt-2 inline-block">
            <img src={photo.url} alt="" className="max-h-40 rounded-lg border border-slate-700" data-testid="deal-photo" />
            <button onClick={() => setPhoto(null)} aria-label={tr("Remove")} className="absolute -top-2 -end-2 p-1.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300"><X size={14} /></button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 mt-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="deal-file"
            onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setPhoto(await readPhoto(f)); } catch (x) { setErr(tr(x.message)); } }} />
          <button onClick={() => fileRef.current && fileRef.current.click()} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm"><ImagePlus size={16} />{tr("Screenshot")}</button>
          <button onClick={busy ? () => { run.current++; setBusy(false); setStep(-1); } : check} disabled={!busy && !text.trim() && !photo} data-testid="deal-go"
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40 ${busy ? "bg-rose-500/20 border border-rose-800 text-rose-200" : "bg-emerald-500 text-slate-950"}`}>
            {busy ? <><X size={15} />{tr("Stop")}</> : <><Calculator size={16} />{tr("Check this deal")}</>}
          </button>
        </div>
        {busy ? (
          <ol className="mt-3 space-y-1.5" data-testid="deal-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={`flex items-center gap-2 text-[12.5px] ${i < step ? "text-emerald-300" : i === step ? "text-slate-100" : "text-slate-600"}`}>
                {i < step ? <Check size={13} /> : i === step ? <Loader2 size={13} className="animate-spin" /> : <span className="w-[13px]" />}{tr(s)}
              </li>
            ))}
          </ol>
        ) : null}
        {err ? <p className="mt-3 text-[12.5px] text-rose-300">{err}</p> : null}
      </section>

      {res ? (
        <section className="space-y-3" data-testid="deal-result">
          <div className={`rounded-2xl border p-4 ${lv.cls}`} data-testid="deal-verdict" data-level={res.v.level}>
            <p className="text-[11px] uppercase tracking-wider opacity-80">{res.terms.item || tr("This offer")}</p>
            <p className="text-xl font-bold mt-1 flex items-center gap-2"><span className={`w-2.5 h-2.5 rounded-full ${lv.dot}`} />{L(lv)}</p>
            {res.v.target ? <p className="text-[13px] mt-1.5">{tr("Ask for about {p}", { p: fmt(res.v.target, res.terms.currency) })}</p> : null}
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{tr("The numbers (worked out by the phone)")}</p>
            <table className="w-full text-[13px]" data-testid="deal-numbers"><tbody>
              <tr><td className="py-1 text-slate-400">{tr("Asked price")}</td><td className="py-1 text-end text-slate-100">{fmt(res.terms.cash || res.terms.price, res.terms.currency)}</td></tr>
              {res.plan ? <>
                <tr><td className="py-1 text-slate-400">{tr("You pay in total")}</td><td className="py-1 text-end text-slate-100" data-testid="deal-total">{fmt(res.plan.total, res.terms.currency)}</td></tr>
                {isFinite(res.plan.extra) ? <tr><td className="py-1 text-slate-400">{tr("More than cash")}</td><td className={`py-1 text-end ${res.plan.extra > 0 ? "text-amber-300" : "text-emerald-300"}`}>{fmt(res.plan.extra, res.terms.currency)}</td></tr> : null}
                {res.plan.yearlyRate != null ? <tr><td className="py-1 text-slate-400">{tr("Real yearly interest")}</td><td className="py-1 text-end text-slate-100" data-testid="deal-rate">{Math.round(res.plan.yearlyRate * 100)}%</td></tr> : null}
              </> : null}
              {res.market ? <tr><td className="py-1 text-slate-400">{tr("Market price")}</td><td className="py-1 text-end text-slate-100" data-testid="deal-market">{fmt(res.market.low)}–{fmt(res.market.high, res.terms.currency)}</td></tr>
                : <tr><td className="py-1 text-slate-400">{tr("Market price")}</td><td className="py-1 text-end text-slate-500">{webPages ? tr("not found online") : tr("turn on the internet to compare")}</td></tr>}
            </tbody></table>
            {res.market && (res.terms.cash || res.terms.price) ? (() => {
              const lo = Math.min(res.market.low, res.terms.cash || res.terms.price) * 0.9, hi = Math.max(res.market.high, res.terms.cash || res.terms.price) * 1.1;
              const pos = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
              return (
                <div className="relative h-2 mt-3 rounded-full bg-slate-800" dir="ltr" aria-hidden="true">
                  <div className="absolute h-2 rounded-full bg-emerald-500/40" style={{ left: pos(res.market.low) + "%", width: Math.max(2, pos(res.market.high) - pos(res.market.low)) + "%" }} />
                  <div className="absolute -top-1 w-1 h-4 rounded bg-white" style={{ left: "calc(" + pos(res.terms.cash || res.terms.price) + "% - 2px)" }} />
                </div>
              );
            })() : null}
          </div>

          {res.v.reasons.length ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{tr("Why")}</p>
              <ul className="space-y-1.5" data-testid="deal-reasons">
                {res.v.reasons.map((r, i) => <li key={i} className="text-[13px] text-slate-200 flex gap-2"><AlertTriangle size={13} className="text-amber-300 mt-0.5 shrink-0" />{L(r)}</li>)}
              </ul>
            </div>
          ) : null}

          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{tr("Ask the seller")}</p>
            <ul className="space-y-1.5">{res.qs.map((q, i) => <li key={i} className="text-[13px] text-slate-200">• {L(q)}</li>)}</ul>
          </div>

          {res.msg ? (
            <div className="bg-slate-900 rounded-2xl border border-emerald-900/60 p-4" data-testid="deal-message">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{tr("Your reply, ready to send")}</p>
              <p dir="auto" className="text-[14px] text-slate-100 whitespace-pre-wrap leading-relaxed">{res.msg}</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { try { navigator.clipboard.writeText(res.msg); } catch (e) {} flash && flash(tr("Copied")); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-slate-200 text-[13px]"><Copy size={14} />{tr("Copy")}</button>
                <button onClick={() => sendWhatsApp(res.msg)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-[13px] font-semibold" data-testid="deal-whatsapp"><Send size={14} />{tr("Send on WhatsApp")}</button>
              </div>
            </div>
          ) : null}

          {res.sources.length ? (
            <div className="px-1" data-testid="deal-sources">
              <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1"><Search size={11} />{tr("Prices found on")}</p>
              {res.sources.map((s, i) => <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="block text-[12px] text-teal-300 truncate">[{i + 1}] {s.title} · {String(s.url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</a>)}
            </div>
          ) : null}
          <p className="text-[11px] text-slate-500 px-1">{tr("The maths and the verdict are worked out by code on your phone; only the item's name is searched online. It's advice — check anything important yourself.")}</p>
          <button onClick={() => { setRes(null); setText(""); setPhoto(null); }} data-testid="deal-new"
            className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm">{tr("Check another deal")}</button>
        </section>
      ) : null}

      {!res && !busy && hist.length ? (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Earlier checks")}</p>
            <button onClick={() => { setHist([]); saveH([]); }} aria-label={tr("Clear")} className="p-1.5 text-slate-500 hover:text-rose-300"><Trash2 size={14} /></button>
          </div>
          {hist.slice(0, 8).map((h) => (
            <button key={h.id} onClick={() => setRes(h)} className="w-full flex items-center justify-between gap-2 py-2 border-b border-slate-800 last:border-0 text-start">
              <span className="text-[13px] text-slate-200 truncate">{h.terms.item || h.input.slice(0, 50)}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md border shrink-0 ${(LEVELS[h.v.level] || LEVELS.unknown).cls}`}>{L(LEVELS[h.v.level] || LEVELS.unknown)}</span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}
