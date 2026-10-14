/* ---- v6.27 Travel — the page (mode "travel"), design A "Calm". Everything the old page had is here, in five quiet tabs:
   Trip (the country, your passport, entry rules, the papers, flights and hotels, Radar) · Arrive (the first hour, emergency,
   the key facts, money and the fair-price check) · Say it (hand-written phrases: copy, speak aloud, show big; a sign or a menu
   → Translate) · Ask · Know (overcharges, money, manners, health and everything else, folded).
   The logic is in travel.js (code decides; tests/unit/v727travel.test.mjs). Tests: tests/e2e_v727travel.py.               */
import React, { useMemo, useState } from "react";
import { Plane, Languages, RefreshCw, Loader2, Copy, Volume2, AlertTriangle, Maximize2, X, Search, Camera, ShieldCheck, Bell, MapPin, Check } from "lucide-react";
import { tr } from "./i18n.js";
import * as T from "./travel.js";
import * as D from "./deadlines.js";
import { speakNow } from "./lesson-ui.jsx";
import { openOwed } from "./owed-ui.jsx";

const TABS = [["trip", "Trip"], ["arrive", "Arrive"], ["say", "Say it"], ["ask", "Ask"], ["know", "Know"]];
const field = "rounded-lg px-3 py-2 text-[14px] border bg-transparent";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };
const PHRASE_TAGS = [["all", "All"], ["emergency", "🚨 Emergency"], ["transport", "🚕 Getting around"], ["food", "🍽 Eating"], ["shopping", "💰 Buying"], ["basics", "💬 Basics"]];
const AIRPORT = { tr: ["IST", "Istanbul"], eg: ["CAI", "Cairo"], sa: ["JED", "Jeddah"], ae: ["DXB", "Dubai"], fr: ["CDG", "Paris"], it: ["FCO", "Rome"], es: ["MAD", "Madrid"], jp: ["NRT", "Tokyo"],
  th: ["BKK", "Bangkok"], gr: ["ATH", "Athens"], ma: ["RAK", "Marrakech"], cn: ["PEK", "Beijing"], in: ["DEL", "Delhi"], gb: ["LHR", "London"], id: ["DPS", "Bali"], my: ["KUL", "Kuala Lumpur"],
  ge: ["TBS", "Tbilisi"], jo: ["AMM", "Amman"], de: ["FRA", "Frankfurt"], qa: ["DOH", "Doha"], kw: ["KWI", "Kuwait City"], om: ["MCT", "Muscat"], bh: ["BAH", "Manama"], lb: ["BEY", "Beirut"],
  tn: ["TUN", "Tunis"], pt: ["LIS", "Lisbon"], nl: ["AMS", "Amsterdam"], vn: ["SGN", "Ho Chi Minh City"], kr: ["ICN", "Seoul"], sg: ["SIN", "Singapore"], za: ["JNB", "Johannesburg"], mv: ["MLE", "Malé"],
  lk: ["CMB", "Colombo"], ke: ["NBO", "Nairobi"], tz: ["DAR", "Dar es Salaam"], az: ["GYD", "Baku"], uz: ["TAS", "Tashkent"], ba: ["SJJ", "Sarajevo"], al: ["TIA", "Tirana"], cy: ["LCA", "Larnaca"],
  ch: ["ZRH", "Zurich"], at: ["VIE", "Vienna"], us: ["JFK", "New York"] };

function Section({ title, right, children, testid }) {
  return (<section className="c-card space-y-2" data-testid={testid}>
    {title ? <div className="flex items-center justify-between gap-2"><p className="c-lbl m-0">{tr(title)}</p>{right || null}</div> : null}
    {children}</section>);
}
const List = ({ items, dir, warn }) => (
  <ul className="space-y-1.5 m-0 p-0 list-none" dir={dir}>{items.map((x, i) => <li key={i} className={"text-[13.5px] leading-snug ps-3 border-s-2 " + (warn ? "c-warn" : "")} style={{ borderColor: warn ? "var(--c-warn)" : "var(--c-ln)" }}>{tr(x)}</li>)}</ul>);

