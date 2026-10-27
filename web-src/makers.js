/* ---- v8.4 (Ali's Lynk & Co 900 answer: "an SUV from South Korea") — who makes a car and where is a FACT the app knows by
   code, not something a small model should guess. `makerOf` names the brand's maker and country; `makerNote` hands it to the
   model before the sources; `fixMakerCountry` corrects a wrong country the answer still writes next to the brand.
   Pure; tests/unit/v840web.test.mjs.                                                                                        */

// [brand pattern, brand name, maker, country, adjective]
const M = [
  [/lynk\s*(&|and|n)?\s*co|لينك/i, "Lynk & Co", "Geely Holding", "China", "Chinese"],
  [/zeekr|زيكر/i, "Zeekr", "Geely Holding", "China", "Chinese"],
  [/\bgeely\b|جيلي/i, "Geely", "Geely Holding", "China", "Chinese"],
  [/\bbyd\b|بي واي دي/i, "BYD", "BYD Auto", "China", "Chinese"],
  [/\bjetour\b|جيتور/i, "Jetour", "Chery", "China", "Chinese"],
  [/\bomoda\b|أومودا|اومودا/i, "Omoda", "Chery", "China", "Chinese"],
  [/\bjaecoo\b|جيكو/i, "Jaecoo", "Chery", "China", "Chinese"],
  [/\bexeed\b|إكسيد|اكسيد/i, "Exeed", "Chery", "China", "Chinese"],
  [/\bchery\b|شيري/i, "Chery", "Chery", "China", "Chinese"],
  [/\bhaval\b|هافال/i, "Haval", "Great Wall Motor", "China", "Chinese"],
  [/\btank \d{3}\b/i, "Tank", "Great Wall Motor", "China", "Chinese"],
  [/great wall|\bgwm\b/i, "Great Wall", "Great Wall Motor", "China", "Chinese"],
  [/\bdeepal\b/i, "Deepal", "Changan", "China", "Chinese"],
  [/\bavatr\b/i, "Avatr", "Changan", "China", "Chinese"],
  [/\bchangan\b|شانجان/i, "Changan", "Changan", "China", "Chinese"],
  [/\baion\b/i, "Aion", "GAC Group", "China", "Chinese"],
  [/\bgac\b/i, "GAC", "GAC Group", "China", "Chinese"],
  [/\bhongqi\b/i, "Hongqi", "FAW Group", "China", "Chinese"],
  [/\bbestune\b|بستيون/i, "Bestune", "FAW Group", "China", "Chinese"],
  [/\bbaic\b|بايك/i, "BAIC", "BAIC Group", "China", "Chinese"],
  [/\bvoyah\b/i, "Voyah", "Dongfeng", "China", "Chinese"],
  [/\bdongfeng\b|دونغ فنغ|دونج فينج/i, "Dongfeng", "Dongfeng", "China", "Chinese"],
  [/\bleapmotor\b/i, "Leapmotor", "Leapmotor", "China", "Chinese"],
  [/\bxpeng\b/i, "Xpeng", "Xpeng", "China", "Chinese"],
  [/\bnio\b/i, "Nio", "Nio", "China", "Chinese"],
  [/\bli auto\b/i, "Li Auto", "Li Auto", "China", "Chinese"],
  [/\bxiaomi su7|xiaomi yu7\b/i, "Xiaomi", "Xiaomi", "China", "Chinese"],
  [/\bkaiyi\b|كايي/i, "Kaiyi", "Kaiyi (Chery group)", "China", "Chinese"],
  [/\bmaxus\b|ماكسوس/i, "Maxus", "SAIC Motor", "China", "Chinese"],
  [/\bmg\s?(\d|zs|hs|rx|one|cyberster|marvel)|إم جي|ام جي/i, "MG", "SAIC Motor (British-born brand)", "China", "Chinese"],
  [/\bhyundai\b|هيونداي|هيونداى/i, "Hyundai", "Hyundai Motor", "South Korea", "South Korean"],
  [/\bkia\b|كيا/i, "Kia", "Hyundai Motor Group", "South Korea", "South Korean"],
  [/\bgenesis g|genesis gv/i, "Genesis", "Hyundai Motor Group", "South Korea", "South Korean"],
  [/\btoyota\b|تويوتا/i, "Toyota", "Toyota", "Japan", "Japanese"],
  [/\bnissan\b|نيسان/i, "Nissan", "Nissan", "Japan", "Japanese"],
  [/\bhonda\b|هوندا/i, "Honda", "Honda", "Japan", "Japanese"],
  [/\bmazda\b|مازدا/i, "Mazda", "Mazda", "Japan", "Japanese"],
  [/\bmitsubishi\b|ميتسوبيشي/i, "Mitsubishi", "Mitsubishi Motors", "Japan", "Japanese"],
  [/\bsuzuki\b|سوزوكي/i, "Suzuki", "Suzuki", "Japan", "Japanese"],
  [/\bbmw\b|بي إم دبليو|بى ام دبليو/i, "BMW", "BMW Group", "Germany", "German"],
  [/\bmercedes\b|مرسيدس/i, "Mercedes-Benz", "Mercedes-Benz Group", "Germany", "German"],
  [/\baudi\b|أودي|اودي/i, "Audi", "Volkswagen Group", "Germany", "German"],
  [/\bporsche\b/i, "Porsche", "Volkswagen Group", "Germany", "German"],
  [/\bvolkswagen\b|\bvw\b|فولكس/i, "Volkswagen", "Volkswagen Group", "Germany", "German"],
  [/\bopel\b|أوبل|اوبل/i, "Opel", "Stellantis", "Germany", "German"],
  [/\bskoda\b|سكودا/i, "Skoda", "Volkswagen Group", "Czech Republic", "Czech"],
  [/\bpeugeot\b|بيجو/i, "Peugeot", "Stellantis", "France", "French"],
  [/\bcitro[eë]n\b|ستروين/i, "Citroën", "Stellantis", "France", "French"],
  [/\brenault\b|رينو/i, "Renault", "Renault Group", "France", "French"],
  [/\bfiat\b|فيات/i, "Fiat", "Stellantis", "Italy", "Italian"],
  [/\bvolvo\b(?! ce)/i, "Volvo Cars", "Geely Holding (owner)", "Sweden", "Swedish"],
  [/\btesla\b|تسلا/i, "Tesla", "Tesla", "United States", "American"],
  [/\bford\b|فورد/i, "Ford", "Ford Motor", "United States", "American"],
  [/\bchevrolet\b|شيفروليه|شيفرولية/i, "Chevrolet", "General Motors", "United States", "American"],
  [/\bjeep\b|جيب/i, "Jeep", "Stellantis", "United States", "American"],
  [/land rover|range rover/i, "Land Rover", "JLR (Tata Motors)", "United Kingdom", "British"],
  [/\bproton\b|بروتون/i, "Proton", "Proton (Geely part-owner)", "Malaysia", "Malaysian"],
];

