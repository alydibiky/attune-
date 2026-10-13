/* ---- v6.15: whole-country offline maps (Ali: "download a whole country at once, very accurate and up to date, and
   every time something updates I can install the update") ------------------------------------------------------------
   A country pack = <code>.pmtiles (the vector map: every road, building, place and shop, cut weekly from the newest
   OpenStreetMap build by Protomaps) + <code>-places.sqlite (an offline search index of every named street, place and
   shop, from Geofabrik's daily country file), published by the "Build a country map" workflow (tools/build_map_pack.py)
   as the release map-<code>. The phone keeps them in its private folder (MapPacks.kt); the page reads the map file
   through the bridge (N.mapRead) and MapLibre draws it. One shared release, map-assets, holds the fonts and icons.
   Pure parts (normalize, isNewer, sizes, the style) are tested in tests/unit/v722maps.test.mjs.                  */
import { PMTiles, Protocol } from "pmtiles";
import { gunzipSync } from "fflate";
import { layers, namedFlavor } from "@protomaps/basemaps";

export const RELEASE_BASE = "https://github.com/alydibiky/attune-/releases/download/";

/** The countries a pack is built for — one list for the app and the builder (tools/map_countries.json). gf = the
 *  Geofabrik extract (some come grouped: the GCC states; Malaysia, Singapore and Brunei); maxzoom = the most detailed
 *  zoom kept (the biggest countries keep 13–14 so the download stays sensible; the map still zooms in further). */
import LIST from "../tools/map_countries.json";
export const COUNTRIES = LIST;
// v6.27: the world overview pack has a name and a view too (the update banner and the pack line read them)
// "net:eg" = Egypt's map read online (not downloaded) — the same country
const WORLD_ENTRY = { code: "wld", en: "the world", ar: "العالم", c: [20, 25], z: 2 };
export const countryOf = (code) => { const k = String(code || "").replace(/^net:/, ""); return k === "wld" ? WORLD_ENTRY : COUNTRIES.find((c) => c.code === k) || null; };

/** The same text normalisation as the search index (tools/build_map_pack.py) and MapPacks.kt — keep the three equal. */
export function normalize(s) {
  return String(s || "").toLowerCase().replace(/\u0670/g, "ا")      // the dagger alef (ٰ) is an alef
    .replace(/[ً-ْـ\u06D6-\u06ED]/g, "")              // Arabic diacritics and tatweel
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))   // ٩٠ = 90
    .replace(/ı/g, "i").normalize("NFD").replace(/[̀-ͯ]/g, "")   // Turkish ı, accents
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Is the published pack newer than the one on the phone? Dates are "YYYY-MM-DD" (the OSM data date). */
export function isNewer(remote, local) {
  if (!remote || !remote.date) return false;
  if (!local || !local.date) return true;
  return String(remote.date) > String(local.date);
}
export const packBytes = (man) => ((man && man.files) || []).filter((f) => !/-(route|find)\.bin$/.test(f.name || "")).reduce((a, f) => a + (Number(f.bytes) || 0), 0);   // v6.20: directions are a separate download
export function prettyMB(bytes) {
  const mb = (Number(bytes) || 0) / 1e6;
  return mb >= 1000 ? (mb / 1000).toFixed(1) + " GB" : mb >= 10 ? Math.round(mb) + " MB" : mb.toFixed(1) + " MB";
}
/** "12 days ago" style age of a pack's data, in days. */
export function ageDays(date, now = new Date()) {
  const t = Date.parse(String(date || "") + "T00:00:00Z");
  return isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 864e5)) : null;
}

/* ---- reading a pack through the bridge ---- */
async function b64ToBuf(b64) {
  if (!b64) return new ArrayBuffer(0);
  const r = await fetch("data:application/octet-stream;base64," + b64);
  return r.arrayBuffer();
}
/** A PMTiles source over the phone's file: N.mapRead({path, offset, length}) → base64. */
export class BridgeSource {
  constructor(N, path) { this.N = N; this.path = path; }
  getKey() { return this.path; }
  async getBytes(offset, length) {
    const b64 = this.N.mapRead(JSON.stringify({ path: this.path, offset, length }));
    if (!b64) throw new Error("The map file is missing — download the country again");
    return { data: await b64ToBuf(b64) };
  }
}

