/* ---- v6.40 (upgrade W5) — Prompt lab: two versions of a prompt run on the same text with the phone's model, side by side
   (time, length), the better one kept in your own prompts (Tools → Library → Mine). Pure helpers; tests/unit/v740promptlab. */
export const MINE_KEY = "attune:prompts:mine:v1";
/** The test text goes where the prompt says {input} / {{input}} / [text] / [paste here]; else after the prompt. */
export function fill(prompt, input) {
  const p = String(prompt || ""), t = String(input || "").trim();
  if (!t) return p;
  const re = /\{\{?\s*(input|text|message|email)\s*\}?\}|\[(?:text|input|paste (?:it|text)? ?here|your text)\]/gi;
  return re.test(p) ? p.replace(re, t) : p + "\n\n" + t;
}
/** Which answer the person is likely to prefer by plain measures (the person still decides). */
export function compare(a, b) {
  const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
  return { a: { words: words(a.text), ms: a.ms || 0 }, b: { words: words(b.text), ms: b.ms || 0 }, faster: (a.ms || 0) <= (b.ms || 0) ? "a" : "b", shorter: words(a.text) <= words(b.text) ? "a" : "b" };
}
export function loadMine(s = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((s && s.getItem(MINE_KEY)) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
export function keep(prompt, title, s = typeof localStorage !== "undefined" ? localStorage : null, now = Date.now()) {
  const t = String(title || "").trim() || String(prompt).split("\n")[0].slice(0, 50);
  const list = [{ id: "p" + now.toString(36), title: t, template: String(prompt), created: now }, ...loadMine(s).filter((x) => x.template !== prompt)].slice(0, 60);
  try { s && s.setItem(MINE_KEY, JSON.stringify(list)); } catch (e) {}
  return list;
}
