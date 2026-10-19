/* ---- v6.41 (upgrade C3) — automations you describe. "When my salary arrives, put 20% in the car fund and tell me" /
   «لما المرتب ينزل حط 20% في صندوق العربية وقولي» is read ONCE by code into a rule; the phone checks every money notification with
   it (AutoRules.kt, no AI, never SMS), alerts at once, and the money goes into the pot (a named savings pot, صندوق) when Attune
   opens. Pure; tests/unit/v741autom.test.mjs; the page is autom-ui.jsx.                                                   */

export const AUTO_KEY = "attune:auto:v1";
const SYN = [
  [/salary|payroll|pay ?day|wage|مرتب|راتب|المرتب|الراتب|mortab|morattab|mortabi/i, ["salary", "payroll", "مرتب", "راتب"]],
  [/instapay|انستاباي|إنستاباي/i, ["instapay", "انستاباي"]],
  [/bonus|مكافأة|مكافاه|بونص/i, ["bonus", "مكافأة", "مكافاه", "بونص"]],
  [/rent|ايجار|إيجار/i, ["rent", "ايجار", "إيجار"]],
  [/transfer|تحويل/i, ["transfer", "تحويل"]],
];
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/٫/g, ".").replace(/٪/g, "%");
const potName = (s) => clean(String(s).replace(/^(the|my|a)\s+/i, "").replace(/\s*(and|then)\s+(tell|notify|let|ping|remind).*$/i, "")
  .replace(/\s*(و\s*)?(قولي|قوللي|بلغني|نبهني|عرفني|ابعتلي).*$/, "").replace(/[.!؟?]+$/, ""));
const wordsOf = (trig) => {
  for (const [rx, w] of SYN) if (rx.test(trig)) return w;
  return clean(trig).split(" ").filter((w) => w.length > 2 && !/^(the|my|from|money|any|ال|من|فلوس)$/i.test(w)).slice(0, 4);
};

/** A sentence → { words, pct, fixed, pot, tell, dir, text } or null when it isn't an automation. */
export function parseAutomation(text) {
  const t = toLatin(clean(text));
  let m = t.match(/^(?:when(?:ever)?|each time|every time|if)\s+(?:my |the |a |an )?(.+?)\s+(?:arrives?|comes?(?: in)?|lands?|is paid|gets paid|hits(?: my account)?|is (?:credited|received))\s*,?\s*(?:then\s+)?(?:move|put|save|set aside|transfer|send|add)\s+(\d+(?:\.\d+)?)\s*(%|percent|pounds?|egp|le)?\s*(?:of it\s+)?(?:to|in|into|for)\s+(.+)$/i);
  let ar = false;
  if (!m) { m = t.match(/^(?:لما|لو|أول ما|اول ما|كل ما|كل مرة)\s+(?:ي?(?:نزل|وصل|جي|يجي)\s+)?(.+?)\s+(?:ينزل|يوصل|يجي|ييجي|يتحول|نزل|وصل|تنزل|توصل|تيجي)\s*،?\s*(?:حو(?:ّ)?ل|حط|شيل|حو(?:ّ)?ش|وف(?:ّ)?ر|خلي|اركن|ضيف|إرمي|ارمي)\s+(\d+(?:\.\d+)?)\s*(%|في الميه|في المية|في المائة|جنيه)?\s*(?:منه|منها)?\s*(?:ل|لـ|في|على|ع)\s*(.+)$/); ar = !!m; }
  if (!m) { m = t.match(/^(?:lama|lw|law|awel ma|kol ma)\s+(?:el\s*)?(.+?)\s+(?:yenzel|yewsal|yegi|nezel)\s+(?:7a+wel|7ot|wafar|7awesh)\s+(\d+(?:\.\d+)?)\s*(%)?\s*(?:meno\s+)?(?:le|fe|f|l)\s*(.+)$/i); }
  if (!m) return null;
  const [, trig, n, unit, rest] = m;
  const pct = !unit || /%|percent|الميه|المية|المائة/i.test(unit) ? +n : 0;
  const fixed = pct ? 0 : +n;
  if (pct && (pct <= 0 || pct > 100)) return null;
  const tell = /tell|notify|let me know|ping|قولي|قوللي|بلغني|نبهني|عرفني|2oly|olli/i.test(t) || true;   // always tell — the person sees what ran
  const rest1 = ar && /^ل[^ا\s]/.test(rest) && /\sلل/.test(" " + t.slice(t.lastIndexOf(rest) - 1)) ? "ال" + rest.slice(1) : rest;   // «للطوارئ» = ل + الطوارئ
  const pot = potName(String(rest1).replace(/^(?:ال)?صندوق\s+/, "").replace(/^(?:sandou2|sandou)\s+(?:el\s*)?/i, "")) || (ar ? "التوفير" : "Savings");
  return { words: wordsOf(trig), pct, fixed, pot, tell, dir: "in", text: clean(text), trigger: clean(trig) };
}

