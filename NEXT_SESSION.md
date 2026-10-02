# Next session — Ali's full problem list (29 Sep – 2 Oct 2026, after v6.9)

Everything Ali found on his phone after v6.9, in one place. Ali keeps adding items (latest: section H,
2 Oct); when he sends more, add them under a new dated section at the end of the list.
- Phone: HONOR BKQ-N49, Snapdragon SM8850, Adreno 840 GPU. The Engine screen reports **16 GB** of RAM,
  not the 12 GB we planned for.
- Screenshots were sent in the chat.

Work through every item with a task list. Measure each fix on the real flow, and with real models where it
matters (speed, heat/energy, RAM, answer quality), before shipping it.

---

## A. Heat, speed and the engine (do these first: Ali feels them every day)

1. **The phone gets hot with ANY model, not only Zenith.**
   - The Engine card warns "This model is large for this phone… the phone gets warm" for Zenith (5.37 GB) on
     a 16 GB phone. Check why a 16 GB phone gets this warning.
   - The Engine log (29 Sep) shows:
     - `ggml_backend_opencl … failed to allocate 4372.52 MiB (err=-61)`: the GPU buffer fails
       (n_gpu_layers forced to 99), then it falls back.
     - "flash attention not supported by OpenCL, memory usage will increase".
     - The CLIP graph (the photo reader) runs ops OpenCL doesn't support.
     - "kleidiai: no kernel for tensor type q4_K (kernels available for Q4_0 and Q8_0)": the ARM fast
       kernels are NOT used by our K-quant/IQ4 files.
     - n_threads = 4.
     - A Qwen3.5 0.8B draft model is loaded next to Zenith, with 8K context and the weights in RAM.
   - To do:
     - Fit the GPU buffers (a lower -ngl / ubatch), or go CPU-only when OpenCL can't fit.
     - Measure Q4_0 files with KleidiAI (faster and cooler on ARM?).
     - Check the thread count (the big cores only?).
     - Check whether the draft model saves or costs energy.
     - Try a smaller KV cache.
     - Pause the model when the phone is idle; add a thermal throttle.
     - Find what heats the phone even with small models: a busy loop, polling, the WebView?

