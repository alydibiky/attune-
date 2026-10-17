# Next session — Ali's full problem list (29 Sep – 17 Oct 2026; newest: section Y, then X, then the prompt at the end)

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

## K. Added 2 Oct 2026 (fourth batch)

26. **Business systems / ERP: make them professional enough that a company pays for them.** Decisions (Ali, 2 Oct):
    - **Flagship pack: General trading & shop** (not cranes first). Then contracting, crane rental, others.
    - **First release includes ALL of:** (1) invoices, quotes, VAT and withholding tax, PDF/Word, Arabic WhatsApp share;
      (2) payments, overdue tracking, ageing 30/60/90, customer statements, overdue reminders; (3) stock and purchasing
      (items, stock moves, reorder alerts, purchase orders, supplier bills, payables); (4) dashboards and reports
      (today's numbers, profit per customer/product, cash position, monthly P&L, Excel export).
    - **Navigation:** dashboard home (cash, overdue, low stock, big action buttons) + fixed modules (Sales, Purchases,
      Stock, Money, Reports) + a "Custom tables" area for the existing no-code builder.
    - **Look:** clean accounting look (light background, one brand colour, dense clear tables, documents that look like real
      invoices); must also work in the dark theme.
    - **Wording:** both English and Arabic. Screens follow the app language with Egyptian accounting terms (فاتورة ضريبية،
      خصم من المنبع، أعمار الديون، مستخلص) + a plain-words tooltip; printed documents show both languages side by side.
      (Assumption: change if Ali meant something else.)
    - **Pricing** (still to decide with Ali): EGP 14,999 once, plus a yearly update fee for tax-rate changes was suggested.
    - **Engine work first** (from the Opus plan): IndexedDB store (localStorage hits its limit at ~10–20k rows); new field types
      `lines` (child rows inside a document), `rollup`, `lookup`, `attachment`, `percent`, `datetime`; formula IF/AND/OR/TODAY;
      locked "system tables" the AI cannot redesign; money in integer piastres with a fixed rounding rule.
    - **Documents:** draft → posted → void; gapless numbering per series per year assigned at posting; posted = immutable,
      corrections by credit note; VAT 14% (0% / exempt codes), table tax before VAT, withholding as a customer deduction
      that reduces cash due, rates stored as editable dated settings. ETA e-invoice: store every required field and export the
      ETA JSON, but never claim to sign or submit (that needs a token / online step).
    - **Also planned:** payments with allocations, ageing, statements, credit-limit warning; purchasing (PO → bill → payables);
      inventory from stock moves with moving-average valuation; expenses with receipt photos; cash/bank accounts; ledger
      (journal, P&L, trial balance, simple cash flow); owner + PIN + roles; hash-chained audit log; multi-currency;
      encrypted auto-backup; company letterhead (logo, tax ID, bank details); WhatsApp share and overdue reminders.
    - **Phase 2:** roles, multi-currency, ETA JSON export, contracting pack. **Phase 3:** payroll, bank reconciliation,
      multi-device sync, more packs, photo-to-bill.
    - **Tests:** golden finance-maths unit tests (rounding per line, VAT on table-tax base, withholding, ageing boundaries,
      moving average, journal always balances), e2e flows (quote → invoice → payment → statement; backup → wipe → restore),
      a 50k-row performance test, real-model trials (JSON validity, never inventing numbers); ask an Egyptian accountant to
      sign off the tax examples before release.
    - **Honest risks:** tax rates change; ETA cannot be fully offline; data loss on a single phone → scheduled backups.

## L. Added 4 Oct 2026 (after testing 6.11) — done in v6.12 unless marked
27. ✅ Import CV did nothing (cut-off model JSON + invisible error toasts).
28. ✅ A 10-slide PowerPoint showed as 2 pages in Ask a PDF.
29. ✅ Attach more than one PDF / file / photo to a chat message.
30. ✅ Import the phone's Notebook notes into Shelf easily (share → Save to Shelf; Import notes with many formats; paste).
31. 🟡 Food photo recognition "still bad" (eggs on toast → one "Fried egg", duplicate chips): prompt/parse/hint fixes measured with
    the real model on his photo (4 eggs + 4 toast). Still needs his phone check with Blaze+ and more real photos.
32. 🟡 Web search "still bad, fix it for good": junk/off-topic pages never used, 4 engines, pictures, next-question chips.
    Needs his phone check and 2–3 concrete questions that still disappoint.
33. 🟡 Maps rework: search fixed (Photon + Nominatim + Overpass), pin + save, my location. The visual rework needs his look choice.
34. ✅ Instant "What are my expenses in the last 4 days" now answered from Money by code.
35. ✅ The "…was promised to you and is late" banner from a note-to-self; Catalogue button wrapping.

## M. Added 4 Oct 2026 (evening) — and the SPLIT between two accounts
New from Ali after 6.12 work:
36. ✅ Food photo in ~1 s (fast look shown at once, AI double-checks in the background; offer to get the fast pack).
37. ✅ Chat Auto: picks the best installed model per question, Web Off/Auto/On (Auto by default), thinking when needed.
38. ✅ Continue a chat shared from Gemini / ChatGPT / Claude / any AI (link or pasted text) — phone check needed: Gemini share
    pages may load the conversation by script only; then the app asks to paste the text.
39. ✅ High-end models "disappeared": the Engine list hid every model too big for the phone; on 12 GB+ phones they are listed again.
40. ⬜ Web search better than Gemini — target saved in `tests/websearch/targets/README.md` (Ali's "Geely Galaxy M9 vs Lynk & Co 900").
    Done so far: topic templates (vehicle/machine/gadget/place/org: versions & prices table, specs, pros/cons, rivals, Egypt),
    topic searches, junk filter, 4 engines, pictures, follow-up chips. Still to do: a COMPARISON template (each car, then a
    head-to-head table + advantages/disadvantages), per-trim spec tables, page-by-page notes for every trim, measuring with a
    real 4B/9B model, and FIX `tests/e2e_v514.py` (a prompt overflows the test model's 4,096-token window since the templates).
41. ⬜ Every big feature its own professional, customisable page like Business: Mind (better than the "My Mind" app), Coding
    (better look, more power), Learn daily (attractive; real courses, e.g. "Turkish from beginner to expert in 30 small
    lessons"), Cycle (chat that knows all period data), Yusr/Money; plus the whole-app UI/UX rework and the Maps look.
    These are LOOK choices: show Ali 2–4 options (screenshots/mock-ups) first, then build the one he picks.

### The split (two accounts work at the same time — different files, different branches)
- **Account A — "Engine & answers"** (this branch `ccr-a0eb3595-e2c7a7` → `main`): item 40 (web search), item 15 (big-model
  max-tests), A1/A3 (heat/storage), 4–8 (answer quality), the converter (17), Business leftovers (ETA is done; roles, multi-
  currency, price lists), and RELEASE DUTY: full `bash tests/run_all.sh`, version bump, push `main`, watch "Build the APK".
  Files: `web-src/chat.jsx`, `research.js`, `webrank.js`, `answerfix.js`, `factsheet.js`, `router.js`, `WebTools.kt`,
  `convert*.js`, `books*`, engine Kotlin.
- **Account B — "Pages & look"** (its own branch, e.g. `claude/pages-ui`): item 41 + 13/14 (UI/UX rework, Fit home redesign) +
  Maps look + 24 (Add any model) + plugins step 2. Files: `mind-ui.jsx`/`mind.js`, `code-ui.jsx`/`code.js`, `daily-ui.jsx`/
  `daily.js`, `cycle.jsx`, `yusr/`, `fit-ui.jsx`, `shelf-ui.jsx`, new `*-page.jsx` files. In `attune.jsx` only the lines that
  open a page (keep those edits small: it is the file both accounts touch). Before pushing: merge `origin/main`, build, run
  the tests of the pages touched, then push the branch; Account A merges it into `main` after the full test run.

**Prompt for Account A (paste in a new session on this repo):**
```
Continue Attune as "Account A — Engine & answers". Read CLAUDE.md, then NEXT_SESSION.md sections L and M, and HANDOFF §5.40.
Work on branch ccr-a0eb3595-e2c7a7. First fix tests/e2e_v514.py (a prompt overflows the 4,096-token test window since the
answer templates), then item 40: web answers at least as deep as tests/websearch/targets/README.md (Gemini's Galaxy M9 vs
Lynk & Co 900) — a comparison template, per-trim tables, every figure cited. Then the rest of Account A's list. Run ALL
tests, push main, watch "Build the APK", give me the link. Merge Account B's branch when it is ready.
```

**Prompt for Account B (paste in a new session on this repo):**
```
Continue Attune as "Account B — Pages & look". Read CLAUDE.md, then NEXT_SESSION.md sections L and M (item 41) and
HANDOFF §5.40. Create branch claude/pages-ui from origin/ccr-a0eb3595-e2c7a7. Make every big feature its own professional,
customisable page like Business: Mind (better than the My Mind app), Coding (better look, more power), Learn daily
(attractive, real courses like "Turkish from beginner to expert in 30 small lessons"), Cycle (a chat that knows all my period
data), Yusr/Money; then the whole-app UI/UX rework and the Maps look. For every look decision show me 2–4 options with
screenshots first and build the one I pick. Keep attune.jsx edits small (Account A also edits it). Run the tests of what you
touch, merge origin/main before pushing, and push your branch (not main).
```

---

## N. Added 4 Oct 2026 (night, after testing 6.11 on the phone) — done in v6.13 unless marked
1. ✅ **Core+ wrote "0000…"** (bus-driver riddle, with and without Think). The phone log showed the 0.8B helper model
   (speculative decoding) loaded next to Core+. Not reproducible on a PC with the same files and flags, so it is an
   ARM-side engine fault. Fixed both ways: the helper is retired (`Engine.draftFor` → null, old setting cleared), and
   the **nonsense guard** (`quality.js junkStart`) stops an answer that starts as one repeated character, restarts the
   engine in **safe mode** (no speculation, 16-bit KV cache; `Prefs.safeMode` per model) and asks again. Engine → Speed
   shows "Safe mode is on" with a button to turn it off. ⬜ Ask Ali: does Core+ answer now? If it needs safe mode, try
   Core+ without safe mode once the helper is gone (the helper alone may have been the cause).
2. ✅ **Yusr: write it and it logs it** — a box on Yusr's home: "lunch 150, taxi 60 and got my salary 30000" /
   «فطار ٨٠ وبنزين ٥٠٠ امبارح» → each item logged at once (category, income/expense, date, account by name), with
   Undo. Code reading first (`yusr/logtext.js`, works with no model), the model sorts/names better when loaded; every
   amount must be in his words. Bridge kind `log-text` (hints: category ids, account names, today).
3. ✅ **Recurring moved** to its own **Bills** tab (where Invoices was): next 30 days, totals, the list.
4. ✅ **Invoices removed from Yusr** (Business books has them, with the ETA e-invoice) — nav tab, Settings panel and the
   "Run my business" welcome option. Old invoice data is kept in the backup, just not shown.
5. ✅ **Demo data removed** from Settings (a phone still showing sample data gets "Remove sample data" on the banner).
6. ✅ **Recurring: Daily**, and **daily only from day A to day B of each month** (wraps: 25 → 5).
7. ✅ **Yusr look** — Ali picked "a mix of B and C": Home = balance card with a spending ring + 4 tappable cards (spent vs
   before, earned, bills in 7 days, Zakat) + the **Write or ask** conversation (bubbles, kept in `db.talk`) + recent list;
   the bar is fixed at the bottom on Home (its ＋ opens the manual form; the old + button hides there). Questions
   ("how much on food this week?") are answered by code from the ledger (`myledger.js` `short` + `catAsked`). Yusr now has
   5 tabs (Home · Trends · Bills · Zakat · More); Accounts, Goals & debts and Notes are tiles at the top of More, with
   "Home shows" switches (ring / cards / conversation). ⬜ Ali to check it on the phone (Arabic too).

## O. Added 4–10 Oct 2026 — done in v6.14 unless marked
1. ✅ **Arabic was "badly translated"** → Ali chose **simple formal Arabic (فصحى مبسطة)** for the WHOLE app (Attune + Yusr).
   All 3,175 entries of `i18n-ar.js` reviewed (1,914 rewritten; style rules in the file's header), plus ~250 Arabic strings
   written in the code (`L(en, ar)`, `ar ? … :`). Egyptian is kept ONLY where it reads what people type (regexes, stop-word
   lists, example inputs). Yusr fixes: «ليدجر بريميوم» → «يُسر المميز», «6 معاملة» → «عدد المعاملات: 6», Insights = «رؤى».
   App names in Arabic letters (باوربوينت، وورد، إكسل) — e2e_v5 allows ≤3 Latin words per screen.
2. ✅ **Yusr look = mix of B + C** (cards + write-or-ask conversation) — see N.7.
3. ✅ **Fit: copy food from day to day like Yazio** — a copy button on every meal (→ any day, any meal) and "Copy this day's
   food to another day" (`fitplus.js copyFood`, `CopySheet` in fit-ui.jsx). Meal names now فطور / غداء / عشاء / وجبات خفيفة.
4. ✅ **Web: "A vs B" answers like Gemini** — `research.js compareParts / compareSearches / CMP templates`: each side's
   versions & prices table, a head-to-head table (| | A | B | Better |), advantages, which to choose, Egypt availability;
   7 searches, 10 pages, long answer budget.
5. ✅ **Learn daily: ready courses** — Turkish beginner → expert in 30 lessons, English for work (30), Crane hydraulics (20),
   built-in plans in English and Arabic (`daily.js READY_COURSES / readyCourse`), start at once (no model plan needed).
6. ✅ **Cycle is chattable** — `cycle.jsx cycleAnswer`: next period, late?, ovulation, fertile window, cycle/period length,
   history, symptoms — answered by code from the logged days (`CycleChat` under the headline).
8. ✅ **"Everything Yazio has, plus more"** (Ali, 10 Oct). Added in v6.14 (`fityazio.js`, `YazioPlus` in fit-ui.jsx):
   quick add kcal/macros, fasting stages + 23:1 and 36 h plans, body measurements over time (waist, hips, chest, arm,
   thigh, neck), progress photos (before/now), more calories on chosen weekdays (Attune keeps the WEEK's total — Yazio
   doesn't), 7-day nutrient averages with the energy split, diary export (CSV), copy a meal / a day to another day.
   Already there before: diary, goals (Mifflin-St Jeor), barcode + 1M-product database, photo and voice logging, recipes,
   week meal plan + shopping list, favourites / recent / my meals / my own food, water, weight trend, streak, Nutri-Score
   & NOVA, sugar / salt, reminders, watch sync (Health Connect, Huawei), fasting timer, workouts with a coach timer, week report.
   Attune-only: offline AI photo reading in ~1 s, Egyptian / Arab foods first, Ramadan mode with real prayer times,
   talk-to-the-list corrections, chat with your data, privacy (nothing uploaded), body fat from a tape measure.
   ✅ Then (same day) the last three: vitamins & minerals (`fitmicro.js`: 8 nutrients per 100 g for ~130 common foods from
   USDA, plus label values from Open Food Facts; day panel with % of the daily reference and "good sources" for low ones),
   a home-screen widget (`FitWidget.kt`, calories left / eaten / protein / water, the page updates it via setFitWidget),
   and challenges checked from the diary (`fityazio.js CHALLENGES`: water week, protein week, no sugary drinks, vegetables
   every day, log every day, on target).
9. ✅ **The other session's work merged** (v6.15): Business roles, multi-currency and price lists (so those Business
   leftovers are DONE), delivery notes, ETA batch, encrypted snapshots, the PDF reader, the Fit home, Studio drafts,
   converter polish, Knowledge. See HANDOFF §5.43.
7. ⬜ **Still open from the other account's list (M)**: Mind page "better than My Mind", Coding page "visually better and more
   powerful", the whole-app UI/UX rework and Maps look (LOOK choices — show options first); ~~Business leftovers~~ (done, item 9); big-model max-tests; measuring the comparison answers with a real 4B/9B model.

## P. Added 10 Oct 2026 — knowledge packs: commercial-safe, accurate (HANDOFF §5.48)
Ali: "Attune will charge money … find reliable free sources … full mark … all correct and reliable info".
- [x] Every pack source allows commercial use (no NC/ND, no modern copyrighted books); catalogue shows each real licence.
- [x] Quran: تفسير الجلالين; Islamic library: تفسير ابن كثير verse by verse + رياض الصالحين + بلوغ المرام; fiqh: six classical books.
- [x] Quality audit tool (`tools/audit_packs.py`) and fixes (repeats, encoding, damaged hadith letters, wrong-script names, cosmetics).
- [x] Accuracy fixes: Arabic country questions, dictionary not crowding out textbooks, the answering line pointed out, Quran
      phrases with the small alif, exact car model names, recalls for car makes only, medicines per route.
- [x] Calculus: Applied Calculus (CC BY) — still no clean CC BY source for the trig-derivative chapter.
- [x] Wikidata: option B (Ali: "if B is reliable then ok") — sourced statements only. Dorar: free on every plan.
- [x] Small «AI can make mistakes» line under every AI ask box.
- [ ] Next trial target: 45/45 on q08 (`tests/trials/packtrial.mjs`); misses left are mostly the tiny model misreading.

## Q. Added 10–11 Oct 2026 — done in v6.17 (HANDOFF §5.49–§5.50)
1. Use only accurate, reliable sources; Wikipedia only if reliable → Wikidata facts with a real (non-Wikipedia) source. ✅
2. Dorar hadith search free for everyone. ✅  3. Small "AI can make mistakes" note under every chat box. ✅
4. Fit & Food: cluttered, "a page not an app", needs an intro like a food app, more confusing than Yazio → look A
   (Ali's pick): app-in-app with its own tabs, welcome + plan screens, calm Today. ✅ — **check on the phone.**
5. Typed food search loaded nothing → food database downloads itself on Wi-Fi + online search after a pause. ✅
6. Big BAIK photo (1000 kcal) read as "fish 600 kcal" → the printed text is read first (ML Kit). ✅ — **check on the phone.**
7. "Maps doesn't work or where is the map itself" → the map box was 0 px tall (MapLibre CSS); fixed. ✅ — **check on the phone.**

8. "Give me a place to download new maps" → «Download maps» on the map. ✅
9. Knowledge packs "keep loading only" → one download per pack, a stall watchdog, progress from 0 %. ✅ — **check on the phone.**
10. "Not professional to tell them the exact sources for each pack" → cards without providers; one credits list. ✅
11. "Food recognition is not that accurate" / "53 percent is not accurate at all" → two models + home cuisine + learning from
    his own photos (HANDOFF §5.51 has the numbers). ✅ first step — **next: train on licensed food photos (see §5.51); ask Ali
    about an optional online precise mode.**

## R. 13–14 Oct 2026 — done in v6.27 (HANDOFF §5.61–§5.70) unless marked
Built (✅ = shipped on main, all tests green; **check on the phone / computer** where marked):
1. Maps: own packs streamed online ($0), compounds as labelled areas, Google-like search ranking, ask the map from Chat. ✅
2. Calm design A: tokens, phone Home + 7-area tool map, Money on the computer. ✅
3. Life layer: people, commitments, debts/installments (Ali's "Ahmed owes me 12,000" example). ✅
4. Money tracks itself (payment notifications) + Money Guardian + Deadline Radar; made global (any country/currency). ✅
5. Agent levels 1+2 (deep links + web agent that stops before paying). ✅
6. Homework Coach + the lesson player (visual, narrated, interactive); Family health; Shop in your pocket. ✅
7. Translate (text, PDF, photo, any language); Travel in Calm. ✅
8. Fit & Food: nutrients in full words with a colour each (no P/C/F), pulse loading screen, the 3 looks
   (colour per meal, rings, tiles) as optional looks, formal Arabic. ✅ — **Ali still has to pick the DEFAULT look (now "fresh").**
9. Three new ideas blended in without clutter: What you're owed, Read it to me, Job ready. ✅
10. Play Protect blocked the APK ("App blocked to protect your device"): Ali — "don't remove the notification part".
    → two builds: `attune-apk` (full, keeps the notification reader) and `attune-apk-lite`; real fix = Google Play
    internal testing (CI uploads once the secrets exist). ⏳ **Ali: create the Play developer account, then add the
    secrets PLAY_SERVICE_ACCOUNT_JSON + the release keystore (never commit the key file).**
11. "The computer interface is not optimized except Home — optimize the whole app" → Ali picked layout **A** (two panels:
    inputs left, answer right; lists as card grids) for EVERY page; phones unchanged. ✅ (HANDOFF §5.70) — **check on the
    computer.** Still uneven: Travel → Trip (right column longer); Radar card buttons wrap to two lines.
12. "Why does Settings have this" (the phone All sheet on a computer) → a real Settings window. ✅
13. Toasts vanishing early (one timer for every message). ✅  CV preview squeezed to ⅔ width on phones. ✅

Open — Ali wants a conversation first to set the priorities ("i will have a convo with u to set up some things straight"):
- **Google sign-in + Drive sync** ("where are the google sign in part, i feel like u forget some things") — NOT built;
  needs Ali's Google Cloud project (OAuth client id for Android + desktop). Then **Family circle** on top of it.
- Device levels + model router; paid web search for Pro; the Attune keyboard; more UI languages;
  Business builder v2; courses / spaced repetition / speaking practice; the "more features" list in ROADMAP_2026-10-13.md.
- Food recognition: train on licensed food photos (§5.51); optional online precise mode (ask Ali).

## S. 14 Oct 2026 (evening) — done in v6.28 (HANDOFF §5.71) unless marked
1. Insulin works with Fit & Food: units left → refill notification; blood sugar box → low-sugar steps + 15-min re-check; Food shows
   carbs per meal and the same warnings. Never a dose. ✅ — **check on the phone** (a real insulin pen count, notifications).
2. Converter: sub/superscripts no longer split tables or lose formulas (real paper: tables 0 → 100). ✅
3. Studio on Zenith / Zenith+: 2 minutes for the description; thinking never reaches the picture model. ✅ — **check on the phone.**
4. Computer layout leftovers: Radar buttons on one line; Travel → Trip columns even. ✅
5. How to use Attune: every tool in 3 steps with drawings, English + Arabic, phone + computer. ✅
6. Device levels (Light / Standard / Strong / Flagship / Computer) + "Show every tool anyway". ✅
7. Learn daily: spaced repetition (2, 5, 12, 30 days). ✅
8. Ali: "a feature that helps people, automates their lives or does a hard thing no one can do — see what's best" → **Ask your
   life**: one question answered by code from all your own data (money, debts, medicines, labs, meals, deadlines, notes), on its
   page and in Chat. ✅ — **check on the phone with real data.** (The earlier A/B/C engagement options stay on file.)

9. "Do it from Home": type or say it once on Home — food, money, a dose, water, weight, a workout, a reminder, a debt, a deadline,
   blood sugar, a note, a period — and it happens in the right tool, with Undo. ✅ — **try it on the phone with your own sentences.**
10. Scout — goals that hunt for days (flats, cars, products, jobs, suppliers, tenders): every wish checked against each ad's own
   words, twins merged, fair price, 👍/👎, notifications for strong new finds or price drops, a message for the seller. ✅ —
   **test it on the phone with real goals** (the cloud session could not reach the search engines). Next: nightly runs while
   Attune is closed (native worker), checking the ad photos, distance to the metro on the map.

Still open (each needs Ali): Google sign-in + Drive sync (his Google Cloud OAuth client ids) → Family circle; paid web search for Pro
(pick a provider + API key, after the Gemini comparison test); the Attune keyboard (Android IME: needs phone testing); more UI
languages (which ones?); Business builder v2 (what first?); food photos (licensed photo set); precise mode (online, his call);
the default Fit look; Google Play internal testing (developer account + secrets).

## T. 15 Oct 2026 — done in v6.29 (HANDOFF §5.72) unless marked
1. UI still cluttered → doubled titles removed, footer only on Home/All, empty Home cards hidden. ✅ Bigger look changes (Home
   area tiles) → **Ali to pick** (options in chat).
2. Back returns to the previous page, whatever it was — never jumps Home. ✅
3. Scout really good in everything: exact model/storage, variants, job experience, rent vs sale, specs not prices, cheapest
   store, retry with plain words. ✅ — **test with real goals on the phone.**
4. Health from Home opens a Health page (Fit & Food, Family health, Cycle). ✅
5. Ask your life automatically in Home and Chat ("how much did I pay for…", "history of…", "last time…"). ✅
6. Finish Learn daily, rework logic and UI: today's plan, review cards by code, honest streak, checked quizzes. ✅
7. The app sometimes crashes → guards, crash log, native background-thread handler, the CV share crash fixed; crawler clean. ✅
   — **tell me if it still happens, and what you were doing.**
8. Rework Slides & Reports UI and logic. ✅
9. Fit & Food on Home. ✅
10. Run the app and check everything / strong code so models do less: crawler over every tool; more checks by code (quiz
   grounding, figure checks, price/spec reading). ✅

11. Home: Ali picked A + Health → Scout + "What's waiting"; chat history sidebar (☰ on Home). ✅
12. "Do all that's left — deploy within 2 weeks": Android 16 target, Play-only purchases, no free-Pro tap on Play builds,
   privacy policy, billing fixes, signing guard. ✅ — **Ali: RELEASE_6.29.md §0 and §2 (closed test, keys, listing, decisions).**

## U. 15–17 Oct 2026 — v6.30 and v6.31 (HANDOFF §5.74–§5.75). Read this section first.

### Where things stand
- `main` = `ccr-a0eb3595-e2c7a7` = branch `claude/design-a-maps-4pmxxr-was8h5` = **v6.31 (versionCode 92)**; full suite green.
  APK: https://github.com/alydibiky/attune-/actions/runs/38999124660 (v6.30: run 38845889285).
- Ali's phone: HONOR BKQ-N49, Snapdragon 8 Elite Gen 5 (SM8850), 16 GB. He was running **Core Lite (md-lo)**; told to switch to
  **Core Max** after installing 6.31.

### What Ali asked and what was done
1. "The app still crashes on its own a lot." Done:
   - **ExitWatch.kt**: Android 11+ `ApplicationExitInfo`. Every start writes the reason the app last ended to the Engine log
     (low memory / native engine crash / ANR, memory, which model) and the page shows it once.
   - Ali's first log showed the real cause: "the page's process was reclaimed by Android for memory; rebuilt" **6 times in
     4 s**. The WebView renderer ranked below the app, and the instant `recreate()` looped. Fixed in MainActivity:
     `setRendererPriorityPolicy(IMPORTANT, true)`; drop and destroy the dead view; 2nd loss in a minute → let the model go
     (unless answering); from the 3rd → wait 3 s.
   - **Still open:** get a 6.31 Engine log from Ali if it closes again. If ExitWatch says "engine crash (native)", the next step
     is running llama-server in its own process.
2. "No bottom bar on any page; a sidebar like ChatGPT; ≤6 places; combine everything that can be combined." Done:
   - 6 places: Home · Chat · Money · Health · Learn · Tools (`web-src/hubs.js`).
   - Combined pages with a tab row (`hub-ui.jsx`): Create = Code · Improve · Compress · Humanize · Copilot · Library · Ask
     (Studio separate, as Ali said).
   - **Tools = 6 pages** (`TOOL_PAGES`): Files, Create, Studio, Maps & travel, Business, Help & privacy.
   - **≤6 tabs**: Skills inside Assistants, Artifacts inside Projects, Reminders inside Radar (`INSIDE`, a small switch on the page).
   - **Asked, no answer yet:** Create still has 7 tabs. The proposal is to put Compress inside Improve a prompt.
3. "Research and make the app minimal, not cluttered."
   - Research done; three mock-ups: https://claude.ai/artifact/Dc5kUTf3qBzPzWMGZBfvVE (A calm six, B chat first, C one feed).
   - Ali: "do the best you see" → **design A built in v6.31**: no intro paragraphs (`data-intro`, hidden by `.att-min`), thin text
     tabs with short names, a small model dot, calm Home and Chat, a "+" menu in Chat, Converter = one action + 4 rows,
     Scout = 2 examples.
   - **Open:** apply the same rules to the pages not yet touched. Fit & Food, Business, Studio, Learn's inner screens and the
     computer layout still have dense cards. Measure before and after (words/controls per screen; HANDOFF §5.75).
4. "Make Everest XL run on a phone from storage." Done:
   - Flash mode in Engine.kt (MoE experts read from storage, CPU only).
   - Lab: `tests/models/flash_moe.py`, CI `flash-moe.yml`; research in `RESEARCH_STORAGE_2026-10.md`.
   - **Open:** Ali's phone test of Everest in flash mode (words/s from the Engine log), an IQ2 quality check, and the
     "Deep answer" mode (proposed, not started).
5. "Test a faster file (Q4_0)." Done with `tests/models/quant_bench.py` (CI `quant-bench.yml`). Results in HANDOFF §5.75:
   - Q4_0 rejected (answers drift more).
   - **Core Lite → IQ4_NL** (faster and more accurate).
   - **New Core Max** (Q8_0 4B, reads ~4× faster, needs 12 GB+).
   - **Open:** run the same bench for the big IQ4_XS models (Apex+, Everest, Apex) and for Glow/Spark.
6. Release (from v6.29): `RELEASE_6.29.md` §0 and §2 are Ali's to-do: the 14-day closed test with 12 testers, upload key +
   GitHub secrets, privacy URL, Play products, declarations, USDA key, and the Video Downloader decision (A recommended).

### How to test the new layout
- The old e2e tests still see the bottom bar: `new_page()` sets `attune:legacy-nav=1` (`legacy_nav=True` is the default).
- New tests pass `legacy_nav=False`: `tests/e2e_v734sidebar.py`, `tests/e2e_v735minimal.py`.
- Everything new in the UI is gated on `!LEGACY_NAV` in attune.jsx, or `MINIMAL` in chat/convert/scout.
- Tests that build their own browser context (v3, v4, v5, v510, v512_more) add the legacy flag themselves.
- `e2e_v510_more.py` and `e2e_v512_more.py` are helper modules: an empty result line is normal.
- `e2e_v727coach.py` can time out under full-suite load; it passes when run alone.

## V. 17 Oct 2026 — v6.32 (HANDOFF §5.76). Read this section first.
- Ali's answers: Create → Compress inside Improve (done); Video Downloader → A (done: not sold, no limit, keep it out of the store
  text); Deep answer → built (Chat "+" menu); Fit & Food minimal → B with stronger contrast (done).
- **Still open:**
  1. A 6.32 Engine log from Ali if the app closes again; Everest in flash mode on his phone (words/s) — now also via Deep answer.
  2. Minimal design for the next pages: Business, Studio, Learn's inner screens, the computer layout (show options first).
  3. Fit & Food on the computer: the B tab row works there too, but check the wide layout with Ali.
  4. The big-model quant bench (Apex+, Everest, Apex, Glow/Spark).
  5. Ali's release list in RELEASE_6.29.md.

## W. 17 Oct 2026 — roadmap items (HANDOFF §5.78; built on `claude/roadmap-items-knk93s`)
Done: Money/life extras, Scout at night + metro + photo check, Learn speaking/dialogues/pictures/pack courses, web head-to-head
tables, French/Spanish/Turkish, the Attune keyboard. Open:
1. ✅ Ali picked Mind A (the wall, with colour search) and Code B (talk to a coder) — built (`mind-ui.jsx`, `code-ui.jsx`).
2. ⬜ Ali's accounts (SETUP_CLOUD.md): Google Web client id → finish `driveSync` + Backup "Sync with Google Drive" + Family circle;
   Serper key + relay address → `CLOUD.proSearchUrl`.
3. ⬜ Phone tests: the keyboard, Scout at night, the metro pill, Say it (speech recognition), pack courses.
4. ⬜ More of the app in French/Spanish/Turkish (only the first screens are translated).

## X. 17 Oct 2026 — v6.32 joint release (HANDOFF §5.79). Read this section first.
All five of Ali's parallel threads are merged into `main` as **v6.32** (one APK): Create/Deep answer/Fit & Food (§5.76, section V),
Edit a PDF and the Overpaying check (§5.79), Fleet & rentals + Business v2 (§5.77), the roadmap items (§5.78, section W).
APK: https://github.com/alydibiky/attune-/actions/runs/39011813651 (green). Desktop build: Linux green, Windows smoke test
fails (it already failed on v6.31, run 38999124552): the second streamed answer never arrives on the Windows runner.

### Ali's checklist on the phone (install the APK above over the old one)
1. ⬜ **Chat**: a normal question, then "+" → Deep answer (note which model answered and how long it took).
2. ⬜ **Create**: six tabs; Compress is the switch inside "Prompts".
3. ⬜ **Converter → Edit a PDF**: change a line, add text, highlight, sign, move a page; open the new PDF in another app.
4. ⬜ **Money → Guardian → Overpaying check**: add a pasted email or a Gmail export (Google Takeout → Mail); check each item's source.
5. ⬜ **Fit & Food**: tabs on top, "Log food", the text is easy to read in every look (also in Arabic).
6. ⬜ **Business → Fleet & rentals**: a crane, a job with hours, a cheque, the Store; then the same on the computer.
7. ⬜ **Attune keyboard**: Settings → "Attune keyboard"; Improve / Translate / Reply / Prompt in WhatsApp; Arabic keys.
8. ⬜ **Scout** at night (leave a goal, close the app, look in the morning), the metro walking minutes, the photo check.
9. ⬜ **Learn**: Say it (microphone), a dialogue, a pack course with no model.
10. ⬜ **Languages**: switch to French / Spanish / Turkish and back (only the first screens are translated).
11. ⬜ If the app closes by itself: send the Engine log (ExitWatch says why).

### Ali's release list (Google Play; details in RELEASE_6.29.md §0 and §2)
1. ⬜ Start the 14-day closed test with 12+ testers (personal account rule).
2. ⬜ Upload key + the four GitHub secrets; Play App Signing; first bundle by hand (`attune-play-bundle`).
3. ⬜ Host the privacy policy; contact email on the listing.
4. ⬜ Products: `attune_pro_monthly`, `attune_pro_yearly`, `attune_pro_lifetime`, `attune_business_system`; license tester.
5. ⬜ App content declarations (Data safety, Health Connect, foreground service, notification listener, exact alarms, rating).
6. ⬜ Store listing EN + AR (no video downloads in the text or screenshots).
7. ⬜ USDA food key from api.data.gov.
8. ⬜ Google Cloud (one project serves all three): Drive sync + Family circle (SETUP_CLOUD.md), Gmail sign-in for the
   Overpaying check (docs/GMAIL_SIGNIN.md), Serper key + relay for Pro search. Send Claude the Web client id.

### Still open (code)
1. ✅ Mind A and Code B: built in v6.33 (section Y).
2. Minimal design for Business, Studio, Learn's inner screens and the computer layout (show options first).
3. Fit & Food B on the wide computer layout: check with Ali.
4. The big-model quant bench (Apex+, Everest, Apex, Glow/Spark); Everest flash-mode speed from Ali's Engine log.
5. More of the app in French / Spanish / Turkish.
6. Desktop CI: the Windows smoke test ("Smoke test from source") fails after the second request; Linux passes. Fix it.
7. Fleet ideas not built (§5.77): nightly reminders as notifications, a client statement PDF, sharing Fleet between phones (needs Drive sync).

## Y. 17 Oct 2026 — v6.33: Mind A and Code B (HANDOFF §5.80). Read this section first, then X.
- Ali: "Mind a, Code B". Built: Mind is the picture wall with colour chips; Coding is "talk to a coder" (steps as a conversation).
- APK: https://github.com/alydibiky/attune-/actions/runs/39028329559 (green)
- Add to Ali's phone checklist (section X): Mind → save a link, a photo and a note; filter by a colour chip. Coding → "build me a
  tip calculator", watch the steps, Run, ask for a change at the bottom, Save, find it under your programs.
- Everything else still open is in section X.

## Z. 17 Oct 2026 (evening) — v6.34: Ali's phone list (HANDOFF §5.81). Read this section first, then Y and X.
Ali's answers: Money "integrate the best way" → Watch (Guardian + Radar + Reminders); More page → removed; Engine → A; Food sheet → A + Yazio.
Done in v6.34: food labels readable in every look; food corrections in plain sentences ("there is tomato sauce"); milk chocolate /
tomato sauce / chocolate log read right; Fleet Issue parts in the warehouse app's order; lessons written ahead in the background +
Add a lesson + Home order; "Solve the questions" in a document; web search retry + never "doesn't exist"; Core Max memory guard;
restricted-setting help; Money settings without premium; the maid every Saturday (tick → expense); Money = 5 tabs; Engine and the
food Add sheet minimal.
### Ali's phone checklist for 6.34
1. ⬜ Fit → a photo in the Colour-per-meal / Rings look: each label shows the food's name; type "there is tomato sauce" under it.
2. ⬜ Money → People: «the maid comes every Saturday and takes 600 EGP» → Save; on Saturday Home shows the box; tick → Money has it.
3. ⬜ Money → Watch → Payments · Dates · Reminders. A subscription on its renewal day: Home asks "paid?" → tick → in Money.
4. ⬜ Engine: one line + ⋯; models as rows; Settings folded.
5. ⬜ Fit → + on a meal: one box, Recent with +.
6. ⬜ Learn: leave the app open with a model loaded for a minute after reading a lesson → the next one is written; "Add a lesson";
   each new lesson has a diagram and flashcards; near lesson 28 of 30 the course plans 20 more by itself ("Plan 20 more lessons").
7. ⬜ PDF chat: "Solve the questions".
8. ⬜ Fleet → Store → Issue parts: reference code first, tap the item row.
9. ⬜ Radar / Money → Turn on notification access → if greyed out, follow the steps (App info → ⋮ → Allow restricted settings).
10. ⬜ If Attune closes: send the WHOLE Engine log (the end has ExitWatch's reason and "Memory:" lines).
### Also done later the same evening (Ali: "do everything that is left in the coding area")
- Lessons checked and repaired by code (no glitches reach the page); diagrams + flashcards in every lesson; courses past 30.
- Home asks "paid?" on a subscription's / bill's / the maid's day → recorded in Money.
- Fleet: maintenance by engine hours, client statement (print / PDF), one 09:00 notification for what needs you.
- Minimal design A on Business, Fleet, Knowledge, Travel, Field. French / Spanish / Turkish: the first screens' remaining strings.
- Windows desktop CI green again (a stale check, not a bug). Quant bench runs for Glow 2B, Spark 0.8B, Zenith 9B (results →
  HANDOFF when they finish). NPU (Snapdragon Hexagon) as an experimental switch in Engine → Settings → Speed.
### Add to Ali's checklist
11. ⬜ Engine → Settings → Speed → "Use the NPU (experimental)" with **Core Max**; ask something long; note words/s and whether the
    phone stays cool. If Attune closes, it comes back on the CPU by itself — send the Engine log.
12. ⬜ Fleet: a crane's "Service every … hours"; a client → Statement.
### Still open
1. ✅ Ali answered: diagrams + flashcards inside each lesson, and courses longer than 30 — both built (HANDOFF §5.81).
2. NPU: Ali's phone test (item 11). If the DSP session is refused for apps, the next step is a signed-PD route (Qualcomm), or drop it.
4. Quant bench results for 2B / 0.8B / 9B → change the default files if one is clearly better (as Core Lite → IQ4_NL).
3. Everything still open in section X (minimal Business / Studio / Learn screens, FR/ES/TR, Windows smoke test, quant bench, release list).

## Prompt to start the next session

```
Continue Attune on main (= ccr-a0eb3595-e2c7a7, v6.34: Ali's 17 Oct phone list on top of the joint release).
First read CLAUDE.md, APP_HANDOFF.md, HANDOFF.md §5.76–§5.81 and NEXT_SESSION.md — the newest sections are Z, Y and X (what is in v6.32/6.33,
my phone checklist, my release list and what is still open), then W and V. Then show me, short and simple: what is done,
what is open, and your recommended order; ask me the open questions (which page to make minimal next, with options), wait for my answers, then work through them with a task list. If I send an Engine log or
phone test results, read them first — ExitWatch says why the app closed.

Standing rules:
- Anything subjective (UI look, layout, colours, names, wording): show me 2–4 options with a recommendation and build the one I pick.
- Everything must work well on a phone AND a computer (computer = layout A: inputs left, answer right, lists as card grids).
- Never commit *private-key*.json; never change app/attune-test.keystore; Play keys only as GitHub secrets.
- Don't remove the payment-notification reader from the main APK.
- Targeted fixes, no rewrites (except the UI/UX rework and the Fit & Food redesign I asked for).
- Explain every step simply, with technical terms in English AND Egyptian Arabic. Arabic UI = simple formal Arabic.
- Commit as Claude <noreply@anthropic.com>; no model names in commits or code.
- Run ALL tests (bash tests/run_all.sh) before pushing to main; push to main, ccr-a0eb3595-e2c7a7 and the branch.
- Watch "Build the APK" and the desktop build on main and give me the links.
- Answer every point I ask; don't stop to ask me unless something is irreversible.
- Keep searching for ways to make the app smoother and every model lighter, faster and more accurate
  without compromising anything.
```
