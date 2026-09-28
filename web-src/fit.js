/* ---- v5.42 — Fit: food, calories and workouts inside Attune (Ali: "like Yazio but better") -------------
   The AI only READS: what you ate (a sentence or a photo), a recipe idea, a workout wish. CODE does every
   number: calories and macros from the food table below (per 100 g, Egyptian + international foods, from
   standard composition tables — USDA / Egyptian NFSI values rounded), your targets (Mifflin-St Jeor, activity,
   a safe pace), water, calories burned (MET × kg × hours), streaks and the weekly summary. A food that is
   not in the table uses the model's estimate and is marked "estimate". Pure functions; tests in unit v542. */

// ---- the food table: [id, English, Arabic (+ aliases, "|"-separated), kcal, protein, carbs, fat, fibre (per 100 g / 100 ml), portions {unit: grams}, group] ----
const F = [
  // bread & grains
  ["baladi", "Baladi bread|whole wheat pita|aish baladi", "عيش بلدي|رغيف بلدي|عيش", 263, 9.1, 54, 1.2, 5.5, { loaf: 90, piece: 90, half: 45, quarter: 22 }, "grains"],
  ["shami", "White pita bread|shami bread|pita", "عيش شامي|عيش أبيض|خبز شامي", 275, 9, 56, 1.2, 2.2, { loaf: 60, piece: 60 }, "grains"],
  ["toast-white", "White toast bread|white bread|toast", "توست أبيض|عيش توست|توست", 265, 9, 49, 3.2, 2.7, { slice: 28, piece: 28 }, "grains"],
  ["toast-brown", "Brown toast bread|whole wheat bread|brown bread", "توست بني|عيش بني|توست سن", 250, 12.5, 43, 3.5, 7, { slice: 30, piece: 30 }, "grains"],
  ["fino", "Fino bread roll|baguette", "عيش فينو|فينو|باجيت", 280, 9, 55, 2.5, 2.5, { piece: 70, roll: 70 }, "grains"],
  ["rice", "White rice (cooked)|rice", "رز أبيض|رز|أرز", 130, 2.7, 28, 0.3, 0.4, { cup: 158, plate: 200, tbsp: 15, spoon: 15 }, "grains"],
  ["rice-vermicelli", "Rice with vermicelli (cooked)", "رز بالشعرية|رز بشعرية", 160, 3, 29, 3.5, 0.5, { cup: 158, plate: 200 }, "grains"],
  ["rice-brown", "Brown rice (cooked)", "رز بني", 123, 2.7, 26, 1, 1.6, { cup: 195, plate: 200 }, "grains"],
  ["pasta", "Pasta (cooked)|macaroni|spaghetti", "مكرونة|مكرونه|اسباجتي|باستا", 158, 5.8, 31, 0.9, 1.8, { cup: 140, plate: 250 }, "grains"],
  ["oats", "Oats (dry)|oatmeal|rolled oats", "شوفان", 380, 13.5, 66, 6.9, 10, { cup: 80, tbsp: 10, spoon: 10, bowl: 40 }, "grains"],
  ["cornflakes", "Cornflakes|breakfast cereal", "كورن فليكس|حبوب إفطار", 357, 7.5, 84, 0.4, 3, { cup: 28, bowl: 40 }, "grains"],
  ["freekeh", "Freekeh (cooked)", "فريك", 120, 4, 23, 0.8, 4, { cup: 160, plate: 200 }, "grains"],
  ["bulgur", "Bulgur (cooked)|burghul", "برغل", 83, 3.1, 19, 0.2, 4.5, { cup: 182, plate: 200 }, "grains"],
  ["rice-dry", "Rice (uncooked)", "رز ني|أرز غير مطبوخ", 360, 6.6, 79, 0.6, 1.3, { cup: 185 }, "grains"],
  ["pasta-dry", "Pasta (uncooked)", "مكرونة ني", 371, 13, 75, 1.5, 3.2, { cup: 100 }, "grains"],
  ["potato", "Potato (boiled)|potatoes", "بطاطس مسلوقة|بطاطس|بطاطا", 87, 1.9, 20, 0.1, 1.8, { piece: 170, medium: 170, cup: 156 }, "grains"],
  ["fries", "French fries|chips|fried potatoes", "بطاطس محمرة|بطاطس مقلية|فرايز", 312, 3.4, 41, 15, 3.8, { portion: 117, small: 80, large: 150, plate: 150 }, "grains"],
  ["sweet-potato", "Sweet potato (baked)", "بطاطا مشوية|بطاطا حلوة", 90, 2, 20.7, 0.2, 3.3, { piece: 150, medium: 150 }, "grains"],
  ["corn", "Sweet corn|corn on the cob", "ذرة|درة|كوز درة", 96, 3.4, 21, 1.5, 2.4, { ear: 90, piece: 90, cup: 145 }, "grains"],
  ["croissant", "Croissant", "كرواسون|كرواسان", 406, 8.2, 45.8, 21, 2.6, { piece: 57 }, "grains"],
  ["feteer", "Feteer meshaltet", "فطير مشلتت|فطير", 420, 7, 42, 25, 1.5, { piece: 90, quarter: 90, slice: 90 }, "grains"],
  // Egyptian dishes
  ["ful", "Ful medames|fava beans|foul", "فول|فول مدمس|فول بالزيت", 110, 7.6, 19.7, 0.4, 5.4, { plate: 200, cup: 170, bowl: 200, tbsp: 20, spoon: 20 }, "dishes"],
  ["taameya", "Taameya|falafel", "طعمية|فلافل", 333, 13.3, 31.8, 17.8, 4.9, { piece: 17, disc: 17 }, "dishes"],
  ["koshari", "Koshari", "كشري|كُشري", 180, 6, 32, 3.5, 3.5, { plate: 350, small: 250, large: 450, bowl: 350 }, "dishes"],
  ["molokhia", "Molokhia (cooked)", "ملوخية", 60, 3, 5, 3, 2.5, { plate: 250, bowl: 250, cup: 240 }, "dishes"],
  ["lentil-soup", "Lentil soup", "شوربة عدس|عدس", 75, 4.8, 11, 1.5, 3, { bowl: 300, cup: 240, plate: 300 }, "dishes"],
  ["mahshi", "Mahshi (stuffed vegetables)|stuffed vine leaves|stuffed peppers", "محشي|ورق عنب|محشي كرنب", 140, 2.5, 22, 5, 2, { piece: 60, plate: 300 }, "dishes"],
  ["bechamel", "Macarona bechamel|pasta bechamel", "مكرونة بشاميل|بشاميل", 200, 9, 18, 10, 1, { piece: 250, plate: 300, square: 250 }, "dishes"],
  ["bamia", "Okra stew with meat|bamya", "بامية", 95, 6, 7, 5, 3, { plate: 250, bowl: 250 }, "dishes"],
  ["fasolia", "Green bean stew with meat", "فاصوليا خضرا|فاصوليا", 85, 5, 8, 4, 3, { plate: 250, bowl: 250 }, "dishes"],
  ["shakshuka", "Shakshuka|eggs in tomato", "شكشوكة|بيض بالطماطم", 110, 6.5, 5, 7.5, 1.2, { plate: 250, pan: 250 }, "dishes"],
  ["hawawshi", "Hawawshi", "حواوشي", 260, 12, 22, 14, 1.5, { piece: 250, loaf: 250 }, "dishes"],
  ["om-ali", "Om Ali", "أم علي|ام علي", 230, 5, 25, 12, 0.5, { bowl: 200, plate: 200 }, "sweets"],
  ["roz-laban", "Rice pudding", "رز بلبن|أرز باللبن", 130, 3.5, 20, 4, 0.1, { bowl: 150, cup: 150 }, "sweets"],
  ["basbousa", "Basbousa", "بسبوسة", 370, 4, 55, 15, 1, { piece: 60 }, "sweets"],
  ["konafa", "Kunafa", "كنافة", 400, 6, 50, 20, 1, { piece: 100, plate: 150 }, "sweets"],
  ["hummus", "Hummus", "حمص|حمص بالطحينة", 166, 7.9, 14.3, 9.6, 6, { tbsp: 15, spoon: 15, plate: 150, bowl: 150 }, "dishes"],
  ["baba", "Baba ghanoush|eggplant dip", "بابا غنوج|باباغنوج", 110, 2.5, 7, 9, 3, { tbsp: 15, plate: 150 }, "dishes"],
  ["fried-eggplant", "Fried eggplant", "بتنجان مقلي|باذنجان مقلي", 200, 1.5, 9, 18, 3, { slice: 30, plate: 150 }, "dishes"],
  ["shawarma-sandwich", "Chicken shawarma sandwich", "ساندوتش شاورما|شاورما", 230, 13, 23, 9.5, 1.5, { sandwich: 250, piece: 250 }, "dishes"],
  ["ful-sandwich", "Ful sandwich", "ساندوتش فول", 180, 7, 28, 4, 4, { sandwich: 150, piece: 150 }, "dishes"],
  ["taameya-sandwich", "Taameya sandwich|falafel sandwich", "ساندوتش طعمية|ساندوتش فلافل", 235, 8, 30, 10, 4, { sandwich: 170, piece: 170 }, "dishes"],
  ["liver-sandwich", "Liver sandwich (kebda)", "ساندوتش كبدة|كبدة", 215, 14, 22, 8, 1, { sandwich: 180, piece: 180 }, "dishes"],
  ["burger", "Beef burger (with bun)|hamburger", "برجر|بيرجر|هامبورجر", 250, 13, 22, 12, 1.5, { piece: 220, sandwich: 220 }, "dishes"],
  ["pizza", "Pizza|margherita pizza", "بيتزا", 266, 11, 33, 10, 2.3, { slice: 107, piece: 107 }, "dishes"],
  // protein
  ["egg", "Egg|boiled egg|eggs", "بيض|بيضة|بيض مسلوق", 143, 12.6, 0.7, 9.5, 0, { piece: 50, egg: 50, large: 55 }, "protein"],
  ["egg-fried", "Fried egg|eggs fried|omelette", "بيض مقلي|بيض أومليت|أومليت|عجة", 196, 13.6, 0.8, 15, 0, { piece: 46, egg: 46 }, "protein"],
  ["egg-white", "Egg white", "بياض بيض", 52, 10.9, 0.7, 0.2, 0, { piece: 33 }, "protein"],
  ["chicken-breast", "Chicken breast (grilled)|grilled chicken|chicken", "صدور فراخ|صدر فراخ|فراخ مشوية|دجاج مشوي|فراخ", 165, 31, 0, 3.6, 0, { piece: 150, palm: 120, portion: 150 }, "protein"],
  ["chicken-thigh", "Chicken thigh (with skin)|chicken leg", "ورك فراخ|ورك", 229, 25, 0, 14, 0, { piece: 110 }, "protein"],
  ["chicken-raw", "Chicken breast (raw)", "صدور فراخ ني", 120, 22.5, 0, 2.6, 0, { piece: 180 }, "protein"],
  ["beef", "Beef (lean, cooked)|steak|meat", "لحمة|لحم|ستيك|لحم بقري", 250, 26, 0, 15, 0, { portion: 150, piece: 100, palm: 100 }, "protein"],
  ["kofta", "Kofta (grilled)|minced beef", "كفتة|كفته|لحمة مفرومة", 260, 22, 3, 18, 0.3, { piece: 40, skewer: 40 }, "protein"],
  ["beef-mince-raw", "Minced beef (raw)", "لحمة مفرومة ني", 250, 17, 0, 20, 0, {}, "protein"],
  ["liver", "Beef liver (cooked)", "كبدة بلدي|كبد", 175, 27, 5, 4.7, 0, { portion: 100 }, "protein"],
  ["tuna-oil", "Tuna in oil (drained)|tuna", "تونة|تونة بالزيت", 198, 29, 0, 8.2, 0, { can: 120, tbsp: 15 }, "protein"],
  ["tuna-water", "Tuna in water", "تونة مية|تونة في الماء", 116, 25.5, 0, 0.8, 0, { can: 120 }, "protein"],
  ["fish", "Grilled fish|tilapia|fish fillet", "سمك مشوي|سمك|بلطي|فيليه", 128, 26, 0, 2.7, 0, { piece: 150, fillet: 150, portion: 150 }, "protein"],
  ["fish-fried", "Fried fish", "سمك مقلي", 232, 21, 8, 13, 0.3, { piece: 150, fillet: 150 }, "protein"],
  ["fish-raw", "Fish fillet (raw)", "سمك ني", 96, 20, 0, 1.7, 0, {}, "protein"],
  ["salmon", "Salmon (cooked)", "سلمون|سالمون", 206, 22, 0, 12, 0, { fillet: 150, piece: 150 }, "protein"],
  ["shrimp", "Shrimp (cooked)|prawns", "جمبري", 99, 24, 0.2, 0.3, 0, { portion: 100, piece: 8 }, "protein"],
  ["lentils-dry", "Lentils (dry)", "عدس ني|عدس جاف", 353, 25, 60, 1, 11, { cup: 190 }, "protein"],
  ["chickpeas", "Chickpeas (cooked)", "حمص مسلوق|حمص الشام", 164, 8.9, 27, 2.6, 7.6, { cup: 164 }, "protein"],
  ["whey", "Whey protein powder", "واي بروتين|بروتين", 400, 80, 8, 6, 0, { scoop: 30 }, "protein"],
  // dairy
  ["feta", "White cheese (domiati / feta)", "جبنة بيضا|جبنة بيضاء|جبنة دمياطي|جبنة فيتا|جبنة", 264, 14, 4, 21, 0, { piece: 30, slice: 30, tbsp: 15 }, "dairy"],
  ["roumi", "Roumi cheese", "جبنة رومي|رومي", 390, 28, 2, 30, 0, { slice: 20, piece: 20 }, "dairy"],
  ["cottage", "Cottage cheese (low fat)|areesh cheese", "جبنة قريش|قريش|جبنة قريش", 98, 11, 3.4, 4.3, 0, { cup: 225, tbsp: 15, spoon: 15 }, "dairy"],
  ["triangle-cheese", "Processed cheese triangle", "جبنة مثلثات|جبنة نستو", 290, 12, 7, 24, 0, { piece: 17, triangle: 17 }, "dairy"],
  ["mozzarella", "Mozzarella", "موتزاريلا|موزاريلا", 280, 28, 3, 17, 0, { slice: 25, cup: 113 }, "dairy"],
  ["labneh", "Labneh", "لبنة", 180, 7, 4.5, 15, 0, { tbsp: 20, spoon: 20 }, "dairy"],
  ["greek-yogurt", "Greek yogurt (plain, low fat)", "زبادي يوناني|جريك يوجرت", 59, 10, 3.6, 0.4, 0, { cup: 170, pot: 170 }, "dairy"],
  ["yogurt", "Yogurt (plain)|zabadi", "زبادي|زبادى|رايب", 61, 3.5, 4.7, 3.3, 0, { pot: 105, cup: 245 }, "dairy"],
  ["milk", "Milk (full fat)", "لبن|حليب|لبن كامل الدسم", 61, 3.2, 4.8, 3.3, 0, { cup: 244, glass: 250, ml: 1 }, "dairy"],
  ["milk-skim", "Milk (skimmed)", "لبن خالي الدسم|حليب خالي الدسم", 34, 3.4, 5, 0.1, 0, { cup: 244, glass: 250 }, "dairy"],
  // fats, nuts, spreads
  ["olive-oil", "Olive oil|oil|vegetable oil", "زيت زيتون|زيت", 884, 0, 0, 100, 0, { tbsp: 13.5, tsp: 4.5, spoon: 13.5 }, "fats"],
  ["butter", "Butter", "زبدة", 717, 0.9, 0.1, 81, 0, { tbsp: 14, tsp: 5 }, "fats"],
  ["ghee", "Ghee|samna", "سمنة|سمن", 900, 0, 0, 100, 0, { tbsp: 13, tsp: 4.5 }, "fats"],
  ["tahini", "Tahini", "طحينة", 595, 17, 21, 54, 9.3, { tbsp: 15, spoon: 15 }, "fats"],
  ["peanut-butter", "Peanut butter", "زبدة فول سوداني", 588, 25, 20, 50, 6, { tbsp: 16, spoon: 16 }, "fats"],
  ["almonds", "Almonds", "لوز", 579, 21, 22, 50, 12.5, { handful: 28, piece: 1.2 }, "fats"],
  ["peanuts", "Peanuts", "فول سوداني", 585, 24, 21, 50, 8, { handful: 28 }, "fats"],
  ["walnuts", "Walnuts", "عين جمل", 654, 15, 14, 65, 6.7, { handful: 28, piece: 4 }, "fats"],
  ["mixed-nuts", "Mixed nuts", "مكسرات", 607, 20, 21, 54, 7, { handful: 28 }, "fats"],
  ["avocado", "Avocado", "أفوكادو|افوكادو", 160, 2, 8.5, 14.7, 6.7, { piece: 150, half: 75 }, "fats"],
  // fruit
  ["dates", "Dates", "بلح|تمر|تمرة|بلحة", 282, 2.5, 75, 0.4, 8, { piece: 8, date: 8, handful: 50 }, "fruit"],
  ["apple", "Apple", "تفاح|تفاحة", 52, 0.3, 14, 0.2, 2.4, { piece: 182, medium: 182 }, "fruit"],
  ["banana", "Banana", "موز|موزة", 89, 1.1, 23, 0.3, 2.6, { piece: 118, medium: 118 }, "fruit"],
  ["orange", "Orange", "برتقال|برتقانة|برتقالة", 47, 0.9, 12, 0.1, 2.4, { piece: 130 }, "fruit"],
  ["mango", "Mango", "مانجا|مانجو|مانجة", 60, 0.8, 15, 0.4, 1.6, { piece: 250, cup: 165 }, "fruit"],
  ["guava", "Guava", "جوافة", 68, 2.6, 14, 1, 5.4, { piece: 90 }, "fruit"],
  ["grapes", "Grapes", "عنب", 69, 0.7, 18, 0.2, 0.9, { cup: 151, bunch: 150 }, "fruit"],
  ["watermelon", "Watermelon", "بطيخ", 30, 0.6, 7.6, 0.2, 0.4, { slice: 280, cup: 152 }, "fruit"],
  ["strawberries", "Strawberries", "فراولة", 32, 0.7, 7.7, 0.3, 2, { cup: 152, piece: 12 }, "fruit"],
  ["pomegranate", "Pomegranate", "رمان|رمانة", 83, 1.7, 19, 1.2, 4, { piece: 175, cup: 174 }, "fruit"],
  ["figs", "Figs (fresh)", "تين", 74, 0.8, 19, 0.3, 2.9, { piece: 50 }, "fruit"],
  ["pear", "Pear", "كمثرى", 57, 0.4, 15, 0.1, 3.1, { piece: 178 }, "fruit"],
  ["peach", "Peach", "خوخ", 39, 0.9, 10, 0.3, 1.5, { piece: 150 }, "fruit"],
  ["kiwi", "Kiwi", "كيوي", 61, 1.1, 15, 0.5, 3, { piece: 69 }, "fruit"],
  // vegetables
  ["salad", "Green salad (no oil)|tomato cucumber salad", "سلطة خضرا|سلطة بلدي|سلطة", 20, 1, 4, 0.2, 1.5, { plate: 200, bowl: 200, cup: 100 }, "veg"],
  ["tomato", "Tomato", "طماطم|قوطة|طماطماية", 18, 0.9, 3.9, 0.2, 1.2, { piece: 123, medium: 123 }, "veg"],
  ["cucumber", "Cucumber", "خيار|خياراية", 15, 0.7, 3.6, 0.1, 0.5, { piece: 100 }, "veg"],
  ["lettuce", "Lettuce", "خس", 15, 1.4, 2.9, 0.2, 1.3, { cup: 50, leaf: 10 }, "veg"],
  ["carrot", "Carrot", "جزر", 41, 0.9, 10, 0.2, 2.8, { piece: 61 }, "veg"],
  ["onion", "Onion", "بصل|بصلة", 40, 1.1, 9.3, 0.1, 1.7, { piece: 110 }, "veg"],
  ["pepper", "Bell pepper", "فلفل رومي|فلفل ألوان|فلفل", 26, 1, 6, 0.3, 2.1, { piece: 120 }, "veg"],
  ["zucchini", "Zucchini", "كوسة", 17, 1.2, 3.1, 0.3, 1, { piece: 200 }, "veg"],
  ["spinach", "Spinach", "سبانخ", 23, 2.9, 3.6, 0.4, 2.2, { cup: 30, plate: 200 }, "veg"],
  ["broccoli", "Broccoli", "بروكلي|بروكلى", 34, 2.8, 6.6, 0.4, 2.6, { cup: 91 }, "veg"],
  ["peas", "Peas", "بسلة|بازلاء", 81, 5.4, 14, 0.4, 5.1, { cup: 145, plate: 200 }, "veg"],
  ["molokhia-leaves", "Jute leaves (raw)", "ملوخية خضرا ني", 34, 4.7, 5.8, 0.3, 2, {}, "veg"],
  ["garlic", "Garlic", "توم|ثوم", 149, 6.4, 33, 0.5, 2.1, { clove: 3, piece: 3 }, "veg"],
  ["tomato-paste", "Tomato paste", "صلصة|صلصة طماطم", 82, 4.3, 19, 0.5, 4.1, { tbsp: 16 }, "veg"],
  ["lemon", "Lemon juice", "ليمون|عصير ليمون", 22, 0.4, 6.9, 0.2, 0.3, { tbsp: 15, piece: 30 }, "veg"],
  // sweets & snacks
  ["sugar", "Sugar", "سكر", 387, 0, 100, 0, 0, { tsp: 4, tbsp: 12.5, spoon: 4, cube: 4 }, "sweets"],
  ["honey", "Honey", "عسل|عسل نحل", 304, 0.3, 82, 0, 0.2, { tbsp: 21, tsp: 7, spoon: 21 }, "sweets"],
  ["jam", "Jam", "مربى|مربة", 278, 0.4, 69, 0.1, 1, { tbsp: 20, spoon: 20 }, "sweets"],
  ["chocolate", "Milk chocolate", "شوكولاتة|شيكولاتة|شوكولاته", 535, 7.7, 59, 30, 3.4, { bar: 45, piece: 10, square: 10 }, "sweets"],
  ["dark-chocolate", "Dark chocolate", "شوكولاتة داكنة|دارك شوكليت", 546, 4.9, 61, 31, 7, { bar: 45, square: 10 }, "sweets"],
  ["biscuits", "Biscuits|cookies", "بسكويت|كوكيز", 480, 6, 68, 21, 2, { piece: 10 }, "sweets"],
  ["cake", "Cake", "كيك|كيكة|جاتوه|تورتة", 380, 5, 52, 17, 1, { slice: 80, piece: 80 }, "sweets"],
  ["ice-cream", "Ice cream", "آيس كريم|ايس كريم|جيلاتي", 207, 3.5, 24, 11, 0.7, { scoop: 66, cup: 132 }, "sweets"],
  ["chips", "Potato chips (crisps)", "شيبسي|شيبس", 536, 7, 53, 34, 4.4, { bag: 40, small: 25 }, "sweets"],
  // drinks (per 100 ml)
  ["tea", "Tea (no sugar)", "شاي|شاي من غير سكر", 1, 0, 0.3, 0, 0, { cup: 240, glass: 240 }, "drinks"],
  ["tea-milk", "Tea with milk (no sugar)", "شاي بلبن|شاي بحليب", 20, 1, 1.5, 1, 0, { cup: 240, glass: 240 }, "drinks"],
  ["coffee", "Coffee (black)", "قهوة|قهوة سادة|اسبريسو|إسبريسو", 2, 0.1, 0, 0, 0, { cup: 240, shot: 30 }, "drinks"],
  ["turkish-coffee", "Turkish coffee (medium sugar)", "قهوة تركي|قهوة مظبوط", 40, 0.2, 9, 0.2, 0, { cup: 60 }, "drinks"],
  ["latte", "Latte (whole milk)", "لاتيه|قهوة بلبن", 54, 3, 4.3, 2.9, 0, { cup: 350, small: 240 }, "drinks"],
  ["cappuccino", "Cappuccino", "كابتشينو|كابوتشينو", 40, 2.2, 3.3, 2, 0, { cup: 240 }, "drinks"],
  ["cola", "Cola|soft drink|soda", "كولا|بيبسي|كوكاكولا|حاجة ساقعة|سفن|مياه غازية", 42, 0, 10.6, 0, 0, { can: 330, bottle: 500, glass: 250 }, "drinks"],
  ["orange-juice", "Orange juice", "عصير برتقال", 45, 0.7, 10.4, 0.2, 0.2, { glass: 250, cup: 248 }, "drinks"],
  ["sugarcane", "Sugarcane juice", "عصير قصب|قصب", 70, 0.2, 17, 0, 0, { glass: 300, cup: 250 }, "drinks"],
  ["karkadeh", "Hibiscus (karkadeh), sweetened", "كركديه", 40, 0, 10, 0, 0, { glass: 250, cup: 250 }, "drinks"],
  ["water", "Water", "مية|مياه|ماء", 0, 0, 0, 0, 0, { glass: 250, cup: 250, bottle: 500 }, "drinks"],
];
import { MORE_FOODS, MORE_RECIPES } from "./fit-foods.js";
export const FOODS = [...F, ...MORE_FOODS].map(([id, en, ar, kcal, p, c, f, fib, portions, group]) => ({ id, en: en.split("|")[0], ar: ar.split("|")[0], names: [...en.split("|"), ...ar.split("|")], kcal, p, c, f, fib, portions, group }));
const BY_ID = new Map(FOODS.map((x) => [x.id, x]));
export const food = (id) => BY_ID.get(id) || null;

