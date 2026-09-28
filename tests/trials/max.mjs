// v6.8 — Ali: "test all the models to the max in everything". The deeper set, run after run.mjs:
// many cases per tool (Arabic, Egyptian and English; easy and tricky), the photo reader on real
// pictures (a printed receipt, an Arabic site note), and the model's speed. Same rules as run.mjs:
// the app's own prompt builders and parsers, checks by code, raw answers in the report.
//   TRIAL_REPORT=./max-<name>.md MMPROJ=… bash tests/trials/run.sh model.gguf   (run.sh calls this when TRIAL_MAX=1)
import fs from "fs";
import http from "http";
import { execFileSync } from "child_process";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const D = await import("../../web-src/daily.js");
const E = await import("../../web-src/erp.js");
const DL = await import("../../web-src/deal.js");
const X = await import("../../web-src/chatxray.js");
const V = await import("../../web-src/verify.js");
const F = await import("../../web-src/fit.js");
const R = await import("../../web-src/fitread.js");
const C = await import("../../web-src/code.js");
const CV = await import("../../web-src/convert.js");
const A = await import("../../web-src/actions.js");
const SP = await import("../../web-src/spaces.js");
const MI = await import("../../web-src/mind.js");
const AF = await import("../../web-src/answerfix.js");
const APP = await import("./appsrc.mjs");
const PORT = process.env.TRIAL_PORT || 8099;
const only = process.argv[2] || "";
const want = (k) => !only || only.split(",").includes(k);
const REPORT = new URL(process.env.TRIAL_REPORT || "./max.md", import.meta.url);

function post(body) {
  return new Promise((ok, bad) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (res) => {
      let d = ""; res.setEncoding("utf8"); res.on("data", (x) => (d += x)); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ok({ error: d.slice(0, 300) }); } });
    });
    req.on("error", bad); req.setTimeout(0); req.end(JSON.stringify(body));
  });
}
let genTok = 0, genMs = 0, readTok = 0, readMs = 0;
async function llm(messages, { maxTokens = 700, temperature = 0.3, json = false } = {}) {
  const t0 = Date.now();
  const j = await post({ messages, max_tokens: maxTokens, temperature, stream: false, ...(json ? { response_format: { type: "json_object" } } : {}), chat_template_kwargs: { enable_thinking: false } });
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || JSON.stringify(j).slice(0, 300);
  const tm = j.timings || {};
  if (tm.predicted_n) { genTok += tm.predicted_n; genMs += tm.predicted_ms; }
  if (tm.prompt_n) { readTok += tm.prompt_n; readMs += tm.prompt_ms; }
  return { text, secs: Math.round((Date.now() - t0) / 100) / 10 };
}
const img = (file) => "data:image/png;base64," + fs.readFileSync(file).toString("base64");

const out = [`# Max trials — ${new Date().toISOString().slice(0, 16)} — ${process.env.MODEL_NAME || "model"}\n`];
const checks = [];
const byTool = {};
function section(tool, name, input, r, parsed, verdicts) {
  out.push(`## ${tool} · ${name}\n**Asked:** ${String(input).slice(0, 300)}\n\n**Time:** ${r.secs}s\n\n<details><summary>Raw answer</summary>\n\n\`\`\`\n${r.text.slice(0, 3000)}\n\`\`\`\n</details>\n`);
  if (parsed !== undefined) out.push("**What the app takes from it:**\n```json\n" + JSON.stringify(parsed, null, 1).slice(0, 1500) + "\n```\n");
  const t = (byTool[tool] ||= [0, 0]);
  for (const [ok, what] of verdicts) { checks.push([tool, name, !!ok, what]); t[1]++; if (ok) t[0]++; out.push(`- ${ok ? "✅" : "❌"} ${what}`); }
  out.push("");
  fs.writeFileSync(REPORT, out.join("\n"));
  console.log(`${tool} · ${name}: ${verdicts.filter((v) => v[0]).length}/${verdicts.length} · ${r.secs}s`);
}
const arShare = (s) => { const a = (String(s).match(/[؀-ۿ]/g) || []).length, l = (String(s).match(/[A-Za-z]/g) || []).length; return a / Math.max(1, a + l); };

