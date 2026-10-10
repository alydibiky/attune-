/* ---- v6.15: whole-country offline maps (Ali: "download a whole country at once, very accurate and up to date, and
   every time something updates I can install the update") ------------------------------------------------------------
   A country pack = <code>.pmtiles (the vector map: every road, building, place and shop, cut weekly from the newest
   OpenStreetMap build by Protomaps) + <code>-places.sqlite (an offline search index of every named street, place and
   shop, from Geofabrik's daily country file), published by the "Build a country map" workflow (tools/build_map_pack.py)
   as the release map-<code>. The phone keeps them in its private folder (MapPacks.kt); the page reads the map file
   through the bridge (N.mapRead) and MapLibre draws it. One shared release, map-assets, holds the fonts and icons.
   Pure parts (normalize, isNewer, sizes, the style) are tested in tests/unit/v722maps.test.mjs.                  */
import { PMTiles, Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

export const RELEASE_BASE = "https://github.com/alydibiky/attune-/releases/download/";

/** The countries a pack is built for. gf = the Geofabrik extract (the GCC states come as one file). */
export const COUNTRIES = [
  { code: "eg", gf: "africa/egypt", en: "Egypt", ar: "مصر", c: [30.8, 26.8], z: 5 },
  { code: "gcc", gf: "asia/gcc-states", en: "Gulf states (Saudi, UAE, Kuwait, Qatar, Bahrain, Oman)", ar: "دول الخليج (السعودية، الإمارات، الكويت، قطر، البحرين، عُمان)", c: [47, 24], z: 4 },
  { code: "tr", gf: "europe/turkey", en: "Turkey", ar: "تركيا", c: [35, 39], z: 5 },
  { code: "jo", gf: "asia/jordan", en: "Jordan", ar: "الأردن", c: [36.2, 31.2], z: 6 },
  { code: "lb", gf: "asia/lebanon", en: "Lebanon", ar: "لبنان", c: [35.8, 33.9], z: 7 },
  { code: "iq", gf: "asia/iraq", en: "Iraq", ar: "العراق", c: [43.7, 33.2], z: 5 },
  { code: "ly", gf: "africa/libya", en: "Libya", ar: "ليبيا", c: [17.2, 27], z: 5 },
  { code: "sd", gf: "africa/sudan", en: "Sudan", ar: "السودان", c: [30.2, 15.6], z: 5 },
  { code: "tn", gf: "africa/tunisia", en: "Tunisia", ar: "تونس", c: [9.5, 34], z: 6 },
  { code: "ma", gf: "africa/morocco", en: "Morocco", ar: "المغرب", c: [-6.5, 31.8], z: 5 },
];
export const countryOf = (code) => COUNTRIES.find((c) => c.code === code) || null;

/** The same text normalisation as the search index (tools/build_map_pack.py) and MapPacks.kt — keep the three equal. */
export function normalize(s) {
  return String(s || "").toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")              // Arabic diacritics and tatweel
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
export const packBytes = (man) => ((man && man.files) || []).reduce((a, f) => a + (Number(f.bytes) || 0), 0);
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

let registered = null;
/**
 * Registers the protocols MapLibre uses, once:
 *   pmtiles://<code>/<code>.pmtiles   the country's vector map, read through the bridge
 *   mapasset://fonts/… , sprites/…    the shared fonts and icons (empty answer when a font range isn't there)
 *   osmc://z/x/y                      online picture tiles through the app's own tile cache (no pack, or outside it)
 */
export function registerProtocols(maplibregl, N, getTile) {
  if (registered) return registered;
  const proto = new Protocol();
  maplibregl.addProtocol("pmtiles", (params, ac) => {
    // pmtiles://eg/eg.pmtiles (the TileJSON) and pmtiles://eg/eg.pmtiles/z/x/y (a tile): the archive key is the path
    const m = /^pmtiles:\/\/(.+?)(?:\/\d+\/\d+\/\d+)?$/.exec(params.url), key = m ? m[1] : "";
    if (N && N.mapRead && key && !proto.get(key)) proto.add(new PMTiles(new BridgeSource(N, key)));
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

/**
 * The map style.
 * pack: an installed pack's code (vector map from the phone) or null (online picture tiles through the cache).
 * dark: the app's theme. lang: "ar" | "en" (place names).
 */
export function mapStyle({ pack = null, dark = true, lang = "en" } = {}) {
  if (!pack) {
    return {
      version: 8,
      sources: { osm: { type: "raster", tiles: ["osmc://{z}/{x}/{y}"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" } },
      layers: [{ id: "bg", type: "background", paint: { "background-color": dark ? "#0b1220" : "#f1f5f9" } },
               { id: "osm", type: "raster", source: "osm", paint: dark ? { "raster-brightness-max": 0.82, "raster-saturation": -0.25 } : {} }],
    };
  }
  return {
    version: 8,
    glyphs: "mapasset://fonts/{fontstack}/{range}.pbf",
    sprite: "mapasset://sprites/v4/" + (dark ? "dark" : "light"),
    sources: { protomaps: { type: "vector", url: `pmtiles://${pack}/${pack}.pmtiles`, attribution: "© OpenStreetMap contributors · Protomaps" } },
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
