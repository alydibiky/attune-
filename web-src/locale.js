/* ---- v6.27 "make everything global": the person's own currency and date style, worked out on the phone ------------------------
   Money's ledger currency wins (the person chose it); else the phone's region (navigator.language "en-US" → US → USD).
   Used by the payment reader (an ambiguous "$" / "kr" / "Rs" becomes the home one), People & plans, the Guardian and
   the Deadline Radar. Pure; tests: tests/unit/v727global.test.mjs.                                                     */
const REGION_CUR = {
  US: "USD", CA: "CAD", MX: "MXN", BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR",
  IT: "EUR", PT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR",
  HR: "EUR", CY: "EUR", MT: "EUR", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", RS: "RSD",
  UA: "UAH", RU: "RUB", TR: "TRY", IL: "ILS", EG: "EGP", SA: "SAR", AE: "AED", KW: "KWD", QA: "QAR", BH: "BHD", OM: "OMR", JO: "JOD", LB: "LBP",
  IQ: "IQD", SY: "SYP", YE: "YER", LY: "LYD", TN: "TND", DZ: "DZD", MA: "MAD", SD: "SDG", PS: "ILS", IR: "IRR", PK: "PKR", IN: "INR", BD: "BDT",
  LK: "LKR", NP: "NPR", CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY", KR: "KRW", SG: "SGD", MY: "MYR", ID: "IDR", PH: "PHP", TH: "THB", VN: "VND",
  AU: "AUD", NZ: "NZD", ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS", ET: "ETB", TZ: "TZS", UG: "UGX", KZ: "KZT", AZ: "AZN", GE: "GEL", AM: "AMD",
};
// regions that write the month first (03/04 = 4 March): the US and a few others
const MDY = new Set(["US", "PH", "FM", "MH", "PW", "BZ"]);

/** "en-US" → "US"; "ar" → "" */
export const regionOf = (lang) => { const m = String(lang || "").match(/[-_]([A-Za-z]{2})\b/); return m ? m[1].toUpperCase() : ""; };
const navLang = () => { try { return (navigator.languages && navigator.languages[0]) || navigator.language || ""; } catch (e) { return ""; } };

/** The person's currency: Money's own setting first, then the phone's region, else USD. */
export function homeCurrency(ledger, lang = navLang()) {
  if (ledger && /^[A-Z]{3}$/.test(ledger.currency || "")) return ledger.currency;
  try { const L = JSON.parse(localStorage.getItem("ledger.v3") || "null"); if (L && /^[A-Z]{3}$/.test(L.currency || "")) return L.currency; } catch (e) {}
  return REGION_CUR[regionOf(lang)] || "USD";
}
/** "mdy" for the US and the few others that write the month first, else "dmy". */
export const dateOrder = (lang = navLang()) => (MDY.has(regionOf(lang)) ? "mdy" : "dmy");
/** The options the payment reader takes: { home, order }. */
export const payOpts = (ledger) => ({ home: homeCurrency(ledger), order: dateOrder() });
export { REGION_CUR };
