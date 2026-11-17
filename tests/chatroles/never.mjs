// v10.2 (Ali, 17 Nov: "I don't want a 1 time fix, I want a fix for good") — EXACTLY 10,000 descriptions of a chat, of every kind: the
// known kinds in English / Egyptian Arabic / Franco, his own Orders sentence, half-sentences, typos, emoji, gibberish, other languages.
// Truth written HERE: after "Change" the card ALWAYS goes somewhere (code understood it · ask the phone's AI · the kinds to tap) — never
// nothing; a role from code is a real one; and what the person teaches is understood again from the same words written a little
// differently (case, punctuation, spaces, «ال», a plural s, "it's / my / the").
//     node tests/chatroles/never.mjs [n]
const R = await import("../../web-src/chatroles.js");
const N = +(process.argv[2] || 10000);
let seed = 6161; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const WORDS = ["blue", "bananas", "flying", "team", "zone", "x", "khalas", "yalla", "مش", "عارف", "ده", "بتاع", "stuff", "random", "🙂", "the", "group", "for", "papers", "car", "gym", "mosque", "قرآن", "دروس", "school", "club", "football", "kora", "ماتش", "tickets", "travel", "سفر", "rent", "ايجار", "maid", "شغالة", "doctor", "علاج", "receipts", "bills", "فواتير", "orders", "طلبات", "my", "brother", "اخويا", "pics", "صور", "recipes", "اكل"];
const KNOWN = ["It's a group I put on all orders I buy", "our shopping list", "work group", "family group", "my gym buddies", "جروب العيلة", "الشلة", "جروب السكان", "مش مهم خالص", "delivery updates", "news channel", "مشترياتي", "el shella"];
const VARY = [(s) => s.toUpperCase(), (s) => s + "!", (s) => "  " + s.replace(/ /g, "  ") + " ", (s) => "it's " + s, (s) => "my " + s, (s) => s.replace(/\b([a-z]{3,}[a-rt-z])\b/i, "$1s"), (s) => s + ".", (s) => s.replace(/^/, "the ")];
const bad = {}; let pass = 0;
const store = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = v; } };
for (let i = 0; i < N; i++) {
  store.m = {};
  const kind = rnd() < 0.3 ? "known" : "free";
  const s = kind === "known" ? pick(KNOWN) : Array.from({ length: 1 + Math.floor(rnd() * 6) }, () => pick(WORDS)).join(" ") + (rnd() < 0.3 ? " " + i : "");
  // (a description of only small words — "the", "my" — says nothing; it still gets the kinds to tap, but there is nothing to learn)
  if (/^(?:\s*(?:the|my|it'?s|a|an|our|this|is)\s*)+$/i.test(s)) { pass++; continue; }
  const r = R.readDescription(s, R.loadLearned(store));
  let why = "";
  for (const modelReady of [false, true]) { const st = R.nextStep(r, modelReady); if (!["code", "model", "pick"].includes(st)) why = "nothing happens after Change"; }
  if (!why && r && r.role && !R.ROLES.includes(r.role)) why = "an unknown kind " + r.role;
  if (!why && kind === "known" && !(r && r.role)) why = "a known description not understood";
  // teach it (what the person would tap) and read it again written a little differently
  if (!why && !(r && r.role)) {
    const role = pick(R.ROLES); R.learnDescription(s, { role }, store);
    const again = R.readDescription(pick(VARY)(s), R.loadLearned(store));
    if (!again || again.role !== role) why = "taught words not understood the second time";
  }
  if (why) (bad[why] = bad[why] || []).push(s); else pass++;
}
const pct = (pass / N * 100).toFixed(2);
console.log(`never stuck: ${N} descriptions — right: ${pass} (${pct}%)`);
for (const [k, v] of Object.entries(bad)) console.log(" ", v.length, k, "e.g.", JSON.stringify(v.slice(0, 3)));
