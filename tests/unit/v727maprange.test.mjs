// v6.27: runs desktop/test/maprange.js (a country's map read online in pieces, with a fake GitHub) in the local test run.
import { execFileSync } from "node:child_process";
const out = execFileSync(process.execPath, ["--no-warnings", new URL("../../desktop/test/maprange.js", import.meta.url).pathname], { encoding: "utf8" });
process.stdout.write(out);