/** In words, for the list: "Salary arrives → 20% to Car fund". */
export function ruleText(r, ar = false) {
  const how = r.fixed ? (ar ? `${r.fixed.toLocaleString("en-US")} جنيه` : `${r.fixed.toLocaleString("en-US")}`) : `${r.pct}%`;
  return ar ? `لما ${r.trigger || r.words[0]} يوصل ← ${how} في «${r.pot}»` : `When ${r.trigger || r.words[0]} arrives → ${how} to ${r.pot}`;
}

export const emptyState = () => ({ rules: [], pots: {}, done: [], log: [] });
export function loadAuto(ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const j = JSON.parse((ls && ls.getItem(AUTO_KEY)) || "null"); return j && Array.isArray(j.rules) ? { ...emptyState(), ...j } : emptyState(); } catch (e) { return emptyState(); }
}
export function saveAuto(s, native, lang = "en", ls = typeof localStorage !== "undefined" ? localStorage : null) {
  try { ls && ls.setItem(AUTO_KEY, JSON.stringify(s)); } catch (e) {}
  try { native && native.autoSave && native.autoSave(JSON.stringify({ rules: s.rules.map(({ id, words, pct, fixed, pot, on, dir, tell }) => ({ id, words, pct, fixed, pot, on: on !== false, dir, tell })), lang })); } catch (e) {}
  return s;
}
export const addRule = (s, p, now = Date.now()) => ({ ...s, rules: [...s.rules, { id: "au" + now.toString(36), ...p, on: true, created: now }], pots: { [p.pot]: 0, ...s.pots } });

/**
 * The fired events from the phone → money into the pots. Each event is read again with Money's own reader (`read`, paylog.js
 * readNotification) for the exact amount; an event already done is skipped. → { state, added: [{ pot, amount, of, ts }] }
 */
export function applyEvents(s, events, read, now = Date.now()) {
  const done = new Set(s.done || []), pots = { ...s.pots }, log = [...(s.log || [])], added = [];
  for (const ev of events || []) {
    if (!ev || done.has(ev.id)) continue;
    done.add(ev.id);
    const r = s.rules.find((x) => x.id === ev.rule && x.on !== false); if (!r) continue;
    const e = read ? read(ev) : null;
    if (r.dir === "in" && e && e.direction && e.direction !== "in") continue;
    const of = e && e.amount > 0 ? e.amount : null;
    const amount = r.fixed > 0 ? r.fixed : of != null ? Math.round(of * r.pct / 100) : null;
    const item = { rule: r.id, pot: r.pot, amount, of, ts: ev.ts || now, from: ev.app || "", text: String(ev.text || "").slice(0, 160), confirm: amount == null };
    if (amount != null) pots[r.pot] = (pots[r.pot] || 0) + amount;
    log.unshift(item); added.push(item);
  }
  return { state: { ...s, pots, done: [...done].slice(-300), log: log.slice(0, 100) }, added };
}

/** Take money out of a pot (spent on what it was for, or moved back). */
export const takeOut = (s, pot, amount, now = Date.now(), why = "") => ({ ...s, pots: { ...s.pots, [pot]: Math.max(0, (s.pots[pot] || 0) - amount) }, log: [{ pot, amount: -amount, ts: now, text: why }, ...(s.log || [])].slice(0, 100) });
