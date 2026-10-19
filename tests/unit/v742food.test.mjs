// v6.42 (Ali's lunch photo: breaded chicken read as grilled breast, the soup and the potatoes missed).
import * as F from "../../web-src/fit.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(F.matchFood("Chicken soup").id === "chicken-soup" && F.matchFood("Mushroom soup").id === "mushroom-soup", "the dish kind decides: chicken soup is a soup, mushroom soup is a soup");
ok(F.matchFood("Chicken pané (breaded, fried)").id === "chicken-panee" && F.matchFood("Fried chicken").id === "chicken-fried", "pané and fried chicken keep their own foods");
ok(F.matchFood("Egg sandwich").id === "egg-sandwich" && F.matchFood("Chicken breast").id === "chicken-breast", "sandwiches and plain chicken breast unchanged");
const sys = F.photoMessages("", "eg")[0].content;
ok(/Chicken pané/.test(sys) && /crumbed = breaded and fried/.test(sys) && /bowls \(soup/.test(sys), "the photo prompt names pané, how to tell cooking styles, and to look for bowls and sides");
ok(/another dish or bowl \(soup/.test(F.hiddenMessages([{ name: "Chicken pané" }])[0].content), "the second look asks for other dishes too, not only oil and sauces");
console.log(bad ? bad + " FAILED" : "v742food ok");
