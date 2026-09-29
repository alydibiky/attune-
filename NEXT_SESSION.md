# Next session — Ali's problem list (29 Sep 2026, after v6.9)

Found by Ali on his phone (HONOR BKQ-N49, Snapdragon SM8850, Adreno 840; the Engine
screen reports **16 GB**, not the 12 GB we planned for). Screenshots were sent in the chat.
Ali said "there is still more": add new items at the end of this list as he sends them.

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

9. (Ali: "there is still more" — add here.)
