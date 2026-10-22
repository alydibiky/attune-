/* ---- v6.27 Travel — the page (mode "travel"), design A "Calm". Everything the old page had is here, in five quiet tabs:
   Trip (the country, your passport, entry rules, the papers, flights and hotels, Radar) · Arrive (the first hour, emergency,
   the key facts, money and the fair-price check) · Say it (hand-written phrases: copy, speak aloud, show big; a sign or a menu
   → Translate) · Ask · Know (overcharges, money, manners, health and everything else, folded).
   The logic is in travel.js (code decides; tests/unit/v727travel.test.mjs). Tests: tests/e2e_v727travel.py.               */
import React, { useEffect, useMemo, useState } from "react";
import { Plane, Languages, RefreshCw, Loader2, Copy, Volume2, AlertTriangle, Maximize2, X, Search, Camera, ShieldCheck, Bell, MapPin, Check } from "lucide-react";
import { tr } from "./i18n.js";
import * as T from "./travel.js";
import * as K from "./ui-kit.jsx";
import * as D from "./deadlines.js";
import { speakNow } from "./lesson-ui.jsx";
import { openOwed } from "./owed-ui.jsx";

const TABS = [["trip", "Trip"], ["arrive", "Arrive"], ["say", "Say it"], ["ask", "Ask"], ["know", "Know"]];
// v6.27 computer layout A: two equal columns inside a tab (one under the other on a phone)
const COLS = "lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start";
const field = K.inp.replace("w-full ", "");
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };
const PHRASE_TAGS = [["all", "All"], ["emergency", "🚨 Emergency"], ["transport", "🚕 Getting around"], ["food", "🍽 Eating"], ["shopping", "💰 Buying"], ["basics", "💬 Basics"]];
const AIRPORT = { tr: ["IST", "Istanbul"], eg: ["CAI", "Cairo"], sa: ["JED", "Jeddah"], ae: ["DXB", "Dubai"], fr: ["CDG", "Paris"], it: ["FCO", "Rome"], es: ["MAD", "Madrid"], jp: ["NRT", "Tokyo"],
  th: ["BKK", "Bangkok"], gr: ["ATH", "Athens"], ma: ["RAK", "Marrakech"], cn: ["PEK", "Beijing"], in: ["DEL", "Delhi"], gb: ["LHR", "London"], id: ["DPS", "Bali"], my: ["KUL", "Kuala Lumpur"],
  ge: ["TBS", "Tbilisi"], jo: ["AMM", "Amman"], de: ["FRA", "Frankfurt"], qa: ["DOH", "Doha"], kw: ["KWI", "Kuwait City"], om: ["MCT", "Muscat"], bh: ["BAH", "Manama"], lb: ["BEY", "Beirut"],
  tn: ["TUN", "Tunis"], pt: ["LIS", "Lisbon"], nl: ["AMS", "Amsterdam"], vn: ["SGN", "Ho Chi Minh City"], kr: ["ICN", "Seoul"], sg: ["SIN", "Singapore"], za: ["JNB", "Johannesburg"], mv: ["MLE", "Malé"],
  lk: ["CMB", "Colombo"], ke: ["NBO", "Nairobi"], tz: ["DAR", "Dar es Salaam"], az: ["GYD", "Baku"], uz: ["TAS", "Tashkent"], ba: ["SJJ", "Sarajevo"], al: ["TIA", "Tirana"], cy: ["LCA", "Larnaca"],
  ch: ["ZRH", "Zurich"], at: ["VIE", "Vienna"], us: ["JFK", "New York"] };

function Section({ title, right, children, testid }) {
  return (<section className={K.cardPad + " space-y-2.5"} data-testid={testid}>
    {title ? <div className="flex items-center justify-between gap-2"><p className={K.label + " m-0"}>{tr(title)}</p>{right || null}</div> : null}
    {children}</section>);
}
const List = ({ items, dir, warn }) => (
  <ul className="space-y-1.5 m-0 p-0 list-none" dir={dir}>{items.map((x, i) => <li key={i} className={"text-[13.5px] leading-snug ps-3 border-s-2 " + (warn ? "c-warn" : "")} style={{ borderColor: warn ? "var(--c-warn)" : "var(--c-ln)" }}>{tr(x)}</li>)}</ul>);

