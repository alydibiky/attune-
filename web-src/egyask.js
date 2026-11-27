/* ---- v10.9.9 A2 (Ali picked: every "from my data" question tested like the barber — tests/mydata/gen.mjs found Egyptian and Franco
   questions about one's own data answered by nothing: «اشتراكاتي ايه؟», «دخلي كام الشهر ده؟», "sraft kam el shahr da?", «عليا كام لسارة؟»).
   egyToEnglish(q) → the same question in the English the code readers (lifeask / myledger) know, or "" when it is not one of them.
   Only the frame is changed: the thing asked about is mapped when it is a known everyday word (الأكل → food, el egar → rent), and a
   person's name stays as written. Pure; tests: tests/mydata/gen.mjs (10,000 HARD), tests/unit/v1099mydata.test.mjs. */
const F = (s) => String(s || "").replace(/[‎‏؜]/g, "").replace(/[أإآ]/g, "ا").replace(/ى(?=\s|$)/g, "ي").replace(/ة(?=\s|$|[؟?!.,])/g, "ه")
  .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/\s+/g, " ").trim();
// the end of a question: "?", thanks, emoji (never part of the thing)
const TAIL = /(?:[\s,.!:;)(—–-]|\p{Extended_Pictographic}|\uFE0F|\b(?:thanks|thank you|thx|ok|okay|pls|please|roughly|approx|approximately|about)\b|تمام|شكرا|شكرًا|لو سمحت|تقريبا|تقريبًا|ta2reeban|[?؟])+$/iu;
const LEAD = /^(?:(?:يا اتيون|يا أتيون|ya attune|طب|طيب|بقولك|سؤال|ممكن تقولي|قولي(?!\s+عن)|2oly|olly|hey|ok)[\s,،:]*)+/iu;
// time words → English
const TIMES = [[/(?:الشهر ده|الشهر دا|el shahr da|el sha?hr dah?)/i, "this month"], [/(?:الشهر اللي فات|الشهر الي فات|الشهر الماضي|el shahr (?:elly|eli|illi) fat)/i, "last month"],
  [/(?:الاسبوع ده|الاسبوع دا|el esbo3 da|el osbo3 da)/i, "this week"], [/(?:امبارح|embare7|mbare7)/i, "yesterday"], [/(?:النهارده|النهاردة|انهارده|el naharda|ennaharda|naharda)/i, "today"],
  [/(?:لحد دلوقتي|لحد النهارده|اجمالا|اجمالًا|في الاجمالي|le7ad delwa2ty|le7ad dlw2ty|lehad delwa2ty)/i, "in total"]];
// everyday things → English (longest first)
const THINGS = [["دكتور الاسنان|el doctor el asnan|doctor el asnan|دكتور اسنان", "dentist"], ["تامين العربيه|ta2meen el 3arabeya", "car insurance"], ["رخصه السواقه|الرخصه|el ro5sa", "driving licence"],
  ["جواز السفر|الباسبور|el basbor|el basport", "passport"], ["البطاقه|el beta2a", "national ID"], ["الاكل|el akl|el akel", "food"], ["البقاله|el be2ala", "groceries"], ["المواصلات|el mowasalat|el mwaslat", "transport"],
  ["الفواتير|el fawateer|el fawater", "bills"], ["الصحه|el se7a|el sa7a", "health"], ["التسوق|الشوبينج|el shopping", "shopping"], ["اوبر|uber", "uber"], ["طلبات|talabat", "talabat"], ["كارفور|carrefour", "carrefour"],
  ["نتفليكس|netflix", "netflix"], ["الجيم|el gym|el gim", "gym"], ["النت|الانترنت|el net|el internet", "internet"], ["الايجار|el egar|el iggar", "rent"], ["البنزين|el benzine|el banzeen", "fuel"],
  ["الحلاق|el 7ala2|el 7la2", "barber"], ["عربيتي|3arabeyty|3arabiti", "my car"], ["الدكتور|el doctor", "doctor"]].map(([a, e]) => [new RegExp("(?<![\\p{L}])(?:ل|لل|ب|في|ف)?(?:" + a + ")(?![\\p{L}])", "iu"), e]);
const thing = (s) => { let t = F(s).replace(TAIL, "").replace(/^(?:على|علي|عل|ل|لل|في|3ala|3la|3al|l|le|fe)\s+/i, "").trim(); for (const [re, e] of THINGS) if (re.test(t)) return t.replace(re, e).replace(/\s+/g, " ").trim(); return t; };
const timeOf = (s) => { for (const [re, e] of TIMES) if (re.test(s)) return e; return ""; };
const dropTime = (s) => { let t = s; for (const [re] of TIMES) t = t.replace(re, " "); return t.replace(/\s+/g, " ").trim(); };
const q = (s) => s.replace(/\s+/g, " ").trim().replace(/\s+\?$/, "?");

