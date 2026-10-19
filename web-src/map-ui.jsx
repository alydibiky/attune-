/* ---- v6.15 Maps, look A (Ali's pick): the map fills the screen; a floating search and category chips on top; a sheet
   pulled up from the bottom holds the picked place, the results, your places and the offline country maps.
   The map is drawn by MapLibre: from an installed country pack (offline, vector, offlinemap.js) or, without one, from
   online picture tiles through the app's tile cache. If the phone can't draw it (no WebGL), the old map is shown. */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, Download, RefreshCw, Trash2, MapPin, Share2, Loader2, Globe } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as OM from "./offlinemap.js";
import * as MS from "./mapsearch.js";
import * as MI from "./mapintent.js";
import * as RT from "./route.js";

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

// v6.27: the label layer of named areas (drawn above the basemap's own labels: compounds in teal, neighbourhoods in grey)
function addAreaLayer(map) {
  if (map.getSource("att-areas")) return;
  map.addSource("att-areas", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({ id: "att-areas", type: "symbol", source: "att-areas", minzoom: 12,
    layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Medium"], "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14],
      "text-max-width": 8, "symbol-sort-key": ["-", 1, ["get", "compound"]], "text-padding": 6 },
    paint: { "text-color": ["case", ["==", ["get", "compound"], 1], "#0f766e", "#475569"], "text-halo-color": "#ffffff", "text-halo-width": 1.6 } });
}

