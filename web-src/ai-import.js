/* ---- v6.12: continue a conversation shared from another AI (Gemini, ChatGPT, Claude, Perplexity, Grok, Copilot…) -----------------
   Ali: "make it able to share a chat from Gemini or any AI, and the app reads it and understands the context"
   (example: https://share.gemini.google/M76X2XrLpG9c). A share link's page is an app that carries the conversation inside its
   scripts (Gemini: AF_initDataCallback blobs; ChatGPT: a React router stream of strings), so the page text is useless; the raw
   page is fetched natively (only these hosts) and the conversation's sentences are taken out of the scripts by code. Pasted
   text works too ("You said: … / Gemini said: …"). The result goes into the chat as context the model reads with every
   question. Pure logic; tests: tests/unit/v711aiimport.test.mjs.                                                               */

const HOSTS = [
  [/^(share\.gemini\.google|gemini\.google\.com|g\.co|bard\.google\.com)$/i, "Gemini", /\/(share|gemini\/share)\/|^\/[A-Za-z0-9_-]{6,}$/],
  [/^(chatgpt\.com|chat\.openai\.com)$/i, "ChatGPT", /\/share\//],
  [/^claude\.ai$/i, "Claude", /\/share\//],
  [/^(www\.)?perplexity\.ai$/i, "Perplexity", /\/(search|page)\//],
  [/^(grok\.com|x\.com)$/i, "Grok", /\/share|\/grok\/share/],
  [/^copilot\.microsoft\.com$/i, "Copilot", /\/shares?\//],
  [/^chat\.deepseek\.com$/i, "DeepSeek", /\/share\//],
  [/^poe\.com$/i, "Poe", /\/s\//],
  [/^(www\.)?meta\.ai$/i, "Meta AI", /\/(c|s)\//],
];
/** A share link in the text → { url, from } or null. */
export function shareLink(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"')]+/g) || [];
  for (const raw of m) {
    let u; try { u = new URL(raw.replace(/[.,;!?]+$/, "")); } catch (e) { continue; }
    for (const [h, from, path] of HOSTS) if (h.test(u.hostname) && path.test(u.pathname)) return { url: u.href, from };
  }
  return null;
}
export const SHARE_HOSTS = ["share.gemini.google", "gemini.google.com", "g.co", "chatgpt.com", "chat.openai.com", "claude.ai", "perplexity.ai", "www.perplexity.ai", "grok.com", "x.com", "copilot.microsoft.com", "chat.deepseek.com", "poe.com", "meta.ai", "www.meta.ai"];

const BOILER = /^(sign in|log in|sign up|cookie|privacy|terms|help|settings|gemini may display|chatgpt can make mistakes|check important info|learn more|report|copy link|share|new chat|google apps|opens in a new window|this conversation was|continue this conversation|get the app|try gemini|try chatgpt|explore gems|upgrade|about gemini|your privacy)/i;
const decodeJs = (s) => { try { return JSON.parse('"' + s.replace(/\\x([0-9a-fA-F]{2})/g, "\\u00$1").replace(/(^|[^\\])"/g, '$1\\"') + '"'); } catch (e) { return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\"); } };
const looksLikeProse = (t) => {
  const s = t.trim();
  if (s.length < 25 || !/\s/.test(s)) return false;
  if (/^(https?:|\/\/|data:|[\w-]+\.(js|css|png|svg|woff2?)\b)/i.test(s) || /^[\w$.]+\(/.test(s)) return false;
  if ((s.match(/[{}();=<>]/g) || []).length > s.length / 12) return false;   // code / markup
  if (/^[A-Za-z0-9+/=_-]{40,}$/.test(s)) return false;                          // ids / base64
  if (BOILER.test(s)) return false;
  const letters = (s.match(/[\p{L}]/gu) || []).length, words = (s.match(/[\p{L}\p{N}\s.,:;%()'’&\-–—/+]/gu) || []).length;
  return letters >= 12 && letters / s.length > 0.35 && words / s.length > 0.85;   // spec-heavy answers ("CNY 309,900") are prose too

};

/** Every prose string inside a page's scripts and body, in page order, without repeats → [text]. */
export function harvest(html) {
  const h = String(html || "");
  const out = [], seen = new Set();
  const push = (t) => { const s = t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); const k = s.slice(0, 160); if (!looksLikeProse(s) || seen.has(k)) return; seen.add(k); out.push(s); };
  // strings in scripts: "…" with escapes (JSON / JS literals, also double-escaped inside JSON-in-JSON)
  for (const sc of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    let body = sc[1];
    for (let pass = 0; pass < 2; pass++) {
      for (const m of body.matchAll(/"((?:[^"\\]|\\.){25,})"/g)) {
        const t = decodeJs(m[1]);
        if (/^\s*[[{]/.test(t) && /[\]}]\s*$/.test(t)) continue;   // a nested JSON blob: read in the next pass
        push(t);
      }
      // JSON inside a JSON string (Gemini's batchexecute): unescape once and look again
      if (!/\\"/.test(body)) break;
      body = body.replace(/\\\\"/g, "\u0001").replace(/\\"/g, '"').replace(/\u0001/g, '\\"').replace(/\\\\n/g, "\\n");
    }
  }
  // visible text (server-rendered shares)
  const vis = h.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6]|pre|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  for (const para of vis.split(/\n\s*\n|\n(?=\S)/)) push(para.replace(/[ \t]+/g, " "));
  return out;
}
/** The page title / first question (og:title, og:description) when the page has them. */
export function metaOf(html) {
  const g = (p) => ((String(html || "").match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, "i")) || [])[1] || "").trim();
  const ent = (x) => String(x || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return { title: ent(g("og:title") || ((String(html || "").match(/<title>([^<]*)<\/title>/i) || [])[1] || "").trim()), description: ent(g("og:description")) };
}

/** Pasted conversation text → turns. Knows "You said:", "Gemini said:", "ChatGPT said:", "User:", "Assistant:", "Q:", "A:". */
export function turnsFromText(text) {
  const t = String(text || "").replace(/\r/g, "");
  const re = /^(?:\s*)(you said|i said|me|user|human|q|السؤال|انت قلت|أنت|(?:gemini|chatgpt|claude|copilot|perplexity|grok|deepseek|assistant|ai|a|model|الذكاء الاصطناعي) said|gemini|chatgpt|claude|assistant|ai|a)\s*[:：]\s*/gim;
  const marks = [...t.matchAll(re)];
  if (marks.length < 2) return null;
  const turns = [];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : t.length;
    const body = t.slice(m.index + m[0].length, end).trim();
    if (body) turns.push({ role: /^(you said|i said|me|user|human|q|السؤال|انت قلت|أنت)$/i.test(m[1].trim()) ? "user" : "assistant", text: body });
  });
  return turns.length >= 2 ? turns : null;
}
/** Does this pasted text look like a conversation with an AI? */
export const looksLikeChat = (text) => String(text || "").length > 200 && !!turnsFromText(text);

/** The context block the model reads with every question (fitted to `max` characters, the end kept when cut). */
export function contextBlock(imp, max = 9000) {
  const body = imp.turns ? imp.turns.map((x) => (x.role === "user" ? "USER: " : "ASSISTANT: ") + x.text).join("\n\n") : imp.parts.join("\n\n");
  const cut = body.length > max ? "…(earlier part shortened)…\n" + body.slice(body.length - max) : body;
  return `EARLIER CONVERSATION the user had with ${imp.from} (imported by the user — read it as context; the user may ask about it, ask you to check it, or continue it). ${imp.title ? "Title: " + imp.title + "." : ""}\n<<<\n${cut}\n>>>`;
}

/** A fetched share page → the import { from, url, title, parts, turns? }, or throws when nothing readable was found. */
export function fromPage(html, link) {
  const meta = metaOf(html), parts = harvest(html);
  const keep = parts.filter((p) => !/^(gemini|chatgpt|claude|perplexity|grok|copilot|deepseek|poe|meta ai)\b.{0,40}$/i.test(p));
  const total = keep.join("").length;
  if (total < 120) throw new Error("This share page didn't include the conversation (it may need a sign-in, or be private). Open it, copy the conversation, and paste it here.");
  const title = meta.title && !/^(gemini|chatgpt|claude|google gemini)$/i.test(meta.title) ? meta.title.replace(/\s*[-|–]\s*(Gemini|ChatGPT|Claude)\s*$/i, "") : (meta.description || keep[0] || "").slice(0, 80);
  return { from: link.from, url: link.url, title, parts: keep.slice(0, 400), chars: total };
}
/** Pasted text → the import. */
export function fromText(text, from = "") {
  const turns = turnsFromText(text);
  const fromName = from || (/gemini/i.test(text) ? "Gemini" : /chatgpt/i.test(text) ? "ChatGPT" : /claude/i.test(text) ? "Claude" : "another AI");
  return { from: fromName, url: "", title: (turns ? turns[0].text : String(text)).split("\n")[0].slice(0, 80), parts: turns ? null : [String(text).trim()], turns, chars: String(text).length };
}
