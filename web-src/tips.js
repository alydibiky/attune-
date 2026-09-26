/* ---- The tips library: 200+ expert tips, picked per question (v5.29) --------------------
   Ali: "give the AI at least 200 tips and tricks to make it smarter, faster and more
   accurate." Putting 200 rules in every prompt would drown a small model (v5.26 learned
   that), so each tip has the words that call it up. For every question only the few tips
   that fit it (2 for small models, up to 5 for strong ones) go in with the question — a
   crane question gets crane tips, a VAT question gets tax tips, a CV gets CV tips.
   [area, trigger (RegExp source, case-insensitive), tip]. Pure; tests: tests/unit/v529.test.mjs */

const T = [
  // ---- maths & calculation ------------------------------------------------------------
  ["maths", "\\d\\s*[-+×x*/÷]\\s*\\d|calculat|compute|احسب|حساب", "Write every step of the working on its own line before the result; never state a total you have not computed."],
  ["maths", "\\d\\s*[-+×x*/÷]\\s*\\d|calculat|compute|total|احسب|إجمالي|اجمالي", "Recompute the final number a second way (reverse the operation or estimate the size) before giving it."],
  ["maths", "percent|%|نسبة|بالمية|في المية", "For percentages, say what the percentage is OF; 'up 20% then down 20%' is not back to the start (×1.2×0.8 = 0.96)."],
  ["maths", "average|mean|متوسط", "An average of averages is wrong unless the groups are the same size — weight by the counts."],
  ["maths", "probab|chance|odds|احتمال", "For probability, list the equally likely outcomes or multiply independent chances; check the answer is between 0 and 1."],
  ["maths", "fraction|كسر", "Keep fractions exact until the last step, then convert to a decimal once."],
  ["maths", "round|approx|تقريب", "Round only the final answer, and say how it was rounded."],
  ["maths", "equation|solve|معادلة|حل ", "After solving an equation, put the answer back into the original equation to check it."],
  ["maths", "interest|compound|فائدة|فوايد", "Compound interest: A = P × (1 + r/n)^(n×t); simple interest: P × r × t. Say which one you used."],
  ["maths", "ratio|proportion|نسبة وتناسب", "For ratios, add the parts first (3:2 → 5 parts), then find one part."],
  ["maths", "speed|distance|km/h|mph|سرعة|مسافة", "Speed = distance ÷ time — convert minutes to hours (÷ 60) before dividing."],
  ["maths", "workers|days to|together|عمال|مع بعض", "Work problems: add the RATES (jobs per hour), not the times."],
  ["maths", "discount|off|خصم|تخفيض", "Two discounts in a row multiply (20% then 10% = 28% off, not 30%)."],
  ["maths", "profit|margin|markup|ربح|هامش", "Margin is profit ÷ selling price; markup is profit ÷ cost — they are different numbers."],
  ["maths", "loan|installment|قسط|أقساط|اقساط|قرض", "Loan instalment = P×r×(1+r)^n ÷ ((1+r)^n − 1) with r the MONTHLY rate; show the monthly payment and the total paid."],
  ["maths", "area|square met|m2|m²|مساحة|متر مربع", "Areas scale with the square of lengths; convert units BEFORE multiplying (1 m² = 10,000 cm²)."],
  ["maths", "volume|litre|liter|m3|m³|حجم|لتر", "1 m³ = 1,000 litres; volume scales with the cube of lengths."],
  ["maths", "time|hours|minutes|ساعة|دقيقة", "Add times in hours and minutes separately and carry 60 minutes as 1 hour; never treat 1:30 as 1.30 hours."],
  ["maths", "trick|riddle|لغز|فخ", "Read the question literally — many riddles hide the answer in a word like 'each', 'at the same time' or 'all but'."],
  ["maths", "estimate|roughly|about how|تقريبا|حوالي", "Give an order-of-magnitude estimate first, then refine; state your assumptions."],

  // ---- units & conversions ---------------------------------------------------------------
  ["units", "convert|conversion|حول|تحويل", "Write the conversion factor with its units and cancel units on paper, so a wrong factor shows."],
  ["units", "\\bton|tonne|طن", "A metric tonne is 1,000 kg; a US short ton is 907 kg and a UK long ton 1,016 kg — say which."],
  ["units", "\\blbs?\\b|pound|رطل", "1 kg = 2.2046 lb; 1 lb = 0.4536 kg."],
  ["units", "inch|feet|foot|\\bft\\b|بوصة|قدم", "1 inch = 2.54 cm exactly; 1 ft = 0.3048 m."],
  ["units", "mile|ميل", "1 mile = 1.609 km; 1 nautical mile = 1.852 km."],
  ["units", "fahrenheit|celsius|°f|°c|فهرنهايت|مئوية", "°C = (°F − 32) × 5/9; °F = °C × 9/5 + 32."],
  ["units", "\\bpsi\\b|\\bbar\\b|kpa|mpa|pressure|ضغط", "1 bar = 100 kPa = 14.5 psi; 1 MPa = 10 bar."],
  ["units", "\\bhp\\b|horsepower|\\bkw\\b|kilowatt|حصان|كيلووات", "1 kW = 1.341 hp (mechanical) = 1.36 PS (metric hp) — cars often quote PS."],
  ["units", "torque|\\bnm\\b|lb-ft|lb·ft|عزم", "1 lb·ft = 1.356 N·m."],
  ["units", "kwh|battery|بطارية", "Range ≈ usable battery kWh ÷ consumption kWh/100 km × 100; WLTP/CLTC ranges are higher than real driving."],
  ["units", "fuel|consumption|l/100|mpg|بنزين|استهلاك", "L/100 km = 235.2 ÷ mpg (US); lower L/100 km is better."],
  ["units", "kn\\b|kilonewton|newton|نيوتن", "1 tonne-force ≈ 9.81 kN; for quick crane checks 1 t ≈ 10 kN."],

  // ---- money, prices, tax (Egypt first) ----------------------------------------------------
  ["money", "vat|ضريبة القيمة|قيمة مضافة|\\btax\\b|ضريبة", "Egypt's standard VAT is 14%. Price with VAT = price × 1.14; VAT inside a gross price = gross × 14/114."],
  ["money", "vat|ضريبة|tax", "Say whether a price is before or after VAT, and show the VAT as its own line."],
  ["money", "withholding|خصم وإضافة|خصم واضافة|خصم من المنبع", "Egyptian withholding tax (خصم وإضافة) on services is commonly 3% for contractors/services and 1% for supplies — say which rate applies and that it is credited, not a cost."],
  ["money", "income tax|salary tax|ضريبة الدخل|ضريبة المرتب|كسب العمل", "Egyptian salary tax is progressive by bracket — apply each bracket's rate only to the part of income inside it, after the personal exemption."],
  ["money", "social insurance|تأمينات|تامينات", "Egyptian social insurance splits between employer and employee shares on the insured wage (capped) — show both shares separately."],
  ["money", "egp|جنيه|usd|dollar|دولار|euro|يورو|exchange|سعر الصرف", "Exchange rates change daily — give the rate you used and its date, and suggest checking today's rate (turn on Web)."],
  ["money", "price|cost|how much|سعر|بكام|كام|تكلفة", "Give prices as a range with the date and place they apply; separate list price, dealer price and on-the-road cost."],
  ["money", "invoice|فاتورة", "An invoice needs: number, date, seller and buyer (with tax IDs), items with quantity × unit price, subtotal, VAT line, total, and payment terms."],
  ["money", "quote|quotation|عرض سعر", "A quotation should state validity (e.g. 15 days), what is included and excluded, payment terms and delivery time."],
  ["money", "budget|ميزانية", "Budget = fixed costs + variable costs + a contingency (10–15%); list each line so nothing is hidden."],
  ["money", "salary|wage|مرتب|أجر|اجر", "Distinguish gross (before deductions) and net (after tax and insurance) pay, and say which one you mean."],
  ["money", "invest|return|roi|استثمار|عائد", "ROI = (gain − cost) ÷ cost; mention risk and time — a yearly return and a total return are different."],
  ["money", "depreciation|إهلاك|اهلاك", "Straight-line depreciation = (cost − residual value) ÷ useful life in years."],
  ["money", "break.?even|نقطة التعادل", "Break-even units = fixed costs ÷ (price − variable cost per unit)."],
  ["money", "rent|hire|rental|إيجار|ايجار|تأجير", "For rentals, state the billing unit (hour, day, month), minimum hire, and who pays fuel, operator and transport."],

  // ---- business, accounting, ERP -------------------------------------------------------------
  ["business", "erp|system|database|قاعدة بيانات|نظام", "Every transaction table (invoice, job, payment) should LINK to its master records (customer, product, equipment), not copy their names."],
  ["business", "account|journal|ledger|قيد|محاسب|دفتر", "Every journal entry balances: total debits = total credits. Name the accounts for each side."],
  ["business", "balance sheet|الميزانية العمومية|مركز مالي", "Assets = liabilities + equity; if it doesn't balance, something is missing."],
  ["business", "cash ?flow|تدفق نقدي|تدفقات", "Profit is not cash: show receivables, payables and stock changes to go from profit to cash."],
  ["business", "kpi|metric|مؤشر", "A good KPI has a formula, a target, a period and an owner."],
  ["business", "inventory|stock|مخزون|مخزن", "Stock value = quantity × unit cost (FIFO or weighted average — say which); reorder point = daily use × lead time + safety stock."],
  ["business", "pricing|price list|تسعير", "Price from cost (cost + margin) AND from the market (competitors); the lower of the two limits you."],
  ["business", "customer|client|عميل|عملاء", "For customers, track the name, contact, credit limit, balance owed and last order date."],
  ["business", "report|تقرير", "Start a business report with a 3-line summary of the result, then the numbers, then recommendations."],
  ["business", "marketing|تسويق|إعلان|اعلان", "Marketing advice: say who the customer is, the one message, the channel, the budget and how you'll measure it."],
  ["business", "swot|تحليل", "A SWOT must be specific to this business; generic points ('good team') add nothing."],
  ["business", "contract|agreement|عقد|اتفاق", "Summarise a contract by: parties, scope, price and payment, duration, penalties, termination, and who carries risk."],
  ["business", "hr|hiring|employee|موظف|توظيف", "Egyptian labour law: probation up to 3 months, 21 days' paid leave after a year (30 after 10 years or age 50) — note to confirm the current law."],
  ["business", "power automate|flow|تدفق", "Power Automate: initialise all variables at the top, name every action clearly, and handle the rejected / failed branch too."],
  ["business", "access|ms access|مايكروسوفت أكسس|اكسس", "In Access, use relationships with referential integrity and queries for totals — never store a total you can calculate."],

  // ---- cranes & lifting & safety ------------------------------------------------------------
  ["crane", "crane|ونش|أوناش|اوناش|lift|رفع", "Always use the manufacturer's load chart for the exact configuration (boom length, radius, counterweight, outriggers) — never estimate capacity."],
  ["crane", "crane|ونش|lift|رفع", "Total load = load + hook block + slings/shackles + any spreader beam; compare that, not the load alone, with the chart."],
  ["crane", "radius|نصف القطر|مدى", "Capacity falls fast with radius — measure radius from the slewing centre to the hook, and add allowance for boom deflection."],
  ["crane", "outrigger|مساند|رجل", "Outrigger ground pressure = outrigger force ÷ mat area; compare with the ground's allowable bearing pressure, with a safety margin."],
  ["crane", "ground|soil|تربة|أرض|ارض", "Typical allowable bearing: soft clay ~50–100 kN/m², compact gravel ~200–300 kN/m², rock more — use a site survey when in doubt."],
  ["crane", "wind|رياح|هواء", "Stop lifting when the wind exceeds the chart's limit (often ~9–13 m/s for mobile cranes) — large-area loads need lower limits."],
  ["crane", "sling|shackle|rigging|حبال|شداد|سلك", "Sling capacity drops with angle: at 60° from horizontal each leg carries 1.15× its share, at 30° it carries 2×."],
  ["crane", "tandem|two cranes|ونشين|ونشات", "Tandem lifts: plan each crane at ≤ 75–80% of its chart capacity, with one lift supervisor and a written plan."],
  ["crane", "lift plan|خطة رفع|critical lift", "A lift plan covers: load weight and centre of gravity, crane configuration, chart capacity, % utilisation, rigging, ground, exclusion zone, signaller and weather."],
  ["crane", "inspection|فحص|check", "Daily pre-use checks: wire ropes, hook latch, limit switches, LMI/SLI, tyres/tracks, hydraulic leaks, outriggers and pads."],
  ["crane", "lmi|sli|limiter|محدد", "Never bypass the load moment indicator; if it trips, reduce the load or radius — don't override."],
  ["crane", "wire rope|cable|حبل سلك|واير", "Replace wire rope for broken wires beyond the limit, kinks, bird-caging, heavy corrosion or diameter loss (per ISO 4309)."],
  ["crane", "standard|en 13000|asme|iso|مواصفة", "Mobile cranes: EN 13000 (design), ISO 4309 (wire rope), ASME B30.5 (US mobile cranes), BS 7121 (safe use)."],
  ["crane", "tower crane|برجي", "Tower cranes: check the jib's capacity at tip and the tie-in / foundation design; anemometer limits apply."],
  ["crane", "all.?terrain|rough terrain|crawler|mobile crane|كرولر|جنزير", "All-terrain = road-legal multi-axle; rough-terrain = site only; crawler = tracks, carries loads while moving (pick-and-carry)."],
  ["crane", "hydraulic|هيدروليك", "Hydraulic faults: check oil level and temperature, filters, leaks and pressure at test points before replacing pumps or valves."],
  ["crane", "counterweight|ثقل موازن", "The chart capacity assumes the exact counterweight listed — less counterweight means a different (lower) chart."],
  ["crane", "operator|سواق ونش|مشغل", "Operators need valid certification for that crane type and must never lift over people."],
  ["crane", "liebherr|grove|tadano|demag|sany|xcmg|zoomlion|terex|manitowoc", "For a specific crane model, give the capacity class, boom length, max radius and typical use — and say to confirm with its load chart."],
  ["safety", "safe|danger|hazard|خطر|أمان|امان|سلامة", "Put safety warnings first and plainly, then the steps."],

  // ---- cars & vehicles -------------------------------------------------------------------------
  ["cars", "car|suv|sedan|vehicle|عربية|سيارة|موديل", "For a car, list every trim with its own power, torque, 0–100, range/consumption and price — don't mix trims."],
  ["cars", "hp|horsepower|torque|0-100|حصان|عزم|تسارع", "Say whether power is hp or PS and whether figures are combined (hybrid system) or engine only."],
  ["cars", "ev|electric|plug.?in|phev|hybrid|كهرب|هايبرد", "For EVs/PHEVs give battery kWh, range (and which test cycle: WLTP, CLTC, EPA), and charging speed in kW."],
  ["cars", "price|سعر|بكام", "Car prices differ by market (China, Egypt, Gulf) and change often — give each market separately with its currency and date."],
  ["cars", "compare|vs|versus|مقارنة|ولا", "Compare cars in one table: price, power, torque, 0–100, range/consumption, size, warranty."],
  ["cars", "egypt|مصر", "Egyptian car prices include customs and fees that depend on origin (EU cars have lower duty) — say so."],
  ["cars", "maintenance|service|صيانة", "Service schedules depend on km AND time (whichever first); list oil, filters, brake fluid, coolant intervals."],
  ["cars", "opel|grandland", "Opel Grandland Hybrid4: say which power version (e.g. 224 hp vs 300 hp) — specs differ."],
  ["cars", "range|مدى|autonomy", "Real-world range is usually 15–30% below the official cycle figure, more in heat or at motorway speed."],
  ["cars", "tyre|tire|كاوتش|إطار", "Tyre size 235/55 R19: width mm / sidewall % of width / rim inches."],

  // ---- writing ---------------------------------------------------------------------------------
  ["writing", "email|mail|إيميل|ايميل|رسالة", "An email: a clear subject, the request in the first two lines, then details, then a polite close. One email, one purpose."],
  ["writing", "formal|official|رسمي", "Formal tone: no slang, full sentences, polite requests ('Could you…'), and the reader's title."],
  ["writing", "reply|respond|رد", "In a reply, answer every question the other person asked, in the same order."],
  ["writing", "cv|resume|سيرة ذاتية", "A CV: achievements with numbers ('cut costs 15%') beat duties; newest job first; 1–2 pages; no photo for most international jobs."],
  ["writing", "cover letter|خطاب تقديم", "A cover letter: why this company, the 2–3 strongest matches with the job, and a call to action — under one page."],
  ["writing", "linkedin|profile|بروفايل", "A LinkedIn headline says what you do and for whom, not just a job title."],
  ["writing", "summar|ملخص|لخص|اختصر", "Summaries: the main point first, then only what the reader needs; keep every number and name exact."],
  ["writing", "essay|article|مقال", "An essay: a clear thesis in the first paragraph, one idea per paragraph, and a conclusion that answers the question."],
  ["writing", "post|caption|instagram|facebook|tiktok|بوست", "Social posts: a hook in the first line, short lines, one call to action, 3–5 relevant hashtags."],
  ["writing", "apolog|sorry|اعتذار|آسف|اسف", "An apology: say what went wrong, take responsibility, say what you'll do to fix it — no excuses."],
  ["writing", "complaint|شكوى", "A complaint: facts (dates, order numbers), the impact, and exactly what you want done by when."],
  ["writing", "proposal|اقتراح|مقترح", "A proposal: the problem, your solution, cost, timeline and why you — with a clear next step."],
  ["writing", "story|قصة", "A story needs a character who wants something, an obstacle, and a change by the end."],
  ["writing", "rewrite|improve|حسن|أعد صياغة|اعد صياغة", "When rewriting, keep the meaning and every fact; improve clarity, order and tone."],
  ["writing", "short|brief|مختصر|قصير", "Short means short: cut filler words, keep one idea per sentence."],

  // ---- language & translation --------------------------------------------------------------------
  ["language", "translat|ترجم", "Translate meaning, not word by word; keep names, numbers and units exactly; say when an idiom has no direct equivalent."],
  ["language", "egyptian|مصري|عامية", "Egyptian Arabic: use everyday words (عايز، إزاي، دلوقتي، كده) not formal Fusha, unless asked."],
  ["language", "fusha|فصحى|formal arabic", "Modern Standard Arabic for official writing; keep sentences short and avoid Egyptian dialect words."],
  ["language", "turkish|türk|تركي", "Turkish: the verb goes at the end; watch vowel harmony in suffixes (-ler/-lar, -de/-da); mark the tense clearly."],
  ["language", "turkish|türk|تركي", "When correcting Turkish, point out tense errors explicitly (şimdiki -yor, geçmiş -di, gelecek -ecek)."],
  ["language", "grammar|قواعد|نحو", "Explain a grammar rule with one short rule, two correct examples and one common mistake."],
  ["language", "pronounc|نطق", "Give pronunciation with a simple respelling (e.g. 'teh-SHEK-kür') and the stressed syllable."],
  ["language", "english|انجليزي|إنجليزي", "For English learners, give the simplest correct version first, then a more natural one."],
  ["language", "spell|إملاء|املاء", "Check spelling of names and technical terms against the original — don't 'correct' proper names."],
  ["language", "word|meaning|معنى|كلمة", "Give the meaning, the part of speech, one example sentence and a common synonym."],
  ["language", "arabic|عربي", "In Arabic, write numbers consistently (all Western 1,2,3 or all Arabic ١،٢،٣) and keep units in one script."],
  ["language", "bilingual|arabic and english|عربي وانجليزي|بالعربي والانجليزي", "For technical terms give both: English term (المصطلح العربي)."],

  // ---- documents & summaries ------------------------------------------------------------------------
  ["docs", "pdf|document|file|ملف|مستند", "Answer from the document: quote the exact line or number that supports each point."],
  ["docs", "pdf|document|file|ملف|مستند", "If the document doesn't say something, say 'the document doesn't state this' rather than guessing."],
  ["docs", "table|جدول", "Keep table rows and columns exactly; never merge or drop rows when summarising a table."],
  ["docs", "extract|استخرج", "When extracting, keep the original order, wording and formatting — no summarising unless asked."],
  ["docs", "minutes|meeting|اجتماع|محضر", "Meeting minutes: date, attendees, decisions, action items with owner and due date."],
  ["docs", "checklist|قائمة", "A checklist item is one action you can tick — start each with a verb."],
  ["docs", "plan|خطة", "A plan lists steps in order with who, when and what 'done' looks like."],
  ["docs", "procedure|sop|إجراء|اجراء", "Procedures: numbered steps, one action each, warnings before the step they apply to."],
  ["docs", "notes|ملاحظات", "Notes: short bullet points, key terms in bold, grouped by topic."],
  ["docs", "report|تقرير", "Reports: summary, findings with evidence, recommendations, next steps."],

  // ---- comparison & decisions ------------------------------------------------------------------------
  ["decide", "vs|versus|compare|comparison|difference|الفرق|مقارنة|ولا|أحسن|احسن", "Comparisons: a one-line verdict first, then a table of the differences that matter, then 'choose A if…, B if…'."],
  ["decide", "best|which should|recommend|أنصح|انصح|أختار|اختار", "When recommending, state the criteria you used and the trade-offs of the choice."],
  ["decide", "pros|cons|مميزات|عيوب", "List pros and cons that are specific and comparable; say which ones matter most for the user."],
  ["decide", "^\\s*should i\\b|should i (buy|choose|go|take|pick|get|learn|study|move|accept|sell|rent)|هل أ|هل ا|ينفع", "For a decision, give the recommendation, the main reason, and what would change the answer."],
  ["decide", "buy|شراء|أشتري|اشتري", "Buying advice: total cost of ownership (price + running + resale), not just the price."],
  ["decide", "option|choices|اختيارات|بدائل", "Give 2–4 real options, not 10; say which one you'd pick and why."],
  ["decide", "risk|مخاطر", "Rate risks by likelihood and impact, and give one mitigation for each big one."],
  ["decide", "career|job|وظيفة|شغل|مستقبل", "Career advice: consider demand, pay, entry path, time to learn and the person's current skills — give a concrete first step."],
  ["decide", "ai|software|programming|برمجة|ذكاء اصطناعي", "AI vs general software: strong software fundamentals come first; AI skills pay most when combined with a domain (finance, logistics, construction)."],
  ["decide", "remote|عن بعد", "Remote jobs: target companies that hire in your time zone, build a public portfolio, and apply with a tailored CV per role."],

  // ---- coding ------------------------------------------------------------------------------------------
  ["code", "code|python|javascript|function|script|كود|برنامج", "Write complete, runnable code with the imports; no '...' placeholders."],
  ["code", "code|python|javascript|function|script|كود|برنامج", "Handle empty input, wrong types and edge cases (0, negative, very large)."],
  ["code", "bug|error|exception|traceback|خطأ|ايرور|مشكلة", "Debugging: read the error's last line and the line number first; fix the cause, not the symptom; explain the fix in one line."],
  ["code", "react|jsx|component", "React: keep state minimal, lift it to the nearest common parent, and give list items stable keys."],
  ["code", "html|css|website|page|موقع|صفحة", "Web pages: mobile-first layout, semantic HTML (header, main, section), real content for the named brand — no lorem ipsum."],
  ["code", "java\\b|class|oop|object", "Java/OOP: one responsibility per class; use interfaces or abstract classes for shared behaviour; override toString for debugging."],
  ["code", "sql|query|select|join", "SQL: name the join condition explicitly, filter with WHERE before GROUP BY, and use HAVING only for aggregate conditions."],
  ["code", "regex|regular expression", "Regex: anchor it (^ $) when matching whole strings, and show 3 examples it matches and 1 it doesn't."],
  ["code", "api|endpoint|request|fetch", "APIs: check the status code, handle timeouts and errors, and never put secret keys in client code."],
  ["code", "algorithm|complexity|big o|خوارزمية", "State the time and space complexity of the solution and whether a faster one exists."],
  ["code", "test|unit test|اختبار", "Tests: cover the normal case, an edge case and an error case; one assertion idea per test."],
  ["code", "performance|slow|optimi|بطيء|سرعة", "Measure before optimising; fix the biggest cost first (usually I/O, loops inside loops, or repeated work)."],
  ["code", "security|password|login|أمان|باسورد", "Never store passwords in plain text (use a slow hash like bcrypt/argon2), validate all input, and use parameterised queries."],
  ["code", "android|kotlin", "Android: never block the main thread; do I/O in a background thread or coroutine."],
  ["code", "git|commit|branch", "Git: small commits with clear messages; never rewrite shared history."],

  // ---- spreadsheets, Excel, data ----------------------------------------------------------------------
  ["excel", "excel|spreadsheet|sheet|اكسل|إكسل|شيت", "Excel: give the exact formula with cell references, e.g. =SUMIFS(C:C, A:A, \"Cairo\"), and say which cell it goes in."],
  ["excel", "excel|اكسل|إكسل|vlookup|xlookup|lookup", "Prefer XLOOKUP (or INDEX/MATCH) over VLOOKUP — it doesn't break when columns move."],
  ["excel", "pivot|بيفوت|تلخيص", "Pivot tables: rows = category, values = sum/count, filter = period — and refresh after data changes."],
  ["excel", "date|تاريخ", "Excel dates are numbers; use DATEDIF / NETWORKDAYS for durations and set the cell format to show dates."],
  ["excel", "csv|data|بيانات", "Clean data first: trim spaces, fix types (numbers stored as text), remove duplicates, then analyse."],
  ["excel", "chart|graph|رسم بياني", "Chart choice: line for trends over time, bar for comparing categories, pie only for parts of one whole (≤ 5 parts)."],
  ["excel", "dashboard|لوحة", "A dashboard shows 3–6 key numbers first, then trends; every number needs its period and unit."],
  ["excel", "percent|%|نسبة", "In Excel, percentages are fractions: 14% = 0.14; format the cell as %."],
  ["excel", "if\\(|conditional|شرط", "Nested IFs over three levels are hard to read — use IFS or a lookup table instead."],
  ["excel", "sum|total|مجموع", "Totals: check that SUM ranges include the last row, and that there are no numbers stored as text."],
  ["excel", "vba|macro|ماكرو", "VBA: turn off ScreenUpdating during long loops and always handle errors with On Error."],
  ["excel", "sharepoint|power apps|canvas", "Power Apps with SharePoint: watch delegation limits (500/2000 rows) — filter on the server with delegable functions."],

  // ---- health (careful) ---------------------------------------------------------------------------------
  ["health", "dose|dosage|mg|medicine|drug|دواء|جرعة|علاج", "Medicine doses: give the standard range from the label and tell the user to confirm with a doctor or pharmacist — never guess a dose."],
  ["health", "symptom|pain|fever|ألم|سخونية|حرارة|أعراض|اعراض", "Symptoms: list common causes, the warning signs that need urgent care, and when to see a doctor."],
  ["health", "emergency|chest pain|stroke|bleeding|طوارئ|نزيف", "Emergency signs (chest pain, stroke signs, heavy bleeding, trouble breathing): tell them to call emergency services (123 in Egypt) first."],
  ["health", "diet|calorie|weight|رجيم|سعرات|وزن", "Nutrition: base advice on calories, protein and whole foods; avoid extreme diets; mention seeing a professional for medical conditions."],
  ["health", "exercise|gym|workout|تمارين|جيم", "Exercise plans: warm-up, progressive load, rest days, and stop if there is sharp pain."],
  ["health", "sleep|نوم", "Sleep tips: fixed wake time, no screens 1 hour before bed, cool dark room, caffeine only before early afternoon."],
  ["health", "tea|coffee|caffeine|شاي|قهوة|كافيين", "A cup of tea has roughly 30–50 mg caffeine, coffee 80–120 mg; ~400 mg/day is the usual adult upper limit."],
  ["health", "mental|stress|anxiety|قلق|توتر|اكتئاب", "Stress and anxiety: give practical steps and say that talking to a professional helps — never dismiss the feeling."],

  // ---- legal (careful) -------------------------------------------------------------------------------------
  ["legal", "law|legal|قانون|قانوني", "Legal questions: explain the general rule, say it depends on the country and facts, and suggest a lawyer for decisions."],
  ["legal", "contract|clause|عقد|بند", "Point out risky clauses: unlimited liability, automatic renewal, one-sided termination, penalties, and jurisdiction."],
  ["legal", "visa|residence|إقامة|اقامة|فيزا|تأشيرة", "Visa rules change often — give the general requirements and tell the user to check the embassy's official site."],
  ["legal", "company|register|شركة|سجل تجاري", "Egypt company setup: legal form (sole, LLC, JSC), commercial register, tax card and VAT registration if over the threshold."],
  ["legal", "rent|lease|إيجار|ايجار", "Leases: rent, duration, increases, deposit, maintenance duties, and notice to leave."],
  ["legal", "labour|labor|عمل|عمال", "Employment disputes: keep written records (contract, payslips, messages) — they decide most cases."],
  ["legal", "inherit|ميراث|ورث", "Inheritance shares in Egypt follow Islamic law for Muslims — give the rule and suggest a specialist for the exact split."],
  ["legal", "tax|ضريبة|ضرائب", "Tax rules change by year — say which year's rules you describe."],

  // ---- religion (respectful) ---------------------------------------------------------------------------------
  ["religion", "islam|quran|hadith|fiqh|prayer|صلاة|قرآن|قران|حديث|فقه|زكاة|صيام", "Islamic questions: quote the source (surah:ayah or the hadith collection) and, where scholars differ, give the main views respectfully without issuing a fatwa."],
  ["religion", "zakat|زكاة", "Zakat on money is 2.5% of savings above the nisab held for a lunar year; say the nisab depends on gold/silver prices today."],
  ["religion", "prayer time|مواقيت|أذان|اذان", "Prayer times depend on the city and calculation method — suggest the local authority's timetable."],
  ["religion", "ramadan|رمضان|fasting|صيام", "Fasting questions: give the ruling with its evidence and mention exemptions (illness, travel, pregnancy)."],
  ["religion", "extract|نص|متن|كتاب", "When extracting a religious text, copy it word for word in the original Arabic, in order, with its references — no summarising."],
  ["religion", "hadith|حديث", "For a hadith, say its collection and grading (sahih, hasan, da'if) if known; don't attribute weak narrations as certain."],

  // ---- travel & places ------------------------------------------------------------------------------------------
  ["travel", "travel|trip|flight|hotel|سفر|رحلة|طيران|فندق", "Travel: give the best season, visa needs, rough daily budget and top 3 things to do; prices change, so date them."],
  ["travel", "itinerary|برنامج|جدول الرحلة", "An itinerary groups places by area each day to cut travel time, with rest time."],
  ["travel", "istanbul|turkey|تركيا|اسطنبول", "Istanbul: Istanbulkart for transport; the old city (Sultanahmet) and Beyoğlu are different sides — plan by area."],
  ["travel", "cairo|egypt|القاهرة|مصر", "Cairo: traffic is the main time cost — group sights by area (Giza, downtown, Islamic Cairo)."],
  ["travel", "currency|money abroad|فلوس|صرافة", "Abroad: pay in local currency (not your home currency) on cards to avoid bad conversion rates."],
  ["travel", "pack|packing|شنطة", "Packing list by category: documents, money, clothes by days, chargers, medicines."],

  // ---- learning & explanations --------------------------------------------------------------------------------------
  ["learn", "explain|what is|how does|اشرح|يعني ايه|ازاي|إزاي", "Explain in layers: a one-line simple definition, an everyday analogy, then the technical detail."],
  ["learn", "explain|اشرح|simple|ببساطة", "Use one concrete example with real numbers."],
  ["learn", "learn|study|course|أتعلم|اتعلم|مذاكرة", "Learning plans: small daily sessions, practice with feedback, and a way to measure progress each week."],
  ["learn", "exam|test|quiz|امتحان", "For exam prep, practise past questions under time and review every mistake."],
  ["learn", "history|تاريخ", "History: give dates, places and causes/effects; separate fact from interpretation."],
  ["learn", "science|physics|chemistry|biology|علوم|فيزياء|كيمياء", "Science answers: state the principle, the formula with units, and a sanity check on the result."],
  ["learn", "machine learning|neural|cnn|vgg|deep learning|تعلم آلي", "ML: explain the input, the model, the loss, and how it is evaluated; for CNNs like VGG mention depth (16/19 layers) and 3×3 convolutions."],
  ["learn", "latex|ieee|report|paper|بحث", "Academic writing: IEEE style — abstract, introduction, method, results, conclusion, numbered references [1]."],
  ["learn", "survey|questionnaire|استبيان", "Surveys: one idea per question, a consistent scale (e.g. 1–5 Likert), no leading questions, and a pilot test."],
  ["learn", "statistics|regression|correlation|إحصاء|انحدار", "Statistics: correlation isn't causation; report sample size, effect size and p-value together."],

  // ---- reasoning -----------------------------------------------------------------------------------------------------
  ["reason", "why|لماذا|ليه|reason", "Answer 'why' with the main cause first, then supporting causes — don't list everything equally."],
  ["reason", "all .* are|no .* can|only .* are|deduc|استنتاج", "Logic puzzles: turn each sentence into a rule, apply them one at a time, and check the conclusion against every rule."],
  ["reason", "if|suppose|لو|افترض", "For 'what if' questions, state the assumption, then follow the consequences step by step."],
  ["reason", "true or false|صح ولا غلط|صح أم خطأ", "True/false: say which, then the one fact that decides it."],
  ["reason", "how many|كام واحد|عدد", "Counting problems: list or group systematically so nothing is counted twice."],
  ["reason", "sequence|pattern|next number|المتتالية|النمط", "Number patterns: check differences, ratios and alternating patterns before guessing."],
  ["reason", "paradox|contradiction|تناقض", "If the question contains a contradiction or impossible premise, say so in the first line."],
  ["reason", "step|خطوة", "Number the steps and keep each to one idea."],
  ["reason", "assum|افتراض", "List assumptions separately so the user can correct them."],
  ["reason", "physical|weight|fall|float|يقع|يطفو", "Physical reasoning: picture the scene, apply gravity, balance and conservation, and check with everyday experience."],

  // ---- planning & productivity ---------------------------------------------------------------------------------------
  ["plan", "schedule|routine|جدول|روتين", "A schedule: fixed commitments first, then 1–3 priorities per day, with buffers."],
  ["plan", "goal|هدف|أهداف|اهداف", "Goals: specific, measurable, with a deadline and a first action for today."],
  ["plan", "project|مشروع", "Projects: break into milestones with owners and dates; track risks and dependencies."],
  ["plan", "todo|to-do|tasks|مهام", "Task lists: order by impact and urgency; do the hardest important task first."],
  ["plan", "meeting|اجتماع", "Meetings: an agenda with times, a decision owner, and written actions at the end."],
  ["plan", "habit|عادة", "Habits: start tiny, attach to an existing routine, and track streaks."],

  // ---- dates & time -------------------------------------------------------------------------------------------------------
  ["dates", "date|day|week|month|year|تاريخ|يوم|أسبوع|اسبوع|شهر|سنة", "Date maths: count calendar days vs working days explicitly, and say whether the end day is included."],
  ["dates", "time ?zone|gmt|utc|توقيت", "Time zones: give both local times; Egypt is UTC+2 (UTC+3 in summer daylight time)."],
  ["dates", "age|عمر|سن", "Age: subtract years, then subtract one if the birthday hasn't happened yet this year."],
  ["dates", "deadline|due|موعد", "Deadlines: state the exact date and weekday, and a reminder date before it."],
  ["dates", "hijri|هجري", "Hijri dates shift about 11 days earlier each Gregorian year; exact dates depend on moon sighting."],
  ["dates", "latest|newest|current|أحدث|احدث|آخر|اخر", "'Latest' changes over time — say your information may be out of date and suggest Web for the newest."],

  // ---- facts & accuracy ------------------------------------------------------------------------------------------------------
  ["facts", "who|when|where|which year|مين|امتى|إمتى|فين", "For facts (names, dates, places), if you're not sure, say so rather than guess."],
  ["facts", "statistic|population|عدد السكان|إحصائية", "Statistics: give the year and source of the figure; populations and prices change."],
  ["facts", "best|biggest|largest|fastest|أكبر|اكبر|أسرع|اسرع", "Superlatives ('largest', 'fastest') change over time and depend on the definition — say which definition and year."],
  ["facts", "company|brand|شركة|ماركة", "Companies: founding year, headquarters, main products — and note recent changes may be missing."],
  ["facts", "quote|said|قال", "Only attribute a quote if you're sure of it; otherwise paraphrase and say it's commonly attributed."],
  ["facts", "news|today|أخبار|اخبار|النهارده", "News and today's events need the web — say so if Web is off."],
  ["facts", "spec|specification|مواصفات", "Specifications: give each figure with its unit and the version/year it applies to."],
  ["facts", "list all|every|كل ", "When asked for 'all', list every item you know and say the list may not be complete."],

  // ---- photos & visual -----------------------------------------------------------------------------------------------------------
  ["photo", "photo|image|picture|صورة|الصورة", "Photos: describe what is actually visible first; mark guesses about brand or model with how sure you are."],
  ["photo", "receipt|invoice|فاتورة|إيصال|ايصال", "Receipts: read every line item, quantity, price, VAT and total; flag anything unreadable."],
  ["photo", "document|scan|مستند|ورقة", "Scanned documents: keep the original layout (headings, tables) and mark unclear words as [unclear]."],
  ["photo", "plate|license|لوحة", "Don't identify private people from photos; describe only what is relevant."],
  ["photo", "damage|crack|rust|تلف|شرخ|صدأ", "Damage in a photo: describe location and size, likely cause, and whether it needs a professional inspection."],
  ["photo", "design|interior|ديكور|تصميم", "Interior design: give a colour palette (3 colours with hex), furniture layout, lighting and materials."],

  // ---- general answer quality ------------------------------------------------------------------------------------------------------
  ["quality", ".", "Answer the exact question first; add only details that help the user act."],
  ["quality", "detail|full|complete|بالتفصيل|كامل", "Detailed answers: use headings, cover every part of the question, and end with a short summary."],
  ["quality", "list|قائمة|اذكر", "Lists: consistent format, most important first, and no duplicates."],
  ["quality", "example|مثال", "Examples should be realistic and specific (real names, numbers, places)."],
  ["quality", "table|جدول", "Tables: short column headers with units, one fact per cell."],
  ["quality", "advice|نصيحة|نصايح", "Advice: concrete actions, in order, with the reason for each."],
];

