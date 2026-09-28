// v6.8 — Ali: "make the web search very accurate, powerful and fast — for the whole app, no matter
// the model". The benchmark: real questions with known answers, through the app's own web pipeline
// (Chat's FAST path, chat.jsx): search (the phone's DuckDuckGo + Bing, search.mjs) → merge by site
// quality (research.mjs mergeHits) → the passages that answer (webrank.js) → figures confirmed on 2+
// sites → the grounded prompt → the model (llama-server on :8099) → the app's repairs (model names,
// figures, tidy) → the number audit (asked once more when a number isn't in the sources). Scored by
// code; every step timed. Writes tests/websearch/report-<model>.md and prints a summary.
//   node tests/websearch/eval.mjs [--only 1,5,9]
import fs from "fs";
import http from "http";
import { search, pageText, TIMEOUTS, readPages } from "./search.mjs";
// FIXTURE=1: the search results come from fixtures.json (real results for each question, collected once)
// and the pages are opened live — measures everything after the search, the same on any machine.
const FIXTURES = process.env.FIXTURE ? JSON.parse(fs.readFileSync(new URL("./fixtures.json", import.meta.url), "utf8")) : null;
async function fixtureSearch(i, pages) {
  const t0 = Date.now();
  const hits = (FIXTURES[String(i)] || []).map((h) => ({ ...h, source: "web" })).filter((h) => !/wikipedia\.org\//i.test(h.url));
  await readPages(hits.slice(0, pages));
  return { hits: hits.filter((h) => (h.text || "").length > 40), via: "fixture", ms: { search: 0, read: Date.now() - t0 } };
}
const R = await import("../../web-src/research.js");
const W = await import("../../web-src/webrank.js");
const AF = await import("../../web-src/answerfix.js");
const FS = await import("../../web-src/factsheet.js");
const LR = await import("../../web-src/longread.js");
const APP = await import("../trials/appsrc.mjs");
const G = APP.grounded();
const PORT = process.env.TRIAL_PORT || 8099;
const MODEL = process.env.MODEL_NAME || "model";
const CTX = +(process.env.CTX || 8192);
const POWER = { pages: 8, readPages: 8, queries: 3, longTokens: 1536 };   // a mid-level phone model (power.js level 3), shorter answers

// [question, what a right answer must contain]
export const QUESTIONS = [
  ["What is the maximum lifting capacity of the Liebherr LTM 1100-4.2 mobile crane?", /100\s?(t\b|ton|tonnes)/i],
  ["How tall is the Cairo Tower?", /187/],
  ["What is the standard VAT rate in Egypt?", /14\s?%/],
  ["ما هي عاصمة أستراليا؟", /كانبرا|Canberra/i],
  ["Who is the CEO of Nvidia?", /Jensen Huang/i],
  ["When did the Grand Egyptian Museum officially open?", /2025/],
  ["What is the top speed of the Tesla Model S Plaid?", /(200\s?mph|322\s?km)/i],
  ["What is the battery capacity of the iPhone 16 Pro Max in mAh?", /4,?685/],
  ["What is the maximum boom length of the Liebherr LTM 1090-4.2?", /60\s?m/i],
  ["How long is the Suez Canal in kilometres?", /19[0-9]/],
  ["ما هو أطول نهر في العالم؟", /النيل|Nile/i],
  ["Who won the 2022 FIFA World Cup?", /Argentina|الأرجنتين/i],
  ["ما هي الحمولة القصوى لونش Grove GMK5250L؟", /250|300/],
  ["What is the capital of Turkey?", /Ankara|أنقرة/i],
  ["كم سعر الدولار مقابل الجنيه المصري في البنك الأهلي اليوم؟", /\b(4\d|5\d)([.,]\d+)?\b/],
  ["What is the torque of the Toyota Hilux 2.8 diesel engine?", /500\s?N·?m|500\s?nm/i],
  ["How many cylinders does the Liebherr LTM 1100-4.2 carrier engine have, and what is its power?", /(6|six)[\s\S]{0,200}(4\d\d|3\d\d)\s?(kW|hp)/i],
  ["What year was the Suez Canal opened?", /1869/],
  ["ما هو ارتفاع برج خليفة؟", /828/],
  ["What is the maximum payload of the Airbus A380 in passengers (typical and maximum)?", /(5\d\d|8[0-9]\d)/],
];

function post(body) {
  return new Promise((ok, bad) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let d = ""; res.setEncoding("utf8"); res.on("data", (x) => (d += x)); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ok({}); } });
    });
    req.on("error", bad); req.setTimeout(0); req.end(JSON.stringify(body));
  });
}
async function llm(content, maxTokens) {
  const j = await post({ messages: [{ role: "user", content }], max_tokens: maxTokens, temperature: 0.1, stream: false, chat_template_kwargs: { enable_thinking: false } });
  return { text: (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "", t: j.timings || {} };
}

/** One question through Chat's FAST web path, as chat.jsx does it. */
export async function answer(typed, index = 0) {
  const ms = {}; let t = Date.now();
  const deep = R.pagesFor(typed) === 8;
  const readCap = deep ? POWER.readPages : Math.min(POWER.readPages, 5);
  const nQ = deep ? Math.max(3, POWER.queries) : 1;
  const queries = nQ > 1 ? R.expandQueries(typed, nQ) : [typed];
  const per = Math.min(8, Math.ceil(readCap / queries.length) + 2);
  const found = FIXTURES ? [await fixtureSearch(index, 8)] : await Promise.all(queries.map((q) => search(q, queries.length > 1 ? per : Math.min(POWER.pages, R.pagesFor(typed))).catch(() => ({ hits: [] }))));
  ms.search = Math.max(...found.map((f) => (f.ms && f.ms.search) || 0)); ms.read = Math.max(...found.map((f) => (f.ms && f.ms.read) || 0));
  const toRead = R.mergeHits(found.map((f) => f.hits || []), readCap, typed);
  if (!toRead.length) return { text: "", ms, pages: 0, why: "no results" };
  if (process.env.RETRIEVAL_ONLY) return { text: "", ms, pages: toRead.length, sources: toRead.map((h) => h.url), via: found.map((f) => f.via).join(" / "), inSources: (rx) => rx.test(toRead.map((h) => h.title + " " + h.text).join(" ")), rankedHas: (rx) => rx.test(W.rankPassages(typed, toRead, { budget: 9000 }).map((h) => h.title + " " + h.text).join(" ")), smallHas: (rx) => rx.test(W.rankPassages(typed, toRead, { budget: 4500, perSource: 1500 }).map((h) => h.title + " " + h.text).join(" ")) };
  t = Date.now();
  const budget = LR.fitChars(Math.min(CTX, 12288), POWER.longTokens, 2600, toRead.map((h) => String(h.text || "").slice(0, 3000)).join(" "));
  const ranked = W.rankPassages(typed, toRead, { budget, perSource: Math.max(1500, Math.floor(budget / Math.max(1, Math.min(toRead.length, 6)) * 1.4)) });
  const figs = R.confirmedFigures(ranked);
  const sheet = FS.factSheet(typed, ranked, /[؀-ۿ]/.test(typed));
  const content = G.groundedPrompt(typed, ranked) + figs.block + (sheet.md ? FS.SHEET_NOTE : deep ? R.FAST_REPORT_ADD : "");
  ms.rank = Date.now() - t; t = Date.now();
  const r = await llm(content, POWER.longTokens);
  ms.model = Date.now() - t; ms.promptTok = r.t.prompt_n || 0; ms.genTok = r.t.predicted_n || 0;
  let ans = r.text;
  const fm = AF.fixModelNames(ans, typed, ranked); if (fm.fixed.length) ans = fm.text;
  ans = AF.tidyAnswer(AF.repairFigures(ans, ranked).text);
  const au = G.groundedAudit(ans, ranked, typed);
  if (au.fabricated.length) {
    t = Date.now();
    const again = await llm(content + "\n\nYOUR FIRST ANSWER WAS:\n" + ans + "\n\nThese numbers in it are NOT in the passages: " + au.fabricated.slice(0, 6).join(", ") + ". Write the answer again using only numbers, versions and dates exactly as the passages write them.", POWER.longTokens);
    ms.retry = Date.now() - t;
    const au2 = G.groundedAudit(again.text, ranked, typed);
    if (again.text && au2.fabricated.length < au.fabricated.length) ans = AF.tidyAnswer(AF.repairFigures(again.text, ranked).text);
  }
  const inSources = (rx) => rx.test(ranked.map((h) => h.title + " " + h.text).join(" "));
  return { text: ans, ms, pages: toRead.length, sources: ranked.map((h) => h.url), content, inSources, sheet: sheet.md, audit: G.groundedAudit(ans, ranked, typed) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).map(Number);
  const out = [`# Web search benchmark — ${new Date().toISOString().slice(0, 16)} — ${MODEL}\n`];
  const rows = []; let right = 0, found = 0, n = 0; const tot = { search: 0, read: 0, rank: 0, model: 0, retry: 0 };
  for (let i = 0; i < QUESTIONS.length; i++) {
    if (only.length && !only.includes(i + 1)) continue;
    const [q, rx] = QUESTIONS[i]; n++;
    let a; try { a = await answer(q, i + 1); } catch (e) { a = { text: "", ms: {}, why: String(e.message || e) }; }
    const ok = rx.test(a.text || ""); const had = a.inSources ? a.inSources(rx) : false;
    if (ok) right++; if (had) found++;
    for (const k of Object.keys(tot)) tot[k] += a.ms[k] || 0;
    const secs = Object.values(a.ms).filter((v, k) => typeof v === "number").slice(0, 5).reduce((x, y) => x + y, 0) / 1000;
    rows.push(`| ${i + 1} | ${ok ? "✅" : had ? "❌ (was in the pages)" : "❌ (not found)"} | ${q.slice(0, 60)} | ${((a.ms.search || 0) / 1000).toFixed(1)} | ${((a.ms.read || 0) / 1000).toFixed(1)} | ${((a.ms.model || 0) / 1000).toFixed(1)} | ${a.pages || 0} |`);
    out.push(`## ${i + 1}. ${q}\n${ok ? "✅" : "❌"} expected ${rx} · in the pages: ${had ? "yes" : "no"} · search ${a.ms.search}ms, read ${a.ms.read}ms, model ${a.ms.model}ms${a.ms.retry ? ", retry " + a.ms.retry + "ms" : ""} · prompt ${a.ms.promptTok} tokens\n\n${(a.text || a.why || "").slice(0, 2500)}\n\nSources: ${(a.sources || []).join(" · ")}\n`);
    console.log(`${i + 1}. ${ok ? "OK " : "BAD"} ${had ? "(in pages)" : "(not found)"}${a.rankedHas ? (a.rankedHas(rx) ? " (kept at 9000)" : " (LOST at 9000)") + (a.smallHas(rx) ? " (kept at 4500)" : " (LOST at 4500)") : ""} search ${(a.ms.search / 1000).toFixed(1)}s read ${(a.ms.read / 1000).toFixed(1)}s model ${(a.ms.model / 1000).toFixed(1)}s prompt ${a.ms.promptTok || 0} tok · via ${a.via || ""} · ${a.pages} pages · ${q.slice(0, 50)}`);
    console.log("   sites: " + (a.sources || []).slice(0, 6).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } }).join(", "));
    if (a.text) console.log("   answer: " + a.text.replace(/\s+/g, " ").slice(0, 260));
    fs.writeFileSync(new URL(`./report-${MODEL.replace(/\W+/g, "-")}.md`, import.meta.url), out.join("\n"));
  }
  const avg = (k) => (tot[k] / n / 1000).toFixed(1);
  const head = `**Right: ${right}/${n}** · the answer was in the pages read: ${found}/${n} · average: search ${avg("search")}s, reading pages ${avg("read")}s, passages ${avg("rank")}s, model ${avg("model")}s (this machine's CPU)\n\n| # | Result | Question | Search s | Read s | Model s | Pages |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n`;
  out.splice(1, 0, head);
  fs.writeFileSync(new URL(`./report-${MODEL.replace(/\W+/g, "-")}.md`, import.meta.url), out.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Web search — ${MODEL}\n\n${head}\n`);
  console.log(`\nWEB ${right}/${n} right · in pages ${found}/${n} · search ${avg("search")}s read ${avg("read")}s model ${avg("model")}s`);
}
