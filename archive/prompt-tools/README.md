# The prompt-tool pages — archived 4 Nov 2026 (v9.1)

Improve a prompt (for ChatGPT / Claude / Gemini…), Compress, Humanize, Copilot (bring a chat from another AI), Prompt lab.
Ali, 4 Nov: "can't they just be in home chat — I write 'improve this prompt for Claude' or 'humanize this'".

## What happens now
- Chat reads the request (`web-src/prompttools.js`, English + Egyptian Arabic; tests/unit/v911prompttools.test.mjs) and runs the SAME
  tuned functions the pages used — `aiRewrite`, `aiHumanize`, `aiCompressTarget` in attune.jsx — through the chat api's `promptTool`.
  With no text after the request ("humanize this"), Chat's last answer is the text.
- The Writing page (kept) sends its text to Chat as one of those requests.
- `attune-routes.jsx.txt` holds the cut-out screens (humanize, copilot, library, improve). Their state in the App component stays (unused).

## To bring the pages back
Remove "improve", "compress", "humanize", "copilot", "library" from web-src/removed.js, paste the routes back before `) : mode === "write"`,
and give WritingBox its old onGo (git history at the commit "Prompt tools become Chat commands").
