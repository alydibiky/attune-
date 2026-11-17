// v10.2 (smooth start): the app bundle, built with esbuild's API so web-src/i18n-ar.js can be swapped for a shim in the app (the
// Egyptian Arabic dictionary becomes its own file, www/i18n/ar.js) while node tests keep importing the real dictionary.
//   node build/bundle.mjs <out.js> <meta.json>
import * as esbuild from "esbuild";
import path from "path";
const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [out, meta] = process.argv.slice(2);
const arShim = { name: "ar-shim", setup(b) { b.onResolve({ filter: /(^|\/)i18n-ar\.js$/ }, () => ({ path: path.join(here, "build/i18n-ar-shim.js") })); } };
const r = await esbuild.build({ entryPoints: [path.join(here, "build/entry.jsx")], bundle: true, format: "iife", minify: true, jsx: "transform",
  jsxFactory: "React.createElement", jsxFragment: "React.Fragment", target: "es2018", charset: "utf8", outfile: out, logLevel: "warning", metafile: !!meta,
  alias: { react: path.join(here, "build/react-shim.js"), "react-dom/client": path.join(here, "build/reactdom-shim.js"), "lucide-react": path.join(here, "build/lucide-shim.js") },
  plugins: [arShim] });
if (meta) (await import("fs")).writeFileSync(meta, JSON.stringify(r.metafile));
