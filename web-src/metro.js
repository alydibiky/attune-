/* ---- v6.41 (upgrade D5) — Cairo Metro, offline. The three lines and their stations (public facts, as on the official maps and
   OpenStreetMap, ODbL), a route by code: which line, which direction (the line's last station), how many stops, where to
   change, about how long and the ticket. Lines 1–3 as of 2025 — new stations open; the fares change (the date is shown).
   Pure; tests/unit/v741metro.test.mjs; the card is in the Maps page (map-ui.jsx MetroCard).                               */

const L1 = [["Helwan", "حلوان"], ["Ain Helwan", "عين حلوان"], ["Helwan University", "جامعة حلوان"], ["Wadi Hof", "وادي حوف"], ["Hadayek Helwan", "حدائق حلوان"],
  ["El-Maasara", "المعصرة"], ["Tora El-Asmant", "طرة الأسمنت"], ["Kozzika", "كوتسيكا"], ["Tora El-Balad", "طرة البلد"], ["Thakanat El-Maadi", "ثكنات المعادي"],
  ["Maadi", "المعادي"], ["Hadayek El-Maadi", "حدائق المعادي"], ["Dar El-Salam", "دار السلام"], ["El-Zahraa", "الزهراء"], ["Mar Girgis", "مار جرجس"],
  ["El-Malek El-Saleh", "الملك الصالح"], ["Al-Sayeda Zeinab", "السيدة زينب"], ["Saad Zaghloul", "سعد زغلول"], ["Sadat", "السادات"], ["Nasser", "جمال عبد الناصر"],
  ["Orabi", "عرابي"], ["Al-Shohadaa", "الشهداء"], ["Ghamra", "غمرة"], ["El-Demerdash", "الدمرداش"], ["Manshiet El-Sadr", "منشية الصدر"],
  ["Kobri El-Qobba", "كوبري القبة"], ["Hammamat El-Qobba", "حمامات القبة"], ["Saray El-Qobba", "سراي القبة"], ["Hadayeq El-Zaitoun", "حدائق الزيتون"], ["Helmeyet El-Zaitoun", "حلمية الزيتون"],
  ["El-Matareyya", "المطرية"], ["Ain Shams", "عين شمس"], ["Ezbet El-Nakhl", "عزبة النخل"], ["El-Marg", "المرج"], ["New El-Marg", "المرج الجديدة"]];
const L2 = [["Shubra El-Kheima", "شبرا الخيمة"], ["Koliet El-Zeraa", "كلية الزراعة"], ["Mezallat", "المظلات"], ["Khalafawy", "الخلفاوي"], ["St. Teresa", "سانت تريزا"],
  ["Rod El-Farag", "روض الفرج"], ["Massara", "مسرة"], ["Al-Shohadaa", "الشهداء"], ["Attaba", "العتبة"], ["Mohamed Naguib", "محمد نجيب"],
  ["Sadat", "السادات"], ["Opera", "الأوبرا"], ["Dokki", "الدقي"], ["El-Bohoth", "البحوث"], ["Cairo University", "جامعة القاهرة"],
  ["Faisal", "فيصل"], ["Giza", "الجيزة"], ["Omm El-Misryeen", "أم المصريين"], ["Sakiat Mekki", "ساقية مكي"], ["El-Monib", "المنيب"]];
const L3_TRUNK = [["Adly Mansour", "عدلي منصور"], ["El-Haykestep", "الهايكستب"], ["Omar Ibn El-Khattab", "عمر بن الخطاب"], ["Qobaa", "قباء"], ["Hesham Barakat", "هشام بركات"],
  ["El-Nozha", "النزهة"], ["Nadi El-Shams", "نادي الشمس"], ["Alf Maskan", "ألف مسكن"], ["Heliopolis Square", "ميدان هليوبوليس"], ["Haroun", "هارون"],
  ["Al-Ahram", "الأهرام"], ["Koleyet El-Banat", "كلية البنات"], ["Stadium", "الاستاد"], ["Fair Zone", "أرض المعارض"], ["Abbassia", "العباسية"],
  ["Abdou Pasha", "عبده باشا"], ["El-Geish", "الجيش"], ["Bab El-Shaariya", "باب الشعرية"], ["Attaba", "العتبة"], ["Nasser", "جمال عبد الناصر"],
  ["Maspero", "ماسبيرو"], ["Safaa Hegazy", "صفاء حجازي"], ["Kit Kat", "الكيت كات"]];
const L3_ROD = [["Sudan", "السودان"], ["Imbaba", "إمبابة"], ["El-Bohy", "البوهي"], ["El-Qawmia El-Arabiya", "القومية العربية"], ["Ring Road", "الطريق الدائري"], ["Rod El-Farag Corridor", "محور روض الفرج"]];
const L3_UNI = [["Tawfikia", "التوفيقية"], ["Wadi El-Nil", "وادي النيل"], ["Gamaat El-Dowal El-Arabiya", "جامعة الدول العربية"], ["Bulaq El-Dakrour", "بولاق الدكرور"], ["Cairo University", "جامعة القاهرة"]];

