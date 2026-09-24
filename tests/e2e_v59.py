"""v5.9 — Studio: pictures drawn on the phone (FLUX.2 klein 4B through
stable-diffusion.cpp). The picture engine itself is tested on a desktop in
tests/image_run/; here the phone side is a stand-in that behaves like it
(progress, cancel, files), so the screen, the routing from Chat, the prompt
writing and every button are tested.

  python3 tests/e2e_v59.py
"""
import re, sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env()
errors = []

MOCK = r"""
(() => {
  const S = window.__mock = window.__mock || {};
  const R = (id, o) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(o)), 0);
  const J = (id, m) => setTimeout(() => window.__attuneNative.reject(id, m), 0);
  const P = (id, p, s, d) => window.__attuneNative.progress(id, p, s, d);
  S.img = { built: true, gpuBuilt: true, cpuOnly: false, note: "", lastBackend: "", packs: [], ramGB: 12, availRamGB: 7.5, freeGB: 80 };
  S.imgCalls = []; S.imgCancel = {};
  const pic = (w, h, label) => { const c = document.createElement("canvas"); c.width = Math.min(w, 256); c.height = Math.round(c.width * h / w);
    const g = c.getContext("2d"); const gr = g.createLinearGradient(0, 0, 0, c.height); gr.addColorStop(0, "#f59e0b"); gr.addColorStop(1, "#1e3a8a");
    g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height); g.fillStyle = "#fff"; g.font = "16px sans-serif"; g.fillText(label, 10, 24); return c.toDataURL("image/png"); };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const install = () => {
    const N = window.AttuneNative; if (!N) return setTimeout(install, 0);
    N.imageInfo = () => JSON.stringify(S.img);
    N.setImageCpu = (on) => { S.img.cpuOnly = on; S.img.note = ""; };
    N.installImagePack = (id, arg) => { const a = JSON.parse(arg); S.imgCalls.push(["install", a]); (async () => {
      for (let p = 0; p <= 90; p += 30) { if (S.imgCancel[id]) return J(id, "Download cancelled"); P(id, p, "Downloading 1 of " + a.files.length + ": " + a.files[0].what, ""); await wait(60); }
      S.img.packs = S.img.packs.filter((x) => x.id !== a.id).concat([{ id: a.id, label: a.label, kind: a.kind, files: {} }]); R(id, { ok: true, pack: { id: a.id } }); })(); };
    N.removeImagePack = (p) => { S.img.packs = S.img.packs.filter((x) => x.id !== p); return true; };
    N.imagine = (id, arg) => { const a = JSON.parse(arg); S.lastImagine = a; S.imgCalls.push(["imagine", a]); (async () => {
      const steps = [["start", ""], ["load", "300/702"], ["prompt", ""], ["draw", "1/4"], ["draw", "2/4"], ["draw", "3/4"], ["draw", "4/4"], ["develop", ""], ["save", ""]];
      for (const [s, d] of steps) { if (S.imgCancel[id]) return J(id, "Stopped"); P(id, 0, s, d); await wait(S.slowDraw ? 400 : 40); }
      const n = (S.n = (S.n || 0) + 1);
      R(id, { ok: true, file: "img-" + n + ".png", url: pic(a.width, a.height, (a.refImage ? "edit " : "") + n), width: a.width, height: a.height, ms: 38200, backend: S.img.cpuOnly ? "CPU" : "GPU", seed: a.seed != null ? a.seed : 1000 + n, pausedChat: false }); })(); };
    N.upscaleImage = (id, arg) => { const a = JSON.parse(arg); S.imgCalls.push(["upscale", a]); (async () => {
      for (let t = 1; t <= 4; t++) { P(id, 0, "upscale", t + "/4"); await wait(40); }
      R(id, { ok: true, file: a.file.replace(".png", "-x4.png"), url: pic(1024, 1024, "x4"), width: 4096, height: 4096, ms: 21000, backend: "GPU" }); })(); };
    N.saveImageToGallery = (f) => { S.saved = f; return JSON.stringify({ ok: true, where: "Pictures/Attune/Attune-" + f }); };
    N.shareImage = (f) => { S.shared = f; };
    N.deleteImage = (f) => { S.deleted = f; return true; };
    const c0 = N.cancel; N.cancel = (id) => { S.imgCancel[id] = true; if (c0) c0(id); };
  };
  install();
})();
"""

DESC = "A yellow Liebherr mobile crane lifting a steel bridge beam at golden hour, long shadows across a dusty construction site, workers in orange vests, cinematic light, sharp detail, 35 mm photograph."