// ================= Deal Check: 5 offers =================
if (want("deal")) {
  const cases = [
    ["هيونداي النترا 2020 فابريكا بالكامل، 850 ألف كاش أو مقدم 200 ألف و 36 قسط 25 ألف", { item: /النترا|elantra/i, cash: 850000, plan: [36, 25000], total: 1100000 }],
    ["iPhone 16 Pro Max 256GB new sealed, 72,000 EGP. Send 3,000 deposit on Vodafone Cash to reserve — only 2 left, offer ends tonight!", { item: /iphone/i, cash: 72000, signs: ["pay-first", "wallet", "urgent"] }],
    ["لابتوب Dell XPS 13 مستعمل سنة، 38 ألف جنيه، معاه الشاحن والكرتونة، المعاينة في مدينة نصر", { item: /dell|xps/i, cash: 38000, signs: [] }],
    ["شقة 120 متر في التجمع، 4.2 مليون، أو 10% مقدم والباقي على 7 سنين من غير فوايد", { item: /شق|apartment/i }],
    ["Samsung washing machine 9kg — 21,500 EGP or 12 months × 2,100 with 0% interest", { item: /samsung|washing|غسال/i, cash: 21500, plan: [12, 2100], total: 25200 }],
  ];
  for (const [offer, w] of cases) {
    const r = await llm(DL.extractMessages(offer, false), { json: true, maxTokens: 500, temperature: 0 });
    const t = DL.parseTerms(r.text) || {};
    const plan = DL.plansIn(offer)[0];
    const cost = plan && DL.planCost({ cash: w.cash, down: /مقدم 200/.test(offer) ? 200000 : 0, monthly: plan.monthly, months: plan.months });
    const signs = DL.scamSigns(offer).map((s) => s.id);
    const v = [[w.item.test(JSON.stringify(t)), "the item is read"]];
    if (w.cash) v.push([[t.price, t.cash_price].some((x) => x === w.cash), `the cash price ${w.cash.toLocaleString()} is read`]);
    if (w.plan) v.push([plan && plan.months === w.plan[0] && plan.monthly === w.plan[1], `code: the plan ${w.plan[0]} × ${w.plan[1].toLocaleString()} is found`]);
    if (w.total) v.push([cost && cost.total === w.total, `code: the plan really costs ${w.total.toLocaleString()}`]);
    if (w.signs) v.push([w.signs.every((s) => signs.includes(s)) && (w.signs.length || !signs.includes("pay-first")), w.signs.length ? "code: " + w.signs.join(", ") + " flagged" : "code: no false scam alarm"]);
    section("Deal Check", offer.slice(0, 40), offer, r, { terms: t, plan, cost, signs }, v);
  }
}