// ---- matching what someone wrote to the table ----
const normT = (s) => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const stem = (w) => w.replace(/^(ال|وال|بال)(?=\S{2,})/, "").replace(/(ies)$/, "y").replace(/(es|s)$/, "");
/** The food in the table that best matches a name (English or Arabic) → food or null. */
export function matchFood(name) {
  const q = normT(name); if (!q) return null;
  const qw = q.split(" ").map(stem).filter((w) => w.length > 1);
  let best = null, bestS = 0;
  for (const fd of FOODS) {
    for (const n0 of fd.names) {
      const n = normT(n0);
      if (n === q) return fd;
      const nw = n.split(" ").map(stem).filter((w) => w.length > 1);
      const hit = nw.filter((w) => qw.includes(w)).length;
      if (!hit) continue;
      // every word of the table's name found, and few extra words in the query → strong
      const s = hit / nw.length + hit / Math.max(qw.length, 1) * 0.6 + (q.includes(n) ? 0.5 : 0);
      if (s > bestS) { bestS = s; best = fd; }
    }
  }
  return bestS >= 0.9 ? best : null;
}

// grams for a unit when the food has none of its own
const UNIT_G = { g: 1, gram: 1, grams: 1, kg: 1000, ml: 1, l: 1000, liter: 1000, litre: 1000, cup: 200, glass: 250, mug: 300, tbsp: 15, spoon: 15, tsp: 5, slice: 30, piece: 100, plate: 250, bowl: 250, can: 330, bottle: 500, sandwich: 200, serving: 150, portion: 150, handful: 28, scoop: 30, loaf: 90, half: 50, small: 100, medium: 150, large: 200 };
const UNIT_AR = { "جم": "g", "جرام": "g", "غرام": "g", "كيلو": "kg", "مل": "ml", "مللي": "ml", "لتر": "l", "كوباية": "cup", "كوب": "cup", "فنجان": "cup", "كاس": "glass", "كأس": "glass", "معلقة كبيرة": "tbsp", "معلقة صغيرة": "tsp", "معلقة": "tbsp", "ملعقة": "tbsp", "شريحة": "slice", "حتة": "piece", "حبة": "piece", "قطعة": "piece", "طبق": "plate", "صحن": "plate", "سلطانية": "bowl", "علبة": "can", "زجاجة": "bottle", "ازازة": "bottle", "ساندوتش": "sandwich", "سندويتش": "sandwich", "رغيف": "loaf", "نص": "half", "نصف": "half", "ربع": "quarter", "كف": "handful", "حفنة": "handful", "سكوب": "scoop" };
export function unitNorm(u) { const t = normT(u).replace(/s$/, ""); if (UNIT_G[t]) return t; for (const [a, e] of Object.entries(UNIT_AR)) if (normT(a) === t || t.startsWith(normT(a))) return e; return t || "serving"; }
/** Grams of `qty unit` of a food (its own portions first). */
export function gramsOf(fd, qty, unit) {
  const u = unitNorm(unit), n = Number(qty) > 0 ? Number(qty) : 1;
  if (u === "g" || u === "ml") return n;
  if (u === "kg" || u === "l") return n * 1000;
  const own = fd && fd.portions ? fd.portions[u] ?? (u === "piece" ? Object.values(fd.portions)[0] : undefined) : undefined;
  if (own != null) return n * own;
  if (fd && fd.portions && (u === "serving" || u === "portion") && Object.keys(fd.portions).length) return n * Object.values(fd.portions)[0];
  return n * (UNIT_G[u] || 100);
}
const r1 = (v) => Math.round(v * 10) / 10;
/** Calories and macros of `grams` of a food (or of an estimate per 100 g). */
export function nutrients(per100, grams) {
  const k = grams / 100;
  return { kcal: Math.round(per100.kcal * k), p: r1(per100.p * k), c: r1(per100.c * k), f: r1(per100.f * k), fib: r1((per100.fib || 0) * k) };
}
export function sumN(list) {
  return list.reduce((a, x) => ({ kcal: a.kcal + (x.kcal || 0), p: r1(a.p + (x.p || 0)), c: r1(a.c + (x.c || 0)), f: r1(a.f + (x.f || 0)), fib: r1(a.fib + (x.fib || 0)) }), { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });
}

