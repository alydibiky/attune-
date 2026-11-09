// v9.9.11 the APK build broke on `val asked = arr(...), known = arr(...)` (NoteAsk.kt) — Kotlin has no comma declarations.
// Every Kotlin file is checked so it can't come back (the web suite can't compile Kotlin; the APK build can).
import fs from "fs"; import path from "path";
const dir = "app/src/main/java"; let fails = 0, files = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".kt") ? [path.join(d, e.name)] : []));
/** After `val x =`: a comma at bracket depth 0 followed by `name =` (not `==`) is a second declaration on the same line. */
function commaDecl(code) {
  const m = /^\s*(?:private |internal )?(?:val|var)\s+\w+(?:\s*:\s*[\w<>?., ]+?)?\s*=(?!=)/.exec(code); if (!m) return false;
  let d = 0; const rest = code.slice(m[0].length);
  for (let i = 0; i < rest.length; i++) { const c = rest[i];
    if ("([{".includes(c)) d++; else if (")]}".includes(c)) d--; else if (c === ";") return false;
    else if (c === "," && d === 0 && /^\s*\w+\s*=(?!=)/.test(rest.slice(i + 1))) return true; }
  return false;
}
for (const f of walk(dir)) { files++;
  fs.readFileSync(f, "utf8").split("\n").forEach((l, i) => {
    const code = l.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/\/.*$/, "");
    if (commaDecl(code)) { console.log("FAIL " + f + ":" + (i + 1) + "  " + l.trim()); fails++; }
  });
}
if (fails) { console.log("FAILED " + fails); process.exit(1); } else console.log("PASS v999kotlinval: no comma declarations in " + files + " Kotlin files");
