// Unit tests for v5.40: Slides & Reports (web-src/slides.js) and the Word writer's report blocks.
import * as S from "../../web-src/slides.js";
import * as C from "../../web-src/convert.js";
import { execFileSync } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- the plan ----
const o = S.parseOutline("Sure! Here is the plan:\n**TITLE:** Crane Safety 2026\nSUBTITLE: For site managers\n1. [bullets] Why lifts fail\n2) Agenda\n3. [chart] Accidents per year\n4. Pros and cons of outriggers mats\n5. [STEPS] Planning a lift\n6. [bullets] Why lifts fail\n7. [table] Checklist", 6, { figures: false });
eq([o.title, o.subtitle], ["Crane Safety 2026", "For site managers"], "the plan's title and subtitle (bold markers and chatter ignored)");
eq(o.slides.map((s) => s.kind + ":" + s.title), ["bullets:Why lifts fail", "bullets:Accidents per year", "two:Pros and cons of outriggers mats", "steps:Planning a lift", "table:Checklist"],
  "slides: 'Agenda' dropped (the app adds it), duplicates dropped, no chart without sources, a missing type guessed from the title");
eq(S.parseOutline("1. [chart] Sales by year\n2. [stats] Key numbers\n3. [quote] Motto", 3, { figures: true }).slides.map((s) => s.kind), ["chart", "stats", "quote"], "with sources, number and chart slides are kept");
const f = S.parseOutline("I can't do that.", 6, { topic: "مشروع العاصمة" });
eq([f.title, f.slides.length, f.slides[2].kind], ["مشروع العاصمة", 6, "two"], "a useless plan still gives a deck (by code, in Arabic for an Arabic topic)");
eq(S.parseOutline("1. [bullets] A\n2. [bullets] B\n3. [bullets] C\n4. [bullets] D\n5. [bullets] E\n6. [bullets] F", 6).slides.map((s) => s.kind), ["bullets", "bullets", "two", "bullets", "steps", "bullets"], "a deck of only bullet slides gets some variety");
const om = S.outlineMessages({ topic: "Cranes", n: 8, lang: "ar", source: "" })[0].content;
eq([/exactly 8 lines/.test(om), /stats \(/.test(om), /in Arabic/.test(om)], [true, false, true], "the plan prompt: 8 slides, no number slides without sources, the language");

// ---- one slide ----
const b = S.parseSlide("bullets", "Here you go:\n- **Load charts:** always read the chart for the radius\n• Ground: check bearing pressure — 1,200 kPa max\n3. Wind limits matter\nNOTES: Tell the story\nof the 2019 accident.");
eq(b.bullets, [{ lead: "Load charts", text: "always read the chart for the radius" }, { lead: "Ground", text: "check bearing pressure — 1,200 kPa max" }, { lead: "", text: "Wind limits matter" }], "bullets: bold leads, any bullet mark, numbered lines");
eq(b.notes, "Tell the story of the 2019 accident.", "speaker notes can run over several lines");
const two = S.parseSlide("two", "LEFT: Renting\n- No capital\n- Operator included\nRight: Buying\n- Asset on the books\nNOTES: x");
eq([two.left.title, two.left.items, two.right.title, two.right.items], ["Renting", ["No capital", "Operator included"], "Buying", ["Asset on the books"]], "comparison: both sides");
eq(S.parseSlide("table", "| Crane | Capacity |\n|---|---|\n| LTM 1100 | 100 t |\n| AC 500 | 500 t | extra").rows, [["Crane", "Capacity", ""], ["LTM 1100", "100 t", ""], ["AC 500", "500 t", "extra"]], "table: Markdown rules skipped, rows padded to the same width");
eq(S.parseSlide("stats", "- 150 | employees\n- many | cranes\n- 500 t | biggest crane").stats, [{ value: "150", label: "employees" }, { value: "500 t", label: "biggest crane" }], "stats: a value without a number is dropped");
const ch = S.parseSlide("chart", "UNIT: EGP million\n- 2023 | 12.5\n- 2024 | 18\n- 2025 | ١٥\nTAKEAWAY: Growth slowed.");
eq([ch.unit, ch.bars.map((x) => x.value), ch.takeaway], ["EGP million", [12.5, 18, 15], "Growth slowed."], "chart: unit, values (Arabic digits too), takeaway");
eq(S.parseSlide("quote", "QUOTE: “Plan every lift.”\nBY: ").quote, "Plan every lift.", "quote without its quotation marks");
eq(S.fixSlide(S.parseSlide("two", "- a\n- b"), "T").kind, "bullets", "a comparison that came out as a list becomes a key-points slide");
eq(S.fixSlide(S.parseSlide("chart", "- 2024 | 10"), "T").bullets, [{ lead: "2024", text: "10" }], "a chart with one bar becomes key points");
eq(S.fixSlide(S.parseSlide("table", "just text"), "T").kind, "bullets", "a table without rows becomes key points");
const back = S.parseSlide("two", S.slideToText(two));
eq([back.left.items, back.right.title], [two.left.items, two.right.title], "a slide → editable text → the same slide");

// ---- figures ----
eq([S.parseNum("EGP 3.5 million"), S.parseNum("1,200 t"), S.parseNum("٢٥٠"), S.parseNum("none")], [3.5, 1200, 250, null], "numbers from text");
eq(S.unbacked("Market: EGP 4,200 million, 61% mobile, 99% happy, 3 steps", "The market reached EGP 4200 million. Mobile cranes are 61%."), ["99"], "a figure not in the sources is found (list counts like 3 are ignored)");
const chk = S.checkFigures(S.parseSlide("chart", "- 60 t | 35,000\n- 800 t | 400,000"), "Day rates: 60 t EGP 35,000");
eq([chk.dropped, chk.slide.bars.length], [1, 1], "chart bars whose figure isn't in the sources are removed");
eq(S.hasFigures("price 12,000 and 45% and 300 t"), true, "sources with figures allow number slides");
eq([S.splitLead("Speed: on site in 24 hours").lead, S.splitLead("Starts at 10:30 every day").lead], ["Speed", ""], "a lead is split off; times are not leads");

// ---- layout ----
const th = S.THEMES.midnight;
const sh = S.layoutSlide({ kind: "bullets", title: "A title", bullets: [{ lead: "One", text: "x" }, { lead: "Two", text: "y" }, { lead: "Three", text: "z" }] }, th, { i: 3, deckTitle: "Deck" });
eq(sh.filter((x) => x.t === "rect" && x.r === 18).length, 3, "3 short points with leads are drawn as 3 cards");
eq(sh.every((x) => x.x >= -300 && x.x + x.w <= S.SW + 300 && x.y + x.h <= S.SH + 300), true, "shapes stay on the slide");
const ar = S.layoutSlide({ kind: "bullets", title: "عنوان", bullets: [{ lead: "", text: "نقطة طويلة جداً ".repeat(6) }] }, th, { rtl: true, lang: "ar" });
const t = ar.find((x) => x.t === "text" && x.paras[0].text === "عنوان");
eq([t.rtl, t.align, t.x + t.w], [true, "r", S.SW - 72], "Arabic slides are mirrored and right-aligned");
eq(S.layoutSlide({ kind: "table", title: "pending" }, th, {}).some((x) => x.t === "table"), false, "a slide still being written doesn't crash the drawing");
eq(S.fitSize([{ text: "word ".repeat(200) }], 400, 100, 40, 12), 12, "too much text shrinks to the smallest size");
eq(S.fullDeck({ title: "T", lang: "ar", slides: [1, 2, 3, 4].map((i) => ({ kind: "bullets", title: "S" + i, bullets: [] })) }).map((s) => s.kind), ["cover", "agenda", "bullets", "bullets", "bullets", "bullets", "closing"], "cover + agenda + slides + closing");

// ---- the PowerPoint file ----
const deck = { title: "Deck & <Test>", subtitle: "Sub", lang: "en", theme: "steel", date: "today", slides: [
  { kind: "bullets", title: "One", bullets: [{ lead: "A", text: "b" }], notes: "Say hello" }, { kind: "table", title: "Two", rows: [["a", "b"], ["1", "2"]], notes: "" },
  { kind: "chart", title: "Three", bars: [{ label: "x", value: 1 }, { label: "y", value: 3 }], notes: "" }] };
const bytes = S.pptxFromDeck(deck);
const z = await C.unzip(bytes);
const txt = (n) => new TextDecoder().decode(z.get(n));
const ct = txt("[Content_Types].xml");
const parts = [...ct.matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1]);
eq(parts.every((p) => z.has(p)), true, "every part named in [Content_Types].xml is in the zip");
eq([...z.keys()].filter((n) => n.endsWith(".xml") && !n.startsWith("[")).every((n) => parts.includes(n)), true, "every XML part has its content type");
let relOk = true;
for (const n of [...z.keys()].filter((n) => n.endsWith(".rels"))) {
  const dir = n.replace(/_rels\/[^/]*\.rels$/, "");
  for (const m of txt(n).matchAll(/Target="([^"]+)"/g)) {
    const parts2 = (dir + m[1]).split("/"), out = [];
    for (const p of parts2) { if (p === "..") out.pop(); else if (p && p !== ".") out.push(p); }
    if (!z.has(out.join("/"))) { relOk = false; console.log("  missing target", n, m[1]); }
  }
}
eq(relOk, true, "every relationship points at a part that exists");
eq([(txt("ppt/presentation.xml").match(/<p:sldId /g) || []).length, txt("ppt/presentation.xml").includes("Deck &amp; &lt;Test&gt;") || txt("docProps/core.xml").includes("Deck &amp; &lt;Test&gt;")], [5, true], "cover + 3 slides + closing (no agenda for 3 slides); the title is escaped");
eq(txt("ppt/notesSlides/notesSlide2.xml").includes("Say hello"), true, "speaker notes");
eq(txt("ppt/slides/slide3.xml").includes("<a:tbl>"), true, "the table slide is a real table");
const tmp = mkdtempSync(join(tmpdir(), "v540-"));
writeFileSync(join(tmp, "d.pptx"), bytes);
try {
  const r = execFileSync("python3", ["-c", "import sys\nfrom pptx import Presentation\np=Presentation(sys.argv[1])\nprint(len(p.slides), p.slides[1].has_notes_slide, p.slides[1].notes_slide.notes_text_frame.text)", join(tmp, "d.pptx")]).toString().trim();
  eq(r, "5 True Say hello", "python-pptx opens the file and reads the notes");
} catch (e) { console.log("SKIP python-pptx not installed"); }

