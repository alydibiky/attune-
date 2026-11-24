/* v10.9.8 (Ali's OK-W4, from the new-user walk-through: "buy milk, eggs and bread" became ONE to-do) — "add things by categories that
   seem similar so they can be under 1 category, e.g. a groceries list, each one a checkbox like the to-do, done automatically".
   readShopping(text) → { groups: [{ cat, items: [text…] }], rest: [text…] } | null — a request to BUY things (English, Egyptian Arabic,
   Franco), split into its items, each item sorted by code into Groceries / Pharmacy / Home & cleaning / Clothes / Electronics / Gifts;
   an item it doesn't know stays a to-do ("buy a birthday card"). Never a list: a payment ("bought milk 50"), a reminder ("remind me to
   buy milk at 5"), an agent order ("buy me a Kindle under 5000", "order …"), a question. applyAuto(st, read) puts the items into the
   list of that kind (made once, then reused — "buy rice" joins Groceries), never into the person's own named lists (those take an item
   only when the list is named: lists.parseListCommand, checked first). Pure. Tests: tests/autolist/gen.mjs (10,000 HARD composed),
   tests/unit/v1098walk.test.mjs. */
import { makeList } from "./lists.js";

export const CATS = ["groceries", "pharmacy", "home", "clothes", "electronics", "gifts"];
export const CAT_NAME = { groceries: "Groceries", pharmacy: "Pharmacy", home: "Home & cleaning", clothes: "Clothes", electronics: "Electronics", gifts: "Gifts" };
export const CAT_EMOJI = { groceries: "🛒", pharmacy: "💊", home: "🧽", clothes: "👕", electronics: "🔌", gifts: "🎁" };

