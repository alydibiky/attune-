/* ---- v6.12: Maps — a place search that finds what people type ---------------------------------------------------------------
   Ali typed "Address east compound" (a compound in New Cairo, next to the map's view) and got "Nothing found for that": the map
   asked only Nominatim, which wants the registered name word for word. Now, at the same time:
     - Photon (komoot, OpenStreetMap data): forgiving — partial names, typos, Arabic — and it ranks places near the map's centre first;
     - Nominatim with the map's view as a hint (closer results first, still worldwide);
   and when both find nothing, simpler wordings ("Address East", "Address East New Cairo") and Overpass (named places within
   ~40 km of the map's centre). Results are merged, the same place found twice is shown once, nearer and better matches first.
   Pure helpers + fetchers (fetch is passed in); tests: tests/unit/v707mapsearch.test.mjs.                                         */

const GENERIC = /\b(compound|compounds|residence|residences|location|where is|where's|the|in|at|near|map|place)\b|كمبوند|كومباوند|مكان|فين|عنوان/gi;
const AR = /[\u0600-\u06FF]/;

/** Distance in km between two points. */
export function km(a, b) {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Other ways to write the same search when the first finds nothing: without the generic words, then with the area's name. */
export function variants(q, area = "") {
  const t = String(q || "").trim(), out = [];
  const core = t.replace(GENERIC, " ").replace(/\s+/g, " ").trim();
  if (core && core.toLowerCase() !== t.toLowerCase()) out.push(core);
  const base = core || t;
  if (area && !base.toLowerCase().includes(area.toLowerCase())) out.push(base + " " + area);
  // "addresseast" / "Address-East" → spaced; a two-word name also as one word
  if (/\s/.test(base) && base.split(/\s+/).length === 2) out.push(base.replace(/\s+/, ""));
  return [...new Set(out)].filter((x) => x && x.toLowerCase() !== t.toLowerCase()).slice(0, 3);
}

/** How well a found name matches the words searched (0..1), letters only, Arabic folded. */
export function nameScore(name, q) {
  const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ");
  const words = fold(String(q).replace(GENERIC, " ")).split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return 0.5;
  const n = fold(name);
  return words.filter((w) => n.includes(w)).length / words.length;
}

/** Results from several services → one list: the same place (within 150 m and a similar name) once; better name match, then nearer, first. */
export function mergePlaces(lists, center, q) {
  const all = [];
  for (const l of lists || []) for (const p of l || []) if (p && isFinite(p.lat) && isFinite(p.lon)) all.push(p);
  const out = [];
  for (const p of all) {
    const dup = out.find((x) => km(x, p) < 0.15 && (nameScore(x.name, p.name.split(",")[0]) > 0.5 || nameScore(p.name, x.name.split(",")[0]) > 0.5));
    if (dup) { if (!dup.via.includes(p.via)) dup.via += " + " + p.via; continue; }
    out.push({ ...p });
  }
  for (const p of out) { p.dist = center ? km(center, p) : null; p.match = nameScore(p.name, q); }
  return out.sort((a, b) => (b.match - a.match) || ((a.dist ?? 1e9) - (b.dist ?? 1e9))).slice(0, 10);
}

/** Photon's GeoJSON → places. */
export function fromPhoton(j) {
  return ((j && j.features) || []).map((f) => {
    const p = f.properties || {}, c = (f.geometry && f.geometry.coordinates) || [];
    const parts = [p.name, p.street && (p.housenumber ? p.street + " " + p.housenumber : p.street), p.district || p.locality, p.city || p.county, p.state, p.country].filter(Boolean);
    return { name: [...new Set(parts)].join(", "), lat: Number(c[1]), lon: Number(c[0]), kind: [p.osm_key, p.osm_value].filter(Boolean).join("/"), via: "photon" };
  }).filter((p) => p.name && isFinite(p.lat) && isFinite(p.lon));
}
/** Nominatim's JSON → places. */
export function fromNominatim(j) {
  return (Array.isArray(j) ? j : []).map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon), kind: r.category ? r.category + "/" + r.type : r.type || "", via: "osm" }))
    .filter((p) => isFinite(p.lat) && isFinite(p.lon));
}
/** Overpass JSON → places. */
export function fromOverpass(j) {
  return ((j && j.elements) || []).map((e) => {
    const t = e.tags || {}, lat = e.lat ?? (e.center && e.center.lat), lon = e.lon ?? (e.center && e.center.lon);
    const name = t.name || t["name:en"] || t["name:ar"];
    return { name: [name, t["name:en"] && t["name:en"] !== name ? t["name:en"] : "", t["addr:city"] || t["addr:suburb"] || ""].filter(Boolean).join(", "), lat: Number(lat), lon: Number(lon), kind: t.landuse ? "landuse/" + t.landuse : t.amenity ? "amenity/" + t.amenity : t.building ? "building" : t.place ? "place/" + t.place : "", via: "overpass" };
  }).filter((p) => p.name && isFinite(p.lat) && isFinite(p.lon));
}
let lastNomi = 0;
const esc = (s) => String(s).replace(/[\\"]/g, "\\$&").replace(/[.*+?^${}()|[\]]/g, "\\\\$&");

/**
 * The search. center = the map's centre {lat, lon}; area = a place name for the variants (e.g. "Cairo").
 * fetchJson(url) → parsed JSON (the page's fetch; the services allow it). → { places, tried }
 */
export async function findPlaces(q, { center = null, lang = "en", area = "", fetchJson, timeout = 9000 } = {}) {
  const T = (p) => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new Error("timeout")), timeout))]).catch(() => null);
  const photon = (text) => T(fetchJson("https://photon.komoot.io/api/?" + new URLSearchParams({ q: text, limit: "8", ...(center ? { lat: center.lat.toFixed(4), lon: center.lon.toFixed(4) } : {}), ...(lang === "en" ? { lang: "en" } : {}) })).then(fromPhoton));
  const nomi = async (text) => {
    const wait = Math.max(0, 1100 - (Date.now() - lastNomi)); if (wait) await new Promise((ok) => setTimeout(ok, wait)); lastNomi = Date.now();   // Nominatim asks for one request a second
    const vb = center ? { viewbox: [center.lon - 0.6, center.lat + 0.45, center.lon + 0.6, center.lat - 0.45].map((x) => x.toFixed(4)).join(","), bounded: "0" } : {};
    return T(fetchJson("https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ q: text, format: "jsonv2", limit: "6", "accept-language": lang, ...vb })).then(fromNominatim));
  };
  const tried = [q];
  let lists = await Promise.all([photon(q), nomi(q)]);
  let places = mergePlaces(lists, center, q);
  if (!places.length) {
    for (const v of variants(q, area)) {
      tried.push(v);
      lists = await Promise.all([photon(v), nomi(v)]);
      places = mergePlaces(lists, center, q);
      if (places.length) break;
    }
  }
  if (!places.length && center) {   // named places near the map's centre (compounds, malls, buildings are often only here)
    const core = String(q).replace(GENERIC, " ").replace(/\s+/g, " ").trim() || q;
    tried.push("nearby: " + core);
    const ql = `[out:json][timeout:15];nwr["name"~"${esc(core)}",i](around:40000,${center.lat.toFixed(5)},${center.lon.toFixed(5)});out center 15;`;
    const ov = await T(fetchJson("https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(ql)).then(fromOverpass));
    places = mergePlaces([ov], center, q);
  }
  return { places, tried };
}