export function TravelPage(p) {
  const { CPACKS, activePack, installedPacks, installPack, packView, myLang, setMyLang, LANGS, langShown, countryShown, RTL_LANGS, translating,
    online, runSync, syncing, packFeed, netInfo, dateLocale, nationality, setNationality, NATIONALITIES, entry, tripChecklist, remember, flash,
    rates, convert, packCurrency, convAmt, setConvAmt, travelQ, setTravelQ, askTravel, travelA, loading, N, native, remind, openTranslate, openMap, openAgent } = p;
  const [tab, setTab] = useState("trip");
  // v6.28: a computer-width window (the layout A breakpoint) — the Trip tab places its flights block by it
  const [wide, setWide] = useState(() => { try { return window.matchMedia("(min-width: 1024px)").matches; } catch (e) { return false; } });
  useEffect(() => { try { const m = window.matchMedia("(min-width: 1024px)"); const on = () => setWide(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); } catch (e) {} }, []);
  const [pick, setPick] = useState(false);
  const [find, setFind] = useState("");
  const [phraseFilter, setPhraseFilter] = useState("");
  const [phraseTag, setPhraseTag] = useState("all");
  const [big, setBig] = useState(null);
  const [trip, setTripRaw] = useState(() => T.loadTrip());
  const setTrip = (patch) => setTripRaw((t) => T.saveTrip({ ...t, ...patch }));
  const [priceQ, setPriceQ] = useState("");
  const [radar, setRadar] = useState(() => D.loadRadar());
  const pack = activePack ? CPACKS[activePack] : null;
  const pv = (k) => (packView && packView[k]) || (pack && pack[k]) || [];
  const dirMine = RTL_LANGS.has(myLang) ? "rtl" : "ltr";
  const code = pack ? packCurrency(pack) : "";
  const conv = (a, from, to) => { const c = rates && convert(a, from, to, rates); return c ? c.value : null; };
  const shape = T.tripShape(trip);
  const pp = T.passportCheck(radar.items, { depart: trip.depart, ret: trip.ret });
  const air = AIRPORT[activePack] || ["", ""];
  const fair = priceQ.trim() && pack ? T.fairPrice(pack.costs, priceQ, { packCur: code, convert: conv }) : null;
  const others = useMemo(() => Object.entries(CPACKS).filter(([k, x]) => !installedPacks.includes(k) && (!find.trim() || (x.name + " " + countryShown(k, x.name)).toLowerCase().includes(find.trim().toLowerCase()))), [CPACKS, installedPacks, find]);

  const toRadar = () => {
    if (!shape.ok) return flash(tr(shape.issues[0]));
    let data = D.loadRadar(), n = 0;
    for (const d of T.tripDeadlines(trip, { country: pack.name, entryStatus: entry && entry.status })) {
      const c = countryShown(activePack, pack.name), title = d.title.startsWith("Trip to") ? tr("Trip to {c}", { c }) : tr("Visa for {c} — apply", { c });
      const note = d.note.startsWith("Back ") ? tr("Back {d}", { d: trip.ret }) : tr(d.note);
      const r = D.addDeadline(data, { ...d, title, note, source: "trip" }); data = r.data;
      if (!r.dup) { n++; const rem = D.radarReminder(r.item); if (rem && remind) remind(rem); }
    }
    D.saveRadar(data); setRadar(data);
    flash(n ? tr("Added to Deadline Radar — you'll be reminded") : tr("Already in Deadline Radar"));
  };
  const say = (ph) => speakNow(ph.loc, { lang: pack.lang, rate: 0.9, native });
  // v6.41 (D6): one trip pack — the parts and how many are ready; the map in one tap; flight numbers; the delay & claim watch
  const [mapOk, setMapOk] = useState(() => { try { const NN = native && native.N; const j = JSON.parse((NN && NN.mapPacks && NN.mapPacks()) || "{}"); return (j.packs || []).some((x) => x.code === activePack && x.installed); } catch (e) { return false; } });
  const [mapBusy, setMapBusy] = useState("");
  const [flightIn, setFlightIn] = useState("");
  const getMap = async () => {
    if (!native || !native.call || !native.N || !native.N.mapInstall) { flash(tr("Maps download in the Android app")); return; }
    setMapBusy(tr("Starting…"));
    try { await native.call("mapInstall", { code: activePack, routes: true }, (pct, name, detail) => setMapBusy(pct + "% · " + (detail || ""))); setMapOk(true); flash(tr("The map works with no internet now")); }
    catch (e) { flash(String((e && e.message) || e)); }
    setMapBusy("");
  };
  const watch = () => {
    const list = T.watchReminders(trip, pack && pack.name);
    if (!list.length) return flash(tr("Add the date and your flight numbers first"));
    for (const r of list) remind && remind({ ...r, title: tr(r.title.startsWith("Flight home") ? "Flight home: {n}" : "Flight day: {n}", { n: trip.flights.map((f) => f.no).join(", ") }), body: tr(r.body) });
    setTrip({ watch: true }); flash(tr("Watch on — you'll be reminded on each flight day"));
  };
  const tp = pack ? T.tripPack({ trip, country: activePack, mapInstalled: mapOk, passport: pp.status, entryStatus: entry && entry.status, watchSet: !!trip.watch }) : null;
  const PART = { map: "Offline map", phrases: "Phrasebook", money: "Money", papers: "Papers", flights: "Flights", watch: "Delay & claim watch" };

  const owedCard = (<>
          {/* v6.27 What you're owed: compensation for a delayed or cancelled flight, worked out by code */}
          <button onClick={() => openOwed({ flight: { from: trip.from || "", to: air[0] || "", date: trip.depart || "" } })} className={K.card + " w-full text-start p-3.5 min-h-[56px] flex items-center gap-3 cursor-pointer hover:border-[var(--c-acc)]"} data-testid="travel-owed">
            <span className="c-ic"><Plane size={16} /></span><span className="flex-1"><b className="block text-[14px]">{tr("Flight delayed or cancelled?")}</b><span className="c-sub">{tr("See what the airline owes you — up to €600 — and get the letter")}</span></span><span className="c-acc">›</span></button>
  </>);
  const book = (<>
          {/* flights and hotels: the agent's links, filled from the trip; you choose and pay */}
          <Section title="Flights and hotels" testid="travel-book">
            {!trip.from || !trip.depart ? <p className="c-sub m-0">{tr("Add where you fly from and the dates above.")}</p> : null}
            {T.tripFlights(trip, air[0]).map((l) => <button key={l.label} onClick={() => openAgent(l)} className="w-full min-h-[44px] flex items-center justify-between text-start bg-transparent border-0 p-0 py-1 cursor-pointer font-bold" style={{ color: "var(--c-ink)" }} data-testid="travel-flight"><span><Plane size={13} className="inline me-1.5 c-acc" />{l.label} <span className="c-sub">{trip.from} → {air[0]} · {tr(l.why)}</span></span><span className="c-acc">›</span></button>)}
            {T.tripHotels(trip, air[1]).map((l) => <button key={l.label} onClick={() => openAgent(l)} className="w-full min-h-[44px] flex items-center justify-between text-start bg-transparent border-0 p-0 py-1 cursor-pointer font-bold" style={{ color: "var(--c-ink)" }} data-testid="travel-hotel"><span><MapPin size={13} className="inline me-1.5 c-acc" />{l.label} <span className="c-sub">{air[1]} · {tr(l.why)}</span></span><span className="c-acc">›</span></button>)}
            {trip.from && trip.depart ? <p className="c-sub m-0">{tr("Attune opens the search with your dates and marks the best offer. You choose and pay.")}</p> : null}
          </Section>


  </>);
  return (
    <div className="calm bg-[var(--c-bg)] text-[var(--c-ink)] rounded-[22px] p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="travel-page">
      {/* the country — one line; the full list opens only when asked */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className={K.h1 + " flex items-center gap-2"}><Plane size={20} className="c-acc" />{pack ? <span>{pack.flag} {countryShown(activePack, pack.name)}</span> : tr("Travel")}</h2>
          <p className="c-sub m-0 flex items-center gap-1.5 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: online ? "var(--c-pos)" : "var(--c-mut)" }} />
            {online ? tr("Online") : tr("Offline — everything below still works")}
            <button onClick={runSync} disabled={!online || syncing} className="c-sub underline disabled:opacity-50 bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" data-testid="travel-sync">
              {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}{tr("Update everything")}</button>
          </p>
        </div>
        <button onClick={() => setPick((v) => !v)} className={K.btnS} data-testid="travel-change">{pick ? tr("Done") : pack ? tr("Change country") : tr("Pick a country")}</button>
      </div>

      {pick || !pack ? (
        <Section title="Country packs" testid="travel-packs" right={<span className="c-sub">{Object.keys(CPACKS).length}</span>}>
          <p data-intro="" className="c-sub m-0">{tr("Download once on Wi-Fi — everything then works on a plane, in a tunnel, or with roaming switched off.")}</p>
          {installedPacks.length ? <div className="flex flex-wrap gap-1.5">{installedPacks.filter((k) => CPACKS[k]).map((k) => (
            <button key={k} onClick={() => { installPack(k); setPick(false); }} className={K.chip(activePack === k)} aria-pressed={activePack === k}>{CPACKS[k].flag} {countryShown(k, CPACKS[k].name)} <Check size={11} className="inline" /></button>))}</div> : null}
          <div className="relative"><Search size={14} className="absolute top-[15px] start-3 c-sub" />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("Find a country…")} className={field + " w-full ps-8"} style={st} data-testid="travel-find" /></div>
          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-auto">{others.map(([k, x]) => (
            <button key={k} onClick={() => { installPack(k); setPick(false); setFind(""); }} className={K.chip(false) + " cursor-pointer"} data-testid={"travel-pack-" + k}>
              {x.flag} {countryShown(k, x.name)} <span className="c-sub">{x.size}</span></button>))}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="c-sub">{tr("Country packs")}: {tr(packFeed.from)}{packFeed.rejected ? " · " + tr("{n} rejected", { n: packFeed.rejected }) : ""}</span>
            {netInfo.filter((x) => x.configured).map((x) => <span key={x.k} className="c-sub">· {tr(x.label)}: {x.at ? new Date(x.at).toLocaleDateString(dateLocale()) : tr("never")}</span>)}
          </div>
        </Section>
      ) : null}

      {pack ? (<>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
          {TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className={K.chip(tab === id)} onClick={() => setTab(id)} data-testid={"travel-tab-" + id}>{tr(l)}</button>)}
        </div>

        {tab === "trip" ? (<div className={"space-y-3 " + COLS}>
          {/* v6.27 computer layout A: the trip and the passport on the left; entry, flights and the rest on the right */}
          <div className="space-y-3">
          {tp ? <Section title="Trip pack" right={<b className={tp.ready === tp.of ? "c-pos" : ""} data-testid="trip-pack-count">{tr("{a} of {b} ready", { a: tp.ready, b: tp.of })}</b>} testid="trip-pack">
            {tp.parts.map((x) => <div key={x.key} className="flex items-start gap-2 text-[13.5px]" data-testid={"trip-pack-" + x.key}>
              {x.ok ? <Check size={15} className="c-pos shrink-0 mt-0.5" /> : <span className="w-[15px] h-[15px] rounded-full border shrink-0 mt-0.5" style={{ borderColor: "var(--c-ln)" }} />}
              <span className="flex-1"><b>{tr(PART[x.key])}</b> <span className="c-sub">· {tr(x.note)}</span></span>
              {x.key === "map" && !x.ok ? <button className="c-sub underline bg-transparent border-0 p-0 min-h-[44px] cursor-pointer shrink-0" onClick={getMap} disabled={!!mapBusy} data-testid="trip-pack-getmap">{mapBusy || tr("Download")}</button> : null}
              {x.key === "watch" && !x.ok ? <button className="c-sub underline bg-transparent border-0 p-0 min-h-[44px] cursor-pointer shrink-0" onClick={watch} data-testid="trip-pack-watch-on">{tr("Turn on")}</button> : null}
            </div>)}
            <div className="flex gap-2 pt-1">
              <input value={flightIn} onChange={(e) => setFlightIn(e.target.value)} placeholder={tr("Flight numbers, e.g. MS 985, TK 691")} className={field + " flex-1"} style={st} data-testid="trip-pack-flight" />
              <button className={K.btnS} onClick={() => { const f = T.flightNos(flightIn); if (!f.length) return flash(tr("No flight number found — like MS 985")); setTrip({ flights: [...(trip.flights || []), ...f.filter((x) => !(trip.flights || []).some((y) => y.no === x.no))], watch: false }); setFlightIn(""); }} data-testid="trip-pack-add">{tr("Add")}</button>
            </div>
          </Section> : null}
          {/* the trip itself: dates, people, from where — everything else on this tab is checked against it */}
          <Section title="Your trip" testid="travel-trip">
            <div className="grid grid-cols-2 gap-2">
              <label><span className="c-sub">{tr("Leave")}</span><input type="date" value={trip.depart || ""} onChange={(e) => setTrip({ depart: e.target.value })} className={field + " w-full"} style={st} data-testid="travel-depart" /></label>
              <label><span className="c-sub">{tr("Back")}</span><input type="date" value={trip.ret || ""} onChange={(e) => setTrip({ ret: e.target.value })} className={field + " w-full"} style={st} data-testid="travel-ret" /></label>
              <label><span className="c-sub">{tr("From (airport code)")}</span><input value={trip.from || ""} maxLength={3} onChange={(e) => setTrip({ from: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="CAI" className={field + " w-full uppercase"} style={st} data-testid="travel-from" /></label>
              <label><span className="c-sub">{tr("People")}</span><input type="number" min="1" max="9" value={trip.adults || 1} onChange={(e) => setTrip({ adults: Math.max(1, Math.min(9, +e.target.value || 1)) })} className={field + " w-full"} style={st} /></label>
            </div>
            {shape.issues.filter((x) => trip.depart || x !== "When do you leave?").map((x) => <p key={x} className="c-warn text-[13px] m-0" data-testid="travel-trip-issue">{tr(x)}</p>)}
            {trip.depart ? <p className="c-sub m-0">{(() => { const d = T.daysUntil(trip.depart); return d > 0 ? tr("{n} days to go", { n: d }) : d === 0 ? tr("Today") : tr("Started"); })()}{shape.nights ? " · " + tr("{n} nights", { n: shape.nights }) : ""}</p> : null}
            {shape.ok ? <button onClick={toRadar} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" data-testid="travel-radar"><Bell size={12} />{tr("Remind me in Deadline Radar")}</button> : null}
          </Section>

          {/* the passport, from Deadline Radar, against the return date */}
          <Section title="Your passport" testid="travel-passport">
            {pp.status === "none" ? <p className="text-[13.5px] m-0">{tr("Add your passport's expiry date in Deadline Radar and it is checked against every trip.")}</p>
              : pp.status === "no-dates" ? <p className="text-[13.5px] m-0">{tr("Expires")} {pp.expires} · {tr("add the trip dates to check it")}</p>
              : <p className={"text-[13.5px] m-0 flex gap-1.5 " + (pp.status === "ok" ? "c-pos" : "c-neg")} data-testid="travel-pp">
                  {pp.status === "ok" ? <ShieldCheck size={15} className="shrink-0 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 mt-0.5" />}
                  {tr(pp.status === "ok" ? "Valid for 6+ months after you return — fine for every country." : pp.status === "short" ? "Less than 6 months left after you return — many countries and airlines refuse this. Renew it or check this country's rule." : pp.status === "expires-during" ? "It expires during the trip — renew it before you go." : "It has expired — renew it before you go.")} ({tr("expires")} {pp.expires})</p>}
          </Section>
          {/* v6.28: on a computer the flights and hotels sit under the passport, so the two columns end near each other */}
          {wide ? book : null}
          </div><div className="space-y-3">

          {/* entry rules for this passport */}
          {entry ? (<Section title="Going there — what you need" testid="travel-entry" right={
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="rounded-[14px] min-h-[44px] px-2.5 text-[12.5px] font-semibold border bg-[var(--c-bg)] max-w-[11rem] focus:outline-none focus:border-[var(--c-acc)]" style={st} aria-label={tr("Travelling on a passport from")}>
                {NATIONALITIES.map((n) => <option key={n.k} value={n.k}>{n.flag} {tr(n.label)}</option>)}</select>}>
            <p className="m-0 flex items-baseline gap-2 flex-wrap">
              <span className="c-sub">{(NATIONALITIES.find((n) => n.k === nationality) || {}).flag} → {entry.flag} {countryShown(activePack, entry.to)}</span>
              <b className={entry.tone === "good" ? "c-pos" : entry.tone === "warn" ? "c-warn" : ""} style={{ fontSize: 16 }}>{tr(entry.label)}</b>
              {entry.days ? <span className="c-sub">{tr("· up to")} {entry.days} {tr("days")}</span> : null}</p>
            <p className="text-[13.5px] m-0">{tr(entry.note)}</p>
            {entry.docs.length ? <><p className={K.label + " m-0 pt-1"}>{tr("Papers to have with you")}</p><List items={entry.docs} /></> : null}
            <div className="flex gap-3 flex-wrap pt-1">
              <button onClick={() => { try { navigator.clipboard.writeText(tripChecklist(entry, nationality)); } catch (e) {} flash(tr("Checklist copied")); }} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer"><Copy size={11} className="inline me-1" />{tr("Copy the checklist")}</button>
              <button onClick={() => { remember({ kind: "note", title: "Trip to " + entry.to, text: tripChecklist(entry, nationality), output: "", tags: ["trip", activePack] }); flash(tr("Saved to Memory — searchable offline")); }} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer">{tr("Keep it in Memory")}</button>
            </div>
            <p className="c-warn text-[12px] m-0">{tr("Checked")} {entry.asOf}{tr(". Entry rules change with no notice and the cost of being wrong is a denied boarding — confirm with the embassy or the official portal before you book.")}</p>
          </Section>) : null}

          {!wide ? book : null}
          {owedCard}
          <Section title="Apps you'll need" right={<span className="c-sub">{tr("install before you fly")}</span>}>
            <ul className="space-y-1.5 m-0 p-0 list-none" dir={dirMine}>{pv("apps").map((a, i) => { const m = a.match(/^(.*?)\s+[—–-]\s+(.*)$/); return <li key={i} className="text-[13.5px]">{tr(m ? m[1] : a)}{m ? <span className="c-sub"> — {tr(m[2])}</span> : null}</li>; })}</ul>
            <p className="c-sub m-0">{tr("Some of these can't be installed or signed up for once you're in the country — do it while you still have your home connection.")}</p>
          </Section>
          </div>
        </div>) : null}

        {tab === "arrive" ? (<div className={"space-y-3 " + COLS}>
          {/* v6.27 computer layout A: landing and the key facts on the left, money and connection on the right */}
          <div className="space-y-3">
          {pack.emergency ? <div className={K.cardPad} style={{ borderColor: "var(--c-neg)" }} data-testid="travel-emergency"><p className={K.label + " m-0"}>{tr("🚨 Emergency")}</p><p className="c-neg text-[17px] font-bold m-0 mt-1">{tr(pack.emergency)}</p></div> : null}
          <Section title="When you land" right={<span className="c-sub">{tr("first hour")}</span>}>
            <ol className="space-y-1.5 m-0 p-0 list-none" dir={dirMine}>{pv("arrival").map((a, i) => <li key={i} className="flex gap-2 text-[13.5px]"><span className="c-acc font-bold c-num">{i + 1}</span><span>{tr(a)}</span></li>)}</ol>
            <p className="c-sub m-0">{tr("The things that cost you money or hours if you get them wrong on day one.")}</p>
          </Section>
          <div className="c-list">{[["💱 Money", pack.currency], ["🔌 Power", pack.plug], ["🚰 Water", pack.water], ["🛂 Visa", pack.visa], ["📅 Best time", pack.best], ["💵 Tipping", pack.tipping], ["🤝 Haggling", pack.haggle], ["SIM:", pack.sim]].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} className="px-4 py-2.5 flex gap-3"><span className="c-sub w-24 shrink-0">{tr(l)}</span><span className="text-[13.5px]">{tr(v)}</span></div>))}</div>
          </div><div className="space-y-3">

          {/* money: the converter and the fair-price check, both from numbers, not the model */}
          {code ? <Section title="Is this price fair?" testid="travel-fair">
            <input value={priceQ} onChange={(e) => setPriceQ(e.target.value)} placeholder={tr("e.g. taxi 400 · dinner 25 USD")} className={field + " w-full"} style={st} dir="auto" data-testid="travel-fair-q" />
            {fair ? <p className={"text-[13.5px] m-0 " + (fair.status === "fair" ? "c-pos" : fair.status === "high" ? "c-neg" : fair.status === "bit-high" || fair.status === "low" ? "c-warn" : "")} data-testid="travel-fair-a">
              {fair.status === "no-amount" ? tr("Type the price too.") : fair.status === "unknown" ? tr("No usual price for that in this pack — ask in Ask, or compare two shops.")
                : fair.status === "need-rate" ? tr("Needs the exchange rate once — tap Update everything when you're online.")
                : <>{tr(fair.status === "fair" ? "Fair" : fair.status === "low" ? "Unusually cheap — check what's included" : fair.status === "bit-high" ? "A bit high — you can bargain" : "Too high — {n}× the usual top", { n: fair.times })}{fair.said !== fair.cur ? ` (${fair.shown} ${fair.said} ≈ ${fair.amount.toLocaleString()} ${fair.cur})` : ""}<span className="c-sub block">{tr("Usual")}: {tr(fair.line)}</span></>}</p>
              : <p className="c-sub m-0">{tr("Checked against the usual prices in this pack:")} {pack.costs.length}</p>}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="c-sub">{tr("USD")}</span>
              <input value={convAmt} onChange={(e) => setConvAmt(e.target.value)} inputMode="decimal" className={field + " w-24"} style={st} />
              <span className="c-sub">=</span>
              {(() => { const c = rates && convert(Number(convAmt) || 0, "USD", code, rates); return c ? <><b className="c-num">{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {code}</b><span className="c-sub">{tr("as of")} {new Date(c.at).toLocaleDateString()}</span></>
                : <button onClick={runSync} disabled={!online || syncing} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer">— {code} · {online ? tr("get rates once") : tr("needs a connection once")}</button>; })()}
            </div>
          </Section> : null}
          {pack.connectivity ? <Section title="📶 Staying connected"><p className="text-[13.5px] m-0">{tr(pack.connectivity)}</p></Section> : null}
          {openMap ? <button onClick={openMap} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1"><MapPin size={12} />{tr("Open the map")}</button> : null}
          </div>
        </div>) : null}

        {tab === "say" ? (<div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:gap-6 lg:items-start">
          {/* v6.27 computer layout A: finding a phrase on the left, the phrases on the right */}
          <div className="space-y-3 lg:sticky lg:top-4">
          <div className="flex gap-2 lg:flex-wrap">
            <div className="relative flex-1"><Search size={14} className="absolute top-[15px] start-3 c-sub" />
              <input value={phraseFilter} onChange={(e) => setPhraseFilter(e.target.value)} placeholder={tr("search phrases…")} className={field + " w-full ps-8"} style={st} /></div>
            {openTranslate ? <button onClick={() => openTranslate(pack.lang)} className={K.btnP} data-testid="travel-translate"><Camera size={15} />{tr("A sign or menu")}</button> : null}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-wrap">{PHRASE_TAGS.map(([k, l]) => <button key={k} className={K.chip(phraseTag === k)} aria-selected={phraseTag === k} onClick={() => setPhraseTag(k)}>{tr(l)}</button>)}</div>
          </div><div className="space-y-3 min-w-0">
          <div className="c-list" data-testid="travel-phrases">
            {pack.phrases.map((ph, i) => ({ ...ph, mine: (packView && packView.gloss && packView.gloss[i]) || ph.en }))
              .filter((ph) => phraseTag === "all" || ph.tag === phraseTag)
              .filter((ph) => !phraseFilter.trim() || (ph.en + ph.mine + ph.loc).toLowerCase().includes(phraseFilter.toLowerCase()))
              .map((ph) => (
              <div key={ph.en} className="px-4 py-2.5 flex items-center gap-2">
                <button onClick={() => { try { navigator.clipboard.writeText(ph.loc); } catch (e) {} flash(tr("Copied — show it to them")); }} className="flex-1 min-w-0 text-start bg-transparent border-0 p-0 cursor-pointer" style={{ color: "var(--c-ink)" }}>
                  <span className="c-sub block" dir={dirMine}>{ph.mine}</span>
                  <span className="block text-[16px] font-semibold" dir={RTL_LANGS.has(pack.lang) ? "rtl" : "ltr"}>{ph.loc}</span>
                  <span className="c-sub block">{ph.say}</span></button>
                <button onClick={() => say(ph)} className="c-ic !w-11 !h-11 !rounded-[14px] border-0 cursor-pointer" aria-label={tr("Say it aloud")} data-testid="travel-say"><Volume2 size={15} /></button>
                <button onClick={() => setBig(ph)} className="c-ic !w-11 !h-11 !rounded-[14px] border-0 cursor-pointer" aria-label={tr("Show it big")} data-testid="travel-big"><Maximize2 size={15} /></button>
              </div>))}
          </div>
          <p className="c-sub m-0">{tr("Tap to copy. These are written by hand, not generated — so an allergy or emergency phrase can never come out wrong.")}</p>
          </div>
        </div>) : null}

        {tab === "ask" ? (<Section title="Ask anything about being here" testid="travel-ask">
          {/* v6.27 computer layout A: the question on the left, the answer on the right */}
          <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start"><div className="space-y-2">
          <textarea value={travelQ} onChange={(e) => setTravelQ(e.target.value)} rows={3} dir="auto"
            placeholder={tr("e.g. the taxi driver won't turn the meter on, what do I say? / is this price fair for a carpet? / can I drink the tap water?")} className={K.area + " resize-none"} style={st} />
          <div className="flex flex-wrap gap-1.5">{["Is this price fair?", "How do I get a taxi?", "What should I not do here?", "How do I ask for directions?"].map((q) => (
            <button key={q} onClick={() => setTravelQ(q)} className={K.chip(false) + " cursor-pointer"}>{tr(q)}</button>))}</div>
          <button onClick={askTravel} disabled={!travelQ.trim() || loading} className={K.btnP + " w-full"}>{loading ? <Loader2 size={15} className="animate-spin" /> : <Plane size={15} />}{loading ? "…" : tr("Ask")}</button>
          </div><div className="space-y-2">
          {travelA ? <p className="text-[14px] whitespace-pre-wrap leading-relaxed m-0 pt-1" dir={dirMine}>{travelA}</p> : null}
          <p className="c-sub m-0">{tr("It knows how things actually work here — fair prices, common overcharges, what's rude. It will tell you when something needs live data it can't have offline.")}</p>
          </div></div>
        </Section>) : null}

        {tab === "know" ? (<div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Languages size={14} className="c-acc" /><span className="c-sub">{tr("Write my tips in")}</span>
            <select value={myLang} onChange={(e) => setMyLang(e.target.value)} className="rounded-[14px] min-h-[44px] px-2.5 text-[12.5px] font-semibold border bg-[var(--c-bg)] focus:outline-none focus:border-[var(--c-acc)]" style={st}>
              {LANGS.filter((l) => l.k !== "match").map((l) => <option key={l.k} value={l.k}>{tr(l.label)}</option>)}</select>
            {translating ? <span className="c-sub inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" />{tr("translating on your phone…")}</span> : myLang !== "en" ? <span className="c-sub">{tr("saved — this pack now reads in")} {langShown(myLang)}</span> : null}
          </div>
          {/* v6.27 computer layout A: the tips as cards in 2 columns */}
          <div className={"space-y-3 " + COLS}>
          {pv("scams").length ? <Section title="How you'll get overcharged"><List items={pv("scams")} dir={dirMine} warn /></Section> : null}
          {[["Money here", "money"], ["What's rude, what's fine", "etiquette"], ["Staying well", "health"]].map(([t, k]) => pv(k).length ? <Section key={k} title={t}><List items={pv(k)} dir={dirMine} /></Section> : null)}
          </div>
          <p className={K.label + " m-0 pt-1"}>{tr("Everything else about")} {tr(pack.name)} · {tr("all offline")}</p>
          <div className="c-list">{[["💸", "What things cost", "costs", "Rough ranges, for sanity-checking a price — not a price list."], ["🚉", "Getting around", "getAround"], ["🍽", "Eating well", "eat"], ["⚖️", "Laws that surprise people", "laws"],
              ["⚠️", "Real dangers", "dangers"], ["📅", "When things shut", "holidays"], ["🛃", "Customs & what not to bring", "customs"], ["☎️", "Useful numbers", "numbers"]].map(([icon, title, k, note]) => pv(k).length ? (
            <details key={k} className="group">
              <summary className="cursor-pointer list-none px-4 py-3 min-h-[48px] flex items-center justify-between"><span className="text-[14px] font-bold">{icon} {tr(title)}</span><span className="c-sub group-open:hidden">{pv(k).length}</span></summary>
              <div className="px-4 pb-3"><List items={pv(k)} dir={dirMine} />{note ? <p className="c-sub m-0 mt-2">{tr(note)}</p> : null}</div>
            </details>) : null)}</div>
        </div>) : null}
      </>) : null}

      {/* a phrase shown big, to hand the phone to a driver or a waiter */}
      {big ? (
        <div className="calm fixed inset-0 z-50 grid place-items-center p-6" style={{ background: "var(--c-bg)" }} onClick={() => setBig(null)} data-testid="travel-bigview">
          <button className="absolute top-4 end-4 c-ic !w-11 !h-11 !rounded-[14px] border-0 cursor-pointer" aria-label={tr("Close")}><X size={16} /></button>
          <div className="text-center space-y-4">
            <p className="font-bold m-0" style={{ fontSize: "clamp(32px, 9vw, 64px)", lineHeight: 1.2, color: "var(--c-ink)" }} dir={RTL_LANGS.has(pack.lang) ? "rtl" : "ltr"}>{big.loc}</p>
            <p className="c-sub m-0" style={{ fontSize: 16 }}>{big.en}</p>
            <button onClick={(e) => { e.stopPropagation(); say(big); }} className={K.btnP}><Volume2 size={16} />{tr("Say it aloud")}</button>
          </div>
        </div>) : null}
    </div>
  );
}
