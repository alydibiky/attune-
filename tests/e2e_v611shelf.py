"""v6.11 — Shelf («رف»): the notes as a shelf of books. Old notes move into «My Book»; books with built-in and
photo covers; notes; move; rename; delete + undo; reorder; search across books; reminders; Mind link; Arabic RTL.
Screenshots: tests/shelf-en.png, tests/shelf-ar.png.

  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v611shelf.py
"""
import json, os, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
HERE = os.path.dirname(os.path.abspath(__file__))

OLD = [
  {"id": "old1", "ts": 1759000000000, "kind": "note", "title": "Crane service", "text": "Call Karim about the Liebherr hose", "output": "", "tags": [], "meta": None, "pinned": False},
  {"id": "old2", "ts": 1759000001000, "kind": "note", "title": "الشريعة", "text": "ملاحظات عن الشريعة والفقه", "output": "", "tags": [], "meta": None, "pinned": False},
  {"id": "old3", "ts": 1759000002000, "kind": "instant", "title": "answer", "text": "q", "output": "a tool answer", "tags": [], "meta": None, "pinned": False},
]
SEED = "if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('attune:memory:v1', %s);}" % json.dumps(json.dumps(OLD))
# a small real JPEG (red 8x8) for the photo cover
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFTEMLQkAX8EH+Uq5nSsAAAAASUVORK5CYII=")