// ================= Chat X-Ray: 3 chats =================
if (want("xray")) {
  const chats = [
    [`01/09/2026, 09:00 - Ali: Karim, the 25 ton crane for the Maadi job is 9,500 a day, 3 days
01/09/2026, 09:04 - Karim: ok, I'll send half now and half after the job
01/09/2026, 12:30 - Karim: sent 14,250 by InstaPay
05/09/2026, 18:00 - Karim: job done, can we settle on Sunday?
05/09/2026, 18:02 - Ali: sure, Sunday`, "Karim", 14250, "Karim still owes 14,250 (28,500 − 14,250)"],
    [`10/09/2026, 10:00 - Mostafa: يا علي انا سلفتك 5000 الشهر اللي فات فاكر؟
10/09/2026, 10:05 - Ali: ايوه طبعا، هرجعهملك أول الشهر
02/10/2026, 11:00 - Ali: حولتلك 3000 والباقي الأسبوع الجاي`, "Mostafa", -2000, "Ali still owes Mostafa 2,000 (borrowed 5,000, paid back 3,000)"],
    [`15/09/2026, 08:00 - Ali: صباح الخير يا حج، الفاتورة رقم 118 بتاعة الونش 70 طن: 42,000 جنيه
15/09/2026, 09:10 - Hag Sayed: تمام يا باشمهندس، هبعت 20 ألف بكرة
16/09/2026, 14:00 - Hag Sayed: بعتلك 20,000 كاش مع السواق
16/09/2026, 14:30 - Ali: وصلوا الحمد لله، فاضل 22,000
20/09/2026, 10:00 - Hag Sayed: هتيجي الموقع يوم السبت؟
20/09/2026, 10:05 - Ali: ان شاء الله السبت الساعة 9`, "Hag Sayed", 22000, "Hag Sayed still owes 22,000 (42,000 − 20,000)"],
  ];
  for (const [chat, who, net, what] of chats) {
    const ex = X.parseExport(chat);
    const byIndex = new Map(ex.messages.map((m) => [m.i, m]));
    const chunk = X.chunksOf(X.candidates(ex.messages))[0] || "";
    const r = await llm(X.extractMessages(chunk, "Ali", ex.people, new Date("2026-10-05")), { json: true, maxTokens: 800, temperature: 0 });
    const items = X.addMissedPayments(X.parseItems(r.text, byIndex, ex.people), ex.messages, ex.people);
    const led = X.ledgerOf(items, "Ali");
    section("Chat X-Ray", who, chat.split("\n")[0], r, { items: items.map((x) => [x.type, x.from, x.to, x.amount]), ledger: led.map((x) => [x.person, x.net]) },
      [[led.some((x) => x.person === who && x.net === net), what], [items.some((x) => ["promise", "deadline", "order"].includes(x.type)), "the agreed day / promise is noticed"]]);
  }
}

// ================= Instant actions: 8 requests =================
if (want("action")) {
  const now = new Date("2026-09-28T10:00:00");   // a Monday
  const cases = [
    ["فكرني بكرة الساعة 9 الصبح اكلم المهندس حسن", "reminder", (d) => d.getDate() === 29 && d.getHours() === 9],
    ["صحيني الساعة 6 ونص", "alarm", (d) => d.getHours() === 6 && d.getMinutes() === 30],
    ["set a timer for 25 minutes", "timer", null, (a) => a.durationSec === 1500],
    ["اجتماع مع شركة أوراسكوم يوم الخميس الساعة 2 الضهر", "calendar", (d) => d.getDay() === 4 && d.getHours() === 14],
    ["ابعت لكريم واتساب قوله الونش هيتأخر ساعة", "whatsapp", null, (a) => /كريم|karim/i.test(a.contact || "") && !!a.message],
    ["call Hassan", "call", null, (a) => /hassan/i.test(a.contact || "")],
    ["remind me every day at 8 pm to check the site report", "reminder", (d) => d.getHours() === 20, (a) => a.repeat === "daily"],
    ["فكرني بعد ساعتين اشرب الدوا", "reminder", (d) => Math.abs(d - new Date(now.getTime() + 7200000)) < 120000],
  ];
  for (const [req, kind, timeOk, extra] of cases) {
    const r = await llm(A.actionMessages(req, now), { json: true, maxTokens: 300, temperature: 0 });
    let j = null; try { j = JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); } catch (e) {}
    const a = A.buildAction(j, req, now.getTime()) || {};
    const at = a.at ? new Date(a.at) : null;
    const v = [[a.kind === kind, `read as a ${kind}`]];
    if (timeOk) v.push([at && timeOk(at), "the right time"]);
    if (extra) v.push([extra(a), "the details (length / who / message / repeat)"]);
    section("Instant actions", req, req, r, { kind: a.kind, at: at && at.toString().slice(0, 21), contact: a.contact, message: a.message, repeat: a.repeat, sec: a.durationSec }, v);
  }
}

