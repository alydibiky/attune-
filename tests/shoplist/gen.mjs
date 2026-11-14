// v9.9.40 AP-4 (Ali's wish with K3: "understand when I tell it I bought the shopping list") — EXACTLY 10,000 sentences, each with a
// Talabat list of 3–8 items (English / Arabic): bought everything, everything except 1–2, only 1–3 named items — in English,
// Egyptian Arabic and Franco, with "the", plurals, «ال», fillers — and sentences that must NOT clear anything (questions, plans,
// "got it", things not on the list). Truth written HERE: exactly which items come off.
//     node tests/shoplist/gen.mjs [n]      HELDOUT=1 → phrasings written after the code (heldout.mjs)
import fs from "fs";
const S = await import("../../web-src/shoplist.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const N = +(process.argv[2] || 10000);
let seed = 4242 + 7919 * +(process.env.SEED_SHIFT || 0) + (H ? 55 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], shuffle = (a) => a.map((x) => [rnd(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const EN = ["tortilla", "chicken strips", "bread", "milk", "eggs", "dish soap", "cheese", "tomatoes", "rice", "coffee", "bananas", "tissues"];
const AR = ["تورتيا", "عيش", "لبن", "بيض", "جبنة", "طماطم", "رز", "قهوة", "موز", "مناديل", "صابون", "زيت"];
const join = (xs, ar) => xs.length === 1 ? xs[0] : ar ? xs.join(" و") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
const ALL_EN = H ? H.allEn : ["I bought the shopping list", "bought everything", "got all the groceries", "I got the talabat", "done with the shopping", "picked up everything on the list"];
const ALL_AR = H ? H.allAr : ["جبت الطلبات", "جبت كل حاجة", "اشتريت الطلبات كلها", "خلصت الطلبات", "جبنا الحاجات"];
const ALL_FR = H ? H.allFr : ["gebt el talabat", "gebt kol 7aga", "5alast el talabat"];
const EXC_EN = H ? H.excEn : ["bought everything except {x}", "got all the groceries but not {x}", "I bought the shopping list except for {x}"];
const EXC_AR = H ? H.excAr : ["جبت كل حاجة ما عدا {x}", "جبت الطلبات كلها الا {x}", "اشتريت الحاجات من غير {x}"];
const ONLY_EN = H ? H.onlyEn : ["bought the {x}", "got {x}", "I picked up {x}", "grabbed {x}"];
const ONLY_AR = H ? H.onlyAr : ["جبت {x}", "اشتريت {x}", "جبنا {x}"];
const NOPE = H ? H.nope : ["did you buy the {x}?", "I need to buy {x}", "got it", "remind me to buy {x}", "Noudy bought a new car", "I got your message", "هتجيب {x}؟", "لازم اشتري {x}", "bought a phone yesterday"];
const seen = new Set(), bad = {}; let pass = 0, made = 0;
while (made < N) {
  const ar = rnd() < 0.45, pool = ar ? AR : EN, list = shuffle(pool).slice(0, 3 + Math.floor(rnd() * 6)), r = rnd();
  let s, want;
  if (r < 0.3) { s = pick(ar ? [...ALL_AR, ...ALL_FR] : ALL_EN); want = list.slice(); }
  else if (r < 0.55) { const ex = shuffle(list).slice(0, 1 + Math.floor(rnd() * Math.min(2, list.length - 1))); s = pick(ar ? EXC_AR : EXC_EN).replace("{x}", join(ex.map((x) => ar && rnd() < 0.4 ? "ال" + x : x), ar)); want = list.filter((x) => !ex.includes(x)); }
  else if (r < 0.82) { const on = shuffle(list).slice(0, 1 + Math.floor(rnd() * 3)); s = pick(ar ? ONLY_AR : ONLY_EN).replace("{x}", join(on.map((x) => ar && rnd() < 0.4 ? "ال" + x : x), ar)); want = list.filter((x) => on.includes(x)); }
  else { s = pick(NOPE).replace("{x}", pick(list)); want = []; }
  if (rnd() < 0.25) s = pick(["", "ok ", "btw ", "يا اتيون ", "hey attune, "]) + s + pick(["", ".", "!", " 🙏", " خلاص"]);
  const k = s + "|" + list.join(); if (seen.has(k)) continue; seen.add(k); made++;
  const got = S.applyBought(S.boughtOf(s, list), list).done;
  const ok = got.length === want.length && got.every((x) => want.includes(x));
  if (ok) pass++; else { const why = (want.length ? (got.length ? "wrong items" : "missed") : "cleared items it shouldn't") + " — «" + s.replace(/\d+/g, "N") + "»"; (bad[why] = bad[why] || []).push(list.join(",")); }
}
const md = `# "I bought …" — ${N} sentences, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT" : ""}\n\n` + Object.entries(bad).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, v]) => `- **${k}** × ${v.length}: ${v[0]}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(H ? "./report-heldout.md" : "./report.md", import.meta.url), md);
console.log(md.slice(0, 3500));
