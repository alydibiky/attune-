// Knowledge packs and country maps on the desktop — the same published files and the same search as the phone
// (KnowPacks.kt, MapPacks.kt), so a pack built once by GitHub Actions works on both:
//   know-<id>-v2/manifest.json + <id>.sqlite.gz      passages + FTS4 key → searched with BM25 from matchinfo
//   map-<code>/<code>-manifest.json + .pmtiles + -places.sqlite (+ optional -route.bin), map-assets (fonts, icons)
// Data root: <userData>/know/<id>/ and <userData>/maps/<code>/. Downloads resume (HTTP Range), are checked
// (SHA-256) and swapped in only when complete, so the old pack keeps working during an update.
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");
let sqlite = null;
try { sqlite = require("node:sqlite"); } catch (e) { /* older runtime: packs can be downloaded, not searched */ }

const BASE = "https://github.com/alydibiky/attune-/releases/download/";
const KID = /^[a-z][a-z0-9-]{1,20}$/, CODE = /^[a-z]{2,4}$/, NAME = /^[a-z0-9._-]{1,80}$/;
class Cancelled extends Error { constructor() { super("Cancelled"); } }

function makePacks({ data, online, fetch: f }) {
  const FETCH = f || ((...a) => fetch(...a));
  const KROOT = path.join(data, "know"), MROOT = path.join(data, "maps");
  fs.mkdirSync(KROOT, { recursive: true }); fs.mkdirSync(MROOT, { recursive: true });
  const UA = "Attune (desktop)";

  async function getJson(url, what) {
    online(url, what);
    const r = await FETCH(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (r.status === 404) throw new Error(what === "map" ? "This map is not published yet — run \"Build a country map\" on GitHub for it once" : "This pack is not published yet — run \"Build a knowledge pack\" on GitHub once");
    if (!r.ok) throw new Error("The server returned HTTP " + r.status);
    const t = await r.text(); if (t.length > 1_000_000) throw new Error("The list is too big");
    return JSON.parse(t);
  }

  /** Downloads url into part, continuing an earlier try (Range); onBytes(got) every `every` bytes. */
  async function fetchResumable(url, part, size, isCancelled, onBytes, every = 2_000_000, what = "map") {
    let from = fs.existsSync(part) ? fs.statSync(part).size : 0;
    if (from > size) { fs.unlinkSync(part); from = 0; }
    if (from === size) { onBytes(size); return; }
    online(url, what);
    const r = await FETCH(url, { headers: { "User-Agent": UA, ...(from ? { Range: "bytes=" + from + "-" } : {}) }, redirect: "follow" });
    if (r.status === 404) throw new Error("Not published yet");
    if (!r.ok) throw new Error("The download returned HTTP " + r.status);
    if (r.status === 200 && from > 0) { from = 0; try { fs.unlinkSync(part); } catch (e) {} }
    const out = fs.createWriteStream(part, { flags: from ? "a" : "w" });
    let got = from, last = got;
    try {
      for await (const chunk of r.body) {
        if (isCancelled()) throw new Cancelled();
        if (!out.write(chunk)) await new Promise((res) => out.once("drain", res));
        got += chunk.length;
        if (got - last > every) { last = got; onBytes(got); }
      }
    } finally { await new Promise((res) => out.end(res)); }
    onBytes(got);
    if (fs.statSync(part).size !== size) throw new Error("The download stopped early — tap Download again to continue");
  }
  async function sha256(file) {
    const h = crypto.createHash("sha256");
    await pipeline(fs.createReadStream(file), h);
    return h.digest("hex");
  }
  async function verify(file, want, name) {
    if (!want) return;
    if ((await sha256(file)) !== want.toLowerCase()) { try { fs.unlinkSync(file); } catch (e) {} throw new Error(name + " arrived damaged — download it again"); }
  }
  const rmrf = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} };

  // ---- normalisation: the same as MapPacks.normalize / offlinemap.js / the Python builders ----
  function normalize(s) {
    let t = String(s || "").toLowerCase().replace(/ٰ/g, "ا")
      .replace(/[ً-ْـۖ-ۭ]/g, "")
      .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ı/g, "i");
    t = t.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6F0));
    t = t.normalize("NFD").replace(/\p{Mn}+/gu, "");
    return t.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }

  // =================================== Knowledge packs ===================================
  const kdir = (id) => { if (!KID.test(id)) throw new Error("Unknown pack"); return path.join(KROOT, id); };
  function knowList() {
    const out = [];
    for (const name of fs.readdirSync(KROOT)) {
      if (!KID.test(name)) continue;
      const d = path.join(KROOT, name), man = path.join(d, "manifest.json"), db = path.join(d, name + ".sqlite");
      if (!fs.existsSync(man) || !fs.existsSync(db)) continue;
      try { out.push({ ...JSON.parse(fs.readFileSync(man, "utf8")), installed: true, size: fs.statSync(db).size }); } catch (e) {}
    }
    return out;
  }
  const knowRemote = (id) => { if (!KID.test(id)) throw new Error("Unknown pack"); return getJson(BASE + "know-" + id + "-v2/manifest.json", "knowledge pack"); };
  const openDbs = new Map();
  function handle(id) {
    if (openDbs.has(id)) return openDbs.get(id);
    const f = path.join(kdir(id), id + ".sqlite"); if (!fs.existsSync(f) || !sqlite) return null;
    const db = new sqlite.DatabaseSync(f, { readOnly: true }); openDbs.set(id, db); return db;
  }
  function closeDb(id) { const d = openDbs.get(id); if (d) { try { d.close(); } catch (e) {} openDbs.delete(id); } }

  async function knowInstall(id, onProgress, isCancelled) {
    const man = await knowRemote(id);
    const files = man.files || [];
    const total = files.reduce((s, x) => s + x.bytes, 0);
    onProgress(0, total, "");
    const next = path.join(KROOT, id + ".next"); rmrf(next); fs.mkdirSync(next, { recursive: true });
    let done = 0;
    for (const fl of files) {
      if (!NAME.test(fl.name)) throw new Error("Unexpected file in the pack: " + fl.name);
      const part = path.join(KROOT, id + "-" + fl.name + ".part"); const base = done;
      await fetchResumable(BASE + "know-" + id + "-v2/" + fl.name, part, fl.bytes, isCancelled, (got) => onProgress(base + got, total, fl.name), 262_144, "knowledge pack");
      await verify(part, fl.sha256, fl.name);
      const target = path.join(next, id + ".sqlite");
      if (fl.gz) { await pipeline(fs.createReadStream(part), zlib.createGunzip(), fs.createWriteStream(target)); fs.unlinkSync(part); }
      else fs.renameSync(part, target);
      done += fl.bytes; onProgress(done, total, fl.name);
    }
    fs.writeFileSync(path.join(next, "manifest.json"), JSON.stringify(man));
    closeDb(id);
    const d = kdir(id), old = path.join(KROOT, id + ".old"); rmrf(old);
    if (fs.existsSync(d)) fs.renameSync(d, old);
    try { fs.renameSync(next, d); } catch (e) { if (fs.existsSync(old)) fs.renameSync(old, d); throw new Error("Couldn't install the pack"); }
    rmrf(old);
    return { ...man, installed: true };
  }
  function knowRemove(id) { try { closeDb(id); rmrf(kdir(id)); return true; } catch (e) { return false; } }

  const STOP = new Set(("the a an of in on at to for and or is are was were be by with from as that this these those it its into about what which who whom " +
    "whose when where why how do does did can could will would should may might than then there their them they he she his her you your i we our not no " +
    "tell me please explain word words mean means meaning say says said define روي قال يقول في من على عن الى هو هي ما ماذا متى اين كيف كم هل التي الذي الذين او ثم مع كان كانت هذا هذه ذلك تلك").split(" "));
  function stem(w) {
    if (w.length <= 4 || !/^[a-z]+$/.test(w)) return w;
    for (const suf of ["ies", "ing", "ed", "es", "s"]) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
    return w;
  }
  const ints = (blob) => { const b = Buffer.from(blob); const out = new Int32Array(b.length / 4); for (let i = 0; i < out.length; i++) out[i] = b.readInt32LE(i * 4); return out; };
  const ENDINGS = new Set(["s", "es", "ed", "er", "ing"]);
  const near = (x, w) => x === w || (x.startsWith(w) && ENDINGS.has(x.slice(w.length)));
  const QUOTE = /«([^»]{6,200})»|“([^”]{6,200})”|"([^"]{6,200})"|﴿([^﴾]{6,200})﴾|(?<![A-Za-z])'([^']{3,60})'(?![A-Za-z])/g;
  function bm25(blob) {
    const ii = ints(blob); const p = ii[0], c = ii[1], n = ii[2];
    const avg = Math.max(1, ii[3]), len = ii[3 + c], x0 = 3 + 2 * c;
    let s = 0;
    for (let i = 0; i < p; i++) {
      const o = x0 + 3 * (i * c); const tf = ii[o], df = ii[o + 2];
      if (tf <= 0) continue;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      s += idf * (tf * 2.4) / (tf + 1.4 * (0.75 + 0.25 * len / avg));
    }
    return s;
  }

  /** {q, k, ids?} → {passages: [...]} best first — KnowPacks.search, line for line (tests/trials/packsearch.py is the third copy). */
  function knowSearch(a) {
    const q = String(a.q || "");
    const words = [...new Set(normalize(q).split(" ").filter((w) => w.length >= 2 && !STOP.has(w)).map(stem))].slice(0, 10);
    if (!words.length) return { passages: [] };
    const k = Math.max(1, Math.min(60, a.k || 24));
    const only = Array.isArray(a.ids) ? new Set(a.ids) : null;
    const phr = words.map((w) => w.replace(/"/g, "") + "*");
    const orAll = phr.join(" OR ");
    const phrases = [...q.matchAll(QUOTE)].map((m) => m.slice(1).find((x) => x)).filter(Boolean)
      .map((x) => normalize(x).split(" ").filter((w) => w).slice(0, 12)).filter((x) => x.length >= 2 || (x.length === 1 && x[0].length >= 5)).map((x) => x.join(" ")).slice(0, 2);
    const qt = normalize(q).split(" ").filter((w) => w);
    const ci = qt.map((w, i) => (w.length >= 2 && !STOP.has(w) ? i : -1)).filter((i) => i >= 0);
    const soft = !phrases.length && ci.length >= 2 && ci[ci.length - 1] - ci[0] <= 3 ? qt.slice(ci[0], ci[ci.length - 1] + 1).join(" ") : null;
    const probes = [];
    for (const man of knowList()) {
      if (only && !only.has(man.id)) continue;
      try {
        const db = handle(man.id); if (!db) continue;
        const row = db.prepare("SELECT matchinfo(passages_fts, 'pcnalx') m FROM passages_fts WHERE passages_fts MATCH ? LIMIT 1").get(orAll);
        if (row) { const ii = ints(row.m); const cc = ii[1], x0 = 3 + 2 * cc; probes.push({ id: man.id, man, db, n: ii[2], df: Array.from({ length: ii[0] }, (_, i) => ii[x0 + 3 * (i * cc) + 2]) }); }
      } catch (e) {}
    }
    if (!probes.length) return { passages: [] };
    const bigN = Math.max(1, probes.reduce((s, p) => s + p.n, 0));
    const gidf = words.map((_, i) => Math.log(1 + bigN / Math.max(1, probes.reduce((s, p) => s + p.df[i], 0))));
    const tot = gidf.reduce((s, x) => s + x, 0);
    const hits = [];
    for (const pr of probes) {
      try {
        const order = words.map((_, i) => i).sort((x, y) => pr.df[x] - pr.df[y]);
        let rare = order.filter((i) => pr.df[i] > 0 && pr.df[i] <= Math.max(200, pr.n * 0.03));
        if (!rare.length) rare = order.filter((i) => pr.df[i] > 0).slice(0, 1);
        if (!rare.length) continue;
        if (rare.reduce((s, i) => s + pr.df[i], 0) > 6000) rare = rare.slice(0, 2);
        const qq = "(" + rare.map((i) => phr[i]).join(" OR ") + ") (" + orAll + ")";
        const nf = rare.length;
        const exact = new Set(), loose = new Set();
        for (const ph of phrases) for (const r of pr.db.prepare("SELECT rowid FROM passages_fts WHERE passages_fts MATCH ? LIMIT 60").all('"' + ph.replace(/"/g, "") + '"')) exact.add(Number(r.rowid));
        if (soft) for (const r of pr.db.prepare("SELECT rowid FROM passages_fts WHERE passages_fts MATCH ? LIMIT 200").all('"' + soft.replace(/"/g, "") + '"')) loose.add(Number(r.rowid));
        const cand = [], seen = new Set();
        const take = (rows, n0) => {
          for (const r of rows) {
            const rowid = Number(r.rowid); if (seen.has(rowid)) continue; seen.add(rowid);
            const ii = ints(r.m); const cc = ii[1];
            let cov = 0; for (let j = 0; j < words.length; j++) if (ii[3 + 2 * cc + 3 * ((n0 + j) * cc)] > 0) cov += gidf[j];
            cov /= tot;
            cand.push([rowid, bm25(r.m) * (0.3 + cov) * (0.3 + cov) * (exact.has(rowid) ? 3 : loose.has(rowid) ? 2 : 1), cov]);
          }
        };
        take(pr.db.prepare("SELECT rowid, matchinfo(passages_fts, 'pcnalx') m FROM passages_fts WHERE passages_fts MATCH ? LIMIT 6000").all(qq), nf);
        const missing = [...exact].filter((x) => !seen.has(x));
        if (missing.length) take(pr.db.prepare("SELECT rowid, matchinfo(passages_fts, 'pcnalx') m FROM passages_fts WHERE passages_fts MATCH ? AND rowid IN (" + missing.join(",") + ")").all("(" + orAll + ") (" + orAll + ")"), words.length);
        cand.sort((x, y) => y[1] - x[1]);
        const get = pr.db.prepare("SELECT title, text, url, lang FROM passages WHERE id = ?");
        for (const [rowid, sc, cov] of cand.slice(0, k * 3)) {
          const r = get.get(rowid); if (!r) continue;
          const title = r.title || "";
          const tw = normalize(title).split(" ").filter((w) => w);
          let tcov = 0; for (let j = 0; j < words.length; j++) if (tw.some((x) => near(x, words[j]))) tcov += gidf[j];
          tcov /= tot;
          const head = new Set(normalize(title.replace(/\([^)]*\)/g, " ").split(" — ")[0]).split(" ").filter((w) => w));
          const tprec = head.size ? [...head].filter((x) => words.some((w) => near(x, w))).length / head.size : 0;
          const score = sc * (1 + tcov) * (1 + tprec) * (1 + tprec);
          hits.push({ score, o: { pack: pr.id, id: pr.id + ":" + rowid, title, text: r.text || "", url: r.url || "", lang: r.lang || "", score, cov: Math.round(cov * 1000) / 1000,
            notice: pr.man.notice || "", notice_ar: pr.man.notice_ar || "" } });
        }
      } catch (e) {}
    }
    hits.sort((x, y) => y.score - x.score);
    return { passages: hits.slice(0, k).map((h) => h.o) };
  }

  /** A raw file of a know-* release ({tag, name}) → its text (the page's own small packs). */
  async function knowPackText(tag, name) {
    if (!/^know-[a-z0-9-]{1,40}$/.test(tag)) throw new Error("That is not a knowledge pack");
    if (!/^[a-z0-9._-]{1,60}$/.test(name)) throw new Error("That is not a knowledge pack file");
    return releaseText(BASE + tag + "/" + name, name, "knowledge pack");
  }
  async function foodPackText(name) {
    if (!/^[a-z0-9._-]{1,60}$/.test(name)) throw new Error("That is not a food pack file");
    return releaseText(BASE + "food-pack-v1/" + name, name, "food pack");
  }
  async function releaseText(url, name, what) {
    online(url, what);
    const r = await FETCH(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    if (r.status === 404) throw new Error("Not published yet");
    if (!r.ok) throw new Error("The download returned HTTP " + r.status);
    let buf = Buffer.from(await r.arrayBuffer());
    if (name.endsWith(".gz")) buf = zlib.gunzipSync(buf);
    if (buf.length > 80_000_000) throw new Error("The file is too big");
    return buf.toString("utf8");
  }

  // =================================== Maps ===================================
  const mdir = (code) => { if (!CODE.test(code)) throw new Error("Unknown map"); return path.join(MROOT, code); };
  const isRoutes = (n) => n.endsWith("-route.bin");
  const isOnlineOnly = (n) => n.endsWith("-find.bin");   // v6.27: the places index in pieces, for searching online — never downloaded
  const assetsInstalled = () => fs.existsSync(path.join(MROOT, "assets", "assets-manifest.json"));
  function mapList() {
    const out = [];
    for (const name of fs.readdirSync(MROOT)) {
      if (!CODE.test(name)) continue;
      const d = path.join(MROOT, name), man = path.join(d, "manifest.json"); if (!fs.existsSync(man)) continue;
      try {
        const j = JSON.parse(fs.readFileSync(man, "utf8")); let bytes = 0, ok = true, routes = false;
        for (const fl of j.files || []) {
          const local = path.join(d, fl.name); const full = fs.existsSync(local) && fs.statSync(local).size === fl.bytes;
          if (isOnlineOnly(fl.name)) continue;
          if (isRoutes(fl.name)) { if (full) { routes = true; bytes += fl.bytes; } continue; }
          if (!full) ok = false; else bytes += fl.bytes;
        }
        if (ok) out.push({ ...j, bytes, installed: true, routes });
      } catch (e) {}
    }
    return out;
  }
  const mapRemote = (code) => { if (!CODE.test(code)) throw new Error("Unknown map"); return getJson(BASE + "map-" + code + "/" + code + "-manifest.json", "map"); };

  async function unzip(zipFile, into) {
    // the fonts-and-icons zip: stored or deflated entries (central directory read)
    const buf = fs.readFileSync(zipFile);
    let eocd = buf.length - 22; while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error("Bad map fonts file");
    const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
    const base = path.resolve(into) + path.sep;
    for (let i = 0; i < n; i++) {
      const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), loc = buf.readUInt32LE(p + 42);
      const name = buf.toString("utf8", p + 46, p + 46 + nlen); p += 46 + nlen + xlen + clen;
      const out = path.resolve(into, name);
      if (!out.startsWith(base)) throw new Error("Bad file in the map fonts");
      if (name.endsWith("/")) { fs.mkdirSync(out, { recursive: true }); continue; }
      const lnl = buf.readUInt16LE(loc + 26), lxl = buf.readUInt16LE(loc + 28);
      const data = buf.subarray(loc + 30 + lnl + lxl, loc + 30 + lnl + lxl + csize);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, method === 8 ? zlib.inflateRawSync(data) : data);
    }
  }

  async function mapInstall(code, onProgress, isCancelled, withRoutes = false) {
    const man = await mapRemote(code);
    const d = mdir(code);
    const hadRoutes = (man.files || []).some((fl) => isRoutes(fl.name) && fs.existsSync(path.join(d, fl.name)));
    const files = (man.files || []).filter((fl) => !isOnlineOnly(fl.name) && (!isRoutes(fl.name) || withRoutes || hadRoutes));
    const assetsMan = assetsInstalled() ? null : await getJson(BASE + "map-assets/assets-manifest.json", "map");
    let total = files.reduce((s, x) => s + x.bytes, 0) + (assetsMan ? assetsMan.files.reduce((s, x) => s + x.bytes, 0) : 0);
    let done = 0;
    if (assetsMan) {
      const tmp = path.join(MROOT, "assets.new"); rmrf(tmp); fs.mkdirSync(tmp, { recursive: true });
      for (const fl of assetsMan.files) {
        if (!NAME.test(fl.name)) throw new Error("Unexpected file in the map fonts: " + fl.name);
        const zip = path.join(MROOT, fl.name + ".part"); const base = done;
        await fetchResumable(BASE + "map-assets/" + fl.name, zip, fl.bytes, isCancelled, (got) => onProgress(base + got, total, fl.name));
        await verify(zip, fl.sha256, fl.name);
        await unzip(zip, tmp); fs.unlinkSync(zip);
        done += fl.bytes;
      }
      fs.writeFileSync(path.join(tmp, "assets-manifest.json"), JSON.stringify(assetsMan));
      const dest = path.join(MROOT, "assets"); rmrf(dest); fs.renameSync(tmp, dest);
    }
    const next = path.join(MROOT, code + ".next"); fs.mkdirSync(next, { recursive: true });
    for (const fl of files) {
      if (!NAME.test(fl.name)) throw new Error("Unexpected file in the map: " + fl.name);
      const target = path.join(next, fl.name); const base = done;
      if (!(fs.existsSync(target) && fs.statSync(target).size === fl.bytes)) {
        const part = target + ".part";
        if (!fl.parts) await fetchResumable(BASE + "map-" + code + "/" + fl.name, part, fl.bytes, isCancelled, (got) => onProgress(base + got, total, fl.name));
        else {
          let start = 0;
          for (const pk of fl.parts) {
            if (!NAME.test(pk.name)) throw new Error("Unexpected file in the map: " + pk.name);
            const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
            if (have < start) throw new Error("The map download is out of order — delete it and download again");
            if (have < start + pk.bytes) {
              // each part is downloaded on its own (resumable), then appended whole — so `part` only ever holds whole parts
              const tmpPart = part + "." + pk.name, s0 = start;
              await fetchResumable(BASE + "map-" + code + "/" + pk.name, tmpPart, pk.bytes, isCancelled, (got) => onProgress(base + s0 + got, total, fl.name));
              await pipeline(fs.createReadStream(tmpPart), fs.createWriteStream(part, { flags: "a" })); fs.unlinkSync(tmpPart);
            }
            start += pk.bytes;
          }
          if (fs.statSync(part).size !== fl.bytes) throw new Error("The map download stopped early — tap Download again to continue");
        }
        await verify(part, fl.sha256, fl.name);
        fs.renameSync(part, target);
      }
      done += fl.bytes; onProgress(done, total, fl.name);
    }
    fs.writeFileSync(path.join(next, "manifest.json"), JSON.stringify(man));
    const trash = path.join(MROOT, code + ".old"); rmrf(trash);
    if (fs.existsSync(d)) fs.renameSync(d, trash);
    try { fs.renameSync(next, d); } catch (e) { if (fs.existsSync(trash)) fs.renameSync(trash, d); throw new Error("Couldn't install the map"); }
    rmrf(trash);
    return { ...man, installed: true };
  }

  // ---- v6.27: a country's map read ONLINE without downloading it (only the pieces on screen, HTTP range requests to the
  // same free GitHub release); files over 1.9 GB come in parts and the offset is mapped onto the right part.
  const manifests = new Map();
  async function manifestCached(code) {
    const had = manifests.get(code);
    if (had && Date.now() - had.at < 6 * 3600e3) return had.m;
    const m = await mapRemote(code); manifests.set(code, { at: Date.now(), m }); return m;
  }
  async function getRange(url, off, len) {
    online(url, "map");
    const r = await FETCH(url, { headers: { "User-Agent": UA, Range: "bytes=" + off + "-" + (off + len - 1) }, redirect: "follow" });
    if (r.status !== 206) throw new Error(r.status === 404 ? "This map is not published yet" : "The map server returned HTTP " + r.status);
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length !== len) throw new Error("The map piece came back short");
    return b;
  }
  /** {code, name, offset, length (≤ 4 MB)} → {b64} */
  async function mapRange(a) {
    const code = String(a.code || ""), name = String(a.name || "");
    if (!CODE.test(code) || !NAME.test(name)) throw new Error("Unknown map");
    const off = Math.max(0, Number(a.offset) || 0), len = Math.min(4_000_000, Math.max(1, Number(a.length) || 0));
    const f = ((await manifestCached(code)).files || []).find((x) => x.name === name);
    if (!f) throw new Error("Unknown map file");
    const end = Math.min(off + len, f.bytes);
    if (end <= off) return { b64: "" };
    const bufs = [];
    if (!f.parts) bufs.push(await getRange(BASE + "map-" + code + "/" + name, off, end - off));
    else {
      let start = 0;
      for (const p of f.parts) {
        const a0 = Math.max(off, start), a1 = Math.min(end, start + p.bytes);
        if (a1 > a0) { if (!NAME.test(p.name)) throw new Error("Unknown map file"); bufs.push(await getRange(BASE + "map-" + code + "/" + p.name, a0 - start, a1 - a0)); }
        start += p.bytes;
      }
    }
    return { b64: Buffer.concat(bufs).toString("base64") };
  }
  /** v6.27: the map fonts and icons only (a few MB, once) — before a country is shown online. */
  let assetsBusy = null;
  async function mapAssets() {
    if (assetsInstalled()) return { assets: true };
    if (!assetsBusy) assetsBusy = (async () => {
      const assetsMan = await getJson(BASE + "map-assets/assets-manifest.json", "map");
      const tmp = path.join(MROOT, "assets.new"); rmrf(tmp); fs.mkdirSync(tmp, { recursive: true });
      for (const fl of assetsMan.files) {
        if (!NAME.test(fl.name)) throw new Error("Unexpected file in the map fonts: " + fl.name);
        const zip = path.join(MROOT, fl.name + ".part");
        await fetchResumable(BASE + "map-assets/" + fl.name, zip, fl.bytes, () => false, () => {});
        await verify(zip, fl.sha256, fl.name);
        await unzip(zip, tmp); fs.unlinkSync(zip);
      }
      fs.writeFileSync(path.join(tmp, "assets-manifest.json"), JSON.stringify(assetsMan));
      const dest = path.join(MROOT, "assets"); rmrf(dest); fs.renameSync(tmp, dest);
    })().finally(() => { assetsBusy = null; });
    await assetsBusy; return { assets: true };
  }

  async function mapInstallRoutes(code, onProgress, isCancelled) {
    const d = mdir(code);
    if (!fs.existsSync(path.join(d, "manifest.json"))) throw new Error("Download the map of this country first");
    const man = await mapRemote(code);
    const fl = (man.files || []).find((x) => isRoutes(x.name));
    if (!fl) throw new Error("Directions for this country are not published yet");
    if (!NAME.test(fl.name)) throw new Error("Unexpected file in the map: " + fl.name);
    const target = path.join(d, fl.name);
    if (!(fs.existsSync(target) && fs.statSync(target).size === fl.bytes)) {
      const part = target + ".part";
      await fetchResumable(BASE + "map-" + code + "/" + fl.name, part, fl.bytes, isCancelled, (got) => onProgress(got, fl.bytes, fl.name));
      await verify(part, fl.sha256, fl.name);
      try { fs.unlinkSync(target); } catch (e) {}
      fs.renameSync(part, target);
    }
    const local = JSON.parse(fs.readFileSync(path.join(d, "manifest.json"), "utf8"));
    local.files = (local.files || []).filter((x) => !isRoutes(x.name)).concat([fl]);
    fs.writeFileSync(path.join(d, "manifest.json"), JSON.stringify(local));
    onProgress(fl.bytes, fl.bytes, fl.name);
    return { code, routes: true, bytes: fl.bytes };
  }
  function mapRemove(code) { try { rmrf(mdir(code)); rmrf(path.join(MROOT, code + ".next")); return true; } catch (e) { return false; } }

  /** {path, offset, length} under maps/ → base64 ("" when missing). */
  function mapRead(a) {
    const rel = String(a.path || "");
    if (rel.includes("..") || rel.startsWith("/") || rel.includes("\\")) return "";
    const f = path.resolve(MROOT, rel);
    if (!f.startsWith(path.resolve(MROOT) + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return "";
    const size = fs.statSync(f).size;
    const off = Math.max(0, +a.offset || 0);
    let len = a.length == null || a.length < 0 ? Math.min(size - off, 8_000_000) : +a.length;
    len = Math.min(len, size - off, 32_000_000);
    if (len <= 0) return "";
    const fd = fs.openSync(f, "r"); const buf = Buffer.alloc(len);
    try { fs.readSync(fd, buf, 0, len, off); } finally { fs.closeSync(fd); }
    return buf.toString("base64");
  }

  function haversineKm(a1, o1, a2, o2) {
    const r = 6371, rad = Math.PI / 180, dLat = (a2 - a1) * rad, dLon = (o2 - o1) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a1 * rad) * Math.cos(a2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
  }
  function mapSearch(a) {
    const words = normalize(a.q || "").split(" ").filter((w) => w).slice(0, 6);
    const kinds = (Array.isArray(a.kinds) ? a.kinds : []).filter((k) => /^[a-z_]+\/[a-z_]+$/.test(k));
    if ((!words.length && !kinds.length) || !sqlite) return [];
    const limit = Math.max(1, Math.min(50, a.limit || 12));
    const lat = typeof a.lat === "number" ? a.lat : NaN, lon = typeof a.lon === "number" ? a.lon : NaN;
    const match = words.map((w) => w.replace(/"/g, "") + "*").join(" ");
    const hits = [];
    for (const p of mapList()) {
      const file = path.join(mdir(p.code), p.code + "-places.sqlite"); if (!fs.existsSync(file)) continue;
      let db = null;
      try {
        db = new sqlite.DatabaseSync(file, { readOnly: true });
        let rows;
        if (kinds.length && !isNaN(lat) && !isNaN(lon)) {
          const d = a.radiusDeg || 0.25;
          rows = db.prepare("SELECT name, name_ar, name_en, kind, lat, lon, rank FROM places WHERE kind IN (" + kinds.map(() => "?").join(",") + ") AND lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? LIMIT 2000").all(...kinds, lat - d, lat + d, lon - d, lon + d);
        } else rows = db.prepare("SELECT p.name, p.name_ar, p.name_en, p.kind, p.lat, p.lon, p.rank FROM places_fts f JOIN places p ON p.id = f.rowid WHERE f.key MATCH ? LIMIT 400").all(match);
        for (const r of rows) {
          const dist = isNaN(lat) || isNaN(lon) ? 0 : haversineKm(lat, lon, r.lat, r.lon);
          hits.push({ rank: r.rank || 0, dist, o: { name: r.name || "", name_ar: r.name_ar || "", name_en: r.name_en || "", kind: r.kind || "", lat: r.lat, lon: r.lon, code: p.code, dist: Math.round(dist * 10) / 10, rank: r.rank || 0 } });
        }
      } catch (e) {} finally { try { db && db.close(); } catch (e) {} }
    }
    if (kinds.length) hits.sort((x, y) => x.dist - y.dist);
    else hits.sort((x, y) => (Math.floor(y.rank / 10) - Math.floor(x.rank / 10)) || (x.dist - y.dist));
    return hits.slice(0, limit).map((h) => h.o);
  }

  return { normalize, knowList, knowRemote, knowInstall, knowRemove, knowSearch, knowPackText, foodPackText,
    mapList, mapRemote, mapInstall, mapInstallRoutes, mapRemove, mapRead, mapSearch, mapRange, mapAssets, assetsInstalled, Cancelled, sha256, canSearch: !!sqlite };
}

module.exports = { makePacks, Cancelled };
