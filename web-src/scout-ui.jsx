/* ---- v6.28 Scout (mode "scout") — goals that hunt for days. Left: a new goal (examples) and your goals; right: the selected goal's
   finds, best first — each with every wish ✓ / ✗ / "not stated" quoting the ad, the fair price, a price drop, the same ad on other
   sites, 👍 / 👎, the ad, and a ready message to the seller. Runs: "Check now", and by itself when Attune opens (each goal at most
   twice a day; the computer app also while it stays open). A strong NEW find (or a price drop) → a notification.
   Logic: scout.js. Tests: tests/unit/v731scout.test.mjs, tests/e2e_v731scout.py.                                                   */
import React, { useEffect, useState } from "react";
import { Binoculars, Plus, RefreshCw, Trash2, ThumbsUp, ThumbsDown, ExternalLink, Copy, Check, X, HelpCircle, TrendingDown, Loader2, Pause, Play, MapPin, AlertTriangle, Bell, BellOff } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as S from "./scout.js";
import * as K from "./ui-kit.jsx";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

// v6.31 minimal: two examples are enough to show the idea
const MINIMAL = (() => { try { return localStorage.getItem("attune:legacy-nav") !== "1"; } catch (e) { return true; } })();
const EXAMPLES = [
  ["3-bedroom flat for rent in Maadi under 15,000, not ground floor, near the metro", "شقة ٣ غرف للإيجار في المعادي أقل من ١٥ ألف مش دور أرضي قريبة من المترو"],
  ["Hyundai Tucson 2019 to 2021 under 900k, one owner, no accident, automatic", "هيونداي توسان من 2019 لـ 2021 أقل من 900 ألف أول مالك بدون حوادث أوتوماتيك"],
  ["iPhone 16 Pro 256GB new under 70,000", "ايفون 16 برو 256 جيجا جديد أقل من 70 ألف"],
  ["Data analyst job in Cairo, remote, full-time", "وظيفة محلل بيانات في القاهرة عن بعد دوام كامل"],
  ["Plumber in Nasr City, available this week", "سباك في مدينة نصر فاضي الأسبوع ده"],
];
const KIND = { gold: ["Gold price", "سعر الدهب"], rent: ["Flat to rent", "شقة للإيجار"], "buy-home": ["Home to buy", "عقار للشراء"], car: ["Car", "سيارة"], product: ["Product", "منتج"], job: ["Job", "وظيفة"], tender: ["Tender", "مناقصة"], service: ["Service / supplier", "خدمة / مورد"] };
const fmt = (v) => Math.round(v).toLocaleString("en-US");
const short = (v) => (v >= 1e6 ? (Math.round(v / 1e4) / 100) + "M" : v >= 1e4 ? Math.round(v / 1e3) + "k" : fmt(v));   // v7.9 "1.42M", "14k"

// v6.32 distance to the metro: each ad's area on the offline map pack (no web), its nearest station, kept so it is asked once
const ST_KEY = "attune:scout:stations:v1";
function useStations(goal, found, ar) {
  const [st, setSt] = useState(() => { try { return JSON.parse(localStorage.getItem(ST_KEY) || "{}"); } catch (e) { return {}; } });
  const call = typeof window !== "undefined" && window.__attuneNativeCall;
  const N = typeof window !== "undefined" && window.AttuneNative;
  const places = goal && S.wantsStation(goal.g) ? [...new Set(found.map((a) => a.facts.place || goal.g.place).filter(Boolean))].slice(0, 6) : [];
  const key = places.join("|");
  useEffect(() => {
    if (!call || !N || typeof N.mapSearch !== "function") return;
    const todo = places.filter((p) => !(p in st)); if (!todo.length) return;
    let live = true;
    (async () => {
      const add = {};
      for (const p of todo) {
        try {
          const at = S.pointFor(((await call("mapSearch", { q: p, limit: 10 })) || {}).places);
          if (!at) { add[p] = null; continue; }
          const r = await call("mapSearch", { q: "", kinds: ["transport/station"], limit: 50, lat: at.lat, lon: at.lon, radiusDeg: 0.03 });
          add[p] = S.nearestStation(at.lat, at.lon, (r || {}).places, { ar });
        } catch (e) { /* no map pack: nothing shown */ }
      }
      if (!live || !Object.keys(add).length) return;
      setSt((o) => { const n = { ...o, ...add }; try { localStorage.setItem(ST_KEY, JSON.stringify(n)); } catch (e) {} return n; });
    })();
    return () => { live = false; };
  }, [key]);
  return st;
}

