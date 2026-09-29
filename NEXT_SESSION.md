# Next session — Ali's full problem list (29 Sep 2026, after v6.9)

Everything Ali found on his phone after v6.9, in one place. The list is complete ("that's all").
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

10. **Fit & Food photo recognition hangs, reloads, then crashes.**
    - A photo of fried eggs on bread with Blaze+ stayed on "Recognising the food…" for a long time, then the
      screen reloaded and the app crashed.
    - Find the cause (memory? LiteRT vision on Blaze+? a timeout?).
    - Add a time limit with a fallback, and test on the real flow.

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

---

## Prompt to start the next session

```
Continue Attune on branch claude/attune-android-continuation-4lp2wq.
First read HANDOFF.md and NEXT_SESSION.md, then fix EVERY item in NEXT_SESSION.md, one by
one, with a task list. Start with section A (heat, the engine reload, the app restarting
when I come back) and item 10 (the Fit photo crash). Measure each fix on the real flow
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
