import { tr } from "./i18n.js";
/* ---- v8.8 The connected memory, part 1: your people (and places and things) — Ali, 30 Oct 2026: "the chat should be very smart
   and connect everything together"; "for names an option to add a referable name the first time or a contact, so when I say
   Ahmed it asks me which Ahmed if there is more than one"; "contact names are not always good — give me both: add his contact
   and refer to him as X".
   One card per person / place / thing: { id, kind: "person"|"place"|"thing", name (what YOU call them), aliases [], role,
   contact { name, phone } | null, picks { word: n } (what you were talking about when you picked them — learnt) }.
   Code finds them in any sentence (English, Arabic, Franco spellings folded), and when a name fits more than one card it
   ranks them by the sentence's other words and what you picked before: sure → that one (with a "change" chip); not sure →
   "Which Ahmed?". The AI never links anything on its own.
   Pure (store in, store out); tests: tests/unit/v880entities.test.mjs. The screen: people-ui.jsx.                         */

export const DIR_KEY = "attune:people:v1";
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export const emptyDir = () => ({ v: 1, items: [], skip: [] });
export function loadDir(st = ls()) { try { const v = JSON.parse((st && st.getItem(DIR_KEY)) || "null"); return v && Array.isArray(v.items) ? { skip: [], ...v } : emptyDir(); } catch (e) { return emptyDir(); } }
export function saveDir(d, st = ls()) { try { st && st.setItem(DIR_KEY, JSON.stringify(d)); } catch (e) {} try { window.dispatchEvent(new CustomEvent("attune-people")); } catch (e) {} return d; }

/** Fold for matching: lower case, Arabic letter forms and tashkeel, Franco digits kept, punctuation out. */
export function fold(s) {
  return " " + String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim() + " ";
}
// Franco / English spellings of one name → one key ("Mohamed", "Muhammad", "Mohammed", «محمد»)
const SAME = [["mohamed", "muhammad", "mohammed", "mohammad", "mohamad", "mhmd", "محمد"], ["ahmed", "ahmad", "a7med", "احمد"], ["mahmoud", "mahmood", "ma7moud", "محمود"],
  ["mostafa", "mustafa", "moustafa", "مصطفي"], ["youssef", "yousef", "yusuf", "joseph", "يوسف"], ["omar", "umar", "عمر"], ["ali", "aly", "علي"], ["hassan", "hasan", "حسن"],
  ["hussein", "hussain", "hossam", "حسين"], ["ibrahim", "ebrahim", "abraham", "ابراهيم"], ["khaled", "khalid", "خالد"], ["tarek", "tariq", "tarik", "طارق"], ["osama", "usama", "اسامه"],
  ["amr", "amro", "عمرو"], ["karim", "kareem", "كريم"], ["hany", "hani", "هاني"], ["sherif", "sharif", "شريف"], ["walid", "waleed", "وليد"], ["sameh", "سامح"], ["samir", "sameer", "سمير"],
  ["fatma", "fatima", "fatema", "فاطمه"], ["mariam", "maryam", "mariem", "مريم"], ["nour", "noor", "نور"], ["sara", "sarah", "ساره"], ["heba", "هبه"], ["mona", "منى", "مني"], ["aya", "ايه"],
  ["yasmin", "yasmine", "jasmine", "ياسمين"], ["salma", "سلمي"], ["rana", "رنا"], ["dina", "دينا"], ["reem", "rim", "ريم"], ["laila", "layla", "leila", "ليلي"], ["hoda", "huda", "هدي"],
  ["abdallah", "abdullah", "عبدالله", "عبد الله"], ["abdelrahman", "abdulrahman", "عبدالرحمن", "عبد الرحمن"], ["saeed", "said", "سعيد"], ["adel", "adil", "عادل"], ["magdy", "magdi", "مجدي"],
  ["ashraf", "اشرف"], ["ayman", "aymen", "ايمن"], ["essam", "issam", "عصام"], ["gamal", "jamal", "جمال"], ["hamada", "حماده"], ["mido", "ميدو"], ["ziad", "zeyad", "زياد"], ["seif", "saif", "سيف"],
  ["hazem", "حازم"], ["wael", "وائل", "وايل"], ["nader", "نادر"], ["emad", "imad", "عماد"], ["fady", "fadi", "فادي"], ["bassem", "basem", "باسم"], ["ramy", "rami", "رامي"], ["maged", "majed", "ماجد"]];
