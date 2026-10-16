/* ---- v6.30 (Ali: "no bottom bar on any page — a sidebar like ChatGPT, every feature that can be combined combined, no more than
   6 options on the left"). The whole app is 6 places; the tools that belong together are ONE page with tabs at the top
   (e.g. Code · Improve a prompt · Compress · Humanize · Copilot · Library · Ask = "Create"; Studio stays its own).
   Pure, so it is unit-tested (tests/unit/v734hubs.test.mjs). The pages themselves are unchanged — a tab is the same page as before. */

/** The 6 places in the sidebar: [id, label, the page it opens, members (every mode that lives there)]. */
export const HUBS = [
  ["home", "Home", "home", ["home"]],
  ["chat", "Chat", "chat", ["chat", "assistants", "projects", "skills", "artifacts", "instant", "xray", "lifeask"]],
  ["money", "Money", "money", ["money", "guardian", "radar", "life", "deal", "scout", "reminders"]],
  ["health", "Health", "health", ["health", "fit", "care", "cycle"]],
  ["learn", "Learn", "learn", ["learn", "coach", "memory", "shelf", "knowledge", "news"]],
  ["tools", "Tools", "tools", ["tools", "convert", "translate", "pdfchat", "slides", "cv", "video", "map", "travel", "studio",
    "code", "improve", "compress", "humanize", "copilot", "library", "ask", "business", "crane", "field", "fleet", "guide", "privacy"]],
];

/** Inside Tools, the pages that are one page with tabs (the smallest group a page is in gives its tabs). */
export const GROUPS = [
  ["files", "Files", ["convert", "translate", "pdfchat", "slides", "cv", "video"]],
  ["places", "Places", ["map", "travel"]],
  ["create", "Create", ["code", "improve", "compress", "humanize", "copilot", "library", "ask"]],
  ["work", "Business", ["business", "crane", "field", "fleet"]],
];

/** Pages that take the whole screen with their own header (no tab row on them). */
export const FULL = ["home", "tools", "business", "fit", "map"];

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
  if (available) list = list.filter((m) => m === mode || available.includes(m));
  return list.length > 1 ? list : [];
}

/** The Tools page: one card per combined page (Files, Places, Create, Business) plus Studio and How to use. */
export const TOOLS_CARDS = [
  ["Files", ["convert", "translate", "pdfchat", "slides", "cv", "video"]],
  ["Places", ["map", "travel"]],
  ["Create", ["studio", "code"]],
  ["Business", ["business", "crane", "field", "fleet"]],
  ["Help", ["guide"]],
];
