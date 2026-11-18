// v10.2 (smooth start): the app bundle, built with esbuild's API so web-src/i18n-ar.js can be swapped for a shim in the app (the
// Egyptian Arabic dictionary becomes its own file, www/i18n/ar.js) while node tests keep importing the real dictionary.
//   node build/bundle.mjs <out.js> <meta.json>          one file (the old way, kept for tools)
//   SPLIT=<outdir> node build/bundle.mjs - <meta.json>   v10.2: ES modules in <outdir> — rarely used pages are their own files,
//                                                        loaded the first time they open (or quietly after the first screen)
import * as esbuild from "esbuild";
import path from "path";
const here = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [out, meta] = process.argv.slice(2);
const arShim = { name: "ar-shim", setup(b) { b.onResolve({ filter: /(^|\/)i18n-ar\.js$/ }, () => ({ path: path.join(here, "build/i18n-ar-shim.js") })); } };
const split = process.env.SPLIT || "";
const r = await esbuild.build({ entryPoints: [path.join(here, "build/entry.jsx")], bundle: true, format: split ? "esm" : "iife", minify: !process.env.ATTUNE_NOMIN, /* (ATTUNE_NOMIN=1: readable names, for a CPU profile) */ jsx: "transform",
  jsxFactory: "React.createElement", jsxFragment: "React.Fragment", target: "es2020", charset: "utf8", logLevel: "warning", metafile: !!meta,
  ...(split ? { splitting: true, outdir: split, entryNames: "[name]", chunkNames: "c-[hash]" } : { outfile: out }),
  alias: { react: path.join(here, "build/react-shim.js"), "react-dom/client": path.join(here, "build/reactdom-shim.js"), "lucide-react": path.join(here, "build/lucide-shim.js") },
  plugins: [arShim] });
if (meta) (await import("fs")).writeFileSync(meta, JSON.stringify(r.metafile));
