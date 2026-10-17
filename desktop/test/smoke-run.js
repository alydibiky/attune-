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
        // a window 1024 px and wider has the Claude/ChatGPT sidebar; a smaller one (the Windows CI screen is 1008 px) the phone's
        // layout — since v6.30 that has no bottom bar, only the ☰ menu (this check expected the old bar and failed from v6.31 on)
        const winW = window.innerWidth;
        const sidebar = winW >= 1024 ? (!!document.querySelector("[data-testid=side]") && !document.querySelector("nav:not(.hidden)"))
          : (!document.querySelector("[data-testid=side]") && !!(document.querySelector("[data-testid=header-menu]") || document.querySelector("[data-testid=home-menu]") || document.querySelector("nav:not(.hidden)")));
        const knowOk = Array.isArray(JSON.parse(window.AttuneNative.knowPacks()).packs);
        const mapOk = Array.isArray(JSON.parse(window.AttuneNative.mapPacks()).packs) && window.AttuneNative.mapRead(JSON.stringify({ path: "../x" })) === "";
        const search = await call("search", { q: "Cairo Tower height", pages: 1 }).then((r) => ({ hits: r.hits.length, via: r.via, why: r.why })).catch((e) => ({ error: String(e && e.message || e) }));
        const packSearch = await call("knowSearch", { q: "crane", k: 3 }).then((r) => r.passages.length).catch((e) => "error: " + (e && e.message || e));
        // PDFs (lib/pdf.js): print a page, read it back, a page picture, word boxes, make a PDF from blocks, merge / split / rotate
        let pdf = {};
        try {
          const made = await call("htmlToPdf", { html: "<html><body style='font:14pt Arial'><h1>Liebherr LTM 1090</h1><p>Load chart page one.</p><p dir=rtl>رافعة متحركة</p></body></html>", w: 595.3, h: 841.9 });
          const txt = await call("pdfText", { b64: made.b64 });
          const pics = await call("pdfImages", { b64: made.b64, width: 600, max: 1 });
          const words = await call("pdfWords", { b64: made.b64, pages: [1] });
          const out = await call("pdfOutline", { b64: made.b64 });
          const blocks = await call("makePdf", { blocks: [{ type: "h1", text: "Report" }, { type: "p", text: "Hello" }, { type: "table", rows: [["a", "b"], ["1", "2"]] }] });
          const merged = await call("pdfEdit", { op: "merge", files: [made.b64, blocks.b64] });
          const split = await call("pdfEdit", { op: "split", b64: merged.files[0].b64 });
          const rot = await call("pdfEdit", { op: "rotate", b64: made.b64, pages: [], degrees: 90 });
          const t = txt.pages[0].text;
          pdf = { printed: made.bytes, text: t.slice(0, 80), count: txt.count, w: txt.pages[0].w, picture: !!(pics.images[0] && pics.images[0].image.startsWith("data:image/jpeg")),
            words: words.pages[0].words.length, outline: Array.isArray(out.items), blocks: blocks.bytes, merged: merged.files[0].pages, split: split.files.length, rotated: rot.files[0].pages };
          pdf.ok = t.includes("Liebherr LTM 1090") && t.includes("Load chart") && pdf.picture && pdf.words >= 5 && pdf.outline && pdf.merged >= 2 && pdf.split === pdf.merged && pdf.rotated === 1 && Math.abs(pdf.w - 595.3) < 2 && t.includes("رافعة متحركة");
        } catch (e) { pdf = { ok: false, error: String(e && e.message || e) }; }
        const live = ${JSON.stringify(process.env.ATTUNE_LIVE === "1")};
        const bridgeOk = pdf.ok && info.packSearch === true && sidebar && knowOk && mapOk && typeof packSearch === "number" &&   /* (a starter pack may download during the run on a fast connection: 0 or more passages, never an error) */ !String(search.error || "").includes("Not available") && (!live || search.hits > 0);
        return { ok: !!(res.content && deltas > 0) && bridgeOk, packSearchEngine: info.packSearch, pdf, winW, sidebar, knowOk, mapOk, search, packSearch, deltas, content: res.content, streamedMatches: streamed === res.content,
          chatMs: Date.now() - t1, totalMs: Date.now() - t0, engine: eng, installed: models.models.length, stages,
          pageChars: document.body.innerText.length, desktopFlag: !!window.__attuneDesktop,
          info: { platform: info.platform, ramGB: info.ramGB, cores: info.cores, avx2: info.avx2, gpus: info.gpus, vramGB: info.vramGB } };
      })()`, true);
      clearTimeout(timer);
      done(r && r.ok ? 0 : 1, r);
    } catch (e) { clearTimeout(timer); done(1, { ok: false, error: String(e && e.message || e) }); }
  });
};
