// v9.0 (Ali: "99 percent accurate"): what the Home box records — the exact amount, in English and Egyptian Arabic.
import { understand } from "../../web-src/doit.js";
let bad = 0; const now = Date.parse("2026-11-03T09:00:00");
const get = (t) => understand(t, { now, stores: {} }).actions;
const C = [["drank 2 glasses of water", (a) => a[0].kind === "water" && a[0].ml === 500], ["شربت 3 كوبايات مية", (a) => a[0].ml === 750], ["شربت لتر مية", (a) => a[0].ml === 1000],
  ["weight 82", (a) => a[0].kind === "weight" && a[0].kg === 82], ["وزني 81.5", (a) => a[0].kg === 81.5], ["walked 30 minutes", (a) => a[0].kind === "workout" && a[0].minutes === 30],
  ["مشيت نص ساعة", (a) => a[0].minutes === 30], ["slept 7 hours", (a) => a[0].kind === "sleep" && a[0].minutes === 420], ["نمت 6 ساعات ونص", (a) => a[0].minutes === 390],
  ["blood pressure 130/85", (a) => a[0].kind === "bp" && a[0].sys === 130 && a[0].dia === 85], ["الضغط 120 على 80", (a) => a[0].sys === 120 && a[0].dia === 80],
  ["lunch 150", (a) => a[0].kind === "money" && a[0].items[0].amount === 150 && a[0].items[0].cat === "food"],
  ["koshary for lunch, 80 pounds", (a) => a[0].kind === "food" && a[0].meal === "lunch" && a[1].kind === "money" && a[1].items[0].amount === 80],
  ["spent 200 on lunch and 50 on coffee", (a) => a.some((x) => x.kind === "money" && x.items.length === 2 && x.items[0].amount === 200 && x.items[1].amount === 50)]];
for (const [t, f] of C) { let a; try { a = get(t); } catch (e) { a = null; } if (!a || !a.length || !f(a)) { bad++; console.log(`FAIL "${t}" → ${JSON.stringify(a).slice(0, 200)}`); } }
// v9.1 (e2e_v736compare): a comparison or a phone / car name is never food or money recorded
for (const t of ["Geely Galaxy M9 vs Lynk & Co 900", "iPhone 16 vs Galaxy S25", "compare the Tucson and the Sportage", "Samsung Galaxy S25 price", "stop, just say yes", "Lynk and co 900", "Toyota Corolla 2020", "Lynk & Co 900 all trims with hp, torque, price and range", "Crane hire 25000 each day, the 1st to the 5th both included. Give me the rent and the rent with the 14 tax added."]) { const a = get(t); if (a.length) { bad++; console.log(`FAIL recorded "${t}" → ${JSON.stringify(a).slice(0, 160)}`); } }
for (const t of ["fuel for the Hyundai 500", "paid 3000 for the Toyota service"]) { const a = get(t); if (!a.length || a[0].kind !== "money") { bad++; console.log(`FAIL not recorded as money: "${t}"`); } }
console.log(bad ? bad + " FAILED" : `PASS v918homedo: ${C.length} Home-box entries recorded with the exact amounts`);