const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/[ً-ْـ]/g, "").replace(/[‎‏؜]/g, "");
// each kind's words (English · Egyptian Arabic, folded: أ→ا, ة→ه · Franco). A word may carry «ال» / "el" in front and a plural -s.
const W = {
  groceries: "milk eggs egg bread rice sugar oil olive cheese butter yogurt yoghurt tea coffee pasta macaroni spaghetti noodles tomatoes tomato potatoes potato onions onion garlic chicken meat beef mince fish shrimp tuna fruit fruits vegetables veggies apples apple bananas banana oranges orange lemons lemon cucumbers cucumber carrots carrot lettuce flour salt pepper water juice beans lentils cereal oats honey jam biscuits chocolate chips nuts dates cream labneh halloumi feta sausages bacon ketchup mayo mayonnaise vinegar spices cumin zucchini eggplant peppers grapes strawberries mango watermelon melon avocado corn peas yeast" +
    " لبن حليب بيض بيضه عيش خبز رز ارز سكر زيت جبنه جبن زبده زبادي شاي قهوه بن مكرونه اسباجتي طماطم قوطه بطاطس بصل توم ثوم فراخ فرخه لحمه لحم كفته سمك جمبري تونه فاكهه خضار خضروات تفاح موز برتقال ليمون خيار جزر خس دقيق ملح فلفل ميه مياه عصير فول عدس سيريال شوفان عسل مربي بسكوت شوكولاته شيبسي مكسرات بلح تمر قشطه لبنه بسطرمه سجق صلصه كاتشب مايونيز خل بهارات كمون كوسه بتنجان باذنجان عنب فراوله مانجو بطيخ كانتلوب ذره بسله خميره" +
    " laban 7aleeb haleeb beid bed bid 3eish 3esh eish aish 3eesh 3ish 3aish 3eesh roz rozz ruz sokkar sukkar zeit zeet gebna gebna zebda zabadi shay shai ahwa 2ahwa makarona tamatem outa batates basal tom fera5 ferakh frakh la7ma lahma samak gambari tuna fakha 5odar khodar toffa7 mooz borto2an lamoon 5iyar khiyar gazar 7aras de2ee2 malh mayya maya 3aseer aseer fool fuul 3ads 3asal mrabba baskawet shokolata shipsy balah tamr ashta labna basterma sogo2 salsa",
  pharmacy: "panadol paracetamol ibuprofen brufen cataflam antinal aspirin vitamins vitamin medicine medicines meds pills tablets bandages bandage plasters plaster antiseptic betadine insulin antibiotic antibiotics thermometer syrup cough strepsils voltaren omega zinc iron calcium sunscreen" +
    " بنادول باراسيتامول بروفين كتافلام انتينال اسبرين فيتامين فيتامينات دوا دواء ادويه علاج برشام اقراص شاش بلاستر بيتادين انسولين مضاد حيوي ترمومتر ستربسلز فولتارين اوميجا زنك حديد كالسيوم صن بلوك" +
    " dawa adwya panadol vitamin 3elag barsham shash",
  home: "detergent soap shampoo conditioner toilet tissues tissue napkins bleach sponge sponges trash bin bags garbage toothpaste toothbrush cleaner dishwashing dish fairy persil ariel clorox dettol softener foil wrap bulbs bulb candles mop broom deodorant razor razors pads diapers wipes" +
    " صابون شامبو بلسم مناديل كلور سفنج سلك اكياس زباله معجون فرشه منظف مسحوق برسيل اريال ديتول كلوركس فيري ملطف سلوفان لمبه لمبات شمع مقشه مساحه مزيل حلاقه شفرات فوط بامبرز حفاضات" +
    " sabon shampoo manadeel kolor sfong akyas zbala ma3goon forsha mas7oo2 persil ariel dettol lamba bamperz",
  clothes: "shorrab sharabat جوارب شرابات socks sock shirt shirts tshirt t-shirt jeans trousers pants shorts shoes sneakers socks jacket coat dress skirt hoodie sweater pyjamas pajamas underwear belt hat scarf abaya" +
    " قميص قمصان تيشيرت بنطلون جينز شورت جزمه كوتشي جاكيت جاكت بالطو فستان جيبه سويتر بيجامه حزام طاقيه كوفيه عبايه طرحه" +
    " amees banta2loon bantalon tshirt gazma kotshy jaket fostan bejama 7ezam ta2ya ko2fya tar7a",
  electronics: "charger cable cables headphones earphones earbuds airpods battery batteries mouse keyboard powerbank adapter usb hdmi bulb laptop phone case screen protector flash memory sd" +
    " شاحن كابل كابلات سماعه سماعات بطاريه بطاريات ماوس كيبورد باور بانك اداپتر فلاشه جراب اسكرينه" +
    " sha7en shahen cable sama3a sama3at battarya mouse keyboard powerbank flasha garab skreena",
  gifts: "gift gifts present presents flowers bouquet card balloons wrapping toy toys perfume" + " هديه هدايا ورد بوكيه بالونات لعبه لعب برفان" + " hedeya hdeya ward bokeh lo3ba barfan balonat balloonat",
};
const MAP = new Map();
for (const c of CATS) for (const w of W[c].split(/\s+/)) if (w && !MAP.has(fold(w))) MAP.set(fold(w), c);
// two-word things ("toilet paper", "trash bags", «معجون اسنان», "power bank", "phone case", «مضاد حيوي»)
const PAIRS = [["toilet paper", "home"], ["paper towels", "home"], ["trash bags", "home"], ["garbage bags", "home"], ["dish soap", "home"], ["washing powder", "home"], ["fabric softener", "home"],
  ["power bank", "electronics"], ["phone case", "electronics"], ["kart mo3ayda", "gifts"], ["kart mo3aydah", "gifts"], ["screen protector", "electronics"], ["memory card", "electronics"], ["light bulbs", "home"], ["cough syrup", "pharmacy"],
  ["birthday card", "gifts"], ["gift card", "gifts"], ["birthday cake", "groceries"], ["مضاد حيوي", "pharmacy"], ["معجون اسنان", "home"], ["اكياس زباله", "home"], ["باور بانك", "electronics"],
  ["ورق تواليت", "home"], ["بنطلون جينز", "clothes"], ["كارت معايده", "gifts"], ["phone case", "electronics"], ["مناديل مطبخ", "home"], ["شراب كحه", "pharmacy"], ["كارت معايده", "gifts"], ["akyas zbala", "home"], ["ma3goon snan", "home"], ["power bank", "electronics"]].map(([a, c]) => [fold(a), c]);

