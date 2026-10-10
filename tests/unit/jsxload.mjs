// Bundles one web-src .jsx file for Node with React/icon stand-ins, and imports it. Used by tests of a .jsx module's pure functions.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join, resolve } from "node:path";
export async function loadJsx(rel) {
  const root = resolve(new URL("../..", import.meta.url).pathname), out = join(mkdtempSync(join(tmpdir(), "jsx-")), "m.mjs");
  execFileSync(join(root, "web-src/node_modules/.bin/esbuild"), [join(root, rel), "--bundle", "--format=esm", "--platform=node", "--outfile=" + out, "--log-level=error",
    "--alias:react=" + join(root, "tests/unit/stubs/react.js"), "--alias:lucide-react=" + join(root, "tests/unit/stubs/lucide-react.js")]);
  return import(out);
}
