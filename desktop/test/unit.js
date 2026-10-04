// Plain-Node checks of the desktop bridge pieces (no Electron, no model).
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const device = require("../lib/device");
const models = require("../lib/models");

const g = device.parseDevices([
  "Available devices:",
  "  Vulkan0: NVIDIA GeForce RTX 4090 (24564 MiB, 23000 MiB free)",
  "  Vulkan1: AMD Radeon(TM) Graphics (2048 MiB, 1900 MiB free)",
  "  MTL0: Apple M3 Max (49152 MiB, 49152 MiB free)",
].join("\n"));
assert.strictEqual(g.length, 3);
assert.deepStrictEqual(g.map((x) => x.vendor), ["nvidia", "amd", "apple"]);
assert.strictEqual(g[0].totalMiB, 24564);

const i = device.info(os.tmpdir(), g);
assert.strictEqual(i.platform, "desktop");
assert.ok(i.ramGB >= 1 && i.cores >= 1);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attune-unit-"));
  const src = path.join(dir, "tiny.gguf"); fs.writeFileSync(src, "GGUF0000");
  const stages = [];
  const m = await models.install(dir, { path: src, id: "t1", ctx: 4096 }, (p, s) => stages.push(s), () => false);
  assert.strictEqual(m.id, "t1");
  assert.strictEqual(models.list(dir).length, 1);
  const j = models.toJson(m, true);
  assert.strictEqual(j.active, true); assert.strictEqual(j.ctx, 4096); assert.strictEqual(j.vision, false);
  // Resumed download: an existing .part is continued with a Range request and appended to.
  fs.mkdirSync(path.join(dir, "models", "t2"), { recursive: true });
  fs.writeFileSync(path.join(dir, "models", "t2", "model.gguf.part"), "abc");
  let asked = null;
  const fakeFetch = async (url, o) => { asked = o.headers.Range; return { status: 206, body: [Buffer.from("def")] }; };
  const m2 = await models.install(dir, { url: "https://example.invalid/x.gguf", id: "t2" }, () => {}, () => false, fakeFetch);
  assert.strictEqual(m2.id, "t2");
  assert.strictEqual(asked, "bytes=3-");
  assert.strictEqual(fs.readFileSync(path.join(dir, "models", "t2", "model.gguf"), "utf8"), "abcdef");
  assert.strictEqual(models.remove(dir, "t1"), true);
  assert.strictEqual(models.list(dir).length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("desktop unit: all passed");
})().catch((e) => { console.error(e); process.exit(1); });
