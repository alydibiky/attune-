/* ---- v6.15 Maps, look A (Ali's pick): the map fills the screen; a floating search and category chips on top; a sheet
   pulled up from the bottom holds the picked place, the results, your places and the offline country maps.
   The map is drawn by MapLibre: from an installed country pack (offline, vector, offlinemap.js) or, without one, from
   online picture tiles through the app's tile cache. If the phone can't draw it (no WebGL), the old map is shown. */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Download, RefreshCw, Trash2, MapPin, Share2, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as OM from "./offlinemap.js";

const PACK_KEY = "attune:map:pack";
const CHIPS = [
  ["fuel", "Fuel", "وقود", ["amenity/fuel"], "fuel station"],
  ["food", "Food", "طعام", ["amenity/restaurant", "amenity/fast_food", "amenity/cafe"], "restaurant"],
  ["pharmacy", "Pharmacy", "صيدلية", ["amenity/pharmacy"], "pharmacy"],
  ["hospital", "Hospital", "مستشفى", ["amenity/hospital", "amenity/clinic"], "hospital"],
  ["mosque", "Mosque", "مسجد", ["amenity/place_of_worship"], "mosque"],
  ["atm", "ATM / bank", "صراف / بنك", ["amenity/atm", "amenity/bank"], "atm"],
];
const km = (d) => (d == null ? "" : d < 1 ? Math.round(d * 1000) + " m" : d < 100 ? d.toFixed(1) + " km" : Math.round(d) + " km");
function distKm(a, b) {
  const R = 6371, t = Math.PI / 180, dLat = (b.lat - a.lat) * t, dLon = (b.lon - a.lon) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function pinEl(kind) {
  const el = document.createElement("div");
  el.className = "att-pin";
  el.style.cssText = kind === "me" ? "width:18px;height:18px;border-radius:9px;background:#60a5fa;border:3px solid #fff;box-shadow:0 0 0 6px rgba(96,165,250,.25)"
    : `width:22px;height:22px;border-radius:11px 11px 11px 2px;transform:rotate(-45deg);background:${kind === "found" ? "#f59e0b" : "#34d399"};border:3px solid #0b1220;cursor:pointer`;
  return el;
}

export function MapPage({ N, nativeCall, lastNativeId, getTile, findPlaces, searchSaved, load, save, remember, flash, myLang, fallback }) {
  const ar = getLang() === "ar";
  const lang = ar || myLang === "Arabic" ? "ar" : "en";
  const [st, setSt] = useState(load);
  const [view, setView] = useState(() => load().view);
  const [fail, setFail] = useState("");
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [packs, setPacks] = useState(() => { try { return (JSON.parse((N && N.mapPacks && N.mapPacks()) || "{}").packs) || []; } catch (e) { return []; } });
  const [pack, setPack] = useState(() => { try { return localStorage.getItem(PACK_KEY) || ""; } catch (e) { return ""; } });
  const [remote, setRemote] = useState({});                // code → published manifest (or {error})
  const [dl, setDl] = useState(null);                      // { code, pct, detail, id }
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);                  // null = no search
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [me, setMe] = useState(null);
  const [sheet, setSheet] = useState("peek");              // peek | half | full
  const [tab, setTab] = useState("places");
  const [top, setTop] = useState(56);
  const holder = useRef(null), box = useRef(null), mapRef = useRef(null), markers = useRef([]);
  const active = pack === "-" ? "" : packs.find((p) => p.code === pack) ? pack : (packs[0] && packs[0].code) || "";   // "-" = you chose the online map

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => { if (holder.current) setTop(Math.max(0, Math.round(holder.current.getBoundingClientRect().top))); }, []);
  useEffect(() => { save({ places: st.places, view }); }, [st.places, view]);

  // ---- the map ----
  useEffect(() => {
    let map = null, gone = false;
    (async () => {
      if (!OM.webglOk()) { setFail("webgl"); return; }
      const ml = await OM.loadMapLibre();
      if (gone || !box.current) return;
      OM.registerProtocols(ml, N, getTile);
      map = new ml.Map({ container: box.current, style: OM.mapStyle({ pack: active || null, dark: true, lang }), center: [view.lon, view.lat], zoom: view.z,
        attributionControl: { compact: true }, maxZoom: 19, dragRotate: false, pitchWithRotate: false });
      map.touchZoomRotate.disableRotation();
      map.on("moveend", () => { const c = map.getCenter(); setView({ lat: c.lat, lon: c.lng, z: map.getZoom() }); });
      map.on("load", () => setReady(true));
      let told = false;   // a tile that can't be read: say it once, never a stream of console errors
      map.on("error", (e) => { const m = String((e && e.error && e.error.message) || ""); if (!told && /missing/.test(m)) { told = true; flash(tr(m)); } });
      mapRef.current = map;
      if (typeof window !== "undefined") window.__attuneMap = map;      // tests read the map's state
    })().catch((e) => setFail(String((e && e.message) || e)));
    return () => { gone = true; if (map) map.remove(); mapRef.current = null; };
  }, []);
  // the source: the active country pack, or online tiles
  const styleKey = useRef("");
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const k = (active || "-") + lang;
    if (styleKey.current && styleKey.current !== k) m.setStyle(OM.mapStyle({ pack: active || null, dark: true, lang }));
    styleKey.current = k;
  }, [active, lang, ready]);
  // pins: your places, the picked result, you
  useEffect(() => {
    const m = mapRef.current, ml = typeof window !== "undefined" && window.maplibregl; if (!m || !ml) return;
    for (const x of markers.current) x.remove();
    markers.current = [];
    const add = (p, kind, onClick) => {
      const el = pinEl(kind); if (kind === "found") el.dataset.testid = "map-found-pin"; if (kind === "me") el.dataset.testid = "map-me";
      if (onClick) el.addEventListener("click", (e) => { e.stopPropagation(); onClick(); });
      markers.current.push(new ml.Marker({ element: el, anchor: kind === "me" ? "center" : "bottom" }).setLngLat([p.lon, p.lat]).addTo(m));
    };
    for (const p of st.places) add(p, "saved", () => { setSel(p); setSheet("half"); });
    if (sel && sel.found) add(sel, "found");
    if (me) add(me, "me");
  }, [st.places, sel, me, ready]);

  const flyTo = (p, z = 16) => { const m = mapRef.current; if (m) m.flyTo({ center: [p.lon, p.lat], zoom: Math.max(m.getZoom(), z), speed: 1.6 }); else setView({ lat: p.lat, lon: p.lon, z }); };
  const locateMe = () => {
    if (!navigator.geolocation) return flash(tr("This phone can't share its location with the app."));
    navigator.geolocation.getCurrentPosition((p) => { const pt = { lat: p.coords.latitude, lon: p.coords.longitude }; setMe(pt); flyTo(pt, 15); },
      (e) => flash(e && e.code === 1 ? tr("Location is off for Attune — allow it in the phone's settings to see where you are.") : tr("Couldn't get your location — check that location is on.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  };

  // ---- search: your places, then the offline pack (works with no signal), then online ----
  const center = () => { const m = mapRef.current; const c = m ? m.getCenter() : { lat: view.lat, lng: view.lon }; return { lat: c.lat, lon: c.lng }; };
  const runSearch = async (term, chip) => {
    term = String(term || "").trim(); if (!term && !chip) return;
    setBusy(true); setSel(null); setSheet("half");
    const c = center(), out = [], seen = new Set();
    const push = (p) => { const k = Math.round(p.lat * 2000) + ":" + Math.round(p.lon * 2000) + ":" + String(p.name).slice(0, 12); if (seen.has(k)) return; seen.add(k); out.push({ ...p, dist: p.dist != null ? p.dist : distKm(c, p) }); };
    if (term) for (const p of searchSaved(st.places, term)) push({ ...p, local: true });
    if (packs.length && nativeCall) {
      try { const r = await nativeCall("mapSearch", { q: chip ? "" : term, kinds: chip ? chip[3] : [], limit: 15, lat: c.lat, lon: c.lon });
        for (const p of (r && r.places) || []) push({ name: (lang === "ar" && p.name_ar) || (lang === "en" && p.name_en) || p.name, lat: p.lat, lon: p.lon, kind: p.kind, offline: true, dist: p.dist }); } catch (e) {}
    }
    if (online && out.filter((x) => !x.local).length < 3) {
      try { const r = await findPlaces(chip ? chip[4] : term, { center: c, lang, fetchJson: async (u) => { const res = await fetch(u, { headers: { Accept: "application/json" } }); if (!res.ok) throw new Error("search " + res.status); return res.json(); } });
        for (const p of (r && r.places) || []) push(p); } catch (e) {}
    }
    setHits(chip ? out.sort((a, b) => a.dist - b.dist) : out);
    setBusy(false);
    if (!out.length) flash(online || packs.length ? tr("Nothing found for that — try the area's name too (e.g. “… New Cairo”), or move the map there and search again.") : tr("No signal, so only your saved places are searchable — nothing matched."));
  };
  const pick = (r) => { setSel({ ...r, found: !r.local }); setHits(null); setSheet("half"); flyTo(r, 16); };
  const savePlace = (p) => {
    const place = { id: "p" + Date.now().toString(36), name: String(p.name).slice(0, 120), lat: p.lat, lon: p.lon, note: "", ts: Date.now() };
    setSt((s) => ({ ...s, places: [place, ...s.places].slice(0, 300) }));
    remember && remember({ kind: "place", title: place.name.slice(0, 70), text: `${place.name} (${place.lat.toFixed(5)}, ${place.lon.toFixed(5)})`, output: "", tags: ["place", "map"] });
    flash(tr("Saved — it works offline now"));
    setSel({ ...place });
  };

  // ---- offline country maps ----
  const refreshPacks = () => { try { setPacks((JSON.parse(N.mapPacks()).packs) || []); } catch (e) {} };
  const check = async (code) => { try { const m = await nativeCall("mapRemote", { code }); setRemote((r) => ({ ...r, [code]: m })); return m; } catch (e) { setRemote((r) => ({ ...r, [code]: { error: String((e && e.message) || e) } })); return null; } };
  useEffect(() => { if (tab === "offline" && N && nativeCall && online) for (const p of packs) if (!remote[p.code]) check(p.code); }, [tab, online, packs.length]);
  useEffect(() => {   // once a day: is there a newer map of an installed country?
    if (!N || !nativeCall || !online || !packs.length) return;
    let last = 0; try { last = +localStorage.getItem("attune:map:checked") || 0; } catch (e) {}
    if (Date.now() - last < 864e5) return;
    try { localStorage.setItem("attune:map:checked", String(Date.now())); } catch (e) {}
    for (const p of packs) check(p.code);
  }, [online]);
  const updates = packs.filter((p) => OM.isNewer(remote[p.code], p));
  const install = async (code) => {
    if (!N || !nativeCall) return flash(tr("Offline maps work in the Android app."));
    const m = remote[code] && !remote[code].error ? remote[code] : await check(code);
    if (!m) return flash(tr("This country's map isn't published yet — it is built every Friday."));
    const have = packs.find((p) => p.code === code);
    const size = OM.prettyMB(OM.packBytes(m));
    if (!window.confirm(have ? tr("Update the map of {c} to the data of {d}? {s} — on Wi-Fi is best. The old map works until the new one is ready.", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"], d: m.date, s: size })
      : tr("Download the whole map of {c}? {s} — on Wi-Fi is best. Every road, building, place and shop, and offline search.", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"], s: size }))) return;
    setDl({ code, pct: 0, detail: "" });
    const p = nativeCall("mapInstall", { code }, (pct, stage, detail) => setDl((d) => (d ? { ...d, pct, detail } : d)));
    setDl((d) => ({ ...d, id: lastNativeId ? lastNativeId() : null }));
    try {
      await p; refreshPacks(); setPack(code); try { localStorage.setItem(PACK_KEY, code); } catch (e) {}
      flash(have ? tr("Map updated") : tr("The map of {c} works offline now", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"] }));
    } catch (e) { flash(String((e && e.message) || e).slice(0, 140)); }
    finally { setDl(null); }
  };
  const pause = () => { if (dl && dl.id && N && N.cancel) try { N.cancel(dl.id); } catch (e) {} };
  const removePack = (code) => {
    if (!window.confirm(tr("Delete the offline map of {c}? You can download it again.", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"] }))) return;
    try { N.mapRemove(code); } catch (e) {}
    refreshPacks(); if (pack === code) { setPack(""); try { localStorage.removeItem(PACK_KEY); } catch (e) {} }
  };
  const usePack = (code) => { setPack(code); try { localStorage.setItem(PACK_KEY, code); } catch (e) {} const c = OM.countryOf(code); const m = mapRef.current; if (m && c) m.flyTo({ center: c.c, zoom: c.z }); };

  if (fail) return fallback;
  const sheetH = sheet === "full" ? "86%" : sheet === "half" ? "46%" : "132px";
  const cname = (c) => (lang === "ar" ? c.ar : c.en);
  const chipCls = "shrink-0 h-9 px-3.5 rounded-full bg-slate-950/95 border border-slate-800 text-[13px] text-slate-100 shadow";
  return (
    <div ref={holder} data-testid="map-page" style={{ height: `calc(100dvh - ${top}px - 58px)` }}>
      <div className="fixed inset-x-0 z-10 bg-[#0b1220]" style={{ top, bottom: "calc(58px + env(safe-area-inset-bottom))" }}>
        <div ref={box} className="absolute inset-0" data-testid="map-canvas" />

        {/* search + chips */}
        <div className="absolute inset-x-0 top-0 p-3 space-y-2 pointer-events-none">
          <form onSubmit={(e) => { e.preventDefault(); runSearch(q); }} className="pointer-events-auto flex items-center gap-2 h-12 rounded-full bg-slate-950/95 border border-slate-800 ps-4 pe-1.5 shadow-lg">
            <Search size={17} className="text-slate-400 shrink-0" />
            <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" data-testid="map-search" aria-label={tr("Search a place or address")}
              placeholder={tr("Search a place or address")} className="flex-1 min-w-0 bg-transparent text-[14.5px] text-slate-100 placeholder:text-slate-500 focus:outline-none" />
            {q ? <button type="button" onClick={() => { setQ(""); setHits(null); }} aria-label={tr("Clear")} className="p-2 text-slate-400"><X size={16} /></button> : null}
            <span className={`text-[11px] px-2 py-1 rounded-full shrink-0 ${active ? "bg-emerald-950 text-emerald-300" : online ? "bg-slate-800 text-slate-300" : "bg-amber-950 text-amber-300"}`} data-testid="map-mode">
              {active ? tr("offline map") : online ? tr("online") : tr("no signal")}</span>
          </form>
          <div className="pointer-events-auto flex gap-2 overflow-x-auto [scrollbar-width:none] -mx-3 px-3">
            {CHIPS.map((c) => <button key={c[0]} onClick={() => runSearch(lang === "ar" ? c[2] : c[1], c)} className={chipCls} data-testid={"map-chip-" + c[0]}>{lang === "ar" ? c[2] : c[1]}</button>)}
          </div>
        </div>

        <button onClick={locateMe} aria-label={tr("My location")} data-testid="map-locate" className="absolute end-3 w-12 h-12 rounded-full bg-slate-950/95 border border-slate-800 text-slate-100 flex items-center justify-center shadow-lg" style={{ bottom: `calc(${sheetH} + 12px)` }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></button>

        {/* the sheet */}
        <section className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-slate-950 border-t border-slate-800 shadow-[0_-8px_24px_rgba(0,0,0,.35)] flex flex-col transition-[height] duration-200" style={{ height: sheetH }} data-testid="map-sheet">
          <button onClick={() => setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "peek")} aria-label={tr("Pull up")} className="w-full pt-2 pb-1 flex justify-center shrink-0">
            <span className="w-10 h-1.5 rounded-full bg-slate-700" /></button>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {updates.length && !sel && hits == null ? (
              <button onClick={() => install(updates[0].code)} className="w-full text-start rounded-2xl bg-emerald-950/70 border border-emerald-900 p-3 text-[13px] text-emerald-100" data-testid="map-update-banner">
                <RefreshCw size={13} className="inline me-1.5" />{tr("A newer map of {c} is ready (data of {d}) — tap to update", { c: cname(OM.countryOf(updates[0].code)), d: remote[updates[0].code].date })}</button>) : null}

            {sel ? (
              <div className="space-y-3" data-testid="map-place">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0"><p className="text-[17px] font-semibold text-white" dir="auto">{sel.name}</p>
                    <p className="text-[12.5px] text-slate-400 mt-0.5">{sel.local || sel.id ? tr("saved place") : sel.kind ? String(sel.kind).split("/").pop().replace(/_/g, " ") : ""}{me ? " · " + km(distKm(me, sel)) + " " + tr("from you") : ""}</p></div>
                  <button onClick={() => setSel(null)} aria-label={tr("Close")} className="p-2 text-slate-400"><X size={18} /></button>
                </div>
                <div className="flex gap-2">
                  <a href={`geo:${sel.lat},${sel.lon}?q=${sel.lat},${sel.lon}`} className="flex-1 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-semibold text-[14px] flex items-center justify-center">{tr("Directions")}</a>
                  {sel.found ? <button onClick={() => savePlace(sel)} data-testid="map-save-found" className="flex-1 h-12 rounded-2xl border border-slate-700 text-slate-100 text-[14px]">{tr("Save this place")}</button>
                    : <button onClick={() => { if (!window.confirm(tr("Delete this place?"))) return; setSt((s) => ({ ...s, places: s.places.filter((x) => x.id !== sel.id) })); setSel(null); }} className="flex-1 h-12 rounded-2xl border border-slate-700 text-slate-300 text-[14px]">{tr("Remove")}</button>}
                  <button onClick={() => { const t = `${sel.name}\nhttps://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lon}#map=17/${sel.lat}/${sel.lon}`; if (N && N.share) N.share(t); else { try { navigator.clipboard.writeText(t); } catch (e) {} flash(tr("Copied")); } }}
                    aria-label={tr("Share")} className="w-12 h-12 rounded-2xl border border-slate-700 text-slate-200 flex items-center justify-center"><Share2 size={17} /></button>
                </div>
                <p className="text-[11px] text-slate-500 font-mono">{sel.lat.toFixed(5)}, {sel.lon.toFixed(5)}</p>
              </div>
            ) : hits != null ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><p className="text-[12px] text-slate-400">{busy ? tr("Searching…") : tr("{n} results", { n: hits.length })}</p>
                  <button onClick={() => setHits(null)} className="text-[12px] text-slate-400 p-1">{tr("Close")}</button></div>
                {busy ? <Loader2 size={18} className="animate-spin text-slate-400" /> : null}
                {hits.map((r, i) => (
                  <button key={i} onClick={() => pick(r)} data-testid="map-hit" className="w-full flex items-center gap-3 text-start rounded-2xl bg-slate-900 px-3 py-2.5">
                    <MapPin size={16} className={r.local ? "text-emerald-300" : r.offline ? "text-sky-300" : "text-slate-400"} />
                    <span className="flex-1 min-w-0"><span className="block text-[14px] text-slate-100 truncate" dir="auto">{r.name}</span>
                      <span className="block text-[11.5px] text-slate-500">{r.local ? tr("saved place") : r.kind ? String(r.kind).split("/").pop().replace(/_/g, " ") : ""}{r.offline ? " · " + tr("offline") : ""}</span></span>
                    <span className="text-[12px] text-slate-400 tabular-nums shrink-0">{km(r.dist)}</span>
                  </button>))}
              </div>
            ) : (
              <>
                <div className="flex rounded-xl border border-slate-800 overflow-hidden" role="tablist">
                  {[["places", tr("Your places")], ["offline", tr("Offline maps") + (updates.length ? " •" : "")]].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (sheet === "peek") setSheet("half"); }} data-testid={"map-tab-" + k}
                      className={`flex-1 h-10 text-[13px] ${tab === k ? "bg-slate-800 text-white font-medium" : "text-slate-400"}`}>{l}</button>))}
                </div>
                {tab === "places" ? (
                  st.places.length ? st.places.map((p) => (
                    <button key={p.id} onClick={() => { setSel(p); flyTo(p, 15); }} className="w-full flex items-center gap-3 text-start py-2.5 border-b border-slate-900">
                      <MapPin size={16} className="text-emerald-300 shrink-0" /><span className="flex-1 min-w-0 text-[14px] text-slate-200 truncate" dir="auto">{p.name}</span>
                      <span className="text-[12px] text-slate-500">{me ? km(distKm(me, p)) : ""}</span></button>))
                    : <p className="text-[13px] text-slate-500 py-2">{tr("Search a place and tap “Save this place” — saved places work with no signal.")}</p>
                ) : (
                  <div className="space-y-2" data-testid="map-offline">
                    <p className="text-[12px] text-slate-400 leading-relaxed">{tr("Download a whole country once: every road, building, place and shop, and search — all with no signal. A new version is built every week from OpenStreetMap; the app tells you when one is ready.")}</p>
                    {OM.COUNTRIES.map((c) => {
                      const have = packs.find((p) => p.code === c.code), rm = remote[c.code], upd = have && OM.isNewer(rm, have), mine = dl && dl.code === c.code;
                      return (
                        <div key={c.code} className={`rounded-2xl border p-3 ${active === c.code ? "border-emerald-700 bg-emerald-950/30" : "border-slate-800 bg-slate-900"}`} data-testid={"map-country-" + c.code}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => (have ? usePack(c.code) : null)} className="flex-1 min-w-0 text-start">
                              <span className="block text-[14px] text-slate-100 font-medium truncate">{cname(c)}</span>
                              <span className="block text-[11.5px] text-slate-400">{have ? tr("On this phone · data of {d} · {s}", { d: have.date, s: OM.prettyMB(have.bytes) }) + (active === c.code ? " · " + tr("showing") : "")
                                : rm && rm.date ? tr("{s} · data of {d}", { s: OM.prettyMB(OM.packBytes(rm)), d: rm.date }) : ""}</span>
                            </button>
                            {mine ? <button onClick={pause} className="h-10 px-3 rounded-xl border border-slate-700 text-slate-200 text-[13px]">{tr("Pause")}</button>
                              : upd ? <button onClick={() => install(c.code)} disabled={!!dl} data-testid={"map-update-" + c.code} className="h-10 px-3 rounded-xl bg-emerald-500 text-slate-950 text-[13px] font-semibold flex items-center gap-1 disabled:opacity-40"><RefreshCw size={13} />{tr("Update")}</button>
                              : have ? <button onClick={() => removePack(c.code)} aria-label={tr("Delete")} data-testid={"map-remove-" + c.code} className="h-10 w-10 rounded-xl border border-slate-800 text-slate-400 flex items-center justify-center"><Trash2 size={15} /></button>
                              : <button onClick={() => install(c.code)} disabled={!!dl} data-testid={"map-dl-" + c.code} className="h-10 px-3 rounded-xl border border-emerald-800 text-emerald-200 text-[13px] flex items-center gap-1 disabled:opacity-40"><Download size={13} />{tr("Download")}</button>}
                          </div>
                          {mine ? <div className="mt-2" data-testid="map-progress"><div className="h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-emerald-400" style={{ width: (dl.pct || 0) + "%" }} /></div>
                            <p className="text-[11px] text-slate-400 mt-1 tabular-nums">{dl.pct || 0}% · {dl.detail}</p></div> : null}
                          {rm && rm.error && !have ? <p className="text-[11px] text-amber-300 mt-1">{tr(rm.error)}</p> : null}
                        </div>);
                    })}
                    {packs.length ? <button onClick={() => { setPack(""); try { localStorage.setItem(PACK_KEY, "-"); } catch (e) {} }} className="text-[12px] text-slate-400 underline">{tr("Show the online map instead")}</button> : null}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