def open_studio(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Studio')").first.click()
    page.wait_for_selector("[data-testid=studio-page]", timeout=5000)

def install_chat_model(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=MOCK)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    install_chat_model(page)

    print("--- chat → studio", flush=True)
    comp = page.locator("textarea[placeholder='Message Attune']")
    comp.fill("draw a crane lifting a bridge beam at sunset"); page.locator("button[title='Send']").click()
    card = page.locator("[data-testid=card-violet]")
    card.wait_for(timeout=5000)
    check("Studio draws it on this phone" in card.inner_text() and "a crane lifting a bridge beam at sunset" in card.inner_text(), "a picture request in Chat becomes a Studio card with the subject")
    check(page.evaluate("(window.__mock.bodies || []).length") == 0, "…and no chat model is asked (it can't draw)")
    card.get_by_role("button", name="Draw it in Studio").click()
    page.wait_for_selector("[data-testid=studio-page]", timeout=5000)
    check(page.locator("[data-testid=studio-idea]").input_value() == "a crane lifting a bridge beam at sunset", "Studio opens with the idea filled in")

    print("--- install", flush=True)
    check(page.locator("[data-testid=studio-go]").is_disabled(), "drawing is off until the picture model is installed")
    ins = page.locator("[data-testid=studio-install]")
    check("FLUX.2 klein 4B · high quality" in ins.inner_text() and "7.13" in ins.inner_text() and "Apache-2.0" in ins.inner_text(), "a 12 GB phone is offered the high-quality (8-bit) model, with its size and licence")
    page.click("[data-testid=studio-install-go]")
    page.wait_for_selector("[data-testid=studio-install]", state="detached", timeout=5000)
    a = page.evaluate("window.__mock.imgCalls[0][1]")
    check([f["role"] for f in a["files"]] == ["diffusion", "llm", "vae"] and a["files"][0]["url"].endswith("/flux-2-klein-4b-Q8_0.gguf")
          and a["files"][2]["url"].endswith("/flux2-vae.safetensors"), "it downloads the three files from their public repositories")

    print("--- draw", flush=True)
    page.evaluate("(d) => { window.__mock.fakeQueue = [d]; window.__mock.bodies = []; window.__mock.slowDraw = true; }", DESC)
    page.click("[data-testid=studio-go]")
    page.wait_for_function("document.querySelector('[data-testid=studio-progress]') && /step 2 of 4/.test(document.querySelector('[data-testid=studio-progress]').innerText)", timeout=10000)
    check(True, "progress shows the drawing steps (step 2 of 4) and the time")
    page.wait_for_selector("[data-testid=studio-result] img", timeout=15000)
    li = page.evaluate("window.__mock.lastImagine")
    check(li["prompt"] == DESC, "the chat model first wrote a fuller English description, and that is what was drawn")
    body = page.evaluate("window.__mock.bodies[0]")
    check("ONE English description" in body["messages"][0]["content"] and body["messages"][-1]["content"].endswith("a crane lifting a bridge beam at sunset"), "…from the person's own idea")
    check([li["width"], li["height"], li["steps"], li["pack"]] == [1024, 1024, 4, "klein-4b-hq"], "1024×1024, 4 steps, FLUX.2 klein")
    info = page.locator("[data-testid=studio-result]").inner_text()
    check("1024×1024" in info and "drawn on the GPU in 38 s" in info, "the result says its size, where it was drawn and how long it took: " + info.splitlines()[0][:60])
    page.evaluate("window.__mock.slowDraw = false")

    print("--- arabic idea, sizes", flush=True)
    page.evaluate("(d) => { window.__mock.fakeQueue = [d]; window.__mock.bodies = []; }", "A Liebherr crane on a Cairo construction site at night, city lights behind, photo.")
    page.fill("[data-testid=studio-idea]", "ونش ليبهر في موقع بناء في القاهرة بالليل")
    page.click("[data-testid=studio-size-portrait]")
    page.click("[data-testid=studio-go]")
    page.wait_for_function("window.__mock.imgCalls.filter((c) => c[0] === 'imagine').length === 2", timeout=15000)
    li = page.evaluate("window.__mock.lastImagine")
    check(li["prompt"].startswith("A Liebherr crane on a Cairo") and [li["width"], li["height"]] == [832, 1216],
          "an Egyptian-Arabic idea becomes an English description; portrait is 832×1216")
    page.wait_for_selector("[data-testid=studio-gallery]", timeout=5000)
    check(page.locator("[data-testid=studio-gallery] img").count() == 2, "pictures are kept in a gallery")

    print("--- sharper, save, share", flush=True)
    page.click("[data-testid=studio-upscale]")
    page.wait_for_function("document.querySelector('[data-testid=studio-result]').innerText.includes('4096×4096')", timeout=15000)
    kinds = [c[0] for c in page.evaluate("window.__mock.imgCalls")]
    check(kinds[-2:] == ["install", "upscale"] and page.evaluate("window.__mock.imgCalls.filter(c => c[0]==='install').pop()[1].id") == "esrgan-x4",
          "×4 sharper installs Real-ESRGAN (67 MB) the first time, then makes a 4096×4096 picture")
    page.click("[data-testid=studio-save]")
    check(page.evaluate("window.__mock.saved").endswith("-x4.png"), "Save to gallery saves the picture to Pictures/Attune")
    page.click("[data-testid=studio-share]")
    check(page.evaluate("window.__mock.shared") is not None, "Share hands the picture to other apps")

    print("--- edit", flush=True)
    page.locator("[data-testid=studio-gallery] button").nth(1).click()
    page.click("[data-testid=studio-edit-this]")
    page.wait_for_selector("[data-testid=studio-ref]", timeout=5000)
    check(page.locator("[data-testid=studio-mode-edit]").get_attribute("class").count("bg-violet-500") == 1, "Edit this switches to editing, with the picture as the reference")
    page.fill("[data-testid=studio-idea]", "make it rain, wet ground with reflections")
    page.evaluate("window.__mock.bodies = []")
    page.click("[data-testid=studio-go]")
    page.wait_for_function("window.__mock.imgCalls.filter((c) => c[0] === 'imagine').length === 3", timeout=15000)
    li = page.evaluate("window.__mock.lastImagine")
    check(li["refImage"].startswith("data:image/png;base64,") and li["prompt"] == "make it rain, wet ground with reflections",
          "the edit sends the picture and the instruction as written (no rewrite)")
    check(page.evaluate("(window.__mock.bodies || []).length") == 0, "…and does not ask the chat model")
    # a photo from the phone
    page.locator("[data-testid=studio-ref]").locator("xpath=..").locator("button").click()
    png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#0a0'; g.fillRect(0,0,1600,900); return c.toDataURL('image/png').split(',')[1]; }""")
    import base64, os
    photo = os.path.join(HERE, "_photo.png"); open(photo, "wb").write(base64.b64decode(png))
    page.set_input_files("[data-testid=studio-file]", photo); os.remove(photo)
    page.wait_for_selector("[data-testid=studio-ref]", timeout=5000)
    page.fill("[data-testid=studio-idea]", "add a crane on the left")
    page.click("[data-testid=studio-go]")
    page.wait_for_function("window.__mock.imgCalls.filter((c) => c[0] === 'imagine').length === 4", timeout=15000)
    li = page.evaluate("window.__mock.lastImagine")
    check([li["width"], li["height"]] == [1024, 576], "a phone photo is shrunk to at most 1024 px (multiples of 16) before editing: %sx%s" % (li["width"], li["height"]))

    print("--- stop, gpu note", flush=True)
    page.evaluate("window.__mock.slowDraw = true")
    page.click("[data-testid=studio-mode-create]")
    page.fill("[data-testid=studio-idea]", "a tower crane")
    page.uncheck("[data-testid=studio-enhance]")
    page.click("[data-testid=studio-go]")
    page.wait_for_selector("[data-testid=studio-stop]", timeout=5000)
    page.wait_for_timeout(500)
    page.click("[data-testid=studio-stop]")
    page.wait_for_selector("[data-testid=studio-go]", timeout=5000)
    check(page.locator("[data-testid=studio-error]").count() == 0 and page.evaluate("Object.keys(window.__mock.imgCancel).length") >= 1, "Stop ends the drawing quietly")
    check(page.evaluate("window.__mock.lastImagine.prompt") == "a tower crane", "with 'fuller description' off, the idea is drawn as written")
    page.evaluate("Object.assign(window.__mock.img, { cpuOnly: true, note: 'Drawing on the GPU failed, so Attune switched Studio to the CPU. OpenCL error -5' })")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200); open_studio(page)
    check("switched Studio to the CPU" in page.locator("[data-testid=studio-note]").inner_text() and not page.is_checked("[data-testid=studio-gpu]"),
          "if the GPU fails, Studio says why and the GPU switch shows off")
    page.check("[data-testid=studio-gpu]")
    check(page.evaluate("window.__mock.img.cpuOnly") is False, "…and it can be switched back on")
    page.screenshot(path=HERE + "/v59-studio.png", full_page=True)
    ctx.close()

    print("--- no engine in this build", flush=True)
    ctx, page = new_page(br, env, errors, extra_init=MOCK + "\nwindow.__mock.img.built = false; window.__mock.img.gpuBuilt = false; window.__mock.img.ramGB = 8;")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_studio(page)
    check(page.locator("[data-testid=studio-no-engine]").count() == 1 and page.locator("[data-testid=studio-install-go]").is_disabled(),
          "an APK without the picture engine says so, and nothing can be started")
    check("5.29" in page.locator("[data-testid=studio-install]").inner_text(), "an 8 GB phone is offered the lighter 4-bit model (5.29 GB)")
    ctx.close()
    br.close()
env.close()
re_ = real_errors(errors)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
