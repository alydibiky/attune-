// v7.9 (Ali: Scout's calm list "with an option to select more than 1 and make a table"): the picked ads side by side, by code.
import { compareAds } from "../../web-src/scout.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const ad = (id, price, km, year, score, extra = {}) => ({ id, title: "Tucson " + id, site: id + ".com", url: "https://" + id, score, facts: { price, km, year, cur: "EGP", ...extra } });
const t = compareAds([ad("a", 1420000, 40000, 2022, 92, { oneOwner: true, place: "Zayed" }), ad("b", 1450000, 55000, 2022, 88, { place: "Maadi" }), ad("c", 1550000, 61000, 2021, 71, { oneOwner: false })]);
const row = (k) => t.rows.find((r) => r.k === k);
ok(t.cols.length === 3 && t.cols[0].title === "Tucson a", "one column per picked ad");
ok(row("price").cells.map((c) => c.best).join() === "true,false,false" && row("km").cells[0].best, "the lowest price and km are marked best");
ok(row("year").cells.filter((c) => c.best).length === 2 && row("score").cells[0].best, "the newest year (two of them) and the highest score");
ok(row("oneOwner").cells[0].best && row("oneOwner").cells[1].v === null && row("place").cells.every((c) => !c.best), "yes beats no / not stated; a place is never 'best'");
ok(!row("beds") && !row("area") && row("site"), "a fact none of them states has no row");
ok(compareAds([ad("a", 1, 1, 2020, 1), ad("b", 2, 2, 2020, 2), ad("c", 3, 3, 2020, 3), ad("d", 4, 4, 2020, 4), ad("e", 5, 5, 2020, 5)]).cols.length === 4, "at most 4 side by side (a phone's width)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