// ---- 1. reading what was eaten ----
export function mealMessages(text, hasPhoto) {
  return [
    { role: "system", content: `You read what someone ate and list each food with its amount. Reply with ONLY a JSON object:
{"items": [{"food": "the food as a simple generic name in English (e.g. 'baladi bread', 'ful medames', 'boiled egg', 'grilled chicken breast', 'cola')", "qty": number, "unit": "piece|g|ml|cup|glass|tbsp|tsp|slice|plate|bowl|can|sandwich|loaf|handful|scoop|serving", "kcal_per_100g": number, "protein_per_100g": number, "carbs_per_100g": number, "fat_per_100g": number}]}
Rules: one item per food (a sandwich is one item); cooking oil, sugar or butter that was clearly added is its own item; amounts exactly as said, a sensible typical amount if none is said; the per-100 g values are your best estimate for that food as eaten.${hasPhoto ? " The meal is in the photo: identify every food and estimate each portion from the plate size." : ""}` },
    { role: "user", content: String(text || (hasPhoto ? "What is in this photo?" : "")) },
  ];
}
const num = (x) => { const n = parseFloat(String(x ?? "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(",", ".")); return isFinite(n) ? n : null; };
/** The model's JSON → items with grams and nutrients; table values when the food is in the table. */
export function parseMeal(raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return []; }
  const list = Array.isArray(j) ? j : Array.isArray(j && j.items) ? j.items : [];
  return list.map((it) => mealItem(String(it.food || it.name || ""), num(it.qty) ?? 1, String(it.unit || "serving"),
    { kcal: num(it.kcal_per_100g), p: num(it.protein_per_100g), c: num(it.carbs_per_100g), f: num(it.fat_per_100g) })).filter(Boolean);
}
/** One item: the table's values if the food is known, else the estimate (sanity-checked), else null. */
export function mealItem(name, qty, unit, est = {}) {
  if (!name.trim()) return null;
  const fd = matchFood(name);
  if (fd) { const grams = Math.round(gramsOf(fd, qty, unit)); return { name: fd.en, ar: fd.ar, id: fd.id, qty, unit: unitNorm(unit), grams, ...nutrients(fd, grams), estimate: false }; }
  const k = est.kcal;
  if (!(k >= 0 && k <= 900)) return { name: name.trim(), qty, unit: unitNorm(unit), grams: Math.round(gramsOf(null, qty, unit)), kcal: null, p: null, c: null, f: null, fib: 0, estimate: true, unknown: true };
  // an estimate whose macros don't add up to its calories is rescaled (4/4/9 kcal per gram)
  let p = est.p ?? 0, c = est.c ?? 0, f = est.f ?? 0;
  const byMacros = p * 4 + c * 4 + f * 9;
  if (byMacros > 0 && Math.abs(byMacros - k) / k > 0.25) { const s = k / byMacros; p *= s; c *= s; f *= s; }
  const grams = Math.round(gramsOf(null, qty, unit));
  return { name: name.trim(), qty, unit: unitNorm(unit), grams, ...nutrients({ kcal: k, p, c, f, fib: 0 }, grams), estimate: true };
}
/** Without a model: "2 eggs, 1 baladi bread and a plate of ful" / «٢ بيض ورغيف عيش وطبق فول» → items (table foods only). */
export function quickParse(text) {
  const t = String(text || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const parts = t.split(/\s*(?:,|،|\+|\band\b|\bwith\b|\bplus\b|&|\n|\s+و(?=\S)|\sو\s|\sمع\s|ومعاه|ومعاها)\s*/i).map((x) => x.trim()).filter(Boolean);
  const WORDN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, half: 0.5, واحد: 1, واحدة: 1, اتنين: 2, اثنين: 2, تلاتة: 3, ثلاثة: 3, اربعة: 4, أربعة: 4, نص: 0.5 };
  const out = [];
  for (const p0 of parts) {
    let p = p0, qty = 1, unit = "serving";
    const m = p.match(/^(\d+(?:\.\d+)?)\s*/);
    if (m) { qty = +m[1]; p = p.slice(m[0].length); }
    else { const w = p.split(/\s+/)[0].toLowerCase(); if (WORDN[w] != null) { qty = WORDN[w]; p = p.split(/\s+/).slice(1).join(" "); } }
    const um = p.match(/^(g|grams?|kg|ml|cups?|glass(?:es)?|tbsp|tsp|slices?|pieces?|plates?|bowls?|cans?|sandwich(?:es)?|loaf|loaves|handfuls?|scoops?|servings?|جم|جرام|كوباية|كوب|كاس|معلقة كبيرة|معلقة صغيرة|معلقة|شريحة|حتة|حبة|قطعة|طبق|صحن|علبة|ساندوتش|رغيف|كف)\b\s*(?:of\s+)?/i);
    if (um) { unit = um[1]; p = p.slice(um[0].length); }
    else if (/^(g|جم)\b/i.test(p)) unit = "g";
    const it = mealItem(p, qty, unit);
    if (it && !it.estimate) out.push(it);
  }
  return out;
}

// ---- 2. your plan ----
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very: 1.9 };
export const DIETS = { balanced: "Balanced", "high-protein": "High protein", "low-carb": "Low carb", keto: "Keto", vegetarian: "Vegetarian" };
/**
 * profile { sex: "m"|"f", age, cm, kg, activity, goal: "lose"|"maintain"|"gain", rate (kg/week), goalKg, diet, pregnant }
 * → { bmr, tdee, kcal, protein, carbs, fat, fibre, water (ml), bmi, notes: [{en, ar}], weeks (to goal) }
 */
export function targets(pr) {
  const kg = +pr.kg, cm = +pr.cm, age = +pr.age, male = pr.sex !== "f";
  if (!(kg > 25 && cm > 100 && age >= 10)) return null;
  const notes = [];
  const bmr = Math.round(10 * kg + 6.25 * cm - 5 * age + (male ? 5 : -161));
  const tdee = Math.round(bmr * (ACTIVITY[pr.activity] || 1.375));
  const bmi = r1(kg / Math.pow(cm / 100, 2));
  let goal = pr.goal || "maintain", rate = Math.min(Math.max(+pr.rate || 0.5, 0.1), 1);
  if (goal === "lose" && (age < 18 || pr.pregnant)) { goal = "maintain"; notes.push({ en: age < 18 ? "Under 18: the plan keeps your weight steady — growing bodies need their energy. Talk to a doctor before dieting." : "Pregnant or breastfeeding: no calorie deficit — ask your doctor what is right for you.", ar: age < 18 ? "أقل من 18 سنة: الخطة بتثبّت الوزن — الجسم اللي بينمو محتاج طاقته. كلّم دكتور قبل أي رجيم." : "حامل أو بترضعي: مفيش عجز سعرات — اسألي دكتورك إيه المناسب ليكي." }); }
  if (goal === "lose" && bmi < 18.5) { goal = "maintain"; notes.push({ en: "Your BMI is already under 18.5 — losing more isn't healthy, so the plan keeps your weight.", ar: "مؤشر كتلة جسمك أقل من 18.5 — التخسيس أكتر مش صحي، فالخطة بتثبّت وزنك." }); }
  let kcal = tdee;
  if (goal === "lose") {
    let def = Math.round(rate * 7700 / 7);
    if (def > tdee * 0.25) { def = Math.round(tdee * 0.25); notes.push({ en: "The pace was capped at a quarter of your daily energy — faster loss mostly costs muscle.", ar: "السرعة اتحددت بربع طاقتك اليومية — التخسيس الأسرع بيضيّع عضل." }); }
    kcal = tdee - def;
  } else if (goal === "gain") kcal = tdee + Math.min(500, Math.round(rate * 7700 / 7));
  const floor = male ? 1500 : 1200;
  if (kcal < floor) { kcal = floor; notes.push({ en: `Never below ${floor} kcal a day without a doctor.`, ar: `مش أقل من ${floor} سعر في اليوم من غير دكتور.` }); }
  kcal = Math.round(kcal / 10) * 10;
  // protein by body weight (the goal weight when there's a lot to lose), then fat, then carbs
  const refKg = bmi > 30 && pr.goalKg ? Math.max(+pr.goalKg, kg * 0.75) : kg;
  const diet = pr.diet || "balanced";
  const pPerKg = diet === "high-protein" ? 2.0 : goal === "maintain" ? 1.4 : 1.8;
  let protein = Math.round(refKg * pPerKg);
  let fat, carbs;
  if (diet === "keto") { carbs = Math.min(30, Math.round(kcal * 0.05 / 4)); fat = Math.round((kcal - protein * 4 - carbs * 4) / 9); }
  else if (diet === "low-carb") { carbs = Math.round(kcal * 0.2 / 4); fat = Math.round((kcal - protein * 4 - carbs * 4) / 9); }
  else { fat = Math.max(Math.round(kg * 0.6), Math.round(kcal * 0.28 / 9)); carbs = Math.round((kcal - protein * 4 - fat * 9) / 4); }
  if (carbs < 0) { carbs = 0; protein = Math.round((kcal - fat * 9) / 4); }
  const water = Math.round((kg * 35 + (["active", "very"].includes(pr.activity) ? 500 : 0)) / 50) * 50;
  const fibre = Math.round(kcal / 1000 * 14);
  let weeks = null;
  if (pr.goalKg && goal !== "maintain" && Math.abs(+pr.goalKg - kg) > 0.2) {
    const perWeek = Math.abs(tdee - kcal) * 7 / 7700;
    if (perWeek > 0) weeks = Math.ceil(Math.abs(+pr.goalKg - kg) / perWeek);
  }
  return { bmr, tdee, kcal, protein, carbs, fat, fibre, water, bmi, goal, notes, weeks };
}

// ---- 3. the day ----
export const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
export const today = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export function dayTotals(day) {
  const items = MEALS.flatMap((m) => ((day && day.meals && day.meals[m]) || []));
  const eaten = sumN(items.filter((x) => x.kcal != null));
  const logged = ((day && day.workouts) || []).reduce((a, w) => a + (w.kcal || 0), 0);
  // v6.3: the watch's active calories (Health Connect) already include any workout it recorded —
  // so the larger of the two is used, never both added (a logged walk the watch also saw is not counted twice)
  const watch = (day && day.watch && day.watch.activeKcal) || 0;
  const burned = Math.max(logged, watch);
  return { ...eaten, burned, burnedFrom: watch > logged ? "watch" : logged ? "logged" : "", steps: (day && day.watch && day.watch.steps) || 0, water: (day && day.water) || 0, unknown: items.filter((x) => x.kcal == null).length };
}
/** Days in a row (up to today) with food logged. */
export function streak(days, from = new Date()) {
  let n = 0; const d = new Date(from);
  for (;;) { const k = today(d), day = days[k]; if (day && MEALS.some((m) => (day.meals && day.meals[m] || []).length)) { n++; d.setDate(d.getDate() - 1); } else break; }
  return n;
}
/** The last 7 days, by code: averages, protein kept, weight change. */
export function weekSummary(days, weights, tg, from = new Date()) {
  const rows = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(from); d.setDate(d.getDate() - i); const k = today(d); rows.push({ day: k, ...dayTotals(days[k]) }); }
  const logged = rows.filter((r) => r.kcal > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, r) => a + r.kcal, 0) / logged.length) : 0;
  const avgP = logged.length ? Math.round(logged.reduce((a, r) => a + r.p, 0) / logged.length) : 0;
  const onTarget = tg ? logged.filter((r) => Math.abs(r.kcal - tg.kcal) <= tg.kcal * 0.1).length : 0;
  const w = (weights || []).filter((x) => x.d >= rows[0].day).sort((a, b) => (a.d < b.d ? -1 : 1));
  const change = w.length >= 2 ? r1(w[w.length - 1].kg - w[0].kg) : null;
  return { rows, logged: logged.length, avg, avgP, onTarget, change };
}
/** Weight trend: 7-entry moving average per entry. */
export function trend(weights) {
  const w = [...(weights || [])].sort((a, b) => (a.d < b.d ? -1 : 1));
  return w.map((x, i) => { const s = w.slice(Math.max(0, i - 6), i + 1); return { ...x, avg: r1(s.reduce((a, y) => a + y.kg, 0) / s.length) }; });
}

