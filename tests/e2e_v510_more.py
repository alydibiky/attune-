"""v5.10 sections for e2e_v510.py: loops, verify, photo (see there)."""
import os, base64
from harness import new_page, check, HERE

def install(page):
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)

def send(page, text):
    page.locator("textarea[placeholder='Message Attune']").fill(text)
    page.locator("button[title='Send']").click()

LOOP = """Let d be the distance between Town A and Town B.
1. Time from A to B: $t_{AB} = \\frac{d}{30}$ hours.
2. Solve for $x$:
""" + "\n".join(["    (Correction: $\\frac{2}{60} - \\frac{1}{30} = \\frac{1}{30} - \\frac{1}{30}$ is incorrect. Let's redo step 6.)\n    $60.6666... + \\frac{1}{x} = 0.3333...$"] * 8)

PROGRAM = """```python
import sympy as sp
x, d = sp.symbols('x d', positive=True)
# time out and back
t_total = d/30 + d/x
# average speed = total distance / total time
avg = 2*d / t_total
sol = sp.solve(sp.Eq(avg, 60), x)
print("solutions:", sol)
if not sol:
    print("ANSWER: impossible — the first leg alone already uses all the time a 60 km/h average allows")
else:
    print("ANSWER:", sol[0], "km/h")
```"""
EXPLAIN = "**It is impossible — no return speed works.**\n\n1. At 60 km/h average, the round trip 2d may take 2d/60 = d/30 hours.\n2. The first leg alone already took d/30 hours.\n3. So the return would need zero time: infinite speed."

BUGGY_PROGRAM = "```python\nshirts = 5\nhours = 4\nprint('ANSWER:', hourz, 'hours')\n```"
FIXED_PROGRAM = "```python\n# the shirts dry at the same time, side by side\nhours = 4\nprint('ANSWER:', hours, 'hours (they dry in parallel)')\n```"

SNAP_BUGGY = """```python
class SnapshotArray:
    def __init__(self, length: int):
        self.snap_id = 0
        self.hist = [[(0, 0)] for _ in range(length)]
    def set(self, index: int, val: int) -> None:
        self.hist[index].append((self.snap_id, val))
    def snap(self) -> int:
        self.snap_id += 1
        return self.snap_id
    def get(self, index: int, snap_id: int) -> int:
        import bisect
        h = self.hist[index]
        i = bisect.bisect_right(h, (snap_id, float('inf'))) - 1
        return h[i][1]

# --- tests ---
a = SnapshotArray(3)
a.set(0, 5)
assert a.snap() == 0
a.set(0, 6)
assert a.get(0, 0) == 5
a.set(1, 1); a.set(1, 2)
assert a.snap() == 1
assert a.get(1, 1) == 2
assert a.get(2, 1) == 0
print("ALL TESTS PASSED")
```"""
SNAP_FIX = """<<<<<<< SEARCH
        self.snap_id += 1
        return self.snap_id
=======
        self.snap_id += 1
        return self.snap_id - 1
>>>>>>> REPLACE"""

