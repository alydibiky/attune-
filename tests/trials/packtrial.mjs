// v6.16 (Ali: "do the knowledge packs actually make the answers more accurate or faster?") — the published packs, searched the
// way the phone searches them (packsearch.py = KnowPacks.kt), reranked and put in the prompt the way Chat does (knowledge.js),
// answered by a real model on llama-server; every question with and without the packs. Graded by code.
//   PACKS=<dir with <id>.sqlite> TRIAL_PORT=8130 [MODES=none,know] node tests/trials/packtrial.mjs > tests/trials/packtrial-<model>.md
import { spawn } from "child_process";
import * as K from "../../web-src/knowledge.js";
import { compactSystem, HONESTY_RULE, NO_CODE_RULE } from "../../web-src/boost.js";
const PORT = process.env.TRIAL_PORT || 8130, DIR = process.env.PACKS, MODES = (process.env.MODES || "none,know").split(",");
const SEARCH = process.env.SEARCH || new URL("./packsearch.py", import.meta.url).pathname;
export const QS = [
  ["What is the highest point in Egypt?", /Catherine|كاترين/i],
  ["How high is Mount Kilimanjaro in meters?", /5[,.]?89[05]/],
  ["What is the total area of Egypt?", /1[,.]?001[,.]?450/],
  ["What is the population of Japan according to the World Bank?", /123[.,]\d|123 million/],
  ["What is the inflation rate in Egypt?", /14[.,]1|28[.,]3/],
  ["What is the population of Alexandria, Egypt?", /5[,.]?26\d|5\.2\d? million/],
  ["What is Turkey's international calling code?", /\+?\s?90\b/],
  ["ما هي الآية التي فيها «الله لا إله إلا هو الحي القيوم»؟ اذكر السورة ورقم الآية", /البقرة|2:255|255|آل عمران|3:2/],
  ["ما تفسير قوله تعالى «إياك نعبد وإياك نستعين» في التفسير الميسر؟", /نخصك|وحدك بالعبادة|نستعين بك وحدك/],
  ["ما هي شروط الصلاة؟", /الوقت|الطهارة|ستر العورة|استقبال القبلة/],
  ["كم نصاب الذهب بالجرامات؟", /(70|٧٠|85|٨٥)\s?(جرام|غرام|g)/],
  ["What is the power in horsepower of the BYD Seal sold in Europe?", /308|523/],
  ["What is the combined fuel economy of the 2020 Toyota Camry?", /\b(26|29|32|34|39|41|44|46|52)\s?(mpg|MPG)/],
  ["What is anemia?", /red blood cell|hemoglobin|haemoglobin/i],
  ["What does OSHA require about ground conditions for crane assembly?", /ground condition|firm|drained|graded|supporting materials/i],
  ["How do I add an item to the end of a list in Python?", /append/],
  ["What does the JavaScript array map() method return?", /new array/i],
  ["كم ساعة يجوز تشغيل العامل في اليوم حسب قانون العمل المصري؟", /ثماني|8|ثمان/],
  ["What is Egypt's lowest point?", /Qattara|القطارة/i],
  ["What is the climate of Saudi Arabia?", /desert|dry|arid/i],
  ["كم ارتفاع جبل كاترين؟", /2[,.]?6[23]\d|٢[,.٬]?٦[٢٣]\d/],
  ["What is the capital of Kazakhstan according to GeoNames?", /Astana|Nur-Sultan|Nursultan/i],
  ["What is the GDP of Egypt?", /365|389/],
  ["What currency does Turkey use?", /lira|TRY/i],
];
const proc = spawn("python3", [SEARCH, DIR, "--serve"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "", waiting = [];
proc.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); waiting.shift()(JSON.parse(line)); } });
const phone = (q, k = 24) => new Promise((ok) => { waiting.push(ok); proc.stdin.write(JSON.stringify({ q, k }) + "\n"); });
let searchMs = 0;
const kn = K.createKnowledge(K.memoryStore());
kn.packSearch = async (q) => { const r = await phone(q); searchMs = r.ms; return r.passages.map((p) => ({ ...p, url: "" })); };
const system = compactSystem(new Date().toDateString()) + "\n\n" + HONESTY_RULE + "\n" + NO_CODE_RULE;
async function ask(user) {
  const t = Date.now();
  const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 220, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } }) });
  const j = await r.json();
  return { text: String(j.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim(), ms: Date.now() - t, prompt: j.usage?.prompt_tokens || 0 };
}
const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
const S = Object.fromEntries(MODES.map((m) => [m, { ok: 0, found: 0, ms: 0, prompt: 0, look: 0 }]));
const rows = [];
for (const [q, rx] of QS) {
  const row = { q };
  for (const m of MODES) {
    let user = q, look = 0, found = null;
    if (m !== "none") {
      const t = Date.now(); const hits = await kn.find(q); look = Date.now() - t;
      const blk = K.factsBlock(hits, q); found = rx.test(toLatin(blk)) || rx.test(blk); user = blk + q;
      if (found) S[m].found++;
    }
    const a = await ask(user);
    const good = rx.test(a.text) || rx.test(toLatin(a.text));
    Object.assign(S[m], { ok: S[m].ok + (good ? 1 : 0), ms: S[m].ms + a.ms + look, prompt: S[m].prompt + a.prompt, look: S[m].look + look });
    row[m] = { good, found, look, search: searchMs, ms: a.ms, prompt: a.prompt, text: a.text.replace(/\s+/g, " ").slice(0, 160) };
  }
  rows.push(row); process.stderr.write(".");
}
proc.stdin.end();
const n = QS.length;
console.log(`# Knowledge packs trial — ${process.env.MODEL_NAME || "model"}, ${n} questions\n`);
console.log("| mode | correct | right passage given | avg lookup | avg answer time | avg prompt tokens |\n|---|---|---|---|---|---|");
for (const m of MODES) console.log(`| ${m} | ${S[m].ok}/${n} | ${m === "none" ? "—" : S[m].found + "/" + n} | ${Math.round(S[m].look / n)} ms | ${(S[m].ms / n / 1000).toFixed(1)} s | ${Math.round(S[m].prompt / n)} |`);
console.log("\n| question | " + MODES.map((m) => m).join(" | ") + " |\n|---|" + MODES.map(() => "---").join("|") + "|");
for (const r of rows) console.log(`| ${r.q} | ` + MODES.map((m) => `${r[m].good ? "✅" : "❌"}${r[m].found === false ? " (not found)" : ""} ${r[m].text.replace(/\|/g, "/")}`).join(" | ") + " |");