def open_shelf(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Shelf'), .rounded-t-2xl button:has-text('رف')").first.click()
    page.wait_for_selector("[data-testid=shelf-home]", timeout=5000)

def titles(page): return page.locator("[data-testid=shelf-book-title]").all_inner_texts()

def new_book(page, name, cover=None, photo=False):
    page.click("[data-testid=shelf-fab]")
    page.fill("[data-testid=shelf-book-name]", name)
    if photo:
        page.set_input_files("[data-testid=shelf-cover-file]", files=[{"name": "me.png", "mimeType": "image/png", "buffer": PNG}])
        page.wait_for_timeout(600)
    elif cover: page.click("[data-testid=shelf-cover-%s]" % cover)
    page.click("[data-testid=shelf-book-save]"); page.wait_for_timeout(200)

def open_book(page, name):
    page.locator("[data-testid=shelf-book-tile]", has_text=name).locator("[data-testid=shelf-cover]").click()
    page.wait_for_selector("[data-testid=shelf-book]", timeout=3000)

def write_note(page, title, body):
    page.click("[data-testid=shelf-new-note]"); page.wait_for_selector("[data-testid=shelf-editor]")
    page.fill("[data-testid=shelf-note-title]", title); page.fill("[data-testid=shelf-note-body]", body)
    page.wait_for_timeout(700)

def back(page): page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=SEED)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_shelf(page)

    # ---- migration: the old notes are in «My Book», a backup was kept, the tool answer is not a note
    check(titles(page) == ["My Book"], "the old notes are on the shelf in «My Book» (%s)" % titles(page))
    check("2 notes" in page.locator("[data-testid=shelf-book-count]").first.inner_text(), "My Book shows its note count (2)")
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:memory:preshelf-backup')).length") == 3, "the old data is backed up under its own key")
    bar = page.locator("[data-testid=shelf-bar]")
    check(all(bar.locator("[data-testid=%s]" % t).count() == 1 for t in ("shelf-menu", "shelf-alarm", "shelf-search-open", "shelf-add", "shelf-more")), "top bar: menu, alarm, search, + and ⋮")

    # ---- books: built-in cover, photo cover
    new_book(page, "Novels links", cover="girih")
    new_book(page, "Government Procedures and Papers", photo=True)
    new_book(page, "الشريعة والفقه", cover="ocean")
    check(titles(page) == ["My Book", "Novels links", "Government Procedures and Papers", "الشريعة والفقه"], "three books made: %s" % titles(page))
    st = json.loads(page.evaluate("localStorage.getItem('attune:shelf:v1')"))
    check(st["books"][1]["cover"] == "girih" and st["books"][2]["cover"].startswith("photo:cover:"), "a built-in cover and the person's photo cover are saved")
    t2 = page.locator("[data-testid=shelf-book-title]").nth(2)
    check(t2.evaluate("(e) => e.scrollWidth > e.clientWidth && getComputedStyle(e).textOverflow === 'ellipsis'"), "a long title is cut with …")
    page.wait_for_timeout(300)
    check(page.locator("[data-testid=shelf-cover]").nth(2).evaluate("(e) => getComputedStyle(e).backgroundImage.includes('data:image/jpeg')"), "the photo cover shows (cropped JPEG from IndexedDB)")
    page.screenshot(path=os.path.join(HERE, "shelf-en.png"))

    # ---- notes
    open_book(page, "Novels links")
    write_note(page, "Ibn Khaldun", "المقدمة — a great book\n- [ ] buy it\nhttps://example.com/muqaddimah")
    check(page.locator("[data-testid=shelf-check]").count() == 1, "a checklist line becomes a tick box")
    page.locator("[data-testid=shelf-check]").first.click(); page.wait_for_timeout(600)
    check("- [x] buy it" in page.input_value("[data-testid=shelf-note-body]"), "ticking it writes [x]")
    # reminder
    page.click("[data-testid=shelf-note-remind]")
    page.fill("[data-testid=shelf-remind-when]", "2030-01-02T09:30")
    page.click("[data-testid=shelf-remind-set]"); page.wait_for_timeout(300)
    sched = page.evaluate("window.__mock.notes")
    check(any(n["id"].startswith("shelf-") and n["title"] == "Ibn Khaldun" for n in sched), "the reminder goes to the phone (NATIVE.schedule)")
    back(page)
    write_note(page, "Second note", "to move later"); back(page)
    check(page.locator("[data-testid=shelf-note]").count() == 2, "two notes in the book")
    # move one note (single) via its editor
    page.locator("[data-testid=shelf-note]", has_text="Second note").click()
    page.click("[data-testid=shelf-note-move]")
    page.locator("[data-testid=shelf-pick]", has_text="الشريعة").click(); page.wait_for_timeout(250)
    back(page)
    check(page.locator("[data-testid=shelf-book]").inner_text().find("Second note") >= 0, "after a move the note shows in its new book")
    back(page)
    # multi-select move: both old notes from My Book to Novels
    open_book(page, "My Book")
    page.click("[data-testid=shelf-select]")
    for n in page.locator("[data-testid=shelf-note]").all(): n.click()
    page.click("[data-testid=shelf-sel-move]")
    page.locator("[data-testid=shelf-pick-book] [data-testid=shelf-pick]", has_text="Novels").click(); page.wait_for_timeout(250)
    check(page.locator("[data-testid=shelf-note]").count() == 0, "multi-select move empties My Book")
    back(page)
    counts = page.locator("[data-testid=shelf-book-count]").all_inner_texts()
    check(counts[1].startswith("3") and counts[3].startswith("1"), "counts follow the moves (%s)" % counts)

    # ---- rename + reorder
    page.click("[data-testid=shelf-more]"); page.locator("[data-testid=shelf-manage]").nth(1).click()
    page.click("[data-testid=shelf-edit]"); page.fill("[data-testid=shelf-book-name]", "Novels"); page.click("[data-testid=shelf-book-save]"); page.wait_for_timeout(200)
    check(titles(page)[1] == "Novels", "rename")
    page.click("[data-testid=shelf-more]"); page.click("[data-testid=shelf-reorder]")
    page.locator("[data-testid=shelf-move-up]").nth(3).click(); page.wait_for_timeout(150)
    page.click("[data-testid=shelf-reorder-done]")
    check(titles(page)[2] == "الشريعة والفقه", "reorder moves a book earlier (%s)" % titles(page))

    # ---- delete + undo
    page.click("[data-testid=shelf-more]"); page.locator("[data-testid=shelf-manage]").nth(2).click()
    page.click("[data-testid=shelf-delete-book]"); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(200)
    check("الشريعة والفقه" not in titles(page) and page.locator("[data-testid=shelf-undo]").count() == 1, "delete asks, then the book is gone with an Undo bar")
    page.click("[data-testid=shelf-undo-btn]"); page.wait_for_timeout(200)
    check(titles(page)[2] == "الشريعة والفقه" and page.locator("[data-testid=shelf-book-count]").nth(2).inner_text().startswith("1"), "undo brings the book back in place, with its note")

    # ---- search across books (Arabic folding: ه finds ة)
    page.click("[data-testid=shelf-search-open]"); page.fill("[data-testid=shelf-search-input]", "الشريعه"); page.wait_for_timeout(200)
    hits = page.locator("[data-testid=shelf-hit]")
    check(hits.count() == 1 and "Novels" in hits.first.inner_text(), "search finds an old note in another book and names the book")
    hits.first.click(); page.wait_for_selector("[data-testid=shelf-editor]")
    check(page.input_value("[data-testid=shelf-note-title]") == "الشريعة", "a result opens the note")
    back(page); back(page); back(page)

    # ---- reminders list
    page.click("[data-testid=shelf-alarm]")
    check(page.locator("[data-testid=shelf-reminder]").count() == 1 and "Ibn Khaldun" in page.locator("[data-testid=shelf-reminders]").inner_text(), "the alarm icon lists the upcoming reminder")
    back(page)

    # ---- group 2: rich text, undo, colour, tags, template, trash, archive, duplicate, merge, import
    open_book(page, "My Book")
    write_note(page, "Trip", "plan #travel")
    body = page.locator("[data-testid=shelf-note-body]")
    body.evaluate("(e) => { e.focus(); e.setSelectionRange(0, 4); }")
    page.click("[data-testid=shelf-fmt-bold]"); page.wait_for_timeout(100)
    check(page.input_value("[data-testid=shelf-note-body]").startswith("**plan**"), "bold wraps the selection in **")
    page.click("[data-testid=shelf-undo-text]"); page.wait_for_timeout(100)
    check(page.input_value("[data-testid=shelf-note-body]") == "plan #travel", "undo takes the bold back")
    page.click("[data-testid=shelf-redo-text]"); page.wait_for_timeout(100)
    check(page.input_value("[data-testid=shelf-note-body]").startswith("**plan**"), "redo puts it back")
    page.click("[data-testid=shelf-note-more]"); page.locator("[data-testid=shelf-color]").nth(5).click(); page.wait_for_timeout(100)
    check("words" in page.locator("[data-testid=shelf-info]").inner_text(), "note info shows dates and word count")
    page.click("[data-testid=shelf-star]"); back(page); page.wait_for_timeout(700); back(page)
    write_note(page, "Groceries", "milk"); back(page)
    check(page.locator("[data-testid=shelf-tag]").count() == 1, "a #tag shows as a filter chip")
    page.click("[data-testid=shelf-tag]")
    check(page.locator("[data-testid=shelf-note]").count() == 1 and "Trip" in page.locator("[data-testid=shelf-note]").first.inner_text(), "tag filter shows only tagged notes")
    page.click("[data-testid=shelf-tag]")
    check(page.locator("[data-testid=shelf-note]", has_text="Trip").get_attribute("style") is not None, "the note card shows its colour")
    page.select_option("[data-testid=shelf-sort]", "title")
    check(page.locator("[data-testid=shelf-note]").first.inner_text().startswith("Groceries"), "sort by title")
    # delete → trash → restore
    page.locator("[data-testid=shelf-note]", has_text="Groceries").click(); page.click("[data-testid=shelf-note-delete]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=shelf-note]", has_text="Groceries").count() == 0, "delete moves the note to the trash")
    back(page)
    page.click("[data-testid=shelf-more]"); page.click("[data-testid=shelf-open-trash]")
    check(page.locator("[data-testid=shelf-bin-note]").count() == 1, "the trash lists it")
    page.click("[data-testid=shelf-restore]"); back(page)
    # archive
    open_book(page, "My Book")
    check(page.locator("[data-testid=shelf-note]", has_text="Groceries").count() == 1, "restored from the trash")
    page.locator("[data-testid=shelf-note]", has_text="Groceries").click()
    page.click("[data-testid=shelf-note-more]"); page.click("[data-testid=shelf-archive]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=shelf-note]", has_text="Groceries").count() == 0, "archive takes it out of the book")
    # template
    page.click("[data-testid=shelf-book-more]"); page.locator("[data-testid=shelf-template]").first.click()
    page.wait_for_selector("[data-testid=shelf-editor]")
    check("Agenda" in page.input_value("[data-testid=shelf-note-body]"), "a meeting template fills the note")
    back(page)
    # import a Markdown file
    page.click("[data-testid=shelf-book-more]")
    page.set_input_files("[data-testid=shelf-import-file]", files=[{"name": "notes.md", "mimeType": "text/markdown", "buffer": "## Alpha\none\n## Beta\ntwo".encode()}])
    page.wait_for_timeout(400)
    check(page.locator("[data-testid=shelf-note]", has_text="Alpha").count() == 1 and page.locator("[data-testid=shelf-note]", has_text="Beta").count() == 1, "import a Markdown file: each ## section becomes a note")
    page.keyboard.press("Escape"); back(page)
    while page.locator("[data-testid=shelf-book]").count(): back(page)
    n_books = len(titles(page))
    # duplicate, then merge the copy back
    page.click("[data-testid=shelf-more]"); page.locator("[data-testid=shelf-manage]").first.click(); page.click("[data-testid=shelf-dup-book]"); page.wait_for_timeout(200)
    check(len(titles(page)) == n_books + 1 and titles(page)[1] == "My Book (2)", "duplicate a book: %s" % titles(page))
    page.click("[data-testid=shelf-more]"); page.locator("[data-testid=shelf-manage]").nth(1).click(); page.click("[data-testid=shelf-merge]")
    page.locator("[data-testid=shelf-merge-sheet] [data-testid=shelf-pick]").nth(1).click(); page.click("[data-testid=confirm-yes]"); page.wait_for_timeout(200)
    check(len(titles(page)) == n_books, "merge removes the merged book")

    # ---- Mind link:a Shelf note is a Mind record; open it in Mind; Mind's search finds it
    open_book(page, "Novels"); page.locator("[data-testid=shelf-note]", has_text="Ibn Khaldun").click()
    page.click("[data-testid=shelf-note-mind]"); page.wait_for_selector("[data-testid=mind-page]", timeout=4000)
    check("Ibn Khaldun" in page.locator("[data-testid=mind-page]").inner_text(), "Open in Mind shows the same note in Mind")
    back(page)
    page.wait_for_selector("[data-testid=mind-search]", timeout=4000)
    page.fill("[data-testid=mind-search]", "Khaldun"); page.wait_for_timeout(400)
    check("Ibn Khaldun" in page.locator("[data-testid=mind-page]").inner_text(), "Mind's search finds a Shelf note")
    mem = json.loads(page.evaluate("localStorage.getItem('attune:memory:v1')"))
    check(len([r for r in mem if r["title"] == "Ibn Khaldun"]) == 1, "one copy only (one source of truth: the note is the Mind record)")


    # ---- Arabic
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("window.__trMiss = new Set()")
    open_shelf(page)
    check(page.evaluate("document.documentElement.dir") == "rtl", "Arabic: the page is right-to-left")
    check(titles(page)[0] == "كتابي" and "رف" in page.locator("[data-testid=shelf-bar]").inner_text(), "Arabic: «رف» and «كتابي»")
    g = page.locator("[data-testid=shelf-cover]")
    check(g.nth(0).bounding_box()["x"] > g.nth(1).bounding_box()["x"], "Arabic: the first book is on the right")
    miss = [m for m in page.evaluate("[...window.__trMiss]") if m != "Attune"]
    check(not miss, "Arabic: no English strings missed on Shelf: %s" % miss[:6])
    page.screenshot(path=os.path.join(HERE, "shelf-ar.png"))

    errs = real_errors(errors)
    check(not errs, "no page errors: %s" % errs[:3])
    br.close()
env.close()
finish()