2. **Switching apps and coming back restarts the app and reloads the engine.**
   - Ali starts a prompt, switches apps while it answers, and on return:
     - the app is back on the home page;
     - the answer is lost;
     - the engine reloads for 27 s or more.
   - The log shows "Android asked for memory while Attune was in the background — the model was let go"
     4 times in 25 minutes.
   - Needed:
     - The answer keeps generating in the background (a foreground service that keeps the engine alive,
       using less memory so Android doesn't kill it).
     - The WebView and the open screen survive: no Activity recreation or reload; save and restore the
       screen, the chat and the running job.
     - Check Honor/MagicOS battery killing.

3. **Idea: use the phone's STORAGE to make the models lighter and more powerful.** Research and measure:
   - mmap'd weights read from flash instead of "weights in RAM";
   - streaming a mixture-of-experts model's experts from storage ("LLM in a flash" style), so a bigger MoE
     model runs in little RAM;
   - a KV cache / prompt cache saved to storage, so reloads are instant;
   - big offline knowledge packs searched from storage (RAG) instead of a bigger model.

   Ship only what keeps quality and speed.

## B. Answer quality

4. **Reasoning: the explanation must match the answer.**
   - The question: a seating puzzle ("A, B, C, D around a round table facing inward; A is not opposite C;
     B is immediately left of C; who is opposite B, who is immediately right of A?"), on Blaze+ with Think.
   - The final answer "A opposite B, D right of A" is RIGHT.
   - Its explanation "C, B, A, D (moving clockwise)" is WRONG: that order puts A opposite C. The right
     clockwise order is C, B, D, A.
   - Ali read it as a wrong answer. Check the working with code (like the maths check), or drop a wrong
     arrangement line.

5. **Engineering answers must be expert-level (Ali owns a crane company).**
   - The question: "valve cavitation during high-speed deceleration in an electro-hydraulic closed-loop
     positioning system, two direct fixes without reducing velocity".
   - The answer given was weak or wrong: "increase supply pressure" and "reduce valve restriction".
   - The expected answer:
     - Cause: the load's inertia overruns the actuator while the valve meters it out, so the inlet
       (meter-in) side is starved and drops below vapour pressure.
     - Fixes: anti-cavitation / make-up check valves (or a replenishing circuit) feeding that side, and
       meter-out / back-pressure control (a counterbalance valve, a matched asymmetric spool, or tank-line
       back-pressure).

6. **Strict output formats must be obeyed, and the named standard kept.**
   - "Output strictly as a Markdown table" for CAN bus vs Ethernet (Automotive **100BASE-T1**), on Blaze+:
     - it added a sentence before the table;
     - it compared 1000BASE-T1 instead of 100BASE-T1;
     - it claimed "up to 100000 Mbps", which is wrong;
     - a stray "Choose CAN bus if…" line and a "📄 Document" card came after the table.

## C. Web search and reports

7. **Web search still feels amateur. Ali wants it "Gemini-like".**
   - Example: "Lynk & Co 900" with Zenith + Web gave:
     - 5 short bullets from only 2 of the 5 pages read;
     - an odd claim ("lacks English language support");
     - a thin 2-row "Key figures" table;
     - the first line shown with literal `**` asterisks (a markdown rendering bug: fix it).
   - Goal: a full, well-structured answer, fast:
     - a direct answer first, then sections;
     - a real spec/comparison table (all versions and prices, as Ali always wants for cars);
     - pros and cons;
     - more and better sources, all of them used;
     - pictures when helpful;
     - suggested follow-up questions.

8. **Reports and proposals are generic, with IRRELEVANT sources.**
   - "Elevating Capital Projects: A Strategic Crane Rental Partnership" (for New Capital contractors):
     - it cites Windows camera error codes (0xA00F4244, 0x80070005) as crane "system failures" in 5 of 11
       sections;
     - it repeats the same two sources in every section ([1] a sales-prospecting blog, [5] a crane
       business-plan page);
     - it gives filler metrics ("Safety Record: Uncompromising");
     - it has no real fleet, prices or projects.
   - Needed:
     - The research drops off-topic pages.
     - The report uses Ali's own data, or asks for it: the company Adrighem and Aldibiki, 150 employees; the
       fleet of XCMG, Sany, Hitachi, Liebherr, Demag, Terex, Zoomlion and Grove cranes, 20–500 t.
     - No repeated sections, no filler.

## D. Tools

9. **Studio image generation is slow and the quality is bad.**
   - Prompt: "a massive red Liebherr crane lifting a heavy steel bridge beam at a construction site,
     sunset".
   - Result: a red crane over the SEA, with no beam and no site.
   - Sharpening took 1 min 42 s on the CPU; ×4 AI sharpen takes about 7 min.
   - Afterwards the chat model reloads ("Loading 11s").
   - Consider:
     - a better or distilled image model (SDXL-Turbo / SD 3.5 / FLUX-schnell class, int8/int4, on the NPU or
       GPU through QNN or LiteRT);
     - fewer steps;
     - not unloading the chat model.

10. **Fit & Food: photo recognition hangs, reloads, then crashes, and recognises no food; only 54 recipes.**
    - A photo of fried eggs on bread with Blaze+ stayed on "Recognising the food…" for a long time, then the
      screen reloaded and the app crashed.
    - Find the cause (memory? LiteRT vision on Blaze+? a timeout?).
    - Add a time limit with a fallback, and test on the real flow.
    - **Ali: it does not recognise ANY food from photos.** Photo recognition must work reliably on real
      phone photos, and must be tested with many real food photos (Egyptian dishes included), not only
      synthetic test images.
    - **The recipe database is far too small: only 54 recipes.** Ali wants a HUGE recipe database, with
      Egyptian and international dishes, calories and macros per serving, and ingredients and steps,
      searchable offline. Use large open sources, check their licences, and store them compactly on the
      phone.

11. **Mind.**
    - A saved photo (a screenshot) cannot be opened.
    - A saved answer with a table shows raw markdown (`Feature | CAN Bus | …`, `---|---|---`) instead of a
      rendered table.

12. **Money: "+250 EGP from my cousin Youssef" is not recorded the way Ali wants.**
    - It became Income · Other, with no account, no note and no person.
    - Keep who it was from (Youssef, cousin) and pick the right type/category: a gift, a repayment or a loan.
      Ask when unclear, remember the person, and fill the note.
    - Ask Ali exactly how he wants it recorded if that isn't clear.

## E. UI and UX

13. **Rework the WHOLE app's UI and UX "like an expert with 20 years in the field".**
    - Smoother everywhere: transitions, loading states, no reloads, fewer taps.
14. **Redesign the Fit & Food app completely.**
    - Cleaner, faster to log a meal, better than Yazio.

## F. Testing

15. **Max-test the biggest models: Everest, Everest XL, Apex and Apex+.**
    - So far they were only measured for size, Arabic drift (KLD) and speed on the ARM runner.
    - They are too big for the 15 GB test container, so run `tests/trials/max.mjs` on a bigger runner (a
      GitHub Actions large runner, or a manual workflow like `.github/workflows/model-bench.yml` with more
      RAM).

## G. Standing goal

16. **Keep looking for ways to make the app smoother, and every model lighter, faster and more accurate, without losing quality.**
    - Ali: "don't stop until you find a way without compromising anything" (not urgent, but always on).
    - Measure every idea before shipping it.

## H. Added 2 Oct 2026

17. **The file converter is still NOT top notch: a real PDF → Word lost its formatting.**
    - Ali's real example is saved in the repo: `tests/convert/fixtures/real/`
      - `biotech_assign_2.pdf` is the original (2 pages: a university assignment).
      - `biotech_assign_2.app-output.docx` is what the app produced.
      - `biotech_side_by_side_page1.png` and `..._page2.png` show original (left) and converted (right)
        rendered through LibreOffice.
    - What went wrong (measured on that file; our fidelity bench said 100 % because it only scored
      synthetic documents):
      - **The table runs off the page.** The docx has `tblInd=1800` (1.25") and `tblW=9040` on a 9360-wide
        text area, so it starts too far right and is cut at the page edge. In the PDF it sits exactly within
        the margins.
      - **The table lost its look:** the grey shaded rows, the centred cell text and the light borders.
      - **Subscripts, superscripts and italics are lost in the maths lines.** `Y_X/S = 0.60 g_X/g_S`
        became `YX/S = 0.60 gX /gS`, `q_S` became `qS`, and `h^-1` is rendered wrongly. The original lines
        are italic with real sub/superscripts.
      - **A symbol is missing** on page 1 ("observed biomass yield coefficient, ." should show Y_X/S);
        it is blank in the PDF's text layer too, so recover it (the font's ToUnicode map, or OCR on that
        glyph).
      - **Paragraphs are merged** that were separate in the PDF ("Product A: … Product B: …", "A student
        concludes: …", "Answer the following:").
      - **A wrapped line becomes a second paragraph** that is not indented ("…all cellular metabolic" /
        "activity has stopped? Explain.").
      - **The bold "a.", "b.", "c." labels** became a plain list with a tab and hanging indent. The
        original has bold labels and no list indent.
      - Line and paragraph spacing differ, and the left margin is off by a few points.
    - Goal: open the result next to the original and not be able to tell them apart (all formats: PDF →
      Word, Word → PDF, PowerPoint, Excel, ODT and RTF, which still copy only the text).
    - Method: add this real file and several more real documents (an Arabic CV, an invoice, a report with
      tables and maths) to the bench; score the table geometry (position, width, shading, alignment),
      sub/superscripts, paragraph breaks and label formatting; compare pictures of the pages, not only the
      text.

18. **New: a complete CV / Resume page, powered by AI, with absolute customisation.**
    - A full page of its own in the app (not a tab inside another tool).
    - Make CVs and resumes easily:
      - Many templates, and every part customisable: sections (add, remove, reorder by drag), fonts, sizes,
        colours, spacing, margins, columns, photo, icons, section titles, page size (A4 / Letter) and
        one or two pages.
      - A live preview while editing; several CVs saved on the phone; a copy per job.
      - Arabic and English, right-to-left and left-to-right, and mixed.
      - Applicant-tracking-system (ATS) friendly output.
    - AI on the phone's own model:
      - writes and improves the summary and the bullet points (action verbs, numbers);
      - fixes grammar, and translates between Arabic and English;
      - tailors the CV to a pasted job description (keywords, what to emphasise);
      - writes a matching cover letter;
      - imports an existing CV (PDF, Word or pasted text) and keeps its content;
      - suggests missing sections and checks for gaps and dates.
    - Export a perfect PDF and Word file (it must reuse the converter work in item 17), and share it.
    - Test it with real models and real CVs.

19. **Pasting or attaching a file shows "No model" (the engine chip says No model) even though models are installed.**
    - Ali pastes a file into the app (for example into Chat X-Ray, screenshot: 1,065 WhatsApp messages,
      "X-ray this chat") and the chip says "No model".
    - Probably Android released the model while the app was in the background (see item 2), or no
      model is selected.
    - Needed: when a feature needs the model, load the last-used installed model automatically (with a
      clear progress message), or offer one tap to do it. Never leave the user on "No model" when a
      model is installed. Check every tool that reads a file or a chat: X-Ray, the converter's translate,
      documents, photos.

## I. Added 2 Oct 2026 (second batch)

**Done already in the 2 Oct session (needs Ali's phone check):** the website follow-up. "Okay u do me the
frontend only for now" after a website request used to reach the model on its own and got "I cannot create a
functional website, as I am an AI language model". Now `websiteFollowUp()` continues the earlier website request,
and `refusesToBuild()` makes the app ask again as a code task if a model still refuses. Tests: unit v68
and `tests/e2e_v69site.py`.

20. **The engine does not load by itself: after tabbing out, sending a message gives "No model is running — open
    Engine and install or pick one" and the chip says "No model".** (Screenshot: the riddle "What gets smaller every
    time it takes a bath?" was typed after coming back.) Same root cause as items 2 and 19 (Android released
    the model in the background), but this one is the most visible, so do it first:
    - On app resume and before every send, if a model is installed and not running, load the last-used one
      automatically, show "Waking up Zenith… 12 s", keep the typed message, and send it when ready.
    - Never show "open Engine and install or pick one" when a model is installed.
    - Keep the model alive in the background where Android allows it (foreground service).

21. **Exact-length writing rules are not obeyed.** Screenshot (Blaze+, Think on): "Write a coherent response that
    contains exactly 17 words. The 17th (last) word must be 'seventeen'. No preamble, notes or explanations — only
    the text." The answers had 7 and 8 words, and "Try again" repeated the mistake.
    - Cause: `web-src/constraints.js` only checks "each sentence has exactly N words", "N sentences", "no letter X", no
      digits/symbols and "at most N words". It has NO rule for "exactly N words in the whole answer", "the Nth /
      last / first word must be X", "starts / ends with X", "N paragraphs", "N bullet points", "N characters".
    - Fix: add those rules; on a miss tell the model the exact count ("it has 7 words, it needs 17"); and
      finish with a deterministic fallback so the final answer is always correct (e.g. have the model write
      N−1 words, then code appends the required last word and trims or pads).
    - Check the same path on every engine (Blaze+ / LiteRT with Think, llama.cpp models). "Try again" must run
      the check again.

22. **Ideas from Ali's posts. Verdicts (build in this order):**
    - *From the Facebook thread on "what AI agent would you want":*
      - **Personal business operations agent (proactive):** a daily brief that gathers what needs doing today: open
        promises and unanswered questions found by Chat X-Ray, money owed to Ali and by him (Money debts),
        reminders and calendar, leads and follow-ups (Business), and one-tap drafted replies in Egyptian Arabic. It
        runs on a schedule and notifies, instead of waiting for prompts. Fits Adrighem and Aldibiki (150 employees). Email
        access is online-only and optional; start from share-to-Attune, the phone calendar and notification
        access (optional, off by default).
      - **One place for all project knowledge:** extend Mind (Ask your Mind with sources) with projects/jobs: WhatsApp
        exports, voice notes, PDFs, photos, invoices, all searchable and answerable per project.
      - **Analyse data safely:** spreadsheet and PDF questions run as code on the phone (already partly there); extend it.
      - **Skip for now:** an agent that operates web apps for you (prompt-injection and safety risk, weak with
        small models).
    - *From the Arabic AI-tool lists (Godmode, Fireflies, Tripenotes, Stockimg, My AI Front Desk, Namy,
      Undetectable AI, Dr Tessa, Replika, AI Tree, AskYourPDF, Quillbot, Lensa, ChatGPT, Midjourney, Tome, Tabnine,
      Durable, Murf AI, Copy AI, Character AI, Looka, Tryellie, GeneratePrompt, Notion, Katteb, Designer, Influence Me):*
      - **Add:** CV maker with an AI HR coach (Influence Me → item 18); meeting and call notes (Fireflies): record,
        transcribe on the phone, summary, action items, who promised what, saved to Mind; customer-reply drafts in
        Egyptian Arabic (Tryellie / My AI Front Desk; auto-answering 24/7 needs the WhatsApp Business API, so
        start with suggested replies); chat with a PDF or book with page citations (AskYourPDF); proofreader and
        paraphraser, Arabic and English, with tone choices (Quillbot / Katteb / Copy AI); business name, slogan and
        logo maker (Namy / Looka: names by the model, logos as SVG); a "Do it for me" agent that chains our tools
        (Godmode: research → summary → report → slides); a better trip planner (Tripenotes; a Travel tool exists);
        persona chat for practice, such as a Turkish tutor and interview practice (Character AI);
        natural-sounding text-to-speech for voice-overs, Egyptian Arabic first (Murf).
      - **Already have:** ChatGPT-style chat, Tome (slides), Tabnine (Code), Durable (websites), GeneratePrompt (prompts
        for other AIs), Notion-style notes (Mind).
      - **Later, after Studio is fixed (item 9):** Midjourney, Stockimg and Lensa-style images and avatars.
      - **Skip:** Undetectable AI (the point is to hide AI writing from detectors; offer an honest "make it sound
        natural / in my voice" rewrite inside the proofreader instead); Dr Tessa and Replika (mental-health
        therapy and companionship are risky; maybe a plain wellbeing journal); AI Tree (a directory of tools).
    - *Not an app feature:* the third Facebook screenshot (cheaper models for Claude Code, Open Router, plan limits) is
      advice about how we develop the app, not about what the app does.

23. **Plugins and Skills inside Attune (Ali asked "can I add plugins and skills?": yes).** Build in three steps, safest first:
    - **Skills (text only, safe, cheap):** a skill is a small file: name, when to use it, instructions, an example.
      The app already has a tips and recipes library (`tips.js`, `skillFor`); open it to the user:
      create, import, share (file / QR / link) and switch on or off. Match by command (`/quote`) or automatically
      by description (on-device search). Examples: a "crane quote writer", an "invoice reply in Egyptian
      Arabic", a "Turkish tutor". Nothing runs; it only adds instructions to the prompt, so it also helps small models.
    - **Plugins, step 1 (declarative):** a plugin is JSON: an input form, a prompt template, an output shape (text,
      table, file). No code, so no risk.
    - **Plugins, step 2 (code):** JavaScript in the existing sandbox (`sandbox/js-worker.mjs`, no network, no
      storage unless allowed) with a visible permission list (network domains, files, camera, location),
      a package format that is signed, and a kill switch. Google Play allows interpreted JavaScript in a
      sandboxed WebView but not downloaded native code (dex/.so), so no native plugins.
    - Optional online connectors (like MCP) later, off by default.
    - A Plugins and Skills page with a built-in catalogue, import and an "ask the AI to write a skill for me" button.

24. **"Add any model" (Engine screen): decide what to do with it.**
    - What it is: a box to install any GGUF model from Hugging Face as `owner/repo:QUANT` (or a direct https
      link); the photo reader is fetched too when the repo has one. Why it exists: new and specialist models
      (coding, Arabic, medical, fine-tuned) appear every week; this lets power users install them without waiting for an
      app update, all offline once downloaded.
    - Problems: a too-big model overheats the phone or is killed; unknown quality; it shows the vendor and format
      names we hide everywhere else (Ali's rule); an average user can break the engine.
    - Proposal: move it into an "Advanced" section (collapsed); before downloading, show the size against free RAM and
      warn ("too big for this phone", "will run hot"); refuse files the engine cannot load; label such models
      "Community"; run a 20-second self-test after install and show the result; keep it to power users.

## J. Added 2 Oct 2026 (third batch) — NOT STARTED: Ali will say when to begin

25. **Shelf (رف): rebuild the Notes part as a shelf of notebooks (layout reference only: `tests/fixtures/reference/notebooks-app-screenshot.jpg`).**
    - Name decided with Ali on 2 Oct: the feature is called **Shelf** (Arabic **رف**); each notebook on it is a "book" / «كتاب». Do not use the name "Notebooks" in the app. Check Play Store for clashes before release.
    - Which app: the phone's built-in **Notebook** app (the stacked-papers icon on the home screen; Ali sent a screenshot of it on 2 Oct). Copy its ideas (grid of covers, easy notes), not its name, icon or cover artwork: Shelf gets its own look.
    - What the reference shows: a **Notebooks** home screen with a grid of notebook covers (two per row), each with a
      cover picture and a title under it (long titles cut with "…"; Arabic titles such as «الشريعة» work); a top bar
      with a menu, the title, a reminders (alarm) icon, search, "+" and a "⋮" menu; a round "+" button at the bottom
      right to add a notebook; dark theme.
    - Plan (confirm details with Ali when he says start): several notebooks, each holding its own notes; cover
      pictures (built-in covers + a photo of his own); rename / delete / reorder / move notes between notebooks; search
      across all notebooks; reminders on notes; Arabic and English with the right direction; works with Mind
      (notes can be saved to or searched from Mind) and keeps all existing notes (put them in a first "My Notebook").
    - Do NOT start until Ali says so.

---

## Prompt to start the next session

```
Continue Attune on branch claude/attune-android-continuation-4lp2wq.
First read HANDOFF.md and NEXT_SESSION.md, then fix EVERY item in NEXT_SESSION.md, one by
one, with a task list. Start with section A (heat, the engine reload, the app restarting
when I come back), item 10 (Fit: the photo crash, no food recognised, only 54 recipes), item 17
(the file converter is still not top notch: use the real file in tests/convert/fixtures/real/),
item 19 ("No model" on paste), item 20 (the engine must load by itself) and item 18 (the new CV / resume page); then 21 (exact-length rules), 22 (Ali's feature verdicts), 23 (plugins and skills) and 24 (Add any model). Measure each fix on the real flow
and with real models (speed, heat/energy, RAM, answer quality) before shipping it.
Research item 3 (use the phone's storage to make models lighter and stronger) and ship
only what keeps quality and speed. Rework the whole app's UI/UX like an expert with
20 years of experience.

Standing rules:
- Never commit *private-key*.json; never change app/attune-test.keystore.
- Targeted fixes, except the UI/UX rework and the Fit & Food redesign I asked for.
- Explain every step simply, with technical terms in English AND Egyptian Arabic.
- Commit as Claude <noreply@anthropic.com>; no model names in commits or code.
- Run ALL tests (bash tests/run_all.sh) before pushing to main; push to main and the branch.
- Watch "Build the APK" on main and give me the link.
- Answer every point I ask; don't stop to ask me unless something is irreversible.
- Keep searching for ways to make the app smoother and every model lighter, faster and
  more accurate without compromising anything, and don't stop until you find them.
```
