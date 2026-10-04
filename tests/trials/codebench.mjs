// Code bench (v6.12): Ali — "I want the coding to be right and fast". Real correctness, not just "its own tests pass":
// the finished program is also run against HIDDEN tests the model never saw. Measures right/wrong, fix rounds, tokens written and seconds.
//   TRIAL_PORT=8096 MODEL_NAME=x node tests/trials/codebench.mjs [task numbers, comma list]
import fs from "fs";
import http from "http";
import { spawnSync } from "child_process";
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const C = await import("../../web-src/code.js");
const PORT = process.env.TRIAL_PORT || 8099;
const pick = (process.argv[2] || "").split(",").filter(Boolean).map(Number);
const post = (body) => new Promise((ok, bad) => { const req = http.request({ host: "127.0.0.1", port: PORT, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (res) => { let d = ""; res.setEncoding("utf8"); res.on("data", (x) => (d += x)); res.on("end", () => { try { ok(JSON.parse(d)); } catch (e) { ok({ error: d.slice(0, 300) }); } }); }); req.on("error", bad); req.setTimeout(0); req.end(JSON.stringify(body)); });
let tokens = 0;
const THINK = !!process.env.CODE_THINK;
// CODE_PLAN=0 / 1 / auto: plan-first off, always, or the app default (only for multi-function / multi-rule requests)
const PLAN = process.env.CODE_PLAN == null || process.env.CODE_PLAN === "" ? C.PLAN_DEFAULT : process.env.CODE_PLAN === "0" ? false : process.env.CODE_PLAN === "1" ? true : process.env.CODE_PLAN;
async function llm(messages, maxTokens) {
  const j = await post({ messages, max_tokens: THINK ? maxTokens * 4 : maxTokens, temperature: 0.2, stream: false, chat_template_kwargs: { enable_thinking: THINK } });
  const tm = j.timings || {}; tokens += tm.predicted_n || 0;
  return String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").replace(/<think>[\s\S]*?<\/think>/g, "");
}
const JS_PRELUDE = 'const assert=(c,m)=>{if(!c)throw new Error("AssertionError"+(m?": "+m:""))};const assertEqual=(a,b,m)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error("expected "+JSON.stringify(b)+", got "+JSON.stringify(a)+(m?" — "+m:""))};';
const run = async (lang, code) => {
  const r = lang === "python" ? spawnSync("python3", ["-c", code], { timeout: 20000, encoding: "utf8" }) : spawnSync("node", ["-e", JS_PRELUDE + "(async()=>{\n" + code + "\n})().catch((e)=>{console.error(String(e&&e.stack||e));process.exit(1)})"], { timeout: 20000, encoding: "utf8" });
  return { ok: r.status === 0, stdout: r.stdout || "", stderr: r.stderr || "", error: r.status === 0 ? "" : (r.stderr || "").split("\n").slice(-8).join("\n"), timedOut: !!(r.error && /ETIMEDOUT/.test(String(r.error.code))) };
};
const TASKS = [
  ["python", "A function vat(amount, rate=0.14) that returns the total including VAT, rounded to 2 decimals, and raises ValueError for a negative amount; with tests", "assert vat(100)==114.0 and vat(19.99)==22.79 and vat(0)==0 and vat(200,0.05)==210.0\ntry:\n    vat(-1); raise SystemExit('no error')\nexcept ValueError: pass"],
  ["javascript", "A function daysBetween(a, b) that takes two 'YYYY-MM-DD' strings and returns the whole number of days from a to b (b later than a); with tests", "assertEqual(daysBetween('2024-02-28','2024-03-01'),2);assertEqual(daysBetween('2023-02-28','2023-03-01'),1);assertEqual(daysBetween('2024-01-01','2024-01-01'),0);assertEqual(daysBetween('2023-12-31','2024-01-01'),1);assertEqual(daysBetween('2020-01-01','2021-01-01'),366);"],
  ["python", "اكتب دالة بايثون اسمها monthly_payment(principal, annual_rate_percent, months) تحسب القسط الشهري لقرض (قانون القسط الثابت) وتقرّبه لرقمين عشريين، وإذا كانت الفايدة صفر يكون القسط المبلغ ÷ عدد الشهور؛ مع اختبارات", "assert abs(monthly_payment(10000,12,12)-888.49)<0.011\nassert abs(monthly_payment(1200,0,12)-100)<0.011\nassert abs(monthly_payment(250000,6,360)-1498.88)<0.011"],
  ["python", "A function slugify(text) that lowercases, replaces every run of non-alphanumeric ASCII characters with a single hyphen, and strips hyphens from both ends; with tests", "assert slugify('Hello, World!')=='hello-world' and slugify('  Crane   50 t -- Liebherr ')=='crane-50-t-liebherr' and slugify('---')=='' and slugify('a_b c')=='a-b-c'"],
  ["python", "Two functions roman_to_int(s) and int_to_roman(n) for numbers 1 to 3999 (subtractive notation); with tests", "assert roman_to_int('MCMXCIV')==1994 and roman_to_int('IV')==4 and roman_to_int('XLII')==42 and int_to_roman(1994)=='MCMXCIV' and int_to_roman(3999)=='MMMCMXCIX' and int_to_roman(4)=='IV'\nassert all(roman_to_int(int_to_roman(n))==n for n in range(1,4000))"],
  ["javascript", "A function groupAnagrams(words) that returns an array of groups (arrays) of words that are anagrams of each other; sort the words inside each group alphabetically and sort the groups by their first word; with tests", "assertEqual(groupAnagrams(['eat','tea','tan','ate','nat','bat']),[['ate','eat','tea'],['bat'],['nat','tan']]);assertEqual(groupAnagrams([]),[]);assertEqual(groupAnagrams(['a']),[['a']]);"],
  ["python", "A function parse_duration(s) that turns strings like '1h30m15s', '90s', '2h', '45m' into the total number of seconds (an int); raise ValueError for an empty or invalid string; with tests", "assert parse_duration('1h30m15s')==5415 and parse_duration('90s')==90 and parse_duration('2h')==7200 and parse_duration('45m')==2700\nfor bad in ['', 'abc', '5x']:\n    try:\n        parse_duration(bad); raise SystemExit('no error for '+repr(bad))\n    except ValueError: pass"],
  ["python", "A function flatten_dict(d) that flattens a nested dictionary into one level, joining keys with '.' (e.g. {'a': {'b': 1}} becomes {'a.b': 1}); with tests", "assert flatten_dict({'a':{'b':1,'c':{'d':2}},'e':3})=={'a.b':1,'a.c.d':2,'e':3} and flatten_dict({})=={} and flatten_dict({'x':{}})=={}"],
  ["javascript", "A function chunk(arr, size) that splits an array into arrays of at most `size` items; throw an Error when size is less than 1; with tests", "assertEqual(chunk([1,2,3,4,5],2),[[1,2],[3,4],[5]]);assertEqual(chunk([],3),[]);assertEqual(chunk([1,2],5),[[1,2]]);let t=false;try{chunk([1],0)}catch(e){t=true};assert(t,'size 0 must throw');"],
  ["python", "اكتب دالة بايثون اسمها median(numbers) تحسب الوسيط لقائمة أرقام (لو العدد زوجي يكون متوسط الرقمين اللي في النص) وترفع ValueError لو القائمة فاضية؛ مع اختبارات", "assert median([3,1,2])==2 and median([4,1,3,2])==2.5 and median([5])==5 and median([-1,-3])==-2\ntry:\n    median([]); raise SystemExit('no error')\nexcept ValueError: pass"],
];
// v6.15 review tasks (11–16): a pasted function with a known bug → the app must find and fix it; hidden tests check the fix.
const REVIEW = [
  ["python", "Find the bug in this function and fix it:\n```python\ndef average(xs):\n    total = 0\n    for i in range(1, len(xs)):\n        total += xs[i]\n    return total / len(xs)\n```", "assert average([1,2,3])==2 and average([5])==5 and average([2,4])==3"],
  ["javascript", "Review this code:\n```javascript\nfunction maxOf(arr) {\n  let m = 0;\n  for (const x of arr) if (x > m) m = x;\n  return m;\n}\n```", "assertEqual(maxOf([-3,-1,-2]),-1);assertEqual(maxOf([1,5,2]),5);assertEqual(maxOf([7]),7);"],
  ["python", "find bugs\n```python\ndef add_item(item, items=[]):\n    items.append(item)\n    return items\n```", "assert add_item(1)==[1]\nassert add_item(2)==[2]\nassert add_item(3,[1])==[1,3]"],
  ["python", "راجع الكود ده وصلّح الغلط\n```python\ndef is_leap(y):\n    return y % 4 == 0 and y % 100 != 0\n```", "assert is_leap(2000) and not is_leap(1900) and is_leap(2024) and not is_leap(2023)"],
  ["javascript", "What's wrong with this binary search? Fix it.\n```javascript\nfunction binarySearch(a, t) {\n  let lo = 0, hi = a.length;\n  while (lo < hi) {\n    const mid = Math.floor((lo + hi) / 2);\n    if (a[mid] === t) return mid;\n    if (a[mid] < t) lo = mid;\n    else hi = mid;\n  }\n  return -1;\n}\n```", "assertEqual(binarySearch([1,3,5,7],7),3);assertEqual(binarySearch([1,3,5,7],1),0);assertEqual(binarySearch([1,3],4),-1);assertEqual(binarySearch([],1),-1);assertEqual(binarySearch([1,3,5],2),-1);"],
  ["python", "Refactor this and find the bug:\n```python\ndef apply_discount(price, percent):\n    if percent > 100:\n        raise ValueError(\"bad percent\")\n    return round(price - price * percent, 2)\n```", "assert apply_discount(200,10)==180.0 and apply_discount(99.99,0)==99.99 and apply_discount(50,100)==0\ntry:\n    apply_discount(10,150); raise SystemExit('no error')\nexcept ValueError: pass"],
];
const rows = [];
for (let i = 0; i < TASKS.length; i++) {
  if (pick.length && !pick.includes(i + 1)) continue;
  const [lang, task, hidden] = TASKS[i];
  tokens = 0; const t0 = Date.now(); let rounds = 0, ownOk = false, hid = false, err = "";
  try {
    const res = await C.workLoop({ task, lang, run, maxRounds: 4, plan: PLAN, llm: (m, o) => llm(m, (o && o.maxTokens) || 1000) });
    rounds = res.rounds; ownOk = res.ok;
    const marker = lang === "python" ? "# --- tests ---" : "// --- tests ---";
    const prog = res.code.includes(marker) ? res.code.split(marker)[0] : res.code;
    const h = await run(lang, prog + "\n" + hidden);
    hid = h.ok; if (!h.ok) err = (h.stderr || "").split("\n").slice(-3).join(" | ").slice(0, 200);
  } catch (e) { err = String(e && e.message || e); }
  const secs = Math.round((Date.now() - t0) / 1000);
  rows.push({ n: i + 1, lang, ownOk, hid, rounds, tokens, secs, err });
  console.log(`#${i + 1} ${lang} ${task.slice(0, 40)} → hidden ${hid ? "PASS" : "FAIL"} · own ${ownOk ? "ok" : "no"} · rounds ${rounds} · ${tokens} tok · ${secs}s${hid ? "" : " · " + err}`);
}
for (let j = 0; j < REVIEW.length && C.reviewCode; j++) {
  const n = 11 + j;
  if (pick.length && !pick.includes(n)) continue;
  const [lang, text, hidden] = REVIEW[j];
  tokens = 0; const t0 = Date.now(); let hid = false, err = "", proven = false, rounds = 0, ownOk = false;
  try {
    const r = await C.reviewCode({ text, run, llm: (m, o) => llm(m, (o && o.maxTokens) || 1000) });
    proven = !!r.proven; ownOk = !!(r.ran && r.ran.after.ok); rounds = r.rounds || 0;
    const h = await run(lang, r.fixed + "\n" + hidden);
    hid = h.ok; if (!h.ok) err = (h.stderr || "").split("\n").slice(-3).join(" | ").slice(0, 200);
  } catch (e) { err = String(e && e.message || e); }
  const secs = Math.round((Date.now() - t0) / 1000);
  rows.push({ n, lang, ownOk, hid, rounds, tokens, secs, err, review: true, proven });
  console.log(`#${n} review ${lang} → hidden ${hid ? "PASS" : "FAIL"} · proven ${proven ? "yes" : "no"} · rounds ${rounds} · ${tokens} tok · ${secs}s${hid ? "" : " · " + err}`);
}
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const W = rows.filter((r) => !r.review), RV = rows.filter((r) => r.review);
if (RV.length) console.log(`REVIEW hidden ${RV.filter((r) => r.hid).length}/${RV.length} · proven ${RV.filter((r) => r.proven).length} · tokens ${RV.reduce((a, r) => a + r.tokens, 0)} · ${RV.reduce((a, r) => a + r.secs, 0)}s`);
console.log(`\nCODEBENCH ${process.env.MODEL_NAME || ""} hidden ${W.filter((r) => r.hid).length}/${W.length} · rounds ${W.reduce((a, r) => a + r.rounds, 0)} · tokens ${W.reduce((a, r) => a + r.tokens, 0)} · ${W.reduce((a, r) => a + r.secs, 0)}s`);
fs.writeFileSync(process.env.CODE_REPORT || "/tmp/codebench.json", JSON.stringify(rows, null, 1));
