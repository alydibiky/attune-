/* ---- v6.32 Business builder v2: roles, currencies, price lists, encrypted backup, export as a real project -------------
   For the systems people build themselves (erp.js). Pure functions on a system object; the screens are in biz-v2-ui.jsx.
   - Team & roles: people with a PIN each. owner = everything; editor = records only (optionally only some tables);
     viewer = look only. guardChange() compares the system before/after any change and refuses what the role can't do,
     so every screen (form, grid, AI design chat, import) is covered by one check.
   - Currencies: a money column can have its own currency; sys.rates says what 1 unit is in the system's currency.
   - Price lists: a list over a products table (its price column): a % up/down for everything, and fixed prices per item.
     Picking a product in a form fills the price from the chosen list.
   - Export as a project: a folder (zip) — the app (index.html, works offline), a web-app manifest + offline worker so it
     installs on a phone, the data as JSON, an Electron wrapper (package.json + main.js) for a Windows .exe like Ali's
     desktop apps, and a README in English and Arabic.
   Tests: tests/unit/v732bizv2.test.mjs.                                                                                */
import { buildApp } from "./erp-app.js";
import { zipStore } from "./convert.js";

export const ROLES = {
  owner: { en: "Owner", ar: "المالك", note: "Everything: records, design, team, backups" },
  editor: { en: "Editor", ar: "محرر", note: "Adds and edits records — not the design or the team" },
  viewer: { en: "Viewer", ar: "مشاهد", note: "Looks only" },
};
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
/** PIN → a salted SHA-256 (the PIN itself is never stored). */
export async function hashPin(pin, salt) { return hex(await globalThis.crypto.subtle.digest("SHA-256", enc.encode("attune-erp|" + salt + "|" + pin))); }
const teamOf = (sys) => (sys.team && Array.isArray(sys.team.users) ? sys.team.users : []);
export { teamOf };
export const hasTeam = (sys) => teamOf(sys).length > 0;

/** Add (or update by id) a person. The first person must be an owner; a PIN is 4–8 digits and unique in the system. */
export async function setUser(sys, { id = null, name, role, pin = null, tables = [] }) {
  name = String(name || "").trim();
  if (!name) throw new Error("A name is needed");
  if (!ROLES[role]) throw new Error("Choose a role");
  const users = teamOf(sys);
  const old = id ? users.find((u) => u.id === id) : null;
  if (!old && !pin) throw new Error("Choose a PIN of 4 to 8 digits");
  if (pin != null && pin !== "" && !/^\d{4,8}$/.test(pin)) throw new Error("Choose a PIN of 4 to 8 digits");
  if (!users.length && role !== "owner") throw new Error("The first person must be an owner");
  const pinHash = pin ? await hashPin(pin, sys.id) : old.pinHash;
  if (users.some((u) => u.id !== id && u.pinHash === pinHash)) throw new Error("Someone already uses that PIN");
  const rec = { id: old ? old.id : "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, role, pinHash, tables: role === "editor" ? tables.filter(Boolean) : [] };
  const next = old ? users.map((u) => (u.id === id ? rec : u)) : [...users, rec];
  if (!next.some((u) => u.role === "owner")) throw new Error("Keep at least one owner");
  return { ...sys, team: { ...(sys.team || {}), users: next }, updated: Date.now() };
}
export function removeUser(sys, id) {
  const next = teamOf(sys).filter((u) => u.id !== id);
  if (next.length && !next.some((u) => u.role === "owner")) throw new Error("Keep at least one owner");
  return { ...sys, team: { ...(sys.team || {}), users: next }, updated: Date.now() };
}
/** PIN → the person, or null. */
export async function login(sys, pin) { const h = await hashPin(String(pin || ""), sys.id); return teamOf(sys).find((u) => u.pinHash === h) || null; }

const strip = (sys) => JSON.stringify({ ...sys, rows: null, history: null, updated: null, team: null, licence: null });
const rowsOf = (sys, tid) => JSON.stringify(sys.rows && sys.rows[tid] || []);
/** null when `user` may turn `before` into `after`; otherwise the reason (English). No team = no limits. */
export function guardChange(before, after, user) {
  if (!hasTeam(before)) return null;
  if (!user) return "Sign in with your PIN first";
  if (user.role === "owner") return null;
  if (JSON.stringify(before.team || null) !== JSON.stringify(after.team || null)) return "Only an owner can change the team";
  if (strip(before) !== strip(after)) return "Only an owner can change the design";
  const ids = new Set([...Object.keys(before.rows || {}), ...Object.keys(after.rows || {})]);
  for (const tid of ids) {
    if (rowsOf(before, tid) === rowsOf(after, tid)) continue;
    if (user.role === "viewer") return "Your role can only look";
    if (user.tables && user.tables.length && !user.tables.includes(tid)) return "Your role can't change this table";
  }
  return null;
}
export const can = (sys, user, what) => !hasTeam(sys) || (user && (user.role === "owner" || (what === "edit" && user.role === "editor")));

// ---- currencies -------------------------------------------------------------------------------------------------------
export const CURRENCIES = ["EGP", "USD", "EUR", "SAR", "AED", "GBP", "KWD", "QAR", "TRY", "CNY"];
export const baseCurrency = (sys) => sys.currency || "EGP";
export const fieldCurrency = (sys, f) => (f && f.currency) || baseCurrency(sys);
/** 1 unit of `cur` in the system's currency (1 for the system's own). */
export function rateOf(sys, cur) { if (!cur || cur === baseCurrency(sys)) return 1; const r = sys.rates && +sys.rates[cur]; return r > 0 ? r : null; }
export function setRate(sys, cur, rate) {
  cur = String(cur || "").toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(cur)) throw new Error("A currency is 3 letters, like USD");
  if (cur === baseCurrency(sys)) throw new Error("That is the system's own currency");
  const r = +String(rate).replace(",", ".");
  if (!(r > 0)) throw new Error("Enter the rate (how much 1 unit is in your currency)");
  return { ...sys, rates: { ...(sys.rates || {}), [cur]: r }, updated: Date.now() };
}
export function setFieldCurrency(sys, tid, fid, cur) {
  return { ...sys, tables: sys.tables.map((t) => (t.id !== tid ? t : { ...t, fields: t.fields.map((f) => (f.id !== fid || f.type !== "money" ? f : { ...f, currency: cur && cur !== baseCurrency(sys) ? cur : undefined })) })), updated: Date.now() };
}
/** A money value in the system's currency (null when the rate is missing). */
export function toBase(sys, f, v) { const r = rateOf(sys, fieldCurrency(sys, f)); return r == null || typeof v !== "number" ? null : Math.round(v * r * 100) / 100; }
/** A table's money columns summed in the system's currency, with the columns that lack a rate named. */
export function baseTotal(sys, tid, rows = null) {
  const t = sys.tables.find((x) => x.id === tid); if (!t) return { total: 0, missing: [] };
  rows = rows || sys.rows[tid] || [];
  const out = { byField: {}, missing: [] };
  for (const f of t.fields.filter((x) => x.type === "money")) {
    const r = rateOf(sys, fieldCurrency(sys, f));
    if (r == null) { out.missing.push(fieldCurrency(sys, f)); continue; }
    out.byField[f.id] = Math.round(rows.reduce((n, x) => n + (typeof x[f.id] === "number" ? x[f.id] : 0), 0) * r * 100) / 100;
  }
  return out;
}

