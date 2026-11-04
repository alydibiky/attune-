/* ---- v9.1 (Ali, 4 Nov 2026: "Google Maps has offline download — can't agents use it to guide the user?"): Attune's own offline maps
   are archived (archive/map/); a place opens in Google Maps — the app when it is on the phone (it owns google.com/maps links), the
   website elsewhere. "Take me to City Stars" / «وديني سيتي ستارز» starts the directions there. Pure helpers; tests:
   tests/unit/v911gomaps.test.mjs. (Google Maps does its own offline areas — Attune can remind to download one before a trip.) */

const enc = encodeURIComponent;
/** A place → the Google Maps link: a search ("pharmacy near me"), or directions to it (mode: driving | walking | transit). */
export function mapsUrl(place, { directions = false, mode = "" } = {}) {
  const q = String(place || "").trim();
  if (!q) return "https://www.google.com/maps";
  return directions ? `https://www.google.com/maps/dir/?api=1&destination=${enc(q)}${mode ? "&travelmode=" + mode : ""}`
    : `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

const GO = /^\s*(?:please\s+)?(?:take me to|navigate (?:me )?to|directions to|get me to|how (?:do|can) i (?:get|go) to|drive me to|walk me to|show me the way to)\s+(.+?)\s*[?.!]*$/i;
const GO_AR = /^\s*(?:وديني|ودّيني|خدني|خُدني|وصلني|وصّلني|ازاي اروح|إزاي أروح|ازاي اوصل|إزاي أوصل|اروح ازاي|الطريق ل|الطريق إلى|الطريق الى)\s*(?:ل|لـ|على|عند|إلى|الى)?\s*(.+?)\s*[؟?.!]*$/;
const WALK = /\b(?:walk|walking|on foot)\b|مشي|ماشي/i, TRANSIT = /\b(?:by bus|by train|transit|public transport)\b|بالمواصلات|بالاتوبيس/i;

/** "take me to City Stars" → { place: "City Stars", mode } | null. A Metro question stays the Metro answer (Chat's metro reader). */
export function directionsOf(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 200 || /\bmetro\b|مترو/i.test(t)) return null;
  const m = GO.exec(t) || GO_AR.exec(t);
  if (!m) return null;
  let place = m[1].replace(/\s+(?:by car|by taxi|walking|on foot|by bus|بالعربية|مشي|بالمواصلات)$/i, "").trim();
  if (!place || place.length < 2) return null;
  return { place, mode: WALK.test(t) ? "walking" : TRANSIT.test(t) ? "transit" : "" };
}

/** Opens the link in the Google Maps app when Android has it (NativeBridge.openInApp), else in a browser tab. */
export function openMaps(url, native = typeof window !== "undefined" ? window.AttuneNative : null) {
  try { if (native && native.openInApp) { const r = JSON.parse(native.openInApp(url) || "{}"); if (r.ok) return "app"; } } catch (e) {}
  try { if (native && native.intent) { const r = JSON.parse(native.intent(JSON.stringify({ kind: "link", url, app: "com.google.android.apps.maps" })) || "{}"); if (r.ok !== false) return "app"; } } catch (e) {}
  try { window.open(url, "_blank"); return "web"; } catch (e) { return ""; }
}
