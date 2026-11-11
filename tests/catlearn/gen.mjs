// v9.9.18 M5 — 10,000 ledgers with shop names in 20 languages / scripts (case, Arabic letter forms, punctuation), look-alike longer
// names and hand-set categories: after "always", exactly the same shop's payments follow; longer names and hand-set ones don't.
import fs from "fs"; import { learn, applyRules, wouldChange, keyOf, catFor } from "../../web-src/catlearn.js"; import { rng } from "../b3common.mjs";
const N = +(process.argv[2] || 10000), rnd = rng(20261120), pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const SHOPS = [["Seoudi", ["SEOUDI", "seoudi ", "Seoudi."], ["Seoudi Market Online"]], ["سعودي", ["سعودى", "سعودي!"], ["سعودي اونلاين"]], ["Carrefour", ["CARREFOUR", "carrefour"], ["Carrefour Express"]], ["Şok", ["ŞOK", "şok"], ["Şok Market"]],
  ["Пятёрочка", ["ПЯТЁРОЧКА"], ["Пятёрочка Доставка"]], ["ローソン", ["ローソン "], ["ローソン100"]], ["이마트", ["이마트"], ["이마트24"]], ["बिग बाज़ार", ["बिग बाज़ार"], ["बिग बाज़ार ऑनलाइन"]], ["স্বপ্ন", ["স্বপ্ন"], ["স্বপ্ন এক্সপ্রেস"]], ["Tokopedia", ["TOKOPEDIA"], ["Tokopedia Food"]]];
let ok = 0; const bad = {};
for (let i = 0; i < N; i++) {
  const [shop, same, other] = pick(SHOPS), cats = ["food", "groceries", "shopping", "bills"], target = pick(cats);
  const txns = Array.from({ length: int(3, 20) }, (_, k) => { const r = rnd(); const name = r < 0.4 ? pick([shop, ...same]) : r < 0.6 ? pick(other) : pick(SHOPS)[0]; return { id: "t" + k, shop: name, cat: pick(cats), ...(rnd() < 0.15 ? { catByHand: true } : {}) }; });
  const rules = learn({}, pick([shop, ...same]), target), will = wouldChange(rules, shop, target, txns), r = applyRules(rules, txns);
  let err = "";
  r.txns.forEach((t, k) => { const o = txns[k], mine = keyOf(o.shop) === keyOf(shop); if (o.catByHand && t.cat !== o.cat) err = "changed a hand-set one"; else if (!o.catByHand && mine && t.cat !== target) err = "missed the same shop (" + o.shop + ")"; else if (!mine && t.cat !== o.cat) err = "changed another shop (" + o.shop + ")"; });
  if (!err && will !== r.changed) err = "“will change” count ≠ what changed";
  // a NEW payment gets its category through catFor: the learned one for the same shop, the person's own when set by hand
  if (!err) for (const o of txns) { const c = catFor(rules, o), mine = keyOf(o.shop) === keyOf(shop); if (o.catByHand ? c !== o.cat : mine ? c !== target : c !== o.cat) { err = "catFor wrong for a new payment"; break; } }
  if (err) bad[err] = (bad[err] || 0) + 1; else ok++;
}
const s = `# Categories-learn run — ${N} ledgers, ${ok} right (${(100 * ok / N).toFixed(2)}%)\n` + Object.entries(bad).map(([k, v]) => `\n- ✗ ${k} × ${v}`).join("") + "\n";
if (N === 10000) fs.writeFileSync(new URL("./report.md", import.meta.url), s); console.log(s);
