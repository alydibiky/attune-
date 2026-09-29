# Next session — Ali's problem list (29 Sep 2026, after v6.9)

Found by Ali on his phone (HONOR BKQ-N49, Snapdragon SM8850, Adreno 840; the Engine
screen reports **16 GB**, not the 12 GB we planned for). Screenshots were sent in the chat.
Ali said "there is still more": add new items at the end of this list as he sends them.
Ali is not in a hurry for item 8 (the standing goal) — "NOT NOW" — but it stays a goal.

## Problems

1. **Zenith is still too heavy: the phone gets hot.**
   - The Engine card says "This model is large for this phone… the phone gets warm". It also loads a
     Qwen3.5 0.8B draft model (for speculative decoding) next to Zenith, 8K context, weights in RAM.
   - Goal: the same answers with less heat. Ideas to measure first:
     - check whether the draft model saves or costs energy;
     - thread count (use the big cores only?);
     - GPU (Adreno 840) offload;
     - a smaller KV cache;
     - pausing the model when the phone is idle;
     - a thermal throttle.
   - Also check why a 16 GB phone gets the "large for this phone" warning for a 5.37 GB model.

2. **Image generation (Studio) is slow and the quality is bad.**
   - Prompt: "a massive red Liebherr crane lifting a heavy steel bridge beam at a construction site,
     sunset". Result: a red crane over the SEA, with no beam and no construction site.
     Sharpening took 1 min 42 s on the CPU, and ×4 AI sharpen is ~7 min.
   - After generating, the LLM chip showed "Loading 11s": the chat model reloads.
   - Goal: images that follow the prompt, and much faster. Consider:
     - a better or distilled image model (SDXL-Turbo / SD 3.5 / FLUX-schnell-class, int8/int4,
       on the NPU or GPU through QNN or LiteRT);
     - fewer steps;
     - not unloading the chat model.

3. **Web search still feels amateur. Ali wants it "Gemini-like".**
   - Example: "Lynk & Co 900" with Zenith + Web gave:
     - 5 short bullets from only 2 of the 5 pages read;
     - an odd claim ("lacks English language support");
     - a thin 2-row "Key figures" table;
     - the first line shown with literal `**` asterisks (a markdown rendering bug).
   - Goal: a full, well-structured answer like Gemini, with:
     - a direct answer first;
     - sections;
     - a real spec/comparison table (all versions and prices, as Ali always wants for cars);
     - pros and cons;
     - more and better sources, all of them used;
     - pictures when helpful;
     - suggested follow-up questions;
     - fast.
   - Fix the `**` bug too.

4. **Fit & Food photo recognition hangs, reloads, then crashes.**
   - A photo of fried eggs on bread with Blaze+ stayed on "Recognising the food…" for a long time, then
     the screen reloaded and the app crashed.
   - Find the cause (memory? LiteRT vision on Blaze+? a timeout?), fix it, add a time limit with a
     fallback, and test on the real flow.

5. **Rework the whole Fit & Food app (UI and UX).**
   - Ali wants a full redesign: cleaner, faster to log a meal, better than Yazio.

6. **Leaving the app and coming back reloads everything and goes to the home page.**
   - Ali starts a prompt, switches to another app while it answers, and on return the app has restarted
     and the answer is lost.
   - Needed:
     - the answer keeps generating in the background (foreground service / keep the engine alive);
     - the WebView state and the open screen survive (no Activity recreation or reload; save and
       restore the screen, the chat and the running job);
     - check Honor/MagicOS battery killing.

7. **The biggest models were never max-tested.**
   - Everest, Everest XL, Apex and Apex+ were only measured for size, Arabic drift (KLD) and speed on the
     ARM runner.
   - They are too big for the 15 GB test container, so the max trial (`tests/trials/max.mjs`) needs a
     bigger runner (e.g. a GitHub Actions large runner, or a manual workflow like
     `.github/workflows/model-bench.yml` with more RAM).

8. **Standing goal: keep looking for ways to make it smoother, lighter, faster and more accurate, without losing quality.**
   - Ali: "don't stop until you find a way without compromising anything".
   - Measure every idea (speed, heat, RAM, answer quality) before shipping it.

