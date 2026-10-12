// Desktop web lookup (lib/web.js) on sample pages shaped like each engine's results, through a fake fetch.
// The real engines are tried in CI (test/web-live.js), where the network is open.
"use strict";
const assert = require("assert");
const { makeWeb } = require("../lib/web");

const ddg = `<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcars.example%2Flynk-900&rut=x">Lynk & Co 900 specs</a><a class="result__snippet">Plug-in hybrid SUV</a></div>
<div class="result result--ad"><a class="result__a" href="https://ads.example/">Ad</a></div>
<div class="result"><a class="result__a" href="https://en.wikipedia.org/wiki/Lynk">Wikipedia</a></div>
<div class="result"><a class="result__a" href="https://news.example/900">900 launched</a><a class="result__snippet">Launch news</a></div>`;
const bing = `<ol><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?!&&p=1&u=a1${Buffer.from("https://cars.example/lynk-900").toString("base64").replace(/=+$/, "")}&ntb=1">Lynk 900 — Cars</a></h2><div class="b_caption"><p>Prices and versions</p></div></li>
<li class="b_algo"><h2><a href="https://dealer.example/900">Dealer 900</a></h2><div class="b_caption"><p>Dealer prices</p></div></li></ol>`;
const brave = `<div id="results"><div class="snippet" data-type="web"><a href="https://dealer.example/900"><div class="title">Dealer 900</div></a><div class="snippet-description">Prices at the dealer</div></div></div>`;
const mojeek = `<ul class="results-standard"><li><h2><a href="https://www.merriam-webster.com/dictionary/900">900 definition</a></h2><p class="s">dictionary</p></li></ul>`;
const page = `<html><head><meta property="og:image" content="/img/900.jpg"></head><body><nav>menu</nav><article><h1>Lynk & Co 900</h1>
<p>The Lynk & Co 900 is a large plug-in hybrid SUV launched in 2025 with three rows of seats and a long electric range.</p>
<table><tr><th>Version</th><th>Price</th><th>Power</th></tr><tr><td>Pro</td><td>EGP 3.2M</td><td>551 hp</td></tr><tr><td>Max</td><td>EGP 3.6M</td><td>660 hp</td></tr></table>
<p>It rivals the Li Auto L9 and the Geely Galaxy M9, and it is sold in China, Egypt and the Gulf from late 2025 onwards.</p></article><footer>footer</footer></body></html>`;
const rss = `<?xml version="1.0"?><rss><channel><item><title>Egypt cuts rates</title><link>https://news.example/a</link><source>Reuters</source><pubDate>Sun, 12 Oct 2026 08:00:00 GMT</pubDate><description>&lt;b&gt;Central bank&lt;/b&gt; cut</description></item></channel></rss>`;

const seen = [];
const fakeFetch = async (url, opt = {}) => {
  seen.push(url);
  const u = new URL(url); let body = "", type = "text/html";
  if (u.host === "html.duckduckgo.com") body = ddg;
  else if (u.host === "www.bing.com") body = bing;
  else if (u.host === "search.brave.com") body = brave;
  else if (u.host === "www.mojeek.com") body = mojeek;
  else if (u.host === "news.google.com") { body = rss; type = "application/rss+xml"; }
  else if (u.host === "cars.example" || u.host === "dealer.example" || u.host === "news.example") body = page;
  else return new Response("no", { status: 404 });
  return new Response(body, { status: 200, headers: { "content-type": type } });
};
const blocked = [];
const thumbs = [];
const W = makeWeb({ fetch: fakeFetch, online: (url, why) => { blocked.push(why); }, thumb: async (src) => { thumbs.push(src); return "data:image/jpeg;base64,AAAA"; } });

(async () => {
  const r = await W.search({ q: "Lynk & Co 900 price", pages: 3 });
  const urls = r.hits.map((h) => h.url);
  assert.ok(!urls.some((u) => u.includes("wikipedia")), "no Wikipedia");
  assert.ok(!urls.some((u) => u.includes("ads.example")), "no ads");
  assert.ok(!urls.some((u) => u.includes("merriam-webster")), "no dictionary for a non-word question");
  assert.equal(urls[0], "https://cars.example/lynk-900", "a page two engines agree on ranks first (Bing's wrapped link unwrapped)");
  assert.ok(urls.includes("https://dealer.example/900"), "Bing + Brave page kept");
  assert.equal(r.via, "duckduckgo + bing + brave", "engines that answered are named: " + r.via);
  const top = r.hits[0];
  assert.ok(top.text.includes("Pro | EGP 3.2M | 551 hp"), "tables are read as rows: " + top.text.slice(0, 300));
  assert.ok(!top.text.includes("menu") && !top.text.includes("footer"), "menus and footers left out");
  assert.equal(top.image, "data:image/jpeg;base64,AAAA", "the page's picture comes back as a small JPEG");
  assert.equal(thumbs[0], "https://cars.example/img/900.jpg", "a relative og:image is made absolute");
  assert.ok(blocked.includes("web search (DuckDuckGo)") && blocked.includes("reading a search result"), "every request passes the offline-lock gate");
  console.log("PASS search: fusion, filters, tables, picture, gate");

  const w = await W.search({ q: "what does tall mean", pages: 0 });
  assert.ok(w.hits.some((h) => h.url.includes("merriam-webster")), "a word question may use a dictionary");
  console.log("PASS a word question keeps dictionaries");

  const n = await W.news({ q: "Egypt economy", lang: "en", pages: 1 });
  assert.equal(n.items.length, 1); assert.equal(n.items[0].source, "Reuters"); assert.equal(n.items[0].snippet, "Central bank cut");
  assert.ok(n.items[0].date > 1.7e12, "the date is read");
  assert.ok(n.hits.length >= 1, "recent web results come with the headlines");
  console.log("PASS news: Google News RSS + recent pages");

  // the offline lock stops everything
  const L = makeWeb({ fetch: fakeFetch, online: () => { throw new Error("Offline lock is on"); } });
  const off = await L.search({ q: "anything", pages: 2 });
  assert.equal(off.hits.length, 0, "nothing is fetched with the lock on");
  console.log("PASS the offline lock blocks web search");
  console.log("web: all passed");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
