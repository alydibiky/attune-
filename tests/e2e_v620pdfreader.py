"""v6.20 — Ask a PDF reader: the evidence for an answer and the search hits highlighted ON the page picture, text selection →
highlight / note / translate in the chat, bookmarks, Markdown export, 'save a PDF with them', zoom / fit / night, contents,
page pictures strip, documents kept between sessions (last page, chat, annotations), delete, and a 300-page file that shows
its first page at once and reads the rest without long freezes. Screenshots go to SHOTS (default tests/shots-v620).

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v620pdfreader.py
"""
import json, os, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots-v620")
os.makedirs(SHOTS, exist_ok=True)
def shot(page, name, el=None):
    if el: page.evaluate("() => { const t = document.querySelector('[data-testid=pdf-reader] > .sticky'); if (t) t.style.position = 'static'; }")
    path = os.path.join(SHOTS, name + ".png")
    (el or page).screenshot(path=path)
    if el: page.evaluate("() => { const t = document.querySelector('[data-testid=pdf-reader] > .sticky'); if (t) t.style.position = ''; }")
    return path

PAGES = [
  ["Crane Rental Agreement", "This agreement is made between Adrighem Cranes and", "Nile Constructions on 1 March 2026 for the rental of", "one 50 tonne mobile crane."],
  ["Payment terms", "The client shall pay a daily rate of 9,000 EGP.", "Invoices are due within 15 days.", "A late payment fee of 2% per month applies", "after the due date."],
  ["Insurance and liability", "The owner carries third party insurance of", "5,000,000 EGP. The client is responsible for ground", "conditions and for a certified signalman."],
  ["Termination", "Either party may end this agreement with 30 days", "written notice. If the client cancels within 48 hours", "of the start date, one day's rental is charged."],
]
# the stand-in app: text in parts, word boxes, page pictures drawn from the same boxes (so a highlight can be seen on its words)
NATIVE = r"""((PAGES, N, DELAY) => { const A = window.AttuneNative, S = window.__mock; S.pdfCalls = []; S.edits = [];
  const R = (id, v, d) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), d == null ? 20 : d);
  const lines = (n) => PAGES[(n - 1) % PAGES.length].map((l, k) => k === 0 && n > PAGES.length ? l + " " + n : l);
  const boxes = (n) => { const out = []; lines(n).forEach((l, li) => { let x = 0.08; const y = 0.08 + li * 0.045; const h = li ? 0.022 : 0.03;
    for (const t of l.split(" ")) { const w = t.length * (li ? 0.0125 : 0.017); out.push([+x.toFixed(4), y, +w.toFixed(4), h, t]); x += w + 0.011; } }); return out; };
  const svg = (n, W) => { const H = Math.round(W * 1.414); let s = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><rect width='100%' height='100%' fill='white'/>`;
    for (const b of boxes(n)) s += `<text x='${b[0] * W}' y='${(b[1] + b[3] * 0.8) * H}' font-family='monospace' font-size='${b[3] * H * 0.9}' textLength='${b[2] * W}' lengthAdjust='spacingAndGlyphs'>${b[4].replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
    s += `<text x='${W / 2}' y='${H - 30}' font-size='16' fill='#888'>${n}</text></svg>`; return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s))); };
  S.text = (n) => lines(n).join("\n");
  A.pdfText = (id, arg) => { const a = JSON.parse(arg); S.pdfCalls.push(['pdfText', a.from || 1, a.max || 400]);
    const f = a.from || 1, m = Math.min(N, f + (a.max || 400) - 1), ps = []; for (let n = f; n <= m; n++) ps.push({ n, text: S.text(n), scan: false });
    R(id, { count: N, pages: ps }, DELAY * ps.length); };
  A.pdfWords = (id, arg) => { const a = JSON.parse(arg); S.pdfCalls.push(['pdfWords', a.pages]); R(id, { pages: a.pages.map((n) => ({ n, ar: 0.7072, words: boxes(n) })) }); };
  A.pdfImages = (id, arg) => { const a = JSON.parse(arg); S.pdfCalls.push(['pdfImages', a.pages, a.width]); R(id, { images: a.pages.map((n) => ({ n, image: svg(n, Math.min(a.width || 800, 800)) })) }); };
  A.pdfOutline = (id) => R(id, { items: [{ title: "Payment terms", page: 2, level: 0 }, { title: "Late fee", page: 2, level: 1 }, { title: "Termination", page: 4, level: 0 }] });
  A.pdfEdit = (id, arg) => { const a = JSON.parse(arg); S.edits.push(a); R(id, { files: [{ n: 1, b64: "JVBERi0xLjQK", pages: N }] }); };
  A.shareFile = (id, arg) => { S.shared = JSON.parse(arg); R(id, { ok: true }); };
})"""

