"""v5.41 — Ali's phone test after v5.40: website preview, converter tools, Zenith download, Back history,
Studio sharpening that survives leaving, Chat X-Ray questions, Deal Check maths, deck commands.

  python3 tests/e2e_v541.py
"""
import os, re, json, base64, io, zipfile
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
STUDIO = re.search(r'MOCK = r"""(.*?)"""', open(os.path.join(HERE, "e2e_v59.py"), encoding="utf-8").read(), re.S).group(1)
EXTRA = r"""(() => { const S = window.__mock = window.__mock || {};
  const go = () => { const N = window.AttuneNative; if (!N || !N.upscaleImage) return setTimeout(go, 0);
    S.img.packs = [{ id: "turbo", label: "Studio Turbo", kind: "turbo", files: {} }, { id: "esrgan-x4", label: "Sharpen", kind: "upscale", files: {} }];
    N.imageList = () => JSON.stringify(S.folder || []);
    const up0 = N.upscaleImage;
    N.upscaleImage = (id, arg) => { if (!S.slowUp) return up0(id, arg); const a = JSON.parse(arg); S.imgCalls.push(["upscale", a]);
      S.upPending = () => window.__attuneNative.resolve(id, JSON.stringify({ ok: true, file: a.file.replace(".png", "-x4.png"), url: "data:image/png;base64,iVBORw0KGgo=", width: 2048, height: 2048, ms: 60000, backend: "CPU" })); };
  }; go(); })();"""

def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"))

def queue(page, answers):
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)

def sent(page):
    return page.evaluate("window.__mock.bodies.filter(b => b.max_tokens > 2)")

def open_tool(page, name, testid):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(f".rounded-t-2xl button:has-text('{name}')").first.click()
    page.wait_for_selector(f"[data-testid={testid}]", timeout=6000)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").first.click()