/** v6.27 (Ali: "streets and compounds everywhere online, and I don't want to pay for maps"): a country's map read online
 *  without downloading it — only the pieces on the screen, fetched by the phone/computer (mapRange: HTTP range requests
 *  to the free GitHub release the download uses). PMTiles caches the map's index; MapLibre caches the tiles. */
export class NetSource {
  constructor(call, code, key) { this.call = call; this.code = code; this.key = key; }
  getKey() { return this.key; }
  async getBytes(offset, length) {
    const r = await this.call("mapRange", { code: this.code, name: this.code + ".pmtiles", offset, length });
    return { data: await b64ToBuf((r && r.b64) || "") };
  }
}

/** v6.27: search a country's places ONLINE without downloading its index — <code>-find.bin (tools/build_map_pack.py
 *  build_find): a small index of pieces, read once, then the one piece (by the first 3 letters of the query's least
 *  common word) through call("mapRange"). → [{name, name_ar, name_en, kind, lat, lon, rank}], best first. */
const findIdx = new Map();
const findStem = (w) => (w.startsWith("ال") && w.length > 4 ? w.slice(2) : w);
async function findBytes(call, code, offset, length) {
  const r = await call("mapRange", { code, name: code + "-find.bin", offset, length });
  return new Uint8Array(await b64ToBuf((r && r.b64) || ""));
}
export async function netFind(call, code, q, { lat = null, lon = null, limit = 15 } = {}) {
  const words = normalize(q).split(" ").filter((w) => w.length >= 2).slice(0, 6);
  if (!words.length) return [];
  let idx = findIdx.get(code);
  if (!idx) {
    const head = new TextDecoder().decode(await findBytes(call, code, 0, 16));
    const m = /^AFIND1 (\d{8})\n$/.exec(head); if (!m) throw new Error("The online search of this map is not published yet");
    idx = JSON.parse(new TextDecoder().decode(gunzipSync(await findBytes(call, code, 16, +m[1]))));
    idx.df = idx.common || {}; idx.base = 16 + +m[1]; findIdx.set(code, idx);
  }
  // the piece: the query's longest uncommon word, else its rarest common word
  const stems = words.map(findStem), df = (w) => idx.df[w] || 0;
  const pick = stems.filter((w) => !df(w)).sort((a, b) => b.length - a.length)[0] || [...stems].sort((a, b) => df(a) - df(b) || (a < b ? -1 : a > b ? 1 : 0))[0];
  const at = idx.shards[pick.slice(0, 3)];
  if (!at) return [];
  const text = new TextDecoder().decode(gunzipSync(await findBytes(call, code, idx.base + at[0], at[1])));
  const out = [];
  for (const line of text.split("\n")) {
    const f = line.split("\t"); if (f.length < 8) continue;
    const kw = f[7].split(" ");
    if (!words.every((w) => kw.some((k) => k.startsWith(w) || findStem(k).startsWith(findStem(w))))) continue;
    const p = { name: f[0], name_ar: f[1] || f[0], name_en: f[2] || f[0], kind: f[3], lat: +f[4], lon: +f[5], rank: +f[6] };
    p.exact = f[7] === normalize(q) ? 1 : 0;
    if (lat != null) p.dist = Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos(lat * Math.PI / 180)) * 111;
    out.push(p);
  }
  // a whole-name match first, then importance, then nearer
  out.sort((a, b) => b.exact - a.exact || b.rank - a.rank || (a.dist || 0) - (b.dist || 0));
  return out.slice(0, limit);
}

