// v6.8 — Ali: "test that all functions give good answers, by trying yourself". A REAL model (llama-server
// on 127.0.0.1:8099, started by tests/trials/run.sh) gets each tool's own instructions — the same message
// builders and parsers the app uses — with requests like a real user's. Every answer goes to a report
// (tests/trials/report.md) that a person reads; code checks catch what can be caught automatically.
//   bash tests/trials/run.sh /path/to/model.gguf
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const D = await import("../../web-src/daily.js");
const S = await import("../../web-src/slides.js");
const E = await import("../../web-src/erp.js");
const DL = await import("../../web-src/deal.js");
const X = await import("../../web-src/chatxray.js");
const V = await import("../../web-src/verify.js");
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
const C = await import("../../web-src/code.js");
const PORT = process.env.TRIAL_PORT || 8099;
const only = process.argv[2] || "";

async function llm(messages, { maxTokens = 900, temperature = 0.3, json = false } = {}) {
  const t0 = Date.now();
  const body = { messages, max_tokens: maxTokens, temperature, stream: false, ...(json ? { response_format: { type: "json_object" } } : {}),
    chat_template_kwargs: { enable_thinking: false } };
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || JSON.stringify(j).slice(0, 300);
  return { text, secs: Math.round((Date.now() - t0) / 100) / 10, tokens: (j.usage && j.usage.completion_tokens) || 0 };
}

const out = [`# Real-model trials — ${new Date().toISOString().slice(0, 16)} — ${process.env.MODEL_NAME || "model"}\n`];
const checks = [];
function section(name, input, r, parsed, verdicts) {
  out.push(`## ${name}\n**Asked:** ${input}\n\n**Time:** ${r.secs}s · ${r.tokens} tokens\n\n<details><summary>Raw answer</summary>\n\n\`\`\`\n${r.text.slice(0, 4000)}\n\`\`\`\n</details>\n`);
  if (parsed !== undefined) out.push(`**What the app takes from it:**\n\`\`\`json\n${JSON.stringify(parsed, null, 1).slice(0, 2500)}\n\`\`\`\n`);
  for (const [ok, what] of verdicts) { checks.push([name, ok, what]); out.push(`- ${ok ? "✅" : "❌"} ${what}`); }
  out.push("");
  fs.writeFileSync(new URL("./report.md", import.meta.url), out.join("\n"));
  console.log(`${name}: ${verdicts.filter((v) => v[0]).length}/${verdicts.length} · ${r.secs}s`);
}
const want = (k) => !only || only.split(",").includes(k);

