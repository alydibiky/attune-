/* ---- v6.30 (Ali: "no bottom bar on any page — a sidebar like ChatGPT, every feature that can be combined combined, no more than
   6 options on the left"). The whole app is 6 places; the tools that belong together are ONE page with tabs at the top
   (e.g. Code · Improve a prompt · Compress · Humanize · Copilot · Library · Ask = "Create"; Studio stays its own).
   Pure, so it is unit-tested (tests/unit/v734hubs.test.mjs). The pages themselves are unchanged — a tab is the same page as before. */

/** The 6 places in the sidebar: [id, label, the page it opens, members (every mode that lives there)]. */
export const HUBS = [
  ["home", "Home", "home", ["home"]],
  ["chat", "Chats", "chat", ["chat", "assistants", "projects", "skills", "artifacts", "instant", "xray", "lifeask"]],
  ["money", "Money", "money", ["money", "guardian", "radar", "life", "deal", "scout", "reminders"]],
  ["health", "Health", "health", ["health", "fit", "care", "cycle"]],
  ["learn", "Learn", "learn", ["learn", "coach", "memory", "shelf", "knowledge", "news"]],
  ["tools", "Work", "tools", ["tools", "convert", "translate", "pdfchat", "slides", "cv", "video", "map", "travel", "studio",
    "code", "improve", "compress", "humanize", "copilot", "library", "ask", "business", "crane", "field", "fleet", "guide", "privacy"]],
];

/** Inside Tools, the pages that are one page with tabs (the smallest group a page is in gives its tabs). */
export const GROUPS = [
  ["files", "Files", ["convert", "translate", "pdfchat", "slides", "cv", "video"]],
  ["places", "Places", ["travel", "map"]],
  ["create", "Create", ["code", "improve", "compress", "humanize", "copilot", "library", "ask"]],
  ["work", "Business", ["crane", "field", "fleet", "business"]],
  ["help", "Help", ["guide", "privacy"]],
];

/** Pages that take the whole screen with their own header (no tab row on them). */
export const FULL = ["home", "tools", "business", "fit", "map"];

/** v6.30 (Ali: no more than 6 tabs either): a page that lives INSIDE another — one tab; a small switch on top of the page moves
    between the two parts. Skills is part of Assistants, Artifacts part of Projects, Reminders part of Radar (both are dates).
    v6.32 (Ali picked it): Compress is part of Improve a prompt, so Create has 6 tabs. */
export const INSIDE = { skills: "assistants", artifacts: "projects", radar: "guardian", reminders: "guardian", compress: "improve" };
/* v6.34 (Ali: "what's the difference between Guardian and Radar — make Guardian, Radar and People all in Money"; "integrate them
   the best way"): Guardian (money already paid: overcharges, subscriptions, price rises) and Radar (dates coming: trials,
   renewals, warranties) + Reminders are ONE tab, "Watch", with a switch Payments · Dates · Reminders. Money = 5 tabs. */

/** The parts of a merged page ([main, ...inside]) when this page is one of them and the device has the main and at least one
    other; else []. */
export function partsOf(mode, available = null) {
  const main = INSIDE[mode] || (Object.values(INSIDE).includes(mode) ? mode : null);
  if (!main) return [];
  const has = (m) => !available || m === mode || available.includes(m);
  const inner = Object.keys(INSIDE).filter((k) => INSIDE[k] === main && has(k));
  return has(main) && inner.length ? [main, ...inner] : [];
}

/** The sidebar place a page belongs to ("tools" for anything unknown, so nothing is lost). */
export function hubOf(mode) {
  const h = HUBS.find((x) => x[3].includes(mode));
  return h ? h[0] : "tools";
}

/** The tabs on top of a page: its group inside Tools, else its place — only those available on this device. [] = no tab row. */
export function tabsFor(mode, available = null) {
  if (FULL.includes(mode)) return [];
  const g = GROUPS.find((x) => x[2].includes(mode));
  let list = g ? g[2] : hubOf(mode) === "tools" ? [] : (HUBS.find((x) => x[0] === hubOf(mode)) || [, , , []])[3];
  const has = (m) => !available || m === mode || available.includes(m);
  list = list.filter(has).filter((m) => !(INSIDE[m] && has(INSIDE[m])));   // a page inside another is not a tab of its own
  return list.length > 1 ? list : [];
}

/** v6.30 (Ali: "I don't want Tools to be 30 or 40 features — all combined in no more than 6 pages"): the Tools page is 6 pages.
    [id, title, what is inside, members]. A card opens the first member this device has; the rest are tabs at its top.
    (Maps and Business are full-screen pages without a tab row, so their cards open Travel / Crane toolkit, where they are tabs.) */
export const TOOL_PAGES = [
  ["files", "Files", "Convert, translate, ask a PDF, slides & reports, CV, video downloads", ["convert", "translate", "pdfchat", "slides", "cv", "video"]],
  ["create", "Create", "Code, better prompts, compress, humanize, copilot, prompt library", ["code", "improve", "compress", "humanize", "copilot", "library", "ask"]],
  ["studio", "Studio", "Pictures made on your phone", ["studio"]],
  ["places", "Maps & travel", "Offline maps, country packs and phrases", ["travel", "map"]],
  ["work", "Business", "Crane toolkit, site reports, fleet and your business", ["crane", "field", "fleet", "business"]],
  ["help", "Help & privacy", "How to use every tool, and what stays on your phone", ["guide", "privacy"]],
];

/** The pages a device shows: members it doesn't have are dropped; a page with none left is not shown. */
export function toolPages(available = null) {
  return TOOL_PAGES.map(([id, t, sub, m]) => [id, t, sub, available ? m.filter((x) => available.includes(x)) : m]).filter((p) => p[3].length);
}