const CANON = new Map(); for (const g of SAME) for (const w of g) CANON.set(fold(w).trim(), fold(g[0]).trim());
const canon = (w) => CANON.get(w) || w;
/** Common first names (Egypt / Arab world, both scripts) — a word that is one of these is a name even without a capital. */
export const isFirstName = (w) => CANON.has(fold(w).trim());

/** Every way a card can be called, folded and with name spellings made one ("Ahmed the plumber" → "ahmed the plumber", "ahmed"). */
export function keysOf(p) {
  const out = new Set();
  for (const raw of [p.name, ...(p.aliases || []), p.contact && p.contact.name]) {
    const f = fold(raw).trim(); if (!f) continue;
    const ws = f.split(" ").map(canon);
    out.add(ws.join(" "));
    if (p.kind !== "thing" && p.kind !== "place" && ws[0] && ws[0].length >= 2) out.add(ws[0]);   // first name alone
  }
  // a role that names one person ("the barber", «الحلاق», "my plumber") finds the card too — not a vague one ("work", "friend")
  const role = fold(p.role).trim().replace(/^(the|my|ال)\s*/, "");
  if (role && role.length >= 3 && !GENERIC_ROLE.has(role)) { out.add(role); if (/^[\u0621-\u064A]/.test(role)) out.add("ال" + role); }
  return [...out].filter((k) => k.length >= 2);
}
const GENERIC_ROLE = new Set("work friend family client colleague neighbour neighbor relative cousin boss customer supplier شغل الشغل صاحبي صديق قريب جار عميل زميل".split(" "));
const tokens = (text) => fold(text).trim().split(" ").filter(Boolean).map(canon);

/** The cards a piece of text names: [{ key, at, ids: [card ids] }] — longest name first ("ahmed samir" before "ahmed"). */
export function mentions(text, dir) {
  const ws = tokens(text), items = (dir && dir.items) || [], out = [], used = new Set();
  const index = new Map();
  for (const p of items) for (const k of keysOf(p)) { if (!index.has(k)) index.set(k, new Set()); index.get(k).add(p.id); }
  for (let n = 4; n >= 1; n--) for (let i = 0; i + n <= ws.length; i++) {
    if ([...Array(n).keys()].some((j) => used.has(i + j))) continue;
    // «لأحمد» / «لاحمد» / "w ahmed": a one-letter Arabic / Franco prefix stuck to the name
    const k = ws.slice(i, i + n).join(" "), k2 = n === 1 && /^[لبوف]/.test(ws[i]) ? canon(ws[i].slice(1)) : null;
    const hit = index.get(k) || (k2 && index.get(k2));
    if (!hit) continue;
    for (let j = 0; j < n; j++) used.add(i + j);
    out.push({ key: index.get(k) ? k : k2, at: i, ids: [...hit] });
  }
  return out.sort((a, b) => a.at - b.at);
}

