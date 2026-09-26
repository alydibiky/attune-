/* ---- Deep web research (v5.20) -------------------------------------------------------------
   Ali: "view more pages, one page at a time, and before answering, answer in full detail."
   A phone model can't read eight whole pages at once, so it reads them ONE AT A TIME:

     1. search; the pages come back in full (WebTools.kt reads up to 8)
     2. each page → its passages about the question (webrank.js) → the model writes NOTES:
        every fact that answers the question, numbers copied exactly
     3. every note line with a number that isn't on that page is dropped (a mangled or
        invented figure never reaches the answer)
     4. "what is still missing?" → one more search just for that, read the same way
     5. the final answer is written from all the notes, complete and cited.
   Pure helpers here (unit-tested in tests/unit/v520.test.mjs); the loop is in chat.jsx.  */

export const NOTES_SYS = `You read ONE web page for a question and write NOTES — every fact on the page that helps answer it.
Rules:
- One fact per line, starting with "- ". Keep names, versions, trims, prices, dates, units and figures exactly as the page writes them (copy digits exactly).
- For tables, keep each relevant row as one line: "- <row name>: <column> <value>; <column> <value> …".
- Include everything relevant (all trims, all versions, all prices) — completeness matters more than brevity.
- Nothing from your own knowledge. If the page has nothing relevant, reply exactly: NONE`;

export function notesMessages(question, page) {
  return [
    { role: "system", content: NOTES_SYS },
    { role: "user", content: `QUESTION: ${String(question || "").slice(0, 600)}\n\nPAGE: ${page.title} — ${page.url}\n${String(page.text || "").slice(0, 6000)}\n\nNOTES:` },
  ];
}

const numsIn = (s) => (String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/[,.]$/, ""));
/**
 * Keep only note lines whose numbers all appear on the page (digits compared with and
 * without thousands separators). → { text, kept, dropped }
 */
export function checkNotes(notes, pageText) {
  const hay = String(pageText || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const hay2 = hay.replace(/(\d),(?=\d{3}\b)/g, "$1");
  const lines = String(notes || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^none\.?$/i.test(l));
  const kept = [], dropped = [];
  for (const l of lines) {
    const bad = numsIn(l).filter((n) => n.length >= 2 && !hay.includes(n) && !hay2.includes(n.replace(/,/g, "")));
    (bad.length ? dropped : kept).push(l.replace(/^[*•]\s*/, "- ").replace(/^(?!- )/, "- "));
  }
  return { text: kept.join("\n"), kept: kept.length, dropped: dropped.length };
}

export function missingMessages(question, notes) {
  return [
    { role: "system", content: "You check research notes against a question. If an important part of the question is NOT answered by the notes (a trim, a figure, a price, a date that was asked for), reply with ONE short web search query that would find it. If the notes answer everything, reply exactly: NONE. Reply with the query or NONE only." },
    { role: "user", content: `QUESTION: ${String(question || "").slice(0, 600)}\n\nNOTES:\n${String(notes || "").slice(0, 5000)}` },
  ];
}
export function cleanQuery(ans) {
  const q = String(ans || "").split("\n")[0].replace(/^["'“]|["'”]$/g, "").replace(/^(query|search)\s*:\s*/i, "").trim();
  return !q || /^none\b/i.test(q) || q.length < 4 ? "" : q.slice(0, 160);
}

/** How many pages a question deserves: detail-hungry questions get more. */
export function pagesFor(question) {
  const q = String(question || "");
  return /\b(all|every|each|full|detailed|details|compare|comparison|vs|versus|specs?|specifications?|trims?|versions?|prices?|review|pros|cons|advantages|disadvantages)\b|كل|مواصفات|مقارنة|الفرق|فئات|أسعار|اسعار|بالتفصيل|تفاصيل/i.test(q) || q.length > 80 ? 8 : 5;
}

export const FINAL_ADD = "\n\n(These passages are research NOTES taken page by page. Write the COMPLETE, detailed answer: cover every part of the question and every item the notes mention (all trims / versions / options, each with its figures — a table when comparing), cite the source number after each fact, and end with what the sources did not say.)";