/** The country whose centre is nearest a point — the map to read online where the map is looking. */
export function nearestCountry(lat, lon) {
  let best = null, bd = Infinity;
  for (const c of COUNTRIES) { if (!c.c) continue; const d = (c.c[1] - lat) ** 2 + ((c.c[0] - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}

let registered = null;
/**
 * Registers the protocols MapLibre uses, once:
 *   pmtiles://<code>/<code>.pmtiles   the country's vector map, read through the bridge
 *   mapasset://fonts/… , sprites/…    the shared fonts and icons (empty answer when a font range isn't there)
 *   pmtiles://net/<code>.pmtiles      v6.27: a country's map read ONLINE, not downloaded (NetSource, below)
 *   osmc://z/x/y                      online picture tiles through the app's own tile cache (no pack, or outside it)
 * call: the app's nativeCall (the online pieces come through the phone / computer: no browser limits on GitHub's files).
 */
export function registerProtocols(maplibregl, N, getTile, call) {
  if (registered) return registered;
  const proto = new Protocol();
  maplibregl.addProtocol("pmtiles", (params, ac) => {
    // pmtiles://eg/eg.pmtiles (the TileJSON) and pmtiles://eg/eg.pmtiles/z/x/y (a tile): the archive key is the path
    const m = /^pmtiles:\/\/(.+?)(?:\/\d+\/\d+\/\d+)?$/.exec(params.url), key = m ? m[1] : "";
    const net = /^net\/([a-z]{2,4})\.pmtiles$/.exec(key);
    if (net) { if (call && !proto.get(key)) proto.add(new PMTiles(new NetSource(call, net[1], key))); }
    else if (N && N.mapRead && key && !proto.get(key)) proto.add(new PMTiles(new BridgeSource(N, key)));
    return proto.tilev4(params, ac);
  });
  maplibregl.addProtocol("mapasset", async (params) => {
    const rel = decodeURIComponent(params.url.replace(/^mapasset:\/\//, "")).replace(/\.\.+/g, "");
    let b64 = "";
    try { b64 = N && N.mapRead ? N.mapRead(JSON.stringify({ path: "assets/" + rel, offset: 0, length: -1 })) : ""; } catch (e) { b64 = ""; }
    const buf = await b64ToBuf(b64);
    if (/\.json$/.test(rel)) return { data: buf.byteLength ? JSON.parse(new TextDecoder().decode(buf)) : {} };
    return { data: buf };
  });
  maplibregl.addProtocol("osmc", async (params) => {
    const m = /osmc:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const got = m && getTile ? await getTile(+m[1], +m[2], +m[3], { cacheOnly: typeof navigator !== "undefined" && navigator.onLine === false }) : null;
    if (!got) throw new Error("tile not available");
    return { data: await got.blob.arrayBuffer() };
  });
  registered = proto;
  return proto;
}

/** v6.27: the world overview (low zoom, every country) — a pack like the others, code "wld". */
export const WORLD = "wld";


/**
 * The map style.
 * pack: an installed pack's code (vector map from the phone; WORLD = the world overview) or null (no map yet:
 * just the ground — v6.27: OpenStreetMap's own tile servers forbid apps and answered 403 on the desktop).
 * "net:<code>" = that country read online (not downloaded). dark: the app's theme. lang: "ar" | "en" (place names).
 */
export function mapStyle({ pack = null, dark = true, lang = "en" } = {}) {
  if (!pack) {
    return { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": dark ? "#0b1220" : "#f1f5f9" } }] };
  }
  const net = /^net:([a-z]{2,4})$/.exec(pack);
  return {
    version: 8,
    glyphs: "mapasset://fonts/{fontstack}/{range}.pbf",
    sprite: "mapasset://sprites/v4/" + (dark ? "dark" : "light"),
    sources: { protomaps: { type: "vector", url: net ? `pmtiles://net/${net[1]}.pmtiles` : `pmtiles://${pack}/${pack}.pmtiles`, attribution: "© OpenStreetMap contributors · Protomaps" } },
    layers: layers("protomaps", namedFlavor(dark ? "dark" : "light"), { lang: lang === "ar" ? "ar" : "en" }),
  };
}

/** Loads MapLibre (www/vendor, next to the page) once; the Arabic-text plugin with it. → window.maplibregl */
let loading = null;
export function loadMapLibre() {
  if (typeof window !== "undefined" && window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loading) return loading;
  loading = new Promise((ok, bad) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "vendor/maplibre-gl.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "vendor/maplibre-gl.js"; s.async = true;
    s.onload = () => {
      const ml = window.maplibregl;
      if (!ml) return bad(new Error("map engine missing"));
      try { if (ml.getRTLTextPluginStatus && ml.getRTLTextPluginStatus() === "unavailable") ml.setRTLTextPlugin(new URL("vendor/mapbox-gl-rtl-text.js", document.baseURI).href, true); } catch (e) {}
      ok(ml);
    };
    s.onerror = () => { loading = null; bad(new Error("map engine could not load")); };
    document.head.appendChild(s);
  });
  return loading;
}
/** WebGL is needed for the vector map; without it the app keeps the simple picture-tile map. */
export function webglOk() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}
