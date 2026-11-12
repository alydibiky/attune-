// v9.9.19 (Ali's phone, 12 Nov: "look what opened, it's always confusing"): the night note "51 new ads" for his Huawei watch hunt opened
// the Hyundai Tucson hunt, which said "1 new"; a Saudi riyal ad (syarah.com) sat in the Egypt hunt and made "62k" the cheapest;
// a YallaMotor ad whose title says EGP 1,490,000 showed 1,571,667 (a number from elsewhere on its page).
import fs from "fs";
import * as S from "../../web-src/scout.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = 2e12, car = S.parseGoal("Hyundai Tucson 2022 used");
const hit = (url, title, text) => ({ url, title, text });
const hits = [
  hit("https://egypt.yallamotor.com/used-cars/hyundai/tucson/2022/used-hyundai-tucson-2022-cairo-1234", "Used Hyundai Tucson 2022 — EGP 1,490,000 · Cairo | YallaMotor",
    "Used Hyundai Tucson 2022 for sale in Cairo. Average price of similar cars EGP 1,571,667. Asking price EGP 1,490,000. 30,000 km, automatic."),
  hit("https://syarah.com/en/used-cars/hyundai/tucson/2022/1890", "سيارات هيونداي توسان 2022 مستعملة وجديدة للبيع في السعودية",
    "هيونداي توسان 2022 مستعملة للبيع بسعر 62,100 ريال سعودي، الرياض، 45,000 كم"),
  hit("https://egypt.yallamotor.com/used-cars/hyundai/tucson/2022/hyundai-tucson-2022-5678", "هيونداي توسان 2022 مستعملة — 1,500,000 ج.م · القاهرة | يلا موتور",
    "هيونداي توسان 2022 مستعملة للبيع بسعر 1,500,000 جنيه، القاهرة، 30,000 كم"),
];
const goal = { id: "tucson", g: car, seen: [], votes: {}, taste: {} };
const r = S.runGoal(goal, hits, { now, cur: "EGP" });
const yalla = r.found.find((a) => /1234/.test(a.url));
ok(yalla && yalla.facts.price === 1490000, "the price is the one in the ad's own title (1,490,000), not another number on the page: " + (yalla && yalla.facts.price));
ok(!r.found.some((a) => /syarah/.test(a.url)), "a Saudi riyal ad is not in an Egypt hunt: " + JSON.stringify(r.found.map((a) => a.site + " " + a.facts.price + " " + a.facts.cur)));
ok(r.found.every((a) => a.facts.cur === "EGP"), "every match is in the person's own money");
ok(Math.min(...r.found.map((a) => a.facts.price)) >= 1e6, "so the cheapest is a real Egyptian price, not 62k");
ok(!r.compare.low || r.compare.low >= 1e6, "the market comparison holds only EGP prices: " + r.compare.low);
// an ad an OLDER run kept (no curExplicit, the wrong page price) is read again with today's rules
const old = { ...goal, seen: [{ id: "x1", url: hits[0].url, site: "egypt.yallamotor.com", title: hits[0].title, facts: { price: 1571667, cur: "EGP", year: 2022, used: true }, quotes: {}, item: "hyundai tucson 2022 used", firstSeen: now, lastSeen: now },
  { id: "x2", url: hits[1].url, site: "syarah.com", title: hits[1].title, facts: { price: 62100, cur: "SAR", year: 2022, used: true }, quotes: {}, item: "hyundai tucson 2022", firstSeen: now, lastSeen: now }] };
const r2 = S.runGoal(old, [], { now, cur: "EGP" });
ok(r2.found.some((a) => a.id === "x1" && a.facts.price === 1490000), "an ad kept before is re-read from its title (1,490,000)");
ok(!r2.found.some((a) => a.id === "x2"), "and an old SAR ad kept before drops out");
// a Saudi user: SAR is their own money — the same ad stays
const r3 = S.runGoal(goal, [hits[1]], { now, cur: "SAR" });
ok(r3.found.some((a) => /syarah/.test(a.url)), "for someone in Saudi Arabia the riyal ad is theirs and stays");
// the night: each hunt's own line (no count) and its own id, so the tap opens THAT hunt
const plan = S.nightPlan({ goals: [{ id: "watch", text: "Tell me when the Huawei watch GT 6 Pro drops", g: S.parseGoal("Huawei watch GT 6 Pro"), seen: [] }, { id: "tucson", text: "Hyundai Tucson 2022 used", g: car, seen: [] }] });
ok(plan.length === 2 && plan.every((p) => p.say && p.say.includes(p.title) && !/\d+ new ads/.test(p.say)), "the night plan gives each hunt its own sentence, without a count: " + plan[0].say);
const kt = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/ScoutNight.kt", import.meta.url), "utf8");
ok(/"scout-" \+ g\.optString\("id"\)/.test(kt) && !/"scout-night"/.test(kt), "the night notification's id is scout-<that hunt> (the page opens exactly it), never one 'scout-night' for all");
ok(!/new ads tonight/.test(kt), "and it never says '51 new ads tonight' (the night only searched — the page decides what matches)");
const ui = fs.readFileSync(new URL("../../web-src/scout-ui.jsx", import.meta.url), "utf8");
ok(/fresh0\[goal\.id\]/.test(ui), "the page's 'new' number belongs to the hunt that is open");
const app = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
ok(/\/\^scout-\/\.test\(d\.id/.test(app) && /attune:scout:open/.test(app), "a tapped scout-<id> opens that hunt");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