// v6.32 the photo check: each ad picture's fingerprint, made here from the small copy the search brought (no download), kept by ad
const PH_KEY = "attune:scout:photos:v1";
const greyOf = (src) => new Promise((res) => {
  const im = new Image();
  im.onload = () => { try { const c = document.createElement("canvas"); c.width = 9; c.height = 8; const x = c.getContext("2d"); x.drawImage(im, 0, 0, 9, 8);
    const d = x.getImageData(0, 0, 9, 8).data, g = []; for (let i = 0; i < 72; i++) g.push((299 * d[i * 4] + 587 * d[i * 4 + 1] + 114 * d[i * 4 + 2]) / 1000); res(g); } catch (e) { res(null); } };
  im.onerror = () => res(null); im.src = src; });
function usePhotoPrints(found) {
  const [h, setH] = useState(() => { try { return JSON.parse(localStorage.getItem(PH_KEY) || "{}"); } catch (e) { return {}; } });
  const todo = found.filter((a) => /^data:image\//.test(a.image || "") && !(a.id in h)).slice(0, 30);
  const key = todo.map((a) => a.id).join("|");
  useEffect(() => {
    if (!todo.length || typeof document === "undefined") return;
    let live = true;
    (async () => {
      const add = {};
      for (const a of todo) { const g = await greyOf(a.image); add[a.id] = g ? S.dhash(g) : ""; }
      if (!live) return;
      setH((o) => { const n = { ...o, ...add }; const ks = Object.keys(n); const keep = ks.length > 600 ? Object.fromEntries(ks.slice(-600).map((k) => [k, n[k]])) : n;
        try { localStorage.setItem(PH_KEY, JSON.stringify(keep)); } catch (e) {} return keep; });
    })();
    return () => { live = false; };
  }, [key]);
  return h;
}

/** One run of a goal with the app's own web search. search(q) → { hits }. → { goal (updated), tell: [ads worth a notification], run } */
export async function runScoutGoal(goal, search, onStep, now = Date.now(), { readPage = null, goldPrice = null } = {}) {
  // v6.35 gold: the price of a gram (by code from the world price and the exchange rate), not ads
  if (goal.g.kind === "gold") {
    let per = null; try { per = goldPrice ? await goldPrice(goal.g.karat || 21) : null; } catch (e) {}
    const c = S.goldCheck(goal.g, per);
    const g2 = { ...goal, lastRun: now, gold: [...(goal.gold || []), ...(per ? [[now, per]] : [])].slice(-60), lastCount: c.hit ? 1 : 0, lastHits: per ? 1 : 0 };
    const tell = c.hit && !(goal.gold || []).some(([t]) => now - t < 20 * 3600e3 && S.goldCheck(goal.g, (goal.gold || []).slice(-1)[0][1]).hit) ? [{ gold: true, perGram: per, karat: goal.g.karat }] : [];
    return { goal: g2, tell, run: { found: [], fresh: [] } };
  }
  // v6.35 followed ads: their pages are read again — a lower price or "sold" is told
  let goal0 = goal;
  if (readPage) for (const id of Object.keys(goal.follow || {})) {
    const ad = (goal.seen || []).find((s) => s.id === id); if (!ad || ad.sold) continue;
    let page = null; try { page = await readPage(ad.url); } catch (e) { page = null; }
    goal0 = S.followUpdate(goal0, id, page, now);
  }
  goal = goal0;
  // v6.43 (Ali: "fast"): four searches at a time instead of one after another
  const qs = S.searchesFor(goal.g), hits = [];
  let done = 0;
  const one = async (q) => { try { const r = await search(q); for (const h of (r && r.hits) || []) if (!hits.some((x) => x.url === h.url)) hits.push(h); } catch (e) { /* one site failing never stops the run */ } done++; onStep && onStep(done, qs.length, q); };
  onStep && onStep(0, qs.length, qs[0]);
  for (let i = 0; i < qs.length; i += 4) await Promise.all(qs.slice(i, i + 4).map(one));
  // (no ad page at all → the item's own words, plain — some sites only show up that way)
  if (!hits.some((h) => S.isAdPage(h.url, h.text || "", h.title || ""))) {
    for (const q of S.fallbackSearches(goal.g)) { try { const r = await search(q); for (const h of (r && r.hits) || []) if (!hits.some((x) => x.url === h.url)) hits.push(h); } catch (e) {} }
  }
  // v8.2 (Ali, 26 Oct: "in the scout it does not write the price, so how will I know if it found something useful"): a search
  // result often has no price in its few lines — the ad's own page is read for it (up to 8 new ads + 4 kept ones, 4 at a time)
  if (readPage) {
    const need = hits.filter((h) => S.isAdPage(h.url, h.text || "", h.title || "") && !S.readAd(h, goal.g).facts.price).slice(0, 8);
    const old = (goal.seen || []).filter((a) => !a.sold && !(a.facts && a.facts.price) && !need.some((h) => h.url === a.url)).slice(-4);
    const jobs = [...need.map((h) => async () => { const p = await readPage(h.url); if (p && p.text) h.text = String(p.text).slice(0, 8000) + "\n" + (h.text || ""); }),
      ...old.map((a) => async () => { const p = await readPage(a.url); const pr = p && p.text ? S.readAd({ url: a.url, title: a.title, text: p.text }, goal.g).facts : null;
        if (pr && pr.price) goal = { ...goal, seen: (goal.seen || []).map((x) => (x.id === a.id ? { ...x, facts: { ...x.facts, price: pr.price, cur: pr.cur } } : x)) }; })];
    for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map((j) => j().catch(() => {})));
  }
  return finishRun(goal, hits, now);
}
/** v6.32: the same ending for a run's hits, whether searched now or found by the night run (ScoutNight.kt). */
export function finishRun(goal, hits, now = Date.now()) {
  const market0 = S.loadMarket();
  const run = S.runGoal(goal, hits, { now, market: market0 });
  // (the market book learns every priced ad, so the next goal for the same thing knows the market at once)
  S.saveMarket(S.addToMarket(market0, goal.g, run.seen.filter((a) => a.lastSeen === now), now));
  // (v6.29: the matches new this run stay "unseen" until the goal is opened — Home's "What's waiting" counts them)
  const unseen = [...new Set([...(goal.unseen || []), ...run.found.filter((a) => run.fresh.includes(a.id)).map((a) => a.id)])].slice(-50);
  return { goal: { ...goal, seen: run.seen, listSeen: run.listSeen, lastRun: now, lastCount: run.found.length, lastHits: hits.length, lastSites: [...new Set(hits.map((h) => S.siteOf(h.url)))].slice(0, 30), unseen }, tell: S.worthTelling(run), run };
}
export function tellText(goal, tell, ar) {
  if (tell[0] && tell[0].gold) return { title: ar ? `الدهب عيار ${tell[0].karat} وصل لهدفك` : `Gold ${tell[0].karat}K reached your price`, body: (ar ? "الجرام دلوقتي " : tr("A gram now ")) + fmt(tell[0].perGram) };
  if (tell[0] && tell[0].sold) return { title: ar ? "الإعلان اللي بتتابعه اتباع" : tr("An ad you follow has sold"), body: tell[0].title || "" };
  const a = tell[0], price = a.facts.price ? fmt(a.facts.price) + " " + (a.facts.cur || "") : "";
  const why = a.dropped > 0 ? (ar ? `انخفض ${fmt(a.dropped)}` : `dropped ${fmt(a.dropped)}`) : a.fair && a.fair.pct <= -5 ? (ar ? `أقل ${-a.fair.pct}% من المشابه` : `${-a.fair.pct}% below similar`) : "";
  return { title: (ar ? "الكشّاف: " + tell.length + " نتيجة جديدة قوية" : `Scout: ${tell.length} strong new find${tell.length === 1 ? "" : "s"}`) + " — " + (goal.g.what || goal.text).slice(0, 40),
    body: [a.title, price, why].filter(Boolean).join(" · ") };
}