def queue(page, answers): page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", answers)
def say(page, text): page.fill("[data-testid=pdf-input]", text); page.click("[data-testid=pdf-send]")
def open_tool(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Ask a PDF')").first.click()
    page.wait_for_selector("[data-testid=pdfchat-home]", timeout=5000)
def select_words(page, a, b):
    page.evaluate("""([a, b]) => { const s = (i) => document.querySelector(`[data-testid=pdf-textlayer] [data-w="${i}"]`);
      const r = document.createRange(); r.setStart(s(a).firstChild, 0); r.setEnd(s(b).firstChild, s(b).firstChild.length - 1);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); }""", [a, b])
    page.wait_for_selector("[data-testid=pdf-sel-bar]", timeout=3000)
def rects(page, tid):
    return page.evaluate("(t) => [...document.querySelectorAll(`[data-testid=${t}]`)].map((e) => ({ top: parseFloat(e.style.top), left: parseFloat(e.style.left), w: parseFloat(e.style.width) }))", tid)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate(NATIVE + "(%s, 4, 5)" % json.dumps(PAGES))
    open_tool(page)
    page.set_input_files("[data-testid=pdfchat-file]", files=[{"name": "contract.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 contract"}])
    page.wait_for_selector("[data-testid=pdfchat]", timeout=8000)

    # ---- (1) an answer's page: the evidence is highlighted on the page picture
    queue(page, ["The late payment fee is 2% per month after the due date [p. 2]."])
    say(page, "What is the late payment fee?")
    page.wait_for_selector("[data-testid=pdf-cite]", timeout=10000)
    page.locator("[data-testid=pdf-cite]").first.click()
    page.wait_for_selector("[data-testid=pdf-page-img]", timeout=5000)
    page.wait_for_selector("[data-testid=pdf-evidence]", timeout=5000)
    ev = rects(page, "pdf-evidence")
    check(len(ev) >= 1 and all(abs(r["top"] - (8 + 3 * 4.5)) < 6 or abs(r["top"] - (8 + 4 * 4.5)) < 6 for r in ev), "the evidence ('late payment fee of 2%%…') is highlighted on its own lines of page 2: %s" % ev)
    check(page.locator("[data-testid=pdf-page-text] mark").count() >= 1, "the page's text still shows the question's words marked")
    page.wait_for_timeout(300)
    s1 = shot(page, "1-evidence-highlighted", page.locator("[data-testid=pdf-sheet]"))
    shot(page, "1b-reader")

    # search hits on the picture
    page.fill("[data-testid=pdf-find]", "insurance"); page.wait_for_timeout(250)
    page.locator("[data-testid=pdf-hits] button").first.click(); page.wait_for_timeout(500)
    hr = rects(page, "pdf-hit-rect")
    check(len(hr) == 2, "search hits are highlighted on page 3's picture (%d)" % len(hr))
    shot(page, "2-search-hits", page.locator("[data-testid=pdf-sheet]"))
    page.fill("[data-testid=pdf-find]", "")

    # ---- (3) annotations: select → highlight, note, bookmark
    page.fill("[data-testid=pdf-page-input]", "2"); page.wait_for_selector("[data-testid=pdf-textlayer] [data-w='8']", timeout=4000)
    select_words(page, 3, 8)        # "client shall pay a daily rate"
    check("client shall pay a daily rate" in page.locator("[data-testid=pdf-sel-bar]").inner_text(), "selecting words on the page picture gives their text")
    page.click("[data-testid=pdf-hl-green]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=pdf-user-hl]").count() == 1, "a green highlight is drawn on the page")
    page.click("[data-testid=pdf-bookmark]"); page.click("[data-testid=pdf-note-add]")
    page.fill("[data-testid=pdf-note-text]", "Ask the lawyer about the late fee"); page.click("[data-testid=pdf-note-save]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=pdf-note-pin]").count() == 1 and page.locator("[data-testid=pdf-note]").count() == 1, "a note is pinned on the page and shown under it")
    page.click("[data-testid=pdf-panel-notes]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=pdf-ann]").count() == 3, "the list shows the highlight, the note and the bookmark")
    page.click("[data-testid=pdf-export-md]"); page.wait_for_timeout(300)
    md = page.evaluate("window.__mock.files['contract - notes.md'] || ''")
    check("## Highlights" in md and "client shall pay a daily rate" in md and "Ask the lawyer" in md and "## Bookmarks" in md, "exported as Markdown")
    page.click("[data-testid=pdf-flatten]"); page.wait_for_timeout(400)
    ed = page.evaluate("window.__mock.edits")
    check(len(ed) == 1 and ed[0]["op"] == "annotate" and any(a["kind"] == "highlight" and len(a["rects"]) == 1 for a in ed[0]["anns"]) and any(a["kind"] == "note" for a in ed[0]["anns"]), "'save a PDF with them' sends the highlights and notes to be drawn into the file")
    shot(page, "3-annotations")
    page.click("[data-testid=pdf-panel-notes]")

    # ---- (4) polish: zoom, fit, night, contents, page pictures, share
    w0 = page.locator("[data-testid=pdf-sheet]").bounding_box()["width"]
    page.click("[data-testid=pdf-zoom-in]"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=pdf-zoom]").inner_text() == "125%" and page.locator("[data-testid=pdf-sheet]").bounding_box()["width"] > w0 * 1.2, "zoom in makes the page bigger")
    page.wait_for_timeout(400)
    check(any(c[0] == "pdfImages" and c[2] >= 1000 for c in page.evaluate("window.__mock.pdfCalls")), "…and a sharper picture is asked for")
    page.click("[data-testid=pdf-fit-page]"); page.wait_for_timeout(300)
    check(int(page.locator("[data-testid=pdf-zoom]").inner_text().rstrip("%")) <= 100, "fit page")
    page.click("[data-testid=pdf-fit-width]"); page.wait_for_timeout(200)
    page.click("[data-testid=pdf-night]"); page.wait_for_timeout(200)
    check("invert" in (page.locator("[data-testid=pdf-page-img]").get_attribute("style") or ""), "night mode inverts the page")
    shot(page, "4-night", page.locator("[data-testid=pdf-sheet]"))
    page.click("[data-testid=pdf-night]")
    page.click("[data-testid=pdf-panel-outline]"); page.wait_for_selector("[data-testid=pdf-outline-item]", timeout=3000)
    page.locator("[data-testid=pdf-outline-item]").last.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=pdf-page-input]").input_value() == "4", "the contents jump to their page")
    page.click("[data-testid=pdf-panel-thumbs]"); page.wait_for_function("() => document.querySelectorAll('[data-testid=pdf-thumb] img').length >= 4", timeout=4000)
    page.locator("[data-testid=pdf-thumb]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=pdf-page-input]").input_value() == "1", "the page pictures strip opens a page")
    page.click("[data-testid=pdf-panel-thumbs]")
    page.click("[data-testid=pdf-share-page]"); page.wait_for_timeout(600)
    sh = page.evaluate("window.__mock.shared")
    check(bool(sh) and sh["mime"] == "image/jpeg" and len(sh["b64"]) > 1000, "a page is shared as a picture")

    # selection → translate in the chat
    page.fill("[data-testid=pdf-page-input]", "2"); page.wait_for_selector("[data-testid=pdf-textlayer] [data-w='8']", timeout=4000)
    select_words(page, 3, 8)
    queue(page, ["يلتزم العميل بدفع أجر يومي"])
    page.click("[data-testid=pdf-sel-translate]")
    page.wait_for_function("() => [...document.querySelectorAll('[data-testid=pdf-msg-ai]')].some((e) => e.innerText.includes('يلتزم'))", timeout=8000)
    body = json.dumps(page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2)")[-1], ensure_ascii=False)
    check("Arabic" in body and "client shall pay a daily rate" in body, "Translate sends only the selected words, to Arabic, and the answer appears in this screen's chat")

    # ---- (2) kept between sessions
    page.click("[data-testid=pdf-tab-read]"); page.fill("[data-testid=pdf-page-input]", "3"); page.wait_for_timeout(800)
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.evaluate(NATIVE + "(%s, 4, 5)" % json.dumps(PAGES))
    open_tool(page)
    page.wait_for_selector("[data-testid=pdf-recent-item]", timeout=4000)
    check("contract.pdf" in page.locator("[data-testid=pdf-recent]").inner_text(), "after a restart the document is in Recent documents")
    shot(page, "5-recent")
    page.evaluate("window.__mock.pdfCalls = []")
    page.locator("[data-testid=pdf-recent-item] button").first.click()
    page.wait_for_selector("[data-testid=pdf-page-img]", timeout=5000)
    check(page.locator("[data-testid=pdf-page-input]").input_value() == "3", "it opens on the page where it was left")
    check(not any(c[0] == "pdfText" for c in page.evaluate("window.__mock.pdfCalls")), "…without reading the file again (text kept, file kept)")
    page.fill("[data-testid=pdf-page-input]", "2"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=pdf-user-hl]").count() == 1 and page.locator("[data-testid=pdf-note-pin]").count() == 1, "highlights and notes are kept")
    page.click("[data-testid=pdf-tab-chat]")
    check(page.locator("[data-testid=pdf-msg-ai]").count() >= 2, "the chat is kept")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(300)
    page.click("[data-testid=pdf-recent-del]"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=pdf-recent-item]").count() == 0, "a kept document can be deleted")

    # ---- (5) a 300-page file: first page at once, the rest without freezing
    page.evaluate(NATIVE + "(%s, 300, 3)" % json.dumps(PAGES))
    page.evaluate("""() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch (e) {} }""")
    t0 = time.time()
    page.set_input_files("[data-testid=pdfchat-file]", files=[{"name": "book.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4 big book"}])
    page.wait_for_selector("[data-testid=pdfchat]", timeout=10000); t_open = time.time() - t0
    page.click("[data-testid=pdf-tab-read]"); page.wait_for_selector("[data-testid=pdf-page-img]", timeout=5000); t_pic = time.time() - t0
    partial = page.locator("[data-testid=pdf-loading]").count() == 1
    page.wait_for_selector("[data-testid=pdf-loading]", state="detached", timeout=60000); t_all = time.time() - t0
    longest = max(page.evaluate("window.__long") or [0])
    print("300 pages: screen %.2fs, first page picture %.2fs, all text %.2fs, longest freeze %d ms" % (t_open, t_pic, t_all, longest))
    check(t_open < 2.0 and partial, "a 300-page file opens in %.2f s, before the rest is read" % t_open)
    check(longest < 600, "no long freeze while the rest is read (longest task %d ms)" % longest)
    page.fill("[data-testid=pdf-find]", "Agreement 297"); page.wait_for_timeout(400)
    check("p. 297" in page.locator("[data-testid=pdf-hits]").inner_text(), "the last pages are searchable afterwards")
    calls = [c for c in page.evaluate("window.__mock.pdfCalls") if c[0] == "pdfText"]
    check(calls[0][1:] == [1, 10] and len(calls) == 9, "read in parts: the first 10 pages, then 40 at a time (%d calls)" % len(calls))
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    print("screenshots:", SHOTS)
    ctx.close(); br.close()
env.close()
finish()