export function MapPage({ N, nativeCall, lastNativeId, getTile, findPlaces, searchSaved, load, save, remember, flash, myLang, fallback, onExit, listen, ask, openMetro }) {
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
  const [trip, setTrip] = useState(null);
  const [adding, setAdding] = useState(null);              // v6.20 "add a missing place": the name being typed, or null                  // v6.20 directions: {to, mode, busy, res, error, need}
  const routeFiles = useRef({});                           // code → opened route file (route.js)
  const holder = useRef(null), box = useRef(null), mapRef = useRef(null), markers = useRef([]);
  // v6.27: a country you picked → else the first country → else the world overview → else no map yet (OpenStreetMap's
  // own tile servers are not used any more: they forbid apps and answered 403 on the desktop)
  const countryPacks = packs.filter((p) => p.code !== OM.WORLD), hasWorld = packs.some((p) => p.code === OM.WORLD);
  // v6.27 (Ali: "streets and compounds everywhere online — and I don't want to pay for maps"): with signal, the country the
  // map is looking at is read ONLINE from our free GitHub release, without downloading it ("net:eg"). Order: the country
  // in view if downloaded → that country online → the country you picked → your first country → the world overview → nothing
  const onlineOk = online && !!N && typeof N.mapRange === "function" && !!nativeCall;
  const near = OM.nearestCountry(view.lat, view.lon);
  const haveNear = near && view.z >= 4 && countryPacks.some((p) => p.code === near.code);
  const active = haveNear ? near.code : near && onlineOk && view.z >= 4 ? "net:" + near.code
    : countryPacks.find((p) => p.code === pack) ? pack : (countryPacks[0] && countryPacks[0].code) || (hasWorld ? OM.WORLD : "")
      || (near && onlineOk ? "net:" + near.code : "");
  const streaming = active.startsWith("net:");
  const [assetsTick, setAssetsTick] = useState(0);   // the fonts and icons arrived: draw the labels
  useEffect(() => {
    if (!streaming || assetsTick) return;
    nativeCall("mapAssets", {}).then(() => setAssetsTick(1)).catch(() => {});
  }, [streaming]);
  const styleOf = (code) => OM.mapStyle({ pack: code || null, dark: false, lang });

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  // where the map starts: below the app's header. Measured again after the page settles (opened from a scrolled page,
  // the first measure put the search bar under the header — Ali's screenshot, Oct 2026) and when the screen turns.
  useEffect(() => {
    const measure = () => {
      const h = document.querySelector("header.sticky"), hb = h && h.getClientRects().length ? h.getBoundingClientRect().bottom : 0;
      const ht = holder.current ? holder.current.getBoundingClientRect().top : 0;
      setTop(Math.max(0, Math.round(Math.max(hb, ht))));
    };
    try { window.scrollTo(0, 0); } catch (e) {}
    measure(); const raf = requestAnimationFrame(measure), tm = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); clearTimeout(tm); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => { save({ places: st.places, view }); }, [st.places, view]);

  // ---- the map ----
  useEffect(() => {
    let map = null, gone = false;
    (async () => {
      if (!OM.webglOk()) { setFail("webgl"); return; }
      const ml = await OM.loadMapLibre();
      if (gone || !box.current) return;
      OM.registerProtocols(ml, N, getTile, nativeCall);
      map = new ml.Map({ container: box.current, style: styleOf(active), center: [view.lon, view.lat], zoom: view.z,
        attributionControl: false,   // the credit rides on the sheet (below): MapLibre's box sat on top of the sheet
        maxZoom: 19, dragRotate: false, pitchWithRotate: false });
      map.touchZoomRotate.disableRotation();
      map.on("moveend", () => { const c = map.getCenter(); setView({ lat: c.lat, lon: c.lng, z: map.getZoom() }); });
      map.on("load", () => setReady(true));
      // v6.27: our own label layer — compounds and neighbourhoods from the places index (offline pack or online pieces)
      map.on("style.load", () => { try { addAreaLayer(map); areaFn.current && areaFn.current(); } catch (e) {} });
      map.on("moveend", () => { clearTimeout(areaT.current); areaT.current = setTimeout(() => areaFn.current && areaFn.current(), 250); });
      let told = false;   // a tile that can't be read: say it once, never a stream of console errors
      map.on("error", (e) => { const m = String((e && e.error && e.error.message) || ""); if (!told && /missing|not published/.test(m)) { told = true; flash(tr(m)); } });
      mapRef.current = map;
      if (typeof window !== "undefined") window.__attuneMap = map;      // tests read the map's state
    })().catch((e) => setFail(String((e && e.message) || e)));
    return () => { gone = true; if (map) map.remove(); mapRef.current = null; };
  }, []);
  // ---- v6.27: compounds and neighbourhoods named on the map (Ali: "compounds like Google Maps") ----
  const areaFn = useRef(null), areaT = useRef(null);
  areaFn.current = async () => {
    const m = mapRef.current; if (!m || !m.getSource || !m.getSource("att-areas")) return;
    const empty = { type: "FeatureCollection", features: [] };
    if (m.getZoom() < 12) { m.getSource("att-areas").setData(empty); return; }
    const b = m.getBounds(), box = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }, c = m.getCenter();
    const nc = OM.nearestCountry(c.lat, c.lng); if (!nc) return;
    let list = [];
    try {
      if (packs.some((p) => p.code === nc.code) && nativeCall) {
        const r = await nativeCall("mapSearch", { q: "", kinds: OM.AREA_KINDS, limit: 50, lat: c.lat, lon: c.lng, radiusDeg: Math.max(box.n - box.s, box.e - box.w) / 1.5 });
        list = ((r && r.places) || []).filter((p) => OM.AREA_KINDS.includes(p.kind));
      } else if (onlineOk) list = await OM.netAreas(nativeCall, nc.code, box);
    } catch (e) { list = []; }
    const src = m.getSource("att-areas"); if (src) src.setData(OM.areasGeoJSON(list, lang));
  };
  // the source: the active country pack, or online tiles
  const styleKey = useRef("");
  useEffect(() => {
    const m = mapRef.current; if (!m) return;
    const k = (active || "-") + lang + assetsTick;
    if (styleKey.current && styleKey.current !== k) m.setStyle(styleOf(active));
    styleKey.current = k;
  }, [active, lang, ready, assetsTick]);
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
  // One search around a point: your saved places → the downloaded pack → the country's index online → the web searches.
  // kinds: the sorts to look for (a chip, or a sort read from what was typed); word: those sorts as a word for the web.
  const searchAt = async (term, kinds, word, c, push, out) => {
    if (term && !kinds.length) for (const p of searchSaved(st.places, term)) push({ ...p, local: true });
    if (packs.length && nativeCall) {
      // v6.18 (Ali searched "Address east compound" offline and got nothing): the offline map is asked again with
      // simpler wordings — without "address", "compound"… — as the online search already was
      for (const t of kinds.length ? [""] : [term, ...MS.variants(term)]) {
        try { const r = await nativeCall("mapSearch", { q: t, kinds, limit: kinds.length ? 40 : 15, lat: c.lat, lon: c.lon });
          for (const p of (r && r.places) || []) push({ name: (lang === "ar" && p.name_ar) || (lang === "en" && p.name_en) || p.name, alt: [p.name, p.name_ar, p.name_en].filter(Boolean), lat: p.lat, lon: p.lon, kind: p.kind, rank: p.rank, offline: true, dist: p.dist }); } catch (e) {}
        if (out.some((x) => x.offline && (kinds.length || MS.matches(x, term)))) break;   // v6.42: only a real match ends the search
      }
    }
    // v6.27: the country in view, not downloaded → its own places index, read ONLINE in one small piece (OSM + Overture:
    // compounds, shops, clinics the free web searches miss), then the web searches as before
    if ((term || word) && onlineOk) {
      const nc = OM.nearestCountry(c.lat, c.lon);
      if (nc && !packs.some((p) => p.code === nc.code)) {
        // a sort: its name words ("سوري"), then the sort's own word ("مطعم"), keeping only places of that sort
        for (const t of (kinds.length ? [term, ...MI.sortNames(word)] : [term, ...MS.variants(term)]).filter(Boolean)) {
          try { for (const p of await OM.netFind(nativeCall, nc.code, t, { lat: c.lat, lon: c.lon, limit: kinds.length ? 60 : 25 }))
            if (!kinds.length || kinds.includes(p.kind)) push({ name: (lang === "ar" && p.name_ar) || (lang === "en" && p.name_en) || p.name, alt: [p.name, p.name_ar, p.name_en].filter(Boolean), lat: p.lat, lon: p.lon, kind: p.kind, rank: p.rank, net: true }); } catch (e) { break; }
          if (!kinds.length && out.some((x) => x.net && MS.matches(x, term))) break;
        }
      }
    }
    if (online && out.filter((x) => !x.local && (kinds.length || MS.matches(x, term))).length < 3) {
      try { const r = await findPlaces(kinds.length ? [word, term].filter(Boolean).join(" ") : term, { center: c, lang, fetchJson: async (u) => { const res = await fetch(u, { headers: { Accept: "application/json" } }); if (!res.ok) throw new Error("search " + res.status); return res.json(); } });
        for (const p of (r && r.places) || []) push(p); } catch (e) {}
    }
  };
  const runSearch = async (term, chip) => {
    term = String(term || "").trim(); if (!term && !chip) return;
    setBusy(true); setSel(null); setSheet("half"); if (trip) endTrip();
    let c = center(); const out = [], seen = new Set();
    const push = (p) => { const k = Math.round(p.lat * 2000) + ":" + Math.round(p.lon * 2000) + ":" + String(p.name).slice(0, 12); if (seen.has(k)) return; seen.add(k); out.push({ ...p, dist: p.dist != null ? p.dist : distKm(c, p) }); };
    let byDist = !!chip, said = "", rankQ = term;
    if (chip) await searchAt("", chip[3], chip[4], c, push, out);
    else {
      // v6.27 (Ali: "AI-powered"): what was typed is read first — a sort ("أقرب صيدلية"), an area ("… في التجمع"), "near me";
      // code does it; the phone's model only for a longer request code can't read (and only when it is already loaded)
      let it = MI.parseMapQuery(term);
      if (MI.needsModel(term, it) && ask) { try { const r = MI.readModel(await ask(MI.modelPrompt(term))); if (r && (r.sort || r.area)) it = r; } catch (e) {} }
      if (it.sort || it.area) {
        if (it.area) {
          const found = [], seenA = new Set(), pushA = (p) => { const k = p.lat + ":" + p.lon; if (!seenA.has(k)) { seenA.add(k); found.push(p); } };
          await searchAt(it.area, [], "", c, pushA, found);
          const a = found.find((p) => /^place\//.test(p.kind || "")) || found.find((p) => !p.local) || found[0];
          if (a) { c = { lat: a.lat, lon: a.lon }; said = a.name; }
        } else if (it.near && me) c = { lat: me.lat, lon: me.lon };
        if (it.sort) await searchAt(it.what, it.kinds, MI.sortWords(it.sort, lang), c, push, out);
        else await searchAt(it.what || term, [], "", c, push, out);
        if (it.sort && it.what) out.sort((a, b) => (MS.nameScore(b.name, it.what) > 0) - (MS.nameScore(a.name, it.what) > 0));   // "سوري" names first
        byDist = !!it.sort && !it.what; rankQ = it.what || term;
        if (said) flash(tr("Around {p}", { p: said }));
        else if (it.model) flash(tr("Read by AI: {s}", { s: [it.sort && MI.sortWords(it.sort, lang), it.what].filter(Boolean).join(" · ") }));
        if (out.length < 3 && it.sort && it.what) await searchAt(term, [], "", center(), push, out);     // a name that holds a sort word ("Mall of Arabia")
      } else await searchAt(term, [], "", c, push, out);
    }
    out.forEach((p) => { p.dist = distKm(c, p); });
    // v6.42: a name search shows only places whose name matches what was typed (not every place sharing "compound")
    if (!byDist && rankQ) { const kept = MS.keepMatching(out, rankQ); if (!kept.length && out.length) flash(tr("No place called “{q}” in the map data — try another spelling", { q: rankQ })); out.splice(0, out.length, ...kept); }
    // v6.27: one Google-like order (name match → importance → distance); "nearest X" stays nearest first
    setHits(byDist ? out.sort((a, b) => a.dist - b.dist) : MS.rankPlaces(out, rankQ, c));
    setBusy(false);
    if (said && mapRef.current && out.length) mapRef.current.flyTo({ center: [c.lon, c.lat], zoom: 13 });
    if (!out.length && !(online || packs.length)) flash(tr("No signal, so only your saved places are searchable — nothing matched."));
  };
  // v6.27: a search handed over from Chat ("Show on the map")
  useEffect(() => {
    let q0 = ""; try { q0 = localStorage.getItem("attune:map:ask") || ""; localStorage.removeItem("attune:map:ask"); } catch (e) {}
    if (q0) { setQ(q0); setTimeout(() => runSearch(q0), 300); }
  }, []);
  // v6.18: the place card keeps the other results, shown as "Other matches" (look A)
  const pick = (r, from) => { setSel({ ...r, found: !r.local, src: r, from: from || null }); setHits(null); setSheet("half"); flyTo(r, 16); };
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
  const [cq, setCq] = useState("");
  // the countries: the ones on this phone first, then by name; the box filters by English or Arabic name
  const countryList = useMemo(() => {
    const k = OM.normalize(cq);
    return OM.COUNTRIES.filter((c) => !k || OM.normalize(c.en + " " + c.ar).includes(k))
      .sort((a, b) => (packs.some((p) => p.code === b.code) - packs.some((p) => p.code === a.code)) || (lang === "ar" ? a.ar.localeCompare(b.ar, "ar") : a.en.localeCompare(b.en)));
  }, [cq, packs, lang]);
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
  // v6.27: the world overview — every country at low zoom, so the map is never empty; downloads by itself on Wi-Fi
  const installWorld = async (quiet) => {
    if (!N || !nativeCall || dl) return;
    const m = remote[OM.WORLD] && !remote[OM.WORLD].error ? remote[OM.WORLD] : await check(OM.WORLD);
    if (!m) { if (!quiet) flash(tr("The world map isn't published yet.")); return; }
    if (!quiet && !window.confirm(tr("Download the world map? {s} — every country, without street detail.", { s: OM.prettyMB(OM.packBytes(m)) }))) return;
    setDl({ code: OM.WORLD, pct: 0, detail: "" });
    const p = nativeCall("mapInstall", { code: OM.WORLD }, (pct, stage, detail) => setDl((d) => (d ? { ...d, pct, detail } : d)));
    setDl((d) => ({ ...d, id: lastNativeId ? lastNativeId() : null }));
    try { await p; refreshPacks(); } catch (e) { if (!quiet) flash(String((e && e.message) || e).slice(0, 140)); }
    finally { setDl(null); }
  };
  useEffect(() => {
    let wifi = false; try { wifi = !!(N && N.unmetered && N.unmetered()); } catch (e) {}
    if (!packs.length && online && wifi) installWorld(true);
  }, []);
  const pause = () => { if (dl && dl.id && N && N.cancel) try { N.cancel(dl.id); } catch (e) {} };
  const removePack = (code) => {
    if (!window.confirm(tr("Delete the offline map of {c}? You can download it again.", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"] }))) return;
    try { N.mapRemove(code); } catch (e) {}
    refreshPacks(); if (pack === code) { setPack(""); try { localStorage.removeItem(PACK_KEY); } catch (e) {} }
  };
  const usePack = (code) => { setPack(code); try { localStorage.setItem(PACK_KEY, code); } catch (e) {} const c = OM.countryOf(code); const m = mapRef.current; if (m && c) m.flyTo({ center: c.c, zoom: c.z }); };

  // ---- v6.20: directions inside Attune, offline (Ali: "what's the point of maps if it will redirect me to another map") ----
  const packsNow = () => { try { return (JSON.parse(N.mapPacks()).packs) || packs; } catch (e) { return packs; } };   // fresh: just after a download, the state is a render behind
  const packOf = (p) => { const L = packsNow().filter((x) => x.code !== OM.WORLD); return L.find((x) => x.code === active) || L.find((x) => { const c = OM.countryOf(x.code); return c && c.c && Math.abs(c.c[1] - p.lat) < 12 && Math.abs(c.c[0] - p.lon) < 15; }) || null; };
  const openRoutes = async (code) => {
    if (routeFiles.current[code]) return routeFiles.current[code];
    const path = `${code}/${code}-route.bin`;
    const readRange = async (offset, length) => {
      const b64 = N.mapRead(JSON.stringify({ path, offset, length }));
      if (!b64) throw new Error("missing");
      const raw = atob(b64), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return u8.buffer;
    };
    const r = await RT.openRoutes(readRange); routeFiles.current[code] = r; return r;
  };
  const whereAmI = () => new Promise((ok) => {
    if (me) return ok(me);
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => { const pt = { lat: p.coords.latitude, lon: p.coords.longitude }; setMe(pt); ok(pt); }, () => ok(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
  const drawTrip = (line) => {
    const m = mapRef.current; if (!m) return;
    const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line || [] } };
    try {
      if (m.getSource("trip")) m.getSource("trip").setData(data);
      else {
        m.addSource("trip", { type: "geojson", data });
        m.addLayer({ id: "trip-casing", type: "line", source: "trip", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#ffffff", "line-width": 10 } });
        m.addLayer({ id: "trip-line", type: "line", source: "trip", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#2563eb", "line-width": 6 } });
      }
      if (line && line.length > 1) {
        const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
        m.fitBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], { padding: { top: 140, bottom: Math.round(innerHeight * 0.5) + 20, left: 40, right: 40 }, duration: 600 });
      }
    } catch (e) {}
  };
  const goTrip = async (to, mode = (trip && trip.mode) || "car") => {
    setSheet("half");
    const pk = N && N.mapRead ? packOf(to) : null;
    if (!pk) { setTrip({ to, mode, need: "map" }); return; }
    if (!pk.routes) { setTrip({ to, mode, need: "routes", code: pk.code }); if (online && !remote[pk.code]) check(pk.code); return; }
    setTrip({ to, mode, busy: true, code: pk.code });
    const from = await whereAmI();
    if (!from) { setTrip({ to, mode, error: "location", code: pk.code }); return; }
    try {
      const R = await openRoutes(pk.code);
      const res = await RT.route(R, from, to, mode);
      if (res.error) { setTrip({ to, mode, error: res.error, code: pk.code }); drawTrip(null); return; }
      setTrip({ to, mode, res, code: pk.code, from }); drawTrip(res.line);
    } catch (e) { setTrip({ to, mode, error: "read", code: pk.code }); }
  };
  const endTrip = () => { setTrip(null); drawTrip(null); };
  const getRoutes = async (code) => {
    const m = remote[code] && !remote[code].error ? remote[code] : await check(code);
    const f = m && (m.files || []).find((x) => /-route\.bin$/.test(x.name));
    if (!f) return flash(tr("Directions for this country aren't published yet — the maps are rebuilt every Friday."));
    if (!window.confirm(tr("Download the directions of {c}? {s} — on Wi-Fi is best. Routes by car and on foot, with no signal.", { c: OM.countryOf(code)[lang === "ar" ? "ar" : "en"], s: OM.prettyMB(f.bytes) }))) return;
    setDl({ code, pct: 0, detail: "" });
    const p = nativeCall("mapInstall", { code, routesOnly: true }, (pct, stage, detail) => setDl((d) => (d ? { ...d, pct, detail } : d)));
    setDl((d) => ({ ...d, id: lastNativeId ? lastNativeId() : null }));
    const was = trip;
    try { await p; refreshPacks(); flash(tr("Directions work offline now")); if (was && was.to) goTrip(was.to, was.mode); }
    catch (e) { flash(String((e && e.message) || e).slice(0, 140)); }
    finally { setDl(null); }
  };
  const turnText = (s, i, all) => {
    const road = s.name || tr("the road");
    const T = { start: tr("Head out on {r}", { r: road }), straight: tr("Continue on {r}", { r: road }), "slight left": tr("Keep left onto {r}", { r: road }), "slight right": tr("Keep right onto {r}", { r: road }),
      left: tr("Turn left onto {r}", { r: road }), right: tr("Turn right onto {r}", { r: road }), "u-turn": tr("Make a U-turn on {r}", { r: road }) };
    return T[s.turn] || road;
  };
  const turnIcon = (t) => ({ start: "↑", straight: "↑", "slight left": "↖", "slight right": "↗", left: "←", right: "→", "u-turn": "↶" }[t] || "↑");
  const mins = (s) => { const m = Math.max(1, Math.round(s / 60)); return m < 60 ? tr("{m} min", { m }) : tr("{h} h {m} min", { h: Math.floor(m / 60), m: m % 60 }); };

  if (fail) return fallback;
  // v6.18 look A (Ali: "the maps is still stupid… make it like an app inside Attune"): the map fills the whole screen
  // (Attune's header and bottom bar are hidden while it is open), a bright map, one white search bar with ← back,
  // the country badge opens Offline maps, a white sheet for your places, results and the picked place.
  const sheetH = sheet === "full" ? "88%" : sheet === "half" ? "50%" : "118px";
  const cname = (c) => (lang === "ar" ? c.ar : c.en);
  const chipCls = "shrink-0 h-10 px-4 rounded-full bg-white text-[13.5px] font-semibold text-slate-900 shadow-[0_2px_8px_rgba(17,24,39,.14)]";
  const fab = "w-12 h-12 rounded-full bg-white text-slate-700 flex items-center justify-center shadow-[0_3px_10px_rgba(17,24,39,.2)]";
  const others = sel && sel.from ? sel.from.filter((r) => r !== sel.src).slice(0, 3) : [];
  return (
    <div ref={holder} data-testid="map-page" data-look="a" style={{ height: "100dvh" }}>
      <div className="att-shift fixed inset-0 z-10 bg-[#f2efe9] text-slate-900" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* inline: MapLibre's own CSS (.maplibregl-map{position:relative}) loads later and turned the class into a 0-px-tall box —
            the map was drawn but never seen (Ali, Oct 2026) */}
        <div ref={box} style={{ position: "absolute", inset: 0 }} data-testid="map-canvas" />
        {!active && !fail ? (
          <div className="absolute inset-x-4 top-24 z-10 mx-auto max-w-sm rounded-2xl bg-white/95 border border-slate-200 p-4 shadow-sm text-center" data-testid="map-empty">
            <p className="text-[15px] font-bold text-slate-900">{tr("No map on this device yet")}</p>
            <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{tr("Download the world map to see every country, or your country's map for streets, places and offline search.")}</p>
            {dl && dl.code === OM.WORLD ? <p className="text-[12px] text-slate-600 mt-2 tabular-nums" data-testid="map-world-progress">{dl.pct || 0}% · {dl.detail}</p>
              : <button onClick={() => installWorld(false)} disabled={!!dl} data-testid="map-dl-world" className="mt-3 h-10 px-4 rounded-full bg-blue-600 text-white text-[13px] font-bold disabled:opacity-40">{tr("Download the world map")}</button>}
          </div>) : null}

        {/* search + chips */}
        <div className="absolute inset-x-0 p-3 space-y-2.5 pointer-events-none" style={{ top: "env(safe-area-inset-top)" }}>
          <form onSubmit={(e) => { e.preventDefault(); runSearch(q); }} className="pointer-events-auto flex items-center gap-1 h-14 rounded-full bg-white ps-1.5 pe-1.5 shadow-[0_4px_14px_rgba(17,24,39,.18)]">
            {onExit ? <button type="button" onClick={onExit} aria-label={tr("Back to Attune")} data-testid="map-exit" className="w-11 h-11 rounded-full flex items-center justify-center text-slate-800 shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="rtl:-scale-x-100"><path d="M15 5l-7 7 7 7" /></svg></button> : <Search size={18} className="text-slate-500 shrink-0 ms-3" />}
            <input value={q} onChange={(e) => setQ(e.target.value)} dir="auto" data-testid="map-search" aria-label={tr("Search a place or address")} enterKeyHint="search"
              placeholder={tr("Search here")} className="flex-1 min-w-0 bg-transparent text-[15.5px] text-slate-900 placeholder:text-slate-500 focus:outline-none" />
            {q ? <button type="button" onClick={() => { setQ(""); setHits(null); }} aria-label={tr("Clear")} className="w-10 h-10 flex items-center justify-center text-slate-500"><X size={18} /></button> : null}
            {listen && !q ? <button type="button" onClick={async () => { try { const said = await listen(lang === "ar" ? "ar-EG" : "", (t) => setQ(t)); if (said) { setQ(said); runSearch(said); } } catch (e) {} }}
              aria-label={tr("Say it")} className="w-10 h-10 flex items-center justify-center text-slate-600"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg></button> : null}
            <button type="button" onClick={() => { setSel(null); setHits(null); setTab("offline"); setSheet("full"); }} data-testid="map-open-offline" aria-label={tr("Offline maps")}
              className={`relative h-10 min-w-10 px-2.5 rounded-full text-[12.5px] font-extrabold flex items-center justify-center shrink-0 ${active ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700"}`}>
              {streaming ? <Globe size={17} aria-hidden="true" /> : active ? active.toUpperCase() : <Download size={17} aria-hidden="true" />}{updates.length ? <span className="absolute -top-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" aria-label={tr("Update ready")} /> : null}</button>
          </form>
          <div className="pointer-events-auto flex gap-2 overflow-x-auto [scrollbar-width:none] -mx-3 px-3 pb-1">
            {openMetro ? <button onClick={openMetro} className={chipCls} data-testid="map-chip-metro">{tr("Metro")}</button> : null}{/* v6.42: Cairo Metro is the tab next to Maps */}
            {CHIPS.map((c) => <button key={c[0]} onClick={() => runSearch(lang === "ar" ? c[2] : c[1], c)} className={chipCls} data-testid={"map-chip-" + c[0]}>{lang === "ar" ? c[2] : c[1]}</button>)}
          </div>
        </div>

        {sheet !== "full" ? <div className="absolute end-3 flex flex-col gap-2.5" style={{ bottom: `calc(${sheetH} + 14px)` }}>
          <button onClick={() => { setSel(null); setHits(null); setAdding(""); setSheet("peek"); }} aria-label={tr("Add a missing place")} title={tr("Add a missing place")} data-testid="map-add-place" className={fab + " w-14 h-14 text-emerald-700"}><MapPin size={20} /><span className="text-[15px] font-black -ms-0.5">+</span></button>
          <button onClick={locateMe} aria-label={tr("My location")} data-testid="map-locate" className={fab + " w-14 h-14 text-blue-700"}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg></button>
        </div> : null}

        {adding != null ? <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-[4]" data-testid="map-add-cross" aria-hidden="true">
            <svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 32 27 32 16A15 15 0 0 0 2 16C2 27 17 43 17 43Z" fill="#059669" stroke="#fff" strokeWidth="3" /><circle cx="17" cy="16" r="5" fill="#fff" /></svg></div>
          <form onSubmit={(e) => { e.preventDefault(); const n = adding.trim(); if (!n) return; const c = center(); savePlace({ name: n, lat: c.lat, lon: c.lon }); setAdding(null); }}
            className="absolute inset-x-3 z-[6] rounded-2xl bg-white shadow-[0_4px_18px_rgba(17,24,39,.2)] p-3 space-y-2" style={{ bottom: "calc(118px + 12px)" }} data-testid="map-add-form">
            <p className="text-[13px] text-slate-600">{tr("Move the map so the pin is on the place, then name it. It is saved on this phone and found by search, offline.")}</p>
            <div className="flex gap-2"><input autoFocus value={adding} onChange={(e) => setAdding(e.target.value)} dir="auto" placeholder={tr("The place's name")} data-testid="map-add-name"
              className="flex-1 min-w-0 h-11 rounded-xl bg-slate-100 px-3 text-[15px] text-slate-900 focus:outline-none" />
              <button type="submit" disabled={!adding.trim()} data-testid="map-add-save" className="h-11 px-4 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-40">{tr("Save")}</button>
              <button type="button" onClick={() => setAdding(null)} aria-label={tr("Cancel")} className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><X size={18} /></button></div>
          </form></> : null}
        {/* the sheet */}
        <section className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-[0_-4px_18px_rgba(17,24,39,.16)] flex flex-col transition-[height] duration-200 z-[5]" style={{ height: sheetH, paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="map-sheet">
          {sheet !== "full" ? <span className="absolute -top-6 start-2 rounded-md bg-white/85 px-1.5 py-0.5 text-[10px] text-slate-600 pointer-events-none" data-testid="map-credit">© OpenStreetMap contributors{active ? " · Protomaps · Overture Maps" : ""}</span> : null}
          <button onClick={() => setSheet(sheet === "peek" ? "half" : sheet === "half" ? "full" : "peek")} aria-label={tr("Pull up")} className="w-full pt-2.5 pb-1.5 flex justify-center shrink-0">
            <span className="w-10 h-1.5 rounded-full bg-slate-300" /></button>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
            {updates.length && !sel && hits == null ? (
              <button onClick={() => install(updates[0].code)} className="w-full text-start rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-[13px] text-emerald-900" data-testid="map-update-banner">
                <RefreshCw size={13} className="inline me-1.5" />{tr("A newer map of {c} is ready (data of {d}) — tap to update", { c: cname(OM.countryOf(updates[0].code)), d: remote[updates[0].code].date })}</button>) : null}

            {trip ? (
              <div className="space-y-3" data-testid="map-trip">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0"><p className="text-[12.5px] text-slate-500">{tr("Directions to")}</p>
                    <p className="text-[19px] font-extrabold text-slate-900 leading-snug truncate" dir="auto">{String(trip.to.name || "").split(",")[0]}</p></div>
                  <button onClick={endTrip} aria-label={tr("Close")} data-testid="map-trip-close" className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><X size={18} /></button>
                </div>
                <div className="flex gap-2" role="group" aria-label={tr("Travel by")}>
                  {[["car", tr("Car"), "🚗"], ["walk", tr("Walk"), "🚶"]].map(([k, l, e]) => (
                    <button key={k} onClick={() => goTrip(trip.to, k)} aria-pressed={trip.mode === k} data-testid={"map-mode-" + k}
                      className={`flex-1 h-11 rounded-full text-[14px] font-bold ${trip.mode === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>{e} {l}</button>))}
                </div>
                {trip.busy ? <p className="text-[13.5px] text-slate-600 flex items-center gap-2"><Loader2 size={16} className="animate-spin" />{tr("Finding the way…")}</p> : null}
                {trip.res ? <>
                  <div className="rounded-2xl bg-blue-50 p-3" data-testid="map-trip-summary">
                    <p className="text-[24px] font-extrabold text-blue-800 leading-tight">{mins(trip.res.seconds)}</p>
                    <p className="text-[13px] text-blue-900/80">{km(trip.res.metres / 1000)} · {trip.mode === "car" ? tr("by car, without traffic") : tr("on foot")} · {tr("offline")}</p>
                  </div>
                  <ol className="divide-y divide-slate-100" data-testid="map-steps">
                    {trip.res.steps.map((s, i, all) => (
                      <li key={i} className="flex items-start gap-3 py-2.5" data-testid="map-step">
                        <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[16px] shrink-0 rtl:-scale-x-100" aria-hidden="true">{turnIcon(s.turn)}</span>
                        <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold text-slate-800" dir="auto">{turnText(s, i, all)}</span>
                          <span className="block text-[12px] text-slate-500 tabular-nums">{km(s.metres / 1000)}</span></span>
                      </li>))}
                    <li className="flex items-center gap-3 py-2.5"><span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><MapPin size={16} /></span>
                      <span className="text-[14px] font-semibold text-slate-800" dir="auto">{tr("Arrive at {p}", { p: String(trip.to.name || "").split(",")[0] })}</span></li>
                  </ol>
                </> : null}
                {trip.need === "routes" ? (
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2" data-testid="map-trip-need-routes">
                    <p className="text-[13.5px] text-slate-700">{tr("Directions work inside Attune, with no signal, once the directions of {c} are on the phone.", { c: cname(OM.countryOf(trip.code)) })}</p>
                    {dl && dl.code === trip.code ? <p className="text-[13px] text-blue-700">{tr("Downloading…")} {dl.pct}% {dl.detail}</p>
                      : <button onClick={() => getRoutes(trip.code)} data-testid="map-get-routes" className="w-full h-11 rounded-full bg-blue-600 text-white font-bold text-[14px]">{tr("Download directions")}{remote[trip.code] && (remote[trip.code].files || []).find((x) => /-route\.bin$/.test(x.name)) ? " · " + OM.prettyMB((remote[trip.code].files || []).find((x) => /-route\.bin$/.test(x.name)).bytes) : ""}</button>}
                  </div>) : null}
                {trip.need === "map" ? <p className="text-[13.5px] text-slate-700" data-testid="map-trip-need-map">{tr("Download this country's offline map first (the country button in the search bar) — then directions work inside Attune.")}</p> : null}
                {trip.error ? <p className="text-[13.5px] text-amber-800" data-testid="map-trip-error">{trip.error === "location" ? tr("Couldn't get your location — turn location on, then try again.")
                  : trip.error === "far-from-road" ? tr("One of the two places is far from any road in the map.") : trip.error === "no-roads" ? tr("This place is outside the directions you downloaded.") : tr("No way was found between these two places.")}</p> : null}
                <a href={`geo:${trip.to.lat},${trip.to.lon}?q=${trip.to.lat},${trip.to.lon}`} data-testid="map-other-app" className="block text-center text-[12.5px] text-slate-500 underline py-1">{tr("Open in another maps app")}</a>
              </div>
            ) : sel ? (
              <div className="space-y-3" data-testid="map-place">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0"><p className="text-[21px] font-extrabold text-slate-900 leading-snug" dir="auto">{String(sel.name).split(",")[0]}</p>
                    <p className="text-[13px] text-slate-600 mt-0.5" dir="auto">{[sel.local || sel.id ? tr("saved place") : sel.kind ? String(sel.kind).split("/").pop().replace(/_/g, " ") : "", String(sel.name).split(",").slice(1, 3).join(",").trim(), me ? km(distKm(me, sel)) + " " + tr("from you") : sel.dist != null ? km(sel.dist) : ""].filter(Boolean).join(" · ")}</p></div>
                  <button onClick={() => setSel(null)} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"><X size={18} /></button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => goTrip(sel)} data-testid="map-directions" className="flex-1 h-12 rounded-full bg-blue-600 text-white font-bold text-[14.5px] flex items-center justify-center">{tr("Directions")}</button>
                  {sel.found ? <button onClick={() => savePlace(sel)} data-testid="map-save-found" className="flex-1 h-12 rounded-full border-[1.5px] border-slate-300 text-blue-700 font-bold text-[14.5px]">{tr("Save")}</button>
                    : <button onClick={() => { if (!window.confirm(tr("Delete this place?"))) return; setSt((s) => ({ ...s, places: s.places.filter((x) => x.id !== sel.id) })); setSel(null); }} className="flex-1 h-12 rounded-full border-[1.5px] border-slate-300 text-slate-700 font-semibold text-[14.5px]">{tr("Remove")}</button>}
                  <button onClick={() => { const t = `${sel.name}\nhttps://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lon}#map=17/${sel.lat}/${sel.lon}`; if (N && N.share) N.share(t); else { try { navigator.clipboard.writeText(t); } catch (e) {} flash(tr("Copied")); } }}
                    className="flex-1 h-12 rounded-full border-[1.5px] border-slate-300 text-blue-700 font-bold text-[14.5px] flex items-center justify-center gap-1.5"><Share2 size={16} />{tr("Share")}</button>
                </div>
                {others.length ? <div className="pt-2 border-t border-slate-200" data-testid="map-others"><p className="text-[12.5px] text-slate-500 mb-1">{tr("Other matches")}</p>
                  {others.map((r, i) => <button key={i} onClick={() => pick(r, sel.from)} className="w-full flex items-center justify-between gap-3 py-2.5 text-start"><span className="text-[14px] font-semibold text-slate-800 truncate" dir="auto">{String(r.name).split(",").slice(0, 2).join(",")}</span><span className="text-[12.5px] text-slate-500 shrink-0 tabular-nums">{km(r.dist)}</span></button>)}</div> : null}
                <p className="text-[11px] text-slate-400 font-mono">{sel.lat.toFixed(5)}, {sel.lon.toFixed(5)}</p>
              </div>
            ) : hits != null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between"><p className="text-[13px] text-slate-600">{busy ? tr("Searching…") : tr("{n} results", { n: hits.length })}</p>
                  <button onClick={() => setHits(null)} className="text-[13px] text-blue-700 font-semibold p-1">{tr("Close")}</button></div>
                {busy ? <Loader2 size={18} className="animate-spin text-slate-400" /> : null}
                {!busy && !hits.length ? <p className="text-[13.5px] text-slate-600 py-2" data-testid="map-none">{tr("Nothing found for that — try the area's name too (e.g. “… New Cairo”), or move the map there and search again.")}</p> : null}
                {hits.map((r, i) => (
                  <button key={i} onClick={() => pick(r, hits)} data-testid="map-hit" className="w-full flex items-center gap-3 text-start py-3 border-b border-slate-100">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${r.local ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}><MapPin size={17} /></span>
                    <span className="flex-1 min-w-0"><span className="block text-[14.5px] font-semibold text-slate-900 truncate" dir="auto">{String(r.name).split(",")[0]}</span>
                      <span className="block text-[12px] text-slate-500 truncate" dir="auto">{[r.local ? tr("saved place") : r.kind ? String(r.kind).split("/").pop().replace(/_/g, " ") : "", String(r.name).split(",").slice(1, 3).join(",").trim(), r.offline ? tr("offline") : ""].filter(Boolean).join(" · ")}</span></span>
                    <span className="text-[12.5px] text-slate-600 tabular-nums shrink-0">{km(r.dist)}</span>
                  </button>))}
              </div>
            ) : (
              <>
                {sheet === "peek" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2"><span className="text-[16px] font-bold text-slate-900">{tr("Your places")}</span>
                      <span className="text-[12px] font-semibold text-emerald-700 truncate" data-testid="map-mode">{streaming ? tr("online map") + " · " + cname(OM.countryOf(active) || { en: active, ar: active }) : active ? tr("offline map") + " · " + cname(OM.countryOf(active) || { en: active, ar: active }) : online ? tr("online") : tr("no signal")}</span></div>
                    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
                      {st.places.length ? st.places.slice(0, 12).map((p) => <button key={p.id} onClick={() => { setSel(p); setSheet("half"); flyTo(p, 15); }} className="shrink-0 max-w-[60%] truncate px-3.5 py-2 rounded-2xl bg-slate-100 text-[13.5px] font-semibold text-slate-800" dir="auto">{p.name}</button>)
                        : <span className="text-[13px] text-slate-500">{tr("Search a place and tap “Save” — saved places work with no signal.")}</span>}
                    </div>
                  </div>
                ) : <>
                <div className="flex rounded-full bg-slate-100 p-1" role="tablist">
                  {[["places", tr("Your places")], ["offline", tr("Offline maps") + (updates.length ? " •" : "")]].map(([k, l]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); if (sheet === "peek") setSheet("half"); }} data-testid={"map-tab-" + k}
                      className={`flex-1 h-10 rounded-full text-[13.5px] ${tab === k ? "bg-white text-slate-900 font-bold shadow-sm" : "text-slate-600"}`}>{l}</button>))}
                </div>
                {tab === "places" ? (
                  st.places.length ? st.places.map((p) => (
                    <button key={p.id} onClick={() => { setSel(p); flyTo(p, 15); }} className="w-full flex items-center gap-3 text-start py-3 border-b border-slate-100">
                      <span className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><MapPin size={17} /></span><span className="flex-1 min-w-0 text-[14.5px] font-semibold text-slate-800 truncate" dir="auto">{p.name}</span>
                      <span className="text-[12.5px] text-slate-500">{me ? km(distKm(me, p)) : ""}</span></button>))
                    : <p className="text-[13.5px] text-slate-600 py-2">{tr("Search a place and tap “Save” — saved places work with no signal.")}</p>
                ) : (
                  <div className="space-y-2" data-testid="map-offline">
                    <p className="text-[12.5px] text-slate-600 leading-relaxed">{tr("Download a country once: roads, buildings, shops and search, with no signal. A new map comes every week.")}</p>
                    <input value={cq} onChange={(e) => setCq(e.target.value)} dir="auto" data-testid="map-country-find" aria-label={tr("Find a country")}
                      placeholder={tr("Find a country — {n} available", { n: OM.COUNTRIES.length })} className="w-full h-12 rounded-2xl bg-slate-100 px-4 text-[14.5px] text-slate-900 placeholder:text-slate-500" />
                    {onlineOk ? <p className="text-[12.5px] text-emerald-700 leading-relaxed" data-testid="map-online-note">{tr("With signal, every country here shows online without downloading — every street, compound and place. Download only to use it with no signal.")}</p> : null}
                    {countryList.map((c) => {
                      const have = packs.find((p) => p.code === c.code), rm = remote[c.code], upd = have && OM.isNewer(rm, have), mine = dl && dl.code === c.code;
                      return (
                        <div key={c.code} className={`rounded-2xl border-[1.5px] p-3 ${active === c.code ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`} data-testid={"map-country-" + c.code}>
                          <div className="flex items-center gap-2">
                            <button onClick={() => (have ? usePack(c.code) : onlineOk ? usePack("net:" + c.code) : null)} className="flex-1 min-w-0 text-start" data-testid={"map-view-" + c.code}>
                              <span className="block text-[15px] text-slate-900 font-bold truncate">{cname(c)}</span>
                              <span className="block text-[12px] text-slate-600">{have ? tr("On this phone · data of {d} · {s}", { d: have.date, s: OM.prettyMB(have.bytes) }) + (active === c.code ? " · " + tr("showing") : "")
                                : (rm && rm.date ? tr("{s} · data of {d}", { s: OM.prettyMB(OM.packBytes(rm)), d: rm.date }) : "") + (active === "net:" + c.code ? (rm && rm.date ? " · " : "") + tr("showing online") : "")}</span>
                            </button>
                            {mine ? <button onClick={pause} className="h-10 px-4 rounded-full bg-slate-100 text-slate-800 font-semibold text-[13px]">{tr("Pause")}</button>
                              : upd ? <button onClick={() => install(c.code)} disabled={!!dl} data-testid={"map-update-" + c.code} className="h-10 px-4 rounded-full bg-blue-600 text-white text-[13px] font-bold flex items-center gap-1 disabled:opacity-40"><RefreshCw size={13} />{tr("Update")}</button>
                              : have ? <button onClick={() => removePack(c.code)} aria-label={tr("Delete")} data-testid={"map-remove-" + c.code} className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><Trash2 size={15} /></button>
                              : <button onClick={() => install(c.code)} disabled={!!dl} data-testid={"map-dl-" + c.code} className="h-10 px-4 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center gap-1 disabled:opacity-40"><Download size={13} />{tr("Download")}</button>}
                          </div>
                          {mine ? <div className="mt-2" data-testid="map-progress"><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: (dl.pct || 0) + "%" }} /></div>
                            <p className="text-[11.5px] text-slate-600 mt-1 tabular-nums">{dl.pct || 0}% · {dl.detail}</p></div> : null}
                          {rm && rm.error && !have ? <p className="text-[11.5px] text-amber-700 mt-1">{tr(rm.error)}</p> : null}
                        </div>);
                    })}
                  </div>
                )}
                </>}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