/** The lines as runs of stations (line 3 has two branches after Kit Kat). */
export const LINES = [
  { id: "1", name: "Line 1", ar: "الخط الأول", color: "#2563eb", stations: L1 },
  { id: "2", name: "Line 2", ar: "الخط الثاني", color: "#dc2626", stations: L2 },
  { id: "3", name: "Line 3", ar: "الخط الثالث", color: "#16a34a", stations: [...L3_TRUNK, ...L3_ROD] },
  { id: "3", name: "Line 3", ar: "الخط الثالث", color: "#16a34a", stations: [...L3_TRUNK, ...L3_UNI] },
];
// names people use for a station (squares, old names, Franco)
const ALIAS = { tahrir: "Sadat", "ميدان التحرير": "Sadat", التحرير: "Sadat", ramses: "Al-Shohadaa", "رمسيس": "Al-Shohadaa", mubarak: "Al-Shohadaa", "مبارك": "Al-Shohadaa", shohada: "Al-Shohadaa",
  "الشهدا": "Al-Shohadaa", ataba: "Attaba", "العتبه": "Attaba", "عتبة": "Attaba", zamalek: "Safaa Hegazy", "الزمالك": "Safaa Hegazy", heliopolis: "Heliopolis Square", "مصر الجديدة": "Heliopolis Square",
  "korba": "Heliopolis Square", "الكوربة": "Heliopolis Square", "abbasiya": "Abbassia", "عباسية": "Abbassia", "cairo uni": "Cairo University", "الجامعة": "Cairo University", "giza square": "Giza", "ميدان الجيزة": "Giza",
  "mohandessin": "Gamaat El-Dowal El-Arabiya", "المهندسين": "Gamaat El-Dowal El-Arabiya", "downtown": "Sadat", "وسط البلد": "Sadat", "nasr city": "Stadium", "مدينة نصر": "Stadium", "el marg": "El-Marg", "el monib": "El-Monib",
  "airport": "Adly Mansour", "maadi": "Maadi", "شبرا": "Shubra El-Kheima", "shubra": "Shubra El-Kheima", "giza": "Giza", "orman": "Dokki", "dokki": "Dokki" };
export const FARES = { asOf: "2024-08", egp: [[9, 8], [16, 10], [23, 15], [Infinity, 20]] };   // stations travelled → EGP (one ticket, any changes)

const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة\b/g, "ه").replace(/ى/g, "ي").replace(/^(?:el|al)[- ]/, "").replace(/[-'.]/g, " ").replace(/^ال/, "").replace(/\s+/g, " ").trim();
const ALL = (() => { const m = new Map(); for (const l of LINES) for (const [en, ar] of l.stations) m.set(en, { en, ar }); return [...m.values()]; })();

/** A typed station name (English, Arabic, Franco, an old name or a square) → the station, or null. */
export function findStation(q) {
  const f = fold(q); if (!f) return null;
  for (const [k, v] of Object.entries(ALIAS)) if (fold(k) === f) return ALL.find((s) => s.en === v);
  const exact = ALL.find((s) => fold(s.en) === f || fold(s.ar) === f);
  if (exact) return exact;
  const part = ALL.filter((s) => fold(s.en).includes(f) || fold(s.ar).includes(f) || (f.length >= 4 && f.includes(fold(s.en))));
  return part.length ? part.sort((a, b) => a.en.length - b.en.length)[0] : null;
}

/**
 * The route between two stations, fewest minutes (2 a stop, 5 to change lines): { legs: [{ line, toward, from, to, stops }],
 * stops, changes, minutes, fare } or null. `toward` = the last station of the line in the direction of travel.
 */
export function route(fromQ, toQ) {
  const A = typeof fromQ === "string" ? findStation(fromQ) : fromQ, B = typeof toQ === "string" ? findStation(toQ) : toQ;
  if (!A || !B) return null;
  if (A.en === B.en) return { legs: [], stops: 0, changes: 0, minutes: 0, fare: 0, from: A, to: B };
  // states: station@line-run index; Dijkstra over (station, run)
  const runs = LINES.map((l, ri) => ({ ...l, ri, names: l.stations.map((s) => s[0]) }));
  const key = (st, ri) => st + "|" + ri;
  const dist = new Map(), prev = new Map(), Q = [];
  for (const r of runs) if (r.names.includes(A.en)) { dist.set(key(A.en, r.ri), 0); Q.push([0, A.en, r.ri]); }
  while (Q.length) {
    Q.sort((a, b) => a[0] - b[0]); const [d, st, ri] = Q.shift();
    if (d > (dist.get(key(st, ri)) ?? Infinity)) continue;
    const r = runs[ri], i = r.names.indexOf(st);
    const next = [];
    for (const j of [i - 1, i + 1]) if (j >= 0 && j < r.names.length) next.push([r.names[j], ri, 2]);
    for (const o of runs) if (o.ri !== ri && o.names.includes(st)) next.push([st, o.ri, o.id === r.id ? 0 : 5]);   // the other branch of line 3 is free
    for (const [ns, nri, w] of next) { const nd = d + w, k = key(ns, nri); if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); prev.set(k, key(st, ri)); Q.push([nd, ns, nri]); } }
  }
  let best = null; for (const r of runs) { const v = dist.get(key(B.en, r.ri)); if (v != null && (!best || v < best[0])) best = [v, r.ri]; }
  if (!best) return null;
  const path = []; let k = key(B.en, best[1]); while (k) { const [st, ri] = k.split("|"); path.unshift({ st, ri: +ri }); k = prev.get(k); }
  // legs: runs of the same LINE id
  const legs = [];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i]; if (a.st === b.st) continue;
    const r = runs[b.ri], dir = r.names.indexOf(b.st) > r.names.indexOf(a.st) ? 1 : -1;
    const last = legs[legs.length - 1];
    if (last && last.line === r.id && last.dir === dir) { last.to = b.st; last.stops++; last.ri = b.ri; }
    else legs.push({ line: r.id, dir, from: a.st, to: b.st, stops: 1, ri: b.ri });
  }
  for (const l of legs) { const r = runs[l.ri]; l.toward = l.dir > 0 ? r.names[r.names.length - 1] : r.names[0]; delete l.ri; }
  const stops = legs.reduce((t, l) => t + l.stops, 0);
  const fare = FARES.egp.find(([n]) => stops <= n)[1];
  return { legs, stops, changes: legs.length - 1, minutes: best[0], fare, from: A, to: B };
}

