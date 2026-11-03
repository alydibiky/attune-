// v9.0 (Ali: "99 percent accurate"): the price an agent reads from a listing — the current price, not the old one, an instalment,
// a delivery fee, a case for the product, or an older model.
import { webOffers } from "../../web-src/agents.js";
let bad = 0;
const W = (title, text) => webOffers([{ title, url: "https://shop.example.com/p/1", text }], "Huawei FreeClip 2", { cur: "EGP" }).map((o) => o.price);
const C = [["Huawei FreeClip 2", "EGP 8,399 Was EGP 9,999 Save 16%", [8399]], ["Huawei FreeClip 2", "Installments from EGP 700/month or EGP 8,400", [8400]],
  ["Huawei FreeClip 2 - Black", "السعر: 7,950 جنيه بدلا من 9,000 جنيه", [7950]], ["Huawei FreeClip 2", "Delivery EGP 50 · Price EGP 8,250", [8250]],
  ["Case for Huawei FreeClip 2", "EGP 250", []], ["Huawei FreeClip 2", "", []], ["Huawei FreeClip", "EGP 4,000", []]];
for (const [t, x, w] of C) { const g = W(t, x); if (JSON.stringify(g) !== JSON.stringify(w)) { bad++; console.log(`FAIL "${t}" "${x}" → ${JSON.stringify(g)}, want ${JSON.stringify(w)}`); } }
console.log(bad ? bad + " FAILED" : `PASS v915offers: ${C.length} listings — the right price or none`);