// ================= Fit: 5 meals =================
if (want("fit")) {
  const meals = [
    ["2 eggs, 2 slices of toast with butter and a cup of tea with 2 sugars", 400, 700],
    ["طبق كشري كبير", 600, 1100],
    ["ساندوتش فول وساندوتش طعمية وكوباية شاي بلبن", 500, 900],
    ["grilled chicken breast 200g with a cup of rice and salad", 500, 850],
    ["نص فرخة مشوية ورز وسلطة وكوباية بيبسي", 900, 1500],
  ];
  for (const [words, lo, hi] of meals) {
    const r = await llm(F.mealMessages(words, false), { json: true, maxTokens: 600 });
    const items = R.parseMealChecked(r.text);
    const kcal = items.reduce((n, x) => n + (x.kcal || 0), 0);
    section("Fit", words, words, r, { items: items.map((x) => [x.name, x.grams, x.kcal]), kcal },
      [[items.length >= Math.min(3, words.split(/,| and | و|with/).length), "every food found"], [kcal >= lo && kcal <= hi, `a believable total (${lo}–${hi} kcal): ${kcal}`], [items.every((x) => x.grams > 0 && x.grams <= 900), "believable portions"]]);
  }
}

// ================= Maths: 4 problems (the app runs the model's program) =================
if (want("math")) {
  const probs = [
    ["A crane rents for 12,500 EGP a day. 3 cranes for 4 days, plus 14% VAT. What is the total?", /171,?000/],
    ["محتاج أشتري 3 كاوتش بسعر 4,200 جنيه للواحد، وعليهم خصم 10%. هدفع كام؟", /11,?340/],
    ["A 50 t crane lifts at 75% of its chart capacity. The chart says 18.4 t at this radius. What is the maximum load I should plan for?", /13\.8/],
    ["I earn 32,000 EGP a month and save 15%. How many full months until I have 100,000 EGP saved?", /\b21\b/],
  ];
  for (const [q, want_] of probs) {
    let r = await llm(V.solveMessages(q), { maxTokens: 700 });
    const run = (code) => { try { return execFileSync("python3", ["-c", code], { timeout: 20000 }).toString(); } catch (e) { return "ERROR " + String(e.stderr || e.message).slice(-400); } };
    let code = (r.text.match(/```(?:python)?\n([\s\S]*?)```/) || [])[1] || "";
    let printed = run(code);
    if (/^ERROR/.test(printed) && V.fixSolveMessages) {   // the app sends the error back once
      const r2 = await llm(V.fixSolveMessages(q, code, printed), { maxTokens: 700 });
      code = (r2.text.match(/```(?:python)?\n([\s\S]*?)```/) || [])[1] || code; printed = run(code); r = { text: r.text + "\n\n--- fixed ---\n" + r2.text, secs: r.secs + r2.secs };
    }
    const ans = V.readAnswer ? V.readAnswer(printed) : printed;
    section("Maths", q.slice(0, 40), q, r, { printed: printed.trim().slice(-300) }, [[want_.test(String(ans || printed)), "the program's answer is right"]]);
  }
}

// ================= Travel: 4 countries, both languages =================
if (want("travel")) {
  const T = APP.travel();
  const cases = [
    ["sa", "ar", "انا رايح عمرة، ينفع أدخل مكة بفيزا سياحة؟ وازاي أروح من جدة لمكة؟", [/عمر|مكة/, /جدة|قطار|الحرمين|تاكس|باص/]],
    ["fr", "en", "Is tipping expected in Paris restaurants, and what's the emergency number?", [/112|15|17|18/, /service|tip|pourboire/i]],
    ["jp", "en", "I'm in Tokyo — can I pay with cash everywhere and how do I use the trains?", [/cash|yen|¥/i, /suica|pasmo|ic card|jr/i]],
    ["tr", "ar", "بكام التاكسي من المطار لتقسيم؟ والسواق بيقول العداد بايظ", [/عداد|تاكس/, /مترو|هافاش|havaist|M11|انزل|تاكسي تاني/i]],
  ];
  for (const [key, lang, q, rx] of cases) {
    const r = await llm([{ role: "user", content: await T.ask(q, key, lang, T.packs) }], { maxTokens: 500 });
    section("Travel", key + " " + lang, q, r, undefined, [[rx[0].test(r.text), "answers the first question (from the pack)"], [rx[1].test(r.text), "answers the second question"], [lang !== "ar" || arShare(r.text) > 0.6, "in Arabic when asked in Arabic"], [!/\+\d{2,3}\s?\d{3,}\s?\d{3,}/.test(r.text), "no invented phone numbers"]]);
  }
}