// the words that start a request to buy (the item list follows)
const VERB = /^(?:(?:please|pls|can you|could you|i need to|i have to|i must|need to|gotta|don'?t forget to|we need to|remember to|let'?s|i want to|i wanna)\s+)?(?:buy|get|grab|pick up|pickup|purchase|we need|i need|need|we're out of|we are out of|out of|shopping:?|shopping list:?|groceries:?)\s+/i;
const VERB_AR = /^(?:(?:(?:لازم|محتاج|محتاجين|عايز|عايزه|عاوز|عاوزه|ياريت|ممكن)\s+)?(?:اشتري|اشترى|نشتري|هات|هاتي|جيب|جيبي|نجيب|نحتاج|ناقصنا|ناقص|خلص|خلصت|خلصانه|مشتريات:?|طلبات البيت:?|ياريت (?:تجيب|تجيبي|تشتري|تشتريلي|تجيبلي)|ممكن (?:تجيب|تشتري))|محتاج|محتاجين|عايز|عايزه|عاوز|عاوزه)\s+/;
const VERB_FR = /^(?:(?:(?:lazem|me7tag|mehtag|3ayez|3awez|3ayza|momken)\s+)?(?:eshtery|eshteri|ashtery|e4tery|eshtry|hat|haty|hati|gib|geeb|gyb|gibi|na2esna|na2es|5eles|khelis)|me7tag|mehtag|me7tageen|3ayez|3awez|3ayza)\s+/i;
// never a shopping list: money already spent, a time to be reminded at, an agent's price / order, a question, someone else
const NOT = /\b(?:bought|paid|spent|cost|costs|was|were|remind|reminder|alarm|tomorrow|tonight|today|at \d|under|below|less than|cheaper|price|prices|order|delivery|track|from (?:amazon|noon|jumia|talabat)|online|for me\b|me a\b|me an\b|me the\b|how|what|where|which|why|who|when|should|did|does)\b|[?؟]|(?<![\p{L}])(?:اشتريت|دفعت|صرفت|فكرني|ذكرني|بكره|بكرة|النهارده|الساعه|اقل من|تحت|ارخص|سعر|اطلب|اوردر|امتي|امتى|فين|ازاي|ليه|مين)(?![\p{L}])|\b(?:fakarny|fakarni|bokra|el sa3a|eshtaret|dafa3t|sraft|emta|fein|ezay|leh|meen)\b|(?:[$€£]|\begp\b|\ble\b|جنيه|ج\.?م|\bgeneh\b)/iu;   // (v10.9.8: Arabic words whole — «بروفين» holds «فين», «فيتامينات» «مين»)

const cap = (s) => (/^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** the kind of one item ("2 kilo rice", «كيلو رز», "el 3eish", "Panadol Extra"), or "" */
export function kindOf(item) {
  const f = fold(item).replace(/[^\p{L}\p{N}\s&-]/gu, " ").replace(/\s+/g, " ").trim();
  for (const [p, c] of PAIRS) if ((" " + f + " ").includes(" " + p + " ") || (" " + f + " ").includes(" ال" + p + " ")) return c;
  const words = f.split(" ").filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {   // the thing is usually the last word ("a bottle of oil", "2 kilo rice")
    const w = words[i], tries = [w, w.replace(/^(?:ال|el-?|il-?|l)(?=\S{2})/, ""), w.replace(/^و(?=\S{3})/, ""), w.replace(/^وال(?=\S{2})/, ""), w.replace(/(?<=\S{3})(?:es|s)$/, ""), w.replace(/^(?:ال|el-?)/, "").replace(/(?<=\S{3})s$/, "")];
    for (const t of tries) if (MAP.has(t)) return MAP.get(t);
  }
  return "";
}
// «عيش ولبن» / "3eish w laban" / "milk, eggs and bread" / "milk eggs bread" → the items
function splitItems(s) {
  let parts = String(s).split(/\s*(?:[,،;\n+&]|(?<![\d٠-٩])\/(?![\d٠-٩])|\band\b|(?:^|\s)(?:w|we|و)(?=\s))\s*/i).map((x) => x.trim()).filter(Boolean);
  // «عيش ولبن», «و٢ دقيق», «وsabon», «ورز»: a و glued to a known thing, a number, a Latin word or a quantity is "and" («ورد» stays flowers)
  const andGlued = (q) => { if (!/^و\S/.test(q)) return false; const r = q.slice(1); return /^[\d٠-٩A-Za-z]/.test(r) || /^(?:علبه|علبة|كيلو|ازازه|ازازة|نص|باكو|كرتونه|كرتونة)(?:\s|$)/.test(r) || !!kindOf(r); };
  parts = parts.flatMap((p) => { const segs = p.split(/\s+(?=و\S)/), out = [segs[0]]; for (const g of segs.slice(1)) { if (andGlued(g)) out.push(g.slice(1)); else out[out.length - 1] += " " + g; } return out; })
    .map((p) => (andGlued(p) ? p.slice(1) : p));
  // "milk eggs bread" (no commas): every word a known thing → one item each
  parts = parts.flatMap((p) => { const ws = p.split(/\s+/); return ws.length >= 2 && ws.length <= 8 && ws.every((w) => kindOf(w)) && ws.every((w) => !/^(?:of|a|an|the|some|من|كيلو|kilo|kg)$/i.test(w)) && new Set(ws.map(kindOf)).size >= 1 && !PAIRS.some(([pp]) => fold(p).includes(pp)) ? ws : [p]; });
  return parts.map((p) => p.replace(/^(?:[-•*▫◦·]|[\d١-٩]{1,2}\s*[).:-])\s*/u, "").trim()).filter((p) => p && !/^[\d١-٩]{1,2}\s*[).]?$/u.test(p)).map((p) => p.replace(/^و(?=(?:علبه|علبة|كيلو|ازازه|ازازة|نص|باكو)\s)/, "").replace(/^(?:some|a|an|the|more|شويه|شوية|حبة|حبه)\s+/i, "").replace(/[.!…]+$/, "").trim()).filter((p) => p && p.length <= 60);
}