/** The car brand a question is about → { brand, maker, country, adj } | null */
export function makerOf(q) {
  const t = String(q || "");
  for (const [rx, brand, maker, country, adj] of M) if (rx.test(t)) return { brand, maker, country, adj };
  return null;
}

/** A line for the model, put before the sources ("" when the brand isn't known). */
export function makerNote(q) {
  const m = makerOf(q);
  return m ? `\n\n(FACT from the app: ${m.brand} is a ${m.adj} brand — maker ${m.maker}, ${m.country}. Say this when you name the maker or its country; never another country.)` : "";
}

const COUNTRIES = [["China", "Chinese"], ["South Korea", "South Korean"], ["Korea", "Korean"], ["Japan", "Japanese"], ["Germany", "German"], ["France", "French"],
  ["Italy", "Italian"], ["Sweden", "Swedish"], ["United States", "American"], ["USA", "American"], ["United Kingdom", "British"], ["UK", "British"],
  ["Czech Republic", "Czech"], ["Malaysia", "Malaysian"], ["India", "Indian"], ["Spain", "Spanish"], ["Taiwan", "Taiwanese"]];
const AR_C = { "China": "الصين", "South Korea": "كوريا الجنوبية", "Japan": "اليابان", "Germany": "ألمانيا", "France": "فرنسا", "Italy": "إيطاليا", "Sweden": "السويد", "United States": "أمريكا", "United Kingdom": "بريطانيا", "Czech Republic": "التشيك", "Malaysia": "ماليزيا" };
const AR_ALL = ["الصين", "كوريا الجنوبية", "كوريا", "اليابان", "ألمانيا", "المانيا", "فرنسا", "إيطاليا", "ايطاليا", "السويد", "أمريكا", "امريكا", "الولايات المتحدة", "بريطانيا", "التشيك", "ماليزيا", "الهند"];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A wrong country written for the brand ("an SUV from South Korea", "a Korean SUV", «من كوريا») → the right one, on the lines
 * that are about the subject (the line names it, or it is the answer's opening paragraph). → { text, fixed }
 */
export function fixMakerCountry(md, q) {
  const m = makerOf(q);
  if (!m) return { text: String(md || ""), fixed: 0 };
  let fixed = 0;
  const lines = String(md || "").split("\n");
  const brandRx = new RegExp(esc(m.brand).replace(/\\&/, "(&|and)").replace(/\s+/g, "\\s*"), "i");
  const out = lines.map((l, i) => {
    if (/^\s*\|/.test(l)) return l;
    if (!brandRx.test(l) && !makerOf(l) && i > 3) return l;
    if (makerOf(l) && makerOf(l).brand !== m.brand) return l;   // a line about a rival keeps its own country
    let s = l;
    for (const [c, adj] of COUNTRIES) {
      if (c === m.country || adj === m.adj || (c === "Korea" && m.country === "South Korea")) continue;
      const fromRx = new RegExp(`\\b(from|made in|built in|based in|headquartered in|manufacturer in|brand of|maker in)\\s+(the\\s+)?${esc(c)}\\b`, "g");
      const adjRx = new RegExp(`\\b${esc(adj)}(?=\\s+(brand|car|cars|suv|sedan|ev|phev|hybrid|carmaker|automaker|maker|manufacturer|company|vehicle|crossover|make)\\b)`, "gi");
      s = s.replace(fromRx, (x, w) => { fixed++; return `${w} ${m.country}`; }).replace(adjRx, () => { fixed++; return m.adj; });
    }
    const arRight = AR_C[m.country];
    if (arRight) for (const c of AR_ALL) {
      if (c === arRight || arRight.includes(c)) continue;
      const rx = new RegExp(`(من|صناعة|إنتاج|انتاج)\\s+${esc(c)}`, "g");
      s = s.replace(rx, (x, w) => { fixed++; return `${w} ${arRight}`; });
    }
    return s;
  });
  return { text: out.join("\n"), fixed };
}