// ================= Business: 3 systems from a sentence =================
if (want("business")) {
  const cases = [
    ["عيادة أسنان: المرضى، المواعيد، الكشوفات والعلاجات، والفواتير والمدفوعات", [/patient|مرض/i, /appoint|موعد|مواعيد/i, /invoice|فاتور/i]],
    ["A car workshop: customers, cars with plate numbers, repair jobs with parts used and labour hours, invoices", [/customer/i, /car|vehicle/i, /job|repair/i]],
    ["محل موبايلات: المنتجات والمخزون، البيع اليومي، الموردين، والأقساط", [/product|منتج/i, /sale|بيع|مبيع/i, /supplier|مورد/i]],
  ];
  for (const [d, rx] of cases) {
    const r = await llm(E.designLinesMessages(d), { maxTokens: 900 });
    const spec = E.specFromLines(r.text, "System");
    const names = (spec.tables || []).map((t) => t.name).join(", ");
    section("Business", d.slice(0, 30), d, r, { tables: (spec.tables || []).map((t) => `${t.name}: ${(t.fields || []).map((f) => f.name).join(", ")}`) },
      [[(spec.tables || []).length >= 3, "3+ tables"], ...rx.map((x) => [x.test(names), "a table for " + x.source.split("|")[0].replace(/\\/g, "")]), [(spec.tables || []).every((t) => (t.fields || []).length >= 2), "every table has fields"]]);
  }
}

// ================= Coding: 3 languages =================
if (want("code")) {
  const cases = [
    ["python", "A function vat(amount, rate=0.14) returning the total with VAT rounded to 2 decimals, and refusing negative amounts; with tests", (c) => { try { return !/Error|Traceback|FAIL/.test(execFileSync("python3", ["-c", c], { timeout: 20000 }).toString()); } catch (e) { return false; } }],
    ["javascript", "A function daysBetween(a, b) that takes two 'YYYY-MM-DD' strings and returns the whole days between them; with tests using console.assert", (c) => { try { execFileSync("node", ["-e", c], { timeout: 20000 }); return true; } catch (e) { return false; } }],
    ["python", "اكتب دالة بايثون تحسب قسط شهري لقرض: المبلغ، الفايدة السنوية، عدد الشهور، مع اختبارات", (c) => { try { return !/Error|Traceback|FAIL/.test(execFileSync("python3", ["-c", c], { timeout: 20000 }).toString()); } catch (e) { return false; } }],
  ];
  for (const [lang, task, runs] of cases) {
    const r = await llm(C.writeMessages(task, lang), { maxTokens: 1000 });
    const p = C.pickProgram(r.text, lang);
    section("Coding", lang + " " + task.slice(0, 30), task, r, { chars: p && p.code.length }, [[p && p.code.length > 80, "a program"], [p && runs(p.code), "it runs and its own tests pass"]]);
  }
}