export function readShopping(text0) {
  // (line breaks kept: a list written one item per line is still a list)
  let text = String(text0 || "").replace(/[‎‏؜]/g, "").replace(/[\p{Extended_Pictographic}️]/gu, " ").replace(/[ \t]+/g, " ").replace(/ *\n\s*/g, "\n").trim()
    .replace(/(?:[\s,،]*(?:please|pls|plz|thanks?|thank you|thx|ok|okay|for the (?:house|home)|لو سمحت|شكرا|تمام|للبيت|ماشي|law sama7t|shokran|lel beit|:\)|\bx\b|!+|\.+))+\s*$/i, "").trim();
  // a greeting, and where / when it's for ("when you go out", "on your way home", «وانت راجع», "law nzelt"), are not part of the list
  for (let k = 0; k < 4; k++) text = text.replace(/^(?:(?:hey|hi|ok|okay|so|um|btw|yo|attune|ya attune|bos|tab|tayeb|quick one|يا [اأإ]تيون|معلش|بص|طب|طيب)[\s,!:.…—-]+|(?:when you go out|on your way (?:home|back)|on the way home|after work|if you go out|when you're out|و?[اإ]نت راجع|و?[اإ]نتي راجعه|بعد الشغل|لو نزلت|(?:w )?enta rage3|law nzelt|ba3d el shoghl)[\s,،:—-]*)/i, "").trim();
  if (!text || text.length > 260) return null;
  if (NOT.test(fold(text))) return null;
  let rest = null, verb = false;
  // a header: "shopping list:", «طلبات البيت:», "talabat el beit:" — what follows is the list
  const hd = /^(?:shopping(?: list)?|groceries|grocery list|for the (?:house|home)|need from the (?:super ?market|market|store)|(?:super ?market|market)|to buy|طلبات البيت|مشتريات|من السوبر ?ماركت(?: هات)?|السوبر ماركت|talabat el beit|hat men el market|men el market)\s*:\s*/i.exec(text);
  if (hd) { rest = text.slice(hd[0].length); verb = true; }
  else for (const re of [VERB, VERB_AR, VERB_FR]) { const m = re.exec(text); if (m) { rest = text.slice(m[0].length); verb = true; break; } }
  if (!rest) rest = text;
  rest = rest.replace(/^(?:me\s+|لي\s+|ليا\s+)?/i, "").replace(/\s+(?:from|for|on the way|في السكه|في السكة|من السوبر ماركت|من السوبر|from the (?:super ?market|store|shop))(?:\s+.*)?$/i, "").trim();
  if (/\d{3,}/.test(rest)) return null;   // a price / an amount is money, not a list
  const items = splitItems(rest);
  if (!items.length) return null;
  const kinds = items.map(kindOf), known = kinds.filter(Boolean).length;
  // with no "buy" word, only a plain list of known things is a shopping list ("milk, eggs and bread")
  if (!verb && (known !== items.length || items.length < 2)) return null;
  if (!known) return null;
  const groups = [];
  items.forEach((it, i) => { if (!kinds[i]) return; let g = groups.find((x) => x.cat === kinds[i]); if (!g) groups.push((g = { cat: kinds[i], items: [] })); if (!g.items.some((x) => fold(x) === fold(it))) g.items.push(cap(it)); });
  return { groups, rest: items.filter((_, i) => !kinds[i]), verb };
}

/** Put the items into each kind's list (made once with `name(cat)` — the person's language — then found again by its kind). → { st, added: [{ listId, name, cat, items }], made: [listId…] } */
export function applyAuto(st0, read, { name = (c) => CAT_NAME[c], now = Date.now() } = {}) {
  let st = { ...(st0 || {}), lists: [...((st0 && st0.lists) || [])] };
  const added = [], made = [];
  for (const g of (read && read.groups) || []) {
    let i = st.lists.findIndex((l) => l && l.auto === g.cat);
    if (i < 0) { const l = { ...makeList({ name: name(g.cat), emoji: CAT_EMOJI[g.cat], items: [], now }), auto: g.cat }; st.lists = [l, ...st.lists]; i = 0; made.push(l.id); }
    const l = st.lists[i], have = new Set(l.items.filter((x) => !x.done).map((x) => fold(x.text)));
    const fresh = g.items.filter((t) => !have.has(fold(t)));
    const back = l.items.filter((x) => x.done && g.items.some((t) => fold(t) === fold(x.text))).map((x) => x.id);   // bought before, needed again → unticked
    st.lists[i] = { ...l, items: [...l.items.map((x) => (back.includes(x.id) ? { ...x, done: false } : x)), ...fresh.filter((t) => !l.items.some((x) => x.done && fold(x.text) === fold(t))).map((t, k) => ({ id: "i" + now.toString(36) + k + Math.random().toString(36).slice(2, 6), text: t.slice(0, 140), done: false }))] };
    added.push({ listId: l.id, name: l.name, cat: g.cat, items: g.items });
  }
  return { st, added, made };
}
