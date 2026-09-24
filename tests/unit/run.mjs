// Bundles each *.test.mjs with the page's pinned esbuild and runs it in Node.
import { execFileSync } from "child_process";
import { readdirSync } from "fs";
import path from "path";
const here = path.dirname(new URL(import.meta.url).pathname);
const esb = path.join(here, "../../web-src/node_modules/.bin/esbuild");
let bad = 0;
for (const f of readdirSync(here).filter((x) => x.endsWith(".test.mjs"))) {
  const out = path.join(here, ".out-" + f.replace(".mjs", ".cjs"));
  execFileSync(esb, [path.join(here, f), "--bundle", "--platform=node", "--format=cjs", "--outfile=" + out, "--log-level=error"]);
  try { execFileSync("node", [out], { stdio: "inherit", env: { ...process.env, TZ: "Africa/Cairo" } }); } catch (e) { bad++; }
}
process.exit(bad ? 1 : 0);
