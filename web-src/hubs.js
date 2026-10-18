/* ---- v6.30 (Ali: "no bottom bar on any page — a sidebar like ChatGPT, every feature that can be combined combined, no more than
   6 options on the left"). The whole app is 6 places; the tools that belong together are ONE page with tabs at the top
   (e.g. Code · Improve a prompt · Compress · Humanize · Copilot · Library · Ask = "Create"; Studio stays its own).
   Pure, so it is unit-tested (tests/unit/v734hubs.test.mjs). The pages themselves are unchanged — a tab is the same page as before. */

/** The 6 places in the sidebar: [id, label, the page it opens, members (every mode that lives there)]. */
export const HUBS = [
  // v6.36 (Ali arranged it himself on the board, 18 Oct): Create on top, Projects its own place, Home (Chat lives here), Students,
  // Money, Health, Daily, Work; How to use + Privacy at the bottom of the sidebar, next to Settings (side-ui.jsx)
  ["create", "Create", "assistants", ["assistants", "skills", "artifacts", "studio", "code"]],
  ["projects", "Projects", "projects", ["projects"]],
  ["home", "Home", "home", ["home", "missions", "recall", "chat", "lifeask", "translate", "instant", "shelf"]],
  ["students", "Students", "coach", ["coach", "convert", "pdfchat", "slides", "cv"]],
  ["money", "Money", "money", ["money", "reminders", "timeline", "xray", "radar", "life", "guardian", "deal"]],
  ["health", "Health", "health", ["health", "fit", "care", "cycle"]],
  ["learn", "Daily", "learn", ["learn", "scout", "memory", "news", "map", "travel", "knowledge"]],
  ["tools", "Work", "business", ["business", "fleet", "crane", "field", "tools", "improve", "compress", "humanize", "copilot", "library", "video", "ask", "guide", "privacy"]],
];

/** Inside Tools, the pages that are one page with tabs (the smallest group a page is in gives its tabs). */
export const GROUPS = [
  // the tab rows (v6.36, Ali's board): Chat · Ask your life · Translate; Work = Business · Fleet · Crane · Reports · Tools
  ["talk", "Chat", ["chat", "lifeask", "translate"]],
  ["work", "Work", ["business", "fleet", "crane", "field", "tools"]],
  // pages with no tab row: they open from a Home tile, the Tools choices or the sidebar ("as choices, not tabs")
  ...["missions", "recall", "instant", "shelf", "projects", "improve", "compress", "humanize", "copilot", "library", "video", "ask", "guide", "privacy", "home"].map((m) => ["solo-" + m, m, [m]]),
];

/** Pages that take the whole screen with their own header (no tab row on them). */
export const FULL = ["home", "fit", "map"];   // (v6.36: Business shows the Work tabs — Tools is one of them)

/** v6.30 (Ali: no more than 6 tabs either): a page that lives INSIDE another — one tab; a small switch on top of the page moves
    between the two parts. Skills is part of Assistants, Artifacts part of Projects, Reminders part of Radar (both are dates).
    v6.32 (Ali picked it): Compress is part of Improve a prompt, so Create has 6 tabs. */
// v6.38 (M3): Timeline — everything from the other parts on one list
export const INSIDE = { timeline: "reminders", radar: "reminders", life: "reminders", xray: "reminders", guardian: "reminders" };
/* v6.36 (Ali's board: "reminders · tabs inside: xray, radar, life — rename it to a good name"): one Money tab, "Follow-ups", with a
   switch Reminders · Dates · People & plans · Chat X-Ray · Payments (the old Watch). Skills, Artifacts and Compress are their own
   pages again (Create's tabs / the Tools choices). */
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
  // v6.36 (Ali: "improve, compress, humanize, copilot, library, video downloader — under a tab called Tools in Business, as
  // choices, not tabs"): one card each
  ["improve", "Improve a prompt", "For ChatGPT, Claude, Gemini…", ["improve"]],
  ["compress", "Compress", "Shorter prompts", ["compress"]],
  ["humanize", "Humanize", "Sound like you", ["humanize"]],
  ["copilot", "Copilot", "Work with another AI", ["copilot"]],
  ["library", "Library", "Prompt recipes", ["library"]],
  ["video", "Video Downloader", "Paste a video link, pick the quality, save it to your phone", ["video"]],
  ["ask", "Ask (classic)", "The earlier Ask screen", ["ask"]],
];

/** The pages a device shows: members it doesn't have are dropped; a page with none left is not shown. */
export function toolPages(available = null) {
  return TOOL_PAGES.map(([id, t, sub, m]) => [id, t, sub, available ? m.filter((x) => available.includes(x)) : m]).filter((p) => p[3].length);
}