// ---- 4. fasting ----
export const FASTS = { "12:12": 12, "14:10": 14, "16:8": 16, "18:6": 18, "20:4": 20 };
export function fastState(fast, now = Date.now()) {
  if (!fast || !fast.start) return null;
  const goalMs = (fast.hours || 16) * 3600e3, done = now - fast.start;
  return { done, goalMs, pct: Math.min(100, Math.round(done / goalMs * 100)), reached: done >= goalMs, endsAt: fast.start + goalMs };
}

// ---- 5. workouts ----
// MET values from the Compendium of Physical Activities (2011/2024), rounded
export const EXERCISES = [
  ["walk", "Walking (5 km/h)", "مشي (5 كم/ساعة)", 3.5, "cardio", "Upright, easy pace you can talk at."],
  ["walk-brisk", "Brisk walking (6 km/h)", "مشي سريع (6 كم/ساعة)", 4.3, "cardio", "Fast enough that talking is a little harder."],
  ["run-8", "Running (8 km/h)", "جري (8 كم/ساعة)", 8.3, "cardio", "Steady jog; land softly under your hips."],
  ["run-10", "Running (10 km/h)", "جري (10 كم/ساعة)", 9.8, "cardio", "Comfortably hard pace."],
  ["cycle", "Cycling (moderate)", "عجلة (متوسط)", 7.5, "cardio", "About 20 km/h on flat road."],
  ["bike", "Stationary bike", "عجلة ثابتة", 6.8, "cardio", "Moderate effort, steady cadence."],
  ["swim", "Swimming (moderate)", "سباحة (متوسط)", 5.8, "cardio", "Relaxed freestyle laps."],
  ["rope", "Jump rope", "نط الحبل", 11.8, "cardio", "Small jumps on the balls of your feet."],
  ["stairs", "Stair climbing", "طلوع السلم", 8.8, "cardio", "One step at a time, hold the rail if needed."],
  ["elliptical", "Elliptical", "إليبتكال", 5, "cardio", "Moderate resistance."],
  ["rowing", "Rowing machine", "تجديف", 7, "cardio", "Push with the legs, then pull with the arms."],
  ["hiit", "HIIT / circuit", "تمارين هيت|دائري", 8, "cardio", "Hard 30–40 s, easy 20 s, repeat."],
  ["football", "Football", "كورة|كرة قدم", 7, "sport", "A normal game."],
  ["padel", "Padel / tennis (doubles)", "بادل|تنس", 6, "sport", "Doubles, relaxed."],
  ["basketball", "Basketball", "باسكت|كرة سلة", 6.5, "sport", "A normal game."],
  ["weights", "Weight training (moderate)", "حديد|تمارين أوزان", 3.5, "strength", "Controlled reps, 1–2 reps left in the tank."],
  ["weights-hard", "Weight training (hard)", "حديد تقيل", 6, "strength", "Heavy sets close to failure."],
  ["bodyweight", "Bodyweight training", "تمارين وزن الجسم", 3.8, "strength", "Push-ups, squats, lunges, planks."],
  ["yoga", "Yoga", "يوجا", 2.5, "mobility", "Slow flow with steady breathing."],
  ["pilates", "Pilates", "بيلاتس", 3, "mobility", "Core-focused, controlled."],
  ["stretch", "Stretching", "إطالة|استرتش", 2.3, "mobility", "Hold each stretch 20–30 s, no bouncing."],
  ["dance", "Dancing", "رقص", 5, "cardio", "Any style, keep moving."],
  ["housework", "Housework", "شغل البيت", 3.3, "daily", "Cleaning, carrying, tidying."],
  ["squat", "Squats", "سكوات|قرفصاء", 5, "strength", "Feet shoulder-width, sit back, knees follow toes, chest up."],
  ["pushup", "Push-ups", "ضغط|بوش أب", 3.8, "strength", "Body in one line; knees on the floor is fine to start."],
  ["lunge", "Lunges", "طعنات|لانجز", 4, "strength", "Long step, back knee towards the floor, front knee over the ankle."],
  ["plank", "Plank", "بلانك", 3.8, "strength", "Elbows under shoulders, squeeze glutes, don't let hips sag."],
  ["glute-bridge", "Glute bridge", "جلوت بريدج|رفع الحوض", 3.5, "strength", "Lie on your back, push through heels, squeeze at the top."],
  ["superman", "Superman", "سوبرمان", 3, "strength", "Lie face down, lift arms and legs a little, hold 2 s."],
  ["row", "Dumbbell / bottle row", "سحب بالدمبل", 3.5, "strength", "Flat back, pull the elbow to your hip."],
  ["shoulder-press", "Shoulder press", "ضغط أكتاف", 3.5, "strength", "Press overhead without arching the back."],
  ["deadlift", "Deadlift", "ديدلفت|رفعة ميتة", 6, "strength", "Hinge at the hips, flat back, bar close to legs."],
  ["bench", "Bench press", "بنش بريس|بنش", 5, "strength", "Shoulder blades pinched, bar to mid-chest."],
  ["pullup", "Pull-ups / lat pulldown", "عقلة|سحب عالي", 5, "strength", "Pull elbows down to your ribs."],
  ["jumping-jacks", "Jumping jacks", "جامبنج جاك", 8, "cardio", "Arms and legs out and in, light on your feet."],
  ["mountain-climbers", "Mountain climbers", "ماونتن كلايمر", 8, "cardio", "Plank position, drive knees to chest in turn."],
  ["crunch", "Crunches", "بطن|كرانش", 3.8, "strength", "Lift shoulders, not the neck; slow down."],
].map(([id, en, ar, met, kind, how]) => ({ id, en, ar: ar.split("|")[0], names: [en, ...ar.split("|")], met, kind, how }));
const EX_BY = new Map(EXERCISES.map((e) => [e.id, e]));
export const exercise = (id) => EX_BY.get(id) || null;
export function matchExercise(name) {
  const q = normT(name); if (!q) return null;
  let best = null, bestS = 0;
  for (const e of EXERCISES) for (const n0 of e.names) {
    const n = normT(n0).replace(/\([^)]*\)/g, "").trim();
    if (!n) continue;
    if (q === n || q.includes(n) || n.includes(q)) { const s = Math.min(q.length, n.length) / Math.max(q.length, n.length) + 1; if (s > bestS) { bestS = s; best = e; } }
    else { const qw = q.split(" ").map(stem), nw = n.split(" ").map(stem); const hit = nw.filter((w) => w.length > 2 && qw.includes(w)).length; const s = hit / nw.length; if (s > bestS && s >= 0.5) { bestS = s; best = e; } }
  }
  return best;
}
/** Calories burned: MET × kg × hours (the standard formula). */
export const burned = (met, kg, minutes) => Math.round(met * (+kg || 70) * (minutes / 60));

