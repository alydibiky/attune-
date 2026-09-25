#!/usr/bin/env node
// Attune Business — activation codes, one per ERP system.
//
//   node tools/erp-licence.mjs keygen  <private-key-file>
//        makes a new key pair; prints the PUBLIC key to paste into
//        web-src/erp.js (LICENCE_PUBLIC_KEY). Keep the private file secret
//        and OUT of git — anyone with it can make codes.
//   node tools/erp-licence.mjs issue   <private-key-file> <ERP-request-code> [plan]
//        prints the activation code for that one system.
//
// Needs Node 18+. No packages.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { subtle } = globalThis.crypto;
const b64u = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const [cmd, file, req, plan = "full"] = process.argv.slice(2);

if (cmd === "keygen" && file) {
  if (existsSync(file)) { console.error(file + " already exists — not overwriting it."); process.exit(1); }
  const kp = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = await subtle.exportKey("jwk", kp.privateKey), pub = await subtle.exportKey("jwk", kp.publicKey);
  writeFileSync(file, JSON.stringify(priv, null, 1), { mode: 0o600 });
  console.log("Private key written to " + file + " (keep it secret).\nPublic key for web-src/erp.js:");
  console.log(JSON.stringify({ kty: "EC", crv: "P-256", x: pub.x, y: pub.y }));
} else if (cmd === "issue" && file && req) {
  const code = String(req).trim().toUpperCase();
  if (!/^ERP-[A-Z0-9]{6,}$/.test(code)) { console.error("That doesn't look like a request code (ERP-…)."); process.exit(1); }
  const jwk = JSON.parse(readFileSync(file, "utf8"));
  const key = await subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const payload = "ATT1." + b64u(Buffer.from(JSON.stringify({ s: code, p: plan, i: Date.now() })));
  const sig = await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(payload));
  console.log(payload + "." + b64u(sig));
} else {
  console.log("usage:\n  node tools/erp-licence.mjs keygen <private-key-file>\n  node tools/erp-licence.mjs issue <private-key-file> <ERP-request-code> [plan]");
  process.exit(cmd ? 1 : 0);
}