// ---- reports ----
const ro = S.parseReportOutline("TITLE: Fleet Report\nSUBTITLE: September\n1. Executive summary\n2. Revenue\n## 3. Utilisation\n4. Conclusion", 5);
eq(ro.sections, ["Revenue", "Utilisation"], "report plan: summary / conclusion headings are the app's, not the model's");
eq(S.sectionBlocks("## Revenue\nThe AC 500 led.\n# Details\n- one\n\nA | B\n1 | 2", "Revenue").map((x) => x.type), ["p", "h3", "li", "table"], "a section: its own heading dropped, headings become sub-headings");
const sm = S.parseSummary("Executive summary: Revenue grew.\nIt was good.\n\n**FINDINGS:**\n- AC 500 led\n- Costs fell\n");
eq(sm, { text: "Revenue grew. It was good.", findings: ["AC 500 led", "Costs fell"] }, "executive summary + findings");
const ds = S.dataSummary([["Crane", "Revenue", "Note"], ["LTM", "1,000", "ok"], ["AC 500", "3000", "busy"], ["LTM", "500", ""], ["", "", ""]], "sept");
eq([ds.rows, ds.chart.bars, /total 4,500/.test(ds.text), /LTM 1,500/.test(ds.text)], [3, [{ label: "LTM", value: 1500 }, { label: "AC 500", value: 3000 }], true, true], "a sheet → totals by code, the same name added up, a chart");
const rep = { title: "R", subtitle: "S", lang: "en", date: "d", sections: [{ heading: "Revenue", blocks: [{ type: "p", text: "The AC 500 earned the most money this month. Costs were lower than in August." }] }], summary: sm, conclusion: [{ type: "li", text: "Do it" }], sources: [{ title: "Site", url: "https://e.com" }], data: ds };
const rb = S.reportBlocks(rep, { chartImage: { b64: "iVBORw0KGgo=", w: 2, h: 1 } });
eq(rb.map((x) => x.type).slice(0, 4), ["title", "subtitle", "p", "h2"], "report: cover first");
eq(rb.filter((x) => x.type === "h1").map((x) => x.text), ["1. Executive summary", "2. Revenue", "3. Conclusions and recommendations", "4. Sources", "5. Data"], "numbered chapters in order");
const dz = await C.unzip(C.docxFromBlocks(rb, "R", { accent: "2563EB" }));
const doc = new TextDecoder().decode(dz.get("word/document.xml")), sty = new TextDecoder().decode(dz.get("word/styles.xml"));
eq([dz.has("word/media/chart1.png"), /<w:drawing>/.test(doc), /w:type="page"/.test(doc), /2563EB/.test(sty), !/<w:pPr>(?:(?!<\/w:pPr>).)*<w:spacing (?:(?!<\/w:pPr>).)*<w:spacing /.test(sty)], [true, true, true, true, true], "Word: the chart picture, a page break, coloured headings, one spacing per style");
const plain = await C.unzip(C.docxFromBlocks([{ type: "p", text: "x" }], "T"));
eq([new TextDecoder().decode(plain.get("[Content_Types].xml")).includes("png"), new TextDecoder().decode(plain.get("word/document.xml")).includes("xmlns:wp")], [false, false], "a plain Word file is unchanged (no picture parts)");
const rd = S.deckFromReport(rep);
eq(rd.slides.map((s) => s.kind), ["bullets", "chart", "bullets"], "report → slides: findings, the data chart, a slide per section");

eq(["Make me a PowerPoint about crane safety", "اعملي عرض تقديمي عن الأوناش", "write a report on September sales", "عايز تقرير عن الأعطال", "what is a slide rail?", "report the weather"].map(S.wantsDoc), ["deck", "deck", "report", "report", null, null], "Chat knows a request for slides or a report");
if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
