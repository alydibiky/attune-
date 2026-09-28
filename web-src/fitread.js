/* ---- Fit & Food: reading what someone ate, like a dietitian would (v6.3) ---------------------
   Ali: "an AI inputting food like Yazio … smart at everything, even minor details". The code reads
   the sentence first — instant, offline, exact — and only what it can't place goes to the model:
     · numbers in digits, Arabic digits, words (two / اتنين), fractions (half, ربع, 1/2), "x3"
     · Arabic duals: بيضتين, رغيفين, حتتين, معلقتين, كوبايتين, علبتين …
     · weights: 200g, ٢٠٠ جرام, ربع كيلو, نص كيلو, 250 ml
     · units: plate/طبق, cup/كوباية, spoon/معلقة, can/علبة, bottle/ازازة, loaf/رغيف, skewer/سيخ …
     · sizes: small/صغير, large/big/كبير, and "half a chicken" / «نص فرخة»
     · what people call things: pepsi → cola, falafel → taameya, «بانيه» → chicken pane …
     · "X with Y" / «X بـY»: Y is its own food (honey, milk, chicken) unless X-with-Y is one dish
     · meals: "a big mac meal" → burger + fries + drink; "no sugar" / «من غير سكر» adds nothing
   Every amount then passes a plausibility check (no 500 g of oil, no 30 kg of chicken).        */
import { FOODS, food, matchFood, gramsOf, nutrients, unitNorm } from "./fit.js";

