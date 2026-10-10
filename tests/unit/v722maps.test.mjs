// v6.15 — offline country maps: the search normalisation equals the builder's (tools/build_map_pack.py), updates, the style.
import { execFileSync } from "node:child_process";
import { loadJsx } from "./jsxload.mjs";
const OM = await loadJsx("web-src/offlinemap.js");          // bundled with pmtiles and the map style
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const samples = ["ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ ۝", "مَدِينَةُ نَصْر", "إسكندرية", "الإسكندرية", "Şişli, İstanbul", "Ring Rd. (Cairo)", "شارع ٩٠ الشمالي", "Café Riche", "مؤسسة", "طريق مصر–الإسماعيلية الصحراوي"];
const py = JSON.parse(execFileSync("python3", ["-c", "import json,sys; sys.path.insert(0,'tools'); import build_map_pack as B; print(json.dumps([B.normalize(s) for s in json.loads(sys.argv[1])], ensure_ascii=False))", JSON.stringify(samples)], { cwd: new URL("../..", import.meta.url).pathname }).toString());
ok(OM.normalize("شارع ٩٠") === "شارع 90", "Arabic digits match typed ones: " + OM.normalize("شارع ٩٠"));
samples.forEach((s, i) => ok(OM.normalize(s) === py[i], `normalize("${s}") → "${OM.normalize(s)}" (builder: "${py[i]}")`));
ok(OM.isNewer({ date: "2026-10-09" }, { date: "2026-10-02" }) && !OM.isNewer({ date: "2026-10-02" }, { date: "2026-10-02" }) && OM.isNewer({ date: "2026-10-02" }, null), "an update is offered only for a newer data date");
ok(OM.prettyMB(412e6) === "412 MB" && OM.prettyMB(1.4e9) === "1.4 GB", "sizes read like people say them");
ok(OM.packBytes({ files: [{ bytes: 10 }, { bytes: 5 }] }) === 15, "a pack's size is its files' sizes");
const s1 = OM.mapStyle({ pack: "eg", dark: true, lang: "ar" });
ok(s1.sources.protomaps.url === "pmtiles://eg/eg.pmtiles" && s1.glyphs.startsWith("mapasset://") && s1.layers.length > 20, "a pack is drawn from the phone (pmtiles://eg/…, local fonts), " + s1.layers.length + " layers");
ok(JSON.stringify(s1.layers).includes("name:ar"), "Arabic place names when the app is in Arabic");
const s0 = OM.mapStyle({ pack: null });
ok(s0.sources.osm.tiles[0] === "osmc://{z}/{x}/{y}", "without a pack: online tiles through the app's cache");
ok(OM.COUNTRIES.some((c) => c.code === "eg") && OM.COUNTRIES.every((c) => /^[a-z]{2,4}$/.test(c.code) && c.ar && c.en), "the country list (codes the phone accepts)");
console.log(fail ? `${fail} FAILED` : "v722maps ok");
process.exit(fail ? 1 : 0);