const AR = (en) => (ALL.find((s) => s.en === en) || {}).ar || en;
/** The route in words: "Line 1 toward New El-Marg, 3 stops to Sadat; change to Line 2 toward Shubra El-Kheima …". */
export function routeText(r, ar = false) {
  if (!r) return ar ? "ملقتش المحطة دي" : "I couldn't find that station";
  if (!r.legs.length) return ar ? "إنت في نفس المحطة" : "You're already there";
  const name = (s) => (ar ? AR(s) : s);
  const parts = r.legs.map((l, i) => ar
    ? `${i ? "غيّر في " + name(l.from) + " لـ" : "اركب "}${LINES.find((x) => x.id === l.line).ar} اتجاه ${name(l.toward)}، ${l.stops === 1 ? "محطة واحدة" : l.stops === 2 ? "محطتين" : l.stops + " محطات"} لحد ${name(l.to)}`
    : `${i ? "at " + l.from + " change to " : "Take "}Line ${l.line} toward ${l.toward}, ${l.stops} stop${l.stops === 1 ? "" : "s"} to ${l.to}`);
  const tail = ar ? `حوالي ${r.minutes} دقيقة · التذكرة ${r.fare} جنيه` : `about ${r.minutes} min · ticket ${r.fare} EGP`;
  return parts.join(ar ? "، وبعدين " : "; ") + " — " + tail;
}

/** "metro from Maadi to Attaba" / «مترو من المعادي للعتبة» → { from, to } or null. */
export function metroAsk(text) {
  const t = String(text || "").trim();
  let m = t.match(/(?:metro|subway|underground|train)\b.*?\bfrom\s+(.+?)\s+to\s+(.+?)[?.!]*$/i) || t.match(/^(?:how (?:do i|to) get|go)\s+from\s+(.+?)\s+to\s+(.+?)\s+(?:by|on the)\s+metro/i);
  if (!m) m = t.match(/(?:مترو|المترو)\s*(?:من)\s+(.+?)\s+(?:لـ?|ل|إلى|الى|لحد)\s*(.+?)[؟?.!]*$/) || t.match(/(?:ازاي|إزاي)\s+أروح\s+(?:من\s+)?(.+?)\s+(?:لـ?|ل|إلى|الى)\s*(.+?)\s+(?:بالمترو|مترو)/);
  // persona 2 (an Arabic week): «من المعادي للتحرير», "from maadi to tahrir" with no "metro" — a route when BOTH ends are stations
  let bare = false;
  if (!m && t.length <= 60) { m = t.match(/^(?:from)\s+(.+?)\s+to\s+(.+?)[?.!]*$/i) || t.match(/^(?:من)\s+(.+?)\s+(?:لـ?|إلى|الى|لحد)\s*(.+?)[؟?.!]*$/) || t.match(/^(?:من)\s+(\S+(?:\s\S+)?)\s+(ل\S+(?:\s\S+)?)[؟?.!]*$/); bare = !!m; }
  if (!m) return null;
  if (bare) { const f = (x) => { const s0 = fold(x.replace(/^ل(?=ل)/, "").replace(/^ل(?=[^ل])/, "")); return ALL.some((s) => fold(s.en) === s0 || fold(s.ar) === s0) || Object.keys(ALIAS).some((k) => fold(k) === s0); }; if (!f(m[1]) || !f(m[2])) return null; }
  const A = findStation(m[1]), B = findStation(m[2].replace(/^ل(?=ل)/, "").replace(/^ل(?=[^ل])/, ""));
  return A && B ? { from: A, to: B } : null;
}
