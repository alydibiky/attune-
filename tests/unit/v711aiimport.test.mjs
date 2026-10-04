// v6.12 — a conversation shared from Gemini / ChatGPT / any AI is read and becomes the chat's context.
const I = await import("../../web-src/ai-import.js");
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
ok(I.shareLink("look https://share.gemini.google/M76X2XrLpG9c").from === "Gemini", "Ali's Gemini share link is recognised");
ok(I.shareLink("https://gemini.google.com/share/abc123def").from === "Gemini" && I.shareLink("https://chatgpt.com/share/6702-ab").from === "ChatGPT" && I.shareLink("https://claude.ai/share/x-y").from === "Claude", "Gemini, ChatGPT, Claude links");
ok(!I.shareLink("https://www.google.com/search?q=x") && !I.shareLink("no link"), "other links are not imports");
// a Gemini-like page: the conversation sits in an AF_initDataCallback blob (JSON inside a JS string)
const turn1 = "What are all the trims of the Lynk & Co 900 and their prices in China?";
const turn2 = "The Lynk & Co 900 comes in four trims: Pro (CNY 309,900), Max (CNY 339,900), Ultra (CNY 369,900) and Halo (CNY 399,900). Each uses the 1.5T EM-P hybrid with 2 motors.";
const blob = JSON.stringify([[null, [turn1]], [null, [[turn2]]]]);
const gem = `<html><head><meta property="og:title" content="Lynk &amp; Co 900 trims - Gemini"><title>Gemini</title></head><body><div>Sign in</div>
<script>AF_initDataCallback({key: 'ds:1', hash: '2', data:${JSON.stringify(blob)}, sideChannel: {}});</script><script>window.WIZ_global_data={"x":"abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ"};</script></body></html>`;
const g = I.fromPage(gem, { url: "https://share.gemini.google/M76X2XrLpG9c", from: "Gemini" });
ok(g.parts.some((p) => p.includes("Lynk & Co 900 and their prices")) && g.parts.some((p) => p.includes("CNY 399,900")), "the question and the answer are taken out of the script blob");
ok(!g.parts.some((p) => /abcdefghij|Sign in/.test(p)), "ids and page buttons are left out");
const block = I.contextBlock(g);
ok(/EARLIER CONVERSATION the user had with Gemini/.test(block) && /CNY 309,900/.test(block), "the context block the model reads");
// pasted text
const pasted = "You said: Compare the Liebherr LTM 1100-4.2 and Grove GMK5250L\n\nGemini said: The LTM 1100-4.2 lifts 100 t with a 60 m boom; the GMK5250L lifts 250 t with a 79 m boom.\n\nYou said: which is better for wind turbines?\n\nGemini said: The GMK5250L, for its reach.";
const t = I.fromText(pasted);
ok(I.looksLikeChat(pasted) && t.turns.length === 4 && t.turns[0].role === "user" && t.turns[1].role === "assistant" && t.from === "Gemini", "pasted 'You said / Gemini said' → 4 turns");
ok(/USER: Compare/.test(I.contextBlock(t)), "turns go into the context as USER / ASSISTANT");
let threw = ""; try { I.fromPage("<html><script>var a=1</script></html>", { from: "ChatGPT", url: "x" }); } catch (e) { threw = e.message; }
ok(/copy the conversation/.test(threw), "a private / sign-in page says to paste the text instead");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