// ready-made plans: [exercise id, sets, reps or seconds ("45s"), rest seconds]
export const PLANS = [
  { id: "home-beginner", en: "Home full body — beginner", ar: "جسم كامل في البيت — مبتدئ", days: 3, minutes: 25, equipment: "none", level: "beginner",
    workout: [["squat", 3, 12, 60], ["pushup", 3, 8, 60], ["glute-bridge", 3, 12, 45], ["lunge", 3, 10, 60], ["plank", 3, "30s", 45], ["superman", 3, 12, 45]] },
  { id: "walk-fatburn", en: "Fat-burn walking", ar: "مشي لحرق الدهون", days: 5, minutes: 40, equipment: "none", level: "beginner",
    workout: [["walk", 1, "5m", 0], ["walk-brisk", 1, "30m", 0], ["walk", 1, "5m", 0]] },
  { id: "hiit-7", en: "Quick HIIT — 8 moves", ar: "هيت سريع — 8 حركات", days: 4, minutes: 10, equipment: "none", level: "intermediate",
    workout: [["jumping-jacks", 1, "30s", 10], ["squat", 1, "30s", 10], ["pushup", 1, "30s", 10], ["crunch", 1, "30s", 10], ["lunge", 1, "30s", 10], ["plank", 1, "30s", 10], ["mountain-climbers", 1, "30s", 10], ["glute-bridge", 1, "30s", 10]] },
  { id: "gym-strength", en: "Gym strength — 3 days", ar: "قوة في الجيم — 3 أيام", days: 3, minutes: 55, equipment: "gym", level: "intermediate",
    workout: [["squat", 4, 8, 120], ["bench", 4, 8, 120], ["row", 3, 10, 90], ["shoulder-press", 3, 10, 90], ["plank", 3, "45s", 60]] },
  { id: "core-back", en: "Core & back (desk workers)", ar: "بطن وضهر (لشغل المكاتب)", days: 4, minutes: 15, equipment: "none", level: "beginner",
    workout: [["glute-bridge", 3, 12, 30], ["superman", 3, 10, 30], ["plank", 3, "30s", 30], ["crunch", 3, 12, 30], ["stretch", 1, "3m", 0]] },
];
/** Minutes and calories of a plan's workout for a weight. */
export function planCost(workout, kg) {
  let minutes = 0, kcal = 0;
  for (const [id, sets, reps, rest] of workout) {
    const e = exercise(id) || { met: 5 };
    const secs = typeof reps === "string" ? (/m$/.test(reps) ? parseFloat(reps) * 60 : parseFloat(reps)) : reps * 3;   // ~3 s a rep
    const work = sets * secs, restS = Math.max(0, sets - 1) * (rest || 0) + (rest || 0);
    minutes += (work + restS) / 60; kcal += e.met * (+kg || 70) * (work / 3600) + 1.5 * (+kg || 70) * (restS / 3600);
  }
  return { minutes: Math.round(minutes), kcal: Math.round(kcal) };
}
export function workoutMessages({ goal, level, equipment, minutes, days, notes, lang }) {
  return [
    { role: "system", content: `You are a certified personal trainer. Write a weekly workout plan. Reply with ONLY a JSON object:
{"name": "short plan name", "days": [{"name": "Day 1 — …", "exercises": [{"name": "exercise name in English", "sets": number, "reps": number or "30s", "rest": seconds}]}], "tips": ["short safety or progress tip"]}
Rules: ${days} training days, about ${minutes} minutes each, equipment: ${equipment}, level: ${level}. Use common, safe exercises (squats, push-ups, lunges, plank, rows, walking, cycling…). Warm-up and cool-down included. No medical claims. Tips in ${lang === "ar" ? "Egyptian Arabic" : "English"}.` },
    { role: "user", content: `Goal: ${goal}.${notes ? " Notes: " + notes : ""}` },
  ];
}
/** The model's plan → days of [exercise id or name, sets, reps, rest] with the library's MET; unknown names kept. */
export function parseWorkout(raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return null; }
  const days = (Array.isArray(j && j.days) ? j.days : []).map((d, i) => ({
    name: String(d.name || `Day ${i + 1}`).slice(0, 60),
    exercises: (Array.isArray(d.exercises) ? d.exercises : []).map((x) => {
      const e = matchExercise(String(x.name || ""));
      const sets = Math.min(10, Math.max(1, Math.round(num(x.sets) || 3)));
      const rv = typeof x.reps === "string" && /s|m/.test(x.reps) ? x.reps.replace(/\s+/g, "") : Math.min(100, Math.max(1, Math.round(num(x.reps) || 10)));
      return { id: e ? e.id : null, name: e ? e.en : String(x.name || "").slice(0, 50), sets, reps: rv, rest: Math.min(300, Math.max(0, Math.round(num(x.rest) ?? 60))) };
    }).filter((x) => x.name).slice(0, 12),
  })).filter((d) => d.exercises.length).slice(0, 7);
  if (!days.length) return null;
  return { name: String((j && j.name) || "My plan").slice(0, 60), days, tips: (Array.isArray(j && j.tips) ? j.tips : []).map(String).slice(0, 5) };
}