export function ScoutPage({ search, remind, flash, openLink, incoming, clearIncoming, readPage, goldPrice }) {
  const ar = getLang() === "ar";
  const [data, setData] = useState(() => S.loadScout());
  // (v6.32: every change hands tonight's searches to the phone, so Scout keeps looking with Attune closed)
  const put = (d) => { setData(S.saveScout(d)); try { const N = window.AttuneNative; N && N.scoutNightPlan && N.scoutNightPlan(JSON.stringify(S.nightPlan(d))); } catch (e) {} };
  // v7.9 (Ali: Home's "Scout found 4 new" didn't take him to the ads): the goal with new finds opens first, its new ads marked
  // "New", first in the list, and scrolled to
  const [sel, setSel] = useState(() => { const gs = S.loadScout().goals; return ((gs.find((x) => (x.unseen || []).length) || gs[0]) || {}).id || null; });
  const [openAd, setOpenAd] = useState(null);       // v7.9 calm list: the ad whose details are open
  const [picking, setPicking] = useState(false), [picked, setPicked] = useState([]), [cmpOn, setCmpOn] = useState(false);   // select several → a table
  const [fresh] = useState(() => { const gs = S.loadScout().goals; const g0 = gs.find((x) => (x.unseen || []).length); return g0 ? g0.unseen : []; });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null);   // { id, i, n, q }
  const [copied, setCopied] = useState("");
  const goal = data.goals.find((x) => x.id === sel) || null;
  const run = async (gl) => {
    if (!search) { flash && flash(tr("Scout searches the web from the Android app or the computer app.")); return; }
    setBusy({ id: gl.id, i: 0, n: 0, q: "" });
    const r = await runScoutGoal(gl, search, (i, n, q) => setBusy({ id: gl.id, i, n, q }), Date.now(), { readPage, goldPrice });
    const d = S.loadScout(); put({ ...d, goals: d.goals.map((x) => (x.id === gl.id ? { ...r.goal, votes: x.votes, taste: x.taste, on: x.on, follow: { ...(r.goal.follow || {}), ...(x.follow || {}) } } : x)) });
    setBusy(null);
    if (r.tell.length && remind) { const t = tellText(gl, r.tell, ar); remind({ id: "scout-" + gl.id, at: Date.now() + 1500, repeat: "none", title: t.title, body: t.body }); }
    flash && flash(r.run.found.length ? tr("{n} matches found", { n: r.run.found.length }) : r.goal.lastHits ? tr("Nothing matches yet — Scout keeps looking") : tr("The sites didn't answer — try again in a while"));
  };
  const add = (t) => { const s = String(t || text).trim(); if (!s) return; const r = S.addGoal(data, s); put(r.data); setSel(r.goal.id); setText(""); setTimeout(() => run(r.goal), 50); };
  // a goal typed on Home ("find me a flat in Maadi…") arrives here and starts
  useEffect(() => { if (incoming && incoming.text) { add(incoming.text); clearIncoming && clearIncoming(); } }, [incoming && incoming.id]);
  const vote = (ad, up) => {
    const d = S.loadScout();
    put({ ...d, goals: d.goals.map((x) => (x.id !== goal.id ? x : { ...x, votes: { ...(x.votes || {}), [ad.id]: up ? 1 : -1 }, taste: S.learn(x.taste, ad, up) })) });
  };
  const view = goal ? S.runGoal(goal, [], { now: Date.now(), market: S.loadMarket() }) : null;
  const found = view ? [...view.found].sort((a, b) => fresh.includes(b.id) - fresh.includes(a.id)) : [];
  useEffect(() => { if (!fresh.length) return; const t = setTimeout(() => { const el = document.querySelector("[data-testid=scout-ad][data-new]"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 250); return () => clearTimeout(t); }, [sel]);
  const cmp = view ? view.compare : null;
  // v6.37 (D2): wait or buy — how long ads of this search stay up and how often their price drops (the market book)
  const book = goal ? (S.loadMarket()[S.marketKey(goal.g)] || []) : [];
  const follow = (ad) => { const d = S.loadScout(); put({ ...d, goals: d.goals.map((x) => (x.id === goal.id ? S.toggleFollow(x, ad.id) : x)) }); flash && flash((goal.follow || {})[ad.id] ? tr("Not following this ad") : tr("Following — you'll be told if the price drops or it sells")); };
  const stations = useStations(goal, found, ar);
  const twins = S.photoTwins(found, usePhotoPrints(found));
  // the goal on screen: its new matches are now seen
  useEffect(() => { if (goal && (goal.unseen || []).length && !busy) { const d = S.loadScout(); put({ ...d, goals: d.goals.map((x) => (x.id === goal.id ? { ...x, unseen: [] } : x)) }); } }, [sel, goal && (goal.unseen || []).length, !!busy]);
  const field = K.area;
  const left = (
    <div className="space-y-4">
      <div className={K.cardPad + " space-y-2.5"}>
        <span className={K.label}>{tr("What should Scout look for?")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" placeholder={tr("e.g. a 3-bedroom flat for rent in Maadi under 15,000, not ground floor")} className={field} style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="scout-text" />
        <button className={K.btnP} disabled={!text.trim()} onClick={() => add()} data-testid="scout-add"><Plus size={15} />{tr("Start scouting")}</button>
        <div className="flex flex-wrap gap-1.5 pt-1">{(MINIMAL ? EXAMPLES.slice(0, 2) : EXAMPLES).map(([en, a]) => <button key={en} onClick={() => setText(ar ? a : en)} className={K.chip(false) + " !whitespace-normal text-start !h-auto py-2"} dir="auto" data-testid="scout-example">{ar ? a : en}</button>)}</div>
      </div>
      {data.goals.length ? <div className="space-y-2" data-testid="scout-goals"><span className={K.label}>{tr("Your goals")}</span>
        {data.goals.map((x) => (
          <div key={x.id} className={K.card + " p-3.5 flex items-start gap-2"} style={x.id === sel ? { borderColor: "var(--c-acc-2)" } : {}} data-testid="scout-goal">
            <button className="flex-1 min-w-0 text-start" onClick={() => setSel(x.id)}>
              <b className="block text-[14.5px] font-extrabold" dir="auto">{x.g.what || x.text}</b>
              <span className="c-sub text-[12px]">{tr(KIND[x.g.kind] ? KIND[x.g.kind][0] : "Search")}{x.g.max ? " · ≤ " + fmt(x.g.max) : ""}{x.g.place ? " · " + x.g.place : ""} · {x.lastRun ? tr("{n} matches", { n: x.lastCount || 0 }) + " · " + new Date(x.lastRun).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : tr("not run yet")}{x.on === false ? " · " + tr("paused") : ""}</span>
              {busy && busy.id === x.id ? <span className="c-acc text-[12px] flex items-center gap-1 mt-0.5" data-testid="scout-busy"><Loader2 size={12} className="animate-spin" />{tr("Searching {i} of {n}…", { i: busy.i, n: busy.n })}</span> : null}
            </button>
            <button className="c-sub min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] hover:text-[var(--c-acc)]" aria-label={tr("Check now")} title={tr("Check now")} disabled={!!busy} onClick={() => run(x)} data-testid="scout-run"><RefreshCw size={15} /></button>
            <button className="c-sub min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] hover:text-[var(--c-acc)]" aria-label={x.on === false ? tr("Resume") : tr("Pause")} title={x.on === false ? tr("Resume") : tr("Pause")} onClick={() => put({ ...data, goals: data.goals.map((y) => (y.id === x.id ? { ...y, on: y.on === false } : y)) })}>{x.on === false ? <Play size={15} /> : <Pause size={15} />}</button>
            <button className="c-sub min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] hover:text-[var(--c-neg)]" aria-label={tr("Delete")} onClick={() => { put({ ...data, goals: data.goals.filter((y) => y.id !== x.id) }); if (sel === x.id) setSel(null); }}><Trash2 size={15} /></button>
          </div>))}</div> : null}
      <p data-intro="" className="c-sub text-[12px] m-0">{tr("Scout checks each goal when you open Attune (at most twice a day), once at night on the phone, and whenever you tap Check now, and tells you only about strong new finds or price drops. It reads public ads only and never contacts anyone or pays for you.")}</p>
    </div>);
  const results = goal ? (
    <div className="space-y-3" data-testid="scout-results">
      <div className={K.cardPad + " space-y-1.5"}><b className="text-[16px] font-extrabold" dir="auto">{goal.g.what || goal.text}</b>
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {goal.g.max ? <span className="c-pill">≤ {fmt(goal.g.max)}</span> : null}{goal.g.place ? <span className="c-pill">{goal.g.place}</span> : null}
          {goal.g.wish.map((w) => <span key={w.k} className="c-pill">{ar ? w.say[1] : tr(w.say[0])}</span>)}</div>
        {/* v7.9 (Ali picked the calm list): new · cheapest · fair price, at a glance */}
        {found.length && goal.g.kind !== "gold" ? (() => { const ps = found.map((a) => a.facts.price).filter((v) => v > 0); return <div className="grid grid-cols-3 gap-2 pt-2" data-testid="scout-numbers">
          <div><b className="block c-num text-[20px] font-black c-acc">{found.filter((a) => fresh.includes(a.id)).length}</b><span className="c-sub text-[11.5px]">{tr("new")}</span></div>
          {/* v8.7 (Ali: "how do I open the cheapest?"): the number is a button — it opens that ad and brings it into view */}
          {(() => { const lo = ps.length ? found.filter((a) => a.facts.price > 0).reduce((m, a) => (a.facts.price < m.facts.price ? a : m)) : null;
            return <button type="button" disabled={!lo} className="text-start min-h-[44px] rounded-[12px] hover:text-[var(--c-acc)] disabled:cursor-default" data-testid="scout-open-cheapest"
              onClick={() => { if (!lo) return; setOpenAd(lo.id); setTimeout(() => { const el = document.querySelector('[data-ad="' + lo.id + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 60); }}>
              <b className="block c-num text-[20px] font-black">{ps.length ? short(Math.min(...ps)) : "—"}</b><span className="c-sub text-[11.5px] underline decoration-dotted underline-offset-2">{tr("cheapest")}{lo ? " ›" : ""}</span></button>; })()}
          <div><b className="block c-num text-[20px] font-black">{cmp && cmp.med ? short(cmp.med) : "—"}</b><span className="c-sub text-[11.5px]">{tr("fair price")}</span></div></div>; })() : null}</div>
      {goal.g.kind === "gold" ? <div className={K.cardPad + " space-y-1"} data-testid="scout-gold">
        <span className={K.label}>{tr("Gold {k}K, a gram", { k: goal.g.karat || 21 })}</span>
        {(goal.gold || []).length ? <b className="c-amt">{fmt(goal.gold.slice(-1)[0][1])}</b> : <p className="c-sub m-0">{tr("Checking the price…")}</p>}
        <p className="c-sub m-0 text-[12px]">{goal.g.max ? tr("You'll be told when it is at or under {v}", { v: fmt(goal.g.max) }) : goal.g.min ? tr("You'll be told when it is at or over {v}", { v: fmt(goal.g.min) }) : tr("Add a price to be told, e.g. “under 3,500”")}</p>
      </div> : null}
      {goal.g.car && goal.g.car.note ? <p className="c-acc text-[13px] m-0" data-testid="scout-car-note" dir="auto">{ar ? goal.g.car.note[1] : tr(goal.g.car.note[0])}</p> : null}
      {!found.length && goal.g.kind !== "gold" ? <p className="c-sub" data-testid="scout-none">{goal.lastRun ? tr("Nothing that matches yet. Scout keeps looking — you'll be told when something good appears.") : tr("Searching…")}</p> : null}
      {found.length > 1 && goal.g.kind !== "gold" ? <div className="flex items-center justify-between gap-2 px-1">
        <span className="font-extrabold text-[14.5px]">{tr("{n} matches", { n: found.length })}</span>
        <button onClick={() => { setPicking((v) => !v); setPicked([]); setCmpOn(false); }} className="min-h-[44px] px-3 font-bold text-[13.5px] c-acc" data-testid="scout-select">{picking ? tr("Cancel") : tr("Select to compare")}</button></div> : null}
      {cmpOn && picked.length > 1 ? (() => { const T = S.compareAds(picked.map((id) => found.find((a) => a.id === id)).filter(Boolean)); return (
        <div className={K.cardPad + " space-y-2"} data-testid="scout-compare-table">
          <div className="flex items-center justify-between gap-2"><span className={K.label}>{tr("Side by side")}</span>
            <button onClick={() => setCmpOn(false)} className="min-w-[44px] min-h-[44px] grid place-items-center c-sub" aria-label={tr("Close")}><X size={16} /></button></div>
          <div className="overflow-x-auto -mx-1"><table className="w-full text-[12.5px] border-collapse">
            <thead><tr><th className="p-1.5" />{T.cols.map((c) => <th key={c.id} className="p-1.5 text-start align-bottom font-extrabold" dir="auto"><span className="line-clamp-2">{c.title}</span></th>)}</tr></thead>
            <tbody>{T.rows.map((r) => <tr key={r.k} className="border-t border-[var(--c-ln)]" data-testid={"scout-cmp-" + r.k}><td className="p-1.5 c-sub whitespace-nowrap">{ar ? r.ar : tr(r.en)}</td>
              {r.cells.map((c, i) => <td key={i} className={"p-1.5 c-num " + (c.best ? "font-black c-acc" : "")} dir="auto">{c.v === true ? "✓" : c.v === false ? "✗" : c.v == null ? "—" : typeof c.v === "number" && r.k !== "year" ? fmt(c.v) : String(c.v)}</td>)}</tr>)}</tbody>
          </table></div>
          <div className="flex flex-wrap gap-2">{T.cols.map((c) => <button key={c.id} className={K.btnS + " !min-h-[44px] !text-[12.5px]"} onClick={() => (openLink ? openLink(c.url, c.title) : window.open(c.url, "_blank"))}><ExternalLink size={13} />{c.site}</button>)}</div>
        </div>); })() : null}
      {found.slice(0, 30).map((a) => {
        const vote0 = (goal.votes || {})[a.id];
        const msg = S.sellerMessage(a, goal.g, { ar });
        return (
          <div key={a.id} className={K.cardPad + " space-y-2.5" + (picked.includes(a.id) ? " !border-[var(--c-acc)]" : "")} data-testid="scout-ad" data-ad={a.id} data-new={fresh.includes(a.id) ? "1" : undefined}>
            {/* v7.9 (Ali picked the calm list): one row — tap for the details, or pick it to compare */}
            <button className="w-full text-start flex items-center gap-3 min-h-[56px]" data-testid="scout-row" aria-expanded={openAd === a.id}
              onClick={() => (picking ? setPicked((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : p.length >= 4 ? p : [...p, a.id])) : setOpenAd((o) => (o === a.id ? null : a.id)))}>
              {picking ? <span className={"w-6 h-6 rounded-[12px] border-2 shrink-0 grid place-items-center " + (picked.includes(a.id) ? "bg-[var(--c-acc)] border-[var(--c-acc)] text-[var(--c-on-acc)]" : "border-[var(--c-ln)]")} data-testid="scout-pick">{picked.includes(a.id) ? <Check size={14} /> : null}</span> : null}
              {a.image ? <img src={a.image} alt="" className="w-[76px] h-[58px] object-cover rounded-[12px] shrink-0" /> : null}
              <span className="flex-1 min-w-0">
                {fresh.includes(a.id) ? <span className={K.tag("green") + " mb-0.5"} data-testid="scout-ad-new">{tr("New")}</span> : null}
                <b className="block text-[14.5px] font-extrabold leading-snug line-clamp-2" dir="auto">{a.title || a.site}</b>
                <span className="block c-sub text-[12px] truncate" dir="auto">{[a.site, a.facts.km ? fmt(a.facts.km) + " km" : null, a.facts.place].filter(Boolean).join(" · ")}{(a.also || []).length ? " · " + tr("also on {s}", { s: a.also.map((x) => x.site).join(", ") }) : ""}</span>
              </span>
              <span className="text-end shrink-0">{a.facts.price ? <span className="block c-num tabular-nums font-black text-[16px]" data-testid="scout-price">{fmt(a.facts.price)} <span className="c-sub text-[11px]">{a.facts.cur}</span></span>
                : <span className="block c-sub text-[11.5px] font-bold max-w-[92px] leading-tight" data-testid="scout-noprice">{tr("No price shown — open the ad")}</span>}
                <span className="block c-num tabular-nums text-[12px] font-extrabold c-acc" data-testid="scout-score">{a.score}/100</span></span>
            </button>
            {openAd !== a.id ? null : <>
            {(() => { const tm = S.timingOf(book, a); return tm && tm.verdict !== "steady" ? <p className={"text-[12.5px] " + (tm.verdict === "buy" ? "c-acc" : "c-sub")} data-testid="scout-timing" dir="auto">{tm.verdict === "buy" ? "⏱ " : "⏳ "}{S.timingText(tm, ar ? "ar" : "en")}</p> : null; })()}
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {a.fair ? <span className={"c-pill " + (a.fair.verdict === "high" || a.fair.verdict === "too-cheap" ? "late" : a.fair.verdict === "cheap" ? "" : "due")} data-testid="scout-fair" title={tr("Compared with {n} ads of the same thing", { n: a.fair.n })}>{tr(a.fair.verdict === "too-cheap" ? "Suspiciously cheap" : a.fair.verdict === "cheap" ? "Cheap" : a.fair.verdict === "high" ? "Expensive" : "Fair price")} · {a.fair.pct > 0 ? "+" : ""}{a.fair.pct}% · {tr("market {a}–{b}", { a: fmt(a.fair.low), b: fmt(a.fair.high) })}{a.fair.basis === "m2" ? " " + tr("(per m²)") : ""}</span>
                : null}
              {a.followed ? <span className="c-pill" data-testid="scout-following"><Bell size={11} className="inline" /> {a.sold ? tr("sold") : tr("following")}</span> : null}
              {a.cheapest ? <span className="c-pill" data-testid="scout-cheapest">{tr("cheapest of {n} stores", { n: a.cheapest })}</span> : null}
              {stations[a.facts.place || goal.g.place] ? (() => { const st = stations[a.facts.place || goal.g.place]; return <span className="c-pill" data-testid="scout-metro" title={tr("From the offline map: the area's centre to the station, in a straight line × 1.3")}><MapPin size={11} className="inline" /> {tr("{s}: about {m} min walk", { s: st.name, m: st.walk })}</span>; })() : null}
              {a.dropped > 0 ? <span className="c-pill" data-testid="scout-drop"><TrendingDown size={11} className="inline" /> {tr("dropped {v}", { v: fmt(a.dropped) })}</span> : null}
            </div>
            <ul className="m-0 p-0 list-none space-y-0.5 text-[13px]" data-testid="scout-checks">
              {a.check.ok.map((x) => <li key={"o" + x.k} className="flex gap-1.5"><Check size={14} className="c-pos shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : tr(x.en)}{x.quote ? <span className="c-sub"> — «{x.quote}»</span> : null}</span></li>)}
              {a.check.bad.map((x) => <li key={"b" + x.k} className="flex gap-1.5"><X size={14} className="c-neg shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : tr(x.en)}{x.quote ? <span className="c-sub"> — «{x.quote}»</span> : null}</span></li>)}
              {S.risksOf(a, goal.seen || [], twins[a.id] || []).filter((x) => x.k !== "photo").map((x) => <li key={"r" + x.k} className="flex gap-1.5" data-testid="scout-risk"><AlertTriangle size={14} className="c-neg shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : tr(x.en)}</span></li>)}
              {(twins[a.id] || []).slice(0, 1).map((x) => <li key="photo" className="flex gap-1.5" data-testid="scout-photo"><AlertTriangle size={14} className="c-neg shrink-0 mt-0.5" /><span dir="auto">{tr("The same photo is in another ad ({s}{p}) — it may be copied; ask for a new photo or a video call", { s: x.site || "", p: x.price ? " · " + fmt(x.price) : "" })}</span></li>)}
              {a.check.unknown.map((x) => <li key={"u" + x.k} className="flex gap-1.5 c-sub"><HelpCircle size={14} className="shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : tr(x.en)} — {tr("not stated in the ad")}</span></li>)}
            </ul>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <button className={K.btnP + " !h-11 !min-h-[44px] !px-4 !text-[13.5px]"} onClick={() => (openLink ? openLink(a.url, a.title) : window.open(a.url, "_blank"))} data-testid="scout-open"><ExternalLink size={14} />{tr("Open the ad")}</button>
              <button className="c-sub min-h-[44px] inline-flex items-center gap-1 px-1.5 font-bold hover:text-[var(--c-ink)]" onClick={() => { try { navigator.clipboard.writeText(msg); } catch (e) {} setCopied(a.id); flash && flash(tr("Message copied — paste it to the seller")); }} title={msg} data-testid="scout-msg">{copied === a.id ? <Check size={14} /> : <Copy size={14} />}{tr("Message to the seller")}</button>
              {S.offerFor(a) && S.offerFor(a) < a.facts.price ? <span className="c-sub text-[12px]" data-testid="scout-offer">{tr("Offer {v}", { v: fmt(S.offerFor(a)) })}</span> : null}
              <button className={"min-h-[44px] inline-flex items-center gap-1 px-1.5 font-bold " + (a.followed ? "c-acc" : "c-sub")} onClick={() => follow(a)} data-testid="scout-follow">{a.followed ? <BellOff size={14} /> : <Bell size={14} />}{a.followed ? tr("Unfollow") : tr("Follow price")}</button>
              <span className="ms-auto flex gap-1">
                <button className={"min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] " + (vote0 === 1 ? "c-acc" : "c-sub")} aria-label={tr("Good match")} onClick={() => vote(a, true)} data-testid="scout-up"><ThumbsUp size={15} /></button>
                <button className={"min-w-[44px] min-h-[44px] grid place-items-center rounded-[12px] " + (vote0 === -1 ? "c-neg" : "c-sub")} aria-label={tr("Not for me")} onClick={() => vote(a, false)} data-testid="scout-down"><ThumbsDown size={15} /></button></span>
            </div>
            </>}
          </div>); })}
      {picking && picked.length > 1 && !cmpOn ? <button className={K.btnP + " w-full sticky bottom-3 shadow-lg"} onClick={() => setCmpOn(true)} data-testid="scout-compare-go">{tr("Compare {n}", { n: picked.length })}</button> : null}
      {picking && picked.length < 2 ? <p className="c-sub text-[12.5px] m-0 text-center">{tr("Pick 2 to 4 ads to see them side by side")}</p> : null}
      {cmp && (cmp.prices || cmp.n) && goal.g.kind !== "gold" ? (
        <div className={K.cardPad + " space-y-1.5"} data-testid="scout-compare">
          <span className={K.label}>{tr("Compared")}</span>
          <p className="m-0 text-[14px]" dir="auto">{tr("{n} ads from {s} sites", { n: cmp.n, s: Object.keys(cmp.sites).length })}{goal.lastSites && goal.lastSites.length ? <span className="c-sub"> · {tr("{n} sites searched", { n: goal.lastSites.length })}</span> : null}</p>
          {cmp.low ? <p className="m-0 text-[14px]" data-testid="scout-range" dir="auto">{tr("Usual price")}: <b className="c-num">{fmt(cmp.low)} – {fmt(cmp.high)}</b> · {tr("typical")} <b className="c-num">{fmt(cmp.med)}</b> <span className="c-sub text-[12px]">({tr("from {n} prices, list pages and price guides included", { n: cmp.prices })})</span></p> : null}
          {cmp.best ? <p className="m-0 text-[13.5px]" data-testid="scout-best" dir="auto">⭐ {tr("Best value")}: {cmp.best.title} — <b className="c-num">{fmt(cmp.best.price)}</b> <span className="c-sub">({cmp.best.site})</span></p> : null}
          <div className="flex flex-wrap gap-1.5 text-[12px]">{Object.entries(cmp.sites).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s0, k]) => <span key={s0} className="c-pill">{s0}{k ? " · " + k : ""}</span>)}</div>
        </div>) : null}
    </div>) : <DeskEmpty icon={Binoculars} title={tr("Your finds appear here")} testid="scout-empty" />;
  return (
    <div className="calm bg-[var(--c-bg)] text-[var(--c-ink)] rounded-[20px] p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="scout-page">
      <div><h2 className={K.h1 + " flex items-center gap-2"}><Binoculars size={20} className="c-acc" />{tr("Scout")}</h2>
        <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("Say once what you're looking for — a flat, a car, a product, a job, a supplier. Scout searches the sites that matter, checks every wish against what each ad says, tells you if the price is fair, and lets you know when something good appears.")}</p></div>
      {/* v7.9 (Ali picked the calm list): on a phone the results come first when there is a goal; the form and the goals follow */}
      <div className={PANES + " flex flex-col"}><div className={LEFT + (goal ? " order-2 lg:order-none mt-4 lg:mt-0" : "")}>{left}</div><div className={RIGHT + (goal ? " order-1 lg:order-none !mt-0" : "")}>{results}</div></div>
    </div>);
}
