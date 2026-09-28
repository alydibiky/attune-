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
const CV = await import("../../web-src/convert.js");
const A = await import("../../web-src/actions.js");
const APP = await import("./appsrc.mjs");
const SP = await import("../../web-src/spaces.js");
const MI = await import("../../web-src/mind.js");
const PORT = process.env.TRIAL_PORT || 8099;
const only = process.argv[2] || "";

async function llm(messages, { maxTokens = 900, temperature = 0.3, json = false } = {}) {
  const t0 = Date.now();
  const body = { messages, max_tokens: maxTokens, temperature, stream: false, ...(json ? { response_format: { type: "json_object" } } : {}),
    chat_template_kwargs: { enable_thinking: false } };
  // plain http, not fetch: fetch gives up after 5 minutes without headers, and a long page on a CPU takes longer
  const http = await import("http");
  const j = await new Promise((ok, bad) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let d = ""; res.setEncoding("utf8"); res.on("data", (x) => (d += x)); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ok({ error: d.slice(0, 300) }); } });
    });
    req.on("error", bad); req.setTimeout(0); req.end(JSON.stringify(body));
  });
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
  fs.writeFileSync(new URL(process.env.TRIAL_REPORT || "./report.md", import.meta.url), out.join("\n"));
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
  let r = await llm(S.outlineMessages(o), { maxTokens: 520, temperature: 0.5 });   // as the app calls it
  const ol = S.parseOutline(r.text, o.n, { topic: o.topic });
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
  // exactly the app's path (chatxray-ui.jsx): parse → candidates → numbered chunk → extract → check
  const ex = X.parseExport(chat);
  const msgs = ex.messages, people = ex.people;
  const byIndex = new Map(msgs.map((m) => [m.i, m]));
  const chunk = X.chunksOf(X.candidates(msgs))[0] || "";
  let r = await llm(X.extractMessages(chunk, "Ali", people, new Date("2026-09-25")), { json: true, maxTokens: 700, temperature: 0 });
  const items = X.addMissedPayments(X.parseItems(r.text, byIndex, people), msgs, people);   // as chatxray-ui.jsx does
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

// ---- Travel: the app's own prompt + country pack (Turkey), asked like a traveller ----
if (want("travel")) {
  const T = APP.travel();
  const q = "I just landed at Istanbul airport. How do I get to Taksim and how much should it cost? The taxi driver says his meter is broken.";
  const prompt = await T.ask(q, "tr", "en", T.packs);
  let r = await llm([{ role: "user", content: prompt }], { maxTokens: 600 });
  section("Travel · Istanbul airport (Turkey pack)", q, r, undefined,
    [[/M11|Havaist|metro/i.test(r.text), "points to the metro / Havaist (from the pack)"], [/meter|taksimetre|get out|another taxi/i.test(r.text), "the broken-meter trick is flagged"], [!/\+90\s?\d{3}\s?\d{3}/.test(r.text), "no invented phone numbers"]]);
  const qa = "انا في دبي، ينفع اشرب من الحنفية؟ وبكام التاكسي تقريباً؟";
  r = await llm([{ role: "user", content: await T.ask(qa, "ae", "ar", T.packs) }], { maxTokens: 500 });
  section("Travel · Dubai in Arabic (UAE pack)", qa, r, undefined, [[(r.text.match(/[\u0600-\u06FF]/g) || []).length > 80, "answers in Arabic"], [/مياه|الحنفية|ماء/.test(r.text), "answers the water question"], [/تاكس|درهم|AED/.test(r.text), "answers the taxi question"]]);
}

// ---- Daily news: a digest from given articles only, with sources ----
if (want("news")) {
  const items = [
    { title: "Egypt's central bank holds interest rates at 22%", source: "Reuters", date: "2026-09-27T10:00:00Z", text: "The Central Bank of Egypt kept its overnight deposit rate at 22% on Thursday, citing inflation that eased to 11.2% in August. The next meeting is on 20 November." },
    { title: "Pound steady at 48.6 per dollar", source: "Ahram Online", date: "2026-09-27T14:00:00Z", text: "The Egyptian pound traded at 48.6 to the US dollar in official banks on Sunday, unchanged for the week." },
    { title: "Liverpool beat Chelsea 2-1", source: "BBC", date: "2026-09-27T20:00:00Z", text: "Mohamed Salah scored the winner in the 88th minute." },
  ];
  const t = { query: "Egypt economy", lang: "en" };
  let r = await llm(D.digestMessages(t, items, { now: Date.parse("2026-09-28") }), { maxTokens: 700, temperature: 0.2 });
  const cc = D.checkCitations(r.text, items.length);
  section("Daily news · digest (Egypt economy)", "3 articles, one off-topic", r, cc,
    [[/22\s?%/.test(r.text) && /48\.6/.test(r.text), "the facts from the articles"], [cc.removed === 0 && cc.unsourced === 0, "every bullet cites a real source"], [!/Salah|Liverpool/.test(r.text), "skips the football article"], [/20 November|November 20|Coming up/i.test(r.text), "the next meeting (20 November) is mentioned"]]);
}

