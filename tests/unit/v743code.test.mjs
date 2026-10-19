// v6.43 (Ali: "Make me a complete clothing brand for swimsuits…" → a Python script whose tests failed for 30 minutes,
// and a page with a second page glued on): a brand / shop / game is a web page; a page missing only </body></html> is closed by code.
import * as C from "../../web-src/code.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(C.guessLang("Make me a complete clothing brand for swimsuit for men that is called skittlz swimsuits") === "html", "a clothing brand is a web page");
ok(C.guessLang("اعملي موقع لمحل ملابس") === "html" && C.guessLang("a snake game") === "html", "a shop site (Arabic) and a game are pages");
ok(C.guessLang("calculate compound interest for 10 years") === "python" && C.guessLang("analyze this csv of sales") === "python", "calculations and data stay Python");
ok(C.guessLang("make a python script for my shop's stock") === "python", "asking for Python wins");
const cut = "<!doctype html><html><head><style>a{}</style></head><body><p>x</p><script>let a=1;</script>";
ok(C.closeHtml(cut) === cut + "\n</body>\n</html>\n", "only the closing tags missing → closed by code");
ok(C.closeHtml("<!doctype html><html><body><div class=\"a") === null, "really cut mid-tag → the model continues");
ok(C.joinCont("<html><style>a{}</style><body><script>x</script>", "<style>b{}</style><p>dup</p>") === "<html><style>a{}</style><body><script>x</script>", "a second <style> page is not glued on");
console.log(bad ? bad + " FAILED" : "ALL PASSED");
