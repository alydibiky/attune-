// v9.0 (Ali: "99 percent accurate"): Scout reads an ad's facts right — Egyptian ways of saying a price («مليون و200 ألف»,
// «مليون ونص»), the km («عداد 60 ألف كم»), "used" in the title — and checks each wish against them.
import * as S from "../../web-src/scout.js";
let bad = 0; const ok = (c, m, x) => { if (!c) { bad++; console.log("FAIL " + m + (x !== undefined ? "  " + JSON.stringify(x) : "")); } };
const car = S.parseGoal("used Hyundai Tucson 2022 under 1.5 million"), flat = S.parseGoal("3-bedroom flat in Maadi for rent under 15,000"), flatAr = S.parseGoal("شقة ٣ غرف في المعادي للإيجار أقل من ١٥ ألف");
ok(car.kind === "car" && car.max === 1500000 && flat.kind === "rent" && flat.max === 15000 && flatAr.max === 15000 && flatAr.place === "المعادي", "goals read (car 1.5M, flat 15k, Arabic flat 15k in Maadi)");
const read = (title, text, g) => S.readAd({ url: "https://www.dubizzle.com.eg/ad/x-ID1.html", title, text }, g).facts;
let f = read("Flat for rent in Maadi Degla 3 bedrooms", "Apartment for rent in Maadi, Degla. 3 bedrooms, 2 bathrooms, 160 sqm, 4th floor. Price: 14,000 EGP per month. Call 01001234567", flat);
ok(f.price === 14000 && f.beds === 3 && f.area === 160, "English flat: 14,000 · 3 beds · 160 m² (the phone number is not a price)", f);
f = read("شقة للإيجار المعادي", "شقة للايجار في المعادي سرايات ٣ غرف ٢ حمام ١٨٠ متر الدور الخامس الايجار ١٦٠٠٠ جنيه شهريا", flatAr);
ok(f.price === 16000 && f.beds === 3 && f.area === 180, "Arabic flat: 16,000 · 3 غرف · 180 متر", f);
f = read("توسان 2021 للبيع", "هيونداي توسان موديل 2021 عداد 60 ألف كم السعر مليون و200 ألف", car);
ok(f.price === 1200000 && f.year === 2021 && f.km === 60000, "«مليون و200 ألف» = 1,200,000 · «عداد 60 ألف كم» = 60,000 km", f);
f = read("Tucson 2022", "توسان 2022 السعر مليون ونص", car); ok(f.price === 1500000, "«مليون ونص» = 1,500,000", f.price);
f = read("Tucson 2022", "توسان 2022 السعر 2 مليون و300 ألف", car); ok(f.price === 2300000, "«2 مليون و300 ألف» = 2,300,000", f.price);
f = read("Hyundai Tucson 2022 used", "Hyundai Tucson 2022, 45,000 km, automatic, one owner, price 1,350,000 EGP", car);
ok(f.price === 1350000 && f.km === 45000 && f.used === true && f.oneOwner === true, "English car: 1,350,000 · 45,000 km · used (from the title) · one owner", f);
const c = S.check(S.readAd({ url: "https://www.dubizzle.com.eg/ad/x-ID2.html", title: "توسان 2021", text: "هيونداي توسان موديل 2021 السعر مليون و200 ألف" }, car), car);
ok(c.bad.some((x) => x.k === "year"), "a 2021 is flagged when 2022 was asked");
ok(S.spokenAmounts("السعر مليون و200 ألف").length === "السعر مليون و200 ألف".length, "positions in the text stay where they were");
console.log(bad ? bad + " FAILED" : "PASS v916scout: Scout reads Egyptian prices, km and 'used' right, and checks each wish");
