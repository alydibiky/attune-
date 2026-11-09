/* ---- v9.9.7 W1 "Do it on the web" (Ali OK'd: "you say the task; Attune opens the site in its own browser, does the steps while
   showing each one, fills your saved details, stops for your login, and ALWAYS stops before paying").
     readWebTask(text, now) → { verb, what, date, time, people, near, place, url, site, steps } | null
   The page then opens the site in Attune's browser (AgentBrowser.kt) with the person's saved details AND the task's own values
   (date, time, number of people — agent-kit.js fill), and the steps are ticked from what the browser reports back
   (opened · fields filled · the payment page reached → "your turn"). Hotels, flights, food orders and doctors stay with Agents;
   "send / call / uber" stay with W2 (applinks.js). Pure; tests: tests/unit/v997webtask.test.mjs. */
import { dateOf } from "./tables.js";

const VERB = /^\s*(?:please\s+|can you\s+|could you\s+)?(book|reserve|renew|register(?:\s+for)?|apply\s+for|sign\s+up\s+for|buy|get\s+me|pay)\s+(.+)$/i;
const VERB_AR = /^\s*(احجز(?:لي)?|احجزلي|جدد(?:لي)?|سجل(?:لي)?\s+في|قدم(?:لي)?\s+على|اشتري(?:لي)?|ادفع)\s+(.+)$/;
// what Agents (hotels, flights, a food order, a doctor) or W2 (a message, a ride) already do — left to them
const NOT_MINE = /\b(hotels?|flights?|airline|airbnb|uber|careem|taxi|ride|talabat|elmenus|doctor|clinic|dentist)\b|فندق|طيران|رحلة طيران|اوبر|كريم|طلبات|دكتور|عيادة/i;
// the official / usual place for some tasks (else a web search finds it, and the person picks)
const SITES = [
  [/\b(car|driving)\s*licen[cs]e|traffic|مرور|رخصة (العربية|القيادة|السواقة)|رخصه/i, "https://digital.gov.eg/", "Digital Egypt"],
  [/\bpassport\b|جواز|باسبور/i, "https://digital.gov.eg/", "Digital Egypt"],
  [/\bnational id\b|بطاقة الرقم القومي|البطاقة/i, "https://digital.gov.eg/", "Digital Egypt"],
  [/\b(cinema|movie|film)\b|سينما|فيلم/i, "", ""],
];
const pad = (n) => String(n).padStart(2, "0");
/** "8pm" / "8:30 pm" / "20:00" / «الساعة ٨ بالليل» → "20:00" */
export function timeOf(t) {
  const s = String(t || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  let m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(s);
  if (m) { let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12; return pad(h) + ":" + (m[2] || "00"); }
  m = /\b(?:at\s+)?(\d{1,2}):(\d{2})\b/.exec(s); if (m && +m[1] < 24) return pad(+m[1]) + ":" + m[2];
  m = /الساع[ةه]\s*(\d{1,2})(?::(\d{2}))?\s*(الصبح|صباحا|صباحاً|بالليل|مساء|مساءً|العصر|بعد الضهر|بعد الظهر)?/.exec(s);
  if (m) { let h = +m[1]; if (/بالليل|مساء|العصر|بعد/.test(m[3] || "") && h < 12) h += 12; return pad(h) + ":" + (m[2] || "00"); }
  return "";
}
export function peopleOf(t) {
  const s = String(t || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  const m = /\bfor\s+(\d{1,2})\s*(people|persons|guests|players|of us|adults)?\b|\b(\d{1,2})\s*(people|persons|guests|players|tickets|seats|adults)\b|(\d{1,2})\s*(افراد|أفراد|اشخاص|أشخاص|تذاكر|كراسي)|ل\s*(\d{1,2})\s*(افراد|أفراد|اشخاص|أشخاص)/i.exec(s);
  if (!m) return 0; const n = +(m[1] || m[3] || m[5] || m[7]); return n >= 1 && n <= 50 ? n : 0;
}
export function readWebTask(text, now = Date.now()) {
  const t = String(text || "").trim(); if (!t || t.length > 300 || /[?؟]\s*$/.test(t)) return null;
  const m = VERB.exec(t) || VERB_AR.exec(t); if (!m) return null;
  if (NOT_MINE.test(t)) return null;
  const verb = m[1].toLowerCase().replace(/\s+/g, " ");
  let rest = m[2].replace(/\b(?:for me|on the web|online|on the website|please)\b|اونلاين|أونلاين|من النت|على النت/gi, " ");
  const date = dateOf(rest, now), time = timeOf(rest), people = peopleOf(rest), near = /\bnear (?:me|here)\b|\bnearby\b|قريب مني|جنبي|قريب/i.test(rest);
  // "what" = the words before the day / time / people / place
  const what = rest.split(/\s+(?:on|at|this|next|tomorrow|today|tonight|for\s+\d|near|in\s+[A-Z]|يوم|الساعة|الساعه|بكره|بكرة|النهارده|ل\s*\d|قريب)(?![\p{L}])/iu)[0]
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b.*$/i, "").replace(/\s+/g, " ").trim().replace(/^(a|an|the|my)\s+/i, "");
  if (!what || what.length < 2) return null;
  const place = (/\bin\s+([A-Z][\p{L} ]{2,30}?)(?=\s+(?:on|at|for|this|next)|$)/u.exec(rest) || /\bفي\s+([\p{L} ]{2,25}?)(?=\s+(?:يوم|الساعة|الساعه)|$)/u.exec(rest) || [])[1] || "";
  const known = SITES.find(([re]) => re.test(t));
  const q = [verb === "get me" ? "" : verb, what, place, near ? "near me" : ""].filter(Boolean).join(" ");
  const url = known && known[1] ? known[1] : "https://www.google.com/search?q=" + encodeURIComponent(q);
  return { verb, what, date, time, people, near, place: place.trim(), url, site: known && known[2] ? known[2] : "", searched: !(known && known[1]), said: t };
}
/** The steps shown before and while it runs. state: "wait" | "doing" | "done" | "you". */
export function stepsFor(x, r = null) {
  const said = [x.date, x.time, x.people ? x.people + " ppl" : ""].filter(Boolean).length > 0;
  const opened = !!r, filled = r && (r.filled || 0) > 0, pay = r && r.payment;
  return [
    { k: "understood", state: "done" },
    { k: x.searched ? "find" : "open", state: opened ? "done" : "wait" },
    { k: "fill", state: filled ? "done" : opened ? "you" : "wait", n: r ? r.filled || 0 : 0, said },
    { k: "pay", state: pay ? "you" : "wait" },
  ];
}
/** What goes to the browser's form filler: the saved details + this task's date, time and people. */
export const fillFor = (profile, x) => ({ ...(profile || {}), ...(x.date ? { taskDate: x.date } : {}), ...(x.time ? { taskTime: x.time } : {}), ...(x.people ? { taskPeople: String(x.people) } : {}) });
export const WEBTASKS_KEY = "attune:webtasks:v1";