// ---- Learn daily: the course plan, lesson 1, a quiz ----
if (want("learn")) for (const lang of ["en", "ar"]) {
  const c = D.newCourse({ topic: lang === "ar" ? "هيدروليك الأوناش المتحركة" : "Hydraulics of mobile cranes", level: "beginner", lang });
  let r = await llm(D.planMessages(c), { json: true, maxTokens: 900 });
  const plan = D.parsePlan(r.text);
  section(`Learn daily · course plan (${lang})`, c.topic, r, plan, [[plan && plan.plan.length >= 20, "a real plan of 20–30 lessons"], [plan && new Set(plan.plan).size === plan.plan.length, "no repeated lessons"], [lang !== "ar" || (plan && plan.plan.filter((t) => /[؀-ۿ]/.test(t)).length >= plan.plan.length * 0.8), "titles in the course's language"]]);
  if (!plan) continue;
  c.plan = plan.plan;
  r = await llm(D.lessonMessages(c, 0), { maxTokens: 1400 });
  const les = D.parseLesson ? D.parseLesson(r.text) : null;
  section(`Learn daily · lesson 1 (${lang})`, c.plan[0], r, les && { keyPoints: les.keyPoints, visual: les.visual && les.visual.kind, chars: (les.body || les.markdown || "").length },
    [[les && (les.body || les.markdown || "").length > 600, "a real lesson (not a stub)"], [les && Array.isArray(les.keyPoints) && les.keyPoints.length >= 2, "key points to remember"], [les && les.visual, "a visual the app can draw"], [/## /.test(r.text) && /try it|جرّب|جرب/i.test(r.text), "sections and a practice task"]]);
}

// ---- Slides: the outline and one slide ----
if (want("slides")) {
  const o = { topic: "Crane safety on construction sites — for site supervisors", n: 7, lang: "en", audience: "site supervisors" };
  let r = await llm(S.outlineMessages(o), { json: true, maxTokens: 900 });
  const ol = S.parseOutline(r.text, o);
  section("Slides · outline", o.topic, r, ol, [[ol && (ol.slides || ol).length >= 5, "5+ slides planned"], [ol && JSON.stringify(ol).length > 300, "each slide has content"]]);
  const slides = ol && (ol.slides || ol);
  if (slides && slides[1]) {
    r = await llm(S.slideMessages({ deckTitle: ol.title || o.topic, topic: o.topic, slide: slides[1], i: 1, n: slides.length, others: slides.map((s) => s.title || s), lang: "en", audience: o.audience }), { json: true, maxTokens: 900 });
    const sl = S.parseSlide(r.text);
    section("Slides · slide 2 written out", JSON.stringify(slides[1]).slice(0, 120), r, sl, [[sl && JSON.stringify(sl).length > 200, "a filled slide"], [!/lorem|\[insert|TBD/i.test(r.text), "no placeholders"]]);
  }
}

// ---- Business: a system from one sentence ----
if (want("business")) {
  const d = "A crane rental company: customers, cranes with capacity and daily rate, jobs with start and end dates, invoices and payments";
  let r = await llm(E.designLinesMessages(d), { maxTokens: 900 });
  const spec = E.specFromLines(r.text, "Cranes");
  const names = (spec.tables || []).map((t) => t.name);
  section("Business · design from a sentence", d, r, { tables: (spec.tables || []).map((t) => `${t.name}: ${(t.fields || []).map((f) => f.name + (f.type ? "(" + f.type + ")" : "")).join(", ")}`) },
    [[names.length >= 4, "4+ tables (customers, cranes, jobs, invoices…)"], [/custom/i.test(names.join()) && /crane/i.test(names.join()) && /job/i.test(names.join()), "the tables that were asked for"], [JSON.stringify(spec).match(/date/i), "dates on jobs"]]);
}

// ---- Deal Check: read an offer ----
if (want("deal")) {
  const offer = "Samsung Galaxy S25 Ultra 256GB brand new sealed. Price 62,000 EGP or 12 × 5,900 with valU. Deposit 5,000 via Vodafone Cash to reserve, today only!";
  let r = await llm(DL.extractMessages(offer, false), { json: true, maxTokens: 500 });
  const t = DL.parseTerms(r.text);
  const plan = DL.plansIn(offer)[0];
  const cost = plan && DL.planCost({ cash: 62000, monthly: plan.monthly, months: plan.months });
  const signs = DL.scamSigns(offer).map((s) => s.id);
  section("Deal Check · reading an offer", offer, r, { terms: t, plan, cost, signs },
    [[t && /s25|galaxy/i.test(JSON.stringify(t)), "the item is read"], [t && JSON.stringify(t).includes("62000") || JSON.stringify(t).includes("62,000"), "the cash price is read"], [cost && cost.total === 70800, "code: 12 × 5,900 = 70,800 (8,800 more than cash)"], [signs.includes("pay-first") && signs.includes("wallet") && signs.includes("urgent"), "code: deposit, wallet and urgency flagged"]]);
}

// ---- Chat X-Ray: debts in an Egyptian WhatsApp chat ----
if (want("xray")) {
  const chat = `12/09/2026, 10:02 - Ali: يا حسن الونش بتاع امبارح حسابه 18000 جنيه
12/09/2026, 10:05 - Hassan: تمام يا علي هحولك 10000 النهارده والباقي آخر الشهر
13/09/2026, 18:40 - Hassan: حولتلك 10000 على انستاباي
14/09/2026, 09:12 - Ali: وصلت شكرا، فاضل 8000
20/09/2026, 11:30 - Hassan: ممكن الونش 50 طن يوم الخميس؟
20/09/2026, 11:31 - Ali: تمام الخميس 7 الصبح`;
  const ex = X.parseExport(chat);
  const msgs = ex.messages || ex;
  const people = [...new Set(msgs.map((m) => m.who))];
  let r = await llm(X.extractMessages(msgs.map((m, i) => ({ ...m, i })), "Ali", people, new Date("2026-09-25")), { json: true, maxTokens: 700 });
  const items = X.parseItems(r.text, new Map(msgs.map((m, i) => [i, { ...m, i }])), people);
  const led = X.ledgerOf(items, "Ali");
  section("Chat X-Ray · who owes whom (Egyptian Arabic)", "6 WhatsApp lines", r, { items: items.map((x) => [x.type, x.from, x.to, x.amount]), ledger: led.map((x) => [x.person, x.net]) },
    [[led.some((x) => x.person === "Hassan" && x.net === 8000), "Hassan still owes 8,000 (18,000 − 10,000)"], [items.some((x) => x.type === "promise" || x.type === "deadline" || x.type === "order"), "the Thursday 7 am booking is noticed"]]);
}

// ---- Coding: a small program ----
if (want("code")) {
  const task = "A Python function egp_to_usd(amount, rate) that rounds to 2 decimals and refuses negative amounts, with 3 tests";
  let r = await llm(C.writeMessages(task, "python"), { maxTokens: 900 });
  section("Coding · write a function", task, r, undefined, [[/def egp_to_usd/.test(r.text), "the function exists"], [/raise|ValueError/.test(r.text), "negative amounts refused"], [/assert|def test_/.test(r.text), "tests included"], [/round\(/.test(r.text), "rounds to 2 decimals"]]);
}

// ---- Maths the model must get right (the checker then re-checks it) ----
if (want("math")) {
  const q = "A crane rents for 12,500 EGP a day. 3 cranes for 4 days, plus 14% VAT. What is the total?";
  let r = await llm(V.solveMessages(q), { maxTokens: 700 });
  // the app runs the model's program (Python on the phone) — run it here the same way
  const code = (r.text.match(/```(?:python)?\n([\s\S]*?)```/) || [])[1] || "";
  let printed = ""; try { printed = (await import("child_process")).execFileSync("python3", ["-c", code], { timeout: 20000 }).toString(); } catch (e) { printed = String(e.stdout || e.message); }
  section("Maths · a word problem", q, r, { printed: printed.trim() }, [[/ANSWER:\s*171,?000/.test(printed), "the program prints the right total: 171,000 EGP"], [/Fraction|round/.test(code), "exact arithmetic (fractions / rounding)"]]);
}

// ---- Fit: a meal the code reader doesn't know → the model ----
if (want("fit")) {
  const words = "طاجن بامية باللحمة وطبق ملوخية بالأرانب";
  let r = await llm(F.mealMessages(words, false), { json: true, maxTokens: 500 });
  const items = R.parseMealChecked(r.text);
  section("Fit · a meal read by the model", words, r, items.map((x) => [x.id || x.name, x.grams, x.kcal]),
    [[items.length >= 2, "both dishes found"], [items.every((x) => x.grams >= 100 && x.grams <= 700), "believable portions"], [items.every((x) => x.kcal > 0), "calories for each"]]);
}

const ok = checks.filter((c) => c[1]).length;
out.splice(1, 0, `**Automatic checks: ${ok}/${checks.length}.** The raw answers below are for reading.\n`);
fs.writeFileSync(new URL("./report.md", import.meta.url), out.join("\n"));
console.log(`\nCHECKS ${ok}/${checks.length}`);