export function TravelPage(p) {
  const { CPACKS, activePack, installedPacks, installPack, packView, myLang, setMyLang, LANGS, langShown, countryShown, RTL_LANGS, translating,
    online, runSync, syncing, packFeed, netInfo, dateLocale, nationality, setNationality, NATIONALITIES, entry, tripChecklist, remember, flash,
    rates, convert, packCurrency, convAmt, setConvAmt, travelQ, setTravelQ, askTravel, travelA, loading, N, native, remind, openTranslate, openMap, openAgent } = p;
  const [tab, setTab] = useState("trip");
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

  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="travel-page">
      {/* the country — one line; the full list opens only when asked */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Plane size={20} className="c-acc" />{pack ? <span>{pack.flag} {countryShown(activePack, pack.name)}</span> : tr("Travel")}</h2>
          <p className="c-sub m-0 flex items-center gap-1.5 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: online ? "var(--c-pos)" : "var(--c-mut)" }} />
            {online ? tr("Online") : tr("Offline — everything below still works")}
            <button onClick={runSync} disabled={!online || syncing} className="c-sub underline disabled:opacity-50 bg-transparent border-0 p-0 cursor-pointer inline-flex items-center gap-1" data-testid="travel-sync">
              {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}{tr("Update everything")}</button>
          </p>
        </div>
        <button onClick={() => setPick((v) => !v)} className="c-pill" style={{ fontSize: 12.5, padding: "6px 12px", border: 0, cursor: "pointer" }} data-testid="travel-change">{pick ? tr("Done") : pack ? tr("Change country") : tr("Pick a country")}</button>
      </div>

      {pick || !pack ? (
        <Section title="Country packs" testid="travel-packs" right={<span className="c-sub">{Object.keys(CPACKS).length}</span>}>
          <p className="c-sub m-0">{tr("Download once on Wi-Fi — everything then works on a plane, in a tunnel, or with roaming switched off.")}</p>
          {installedPacks.length ? <div className="flex flex-wrap gap-1.5">{installedPacks.filter((k) => CPACKS[k]).map((k) => (
            <button key={k} onClick={() => { installPack(k); setPick(false); }} className="c-pill" aria-pressed={activePack === k}
              style={{ fontSize: 13, padding: "6px 12px", cursor: "pointer", border: activePack === k ? "1.5px solid var(--c-acc)" : "0" }}>{CPACKS[k].flag} {countryShown(k, CPACKS[k].name)} <Check size={11} className="inline" /></button>))}</div> : null}
          <div className="relative"><Search size={14} className="absolute top-2.5 start-2.5 c-sub" />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder={tr("Find a country…")} className={field + " w-full ps-8"} style={st} data-testid="travel-find" /></div>
          <div className="flex flex-wrap gap-1.5 max-h-56 overflow-auto">{others.map(([k, x]) => (
            <button key={k} onClick={() => { installPack(k); setPick(false); setFind(""); }} className="rounded-full px-3 py-1.5 text-[13px] border bg-transparent cursor-pointer" style={st} data-testid={"travel-pack-" + k}>
              {x.flag} {countryShown(k, x.name)} <span className="c-sub">{x.size}</span></button>))}</div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="c-sub">{tr("Country packs")}: {tr(packFeed.from)}{packFeed.rejected ? " · " + tr("{n} rejected", { n: packFeed.rejected }) : ""}</span>
            {netInfo.filter((x) => x.configured).map((x) => <span key={x.k} className="c-sub">· {tr(x.label)}: {x.at ? new Date(x.at).toLocaleDateString(dateLocale()) : tr("never")}</span>)}
          </div>
        </Section>
      ) : null}

      {pack ? (<>
        <div className="flex gap-4 border-b overflow-x-auto" style={{ borderColor: "var(--c-ln)" }} role="tablist">
          {TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className="c-tab pb-2" onClick={() => setTab(id)} data-testid={"travel-tab-" + id}>{tr(l)}</button>)}
        </div>

        {tab === "trip" ? (<div className="space-y-3">
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

          {/* entry rules for this passport */}
          {entry ? (<Section title="Going there — what you need" testid="travel-entry" right={
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="rounded-lg px-2 py-1 text-[12px] border bg-transparent max-w-[11rem]" style={st} aria-label={tr("Travelling on a passport from")}>
                {NATIONALITIES.map((n) => <option key={n.k} value={n.k}>{n.flag} {tr(n.label)}</option>)}</select>}>
            <p className="m-0 flex items-baseline gap-2 flex-wrap">
              <span className="c-sub">{(NATIONALITIES.find((n) => n.k === nationality) || {}).flag} → {entry.flag} {countryShown(activePack, entry.to)}</span>
              <b className={entry.tone === "good" ? "c-pos" : entry.tone === "warn" ? "c-warn" : ""} style={{ fontSize: 16 }}>{tr(entry.label)}</b>
              {entry.days ? <span className="c-sub">{tr("· up to")} {entry.days} {tr("days")}</span> : null}</p>
            <p className="text-[13.5px] m-0">{tr(entry.note)}</p>
            {entry.docs.length ? <><p className="c-lbl m-0 pt-1">{tr("Papers to have with you")}</p><List items={entry.docs} /></> : null}
            <div className="flex gap-3 flex-wrap pt-1">
              <button onClick={() => { try { navigator.clipboard.writeText(tripChecklist(entry, nationality)); } catch (e) {} flash(tr("Checklist copied")); }} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer"><Copy size={11} className="inline me-1" />{tr("Copy the checklist")}</button>
              <button onClick={() => { remember({ kind: "note", title: "Trip to " + entry.to, text: tripChecklist(entry, nationality), output: "", tags: ["trip", activePack] }); flash(tr("Saved to Memory — searchable offline")); }} className="c-sub underline bg-transparent border-0 p-0 cursor-pointer">{tr("Keep it in Memory")}</button>
            </div>
            <p className="c-warn text-[12px] m-0">{tr("Checked")} {entry.asOf}{tr(". Entry rules change with no notice and the cost of being wrong is a denied boarding — confirm with the embassy or the official portal before you book.")}</p>
          </Section>) : null}

          {/* flights and hotels: the agent's links, filled from the trip; you choose and pay */}
          <Section title="Flights and hotels" testid="travel-book">
            {!trip.from || !trip.depart ? <p className="c-sub m-0">{tr("Add where you fly from and the dates above.")}</p> : null}
            {T.tripFlights(trip, air[0]).map((l) => <button key={l.label} onClick={() => openAgent(l)} className="w-full flex items-center justify-between text-start bg-transparent border-0 p-0 py-1 cursor-pointer" style={{ color: "var(--c-ink)" }} data-testid="travel-flight"><span><Plane size={13} className="inline me-1.5 c-acc" />{l.label} <span className="c-sub">{trip.from} → {air[0]} · {tr(l.why)}</span></span><span className="c-acc">›</span></button>)}
            {T.tripHotels(trip, air[1]).map((l) => <button key={l.label} onClick={() => openAgent(l)} className="w-full flex items-center justify-between text-start bg-transparent border-0 p-0 py-1 cursor-pointer" style={{ color: "var(--c-ink)" }} data-testid="travel-hotel"><span><MapPin size={13} className="inline me-1.5 c-acc" />{l.label} <span className="c-sub">{air[1]} · {tr(l.why)}</span></span><span className="c-acc">›</span></button>)}
            {trip.from && trip.depart ? <p className="c-sub m-0">{tr("Attune opens the search with your dates and marks the best offer. You choose and pay.")}</p> : null}
          </Section>

          {/* v6.27 What you're owed: compensation for a delayed or cancelled flight, worked out by code */}
          <button onClick={() => openOwed({ flight: { from: trip.from || "", to: air[0] || "", date: trip.depart || "" } })} className="c-card w-full text-start flex items-center gap-3 cursor-pointer" data-testid="travel-owed">
            <span className="c-ic"><Plane size={16} /></span><span className="flex-1"><b className="block text-[14px]">{tr("Flight delayed or cancelled?")}</b><span className="c-sub">{tr("See what the airline owes you — up to €600 — and get the letter")}</span></span><span className="c-acc">›</span></button>

          <Section title="Apps you'll need" right={<span className="c-sub">{tr("install before you fly")}</span>}>
            <ul className="space-y-1.5 m-0 p-0 list-none" dir={dirMine}>{pv("apps").map((a, i) => { const m = a.match(/^(.*?)\s+[—–-]\s+(.*)$/); return <li key={i} className="text-[13.5px]">{tr(m ? m[1] : a)}{m ? <span className="c-sub"> — {tr(m[2])}</span> : null}</li>; })}</ul>
            <p className="c-sub m-0">{tr("Some of these can't be installed or signed up for once you're in the country — do it while you still have your home connection.")}</p>
          </Section>
        </div>) : null}

        {tab === "arrive" ? (<div className="space-y-3">
          {pack.emergency ? <div className="c-card" style={{ borderColor: "var(--c-neg)" }} data-testid="travel-emergency"><p className="c-lbl m-0">{tr("🚨 Emergency")}</p><p className="c-neg text-[17px] font-bold m-0 mt-1">{tr(pack.emergency)}</p></div> : null}
          <Section title="When you land" right={<span className="c-sub">{tr("first hour")}</span>}>
            <ol className="space-y-1.5 m-0 p-0 list-none" dir={dirMine}>{pv("arrival").map((a, i) => <li key={i} className="flex gap-2 text-[13.5px]"><span className="c-acc font-bold c-num">{i + 1}</span><span>{tr(a)}</span></li>)}</ol>
            <p className="c-sub m-0">{tr("The things that cost you money or hours if you get them wrong on day one.")}</p>
          </Section>
          <div className="c-list">{[["💱 Money", pack.currency], ["🔌 Power", pack.plug], ["🚰 Water", pack.water], ["🛂 Visa", pack.visa], ["📅 Best time", pack.best], ["💵 Tipping", pack.tipping], ["🤝 Haggling", pack.haggle], ["SIM:", pack.sim]].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} className="px-4 py-2.5 flex gap-3"><span className="c-sub w-24 shrink-0">{tr(l)}</span><span className="text-[13.5px]">{tr(v)}</span></div>))}</div>

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
        </div>) : null}

        {tab === "say" ? (<div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1"><Search size={14} className="absolute top-2.5 start-2.5 c-sub" />
              <input value={phraseFilter} onChange={(e) => setPhraseFilter(e.target.value)} placeholder={tr("search phrases…")} className={field + " w-full ps-8"} style={st} /></div>
            {openTranslate ? <button onClick={() => openTranslate(pack.lang)} className="c-btn inline-flex items-center gap-1.5" data-testid="travel-translate"><Camera size={15} />{tr("A sign or menu")}</button> : null}
          </div>
          <div className="flex gap-3 overflow-x-auto border-b" style={{ borderColor: "var(--c-ln)" }}>{PHRASE_TAGS.map(([k, l]) => <button key={k} className="c-tab pb-2" aria-selected={phraseTag === k} onClick={() => setPhraseTag(k)}>{tr(l)}</button>)}</div>
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
                <button onClick={() => say(ph)} className="c-ic border-0 cursor-pointer" aria-label={tr("Say it aloud")} data-testid="travel-say"><Volume2 size={15} /></button>
                <button onClick={() => setBig(ph)} className="c-ic border-0 cursor-pointer" aria-label={tr("Show it big")} data-testid="travel-big"><Maximize2 size={15} /></button>
              </div>))}
          </div>
          <p className="c-sub m-0">{tr("Tap to copy. These are written by hand, not generated — so an allergy or emergency phrase can never come out wrong.")}</p>
        </div>) : null}

        {tab === "ask" ? (<Section title="Ask anything about being here" testid="travel-ask">
          <textarea value={travelQ} onChange={(e) => setTravelQ(e.target.value)} rows={3} dir="auto"
            placeholder={tr("e.g. the taxi driver won't turn the meter on, what do I say? / is this price fair for a carpet? / can I drink the tap water?")} className={field + " w-full resize-none"} style={st} />
          <div className="flex flex-wrap gap-1.5">{["Is this price fair?", "How do I get a taxi?", "What should I not do here?", "How do I ask for directions?"].map((q) => (
            <button key={q} onClick={() => setTravelQ(q)} className="rounded-full px-3 py-1 text-[12.5px] border bg-transparent cursor-pointer" style={st}>{tr(q)}</button>))}</div>
          <button onClick={askTravel} disabled={!travelQ.trim() || loading} className="c-btn w-full inline-flex items-center justify-center gap-2 disabled:opacity-50">{loading ? <Loader2 size={15} className="animate-spin" /> : <Plane size={15} />}{loading ? "…" : tr("Ask")}</button>
          {travelA ? <p className="text-[14px] whitespace-pre-wrap leading-relaxed m-0 pt-1" dir={dirMine}>{travelA}</p> : null}
          <p className="c-sub m-0">{tr("It knows how things actually work here — fair prices, common overcharges, what's rude. It will tell you when something needs live data it can't have offline.")}</p>
        </Section>) : null}

        {tab === "know" ? (<div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Languages size={14} className="c-acc" /><span className="c-sub">{tr("Write my tips in")}</span>
            <select value={myLang} onChange={(e) => setMyLang(e.target.value)} className="rounded-lg px-2 py-1 text-[12.5px] border bg-transparent" style={st}>
              {LANGS.filter((l) => l.k !== "match").map((l) => <option key={l.k} value={l.k}>{tr(l.label)}</option>)}</select>
            {translating ? <span className="c-sub inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" />{tr("translating on your phone…")}</span> : myLang !== "en" ? <span className="c-sub">{tr("saved — this pack now reads in")} {langShown(myLang)}</span> : null}
          </div>
          {pv("scams").length ? <Section title="How you'll get overcharged"><List items={pv("scams")} dir={dirMine} warn /></Section> : null}
          {[["Money here", "money"], ["What's rude, what's fine", "etiquette"], ["Staying well", "health"]].map(([t, k]) => pv(k).length ? <Section key={k} title={t}><List items={pv(k)} dir={dirMine} /></Section> : null)}
          <p className="c-lbl m-0 pt-1">{tr("Everything else about")} {tr(pack.name)} · {tr("all offline")}</p>
          <div className="c-list">{[["💸", "What things cost", "costs", "Rough ranges, for sanity-checking a price — not a price list."], ["🚉", "Getting around", "getAround"], ["🍽", "Eating well", "eat"], ["⚖️", "Laws that surprise people", "laws"],
              ["⚠️", "Real dangers", "dangers"], ["📅", "When things shut", "holidays"], ["🛃", "Customs & what not to bring", "customs"], ["☎️", "Useful numbers", "numbers"]].map(([icon, title, k, note]) => pv(k).length ? (
            <details key={k} className="group">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between"><span className="text-[14px]">{icon} {tr(title)}</span><span className="c-sub group-open:hidden">{pv(k).length}</span></summary>
              <div className="px-4 pb-3"><List items={pv(k)} dir={dirMine} />{note ? <p className="c-sub m-0 mt-2">{tr(note)}</p> : null}</div>
            </details>) : null)}</div>
        </div>) : null}
      </>) : null}

      {/* a phrase shown big, to hand the phone to a driver or a waiter */}
      {big ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: "var(--c-bg)" }} onClick={() => setBig(null)} data-testid="travel-bigview">
          <button className="absolute top-4 end-4 c-ic border-0 cursor-pointer" aria-label={tr("Close")}><X size={16} /></button>
          <div className="text-center space-y-4">
            <p className="font-bold m-0" style={{ fontSize: "clamp(32px, 9vw, 64px)", lineHeight: 1.2, color: "var(--c-ink)" }} dir={RTL_LANGS.has(pack.lang) ? "rtl" : "ltr"}>{big.loc}</p>
            <p className="c-sub m-0" style={{ fontSize: 16 }}>{big.en}</p>
            <button onClick={(e) => { e.stopPropagation(); say(big); }} className="c-btn inline-flex items-center gap-2"><Volume2 size={16} />{tr("Say it aloud")}</button>
          </div>
        </div>) : null}
    </div>
  );
}
