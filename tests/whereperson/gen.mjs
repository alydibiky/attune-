// v10.6 (Ali, 18 Nov 2026: "I asked where is my wife and it should have gone to notifications as we agreed … it knows who my wife is").
// EXACTLY 10,000 questions COMPOSED from parts: who (a role in English / Egyptian Arabic / Franco, or the saved name), the question's
// shape ("where is …", "where's …", "… فين", "did … get home", "location of …"), extra words ("right now", "now", «دلوقتي», "?"),
// in random order, made HARD (tests/lib/hard.mjs, human); and as many traps that are NOT where a person is: a thing or a place that
// belongs to them ("my mom's house", "where did my wife put the keys", «بيت ماما فين»), my own things ("where is my charger").
// A person question must answer from the newest Life360 note (Home's box: cmdrun.route → lines); a trap must never.
import * as NT from "../../web-src/noteteach.js";
import { route } from "../../web-src/cmdrun.js";
import { harden, shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const HARD = process.env.HARD !== "0";
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261120 + 4241 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const now = Date.now();
  const P = [["wife", "Nada", ["my wife", "wife", "the wife", "my missus", "مراتي", "المدام", "mraty"]], ["mother", "Samia", ["my mom", "my mother", "mama", "mum", "ماما", "امي", "مامتي"]],
    ["father", "Hassan", ["my dad", "my father", "baba", "بابا", "ابويا"]], ["son", "Omar", ["my son", "ابني", "ebny"]], ["daughter", "Laila", ["my daughter", "بنتي", "benty"]], ["husband", "Karim", ["my husband", "جوزي"]]];
  const dir = { items: P.map(([role, name], i) => ({ id: "p" + i, kind: "person", name, role })) };
  const notes = P.map(([, name], i) => ({ id: "n" + i, app: "Life360", pkg: "com.life360.android.safetymapd", title: name, text: pick(["Arrived at Home", "Left Work", "Arrived at Club", "Completed a 13 km drive"]), ts: now - (i + 1) * 6e5 }));
  const api = { whereIs: (x) => NT.whereIs(x, notes, dir), records: () => [] };
  const EN = [(w) => `where is ${w}`, (w) => `where's ${w}`, (w) => `where ${w} is`, (w) => `did ${w} get home`, (w) => `is ${w} home`, (w) => `location of ${w}`, (w) => `where is ${w} at`, (w) => `has ${w} arrived`, (w) => `where's ${w} heading`, (w) => `${w} location`, (w) => `track ${w}`, (w) => `has ${w} left work`, (w) => `any idea where ${w} is`, (w) => `is ${w} back`];
  const AR = [(w) => `${w} فين`, (w) => `فين ${w}`, (w) => `${w} وصلت؟`, (w) => `${w} وصل؟`, (w) => `${w} روّحت`, (w) => `مكان ${w}`, (w) => `${w} راحت فين`, (w) => `هي ${w} فين`, (w) => `${w} في البيت؟`, (w) => `${w} رجعت؟`];
  const TAIL = ["", " right now", " now", "?", " now?", " دلوقتي", " دلوقتي؟", " please", " rn", " at the moment", " currently?", " yet?", " بالظبط", " دلوقتي يا أتيون", " — need to know", " pls 🙏", " — I'm worried", " لو سمحت", " ya attune", " thx", " (urgent)", " 🙂"];
  const PRE = ["", "", "hey ", "Attune, ", "quick q: ", "يا أتيون ", "please tell me ", "can you check ", "do you know ", "btw ", "ممكن تقولي ", "تعرف ", "ok so ", "one sec, ", "عايز اعرف ", "شوفلي ", "I need to know ", "real quick, ", "طيب "];
  const LEAD = ["", "", "", "Her phone is off. ", "I called twice. ", "انا قلقان. ", "It's late. ", "مش بيرد. ", "The kids are asking. ", "We have dinner at 9. ", "معاد الدكتور قرب. ", "Traffic is bad today. ", "lost signal again. ", "الدنيا بتمطر. "];
  const join = (a, b) => (rnd() < 0.5 ? a + b : a + pick([" ", "  ", ", "]) + b.trim());
  const THINGS = ["charger", "keys", "passport", "glasses", "wallet", "remote", "الشاحن", "المفاتيح", "النضارة"];
  const TRAP = [(w) => `where is ${w}'s house`, (w) => `where did ${w} put the keys`, (w) => `where is ${w}'s car`, (w) => `بيت ${w} فين`, (w) => `where does ${w} keep the passport`, (w) => `عربية ${w} فين`, (w) => `where is ${w}'s office`];
  let right = 0; const wrong = [], shapes = [];
  for (let i = 0; i < total; i++) {
    const [role, name, words] = pick(P), r = rnd();
    let q, want;
    if (r < 0.55) { const who = rnd() < 0.2 ? name : pick(words); const ar = /[؀-ۿ]/.test(who); q = pick(LEAD) + join(pick(PRE) + (ar && rnd() < 0.8 ? pick(AR) : pick(EN))(who), pick(TAIL)); want = name; }
    else if (r < 0.85) { const who = pick(words.filter((w) => !/^(the |)wife$/.test(w))); q = pick(LEAD) + join(pick(PRE) + pick(TRAP)(who), pick(TAIL)); want = null; }
    else { const th = pick(THINGS); q = pick(LEAD) + join(pick(PRE) + pick([`where is my ${th}`, `where did I put my ${th}`, `${th} فين`, `where's the ${th}`, `I can't find my ${th}, where is it`]), pick(TAIL)); want = null; }
    if (HARD) q = harden(q, rnd, { human: true, allowCut: false });
    let o = null; try { o = route(q, { api }); } catch (e) { o = null; }
    const line = o && o.type === "lines" && o.lines[0] && o.lines[0].en || "";
    const ok = want ? line.startsWith(want + " — Life360") : !/Life360|location app/.test(line);
    if (ok) right++; else if (wrong.length < 25) wrong.push({ q, want, got: o && o.type, line: line.slice(0, 80) });
    shapes.push(q.toLowerCase().replace(/\s+/g, " ").replace(new RegExp(P.map((x) => x[1]).join("|"), "g"), "N") + "|" + (want ? "p" : "x"));
  }
  const sh = shapeReport(shapes);
  if (!quiet) { console.log(`where is a person: ${right} / ${total} (${(100 * right / total).toFixed(2)} %) · ${HARD ? "HARD" : "easy"} · ${sh.shapes} shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
    for (const w of wrong.slice(0, 15)) console.log("  WRONG", JSON.stringify(w)); }
  return { right, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