// ================= Translation both ways =================
if (want("translate")) {
  const cases = [
    [["عرض سعر: ونش 100 طن لمدة 5 أيام، 15,000 جنيه لليوم، شامل السواق والوقود", "الدفع: 50% مقدم والباقي عند التسليم"], "English", [/100 ?t/i, /15,?000/, /50 ?%/]],
    [["The crane must not operate in winds above 9.8 m/s.", "Outriggers fully extended on 1.2 m × 1.2 m mats."], "Arabic", [/9\.8/, /1\.2/]],
  ];
  for (const [texts, to, rx] of cases) {
    const r = await llm(CV.translateMessages(texts, to), { maxTokens: 500, temperature: 0.2 });
    const tr = CV.parseTranslated(r.text, texts.length);
    const all = tr.join(" ");
    section("Translate", "→ " + to, texts.join(" | "), r, tr, [[tr.every(Boolean), "every line translated"], [to === "Arabic" ? arShare(all) > 0.6 : arShare(all) < 0.1, "in " + to], ...rx.map((x) => [x.test(all), "keeps " + x.source.replace(/\\/g, "")])]);
  }
}

// ================= Instant "Go": 4 kinds of pasted text =================
if (want("instant")) {
  const P = APP.prompts();
  const cases = [
    ["TypeError: Cannot read properties of undefined (reading 'map')\n    at InvoiceList (InvoiceList.jsx:14:22)", "error", [/undefined|map|array|\?\./i]],
    ["Hi Ali, can you send the updated quote for the 200 t crane by Thursday? The client wants to start on the 12th. Thanks, Sarah", "message", [/quote|200/i, /thursday/i]],
    ["محتاجين الونش ال100 طن يوم السبت الساعة 6 الصبح في موقع التجمع، أكدلي السعر النهارده", "message", [/السبت|100/, /السعر/]],
    ["What does SWL mean on a crane?", "question", [/safe working load/i]],
  ];
  for (const [text, kind, rx] of cases) {
    let r = await llm([{ role: "user", content: await P.smart(text, kind, "match") }], { maxTokens: 500 });
    const should = AF.wrongLanguage(text, r.text);
    if (should) { const r2 = await llm([{ role: "user", content: await P.smart(text, kind, should) }], { maxTokens: 500 }); r = { text: r2.text, secs: r.secs + r2.secs }; }   // as the app does
    const ar = arShare(text) > 0.5;
    section("Instant", kind, text, r, undefined, [...rx.map((x) => [x.test(r.text), "the point: " + x.source.slice(0, 30)]), [ar ? arShare(r.text) > 0.5 : arShare(r.text) < 0.2, "in the message's language"]]);
  }
}

// ================= Mind: 6 items filed =================
if (want("mind")) {
  const items = [
    ["https://www.youtube.com/watch?v=abc — how to set up outriggers on a Liebherr LTM 1090", /outrigger|liebherr|ltm/i, false],
    ["«اللي ميعرفش يقول عدس» — مثل", /مثل|عدس/, true],
    ["رقم المهندس كريم بتاع الصيانة 01001234567", /كريم|صيان/, true],
    ["Idea: rent the 25 t crane by the hour for small jobs in New Cairo — 1,500 EGP/hour, min 4 hours", /crane|rent|hour/i, false],
    ["- [ ] renew the crane operator licences\n- [ ] book the 500 t for Orascom\n- [ ] pay the insurance", /licen|insur|orascom|task/i, false],
    ["وصفة كشري: رز، عدس، مكرونة، صلصة، بصل محمر وتقلية", /كشري|وصف|اكل|أكل/, true],
  ];
  for (const [text, rx, ar] of items) {
    const r = await llm(MI.tagMessages({ text }), { json: true, maxTokens: 250, temperature: 0.2 });
    const t = MI.parseTagReply(r.text);
    section("Mind", text.slice(0, 30), text, r, t, [[t && t.title && t.tags.length >= 3, "a title and 3+ tags"], [t && rx.test(t.title + " " + t.tags.join(" ") + " " + t.summary), "filed by what it's about"], [t && (ar ? arShare(t.title) > 0.5 : arShare(t.title) < 0.2), "in the item's language"]]);
  }
}

