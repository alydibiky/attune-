// v6.41 D4: the same story over days becomes one thread; "what changed" is asked only from those articles.
import * as D from "../../web-src/daily.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const digests = [
  { day: "2026-10-19", items: [
    { title: "Central Bank of Egypt cuts interest rates by 2% - Ahram Online", url: "a1", source: "Ahram Online", text: "The CBE cut the overnight deposit rate by 200 basis points to 22%." },
    { title: "البنك المركزي يخفض أسعار الفائدة 2%", url: "a2", source: "اليوم السابع", text: "خفض البنك المركزي سعر الفائدة" },
    { title: "Egypt gold prices rise", url: "a3", source: "Masrawy" } ] },
  { day: "2026-10-18", items: [
    { title: "Analysts expect Central Bank to cut interest rates on Thursday", url: "b1", source: "Reuters", text: "A Reuters poll of 15 economists expects a 100–200 bp cut." },
    { title: "Metro line 4 tunnel works", url: "b2", source: "Ahram Online" } ] },
  { day: "2026-10-17", items: [{ title: "Inflation slows to 12% in September, Central Bank data shows; interest rates in focus", url: "c1", source: "Enterprise" }] },
];
const th = D.newsThreads(digests, "Egypt economy", "2026-10-19");
ok(th.length === 1, "one thread across days (gold and metro are single stories): " + th.map((t) => t.title));
const t = th[0];
ok(t.days.join() === "2026-10-19,2026-10-18,2026-10-17" && t.today, "the rates story: 3 days, newest first, today");
ok(t.sources.includes("Reuters") && t.sources.includes("Ahram Online") && t.sources.includes("Enterprise"), "every source that told it: " + t.sources);
ok(/cuts interest rates/.test(t.title), "titled by today's headline");
const c = D.changeMessages(t, "en");
ok(c.items.length === 2 && c.items[0].url === "b1" && c.items[1].url === "a1", "what changed: yesterday's article [1] then today's [2] (the Arabic one is not linked: different words)");
ok(/NOTHING NEW/.test(c.messages[0].content) && /\[1\] \(2026-10-18\)/.test(c.messages[1].content), "the model gets only those articles, dated");
ok(D.newsThreads([{ day: "2026-10-19", items: digests[0].items }], "x").length === 0, "one day is not a thread");
console.log(bad ? bad + " FAILED" : "v741newsthreads ok");