// ---- 6. recipes (per serving, computed from the food table) ----
export const RECIPES = [
  { id: "ful-plate", en: "Ful with olive oil, salad and baladi bread", ar: "فول بزيت الزيتون وسلطة وعيش بلدي", serves: 1, mins: 10, tags: ["breakfast", "egyptian", "high-fibre"],
    items: [["ful", 200], ["olive-oil", 7], ["tomato", 60], ["cucumber", 60], ["lemon", 10], ["baladi", 90]],
    steps: ["Warm the ful with a little water.", "Top with olive oil, lemon and cumin.", "Serve with chopped tomato and cucumber and one baladi loaf."] },
  { id: "veg-omelette", en: "Vegetable omelette", ar: "أومليت بالخضار", serves: 1, mins: 10, tags: ["breakfast", "high-protein", "low-carb"],
    items: [["egg", 150], ["onion", 30], ["tomato", 60], ["pepper", 40], ["olive-oil", 5], ["feta", 30]],
    steps: ["Soften the onion and pepper in the oil.", "Add beaten eggs and tomato; cook on low heat.", "Crumble the white cheese on top and fold."] },
  { id: "chicken-rice", en: "Grilled chicken, rice and salad", ar: "فراخ مشوية مع رز وسلطة", serves: 1, mins: 30, tags: ["lunch", "high-protein"],
    items: [["chicken-breast", 150], ["rice", 150], ["salad", 200], ["olive-oil", 5], ["lemon", 10]],
    steps: ["Season the chicken with garlic, lemon and spices; grill 6–7 min a side.", "Serve with cooked rice.", "Add a big salad with a teaspoon of olive oil."] },
  { id: "lentil-soup", en: "Lentil soup", ar: "شوربة عدس", serves: 3, mins: 35, tags: ["dinner", "egyptian", "vegetarian", "high-fibre"],
    items: [["lentils-dry", 180], ["onion", 110], ["carrot", 120], ["tomato", 120], ["olive-oil", 14], ["garlic", 6]],
    steps: ["Boil lentils, onion, carrot and tomato in 1.2 L water for 25 min.", "Blend smooth.", "Fry the garlic and cumin in the oil and stir in. Squeeze lemon to serve."] },
  { id: "light-koshari", en: "Lighter koshari", ar: "كشري لايت", serves: 4, mins: 45, tags: ["lunch", "egyptian", "vegetarian"],
    items: [["rice-dry", 150], ["lentils-dry", 150], ["pasta-dry", 150], ["chickpeas", 100], ["tomato-paste", 64], ["onion", 220], ["olive-oil", 27], ["garlic", 9]],
    steps: ["Cook rice with the lentils; cook the pasta.", "Tomato sauce: paste, garlic, vinegar, cumin, a little oil.", "Bake the onion slices with a spoon of oil until crisp instead of deep-frying.", "Layer and top with chickpeas and sauce."] },
  { id: "tuna-salad", en: "Tuna salad", ar: "سلطة تونة", serves: 1, mins: 10, tags: ["lunch", "high-protein", "low-carb"],
    items: [["tuna-water", 120], ["lettuce", 60], ["tomato", 80], ["cucumber", 80], ["corn", 50], ["olive-oil", 7], ["lemon", 15]],
    steps: ["Drain the tuna.", "Chop the vegetables.", "Mix with lemon, olive oil and pepper."] },
  { id: "yogurt-oats", en: "Greek yogurt, oats and fruit", ar: "زبادي يوناني بالشوفان والفاكهة", serves: 1, mins: 5, tags: ["breakfast", "high-protein"],
    items: [["greek-yogurt", 170], ["oats", 40], ["banana", 60], ["honey", 7], ["almonds", 10]],
    steps: ["Put the yogurt in a bowl.", "Add the oats, sliced banana and almonds.", "Finish with a teaspoon of honey."] },
  { id: "molokhia-chicken", en: "Molokhia with chicken and rice", ar: "ملوخية بالفراخ والرز", serves: 1, mins: 40, tags: ["lunch", "egyptian"],
    items: [["molokhia", 250], ["chicken-breast", 120], ["rice", 120]],
    steps: ["Cook the molokhia in chicken broth with garlic and coriander.", "Serve with the chicken (skin off) and rice."] },
  { id: "shakshuka", en: "Shakshuka", ar: "شكشوكة", serves: 2, mins: 20, tags: ["breakfast", "vegetarian"],
    items: [["egg", 200], ["tomato", 370], ["pepper", 120], ["onion", 110], ["olive-oil", 14], ["garlic", 6]],
    steps: ["Soften onion, pepper and garlic in the oil.", "Add chopped tomatoes and cumin; simmer 10 min.", "Make wells, crack in the eggs, cover until set."] },
  { id: "overnight-oats", en: "Overnight oats", ar: "شوفان بايت", serves: 1, mins: 5, tags: ["breakfast", "vegetarian"],
    items: [["oats", 50], ["milk-skim", 150], ["greek-yogurt", 70], ["strawberries", 80], ["honey", 7]],
    steps: ["Mix oats, milk and yogurt in a jar.", "Leave in the fridge overnight.", "Top with strawberries and honey."] },
  { id: "fish-potato", en: "Grilled fish with sweet potato", ar: "سمك مشوي مع بطاطا", serves: 1, mins: 30, tags: ["dinner", "high-protein"],
    items: [["fish", 180], ["sweet-potato", 150], ["broccoli", 90], ["olive-oil", 7], ["lemon", 15]],
    steps: ["Season the fish with lemon, garlic and cumin; grill 4–5 min a side.", "Bake or boil the sweet potato.", "Steam the broccoli; drizzle the oil."] },
  { id: "hummus-plate", en: "Hummus plate with vegetables", ar: "طبق حمص بالخضار", serves: 1, mins: 5, tags: ["snack", "vegetarian"],
    items: [["hummus", 100], ["carrot", 60], ["cucumber", 100], ["pepper", 60], ["shami", 30]],
    steps: ["Spoon the hummus into a plate.", "Cut the vegetables into sticks.", "Half a pita on the side."] },
  { id: "chicken-bowl", en: "Chicken shawarma bowl (home)", ar: "بول شاورما فراخ (في البيت)", serves: 1, mins: 25, tags: ["lunch", "high-protein"],
    items: [["chicken-breast", 150], ["rice", 100], ["salad", 150], ["tahini", 15], ["yogurt", 50]],
    steps: ["Marinate the chicken in yogurt, garlic and shawarma spices; pan-grill.", "Slice and serve on rice and salad.", "Tahini-lemon sauce on top."] },
  { id: "kofta-salad", en: "Kofta with salad", ar: "كفتة مع سلطة", serves: 1, mins: 25, tags: ["dinner", "high-protein", "low-carb"],
    items: [["kofta", 160], ["salad", 200], ["tahini", 15], ["baladi", 45]],
    steps: ["Grill the kofta skewers.", "Serve with a big salad and tahini.", "Half a baladi loaf."] },
  { id: "banana-pancakes", en: "Oat banana pancakes", ar: "بان كيك شوفان وموز", serves: 1, mins: 15, tags: ["breakfast", "vegetarian"],
    items: [["oats", 40], ["banana", 100], ["egg", 100], ["honey", 7]],
    steps: ["Blend oats, banana and eggs.", "Cook small pancakes on a non-stick pan.", "A teaspoon of honey on top."] },
  { id: "protein-shake", en: "Protein smoothie", ar: "سموذي بروتين", serves: 1, mins: 3, tags: ["snack", "high-protein"],
    items: [["milk-skim", 250], ["banana", 100], ["whey", 30], ["peanut-butter", 16]],
    steps: ["Blend everything with ice."] },
];
RECIPES.push(...MORE_RECIPES);
/** Per-serving nutrients of a recipe (from the table), plus its grams. */
export function recipeNutrients(rc) {
  const parts = rc.items.map(([id, g]) => { const fd = food(id); return fd ? nutrients(fd, g) : { kcal: 0, p: 0, c: 0, f: 0, fib: 0 }; });
  const all = sumN(parts), s = rc.serves || 1;
  return { kcal: Math.round(all.kcal / s), p: r1(all.p / s), c: r1(all.c / s), f: r1(all.f / s), fib: r1(all.fib / s), grams: Math.round(rc.items.reduce((a, [, g]) => a + g, 0) / s) };
}
export function recipeMessages(have, wish, lang, kcalHint) {
  return [
    { role: "system", content: `You are a nutritionist-chef. Invent ONE healthy recipe. Reply with ONLY a JSON object:
{"name": "…", "serves": number, "minutes": number, "ingredients": [{"food": "simple generic ingredient name in English", "grams": number}], "steps": ["…"]}
Rules: real amounts in grams (raw weight; oil counted), 3–8 short steps, home cooking${kcalHint ? `, about ${kcalHint} kcal a serving` : ""}. Name and steps in ${lang === "ar" ? "Egyptian Arabic" : "English"}.` },
    { role: "user", content: `I have: ${have || "anything"}.${wish ? " I want: " + wish + "." : ""}` },
  ];
}
/** The model's recipe → a recipe of table foods; an ingredient not in the table is listed as unknown (no calories). */
export function parseRecipe(raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return null; }
  if (!j || !Array.isArray(j.ingredients)) return null;
  const items = [], unknown = [];
  for (const it of j.ingredients) {
    const fd = matchFood(String(it.food || it.name || "")), g = num(it.grams);
    if (!(g > 0)) continue;
    if (fd) items.push([fd.id, Math.round(g)]); else unknown.push({ name: String(it.food || it.name || "").slice(0, 40), grams: Math.round(g) });
  }
  if (!items.length) return null;
  return { id: "ai-" + Date.now().toString(36), en: String(j.name || "My recipe").slice(0, 80), ar: String(j.name || "").slice(0, 80), serves: Math.min(12, Math.max(1, Math.round(num(j.serves) || 1))),
    mins: Math.round(num(j.minutes) || 20), tags: ["ai"], items, unknown, steps: (Array.isArray(j.steps) ? j.steps : []).map(String).slice(0, 10) };
}