let COMPILED = null;
function compiled() {
  // Triggers match at the START of a word (so "if" doesn't fire inside "lift", "ai" inside
  // "email"); short words (≤ 3 letters, Latin or Arabic) must also END there ("لتر" not in
  // "للتركي", "الم" not in "المتوسط"). Arabic words may still carry ال / و / ب / ل in front.
  const AR = "\\u0600-\\u06FF";
  const tidy = (src) => src
    .replace(/(^|\|)([a-z]{1,3})(?=\||$)/gi, "$1$2(?![A-Za-z])")
    .replace(new RegExp("(^|\\|)([" + AR + "]{2,3})(?=\\||$)", "g"), "$1(?<![" + AR + "])$2(?![" + AR + "])");
  if (!COMPILED) COMPILED = T.map(([area, re, tip], i) => ({ i, area, re: new RegExp(re === "." ? "." : "(?<![A-Za-z])(?:" + tidy(re) + ")", "i"), tip, general: re === "." }));
  return COMPILED;
}

/** How many tips there are (for the tests and the About screen). */
export const TIP_COUNT = T.length;
export const TIP_AREAS = [...new Set(T.map((t) => t[0]))];

/**
 * The tips for this question: the most specific matches first (tips whose trigger is a
 * rarer word score higher), at most `max`, at most 2 per area so one area can't fill it.
 * → [tip text]
 */
