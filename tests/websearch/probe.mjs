// Which search engines answer from here, and how many results each page has (for the benchmark and
// for choosing the app's backup engines).
import * as cheerio from "cheerio";
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const q = "Liebherr LTM 1100-4.2 max capacity";
const tries = [
  ["ddg-html POST", () => fetch("https://html.duckduckgo.com/html/", { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Referer: "https://html.duckduckgo.com/" }, body: new URLSearchParams({ q }) }), "a.result__a"],
  ["ddg-html GET", () => fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "a.result__a"],
  ["ddg-lite", () => fetch("https://lite.duckduckgo.com/lite/", { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ q }) }), "a.result-link"],
  ["bing", () => fetch("https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=en&cc=US", { headers: { "User-Agent": UA, "Accept-Language": "en" } }), "li.b_algo h2 a"],
  ["mojeek", () => fetch("https://www.mojeek.com/search?q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "ul.results-standard li a.title, .results-standard a.ob"],
  ["brave-html", () => fetch("https://search.brave.com/search?q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "#results .snippet a, a.heading-serpresult, div.snippet a[href^='http']"],
  ["yahoo", () => fetch("https://search.yahoo.com/search?p=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "div.algo h3 a, .compTitle a"],
  ["startpage", () => fetch("https://www.startpage.com/sp/search?query=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "a.result-link, .w-gl__result-title"],
  ["ecosia", () => fetch("https://www.ecosia.org/search?q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "a.result__link, [data-test-id='result-link']"],
  ["bing-rss", () => fetch("https://www.bing.com/search?format=rss&q=" + encodeURIComponent(q), { headers: { "User-Agent": UA } }), "item link"],
  ["bing-rss ar", () => fetch("https://www.bing.com/search?format=rss&setlang=ar&cc=EG&q=" + encodeURIComponent("ارتفاع برج القاهرة"), { headers: { "User-Agent": UA } }), "item link"],
  ["ddg lite GET 2", () => fetch("https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent("Cairo Tower height"), { headers: { "User-Agent": UA } }), "a.result-link"],
  ["google", () => fetch("https://www.google.com/search?q=" + encodeURIComponent(q) + "&hl=en", { headers: { "User-Agent": UA } }), "a h3"],
];
for (const [name, go, sel] of tries) {
  const t0 = Date.now();
  try {
    const r = await go(); const html = await r.text(); const $ = cheerio.load(html);
    console.log(`${name.padEnd(14)} HTTP ${r.status} · ${html.length} bytes · ${$(sel).length} results · ${Date.now() - t0} ms · ${$("title").text().slice(0, 60).replace(/\s+/g, " ")}`);
  } catch (e) { console.log(`${name.padEnd(14)} FAILED ${e.message} · ${Date.now() - t0} ms`); }
}

// what Bing / Startpage / Google pages actually contain (to fix the readers)
for (const [name, url] of [["bing", "https://www.bing.com/search?q=" + encodeURIComponent(q) + "&setlang=en&cc=US"], ["bing-desktop", "https://www.bing.com/search?q=" + encodeURIComponent(q)], ["startpage", "https://www.startpage.com/sp/search?query=" + encodeURIComponent(q)], ["ddg-lite GET", "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q)], ["ddg-html GET ar", "https://html.duckduckgo.com/html/?q=" + encodeURIComponent("ارتفاع برج القاهرة") + "&kl=xa-ar"]]) {
  try {
    const ua = name === "bing-desktop" ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" : UA;
    const r = await fetch(url, { headers: { "User-Agent": ua, "Accept-Language": "en,ar;q=0.8" } }); const html = await r.text(); const $ = cheerio.load(html);
    const ext = $("a[href^='http']").toArray().map((a) => $(a).attr("href")).filter((h) => !/bing\.com|microsoft|startpage|duckduckgo|google\.|msn\.com|go\.microsoft/i.test(h)).slice(0, 6);
    const classes = {}; $("[class]").each((_, e) => { for (const c of String($(e).attr("class")).split(/\s+/)) if (c) classes[c] = (classes[c] || 0) + 1; });
    console.log(`\n--- ${name} HTTP ${r.status} · b_algo in raw html: ${(html.match(/b_algo/g) || []).length} · result__a: ${(html.match(/result__a/g) || []).length} · result-link: ${(html.match(/result-link/g) || []).length}`);
    console.log("external links:", ext.join("  "));
    console.log("common classes:", Object.entries(classes).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([c, n]) => c + ":" + n).join(" "));
    const a0 = $("a[href^='http']").toArray().find((a) => ext.includes($(a).attr("href")));
    if (a0) console.log("first result's parents:", $(a0).parents().toArray().slice(0, 5).map((p) => p.tagName + "." + String($(p).attr("class") || "").split(/\s+/).slice(0, 2).join(".")).join(" < "));
  } catch (e) { console.log(name, "failed", e.message); }
}