export function egyToEnglish(text) {
  const raw = F(text).replace(TAIL, "").replace(LEAD, "").trim();
  if (!raw || !/[؀-ۿ]|\b(?:sraft|dafa3t|2abadt|a5er|akher|3alaya|3aleh|3aleha|meen|eshtrakaty|felousi|3arabeyty|3andi|waraya|emta|beyentehy|bt?entehy|masarefy|da5ly)\b/i.test(raw)) return "";
  const tm = timeOf(raw), body = dropTime(raw), T = tm ? " " + tm : "";
  let m;
  // who owes me
  if (/^(?:مين|meen)\s+(?:لسه\s+|lessa\s+)?(?:عليه|عليها|عليهم|3aleh|3aleha)\s+(?:فلوس|felous)/i.test(body)) return "who owes me money?";
  // subscriptions
  if (/(?:اشتراكاتي|انا مشترك في ايه|بدفع اشتراك في ايه|eshtrakaty|ana moshtarek fe eh)/i.test(body)) return "what are my subscriptions?";
  // where did the money go
  if (/(?:فلوسي راحت فين|اكتر حاجه صرفت عليها|اكتر حاجة صرفت عليها|صرفت اكتر حاجه على ايه|felousi ra7et fein|aktar 7aga sraft 3aleha)/i.test(body)) return q("where did most of my money go" + (T || " this month") + "?");
  // income
  if (/^(?:دخلي|قبضت|كسبت|2abadt|ebadt|da5ly)\s*(?:كام|kam)?/i.test(body) || /^(?:كام|kam)\s+(?:دخلي|قبضت)/i.test(body)) return q("how much did I earn" + (T || " this month") + "?");
  // I owe X
  if ((m = /^(?:عليا|عليا فلوس|3alaya)\s+(?:(?:كام|kam)\s+)?(?:ل|لـ|l\s+|le\s+)\s*(.+?)(?:\s+(?:كام|kam))?$/i.exec(body)) || (m = /^(?:انا\s+)?(?:مديون|مديونه)\s+(?:ل|لـ)\s*(.+?)\s+(?:بكام|كام)$/i.exec(body)))
    return q("how much do I owe " + m[1].replace(/^ل/, "").trim() + "?");
  // X owes me
  if ((m = /^(.+?)\s+(?:لسه\s+)?(?:عليه|عليها|3aleh|3aleha)\s+(?:كام|فلوس(?:\s+ليا)?|kam|felous(?:\s+leya)?)$/i.exec(body))) return q("how much does " + m[1].trim() + " owe me?");
  // last time I paid X
  if ((m = /^(?:امتي|امتى)?\s*(?:اخر|آخر|a5er|akher)\s+(?:مره|مرة|mara|marra)\s+(?:دفعت|dafa3t)\s+(.+?)(?:\s+(?:امتي|امتى|كان امتى|emta))?$/i.exec(body))) return q("when did I last pay for " + thing(m[1]) + "?");
  // spent / paid how much (on X) (time)
  if ((m = /^(?:صرفت|دفعت|sraft|dafa3t)\s+(?:كام|kam|قد ايه|اد ايه)(?:\s+(.+))?$/i.exec(body)) || (m = /^(?:كام|kam)\s+(?:صرفت|دفعت|sraft|dafa3t)(?:\s+(.+))?$/i.exec(body))) {
    const x = m[1] ? thing(m[1]) : "";
    if (!x) return q("how much did I spend" + (T || " this month") + "?");
    return q((tm === "in total" ? "how much have I paid for " + x + " in total" : "how much did I spend on " + x + T) + "?");
  }
  if ((m = /^(.+?)\s+(?:صرفت|دفعت)\s+(?:فيه|فيها|عليه|عليها)?\s*(?:كام|اد ايه)$/i.exec(body))) return q("how much did I spend on " + thing(m[1]) + T + "?");
  if (/^(?:مصاريفي|مصروفاتي|masarefy)\s*(?:كام)?$/i.test(body) || /^(?:مصاريفي|مصروفاتي)\s+كام/i.test(body)) return q("how much did I spend" + (T || " this month") + "?");
  // what do I have (this week)
  if (/^(?:عندي|ورايا|3andi|waraya)\s+(?:ايه|اي|eh)$/i.test(body) && tm === "this week") return "what's due this week?";
  // X expires
  if ((m = /^(.+?)\s+(?:بتاعي|بتاعتي|bta3i|bta3ty)?\s*(?:بينتهي|بتنتهي|هينتهي|هتنتهي|ينتهي|تنتهي|beyentehy|betentehy|bentehy|hayentehy)\s*(?:امتي|امتى|emta)?$/i.exec(body))) return q("when does my " + thing(m[1]) + " expire?");
  // when is X (an appointment)
  if ((m = /^(?:ميعاد\s+)?(.+?)\s+(?:امتي|امتى|emta)$/i.exec(body)) && !/(?:اخر|آخر|a5er)\s+(?:مره|مرة|mara)/i.test(body)) return q("when is my " + thing(m[1]).replace(/^my\s+/, "") + "?");
  // my car / what is X
  if ((m = /^(?:قولي عن|احكيلي عن)\s+(.+)$/i.exec(body)) || (m = /^(.+?)\s+(?:ايه|eh)$/i.exec(body)) && /عربيتي|3arabeyty|my car/i.test(thing(m[1]))) return "tell me about " + thing(m[1]).replace(/^(?!my )/, "my ");
  return "";
}