// ---- File converter: translate a document's lines (numbers kept) ----
if (want("translate")) {
  const texts = ["Invoice no. INV-2026-0142 — due 15/10/2026", "Crane rental (Liebherr LTM 1100) 3 days × 12,500 EGP = 37,500 EGP", "Payment by bank transfer to CIB account 1002003004"];
  let r = await llm(CV.translateMessages(texts, "Arabic"), { maxTokens: 500, temperature: 0.2 });
  const tr = CV.parseTranslated(r.text, texts.length);
  section("File converter · translate to Arabic", texts.join(" | "), r, tr,
    [[tr.every((x) => x && /[\u0600-\u06FF]/.test(x)), "all 3 lines translated"], [tr[0] && tr[0].includes("INV-2026-0142") && tr[1] && /12,?500/.test(tr[1]) && /37,?500/.test(tr[1]), "codes and amounts kept exactly"], [tr[1] && /LTM 1100/.test(tr[1]) && tr[2] && /1002003004/.test(tr[2]), "model names and account numbers kept"]]);
}

// ---- Instant actions: Egyptian reminders → a real phone action ----
if (want("action")) {
  const now = new Date("2026-09-28T10:00:00");
  for (const [req, kind, hour] of [["فكرني بكرة الساعة 9 الصبح اكلم المهندس حسن", "reminder", 9], ["remind me on Thursday at 7 pm to send the invoice to Hassan", "reminder", 19], ["ابعت لحسن واتساب اني هتأخر نص ساعة", "whatsapp", null]]) {
    let r = await llm(A.actionMessages(req, now), { json: true, maxTokens: 300, temperature: 0 });
    let j = null; try { j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); } catch (e) {}
    const a = A.buildAction(j, req, now.getTime());
    const at = a && a.at ? new Date(a.at) : null;
    section(`Instant action · ${kind}`, req, r, a && { kind: a.kind, title: a.title, at: at && at.toString().slice(0, 21), contact: a.contact, message: a.message },
      [[a && a.kind === kind, `read as a ${kind}`], [hour == null || (at && at.getHours() === hour && at > now), hour == null ? "no time needed" : `at ${hour}:00, in the future`], [kind !== "whatsapp" || (a.contact && /حسن|hassan/i.test(a.contact) && a.message), "who to send to, and the message"]]);
  }
}

