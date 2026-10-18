// v6.37 S4: the brand kit → a readable deck design, the logo inside the .pptx.
import { brandTheme, contrast, dataUrlBytes } from "../../web-src/brand.js";
import { pptxFromDeck, deckShapes, themeOf } from "../../web-src/slides.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const t = brandTheme({ name: "Adrighem & Aldibiki", color: "F59E0B" });
ok(contrast(t.accent, "FFFFFF") >= 3, "a light brand colour is darkened until it reads on white (" + t.accent + ")");
ok(t.name === "Adrighem & Aldibiki" && t.cover !== t.accent && t.card.length === 6, "cover, card and accent are made from the colour");
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
ok(dataUrlBytes(PNG).bytes.length > 60 && dataUrlBytes("nope") === null, "the logo's bytes");
const deck = { title: "Fleet 2026", lang: "en", theme: "brand", brand: { name: "A&A Cranes", color: "1D4ED8", logo: PNG, lw: 2, lh: 1 },
  slides: [{ kind: "bullets", title: "Why us", bullets: ["150 people", "Cranes up to 500 t"] }] };
ok(themeOf(deck).brand === true, "the deck uses the brand design");
const sh = deckShapes(deck);
ok(sh.every((x) => x.shapes.some((y) => y.t === "pic")), "the logo is on every slide");
ok(sh[1].shapes.some((y) => y.t === "text" && y.paras.some((p) => /A&A Cranes · Fleet 2026/.test(p.text))), "the company name in the footer");
const zip = new TextDecoder("latin1").decode(pptxFromDeck(deck));
ok(zip.includes("ppt/media/logo.png") && zip.includes('r:embed="rId3"') && zip.includes('Extension="png"'), "the .pptx carries the logo, linked from each slide");
ok(!new TextDecoder("latin1").decode(pptxFromDeck({ ...deck, theme: "ocean" })).includes("ppt/media/logo"), "another design: no logo");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