const r1 = (v) => Math.round(v * 10) / 10;
export const normA = (s) => String(s || "").toLowerCase()
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
  .replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة(?=\s|$)/g, "ه").replace(/ى(?=\s|$)/g, "ي")
  .replace(/[“”"'`!?؟]/g, " ").replace(/\s+/g, " ").trim();

// ---- what people call foods (phrase → food id, optional unit/qty) — longest phrases win ----
const A = [
  // drinks
  ["tea with milk|milk tea|شاي بلبن|شاي بالحليب|شاي باللبن|شاي حليب", "tea-milk"], ["green tea|شاي اخضر", "green-tea"], ["mint tea|شاي بالنعناع|شاي نعناع", "mint-tea"],
  ["tea|شاي|شاي احمر|كوباية شاي", "tea"], ["turkish coffee|قهوه تركي|قهوه تركيه|قهوه", "turkish-coffee"], ["coffee|كوفي", "coffee"],
  ["nescafe|نسكافيه|نس كافيه|3 in 1|٣ في ١", "nescafe"], ["latte|لاتيه", "latte"], ["cappuccino|كابتشينو|كابوتشينو", "cappuccino"],
  ["diet coke|coke zero|pepsi diet|diet pepsi|pepsi max|كوكاكولا زيرو|بيبسي دايت|بيبسي زيرو", "diet-cola"],
  ["coca cola|coca-cola|cocacola|coke|pepsi|cola|soda|soft drink|كوكاكولا|كوكا كولا|بيبسي|كولا|سفن اب|7up|sprite|سبرايت|fanta|فانتا|مياه غازيه|حاجه ساقعه", "cola"],
  ["orange juice|عصير برتقان|عصير برتقال|برتقان فريش", "orange-juice"], ["mango juice|عصير مانجه|عصير مانجا", "mango-juice"], ["guava juice|عصير جوافه", "guava-juice"],
  ["sugarcane|sugar cane|عصير قصب|قصب", "sugarcane"], ["hibiscus|karkade|karkadeh|كركديه", "karkadeh"], ["sobia|سوبيا", "sobia"], ["sahlab|سحلب", "sahlab"],
  ["water|مياه|ميه|مية", "water"], ["energy drink|red bull|ريد بول|مشروب طاقه", "energy-drink"], ["milkshake|ميلك شيك", "milkshake"], ["smoothie|سموذي", "smoothie"],
  ["skim milk|skimmed milk|لبن خالي الدسم|حليب خالي الدسم", "milk-skim"], ["milk|لبن|حليب", "milk"], ["laban rayeb|لبن رايب|رايب", "laban-rayeb"],
  ["hot chocolate|هوت شوكليت|شوكولاته ساخنه", "hot-chocolate"], ["iced coffee|ايس كوفي|قهوه مثلجه", "iced-coffee"],
  // breads / breakfast
  ["baladi bread|baladi|egyptian bread|aish|عيش بلدي|عيش|رغيف|خبز بلدي|خبز", "baladi", { unit: "loaf" }], ["pita|shami|عيش شامي|شامي", "shami", { unit: "loaf" }],
  ["brown toast|toast brown|توست اسمر|توست بني", "toast-brown", { unit: "slice" }], ["toast|توست", "toast-white", { unit: "slice" }], ["fino|فينو", "fino"],
  ["croissant|كرواسون|كرواسان", "croissant"], ["feteer|fetir|فطير|فطيره|فطير مشلتت|فطيره مشلتته|مشلتت", "feteer"],
  ["falafel|taameya|ta3meya|طعميه|فلافل", "taameya", { unit: "piece" }],
  ["ful with oil|ful bil zeit|فول بالزيت الحار|فول بالزيت|فول بالزيت الحار والكمون", "ful-oil", { unit: "plate" }], ["ful|foul|fava beans|فول|فول مدمس", "ful", { unit: "plate" }],
  ["boiled eggs|boiled egg|hard boiled egg|بيض مسلوق|بيضه مسلوقه", "egg", { unit: "piece" }], ["fried eggs|fried egg|sunny side|بيض مقلي|بيضه مقليه|بيض عيون", "egg-fried", { unit: "piece" }],
  ["scrambled eggs|scrambled|بيض مخفوق|بيض اسكرامبل", "egg-scrambled"], ["omelette|omelet|اومليت|أومليت|عجه", "egg", { unit: "piece", eggs: true }],
  ["eggs|egg|بيض|بيضه|بيضات", "egg", { unit: "piece" }],
  ["cornflakes|corn flakes|cereal|كورن فليكس|كورنفليكس|سيريال", "cornflakes", { unit: "bowl" }], ["oatmeal|oats|porridge|شوفان", "oats", { unit: "bowl" }],
  ["greek yogurt|زبادي يوناني", "greek-yogurt", { unit: "pot" }], ["yogurt|yoghurt|زبادي|زبادي عادي", "yogurt", { unit: "pot" }],
  ["cheese|white cheese|feta|جبنه بيضا|جبنه بيضاء|جبنه دمياطي|جبنه فيتا|جبنه", "feta", { unit: "piece" }], ["roumi|rumi cheese|جبنه رومي|رومي", "roumi", { unit: "slice" }],
  ["cheese triangle|la vache|جبنه نستو|جبنه مثلثات|بقره ضاحكه", "triangle-cheese", { unit: "piece" }], ["cheddar|شيدر", "cheddar"], ["mozzarella|موتزاريلا", "mozzarella"],
  ["honey|عسل|عسل نحل", "honey", { unit: "tbsp" }], ["jam|مربي", "jam", { unit: "tbsp" }], ["molasses|عسل اسود", "molasses", { unit: "tbsp" }],
  ["peanut butter|زبده فول سوداني|زبده فول", "peanut-butter", { unit: "tbsp" }], ["nutella|نوتيلا", "nutella", { unit: "tbsp" }], ["halawa|halva|حلاوه", "halawa"],
  ["butter|زبده", "butter", { unit: "tbsp" }], ["ghee|samna|سمنه|سمن", "ghee", { unit: "tbsp" }], ["olive oil|زيت زيتون", "olive-oil", { unit: "tbsp" }], ["oil|زيت", "olive-oil", { unit: "tbsp" }],
  ["sugar|سكر", "sugar", { unit: "tsp" }], ["sweetener|stevia|سكر دايت|محلي صناعي", "sweetener"],
  // Egyptian dishes
  ["koshari|koshary|kushari|كشري", "koshari", { unit: "plate" }], ["molokhia|mulukhiyah|ملوخيه", "molokhia", { unit: "plate" }],
  ["macaroni bechamel|pasta bechamel|bechamel|مكرونه بشاميل|بشاميل", "bechamel", { unit: "plate" }], ["mahshi|stuffed vegetables|محشي|محشي كرنب|محشي كوسه|محشي فلفل", "mahshi", { unit: "piece" }],
  ["vine leaves|stuffed vine|grape leaves|محشي ورق عنب|ورق عنب", "stuffed-vine", { unit: "piece" }],
  ["fatta|فته", "fatta", { unit: "plate" }], ["hawawshi|حواوشي", "hawawshi"], ["om ali|umm ali|ام علي", "om-ali"], ["rice pudding|roz bel laban|رز بلبن|ارز باللبن", "roz-laban"],
  ["basbousa|بسبوسه", "basbousa"], ["konafa|kunafa|knafeh|كنافه", "konafa", { unit: "piece" }], ["qatayef|قطايف", "qatayef"], ["zalabya|زلابيه|لقمه القاضي", "zalabya"],
  ["mombar|ممبار", "mombar", { unit: "plate" }], ["alexandrian liver|kebda eskandarani|كبده اسكندراني|كبده", "kebda-iskandarani", { unit: "plate" }],
  ["liver sandwich|ساندوتش كبده|سندوتش كبده", "liver-sandwich"], ["sogo2|sausage sandwich|سجق|ساندوتش سجق", "sogo2"],
  ["fasolia|green beans stew|فاصوليا|فاصوليا خضرا", "fasolia", { unit: "plate" }], ["bamia|okra stew|بامیه|باميه", "bamia", { unit: "plate" }],
  ["lentil soup|شوربه عدس|عدس", "lentil-soup", { unit: "bowl" }], ["chicken soup|شوربه فراخ", "chicken-soup", { unit: "bowl" }], ["vegetable soup|شوربه خضار", "vegetable-soup", { unit: "bowl" }],
  ["sayadeya|fish sayadeya|صياديه|رز صياديه", "fish-sayadeya", { unit: "plate" }], ["kabsa|كبسه", "kabsa", { unit: "plate" }], ["mandi|مندي", "mandi", { unit: "plate" }], ["biryani|برياني", "biryani", { unit: "plate" }],
  ["tabbouleh|تبوله", "tabbouleh"], ["fattoush|فتوش", "fattoush"], ["mujadara|مجدره", "mujadara"], ["kishk|كشك", "kishk"], ["bessara|بصاره", "bessara"],
  ["hummus|حمص|حمص بالطحينه", "hummus", { unit: "plate", small: 80 }], ["baba ghanoush|بابا غنوج", "baba"], ["tahini|طحينه", "tahini", { unit: "tbsp" }],
  ["salad|green salad|سلطه|سلطه خضرا|سلطه خضراء", "salad", { unit: "plate" }], ["caesar salad|caesar|سلطه سيزر|سيزر", "caesar", { unit: "plate" }], ["greek salad|سلطه يوناني", "greek-salad", { unit: "plate" }],
  ["pickles|مخلل|طرشي", "pickles"], ["olives|زيتون", "olives", { unit: "handful" }],
  // meat / chicken / fish
  ["grilled chicken|chicken grilled|roast chicken|فرخه مشويه|فراخ مشويه|فرخه|دجاج مشوي", "chicken-grilled-half", { unit: "half", whole: true }],
  ["grilled chicken breast|chicken breast grilled|صدور فراخ مشويه|صدر فراخ مشوي|صدور مشويه", "chicken-breast", { unit: "piece" }],
  ["chicken pane|chicken panee|pane|panee|فراخ بانيه|بانيه", "chicken-panee", { unit: "piece" }], ["fried chicken|فراخ مقليه|بروستد|كنتاكي", "chicken-fried", { unit: "piece" }],
  ["chicken wings|wings|اجنحه|جوانح", "chicken-wings", { unit: "piece" }], ["shish tawook|shish|شيش طاووق|شيش", "chicken-shish", { unit: "skewer" }],
  ["chicken nuggets|nuggets|ناجتس", "chicken-nuggets", { unit: "piece" }], ["chicken breast|chicken breasts|صدور فراخ|صدر فراخ|صدر دجاج", "chicken-breast", { unit: "piece" }],
  ["chicken|فراخ|دجاج|فرخه", "chicken-breast", { unit: "portion" }],
  ["kofta|كفته", "kofta", { unit: "skewer" }], ["kebab|kabab|كباب", "kebab", { unit: "skewer" }], ["hawawshi|حواوشي", "hawawshi"],
  ["steak|beef|meat|لحمه|لحم|ستيك", "beef", { unit: "portion" }], ["lamb|ضاني|لحم ضاني", "lamb"], ["liver|كبده بلدي", "liver"],
  ["shawarma plate|طبق شاورما", "shawarma-plate"], ["meat shawarma|beef shawarma|شاورما لحمه|شاورما لحم", "meat-shawarma"],
  ["shawarma|chicken shawarma|شاورما|شاورما فراخ", "shawarma-sandwich"],
  ["fried fish|سمك مقلي", "fish-fried"], ["fish|grilled fish|سمك|سمك مشوي", "fish", { unit: "piece" }], ["salmon|سالمون|سلمون", "salmon"],
  ["shrimp|prawns|جمبري", "shrimp", { unit: "portion" }], ["calamari|squid|كاليماري|سبيط", "calamari"], ["sardines|سردين", "sardines", { unit: "can" }],
  ["tuna in water|tuna water|تونه مياه|تونه في المياه|تونه لايت", "tuna-water", { unit: "can" }], ["tuna|تونه", "tuna-oil", { unit: "can" }],
  ["luncheon|لانشون", "luncheon"], ["pastrami|بسطرمه", "pastrami"], ["hot dog|هوت دوج", "hotdog-sandwich"],
  // fast food
  ["big mac|bigmac|بيج ماك|double burger|دبل برجر", "big-burger"], ["chicken burger|برجر فراخ|ساندوتش برجر فراخ|زنجر|zinger", "chicken-burger"], ["burger|hamburger|برجر|برجر لحمه", "burger"],
  ["pepperoni pizza|pizza pepperoni|بيتزا بيبروني", "pizza-pepperoni", { unit: "slice" }], ["chicken pizza|pizza chicken|بيتزا فراخ", "pizza-chicken", { unit: "slice" }], ["pizza|بيتزا", "pizza", { unit: "slice", wholeN: 8 }],
  ["fries|french fries|chips fries|بطاطس محمره|بطاطس مقليه|فرايز|بطاطس", "fries", { unit: "portion" }], ["onion rings|اونيون رينج", "onion-rings"],
  ["sushi|سوشي", "sushi", { unit: "piece" }], ["noodles|indomie|اندومي|نودلز", "noodles"], ["fried rice|رز مقلي", "fried-rice"],
  ["pasta with red sauce|red sauce pasta|pasta red|مكرونه صلصه|مكرونه بالصلصه|مكرونه حمرا", "pasta-red"], ["white sauce pasta|alfredo|مكرونه وايت صوص|الفريدو", "pasta-white"],
  ["negresco|نجرسكو", "pasta-negresco"], ["lasagna|لازانيا", "lasagna"], ["pasta|spaghetti|macaroni|مكرونه|اسباجتي", "pasta", { unit: "plate" }],
  ["rice|white rice|رز|ارز|رز ابيض", "rice", { unit: "plate", side: 180 }], ["basmati|بسمتي", "basmati"],
  ["club sandwich|كلوب ساندوتش", "club-sandwich"], ["tuna sandwich|ساندوتش تونه", "tuna-sandwich"], ["cheese sandwich|ساندوتش جبنه", "cheese-sandwich"],
  ["ful sandwich|ساندوتش فول|سندوتش فول", "ful-sandwich"], ["falafel sandwich|taameya sandwich|ساندوتش طعميه|سندوتش طعميه", "taameya-sandwich"],
  ["crepe|كريب", "crepe"], ["waffle|وافل", "waffle"], ["pancakes|pancake|بان كيك", "pancake", { unit: "piece" }], ["donut|doughnut|دونات", "donut"],
  // sweets / snacks
  ["chocolate|cadbury|galaxy|شوكولاته|كادبوري|جالكسي", "chocolate", { unit: "bar" }], ["ice cream|ايس كريم|جيلاتي", "ice-cream", { unit: "scoop" }],
  ["cake|كيك|كيكه|تورته", "cake", { unit: "slice", wholeN: 10 }], ["biscuits|cookies|بسكويت|كوكيز", "biscuits", { unit: "piece" }], ["chips|crisps|شيبسي|شيبس|chipsy", "chips", { unit: "bag" }],
  ["popcorn|فشار", "popcorn"], ["kahk|كحك", "kahk"], ["baklava|بقلاوه", "baklava"], ["wafer|ويفر|كيت كات|kitkat", "wafer"], ["protein bar|بروتين بار", "protein-bar"],
  ["whey|protein shake|scoop of whey|واي بروتين|بروتين", "whey", { unit: "scoop" }],
  // fruit / veg / nuts
  ["banana|bananas|موز|موزه", "banana"], ["apple|apples|تفاح|تفاحه", "apple"], ["orange|oranges|برتقان|برتقال|برتقانه", "orange"], ["mango|مانجه|مانجا|منجه", "mango"],
  ["guava|جوافه", "guava"], ["watermelon|بطيخ", "watermelon", { unit: "slice" }], ["grapes|عنب", "grapes", { unit: "cup" }], ["dates|date|تمر|تمرات|بلح", "dates", { unit: "piece" }],
  ["strawberries|strawberry|فراوله", "strawberries", { unit: "cup" }], ["pomegranate|رمان", "pomegranate"], ["figs|تين", "figs"], ["kiwi|كيوي", "kiwi"], ["peach|خوخ", "peach"],
  ["almonds|لوز", "almonds", { unit: "handful" }], ["peanuts|سوداني|فول سوداني", "peanuts", { unit: "handful" }], ["walnuts|عين جمل", "walnuts", { unit: "handful" }],
  ["cashews|كاجو", "cashews", { unit: "handful" }], ["pistachio|فستق", "pistachio", { unit: "handful" }], ["sunflower seeds|لب", "sunflower-seeds", { unit: "handful" }],
  ["tomato|طماطم|قوطه", "tomato"], ["cucumber|خيار|خياره", "cucumber"], ["potato|potatoes|بطاطس مسلوقه|بطاطس بالفرن|baked potato", "potato"], ["sweet potato|بطاطا", "sweet-potato"],
  ["avocado|افوكادو", "avocado"], ["corn|ذره", "corn"],
  ["ketchup|كاتشب", "ketchup", { unit: "tbsp" }], ["mayonnaise|mayo|مايونيز", "mayonnaise", { unit: "tbsp" }], ["garlic sauce|toum|ثوميه", "garlic-sauce", { unit: "tbsp" }],
];
const ALIAS = [];
for (const [names, id, opt] of A) for (const n of names.split("|")) ALIAS.push({ n: normA(n), id, opt: opt || {} });
ALIAS.sort((a, b) => b.n.length - a.n.length);

// ---- numbers, units, sizes ----
const WORDN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, half: 0.5, quarter: 0.25, third: 1 / 3, couple: 2, few: 3,
  واحد: 1, واحده: 1, اتنين: 2, اثنين: 2, تلاته: 3, ثلاثه: 3, تلات: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, سبع: 7, تمنيه: 8, تمانيه: 8, تسعه: 9, عشره: 10, عشر: 10, نص: 0.5, نصف: 0.5, ربع: 0.25, تلت: 1 / 3, ثلث: 1 / 3 };
// Arabic dual (…ين / …تين) → 2 of a unit or a food
const DUALS = { بيضتين: ["egg", 2], رغيفين: ["@loaf", 2], حتتين: ["@piece", 2], معلقتين: ["@spoon", 2], كوبايتين: ["@cup", 2], طبقين: ["@plate", 2], علبتين: ["@can", 2],
  ساندوتشين: ["@sandwich", 2], سندوتشين: ["@sandwich", 2], شريحتين: ["@slice", 2], سيخين: ["@skewer", 2], ازازتين: ["@bottle", 2], فنجانين: ["@cup", 2], بولتين: ["@scoop", 2], كيسين: ["@bag", 2],
  تمرتين: ["dates", 2], موزتين: ["banana", 2], تفاحتين: ["apple", 2], برتقانتين: ["orange", 2], صباعين: ["@piece", 2], قطعتين: ["@piece", 2], حبتين: ["@piece", 2] };
const UNITS = [
  ["tablespoons|tablespoon|tbsp|tbs|معالق كبيره|معلقه كبيره|معلقة كبيرة", "tbsp"], ["teaspoons|teaspoon|tsp|معلقه صغيره|معالق صغيره", "tsp"],
  ["spoons|spoon|معالق|معلقه|ملعقه|ملاعق|معلقتين", "spoon"], ["cups|cup|mugs|mug|كوبايه|كوبايات|كوب|فنجان|فناجين", "cup"], ["glasses|glass|كاس|كاسات", "glass"],
  ["plates|plate|dish|اطباق|طبق|صحن", "plate"], ["bowls|bowl|سلطانيه|بوله", "bowl"], ["cans|can|tin|علب|علبه", "can"], ["bottles|bottle|ازايز|ازازه|زجاجه|قزازه", "bottle"],
  ["loaves|loaf|ارغفه|رغيف", "loaf"], ["slices|slice|شرايح|شريحه|شرائح", "slice"], ["pieces|piece|pcs|pc|حتت|حته|قطع|قطعه|حبات|حبه|صوابع|صباع", "piece"],
  ["sandwiches|sandwich|sub|ساندوتشات|ساندوتش|سندوتش", "sandwich"], ["skewers|skewer|اسياخ|سيخ", "skewer"], ["scoops|scoop|بولات|بولتين|بولة", "scoop"],
  ["handfuls|handful|كف|حفنه|قبضه", "handful"], ["bags|bag|packet|pack|اكياس|كيس|باكو|باكيت", "bag"], ["bars|bar|لوح|بار", "bar"], ["pots|pot|cartons|علبه زبادي", "pot"],
  ["portions|portion|servings|serving|حصه|حصص|بورشن", "portion"], ["fillets|fillet|فيليه", "fillet"],
];
const UNIT_RX = UNITS.map(([w, u]) => [new RegExp("(^|\\s)(" + w.split("|").map((x) => normA(x)).join("|") + ")(?=\\s|$)"), u]);
const SIZE = [[/(^|\s)(small|صغير|صغيره|سمول)(?=\s|$)/, "small", 0.7], [/(^|\s)(large|big|huge|كبير|كبيره|لارج|جامبو|عائلي)(?=\s|$)/, "large", 1.35], [/(^|\s)(medium|وسط|ميديم)(?=\s|$)/, "medium", 1]];

/** How many grams "qty unit" of this food is, with the food's own portions first. */
function gramsFor(fd, qty, unit, opt = {}) {
  const P = fd.portions || {};
  const pick = (u) => P[u] ?? (u === "spoon" ? P.tbsp ?? P.spoon : u === "tbsp" ? P.spoon : u === "glass" ? P.cup : u === "cup" ? P.glass : u === "bowl" ? P.plate : u === "plate" ? P.bowl
    : u === "can" ? P.pot ?? P.box ?? P.pack : u === "pot" ? P.can ?? P.cup : u === "bag" ? P.pack ?? P.box : undefined);   // «علبة زبادي» is a tub, not a 330 ml can
  if (unit === "g" || unit === "ml") return qty;
  if (unit === "kg" || unit === "l") return qty * 1000;
  if (unit && pick(unit) != null) return qty * pick(unit);
  if (unit === "spoon") return qty * (fd.id === "sugar" || fd.id === "honey" && false ? 4 : 15);
  return gramsOf(fd, qty, unit || "serving");
}

/**
 * Read one sentence of eating. → { items: [logged items], unknown: ["words the code couldn't place"] }
 * Items carry: id, name, ar, qty, unit, grams, kcal, p, c, f, fib, and flag (an amount that looks wrong).
 */
export function readMealText(text) {
  let t = " " + normA(text) + " ";
  // filler: "I (just) had / ate", "for lunch", «كلت», «فطرت» …
  t = t.replace(/\b(i|i've|ive|just|had|ate|have|eaten|drank|drink|for|my|today|breakfast|lunch|dinner|snack|supper)\b/g, " ")
    .replace(/(^|\s)(كلت|اكلت|فطرت|اتغديت|اتعشيت|شربت|النهارده|فطار|غدا|عشا|سناك|على|علي)(?=\s|$)/g, " ").replace(/:/g, " ");
  const noSugar = /(no sugar|without sugar|sugar free|unsweetened|من غير سكر|بدون سكر|سكر خفيف لا|ساده)/.test(t);
  t = t.replace(/(no sugar|without sugar|sugar free|unsweetened|من غير سكر|بدون سكر|ساده)/g, " ");
  const meal = /\b(meal|combo)\b|وجبه|كومبو/.test(t);
  // "x3", "×3", "3x" → " 3 "
  t = t.replace(/\s[x×]\s?(\d+)/g, " $1 ").replace(/(\d+)\s?[x×]\s/g, " $1 ");
  // weights with kilo fractions: ربع كيلو / نص كيلو / half a kilo / 1.5 kg
  t = t.replace(/(ربع|quarter)( a)? (كيلو|kilo|kg)/g, " 250 g ").replace(/(نص|نصف|half)( a)? (كيلو|kilo|kg)/g, " 500 g ").replace(/(تلت|third)( a)? (كيلو|kilo|kg)/g, " 333 g ")
    .replace(/(\d+(?:\.\d+)?)\s?(كيلو|kilo|kg)(?=\s|$)/g, (_, n) => ` ${Math.round(+n * 1000)} g `).replace(/(^|\s)كيلو(?=\s)/g, " 1000 g ")
    .replace(/(\d+(?:\.\d+)?)\s?(g|gm|gr|gram|grams|جم|جرام|غرام|جرامات)(?=\s|$)/g, " $1 g ").replace(/(\d+(?:\.\d+)?)\s?(ml|مل|مللي)(?=\s|$)/g, " $1 ml ")
    .replace(/(\d+)\s?\/\s?(\d+)/g, (_, a, b) => " " + (+a / +b) + " ");
  // Arabic «بالـ…» / «بـ…» after a food → its own item (honey, milk, chicken); "with" likewise
  // «و»/«ب» glued to an amount word: «بمعلقتين سكر», «ورغيفين» → their own part
  t = t.replace(/(\s)(و|ب|وب)(?=(معلقتين|معلقه|معالق|كوبايه|كوبايتين|رغيف|رغيفين|طبق|طبقين|علبه|علبتين|حته|حتتين|بيضتين|ساندوتش|سندوتش|فنجان|كيس|\d)(\s|$|\d))/g, " + ");
  // aliases → markers, longest first
  const marks = [];
  for (const a of ALIAS) {
    // «وبيبسي», «بالعسل», «واللبن», «الرز»: a glued «و/ب/بال/ال» before a food — «و»/«ب» start a new part
    const rx = new RegExp("(^|\\s)(وبال|وال|بال|و|ب|ال)?" + a.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=\\s|$)", "g");
    t = t.replace(rx, (m, pre, glued) => {
      if (glued && /^ال/.test(a.n)) return m;
      marks.push({ ...a }); return pre + (glued && glued !== "ال" ? " + " : " ") + "@" + (marks.length - 1) + "@ ";   // a copy: a reading never changes the shared list
    });
  }
  // duals
  t = t.replace(/(^|\s)(\S+)(?=\s|$)/g, (m, pre, w) => { const d = DUALS[w]; if (!d) return m; if (d[0][0] === "@") return pre + " 2 " + d[0].slice(1) + " "; marks.push({ id: d[0], opt: {}, n: w }); return pre + " 2 @" + (marks.length - 1) + "@ "; });
  // chunks: , ، + & and و and with / مع
  const chunks = t.split(/\s(?:,|،|\+|&|and|with|plus|then|و|مع|ومعاه|ومعاها)\s|,|،|\+|\s و(?=@)/).map((x) => x.trim()).filter(Boolean);
  const items = [], unknown = [];
  let lastFood = null;
  for (let ch of chunks) {
    ch = " " + ch.replace(/(^|\s)و(?=@|\d)/g, " ") + " ";
    const ms = [...ch.matchAll(/@(\d+)@/g)].map((m) => marks[+m[1]]);
    // a chunk that is only an amount ("x2", "2 pieces") refers to the food before it
    let qty = null, unit = null, size = null, sizeK = 1;
    const num = ch.match(/(^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
    if (num) qty = +num[2];
    else { const w = ch.split(" ").find((x) => WORDN[x] != null); if (w) qty = WORDN[w]; }
    if (/(^|\s)g(?=\s|$)/.test(ch)) unit = "g"; else if (/(^|\s)ml(?=\s|$)/.test(ch)) unit = "ml";
    else for (const [rx, u] of UNIT_RX) if (rx.test(ch)) { unit = u; break; }
    for (const [rx, s, k] of SIZE) if (rx.test(ch)) { size = s; sizeK = k; break; }
    const halfWord = /(^|\s)(half|نص|نصف)(?=\s|$)/.test(ch), quarterWord = /(^|\s)(quarter|ربع)(?=\s|$)/.test(ch);
    if (!ms.length) {
      const words = ch.replace(/\d+(\.\d+)?|(^|\s)(g|ml)(?=\s|$)/g, " ").split(" ").filter((w) => w && WORDN[w] == null && !UNIT_RX.some(([rx]) => rx.test(" " + w + " ")) && !SIZE.some(([rx]) => rx.test(" " + w + " ")) && !/^(of|the|some|a|an|من|شويه|حبه)$/.test(w)).join(" ");
      if (!words && lastFood && qty != null) { const it = items[items.length - 1]; const g = gramsFor(lastFood, qty, unit || it.unit); items[items.length - 1] = makeItem(lastFood, qty, unit || it.unit, g); continue; }
      if (!words) continue;
      const fd = matchFood(words);
      if (fd) { const g = gramsFor(fd, qty ?? 1, unit, {}) * (size && !(fd.portions || {})[size] ? sizeK : 1); items.push(makeItem(fd, qty ?? 1, unit || "serving", g)); lastFood = fd; }
      else unknown.push(words);
      continue;
    }
    // each food gets the amount written just before it (or, for the last one, just after it)
    const segs = ch.split(/@\d+@/);
    const amountOf = (seg) => {
      let q = null, u = null;
      const n = seg.match(/(^|\s)(\d+(?:\.\d+)?)(?=\s|$)/); if (n) q = +n[2]; else { const w = seg.split(" ").find((x) => WORDN[x] != null); if (w) q = WORDN[w]; }
      if (/(^|\s)g(?=\s|$)/.test(seg)) u = "g"; else if (/(^|\s)ml(?=\s|$)/.test(seg)) u = "ml"; else for (const [rx, uu] of UNIT_RX) if (rx.test(seg)) { u = uu; break; }
      return { q, u, any: q != null || u != null };
    };
    // two foods written side by side with nothing between them are one food: the generic word
    // ("beef" burger, «رغيف» شامي, «فرخة» بانيه) gives way to the specific one
    const GENERIC = new Set(["beef", "chicken-breast", "chicken-grilled-half", "baladi", "olive-oil", "egg", "feta", "rice", "pasta", "fish", "lamb"]);
    for (let k = 0; k + 1 < ms.length; k++) {
      if (segs[k + 1].trim() !== "") continue;
      const a = ms[k], b = ms[k + 1];
      if (a.id === b.id) continue;
      if (GENERIC.has(a.id) && !GENERIC.has(b.id)) { a.skip = true; b.qty2 = b.qty2 || (segs[k].trim() ? { ...{ q: null, u: null }, any: false } : null); b.preSeg = segs[k]; }
      else if (GENERIC.has(b.id) && !GENERIC.has(a.id)) b.skip = true;
    }
    // the same food named twice in one part («شوكولاتة كادبوري», "omelette of 3 eggs") is one food
    const seen = new Map();
    ms.forEach((m, k) => {
      const key = /^egg/.test(m.id) ? "egg*" : m.id;
      if (seen.has(key)) { const j = seen.get(key); const a = amountOf(segs[k]); if (a.q != null) { ms[j].eggQ = a.q; if (!ms[j].qty2) ms[j].qty2 = a; } m.skip = true; }
      else seen.set(key, k);
    });
    ms.forEach((m, k) => {
      if (m.skip) return;
      if (m.id === "sugar" && noSugar) return;
      let fd = food(m.id); if (!fd) return;
      const pre = amountOf(m.preSeg != null ? m.preSeg + " " + segs[k] : segs[k]), post = k === ms.length - 1 ? amountOf(segs[k + 1] || "") : { any: false };
      const am = pre.any ? pre : post.any ? post : m.qty2 || { q: null, u: null };
      let q = am.q, u = am.u;
      // fried written next to the food («بيضتين مقليين», "fried chicken")
      if (/(^|\s)(fried|مقلي|مقليه|مقليين|محمر|محمره)(?=\s|$)/.test(ch)) { const alt = { egg: "egg-fried", "chicken-breast": "chicken-fried", fish: "fish-fried", potato: "fries" }[fd.id]; if (alt && food(alt)) fd = food(alt); }
      const o = m.opt || {};
      // "half a chicken" / «نص فرخة» / "quarter chicken": the whole-bird dish, by its half / quarter portion
      if (o.whole) { u = quarterWord ? "quarter" : "half"; q = 1; if (qty && qty >= 1 && !halfWord && !quarterWord && k === 0) { q = qty; } }
      else if (halfWord && q === 0.5 && !u && !o.wholeN) { u = o.unit || null; }
      if (o.eggs) { q = m.eggQ ?? q ?? 2; u = "piece"; }
      // «ساندوتشين طعمية», "2 kofta sandwiches": a filling eaten as a sandwich is the sandwich
      if (u === "sandwich" && !(fd.portions || {}).sandwich) { const sw = food(fd.id + "-sandwich"); if (sw) fd = sw; }
      // "half a pizza" / «نص تورتة»: a fraction of the whole thing (8 slices of pizza, 10 of cake)
      if (o.wholeN && q != null && q < 1 && !u) { q = q * o.wholeN; u = o.unit; }
      if (size && (fd.portions || {})[size] && (u == null || u === "plate" || u === "bowl" || u === "portion")) u = size;   // «طبق كشري كبير» → the large one
      if (u == null) u = o.unit || null;
      if (q == null) q = u === "g" || u === "ml" ? 100 : 1;
      if (m.id === "sugar" && (u === "spoon" || u === "tbsp") && !/tablespoon|tbsp|كبيره/.test(ch)) u = "tsp";   // sugar "spoons" in tea are teaspoons
      let g = gramsFor(fd, q, u, o);
      if (o.side && !unit && !qty && items.length) g = o.side;                      // "…with rice" → a side portion
      if (o.small && !unit && !qty && items.length) g = o.small;                    // "…with hummus" → a side portion
      if (size && !((fd.portions || {})[size]) && u !== "g" && u !== "ml") g *= sizeK;
      items.push(makeItem(fd, q, u || "serving", g)); lastFood = fd;
    });
  }
  // a fast-food meal: the sandwich comes with fries and a drink
  if (meal && items.some((x) => /burger|sandwich|shawarma|nuggets/.test(x.id)) ) {
    if (!items.some((x) => /fries/.test(x.id))) items.push(makeItem(food("fries"), 1, "portion", food("fries").portions.portion));
    if (!items.some((x) => /cola|juice|water/.test(x.id))) items.push(makeItem(food("cola"), 1, "can", 330));
  }
  return { items: mergeSame(items).map(checkAmount), unknown };
}

function makeItem(fd, qty, unit, grams) {
  const g = Math.max(1, Math.round(grams));
  return { name: fd.en, ar: fd.ar, id: fd.id, src: fd.src || "table", qty, unit: unitNorm(unit), grams: g, ...nutrients(fd, g), estimate: false };
}
/** The same food twice in one reading → one item with the grams added. */
export function mergeSame(items) {
  const out = [];
  for (const x of items) {
    const y = x.id && out.find((o) => o.id === x.id);
    if (!y) { out.push({ ...x }); continue; }
    const g = y.grams + x.grams, fd = food(x.id);
    Object.assign(y, { grams: g, qty: (y.qty || 1) + (x.qty || 1) }, fd ? nutrients(fd, g) : { kcal: (y.kcal || 0) + (x.kcal || 0) });
  }
  return out;
}
// the most anyone plausibly eats of a food in one go (g) — above it the amount is flagged and capped
function maxFor(fd) {
  if (!fd) return 1500;
  const id = fd.id, P = Object.values(fd.portions || {});
  if (/^(olive-oil|ghee|butter|mayonnaise|tahini|peanut-butter|nutella|coconut-oil|cream|qeshta)$/.test(id)) return 60;
  if (/^(sugar|sugar-brown|honey|jam|molasses|ketchup|bbq-sauce|garlic-sauce|ranch|mustard|condensed-milk|dates-paste)$/.test(id)) return 60;
  if (fd.group === "drinks" || /^(water|cola|diet-cola|orange-juice|mango-juice|guava-juice|milk|milk-skim|milk-semi|tea|tea-milk|tea-sugar|coffee|latte|sugarcane|karkadeh|sobia|smoothie|milkshake|laban-rayeb|energy-drink)$/.test(id)) return 1500;
  return Math.max(600, (P.length ? Math.max(...P) : 200) * 3);
}
export function checkAmount(it) {
  const fd = it.id ? food(it.id) : null, max = maxFor(fd);
  if (!(it.grams > max)) return it;
  const g = fd && Object.values(fd.portions || {}).length ? Math.max(...Object.values(fd.portions)) : Math.min(it.grams, max);
  return { ...it, ...(fd ? nutrients(fd, Math.min(g, max)) : {}), grams: Math.round(Math.min(g, max)), flag: "amount", was: it.grams };
}

// ---- editing the read meal by talking (v6.3): "remove the cola", "rice 200 g", «ضيف معلقة زيت» ----
/** Which item of the list a few words point at (the reader's aliases first, then the names). */
function findItem(items, words) {
  const w = normA(words).replace(/^(the|a|an|ال)\s*/, "").trim(); if (!w) return -1;
  const read = readMealText(w).items[0];
  if (read) { const k = items.findIndex((x) => x.id === read.id || (x.id && read.id && x.id.split("-")[0] === read.id.split("-")[0])); if (k >= 0) return k; }
  return items.findIndex((x) => normA(x.name).includes(w) || normA(x.ar || "").includes(w) || w.includes(normA(x.name)));
}
function regram(x, g) {
  const fd = x.id && food(x.id);
  g = Math.max(1, Math.round(g));
  if (fd) return checkAmount({ ...x, grams: g, ...nutrients(fd, g), k: undefined });
  if (x.kcal == null || !x.grams) return { ...x, grams: g };
  const s = g / x.grams; return { ...x, grams: g, kcal: Math.round(x.kcal * s), p: r1(x.p * s), c: r1(x.c * s), f: r1(x.f * s) };
}
/**
 * One spoken / typed change to the list → { items, done: {en, ar} } or null when it isn't a change.
 * remove · set grams · set a count · double / half · add.
 */
export function draftCommand(items, text) {
  const t = normA(text).replace(/[.،,]+$/, "");
  let m;
  // remove
  if ((m = t.match(/^(?:remove|delete|drop|take out|no|without|شيل|امسح|احذف|من غير|بلاش|مفيش)\s+(.+)$/))) {
    const k = findItem(items, m[1]); if (k < 0) return null;
    return { items: items.filter((_, i) => i !== k), done: { en: `Removed ${items[k].name}`, ar: `اتشال ${items[k].ar || items[k].name}` } };
  }
  // double / half / a bit more
  if ((m = t.match(/^(?:double|twice|ضعف|دبل)\s+(.+)$/))) { const k = findItem(items, m[1]); if (k < 0) return null; return { items: items.map((x, i) => (i === k ? regram(x, x.grams * 2) : x)), done: { en: `${items[k].name} doubled`, ar: `${items[k].ar || items[k].name} اتضاعف` } }; }
  if ((m = t.match(/^(?:half|halve|نص|نصف)\s+(?:the\s+)?(.+)$/)) && findItem(items, m[1]) >= 0) { const k = findItem(items, m[1]); return { items: items.map((x, i) => (i === k ? regram(x, x.grams / 2) : x)), done: { en: `${items[k].name} halved`, ar: `${items[k].ar || items[k].name} بقى النص` } }; }
  // add
  if ((m = t.match(/^(?:add|plus|also|and|ضيف|زود|كمان|و)\s+(.+)$/))) {
    const r = readMealText(m[1]); if (!r.items.length) return null;
    return { items: [...items, ...r.items], done: { en: "Added " + r.items.map((x) => x.name).join(", "), ar: "اتضاف " + r.items.map((x) => x.ar || x.name).join("، ") } };
  }
  // "rice 200 g" / "make the rice 200 grams" / «الرز ٢٠٠ جرام» / "chicken 1.5 portions"
  const t2 = " " + t.replace(/^(?:make|set|change|خلي|خليه|خليها|خليهم|غير)\s+/, "").replace(/(\d+(?:\.\d+)?)\s?(g|gm|gram|grams|جم|جرام)(?=\s|$)/g, "$1 g") + " ";
  if ((m = t2.match(/^\s(.+?)\s(?:to\s|=\s|يبقى\s|تبقى\s)?(\d+(?:\.\d+)?)\s(g|ml)\s$/)) || (m = t2.match(/^\s(\d+(?:\.\d+)?)\s(g|ml)\s(?:of\s|من\s)?(.+?)\s$/))) {
    const [words, g] = m[3] && !/^(g|ml)$/.test(m[3]) ? [m[3], +m[1]] : [m[1], +m[2]];
    const k = findItem(items, words); if (k < 0 || !(g > 0)) return null;
    return { items: items.map((x, i) => (i === k ? regram(x, g) : x)), done: { en: `${items[k].name}: ${Math.round(g)} g`, ar: `${items[k].ar || items[k].name}: ${Math.round(g)} جم` } };
  }
  // a count: "3 eggs" / "make it 3 eggs" / «خليهم ٣ بيض» / "eggs 3"
  if ((m = t2.match(/^\s(?:it\s|them\s)?(\d+(?:\.\d+)?)\s(.+?)\s$/)) || (m = t2.match(/^\s(.+?)\s(\d+(?:\.\d+)?)\s$/))) {
    const [n, words] = /^\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    const k = findItem(items, words); if (k < 0 || !(n > 0 && n <= 40)) return null;
    const x = items[k], fd = x.id && food(x.id);
    const per = fd ? (Object.values(fd.portions || {})[0] || 100) : x.grams / (x.qty || 1);
    return { items: items.map((y, i) => (i === k ? { ...regram(y, n * per), qty: n } : y)), done: { en: `${x.name} × ${n}`, ar: `${x.ar || x.name} × ${n}` } };
  }
  return null;
}

/**
 * A model's JSON answer, repaired: prose or ``` around it, trailing commas, an array instead of an
 * object, units as words (teaspoons, kg), negative / zero amounts, the same food twice, Arabic
 * names, and amounts no one eats (capped and flagged). Foods in the table always use the table.
 */
export function parseMealChecked(raw) {
  const s = String(raw || "").replace(/```(?:json)?/gi, "");
  let j = null;
  const tryParse = (x) => { try { return JSON.parse(x); } catch (e) { try { return JSON.parse(x.replace(/,\s*([}\]])/g, "$1")); } catch (e2) { return null; } } };
  const a = s.indexOf("["), o = s.indexOf("{");
  if (a >= 0 && (o < 0 || a < o)) j = tryParse(s.slice(a, s.lastIndexOf("]") + 1));
  if (!j && o >= 0) j = tryParse(s.slice(o, s.lastIndexOf("}") + 1));
  const list = Array.isArray(j) ? j : Array.isArray(j && j.items) ? j.items : [];
  const out = [];
  for (const it of list) {
    const name = String((it && (it.food || it.name)) || "").trim(); if (!name) continue;
    let q = parseFloat(it.qty ?? it.quantity ?? it.amount); if (!(q > 0)) q = 1;
    let u = normA(it.unit || "");
    const us = { teaspoons: "tsp", teaspoon: "tsp", tablespoons: "tbsp", tablespoon: "tbsp", grams: "g", gram: "g", kilograms: "kg", kilogram: "kg", kilo: "kg", milliliters: "ml", liters: "l", litre: "l", liter: "l" };
    u = us[u] || u;
    if (!u) { for (const [rx, uu] of UNIT_RX) if (rx.test(" " + normA(it.unit || "") + " ")) { u = uu; break; } }
    // the name through the same reader (aliases, Arabic), else the table's matcher
    const read = readMealText(name).items[0];
    const fd = (read && food(read.id)) || matchFood(name);
    if (fd) {
      const g = u === "kg" ? q * 1000 : u === "l" ? q * 1000 : gramsFor(fd, q, u || "serving");
      out.push(makeItem(fd, q, u || "serving", g));
    } else {
      const k = parseFloat(it.kcal_per_100g);
      const g = u === "g" || u === "ml" ? q : u === "kg" ? q * 1000 : q * 150;
      out.push({ name, qty: q, unit: u || "serving", grams: Math.round(g), kcal: k >= 0 && k <= 900 ? Math.round(k * g / 100) : null, p: null, c: null, f: null, fib: 0, estimate: true, unknown: !(k >= 0 && k <= 900) });
    }
  }
  return mergeSame(out).map(checkAmount);
}