// ---- Prompts for other AIs: rewrite a rough idea into a prompt for ChatGPT (never answer it) ----
if (want("prompts")) {
  const P = APP.prompts();
  const rough = "اكتبلي خطة تسويق لشركة تأجير ونش في مصر ميزانيتها 50 الف جنيه في الشهر";
  let r = await llm([{ role: "user", content: await P.rewrite({ tool: "chatgpt", input: rough, lang: "match", tone: "Auto", audience: "General" }) }], { maxTokens: 600 });
  const ar = (r.text.match(/[\u0600-\u06FF]/g) || []).length / Math.max(1, r.text.replace(/\s/g, "").length);
  section("Prompts for other AIs · rewrite for ChatGPT", rough, r, undefined,
    [[!/^(الخطة|خطة التسويق|## )/m.test(r.text.trim()) && !/الشهر الأول|Month 1|الأسبوع الأول/i.test(r.text), "a prompt, not the plan itself"], [/50|خمسين/.test(r.text) && /ونش|ونش|crane|رافع/i.test(r.text), "keeps the budget and the business"], [ar > 0.5, "stays in Arabic like the draft"]]);
}

// ---- Instant "Go": work out the job from pasted text ----
if (want("instant")) {
  const P = APP.prompts();
  const msg = "يا باشمهندس، محتاجين الونش ال100 طن يوم السبت الساعة 6 الصبح في موقع التجمع الخامس، ياريت تأكدلي السعر النهارده عشان نحجز";
  let r = await llm([{ role: "user", content: await P.smart(msg, "message", "match") }], { maxTokens: 500 });
  section("Instant · Go on a pasted client message", msg, r, undefined,
    [[/السبت/.test(r.text) && /100/.test(r.text), "what they want (100 t crane, Saturday)"], [/السعر|سعر/.test(r.text), "that they want the price today"], [(r.text.match(/[\u0600-\u06FF]/g) || []).length > 60, "in Arabic, like the message"]]);
}

// ---- Website / artifacts: a page from one sentence ----
if (want("website")) {
  const task = "A one-page website for Aldibiki Cranes: 25 to 500 ton mobile cranes for rent in Egypt, a fleet table, and a WhatsApp booking button";
  let r = await llm(C.writeMessages(task, "html"), { maxTokens: 3000, temperature: 0.4 });
  const html = (C.pickProgram ? C.pickProgram(r.text, "html") : r.text) || r.text;
  let h = typeof html === "string" ? html : (html && html.code) || r.text;
  // a page cut at the length limit is continued until </html>, as the app does (code.js continueMessages)
  for (let k = 0; k < 3 && C.isCutHtml(h); k++) { const more = await llm(C.continueMessages(task, h.slice(-1500)), { maxTokens: 2000, temperature: 0.3 }); h = C.joinCont(h, more.text); r = { ...r, secs: r.secs + more.secs, tokens: r.tokens + more.tokens }; }
  section("Website · page from one sentence", task, r, { chars: h.length, cut: C.isCutHtml(h), end: h.slice(-700) },
    [[/<html|<!doctype/i.test(h) && /<\/html>/i.test(h), "a complete page (<html> … </html>)"], [/Aldibiki/i.test(h), "about the company asked for"], [/<table/i.test(h), "the fleet table"], [/wa\.me|whatsapp/i.test(h), "the WhatsApp button"]]);
}

// ---- Assistants: the built-in ones, with their own instructions ----
if (want("assistants")) {
  const B = SP.BUILTIN_ASSISTANTS;
  const crane = B.find((a) => a.id === "a-crane"), acc = B.find((a) => a.id === "a-accountant");
  let r = await llm([{ role: "system", content: SP.spaceBlock({ assistant: crane, question: "outriggers" }) }, { role: "user", content: "What do outriggers do and what must I check before a lift?" }], { maxTokens: 1000 });
  section("Assistant · Crane expert", "outriggers + pre-lift checks", r, undefined,
    [[/رجل|أرجل|ارجل|المثبت|التثبيت/.test(r.text), "the term in Egyptian Arabic too"], [(r.text.match(/[a-z]/gi) || []).length > (r.text.match(/[\u0600-\u06FF]/g) || []).length, "answers in English, like the question"], [/ground|soil|pad|mat|تربة|الأرض/i.test(r.text), "ground bearing / pads checked"], [/level|مستوى|ميزان/i.test(r.text), "the crane must be level"]]);
  // the model alone (what the assistant's own words do) …
  const qa = "فاتورة 3 ونش × 4 أيام × 12,500 جنيه، زائد ضريبة القيمة المضافة. الإجمالي كام؟";
  r = await llm([{ role: "system", content: SP.spaceBlock({ assistant: acc, question: qa }) }, { role: "user", content: qa }], { maxTokens: 900, temperature: 0.1 });
  section("Assistant · Accountant (Egypt), the model alone", "3 × 4 × 12,500 + 14% VAT", r, undefined,
    [[/150[,٬]?000/.test(r.text), "subtotal 150,000"], [/21[,٬]?000/.test(r.text), "VAT 14% = 21,000"], [/171[,٬]?000/.test(r.text), "total 171,000"], [!/احتكار|monopoly/i.test(r.text), "no invented taxes"]]);
  // … and what the chat really shows: a money sum goes through the maths checker (chat.jsx → verifyMath)
  if (V.looksLikeMathProblem(qa)) {
    r = await llm(V.solveMessages(qa), { maxTokens: 700 });
    const code = (r.text.match(/```(?:python)?\n([\s\S]*?)```/) || [])[1] || "";
    let printed = ""; try { printed = (await import("child_process")).execFileSync("python3", ["-c", code], { timeout: 20000 }).toString(); } catch (e) { printed = String(e.stdout || e.message); }
    section("Assistant · Accountant (Egypt), as the chat answers it (maths checker)", qa, r, { printed: printed.trim() }, [[/ANSWER:\s*171,?000/.test(printed), "the checked total: 171,000 EGP"]]);
  }
}

// ---- Memory: answers from the person's own saved records, and "I don't have it" when they don't ----
if (want("memory")) {
  const M = APP.memory();
  const rec = (ts, title, text) => ({ rec: { ts: Date.parse(ts), title, text, output: "" } });
  const found = [rec("2026-08-03", "Liebherr LTM 1100 service", "Service done by Karim at 11,980 hours: engine oil, filters, slewing ring greased. Next oil change due at 12,500 hours. Hydraulic hose on outrigger 3 is worn — replace before October."),
    rec("2026-09-10", "Client call — Hassan (Orascom site)", "Hassan wants the 100 t crane for 5 days from 1 October, rate agreed 13,000 EGP a day.")];
  let r = await llm([{ role: "user", content: await M.ask("When is the next oil change on the Liebherr, and what else must be fixed on it?", found, [], "en") }], { maxTokens: 400 });
  section("Memory · answer from my records", "next oil change + what to fix", r, undefined,
    [[/12,?500/.test(r.text), "12,500 hours (from the record)"], [/hose|outrigger 3/i.test(r.text), "the worn hose on outrigger 3"], [/3 Aug|August 3|2026-08-03|your (note|record)|service note/i.test(r.text), "says which record it used"]]);
  r = await llm([{ role: "user", content: await M.ask("What is Hassan's national ID number?", found, [], "en") }], { maxTokens: 200 });
  section("Memory · something I never saved", "Hassan's national ID", r, undefined,
    [[!/\d{14}|\d{8,}/.test(r.text), "no invented number"], [/don't have|do not have|no record|not in your|isn't in|not saved|can't find|cannot find/i.test(r.text), "says plainly it doesn't have it"]]);
}

// ---- Projects: a project's files answer the question, with the file named ----
if (want("projects")) {
  const project = { name: "Orascom tower job", instructions: "Answer for the site team. Be exact with numbers.", knowledge: [
    { name: "lift-plan.txt", text: "Lift plan LP-07. Crane: Liebherr LTM 1100-4.2, 60 t counterweight, outriggers fully extended (7.3 x 7.3 m). Heaviest pick: HVAC unit 8.6 t at 22 m radius. Chart capacity at 22 m with 40.4 m boom: 13.1 t. Utilisation 66 %. Wind limit for this lift: 9 m/s." },
    { name: "site-rules.txt", text: "Site hours 7:00-17:00. No lifts when wind exceeds the lift plan limit. Banksman: Mahmoud (radio channel 4)." }] };
  const q = "What's the wind limit for the HVAC lift, and how close to the chart capacity are we?";
  let r = await llm([{ role: "system", content: SP.spaceBlock({ project, question: q }) }, { role: "user", content: q }], { maxTokens: 400 });
  section("Projects · answer from the project's files", q, r, undefined,
    [[/9 ?m\/s/.test(r.text), "wind limit 9 m/s"], [/66 ?%|8\.6.*13\.1|13\.1/.test(r.text), "8.6 t of 13.1 t (66 %)"], [/lift-plan/i.test(r.text), "names the file it used"]]);
}

// ---- Mind: the model files a kept item (title, one line, tags) in its own language ----
if (want("mind")) {
  for (const [text, lang, must] of [
    ["كلمت حسن من أوراسكوم، عايز الونش ال100 طن 5 أيام من أول أكتوبر، اتفقنا على 13 ألف في اليوم", "ar", /اوراسكوم|أوراسكوم|حسن|ونش/],
    ["https://www.liebherr.com/en/int/products/mobile-and-crawler-cranes/mobile-cranes/ltm-mobile-cranes/details/ltm1100-4.2.html", "en", /liebherr|ltm/i],
    ["Anker 737 power bank 24,000 mAh — 3,450 EGP on Amazon, cheaper than B.Tech", "en", /anker|power bank/i]]) {
    const r = await llm(MI.tagMessages({ text }), { json: true, maxTokens: 220, temperature: 0.2 });
    const t = MI.parseTagReply(r.text);
    const arOut = t && /[\u0600-\u06FF]/.test(t.title + t.tags.join(""));
    section(`Mind · filing (${lang})`, text, r, t,
      [[t && t.title && t.tags.length >= 3, "a title and 3+ tags"], [t && must.test(t.title + " " + t.tags.join(" ")), "tagged by what it's really about"], [t && (lang === "ar" ? arOut : !arOut), "in the item's language"], [t && t.summary && t.summary.length < 200, "one short summary line"]]);
  }
}

const ok = checks.filter((c) => c[1]).length;
out.splice(1, 0, `**Automatic checks: ${ok}/${checks.length}.** The raw answers below are for reading.\n`);
fs.writeFileSync(new URL(process.env.TRIAL_REPORT || "./report.md", import.meta.url), out.join("\n"));
console.log(`\nCHECKS ${ok}/${checks.length}`);