// ---- price lists ------------------------------------------------------------------------------------------------------
/** The tables that can carry a price list: they have a money column (the price). */
export const priceTables = (sys) => sys.tables.filter((t) => t.fields.some((f) => f.type === "money"));
export function savePriceList(sys, l) {
  const name = String(l.name || "").trim();
  if (!name) throw new Error("A name is needed");
  const t = sys.tables.find((x) => x.id === l.tid);
  if (!t) throw new Error("Choose the products table");
  const f = t.fields.find((x) => x.id === l.fid && x.type === "money");
  if (!f) throw new Error("Choose the price column");
  const adjust = +String(l.adjust || 0).replace(",", ".");
  if (!isFinite(adjust) || adjust <= -100) throw new Error("The change must be above −100%");
  const prices = {};
  for (const [k, v] of Object.entries(l.prices || {})) { const n = +String(v).replace(",", "."); if (v !== "" && v != null && isFinite(n) && n >= 0) prices[k] = n; }
  const rec = { id: l.id || "pl" + Date.now().toString(36), name, tid: t.id, fid: f.id, adjust, prices };
  const lists = sys.priceLists || [];
  return { ...sys, priceLists: lists.some((x) => x.id === rec.id) ? lists.map((x) => (x.id === rec.id ? rec : x)) : [...lists, rec], updated: Date.now() };
}
export const removePriceList = (sys, id) => ({ ...sys, priceLists: (sys.priceLists || []).filter((x) => x.id !== id), updated: Date.now() });
/** A product's price on a list: its fixed price there, else the base price ± the list's %. */
export function priceOn(sys, listId, rowId) {
  const l = (sys.priceLists || []).find((x) => x.id === listId); if (!l) return null;
  if (l.prices && l.prices[rowId] != null) return l.prices[rowId];
  const r = (sys.rows[l.tid] || []).find((x) => x._id === rowId);
  const base = r && typeof r[l.fid] === "number" ? r[l.fid] : null;
  return base == null ? null : Math.round(base * (1 + l.adjust / 100) * 100) / 100;
}
/** In a form of table `tid`: when a link to the list's products table is set, which money field gets the price.
    The field named like the price column, else one named price / unit price / rate / سعر. → { linkFid, priceFid } | null */
export function priceTarget(sys, tid, listId) {
  const l = (sys.priceLists || []).find((x) => x.id === listId); const t = sys.tables.find((x) => x.id === tid);
  if (!l || !t) return null;
  const link = t.fields.find((f) => f.type === "link" && f.link === l.tid); if (!link) return null;
  const src = (sys.tables.find((x) => x.id === l.tid) || { fields: [] }).fields.find((f) => f.id === l.fid);
  const money = t.fields.filter((f) => f.type === "money");
  const price = money.find((f) => src && f.name.toLowerCase() === src.name.toLowerCase()) || money.find((f) => /unit\s*price|price|rate|سعر/i.test(f.name));
  return price ? { linkFid: link.id, priceFid: price.id } : null;
}

