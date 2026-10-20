// v6.45 Recall phase 2 trial: the real bge-m3 model (through attune-embed.cpp built as a test tool) + meaning.js.
// Each question must find its thing by MEANING (other language, other words), with the word search alone missing it.
//   node tests/trials/meaning.mjs <embcli> <bge-m3-Q4_K_M.gguf>
import { spawnSync } from "child_process";
import * as M from "../../web-src/meaning.js";
import { recallSearch } from "../../web-src/lookback.js";
const [cli, model] = process.argv.slice(2);
const docs = [
  ["electricity", "North Cairo Electricity — your bill for October is 412 EGP, due 25 Oct"],
  ["parking", "ركنت العربية في الدور التاني من جراج سيتي ستارز، عمود B7"],
  ["wifi", "Office network Nile-Office-5G password Cr4ne#2026"],
  ["doctor", "موعد دكتور الأسنان يوم الخميس الساعة 6 في المعادي"],
  ["crane", "LTM 1100 hydraulic hose burst on site, 2 hours down, mechanic Sayed fixed it"],
  ["salary", "تم إيداع المرتب 18,000 جنيه في حسابك"],
  ["flight", "EgyptAir MS 737 Cairo → Istanbul, boarding 08:40, gate 12"],
  ["gift", "Mum's birthday: she wants a silver bracelet, size small"],
].map(([id, text], i) => ({ id, kind: "note", title: "", text, ts: 1e12 + i }));
const asks = [["فاتورة الكهربا", "electricity"], ["where did I park the car", "parking"], ["كلمة سر الواي فاي", "wifi"], ["dentist appointment", "doctor"],
  ["العطل اللي حصل للونش", "crane"], ["when did my pay arrive", "salary"], ["رحلتي لتركيا", "flight"], ["هدية عيد ميلاد ماما", "gift"]];
const lines = [...docs.map(M.textOf), ...asks.map((a) => a[0])];
const r = spawnSync(cli, [model, "4"], { input: lines.join("\n") + "\n", encoding: "utf8", maxBuffer: 1 << 28 });
const vecs = r.stdout.trim().split("\n").map((l) => Float32Array.from(JSON.parse(l)));
if (vecs.length !== lines.length) { console.log("FAIL the tool gave " + vecs.length + " vectors"); process.exit(1); }
const dv = new Map(docs.map((d, i) => [d.id, vecs[i]]));
let found = 0, wordsOnly = 0;
asks.forEach(([q, want], i) => {
  const qv = vecs[docs.length + i], near = M.nearest(docs, (d) => dv.get(d.id), qv, { min: 0 });
  const words = recallSearch(docs, q).hits;
  const fused = M.fuseHits(words, near.filter((x) => x.sim >= M.MIN_SIM));
  const ok = fused[0] && fused[0].doc.id === want; if (ok) found++;
  if (words[0] && words[0].doc.id === want) wordsOnly++;
  console.log((ok ? "PASS " : "FAIL ") + q + " → " + (fused[0] ? fused[0].doc.id : "-") + "  (best " + near[0].sim.toFixed(3) + ", 2nd " + near[1].sim.toFixed(3) + ")");
});
console.log(`by meaning: ${found}/${asks.length} first · words alone: ${wordsOnly}/${asks.length}`);
if (found < asks.length) process.exitCode = 1;
