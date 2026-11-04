/* v9.1: the seller's PUBLIC key that checks Pro codes (billing.js checkProCode) — the app can check a code, never make one — and
   jsonFrom (a model's JSON, repaired). Both lived in Business's erp.js (now archived in archive/business/). The same code. */
export const LICENCE_PUBLIC_KEY = { kty: "EC", crv: "P-256", x: "FuyClSl4NiGx1oaL5794bmZAK4aTEBz_xoN6IOMMKzM", y: "cUzZVXuqZnS9__ct8fZvVvH8yPY9Lu6jo3PQvFQw6LI" };

/** A model's reply → the JSON object inside it (code fences, trailing commas, bare keys repaired), or null. */
export function jsonFrom(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  let s = t.slice(a, b + 1);
  for (let k = 0; k < 3; k++) {
    try { return JSON.parse(s); } catch (e) {
      if (k === 0) s = s.replace(/,\s*([}\]])/g, "$1");                              // trailing commas
      else if (k === 1) s = s.replace(/([{,]\s*)([A-Za-z_][\w]*)\s*:/g, '$1"$2":').replace(/'([^'"\n]*)'/g, '"$1"');   // bare keys, single quotes
    }
  }
  return null;
}