// ---- export as a real project -----------------------------------------------------------------------------------------
const slug = (s) => String(s || "my-system").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "my-system";
/** The project's files: [{ name, data }] — zip them with projectZip(). */
export function projectFiles(sys, { now = new Date().toISOString() } = {}) {
  const name = String(sys.name || "My business").replace(/[<>&"]/g, "");
  const dir = slug(sys.name);
  // the team (PIN hashes) stays in Attune: a 4-digit PIN hash outside the app could be guessed
  const pub = { ...sys, team: undefined };
  let html = buildApp(pub);
  html = html.replace("</head>", `<link rel="manifest" href="manifest.webmanifest"><meta name="theme-color" content="#0F172A">\n<script>if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js").catch(function(){});</script>\n</head>`);
  const manifest = { name, short_name: name.slice(0, 12), start_url: "./index.html", display: "standalone", background_color: "#F4F6FA", theme_color: "#0F172A", icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml" }] };
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="20" fill="#0F172A"/><text x="48" y="62" font-size="44" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${name.slice(0, 1).toUpperCase()}</text></svg>`;
  const sw = `const C="${dir}-v1";self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./index.html","./manifest.webmanifest","./icon.svg"]))));self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`;
  const pkg = { name: dir.replace(/[^a-z0-9-]/g, "") || "my-system", version: "1.0.0", description: name + " — made with Attune Business", author: "Attune Business", main: "main.js", scripts: { start: "electron .", build: "electron-builder --win --dir" },
    devDependencies: { electron: "31.0.0", "electron-builder": "24.13.3" }, build: { appId: "app.attune." + (dir.replace(/[^a-z0-9]/g, "") || "system"), productName: name, files: ["index.html", "main.js", "icon.svg", "data/**"], win: { target: "dir", signAndEditExecutable: false } } };
  const main = `// The desktop wrapper (Electron): one window showing index.html, fully offline. No alert()/confirm() are used by the app.
const { app, BrowserWindow } = require("electron");
const path = require("path");
function open() { const w = new BrowserWindow({ width: 1280, height: 860, title: ${JSON.stringify(name)}, webPreferences: { contextIsolation: true } }); w.setMenuBarVisibility(false); w.loadFile(path.join(__dirname, "index.html")); }
app.whenReady().then(open);
app.on("window-all-closed", () => app.quit());
`;
  const counts = sys.tables.map((t) => `- ${t.name}: ${(sys.rows[t.id] || []).length} records`).join("\n");
  const readme = `# ${name}

Made with Attune Business on ${now.slice(0, 10)}. Everything works offline; your data stays on your device.

## Open it
- **Any browser:** open \`index.html\`. Add, edit, search and export your records. "Save a copy with my data" makes a new file with your records inside.
- **On a phone as an app:** put this folder on any web host (or a local server) and open it; choose "Add to Home screen". It then works offline.
- **As a Windows program (.exe):** install Node.js LTS, then in this folder run, one line at a time:
\`\`\`
npm install
npm run build
\`\`\`
  The program is in \`dist\\win-unpacked\`. Keep that whole folder together.
- **Change the design:** open the app file in Attune → Business → "Open an app file", ask the AI, and export again.

## What's inside
${counts}
- \`data/system.json\` — the whole system (tables, fields, records) as JSON, for another database or a developer.

---

# ${name} (بالعربية)

تم إنشاؤه بواسطة «الأعمال» في Attune بتاريخ ${now.slice(0, 10)}. يعمل كله بدون إنترنت، وبياناتك تبقى على جهازك.

- **في أي متصفح:** افتح \`index.html\`.
- **على الهاتف كتطبيق:** ارفع المجلد على أي استضافة وافتحه، ثم اختر «إضافة إلى الشاشة الرئيسية».
- **كبرنامج Windows:** ثبّت Node.js LTS، ثم نفّذ في هذا المجلد \`npm install\` ثم \`npm run build\`. البرنامج في \`dist\\win-unpacked\`.
- **لتغيير التصميم:** افتح ملف التطبيق في Attune ← الأعمال ← «فتح ملف تطبيق».
`;
  const data = JSON.stringify({ attuneErp: 1, exported: now, ...pub, history: [] }, null, 2);
  return [
    { name: `${dir}/index.html`, data: html }, { name: `${dir}/manifest.webmanifest`, data: JSON.stringify(manifest, null, 2) },
    { name: `${dir}/sw.js`, data: sw }, { name: `${dir}/icon.svg`, data: icon }, { name: `${dir}/data/system.json`, data },
    { name: `${dir}/package.json`, data: JSON.stringify(pkg, null, 2) }, { name: `${dir}/main.js`, data: main }, { name: `${dir}/README.md`, data: readme },
  ];
}
export const projectZip = (sys, o) => zipStore(projectFiles(sys, o));
export const projectName = (sys) => slug(sys.name) + "-project.zip";