// ---- 7. a coach's note, by code, from the day's numbers ----
export function dayTips(tot, tg, lang) {
  if (!tg) return [];
  const ar = lang === "ar", out = [];
  const left = tg.kcal - tot.kcal + (tot.burned || 0);
  if (tot.kcal > 0 && tot.p < tg.protein * 0.6 && new Date().getHours() >= 15) out.push(ar ? `البروتين لسه ${Math.round(tot.p)} من ${tg.protein} جم — ضيف فراخ أو بيض أو زبادي يوناني.` : `Protein is at ${Math.round(tot.p)} of ${tg.protein} g — add chicken, eggs or Greek yogurt.`);
  if (left < -200) out.push(ar ? `عديت هدفك بـ ${-left} سعر — مشي 30 دقيقة بيحرق حوالي ${burned(4.3, tg.kg || 70, 30)}.` : `You're ${-left} kcal over — a 30-minute brisk walk burns about ${burned(4.3, tg.kg || 70, 30)}.`);
  if (tot.water < tg.water * 0.5 && new Date().getHours() >= 14) out.push(ar ? "المية أقل من نص هدفك — اشرب كوبايتين دلوقتي." : "Water is under half your goal — drink two glasses now.");
  if (tot.fib < tg.fibre * 0.5 && tot.kcal > tg.kcal * 0.6) out.push(ar ? "الألياف قليلة — فول، عدس، خضار أو شوفان." : "Fibre is low — ful, lentils, vegetables or oats help.");
  return out.slice(0, 2);
}

// ---- 7. search and a day's meal plan, by code ----
/** Foods whose name (English or Arabic) contains the words typed → up to `n`, best first. */
export function searchFoods(q, n = 30) {
  const t = normT(q); if (!t) return [];
  const exact = [], starts = [], has = [];
  for (const fd of FOODS) {
    const names = fd.names.map(normT);
    if (names.includes(t)) exact.push(fd);
    else if (names.some((x) => x.startsWith(t))) starts.push(fd);
    else if (names.some((x) => x.includes(t)) || t.split(" ").every((w) => names.some((x) => x.includes(stem(w))))) has.push(fd);
  }
  return [...exact, ...starts, ...has].slice(0, n);
}
const SPLIT = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snacks: 0.1 };
const SLOT_TAG = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snacks: "snack" };
/**
 * A day of meals from the recipe book, sized to the calorie target: each meal's share of the day
 * (25/35/30/10 %), the recipe that fits the diet, portions scaled in quarters (0.5–2×).
 * seed changes the picks (day of the year → a different day each day). → { meals: {slot: {recipe, x, kcal, p, c, f}}, total }
 */
