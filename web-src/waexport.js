/* ---- v9.9.40 AP-1 (Ali OK'd K1 / EX-1, 14 Nov 2026: "export the chat … so it has the context"): reading a WhatsApp "Export chat"
   file (.txt). The approach — one header pattern for every date/time style, lines without a header joined to the message above,
   day-first vs month-first worked out from the dates themselves — comes from Pustur/whatsapp-chat-parser (MIT, © 2018 Loris
   Bettazza). Added here for Attune's people: Arabic exports (Arabic-Indic digits ١٤/١١/٢٠٢٦, the Arabic comma «،», «ص / م» for
   AM/PM, the invisible direction marks WhatsApp puts around them), Persian digits, the narrow no-break space before AM/PM, iPhone's
   [brackets] and its ‎"image omitted" lines, deleted messages and media in English and Arabic, and the chat's name from the file
   name ("WhatsApp Chat with Talabat.txt", «محادثة واتساب مع Talabat.txt»). Pure; tests: tests/waexport/gen.mjs (10,000 files).
   readExport(text, { fileName, dayFirst }) → { chat, messages: [{ ts, iso, author, text, kind }], members, from, to, dayFirst } */

const DIG = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
// WhatsApp's invisible marks (LRM, RLM, ALM, LRE…PDF, isolates) and the narrow / normal no-break spaces
const MARKS = /[‎‏؜‪-‮⁦-⁩]/g;
// (digits are made Latin only to READ the date and time — the message keeps its own digits: «٥٠٠ جنيه» stays as written)
const clean = (s) => String(s || "").replace(MARKS, "").replace(/[  ]/g, " ");

// [date][, or ، or nothing] time [am/pm or ص/م] ] [ - or : ] then the rest
const HEAD = /^\[?(\d{1,4}[-/.]\s?\d{1,2}[-/.]\s?\d{1,4})[,،.]?\s+(\d{1,2}[.:]\d{2}(?:[.:]\d{2})?)(?:\s?([AaPp]\.?\s?[Mm]\.?|ص|م|صباحًا|صباحا|مساءً|مساء))?\]?(?:\s[-–]\s?|:\s|\s)/;
const AUTHOR = /^(.{1,60}?):\s([\s\S]*)$/;
const MEDIA = /^<(?:Media omitted|media omitted)>$|^(?:image|video|audio|sticker|GIF|document|Contact card) omitted$|^<تم استبعاد الوسائط>$|^(?:تم استبعاد|الوسائط) .{0,20}$|^(?:صورة|فيديو|صوت|ملصق) (?:محذوف|مستبعد)$|\.(?:jpg|jpeg|png|webp|opus|mp4|pdf|vcf) \(file attached\)$|\(الملف مرفق\)$/i;
const DELETED = /^(?:This message was deleted|You deleted this message|تم حذف هذه الرسالة|لقد حذفت هذه الرسالة)\.?$/i;
const NULLMSG = /^null$/;

/** day-first or month-first, from the dates (a part over 12 decides); undefined when every date fits both */
function guessDayFirst(dates) {
  for (const [a, b] of dates) { if (a > 12 && a <= 31) return true; if (b > 12 && b <= 31) return false; }
  return undefined;
}
function parts(d) {
  const [x, y, z] = d.split(/[-/.]\s?/).map((v) => +v);
  return String(d.split(/[-/.]\s?/)[0]).length === 4 ? { y: x, a: z, b: y, ymd: true } : { y: z < 100 ? 2000 + z : z, a: x, b: y, ymd: false };
}
function hour24(h, ap) {
  if (!ap) return h;
  const pm = /^[pP]|^م|^مساء/.test(ap), am = /^[aA]|^ص/.test(ap);
  if (pm && h < 12) return h + 12;
  if (am && h === 12) return 0;
  return h;
}

/** The chat's name from the file name WhatsApp gives the export. */
export function chatNameOf(fileName = "") {
  const f = String(fileName || "").replace(/\.(txt|zip)$/i, "").replace(MARKS, "");
  const m = /(?:WhatsApp Chat (?:with|-)\s*|Chat de WhatsApp con\s*|Discussion WhatsApp avec\s*|WhatsApp-Chat mit\s*|Conversa do WhatsApp com\s*|محادثة واتساب مع\s*|دردشة واتساب مع\s*)(.+)$/i.exec(f);
  return (m ? m[1] : f).trim();
}

export function readExport(text, { fileName = "", dayFirst } = {}) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const raw = [];
  for (const line0 of lines) {
    const line = clean(line0).replace(/^﻿/, "");
    const h = HEAD.exec(DIG(line));   // the same length: a digit is one character either way
    if (h) raw.push({ date: h[1], time: h[2], ap: h[3] || "", rest: line.slice(h[0].length) });
    else if (raw.length) raw[raw.length - 1].rest += "\n" + clean(line0);
    // (lines before the first header — a BOM, an empty line — are skipped)
  }
  const ps = raw.map((r) => parts(r.date));
  const df = typeof dayFirst === "boolean" ? dayFirst : guessDayFirst(ps.filter((p) => !p.ymd).map((p) => [p.a, p.b]));
  const DF = df === undefined ? true : df;   // both fit (all days ≤ 12): day-first, as in Egypt and most of the world
  const out = [], members = new Set();
  raw.forEach((r, i) => {
    const p = ps[i], day = p.ymd ? p.a : DF ? p.a : p.b, mon = p.ymd ? p.b : DF ? p.b : p.a;
    const [hh, mm, ss] = r.time.split(/[.:]/).map((v) => +v);
    const d = new Date(p.y, mon - 1, day, hour24(hh, r.ap), mm, ss || 0);
    if (isNaN(d.getTime()) || mon < 1 || mon > 12 || day < 1 || day > 31) return;
    const am = AUTHOR.exec(r.rest);
    // a system line has no "Name: " ("Noudy added Ali", "Messages and calls are end-to-end encrypted…"); a name may have dots
    // ("M. Mohamed Sayed"), brackets ("Dr Hazem (Admin , Address East)"), emoji or a phone number
    const isMsg = am && !/^(?:Messages and calls|الرسائل والمكالمات|Your security code|رمز الأمان|.{0,40}\b(?:added|removed|left|joined|changed (?:the|this)|created group)\b)/i.test(am[1]);
    const author = isMsg ? am[1].trim().replace(/^~\s?/, "") : null, body = (isMsg ? am[2] : r.rest).trim();
    const kind = !isMsg ? "system" : MEDIA.test(body) ? "media" : DELETED.test(body) ? "deleted" : NULLMSG.test(body) ? "media" : "text";
    if (author) members.add(author);
    const iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    out.push({ ts: d.getTime(), iso, author, text: body, kind });
  });
  return { chat: chatNameOf(fileName), messages: out, members: [...members], from: out.length ? out[0].iso : "", to: out.length ? out[out.length - 1].iso : "", dayFirst: DF };
}