export function tipsFor(question, max = 3) {
  const q = String(question || "").slice(0, 1500);
  if (!q.trim() || max <= 0) return [];
  const hits = [];
  for (const t of compiled()) {
    if (t.general) continue;
    const m = q.match(t.re);
    if (!m) continue;
    // a longer matched word is more specific ("outrigger" beats "car")
    hits.push({ ...t, score: Math.min(20, (m[0] || "").length) + (/crane|money|maths|code|excel/.test(t.area) ? 1 : 0) });
  }
  hits.sort((a, b) => b.score - a.score || a.i - b.i);
  // one tip from each matching area first (a crane-hire sum needs the maths, the VAT AND the
  // crane tip), best area first; then the second-best of each area, until `max`
  const areas = [];
  for (const h of hits) { let g = areas.find((x) => x.area === h.area); if (!g) areas.push(g = { area: h.area, list: [] }); g.list.push(h); }
  // the areas the question is most about come first: many matching tips + a strong match
  areas.sort((a, b) => (b.list.length * 4 + b.list[0].score) - (a.list.length * 4 + a.list[0].score));
  const out = [];
  for (let round = 0; round < max && out.length < max; round++)
    for (const g of areas) { if (out.length >= max) break; if (g.list[round]) out.push(g.list[round].tip); }
  if (!out.length) out.push(T[T.findIndex((t) => t[1] === ".")][2]);
  return out;
}

/** The tips as a short block to add after the question. */
export function tipsBlock(question, max = 3) {
  const tips = tipsFor(question, max);
  return tips.length ? "\n\n(Expert tips for this answer:\n" + tips.map((t) => "- " + t).join("\n") + ")" : "";
}