// ================= Assistants: Turkish tutor, Writer =================
if (want("assistants")) {
  const B = SP.BUILTIN_ASSISTANTS;
  const tut = B.find((a) => a.id === "a-turkish"), wr = B.find((a) => a.id === "a-writer");
  let r = await llm([{ role: "system", content: SP.spaceBlock({ assistant: tut, question: "x" }) }, { role: "user", content: "Correct this: Dün markete gidiyorum ve ekmek alıyorum." }], { maxTokens: 500 });
  section("Assistants", "Turkish tutor", "Dün markete gidiyorum ve ekmek alıyorum.", r, undefined, [[/gittim/i.test(r.text), "corrects the tense: gittim"], [/aldım/i.test(r.text), "corrects the tense: aldım"], [/\?/.test(r.text), "ends with a practice question"]]);
  r = await llm([{ role: "system", content: SP.spaceBlock({ assistant: wr, question: "x" }) }, { role: "user", content: "اكتب إيميل مهذب لعميل متأخر في دفع فاتورة 42 ألف جنيه بقالها شهرين" }], { maxTokens: 500 });
  section("Assistants", "Writer", "polite overdue-invoice email in Arabic", r, undefined, [[/42/.test(r.text), "keeps the amount"], [arShare(r.text) > 0.6, "in Arabic"], [r.text.length > 250, "a complete email"]]);
}

// ================= Photos: the model's photo reader on real pictures =================
if (want("photos") && process.env.MMPROJ) {
  const dir = new URL("./pics/", import.meta.url).pathname;
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("python3", ["-c", `
from PIL import Image, ImageDraw, ImageFont
f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
im = Image.new("RGB", (640, 420), "white"); d = ImageDraw.Draw(im)
y = 20
for line, font in [("B.TECH  -  Nasr City", b), ("Receipt 00481   28/09/2026", f), ("Anker 737 Power Bank      3,450.00", f), ("USB-C cable 1m              150.00", f), ("Subtotal                  3,600.00", f), ("VAT 14%                     504.00", f), ("TOTAL EGP                 4,104.00", b)]:
    d.text((24, y), line, fill="black", font=font); y += 54
im.save("${dir}receipt.png")
im = Image.new("RGB", (640, 300), (250, 248, 235)); d = ImageDraw.Draw(im)
fa = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 34)
y = 30
for line in ["ملاحظة الموقع", "الونش 70 طن يوصل السبت 7 الصبح", "الحساب 45000 جنيه", "المسؤول: م. كريم"]:
    d.text((600, y), line, fill="black", font=fa, anchor="ra", direction="rtl", language="ar"); y += 62
im.save("${dir}note.png")
`]);
  const cases = [
    ["receipt.png", "Read this receipt: the shop, each item with its price, and the total.", [/anker/i, /4,?104/, /504/]],
    ["note.png", "اقرا الملاحظة دي كلها بالظبط.", [/70/, /45,?000/, /كريم/]],
  ];
  for (const [file, ask, rx] of cases) {
    const r = await llm([{ role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: img(dir + file) } }] }], { maxTokens: 400, temperature: 0.1 });
    section("Photos", file, ask, r, undefined, rx.map((x) => [x.test(r.text), "reads " + x.source.replace(/\\/g, "")]));
  }
}

// ================= speed =================
const tps = genMs ? Math.round(genTok / genMs * 10000) / 10 : 0, rps = readMs ? Math.round(readTok / readMs * 10000) / 10 : 0;
const ok = checks.filter((c) => c[2]).length;
const table = Object.entries(byTool).map(([k, [a, b]]) => `| ${k} | ${a}/${b} |`).join("\n");
out.splice(1, 0, `**Automatic checks: ${ok}/${checks.length}.** Speed on this machine's CPU: writes ${tps} tokens/s, reads ${rps} tokens/s.\n\n| Tool | Checks |\n|---|---|\n${table}\n`);
fs.writeFileSync(REPORT, out.join("\n"));
console.log(`\nMAX ${ok}/${checks.length} · write ${tps} t/s · read ${rps} t/s`);
for (const [k, [a, b]] of Object.entries(byTool)) console.log(`  ${k}: ${a}/${b}`);