def sections(env, errors):
    def sec_loops(br):
        ctx, page = new_page(br, env, errors)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        install(page)
        page.evaluate("(t) => { const M = window.__mock; M.fakeQueue = [t]; M.slowQueue = 10; M.cancelled = 0; }", LOOP)
        send(page, "Tell me a story about towns A and B")   # (not a word problem: goes straight to the model)
        page.wait_for_selector("button[title='Regenerate']", timeout=30000)
        txt = page.locator(".att-md").last.inner_text()
        check(txt.count("Correction") == 1, "a looping answer is cut after the first repeat (%d copies shown)" % txt.count("Correction"))
        check(page.evaluate("window.__mock.cancelled") >= 1, "…and the engine is told to stop writing")
        check(page.locator("[data-testid=loop-note]").count() == 1, "…with a small note that a repeat was stopped")
        check("t_AB = d/30 hours" in txt and "\\frac" not in txt and "$" not in txt, "maths is shown as readable text, not raw LaTeX")
        # (the main chat request — v5.17 may add a "write a program" request after
        #  it to re-check a sum, which rightly carries no anti-loop settings)
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2 && String((x.messages[0] || {}).content).includes('You are Attune'))[0]")
        # v5.13: no plain repeat penalty (it damaged numbers: "10,0400"); loops
        # are stopped by DRY + no-repeat n-gram + the live guard instead.
        check(b.get("repeat_penalty", 1) == 1 and b.get("dry_multiplier", 0) > 0 and b.get("no_repeat_ngram", 0) > 0,
              "every request carries anti-loop settings (DRY, no-repeat n-gram) and NO digit-damaging repeat penalty")
        ctx.close()

    def sec_verify(br):
        ctx, page = new_page(br, env, errors)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        install(page)
        page.evaluate("([a, b]) => { const M = window.__mock; M.fakeQueue = [a, b]; M.bodies = []; M.slowQueue = 5; }", [PROGRAM, EXPLAIN])
        send(page, "A commuter drives from Town A to Town B at a constant speed of 30 km/h. She turns around immediately and drives back along the same route. At what constant speed must she make the return trip so that her average speed for the entire round trip is 60 km/h?")
        page.wait_for_selector("[data-testid=verified]", timeout=120000)
        txt = page.locator(".att-md").last.inner_text()
        check("impossible" in txt.lower(), "the trick question is answered 'impossible', from a program the phone ran (sympy found no solution)")
        bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
        check("ANSWER:" in bodies[0]["messages"][0]["content"], "step 1: the model was asked for a program, not an answer")
        check("Final result: impossible" in bodies[-1]["messages"][-1]["content"], "step 3: the explanation was written from the computed result")
        page.locator("[data-testid=verified] button").first.click()
        check("sp.solve" in page.locator("[data-testid=verified]").inner_text() and "solutions: []" in page.locator("[data-testid=verified]").inner_text(),
              "the check can be opened: the program and what it printed")
        # a broken program is fixed from its real error
        page.evaluate("([a, b, c]) => { const M = window.__mock; M.fakeQueue = [a, b, c]; M.bodies = []; }",
                      [BUGGY_PROGRAM, FIXED_PROGRAM, "**4 hours.** The shirts dry side by side, so 20 take as long as 5."])
        send(page, "If it takes 4 hours for 5 wet shirts to dry outside in the sun, how long will it take 20 wet shirts to dry under identical conditions?")
        page.wait_for_function("document.querySelectorAll('[data-testid=verified]').length === 2", timeout=120000)
        bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
        check(len(bodies) == 3 and "NameError" in bodies[1]["messages"][-1]["content"], "a program that crashes is sent back with its real error and fixed")
        check("4 hours" in page.locator(".att-md").last.inner_text(), "…and the answer comes from the fixed program")
        # a coding request in chat is tested before it is shown
        page.evaluate("([a, b]) => { const M = window.__mock; M.fakeQueue = [a, b]; M.bodies = []; }", [SNAP_BUGGY, SNAP_FIX])
        send(page, "Write a Python 3 class SnapshotArray(length) with set(index, val), snap() returning a 0-based snap_id, and get(index, snap_id) in O(log S) using bisect.")
        page.wait_for_selector("[data-testid=code-check]", timeout=120000)
        cc = page.locator("[data-testid=code-check]").inner_text()
        check("Tested on this phone" in cc and "passed" in cc, "a coding request in Chat is written with tests, run, fixed and only then shown: " + cc)
        check("return self.snap_id - 1" in page.locator(".att-md").last.inner_text(), "…and the shown code is the fixed one (snap ids start at 0)")
        page.screenshot(path=HERE + "/v510-verify.png", full_page=True)
        ctx.close()

    def sec_photo(br):
        ctx, page = new_page(br, env, errors)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        install(page)
        png = page.evaluate("""() => { const c = document.createElement('canvas'); c.width = 3000; c.height = 2000; const g = c.getContext('2d'); g.fillStyle = '#556b2f'; g.fillRect(0,0,3000,2000); g.fillStyle='#fff'; g.font='200px sans-serif'; g.fillText('ECAR', 900, 1000); return c.toDataURL('image/png').split(',')[1]; }""")
        path = os.path.join(HERE, "_car.png"); open(path, "wb").write(base64.b64decode(png))
        page.set_input_files("input[type=file][accept='image/*']", path); os.remove(path)
        page.wait_for_selector("textarea[placeholder='Message Attune'] >> xpath=../div//img", timeout=5000)
        page.locator("button:has-text('Web')").first.click()
        page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['ECAR E5 electric SUV', 'NONE', 'NONE', 'This is an **ECAR E5** electric SUV [1].']; M.bodies = []; }")
        send(page, "what is this car")
        page.wait_for_selector("button[title='Regenerate']", timeout=30000)
        bodies = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2)")
        first = bodies[0]["messages"][-1]["content"]
        check(isinstance(first, list) and any(p.get("type") == "image_url" for p in first) and "name exactly what it shows" in str(first),
              "with a photo and Web on, the model first LOOKS at the photo")
        check(page.evaluate("window.__mock.lastSearch.q").startswith("ECAR E5 electric SUV"), "…and the web is searched for what it saw, not for 'what is this car'")
        img0 = bodies[0]["messages"][-1]["content"][1]["image_url"]["url"]
        check(len(img0) < 900000, "a 3000×2000 photo is shrunk before it is sent (%d KB)" % (len(img0) // 1024))
        page.locator("button:has-text('Web')").first.click()   # web off
        page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['It is dark green.']; M.bodies = []; }")
        send(page, "what colour is it?")
        page.wait_for_function("document.querySelectorAll('button[title=Regenerate]').length >= 2", timeout=30000)
        b = page.evaluate("window.__mock.bodies.filter(x => x.max_tokens > 2).pop()")
        last = b["messages"][-1]["content"]
        check(isinstance(last, list) and any(p.get("type") == "image_url" for p in last), "a follow-up about the photo gets the photo again (the model can still see it)")
        ctx.close()

    return {"loops": sec_loops, "verify": sec_verify, "photo": sec_photo}