export function mealPlan(tg, { diet = "balanced", seed = 0, avoid = [] } = {}) {
  if (!tg) return null;
  const ok = (rc) => !avoid.includes(rc.id) && (diet !== "vegetarian" || rc.tags.includes("vegetarian")) && (diet === "keto" ? recipeNutrients(rc).c < 12 : diet !== "low-carb" || rc.tags.includes("low-carb") || recipeNutrients(rc).c < 25);
  const meals = {}; const used = new Set();
  MEALS.forEach((slot, si) => {
    const want = tg.kcal * SPLIT[slot];
    let pool = RECIPES.filter((rc) => ok(rc) && !used.has(rc.id) && (rc.tags.includes(SLOT_TAG[slot]) || (slot !== "breakfast" && slot !== "snacks" && rc.tags.some((x) => x === "lunch" || x === "dinner"))));
    if (!pool.length) pool = RECIPES.filter((rc) => !used.has(rc.id) && rc.tags.includes(SLOT_TAG[slot]));
    if (!pool.length) return;
    // closest to the wanted calories after scaling, with the protein-dense ones first; seed rotates ties
    const scored = pool.map((rc) => { const n = recipeNutrients(rc); const x = Math.min(2, Math.max(0.5, Math.round(want / Math.max(n.kcal, 1) * 4) / 4)); return { rc, n, x, err: Math.abs(n.kcal * x - want) / want - (n.p * 4 / Math.max(n.kcal, 1)) * 0.3 }; })
      .sort((a, b) => a.err - b.err);
    const top = scored.slice(0, Math.min(4, scored.length));
    const pick = top[(seed + si) % top.length];
    used.add(pick.rc.id);
    meals[slot] = { recipe: pick.rc, x: pick.x, kcal: Math.round(pick.n.kcal * pick.x), p: r1(pick.n.p * pick.x), c: r1(pick.n.c * pick.x), f: r1(pick.n.f * pick.x) };
  });
  return { meals, total: sumN(Object.values(meals)) };
}
/** "I ate 2 eggs and…" / «كلت طبق كشري» → true: Chat offers to log it in Fit. */
export function looksLikeFoodLog(text) {
  const t = String(text || "");
  if (t.length > 300 || /\?|؟/.test(t)) return false;
  return /\b(i (just )?(ate|had)|i'?ve (eaten|had)|for (breakfast|lunch|dinner|a snack) i (ate|had))\b/i.test(t) || /(^|\s)(كلت|اكلت|أكلت|فطرت|اتغديت|اتعشيت|تغديت|تعشيت)(\s|$)/.test(t);
}
/** v6.1: any food (the table, a packaged product, a USDA food) + an amount → a logged item. */
export function itemFromFood(fd, qty = 1, unit = "serving") {
  const grams = Math.round(gramsOf(fd, qty, unit));
  const q = {}; for (const k of ["sug", "sat", "salt"]) if (fd[k] != null) q[k] = r1(fd[k] * grams / 100);   // v6.2 quality, when the label gives it
  return { name: fd.en, ar: fd.ar || "", id: fd.id, src: fd.src || "table", brand: fd.brand || "", qty, unit: unitNorm(unit), grams, ...nutrients(fd, grams), ...q,
    ...(fd.grade ? { grade: fd.grade } : {}), ...(fd.nova ? { nova: fd.nova } : {}), estimate: false, check: !!fd.check };
}

// ---- v6.1 photo recognition, on the phone (Ali: "an elite photo food recognition"; no cloud) ----
// The same phone model, used better: several guesses per food (you tap the right one), portions
// judged against things of known size, a second look for hidden calories (oil, butter, sauce, sugar,
// bread on the side), nutrition labels read exactly, and your corrections remembered.
// v6.3: the names the model should pick from — a closed list makes a small vision model far more accurate
export const DISH_NAMES = [...new Set(FOODS.filter((f) => !/-(raw|dry)$|^(molokhia-leaves|beef-mince-raw)$/.test(f.id)).map((f) => f.en.replace(/\s*\(.*\)$/, "")))];
export function photoMessages(note) {
  return [
    { role: "system", content: `You are a dietitian looking at a photo of food. Reply with ONLY a JSON object:
{"kind": "meal" or "label" (a nutrition facts table is visible) or "package" (a packaged product, no table visible),
 "plate": "dinner plate" | "side plate" | "bowl" | "tray" | "none",
 "items": [{"food": "name — pick from the list below when one fits", "alternatives": ["second guess", "third guess"],
            "count": number of pieces if it is countable (eggs, falafel, bread loaves, slices, skewers, pieces of chicken, dates) else null,
            "container": "plate" | "bowl" | "glass" | "cup" | "can" | "bottle" | "sandwich" | "hand" | "none",
            "plate_share": 0 to 1 — how much of the plate's surface this food covers (null if not on a plate),
            "height": "flat" | "normal" | "heaped", "grams": your estimate as eaten,
            "confidence": 0 to 1, "box": [x, y, w, h] where it is in the photo, each 0 to 1}],
 "label": {"name": "product name", "per": "100g" or "serving", "serving_g": number or null, "kcal": number, "protein": number, "carbs": number, "fat": number, "fiber": number or null} or null}
Rules: one item per separate food (a sandwich or a mixed dish like koshari is ONE item). Count what can be counted. Judge sizes against things of known size: a dinner plate is 26 cm across, a side plate 20 cm, a tablespoon, a 330 ml can, a baladi loaf, a hand. If unsure, give your best guess, alternatives, and a lower confidence — never invent a food you can't see. For a label, copy its numbers exactly.
Food names to pick from: ${DISH_NAMES.join(", ")}.${note ? "\nThe person adds: " + note : ""}` },
    { role: "user", content: "What is in this photo?" },
  ];
}
/** The zoomed second look at one unsure food. */
export function zoomMessages(item) {
  return [
    { role: "system", content: `This is a close-up of one food from a meal photo. The first look guessed: ${[item.said || item.name, ...((item.alts || []).map((a) => a.label))].filter(Boolean).join(", ")}.
Which food is it really? Reply with ONLY a JSON object: {"food": "name (from the list when it fits)", "alternatives": ["…", "…"], "confidence": 0 to 1}.
Food names to pick from: ${DISH_NAMES.join(", ")}.` },
    { role: "user", content: "What is this?" },
  ];
}
// grams from what the model can judge well — the share of a 26 cm plate, how high it is, a count, a container
const PLATE_CM2 = { "dinner plate": 531, "side plate": 314, bowl: 200, tray: 900, none: 531 };
const HEIGHT_CM = { flat: 1, normal: 2.2, heaped: 3.8 };
function density(fd) {
  const id = fd.id, g = String(fd.group || "");
  if (/salad|lettuce|rocket|spinach|cabbage|fattoush|tabbouleh/.test(id)) return 0.3;
  if (/fries|chips|popcorn|cornflakes/.test(id)) return 0.35;
  if (/bread|baladi|shami|toast|fino|pita|feteer|croissant/.test(id) || /bak/.test(g)) return 0.3;
  if (/rice|koshari|biryani|kabsa|mandi|maqluba|freekeh|bulgur|couscous|mujadara|fatta/.test(id)) return 0.85;
  if (/pasta|noodles|lasagna|bechamel|negresco/.test(id)) return 0.7;
  if (/soup|molokhia|stew|bamia|fasolia|lentil/.test(id)) return 1.0;
  if (/chicken|beef|kofta|kebab|lamb|veal|liver|fish|salmon|shrimp|steak|meat|shawarma/.test(id)) return 1.05;
  if (/cake|basbousa|konafa|om-ali|baklava|kahk/.test(id)) return 0.8;
  return 0.8;
}
/** The geometric estimate (g) of a photo item, or null when the model gave nothing to measure. */
export function geoGrams(fd, it, plate = "dinner plate") {
  if (!fd) return null;
  const P = fd.portions || {}, n = num(it.count), c = String(it.container || "").toLowerCase();
  if (n > 0 && n <= 40) { const per = P.piece ?? P.loaf ?? P.slice ?? P.skewer ?? P.egg ?? P.date ?? P.disc ?? P.sandwich; if (per) return n * per; }
  if (["glass", "cup", "can", "bottle", "sandwich"].includes(c) && P[c]) return P[c] * (n > 0 && n <= 6 ? n : 1);
  if (c === "bowl" && (P.bowl || P.plate)) return P.bowl || P.plate;
  const share = num(it.plate_share);
  if (share > 0 && share <= 1) { const area = (PLATE_CM2[plate] || 531) * share; return Math.round(area * (HEIGHT_CM[it.height] || 2.2) * density(fd)); }
  return null;
}
/** The second look: calories people forget to log. */
export function hiddenMessages(items) {
  return [
    { role: "system", content: `A dietitian already found these foods in the photo: ${items.map((x) => x.name).join(", ")}.
Look again ONLY for calories people usually miss: cooking oil or butter on or under the food, ghee, sauces, dressings, tahini, mayonnaise, sugar in a drink, a drink in the picture, bread or rice on the side. Reply with ONLY a JSON object:
{"items": [{"food": "generic name in English", "grams": number, "confidence": 0 to 1}]} — an empty list if nothing was missed. Never repeat a food already found.` },
    { role: "user", content: "Anything missed?" },
  ];
}
const LEARN_KEY = "attune:fit:learn:v1";
const learnLoad = () => { try { const v = JSON.parse(localStorage.getItem(LEARN_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
/** Remember a correction: what the model said → the food the person chose, and how their portion compares. */
export function learnFix(modelName, food, gramsRatio = 1) {
  const k = normT(modelName); if (!k || !food) return;
  const L = learnLoad(), old = L[k] || { n: 0, ratio: 1 };
  const n = Math.min(old.n + 1, 20), ratio = Math.min(3, Math.max(0.33, (old.ratio * old.n + gramsRatio) / (old.n + 1)));
  L[k] = { id: food.id, food: food.src && food.src !== "table" ? food : null, n, ratio: Math.round(ratio * 100) / 100 };
  try { localStorage.setItem(LEARN_KEY, JSON.stringify(L)); } catch (e) {}
}
export const learned = (modelName) => learnLoad()[normT(modelName)] || null;

/** One photo item: the learned choice first, then the table; its alternatives as ready choices. */
function photoItem(it, extra = {}, plate = "dinner plate") {
  const name = String(it.food || it.name || "").trim(); if (!name) return null;
  let grams = num(it.grams); if (!(grams > 0 && grams < 3000)) grams = null;
  const lf = learned(name);
  let fd = lf ? (food(lf.id) || lf.food) : matchFood(name);
  // v6.3: the geometric estimate (plate share × height × density, or a count, or a container) —
  // blended with the model's own grams; when they disagree by more than 2.5× the item is flagged
  let portionFlag = false;
  const geo = fd ? geoGrams(fd, it, plate) : null;
  if (geo && grams) { if (Math.max(geo, grams) / Math.min(geo, grams) > 2.5) portionFlag = true; grams = Math.round(Math.sqrt(geo * grams)); }
  else if (geo) grams = geo;
  if (lf && grams) grams *= lf.ratio;
  const alts = [...new Set([name, ...(Array.isArray(it.alternatives) ? it.alternatives : [])].map(String))]
    .map((a) => ({ label: a, food: matchFood(a) })).filter((a) => a.label.trim()).slice(0, 3);
  const conf = Math.max(0, Math.min(1, num(it.confidence) ?? 0.6));
  let item;
  if (fd) { const g = Math.round(grams || gramsOf(fd, 1, "serving")); item = { name: fd.en, ar: fd.ar || "", id: fd.id, src: fd.src || "table", qty: 1, unit: "g", grams: g, ...nutrients(fd, g), estimate: false }; }
  else item = { name, qty: 1, unit: "g", grams: Math.round(grams || 150), kcal: null, p: null, c: null, f: null, fib: 0, estimate: true, unknown: true };
  const box = Array.isArray(it.box) && it.box.length === 4 && it.box.every((v) => num(v) >= 0 && num(v) <= 1) ? it.box.map(num) : null;
  return { ...item, said: name, alts, conf, learned: !!lf, base: item.grams, ...(portionFlag ? { flag: "portion" } : {}), ...(box ? { box } : {}), ...extra };
}
/** The zoomed look's JSON → the item with a better name (the grams stay), or the item unchanged. */
export function applyZoom(item, raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return item; }
  const name = String((j && j.food) || "").trim(); const fd = name && matchFood(name);
  const conf = Math.max(0, Math.min(1, num(j && j.confidence) ?? 0.5));
  if (!fd || conf < (item.conf || 0)) return { ...item, zoomed: true };
  const alts = [...new Set([name, ...(Array.isArray(j.alternatives) ? j.alternatives : []), item.said].map(String))].map((a) => ({ label: a, food: matchFood(a) })).filter((a) => a.food).slice(0, 3);
  return { ...chooseFood(item, fd), chosen: false, conf, alts, zoomed: true };
}
/** The model's photo JSON → { kind, items, label } (label = a food made from the label's numbers). */
export function parsePhoto(raw) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return { kind: "meal", items: [], label: null }; }
  const kind = ["meal", "label", "package"].includes(j && j.kind) ? j.kind : "meal";
  let label = null;
  const L = j && j.label;
  if (L && num(L.kcal) != null && num(L.protein) != null && num(L.carbs) != null && num(L.fat) != null) {
    const per = String(L.per || "100g").toLowerCase().includes("serv") && num(L.serving_g) > 0 ? 100 / num(L.serving_g) : 1;
    label = { id: "label:" + Date.now().toString(36), src: "label", en: String(L.name || "Labelled product").slice(0, 80), ar: "", names: [String(L.name || "")],
      kcal: Math.round(num(L.kcal) * per), p: r1(num(L.protein) * per), c: r1(num(L.carbs) * per), f: r1(num(L.fat) * per), fib: r1((num(L.fiber) || 0) * per),
      portions: num(L.serving_g) > 0 ? { serving: Math.round(num(L.serving_g)) } : {} };
  }
  const plate = Object.keys(PLATE_CM2).includes(j && j.plate) ? j.plate : "dinner plate";
  const items = (Array.isArray(j && j.items) ? j.items : []).map((it) => photoItem(it, {}, plate)).filter(Boolean).slice(0, 12);
  return { kind, items, label };
}
/** The second look's JSON → extra items (never one already on the list). */
export function parseHidden(raw, have) {
  let j = null;
  try { const s = String(raw || ""); j = JSON.parse(s.slice(s.indexOf("{"), s.lastIndexOf("}") + 1)); } catch (e) { return []; }
  const seen = new Set(have.flatMap((x) => [normT(x.name), normT(x.said || "")]));
  return (Array.isArray(j && j.items) ? j.items : []).map((it) => photoItem(it, { hidden: true }))
    .filter((x) => x && !seen.has(normT(x.name)) && !seen.has(normT(x.said)) && x.grams > 0 && x.grams <= 400).slice(0, 5);
}
/** Swap an item for one of its alternatives (or any food), keeping the grams. */
export function chooseFood(item, fd) {
  let g = item.grams, more = {};
  // v6.4: a typed item ("2 pieces", «طعمية») swapped for another food takes that food's own portion —
  // a photo item keeps its grams (the amount on the plate doesn't change with the name)
  if (item.from === "text" && fd.id !== item.id) {
    const P = fd.portions || {};
    g = Math.round(item.explicit && (item.unit === "g" || item.unit === "ml") ? item.grams : P[item.unit] != null ? (item.qty || 1) * P[item.unit] : gramsOf(fd, 1, "serving"));
    more = { base: g, k: 1 };
  }
  return { ...item, ...more, grams: g, name: fd.en, ar: fd.ar || "", id: fd.id, src: fd.src || "table", ...nutrients(fd, g), estimate: false, unknown: false, check: !!fd.check, chosen: true };
}
/** Scale an item's portion (×0.5 … ×2). */
export function scaleItem(item, k) {
  const g = Math.max(1, Math.round((item.base || item.grams) * k));
  if (item.kcal == null) return { ...item, grams: g, k };
  const s = g / item.grams, q = {};
  for (const key of ["sug", "sat", "salt"]) if (item[key] != null) q[key] = r1(item[key] * s);
  return { ...item, ...q, grams: g, k, kcal: Math.round(item.kcal * s), p: r1(item.p * s), c: r1(item.c * s), f: r1(item.f * s), fib: r1((item.fib || 0) * s) };
}
