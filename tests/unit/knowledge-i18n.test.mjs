// Every tr("…") string on the Knowledge screen, its chips in Chat and Ask a PDF's button has an Arabic entry with no Latin letters.
import assert from "node:assert/strict";
import fs from "node:fs";
import { AR } from "../../web-src/i18n-ar.js";
const src = ["knowledge-ui.jsx"].map((f) => fs.readFileSync(new URL("../../web-src/" + f, import.meta.url), "utf8")).join("\n");
const keys = new Set([...src.matchAll(/tr\("((?:[^"\\]|\\.)+)"/g)].map((m) => m[1]));
for (const k of ["From your Knowledge", "Note", "p. {p}", "Knowledge", "Your facts — Chat looks them up before it answers", "Added to Knowledge: {n} passages", "In Knowledge", "Add to Knowledge",
  "Pasted text", "File", "Document", "Public pack", "Mind notes", "Shelf notes", "There is no readable text in this source."]) keys.add(k);
const missing = [...keys].filter((k) => !(k in AR));
assert.deepEqual(missing, [], "Arabic missing for: " + missing.join(" | "));
const latin = [...keys].filter((k) => /[A-Za-z]/.test(AR[k].replace(/\{\w+\}/g, "").replace(/Attune|PDF/g, "")));
assert.deepEqual(latin, [], "Latin letters in Arabic for: " + latin.join(" | "));
console.log(`knowledge-i18n: ${keys.size} strings have Arabic`);
