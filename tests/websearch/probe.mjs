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
  ["google", () => fetch("https://www.google.com/search?q=" + encodeURIComponent(q) + "&hl=en", { headers: { "User-Agent": UA } }), "a h3"],
];
for (const [name, go, sel] of tries) {
  const t0 = Date.now();
  try {
    const r = await go(); const html = await r.text(); const $ = cheerio.load(html);
    console.log(`${name.padEnd(14)} HTTP ${r.status} · ${html.length} bytes · ${$(sel).length} results · ${Date.now() - t0} ms · ${$("title").text().slice(0, 60).replace(/\s+/g, " ")}`);
  } catch (e) { console.log(`${name.padEnd(14)} FAILED ${e.message} · ${Date.now() - t0} ms`); }
}