const STOP = new Set("the a an and or of to in on at for with from by is was are my me i you he she it we they this that what which who when how much many did do does have has had paid pay gave give owe owes about last time ل في من على عن مع ده دي اللي انا انت هو هي احنا كام ايه مين امتي فين هل دفعت اديت".split(" ").map((w) => fold(w).trim()));
/** Rank the cards one name could be by the rest of the sentence: their role / aliases / note words, and what you picked before. */
export function rankFor(ids, text, dir, { now = Date.now() } = {}) {
  const ctx = tokens(text).filter((w) => w.length >= 3 && !STOP.has(w));
  return ids.map((id) => {
    const p = dir.items.find((x) => x.id === id) || {};
    const about = new Set(tokens([p.role, p.name, ...(p.aliases || []), p.note].filter(Boolean).join(" ")));
    let s = 0;
    for (const w of ctx) { if (about.has(w)) s += 3; s += Math.min(3, ((p.picks || {})[w] || 0)); }
    s += Math.min(1, (p.used || 0) / 20);   // a little for the one you mention most
    if (p.last && now - p.last < 3 * 864e5) s += 0.5;   // and for the one from the last few days
    return { id, score: s };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Who / what a sentence is about. → { found: [{ key, id, sure, other: [ids] }], ask: null | { key, choices: [ids] } }
 * One card → that one. Several → the best by rankFor when it clearly leads (≥ 2 points ahead), else ask (the first unclear one).
 */
export function resolve(text, dir, o = {}) {
  const found = [], seen = new Set(); let ask = null;
  for (const m of mentions(text, dir)) {
    if (m.ids.length === 1) { if (!seen.has(m.ids[0])) { seen.add(m.ids[0]); found.push({ key: m.key, id: m.ids[0], sure: true, other: [] }); } continue; }
    const r = rankFor(m.ids, text, dir, o);
    if (r[0].score >= 2 && r[0].score - (r[1] ? r[1].score : 0) >= 2) { if (!seen.has(r[0].id)) { seen.add(r[0].id); found.push({ key: m.key, id: r[0].id, sure: false, other: r.slice(1).map((x) => x.id) }); } }
    else if (!ask) ask = { key: m.key, choices: r.map((x) => x.id) };
  }
  return { found, ask };
}

/** "Which Ahmed?" answered: remember what the sentence was about with that card, so next time it knows. */
export function learnPick(dir, id, text, now = Date.now()) {
  const ctx = tokens(text).filter((w) => w.length >= 3 && !STOP.has(w));
  return { ...dir, items: dir.items.map((p) => {
    if (p.id !== id) return p;
    const picks = { ...(p.picks || {}) }; for (const w of ctx) if (!keysOf(p).includes(w)) picks[w] = Math.min(9, (picks[w] || 0) + 1);
    return { ...p, picks, used: (p.used || 0) + 1, last: now };
  }) };
}
export const touch = (dir, ids, now = Date.now()) => ({ ...dir, items: dir.items.map((p) => (ids.includes(p.id) ? { ...p, used: (p.used || 0) + 1, last: now } : p)) });

const newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clean = (s, n = 60) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
/** Add a card (your name for them; their contact is optional). A card with the same phone number is merged into, not doubled. */
export function addCard(dir, { kind = "person", name, aliases = [], role = "", contact = null, note = "" } = {}, now = Date.now()) {
  const nm = clean(name); if (!nm && !(contact && contact.name)) return { dir, id: null };
  const phone = contact && contact.phone ? String(contact.phone).replace(/[^\d+]/g, "") : "";
  const same = phone ? dir.items.find((p) => p.contact && p.contact.phone && String(p.contact.phone).replace(/[^\d+]/g, "").slice(-9) === phone.slice(-9)) : null;
  if (same) return { dir: updateCard(dir, same.id, { aliases: [...new Set([...(same.aliases || []), nm, ...aliases].filter((x) => x && x !== same.name))], role: same.role || role }), id: same.id };
  const card = { id: newId(), kind, name: nm || clean(contact.name), aliases: [...new Set(aliases.map((a) => clean(a)).filter(Boolean))], role: clean(role, 40), note: clean(note, 200),
    contact: contact && (contact.name || phone) ? { name: clean(contact.name), phone } : null, created: now, picks: {}, used: 0 };
  return { dir: { ...dir, items: [...dir.items, card], skip: (dir.skip || []).filter((s) => s !== fold(card.name).trim()) }, id: card.id };
}
export const updateCard = (dir, id, patch) => ({ ...dir, items: dir.items.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
export const removeCard = (dir, id) => ({ ...dir, items: dir.items.filter((p) => p.id !== id) });
/** Two cards are one person: keep the first, add the second's names, contact, picks. */
export function mergeCards(dir, keepId, goneId) {
  const a = dir.items.find((p) => p.id === keepId), b = dir.items.find((p) => p.id === goneId); if (!a || !b || a === b) return dir;
  const picks = { ...(b.picks || {}) }; for (const [k, v] of Object.entries(a.picks || {})) picks[k] = Math.max(v, picks[k] || 0);
  const merged = { ...a, aliases: [...new Set([...(a.aliases || []), b.name, ...(b.aliases || [])].filter((x) => x && x !== a.name))], contact: a.contact || b.contact, role: a.role || b.role, picks, used: (a.used || 0) + (b.used || 0) };
  return { ...dir, items: dir.items.filter((p) => p.id !== goneId).map((p) => (p.id === keepId ? merged : p)) };
}
/** "Not a person" (Ali tapped Skip on "Who is X?"): never asked again. */
export const skipName = (dir, name) => ({ ...dir, skip: [...new Set([...(dir.skip || []), fold(name).trim()])].slice(-300) });
/** How a card is shown when it must be told apart: "Ahmed · plumber" / "Ahmed · 010… 4521". */
export function labelOf(p) {
  if (!p) return "";
  const tail = p.role || (p.aliases || []).find((a) => fold(a).trim() !== fold(p.name).trim()) || (p.contact && p.contact.name && fold(p.contact.name).trim() !== fold(p.name).trim() ? p.contact.name : "") || (p.contact && p.contact.phone ? "…" + p.contact.phone.slice(-4) : "");
  return tail ? p.name + " · " + tail : p.name;
}

// ---- names that have no card yet ----------------------------------------------------------------------------------------------
const VERB_EN = /\b(?:paid|pay|to|from|with|gave|give|lent|lend|borrowed from|owe|owes|met|meet|call|called|told|tell|ask|asked|visit|visited|text|texted|message|messaged|sent)\s+(?:mr\.?\s+|mrs\.?\s+|dr\.?\s+|uncle\s+|aunt\s+)?([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)/g;
const VERB_AR = /(?:^|\s)(?:دفعت\s*ل|دفعتل|ادفع\s*ل|اديت|إديت|ادّيت|اديته|سلفت|استلفت\s*من|خدت\s*من|كلمت|قابلت|زرت|بعتّ?\s*ل|قول\s*ل|فكرني\s*اكلم|الحاج|الأستاذ|الاستاذ|دكتور|د\.|عم|طنط|خالتي|عمتي)\s*([ء-ي]{3,}(?:\s[ء-ي]{3,})?)/g;
const NOT_NAME = new Set("الف ألف جنيه دولار ريال درهم يورو فلوس كاش البيت الشغل المحل السوبر الصيدليه الدكتور الدكتوره امبارح النهارده بكره الشهر الاسبوع اليوم ساعه مبلغ شويه كمان تاني عشان علشان".split(" ").map((w) => fold(w).trim()));
/** Names in a text that no card has (and you didn't skip): ["Ahmed", "أسامة"] — from "paid Ahmed", «اديت أسامة», a first name. */
export function newNames(text, dir) {
  const t = String(text || ""), out = new Map(), known = new Set(), skip = new Set((dir && dir.skip) || []);
  for (const m of mentions(t, dir)) known.add(m.key.split(" ")[0]);
  const add = (raw) => {
    const f = fold(raw).trim(); if (!f || f.length < 3) return;
    const first = canon(f.split(" ")[0]);
    if (known.has(first) || skip.has(f) || skip.has(first) || NOT_NAME.has(first) || /^ال/.test(first) || STOP.has(first)) return;
    if (/^ل/.test(first) && !CANON.has(first)) return;   // «دفعت للسوبر» — «لل» is "to the", not a name
    if (!out.has(first)) out.set(first, raw.trim().split(/\s+/).slice(0, 2).join(" "));
  };
  for (const m of t.matchAll(VERB_EN)) add(m[1]);
  for (const m of t.matchAll(VERB_AR)) add(m[1].split(/\s+/)[0]);
  for (const w of t.split(/[^\p{L}]+/u)) if (w && isFirstName(w)) add(w.charAt(0).toUpperCase() + w.slice(1));
  return [...out.values()];
}

/** v8.8: the people already in the app become cards once (People & plans' people, the voice's nicknames) — nothing typed twice. */
export function seedFrom(dir, { life = null, voicePeople = null } = {}, now = Date.now()) {
  let d = dir;
  const has = (name) => d.items.some((p) => keysOf(p).includes(fold(name).trim().split(" ").map(canon).join(" ")));
  for (const c of (life && life.items) || []) {
    const nm = clean(c.person); if (!nm || has(nm)) continue;
    d = addCard(d, { name: nm, role: /maid|خادم|شغال|دادة|داده|نظافه|cleaner/i.test([c.title, c.kind].join(" ")) ? (/[؀-ۿ]/.test(nm) ? "الشغالة" : tr("maid")) : "" }, now).dir;
  }
  for (const [k, v] of Object.entries(voicePeople || {})) {
    if (!k.startsWith("~") || !v || !v.is) continue;
    const nick = k.slice(1), contact = String(v.is);
    const ex = d.items.find((p) => p.contact && p.contact.name === contact) || d.items.find((p) => keysOf(p).includes(fold(contact).trim()));
    d = ex ? updateCard(d, ex.id, { aliases: [...new Set([...(ex.aliases || []), nick])] }) : addCard(d, { name: nick, contact: { name: contact } }, now).dir;
  }
  return d;
}