HTML = """```html
<!DOCTYPE html><html><head><meta charset="utf-8"><title>HeavyLift Crane Rentals</title><style>body{font-family:sans-serif;margin:0}.card{padding:12px}</style></head>
<body><header><h1>HeavyLift Crane Rentals</h1></header><section id="services"><div class="card">Mobile crane rental</div><div class="card">Tower crane rental</div></section>
<section id="fleet"><div class="card">Liebherr LTM 1100</div></section><form id="contact"><input name="name"><button>Send</button></form>
<script>document.getElementById('contact').addEventListener('submit', (e) => e.preventDefault());</script></body></html>
```"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=STUDIO + "\n" + EXTRA + "\ntry { localStorage.setItem('attune:studio:hd', '0'); } catch (e) {}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    chip0 = page.locator("header button").filter(has_text=re.compile("Blaze|Glow|Spark|Core|Sense|Zenith")).first.inner_text()

    # ---- #13 choosing a model that isn't on the phone offers its download; the chip keeps the running one ----
    page.locator("[data-testid=tier-xl]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=engine-download-selected]").count() == 1 and "Download" in page.locator("[data-testid=engine-download-selected]").inner_text(), "tapping Zenith offers its download")
    check(page.locator("[data-testid=engine-loaded]").inner_text().find("Zenith") < 0, "…and never says “Zenith loaded” while another model runs")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    chip1 = page.locator("header button").filter(has_text=re.compile("Blaze|Glow|Spark|Core|Sense|Zenith")).first.inner_text()
    check(chip1 == chip0 and "Zenith" not in chip1, "the header still names the model that is running (%s)" % chip1)

    # ---- #9/#10 a website request goes the code route: clean HTML, Preview card ----
    queue(page, [HTML] * 3)
    send(page, "A landing page for my crane rental company with services, fleet and a contact form")
    page.wait_for_selector("[data-testid=artifact-card]", timeout=40000)
    bodies = sent(page)
    check(all("no_repeat_ngram" not in b and "dry_multiplier" not in b for b in bodies), "the page is written without the anti-repeat penalties that mangled it (divclass, </div</div>)")
    check("code block only" in json.dumps(bodies[0]["messages"]) or "ONE code block" in json.dumps(bodies[0]["messages"]) or "```html" in json.dumps(bodies[0]["messages"]), "the website writer's instructions are used")
    check(page.locator("[data-testid=artifact-card]").count() >= 1, "the answer has its Preview card")
    shot(page, "01-website")

    # ---- #12 File Converter shows every tool before a file is picked ----
    open_tool(page, "File Converter", "convert")
    tools = page.locator("[data-testid^=convert-tool-]").count()
    check(tools >= 10 and page.locator("[data-testid=convert-tool-merge]").count() == 1, "What do you want to do? — %d tools, Merge PDFs among them" % tools)
    page.locator("[data-testid=convert-tool-merge]").click(); page.wait_for_timeout(150)
    mult = page.evaluate("document.querySelector('[data-testid=convert-file]').multiple && document.querySelector('[data-testid=convert-file]').accept")
    check(bool(mult) and "pdf" in mult, "Merge opens a picker for several PDFs")
    page.set_input_files("[data-testid=convert-file]", files=[{"name": "a.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 a"}, {"name": "b.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 b"}])
    page.wait_for_timeout(200)
    check("teal" in (page.locator("[data-testid=convert-to-merge]").get_attribute("class") or ""), "…and “Merge into one PDF” is already chosen")
    shot(page, "02-convert")

    # ---- #15 Back: a screen you were SENT to returns to where you came from, which reopens where you were ----
    open_tool(page, "Learn daily", "learn-page")
    page.locator("[data-testid=learn-new-btn]").click(); page.wait_for_timeout(200)
    in_new = page.locator("[data-testid=learn-topic]").count() > 0
    # Learn daily → "Draw a picture for this lesson" opens Studio (the jump Ali made)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-studio', { detail: { prompt: 'a lesson picture' } }))")
    page.wait_for_selector("[data-testid=studio-page]", timeout=5000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=learn-new]").count() + page.locator("[data-testid=learn-page]").count() == 1, "Back from Studio returns to Learn daily (not out of the app)")
    if in_new: check(page.locator("[data-testid=learn-topic]").count() == 1, "…still on the new-course form you left")
    steps, left_early = 0, False
    while page.locator("textarea[placeholder='Message Attune']").count() == 0 and steps < 10:
        if not page.evaluate("window.__attuneBack()"): left_early = True; break
        page.wait_for_timeout(200); steps += 1
    check(not left_early and page.locator("textarea[placeholder='Message Attune']").count() == 1, "…and Back then goes home to Chat, never leaving the app early (%d steps)" % steps)
    open_tool(page, "Deal Check", "deal")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    check(page.locator("textarea[placeholder='Message Attune']").count() == 1, "a tool opened from the menu goes home to Chat on Back (Android's rule)")

    # ---- #3 sharpening carries on while you are elsewhere; the result lands in the gallery ----
    open_tool(page, "Studio", "studio-page")
    page.evaluate("() => { window.__mock.slowUp = false; }")
    page.fill("[data-testid=studio-idea]", "a crane at sunset")
    draw = page.locator("[data-testid=studio-go]")
    if draw.count():
        draw.first.click(); page.wait_for_selector("[data-testid=studio-upscale]", timeout=15000)
        page.evaluate("() => { window.__mock.slowUp = true; }")
        page.locator("[data-testid=studio-upscale]").click(); page.wait_for_timeout(300)
        page.locator("nav button").first.click(); page.wait_for_timeout(300)          # leave Studio while it sharpens
        page.evaluate("window.__mock.upPending()"); page.wait_for_timeout(300)        # it finishes while you are away
        open_tool(page, "Studio", "studio-page"); page.wait_for_timeout(300)
        g = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1') || '[]').map(x => x.file)")
        check(any(f.endswith("-x4.png") for f in g), "the sharpened picture was kept although Studio was closed (%s)" % g[:3])
        check(page.locator("[data-testid=studio-upscale]").count() == 0, "…and Studio shows the sharpened one")
    else:
        check(False, "Studio draw button present")

    # ---- #4 Chat X-Ray: "was X mentioned?" answered by code at once ----
    open_tool(page, "Chat X-Ray", "xray")
    chat = "\n".join(["27/09/2026, 10:0%d - Hassan: the LTM 1100 is free on Sunday" % 1, "27/09/2026, 10:02 - Ali: ok book it, send the عربون today", "27/09/2026, 10:03 - Hassan: done, 5000 EGP"])
    ta = page.locator("[data-testid=xray-paste]")
    if ta.count():
        ta.fill(chat); page.locator("[data-testid=xray-paste-go]").click(); page.wait_for_timeout(300)
    queue(page, ['{"items": []}'] * 3)
    page.locator("[data-testid=xray-me]", has_text="Ali").click()
    page.locator("[data-testid=xray-go]").click()
    try: page.wait_for_selector("[data-testid=xray-tab-ask]", timeout=20000)
    except Exception:
        shot(page, "xray-fail"); print(page.locator("[data-testid=xray]").inner_text()[:600]); raise
    page.locator("[data-testid=xray-tab-ask]").click()
    queue(page, [])
    page.fill("[data-testid=xray-q]", "was “LTM 1100” mentioned?"); page.locator("[data-testid=xray-ask]").click()
    page.wait_for_selector("[data-testid=xray-answer]", timeout=5000)
    ans = page.locator("[data-testid=xray-answer]").inner_text()
    check(ans.startswith("Yes") and "Hassan" in ans and len(sent(page)) == 0, "“was LTM 1100 mentioned?” — yes, by whom and when, with no model call")
    shot(page, "03-xray")

    # ---- #6 Deal Check: “12,400 or 3 × 4,133” read right ----
    open_tool(page, "Deal Check", "deal")
    page.fill("[data-testid=deal-input]", 'iPhone 15 Pro 256GB, like new, 38,000 EGP, deposit on Vodafone Cash to hold it "12,400 EGP or 3 × 4,133 with valU"')
    queue(page, ['{"item": "iPhone 15 Pro 256GB", "kind": "product", "price": 38000, "currency": "EGP", "cash_price": 38000, "down_payment": 12400, "monthly": 4133, "months": 3, "fees": null, "seller": null, "claims": [], "text": ""}', "Hello, can I see it first?"])
    page.locator("[data-testid=deal-go]").click()
    page.wait_for_selector("[data-testid=deal-verdict]", timeout=30000)
    body = page.locator("[data-testid=deal]").inner_text()
    check("24,799" not in body and "-13,201" not in body and "−13,201" not in body, "no 24,799 total and no −13,201 (the model's misreading is overruled by code)")
    check("12,399" in body and ("0%" in body), "3 × 4,133 = 12,399 — a real 0%")
    check("Two very different prices" in body, "two different prices in one offer are flagged")
    shot(page, "04-deal")

    # ---- #1 change a deck by a sentence ----
    open_tool(page, "Slides & Reports", "slides")
    page.fill("[data-testid=slides-prompt]", "A pitch for our crane company")
    page.locator("[data-testid=slides-n-5]").click()
    outline = "TITLE: Crane Co\nSUBTITLE: s\n1. [bullets] One\n2. [bullets] Two\n3. [bullets] Three\n4. [bullets] Four\n5. [bullets] Five"
    queue(page, [outline] + ["- A: first point here\n- B: second point here\nNOTES: n"] * 5)
    page.locator("[data-testid=slides-go]").click()
    page.wait_for_selector("[data-testid=slides-save-pptx]", timeout=30000)
    n0 = page.locator("[data-testid^=slide-canvas-]").count()
    page.fill("[data-testid=deck-cmd]", "delete slide 4"); page.locator("[data-testid=deck-cmd-go]").click(); page.wait_for_timeout(300)
    n1 = page.locator("[data-testid^=slide-canvas-]").count()
    check(n1 == n0 - 1 and "deleted" in page.locator("[data-testid=deck-cmd-note]").inner_text(), "“delete slide 4” removes it (%d → %d)" % (n0, n1))
    queue(page, ["- Price: EGP 35,000 a day\n- Crew: included\nNOTES: prices"])
    page.fill("[data-testid=deck-cmd]", "slide 3: add prices"); page.locator("[data-testid=deck-cmd-go]").click()
    page.wait_for_selector("[data-testid=deck-cmd-note]", timeout=20000); page.wait_for_timeout(300)
    m = sent(page)
    check(len(m) == 1 and "ALSO: add prices" in json.dumps(m[0]["messages"]), "“slide 3: add prices” asks the AI for that slide only")
    page.fill("[data-testid=deck-cmd]", "green theme with fade transitions"); page.locator("[data-testid=deck-cmd-go]").click(); page.wait_for_timeout(300)
    page.locator("[data-testid=slides-save-pptx]").click(); page.wait_for_timeout(400)
    z = zipfile.ZipFile(io.BytesIO(base64.b64decode(page.evaluate("window.__mock.lastSaved.b64"))))
    s3 = z.read("ppt/slides/slide3.xml").decode()
    check("35,000" in s3 and "<p:fade/>" in s3 and "059669" in z.read("ppt/theme/theme1.xml").decode(), "the file has the new words, the fade and the green design")
    shot(page, "05-deck")

    # ---- #2 the Paste button never wraps letter by letter ----
    open_tool(page, "Video Downloader", "video")
    h = page.evaluate("document.querySelector('[data-testid=video-paste]').getBoundingClientRect().height")
    check(h < 60, "the Paste button stays one line (%d px high)" % h)

    # ---- (last: it reloads the page) Studio picks up a sharpening that finished while the page was gone ----
    # after a page reload: the job noted in storage is picked up from the Studio folder
    page.evaluate("""() => { localStorage.setItem('attune:studio:pending', JSON.stringify({ what: 'upscale', t0: Date.now(), file: 'img-77.png' }));
      window.__mock.folder = [{ file: 'img-77-x4.png', url: 'data:image/png;base64,iVBORw0KGgo=', width: 2048, height: 2048, at: Date.now() }]; }""")
    page.locator("nav button").first.click(); page.wait_for_timeout(200)
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("() => { window.__mock.folder = [{ file: 'img-77-x4.png', url: 'data:image/png;base64,iVBORw0KGgo=', width: 2048, height: 2048, at: Date.now() }]; }")
    open_tool(page, "Studio", "studio-page"); page.wait_for_timeout(600)
    g2 = page.evaluate("JSON.parse(localStorage.getItem('attune:studio:v1') || '[]').map(x => x.file)")
    check("img-77-x4.png" in g2 and page.evaluate("localStorage.getItem('attune:studio:pending')") is None, "after a reload, a sharpening that finished is picked up")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