9. **Tabbing out and back makes the engine reload (27 s+); the app also overheats with ANY model.**
   - The Engine log (Zenith, 29 Sep, HONOR SM8850 16 GB) shows:
     - `ggml_backend_opencl … failed to allocate 4372.52 MiB (err=-61)`: the GPU buffer fails
       (n_gpu_layers forced to 99), then it falls back;
     - "flash attention not supported by OpenCL, memory usage will increase";
     - the CLIP (photo reader) graph runs unsupported ops on OpenCL;
     - "kleidiai: no kernel for tensor type q4_K (kernels available for Q4_0 and Q8_0)", so the ARM fast
       kernels are NOT used by our K-quant/IQ4 files;
     - n_threads = 4;
     - a 0.8B draft model loaded too;
     - "Android asked for memory while Attune was in the background — the model was let go" 4 times in 25 min.
   - To do:
     - keep the model alive in the background (foreground service, lower memory so Android doesn't kill it);
     - fit the GPU buffers (lower -ngl / ubatch, or CPU only when OpenCL can't fit);
     - measure Q4_0 files with KleidiAI (faster and cooler on ARM?);
     - check the thread count and the draft model's cost;
     - find what heats the phone even with small models (a busy loop? polling? the WebView?).
10. **Reasoning answers.**
    - Seating puzzle ("A, B, C, D around a round table facing inward; A is not opposite C; B is
      immediately left of C; who is opposite B, who is immediately right of A?"), Blaze+ with Think.
      - The final answer "A opposite B, D right of A" is actually RIGHT.
      - But its explanation "C, B, A, D (moving clockwise)" is WRONG: that order puts A opposite C.
        The right clockwise order is C, B, D, A.
      - Ali read it as a wrong answer, so the explanation must match the answer. Check the working with code
        (like the maths check) or drop a wrong arrangement line.
    - Hydraulics ("valve cavitation during high-speed deceleration in an electro-hydraulic closed-loop
      positioning system, two direct fixes without reducing velocity"): the answer was weak or wrong.
      - It said "increase supply pressure" and "reduce valve restriction".
      - The expected answer: the load's inertia overruns the actuator while the valve meters it out, so
        the inlet (meter-in) side is starved and drops below vapour pressure.
      - Fixes: anti-cavitation / make-up check valves (or a replenishing circuit) feeding that side, and
        meter-out/back-pressure control (a counterbalance valve, a matched asymmetric spool, or tank-line
        back-pressure).
      - Engineering answers need to be expert-level (Ali owns a crane company).
11. **"Output strictly as a Markdown table" was not followed.**
    - The CAN vs Ethernet (Automotive **100BASE-T1**) question, on Blaze+:
      - it added a sentence before the table;
      - it compared 1000BASE-T1 instead of 100BASE-T1;
      - it claimed "up to 100000 Mbps" (wrong);
      - a stray "Choose CAN bus if…" line and a "📄 Document" card came after.
    - Strict output-format requests must be obeyed, and the named standard kept.
12. **Mind:**
    - a saved photo (a screenshot) cannot be opened;
    - a saved answer with a table shows raw markdown (`Feature | CAN Bus | …`, `---|---|---`) instead of a
      rendered table.
13. **Money: "+250 EGP from my cousin Youssef" is not recorded the way Ali wants.**
    - It became Income · Other, with no account, no note and no person.
    - Keep who it was from (Youssef, cousin) and pick the right type/category (a gift? a repayment? a
      loan?). Ask when unclear, remember the person, and fill the note.
    - Ask Ali exactly how he wants it recorded if the screenshot doesn't make it clear.
14. **Reports and proposals are generic, with IRRELEVANT sources.**
    - "Elevating Capital Projects: A Strategic Crane Rental Partnership" (New Capital contractors):
      - it cites Windows camera error codes (0xA00F4244, 0x80070005) as crane "system failures" in 5 of 11
        sections;
      - it repeats the same two sources ([1] a sales-prospecting blog, [5] a crane business-plan page) in
        every section;
      - it gives filler metrics ("Safety Record: Uncompromising");
      - it has no real fleet, prices or projects.
    - Fixes:
      - the web research must drop off-topic pages;
      - the report must use Ali's own data (his fleet: XCMG, Sany, Hitachi, Liebherr, Demag, Terex, Zoomlion,
        Grove, 20–500 t; the company Adrighem and Aldibiki, 150 employees), or ask for it;
      - no repeated sections or filler.
15. **Idea: use the phone's STORAGE to make the models lighter and more powerful.**
    - Research and measure:
      - mmap'd weights read from flash instead of "weights in RAM";
      - streaming the experts of a mixture-of-experts model from storage ("LLM in a flash" style), so a bigger
        MoE model runs in little RAM;
      - a KV cache / prompt cache saved to storage so reloads are instant;
      - big offline knowledge packs searched from storage (RAG) instead of a bigger model.
    - Only ship what keeps quality and speed.
16. **Rework the WHOLE app's UI and UX "like an expert with 20 years in the field".**
    - Smoother everywhere: transitions, loading states, no reloads, fewer taps.
17. (Ali: "there is still more" — add here.)
