// Runs inside the app (ATTUNE_SMOKE=<model.gguf>): the page loads, installs the model through
// AttuneNative.install, then asks one question through AttuneNative.chat with streaming — the same
// nativeCall path web-src uses on the phone — and prints the result as one JSON line.
"use strict";
module.exports = function smokeRun(win, modelPath, app) {
  const done = (code, obj) => { process.stdout.write("SMOKE_RESULT " + JSON.stringify(obj) + "\n"); setTimeout(() => app.exit(code), 300); };
  const timer = setTimeout(() => done(2, { ok: false, error: "timeout" }), 8 * 60000);
  win.webContents.once("did-fail-load", (e, code, desc) => done(3, { ok: false, error: "page did not load: " + desc }));
  win.webContents.once("did-finish-load", async () => {
    try {
      const r = await win.webContents.executeJavaScript(`(async () => {
        const t0 = Date.now();
        for (let i = 0; i < 100 && !(document.body && document.body.innerText.trim().length > 20); i++) await new Promise((r) => setTimeout(r, 100));
        const call = window.__attuneNativeCall;
        if (!call) return { ok: false, error: "the page did not set up nativeCall" };
        const info = JSON.parse(window.AttuneNative.info());
        const stages = [];
        const inst = await call("install", { path: ${JSON.stringify(modelPath)}, id: "smoke", label: "Smoke test", ctx: 2048 }, (p, s) => stages.push(s));
        const eng = JSON.parse(window.AttuneNative.engine());
        let deltas = 0, streamed = "";
        const orig = window.__attuneNative.delta;
        window.__attuneNative.delta = (id, c, r) => { deltas++; streamed += c || ""; return orig(id, c, r); };
        const t1 = Date.now();
        const res = await call("chat", { messages: [{ role: "user", content: "What is the capital of France? Answer in one short sentence." }],
          max_tokens: 48, temperature: 0, stream: true, stream_options: { include_usage: true }, chat_template_kwargs: { enable_thinking: false } });
        const models = JSON.parse(window.AttuneNative.models());
        // v6.24: the computer layout and the bridge added for the desktop
        const sidebar = !!document.querySelector("[data-testid=side]") && !document.querySelector("nav:not(.hidden)");
        const knowOk = Array.isArray(JSON.parse(window.AttuneNative.knowPacks()).packs);
        const mapOk = Array.isArray(JSON.parse(window.AttuneNative.mapPacks()).packs) && window.AttuneNative.mapRead(JSON.stringify({ path: "../x" })) === "";
        const search = await call("search", { q: "Cairo Tower height", pages: 1 }).then((r) => ({ hits: r.hits.length, via: r.via, why: r.why })).catch((e) => ({ error: String(e && e.message || e) }));
        const packSearch = await call("knowSearch", { q: "crane", k: 3 }).then((r) => r.passages.length).catch((e) => "error: " + (e && e.message || e));
        const live = ${JSON.stringify(process.env.ATTUNE_LIVE === "1")};
        const bridgeOk = info.packSearch === true && sidebar && knowOk && mapOk && packSearch === 0 && !String(search.error || "").includes("Not available") && (!live || search.hits > 0);
        return { ok: !!(res.content && deltas > 0) && bridgeOk, packSearchEngine: info.packSearch, sidebar, knowOk, mapOk, search, packSearch, deltas, content: res.content, streamedMatches: streamed === res.content,
          chatMs: Date.now() - t1, totalMs: Date.now() - t0, engine: eng, installed: models.models.length, stages,
          pageChars: document.body.innerText.length, desktopFlag: !!window.__attuneDesktop,
          info: { platform: info.platform, ramGB: info.ramGB, cores: info.cores, avx2: info.avx2, gpus: info.gpus, vramGB: info.vramGB } };
      })()`, true);
      clearTimeout(timer);
      done(r && r.ok ? 0 : 1, r);
    } catch (e) { clearTimeout(timer); done(1, { ok: false, error: String(e && e.message || e) }); }
  });
};
