// Unit tests for web-src/studio.js — picture requests in Chat, and the prompt helpers.
import { looksLikeImageRequest, pictureSubject, enhanceMessages, cleanPrompt, PACKS, SIZES } from "../../web-src/studio.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

eq(["draw a crane at sunset", "Generate an image of a Liebherr crane lifting a bridge", "make me a logo for Adrighem & Aldibiki", "paint my office with turquoise walls",
    "ارسم ونش وقت الغروب", "اعملي صورة لونش ليبهر في موقع بناء", "صمملي لوجو للشركة"].map(looksLikeImageRequest), [true, true, true, true, true, true, true], "picture requests are recognised, English and Egyptian Arabic");
eq(["draw a conclusion from these numbers", "make a table of crane rentals", "create a chart of monthly revenue", "generate a report for the site",
    "what's the capacity at 20 m?", "make a plan"].map(looksLikeImageRequest), [false, false, false, false, false, false], "…and ordinary requests are not");
eq(pictureSubject("Generate an image of a Liebherr crane lifting a bridge"), "a Liebherr crane lifting a bridge", "subject without 'generate an image of'");
eq(pictureSubject("draw a crane at sunset"), "a crane at sunset", "subject without 'draw'");
eq(pictureSubject("ارسم ونش وقت الغروب"), "ونش وقت الغروب", "Arabic subject without 'ارسم'");
eq(enhanceMessages("ونش وقت الغروب")[0].content.includes("ONE English description"), true, "the description is asked for in English whatever language the idea is in");
eq(cleanPrompt('Here is the description: "A Liebherr crane at golden hour, lifting a steel beam over a construction site, cinematic light."', "x"),
  "A Liebherr crane at golden hour, lifting a steel beam over a construction site, cinematic light.", "the description is tidied (no preface, no quotes)");
eq(cleanPrompt("ok", "a crane"), "a crane", "a useless description falls back to the idea");
const k = PACKS["klein-4b"];
eq([k.files.map((f) => f.role), Math.round(k.files.reduce((a, f) => a + f.size, 0) / 1e8) / 10, k.license], [["diffusion", "llm", "vae"], 5.3, "Apache-2.0"], "FLUX.2 klein 4B pack: 3 files, 5.3 GB, Apache-2.0");
eq(PACKS["esrgan-x4"].files[0].url.startsWith("https://github.com/xinntao/Real-ESRGAN/"), true, "the sharpening model comes from its official release");
eq(SIZES.every((s) => s.w % 16 === 0 && s.h % 16 === 0 && s.w * s.h <= 1024 * 1024 * 1.01), true, "every size is a multiple of 16 and at most ~1 megapixel");
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
