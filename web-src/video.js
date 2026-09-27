/* ---- v5.38 — Video Downloader: a link → the video file on the phone, in the quality you pick ----
   Ali: "copy a link of a video and it downloads it with the quality I want". Only sites that allow
   downloading (Google Play removes apps that download from YouTube / TikTok / Instagram…): direct
   video / audio links, Google Drive and Dropbox shares, archive.org, Wikimedia Commons (144p–1080p
   versions), and web pages that show a plain video file. Code reads the page / the site's own API
   and lists the versions; Android's DownloadManager saves the file (Movies/Attune or Music/Attune)
   with a progress notification, and keeps going when Attune is closed. Tests: tests/unit/v538.test.mjs. */

export const MEDIA_EXT = /\.(mp4|m4v|webm|mkv|mov|avi|3gp|ogv|mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:$|[?#])/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(?:$|[?#])/i;

// Sites whose terms forbid downloading — Google Play removes apps that do it.
const BLOCKED = [
  [/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i, "YouTube"], [/(^|\.)tiktok\.com$/i, "TikTok"], [/(^|\.)(instagram\.com|instagr\.am)$/i, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/i, "Facebook"], [/(^|\.)(x\.com|twitter\.com|t\.co)$/i, "X"], [/(^|\.)snapchat\.com$/i, "Snapchat"],
  [/(^|\.)(netflix\.com|shahid\.mbc\.net|osn\.com|primevideo\.com|disneyplus\.com|watchit\.com|anghami\.com|spotify\.com)$/i, "a streaming service"],
  [/(^|\.)(vimeo\.com)$/i, "Vimeo"], [/(^|\.)(dailymotion\.com|dai\.ly|twitch\.tv|kick\.com|threads\.net|pinterest\.com|reddit\.com|v\.redd\.it|linkedin\.com)$/i, "this site"],
];

/** The first link in pasted text (a share often adds a title before the link). */
export function linkIn(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"'»«]+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, "") : null;
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return ""; } };

/** What kind of link this is: {kind, url, id?, site?} — kind = blocked | direct | drive | dropbox | archive | commons | page | bad. */
export function classify(raw) {
  const url = linkIn(raw) || String(raw || "").trim();
  let u; try { u = new URL(url); } catch (e) { return { kind: "bad" }; }
  if (!/^https?:$/.test(u.protocol)) return { kind: "bad" };
  const h = u.hostname.replace(/^www\./, "");
  for (const [re, site] of BLOCKED) if (re.test(h)) return { kind: "blocked", site, url };
  if (/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$/.test(h)) {
    const id = (u.pathname.match(/\/file\/d\/([\w-]{10,})/) || [])[1] || u.searchParams.get("id");
    if (id) return { kind: "drive", id, url };
  }
  if (/(^|\.)dropbox\.com$|dropboxusercontent\.com$/.test(h)) { u.searchParams.delete("dl"); u.searchParams.set("dl", "1"); return { kind: "dropbox", url: u.toString() }; }
  if (/(^|\.)archive\.org$/.test(h)) { const id = (u.pathname.match(/^\/(?:details|download|embed)\/([^/?#]+)/) || [])[1]; if (id) return { kind: "archive", id: decodeURIComponent(id), url }; }
  if (/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/.test(h)) {
    const f = decodeURIComponent(u.pathname).match(/\/wiki\/(?:File|Datei|Fichier|Archivo|ملف):(.+)$/) || decodeURIComponent(u.hash || "").match(/#\/media\/(?:File|ملف):(.+)$/);
    if (f) return { kind: "commons", title: "File:" + f[1].replace(/_/g, " "), url };
  }
  if (/\.m3u8(?:$|[?#])/i.test(u.pathname)) return { kind: "stream", url };
  if (MEDIA_EXT.test(u.pathname)) return { kind: "direct", url };
  return { kind: "page", url };
}

export const driveUrl = (id) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;

/** Google Drive's "can't scan this file for viruses — download anyway" page → the real download link. */
export function driveConfirm(html, base) {
  const f = String(html || "").match(/<form[^>]*id="download-form"[^>]*action="([^"]+)"[^>]*>([\s\S]*?)<\/form>/i);
  if (f) {
    const q = new URLSearchParams();
    for (const m of f[2].matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) { const n = (m[0].match(/name="([^"]+)"/) || [])[1], v = (m[0].match(/value="([^"]*)"/) || [])[1]; if (n) q.set(n, unesc(v || "")); }
    return new URL(unesc(f[1]), base || "https://drive.google.com/").toString().split("?")[0] + "?" + q.toString();
  }
  const a = String(html || "").match(/href="(\/uc\?export=download[^"]*confirm=[^"]+)"/);
  return a ? new URL(unesc(a[1]), "https://drive.google.com").toString() : null;
}
const unesc = (s) => String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\\u0026/g, "&").replace(/\\u003d/g, "=").replace(/\\\//g, "/");

/** A resolution from a name / label ("…_720p.mp4", "1080", "HD"). */
export function heightOf(s) {
  const t = String(s || "");
  const p = t.match(/(?:^|[^\d])(2160|1440|1080|720|576|540|480|360|288|240|144)[pP]?(?:[^\d]|$)/);
  if (p) return +p[1];
  const wh = t.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/); if (wh) return Math.min(+wh[1], +wh[2]);
  if (/\b4k\b|uhd/i.test(t)) return 2160; if (/\bfhd|full.?hd/i.test(t)) return 1080; if (/\bhd\b/i.test(t)) return 720; if (/\bsd\b/i.test(t)) return 480;
  return 0;
}
const extOf = (u) => ((String(u).split(/[?#]/)[0].match(/\.([a-z0-9]{2,4})$/i) || [])[1] || "").toLowerCase();

/** A web page → the video / audio files it shows (og:video, <video>/<source>, JSON-LD contentUrl, plain links). */
export function pageChoices(html, base) {
  const h = String(html || ""), out = [], seen = new Set();
  const title = unesc(((h.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || h.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "").trim());
  const add = (src, label, extra = {}) => {
    if (!src) return;
    let u; try { u = new URL(unesc(src).trim(), base).toString(); } catch (e) { return; }
    if (!/^https?:/.test(u) || seen.has(u)) return;
    const c = classify(u);
    if (c.kind === "stream") { out.hls = true; return; }
    if (c.kind !== "direct" && !extra.type) return;
    if (extra.type && !/^(video|audio)\//.test(extra.type) && c.kind !== "direct") return;
    seen.add(u);
    const audio = AUDIO_EXT.test(u) || /^audio\//.test(extra.type || "");
    out.push({ url: u, height: extra.height || heightOf(label) || heightOf(u), ext: extOf(u) || (extra.type || "").split("/")[1] || "mp4", audio, size: extra.size || 0, label: label || "" });
  };
  for (const m of h.matchAll(/<meta[^>]+(?:property|name)="(og:video(?::secure_url|:url)?|twitter:player:stream|og:audio(?::secure_url)?)"[^>]*>/gi)) {
    const c = (m[0].match(/content="([^"]+)"/i) || [])[1];
    const ht = +((h.match(/<meta[^>]+property="og:video:height"[^>]+content="(\d+)"/i) || [])[1] || 0);
    add(c, "", { height: /audio/.test(m[1]) ? 0 : ht });
  }
  for (const m of h.matchAll(/<(video|audio|source)\b[^>]*>/gi)) {
    const t = m[0], src = (t.match(/\ssrc="([^"]+)"/i) || t.match(/\ssrc='([^']+)'/i) || [])[1];
    const label = [(t.match(/\s(?:label|title|res|size|data-res|data-quality|data-label)="([^"]+)"/i) || [])[1]].filter(Boolean).join(" ");
    const type = (t.match(/\stype="([^"]+)"/i) || [])[1];
    add(src, label, { type: type && /^(video|audio)\//.test(type) ? type : undefined, height: +((t.match(/\s(?:res|size|data-res|height)="(\d{3,4})"/i) || [])[1] || 0) });
  }
  for (const m of h.matchAll(/"contentUrl"\s*:\s*"([^"]+)"/g)) add(m[1].replace(/\\\//g, "/"), "");
  for (const m of h.matchAll(/(?:href|src|data-src|file|url)\s*[=:]\s*["']([^"']+\.(?:mp4|m4v|webm|mov|mp3|m4a|ogg|ogv)(?:\?[^"']*)?)["']/gi)) add(m[1], "");
  out.title = title;
  return out;
}

const AR_VIDEO = /^(h\.264|h\.264 hd|h\.264 ia|mpeg4|512kb mpeg4|ogg video|webm|matroska|quicktime|cinepack|mpeg2|mpeg1|hires mpeg4|720p|1080p)$/i;
const AR_AUDIO = /^(vbr mp3|128kbps mp3|64kbps mp3|ogg vorbis|flac|apple lossless audio|wave|m4a)$/i;
/** archive.org's metadata (https://archive.org/metadata/ID) → its video and audio files. */
export function archiveChoices(meta, id) {
  const files = (meta && meta.files) || [];
  const out = [];
  for (const f of files) {
    const fmt = String(f.format || "");
    const video = AR_VIDEO.test(fmt), audio = AR_AUDIO.test(fmt);
    if (!video && !audio) continue;
    out.push({ url: `https://archive.org/download/${encodeURIComponent(id)}/${String(f.name).split("/").map(encodeURIComponent).join("/")}`,
      height: video ? (+f.height || heightOf(f.name) || heightOf(fmt) || (/512kb/i.test(fmt) ? 240 : 0)) : 0, ext: extOf(f.name), audio, size: +f.size || 0, label: fmt, name: f.name });
  }
  out.title = (meta && meta.metadata && [].concat(meta.metadata.title || "")[0]) || id;
  return out;
}

/** Wikimedia Commons' videoinfo (the original + its 144p–1080p versions) → choices. */
export function commonsChoices(api) {
  const page = Object.values((api && api.query && api.query.pages) || {})[0] || {};
  const vi = (page.videoinfo || page.imageinfo || [])[0];
  if (!vi) return Object.assign([], { title: page.title || "" });
  const out = [];
  const audio = /^audio\//.test(vi.mime || "");
  out.push({ url: vi.url, height: audio ? 0 : Math.min(vi.width || 0, vi.height || 0) || vi.height || 0, ext: extOf(vi.url), audio, size: vi.size || 0, label: "Original" });
  for (const d of vi.derivatives || []) {
    if (!d.src || d.src === vi.url) continue;
    const a = /^audio\//.test(d.type || "");
    out.push({ url: d.src, height: a ? 0 : +(d.height || heightOf(d.transcodekey)) || 0, ext: extOf(d.src), audio: a, size: 0, label: d.transcodekey || d.shorttitle || "" });
  }
  out.title = String(page.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
  return out;
}
export const commonsApi = (title) => `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=videoinfo&viprop=url|size|mime|derivatives&titles=${encodeURIComponent(title)}`;

/** Best first: videos by height (bigger first; MP4 before WebM at the same height), then audio. Duplicates dropped. */
export function sortChoices(list) {
  const seen = new Set();
  const rank = (c) => (c.audio ? -1 : c.height || 1) * 10 + (c.ext === "mp4" ? 2 : c.ext === "webm" ? 1 : 0);
  return [...list].sort((a, b) => rank(b) - rank(a) || (b.size || 0) - (a.size || 0))
    .filter((c) => { const k = (c.audio ? "a" : c.height) + ":" + c.ext + ":" + (c.size || c.url); if (seen.has(k)) return false; seen.add(k); return true; });
}

export const sizeText = (n) => (!n ? "" : n >= 1e9 ? (n / 1e9).toFixed(2) + " GB" : n >= 1e6 ? Math.round(n / 1e6) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");
export function qualityText(c) {
  if (c.audio) return "Audio only";
  const h = c.height;
  return h >= 2160 ? "4K (2160p)" : h >= 1440 ? "1440p" : h ? h + "p" : "Video";
}

/** A safe file name: the title (or the link's file name) + the right extension. */
export function fileName(title, c) {
  const ext = c.ext || (c.audio ? "mp3" : "mp4");
  let base = String(title || "").trim() || decodeURIComponent((String(c.url).split(/[?#]/)[0].split("/").pop() || "video")).replace(/\.[a-z0-9]{2,4}$/i, "");
  base = base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "video";
  const q = c.audio ? "" : c.height ? " " + c.height + "p" : "";
  return base + q + "." + ext;
}
