// Unit tests for web-src/studio.js — picture requests in Chat, and the prompt helpers.
import { looksLikeImageRequest, pictureSubject, enhanceMessages, cleanPrompt, PACKS, SIZES, drawPack, recommendStudioPack } from "../../web-src/studio.js";
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
eq([PACKS.turbo.files.map((f) => f.role), PACKS.turbo.files[1].size, PACKS.turbo.files[1].url.startsWith("https://huggingface.co/madebyollin/taesd/")], [["model", "taesd"], 9793292, true], "Turbo pack: the model plus the tiny colour decoder (measured 63 s → 37 s, CLIP 31.2 → 32.1)");
eq(PACKS["esrgan-x4"].files[0].url.startsWith("https://github.com/xinntao/Real-ESRGAN/"), true, "the sharpening model comes from its official release");
eq(SIZES.every((s) => s.w % 16 === 0 && s.h % 16 === 0 && s.w * s.h <= 1024 * 1024 * 1.01), true, "every size is a multiple of 16 and at most ~1 megapixel");
const xl = PACKS["turbo-xl"];
eq([xl.files.map((f) => f.role), xl.defaults.steps, xl.needRam, xl.files[1].url.includes("taesdxl")], [["model", "taesd"], 1, 8, true], "Turbo+ pack: SDXL-Turbo + tiny XL decoder, 1 step, needs 8 GB");
const cpu = (ram, ids) => ({ ramGB: ram, gpuState: "cpu", packs: ids.map((id) => ({ id })) });
eq(drawPack(cpu(12, ["turbo", "turbo-xl"])).id, "turbo-xl", "8 GB+ phone with Turbo+ installed draws with Turbo+");
eq(drawPack(cpu(6, ["turbo", "turbo-xl"])).id, "turbo", "under 8 GB Turbo+ is never used");
eq(drawPack(cpu(6, ["turbo"]), "turbo-xl").id, "turbo", "choosing Turbo+ on a 6 GB phone falls back to Turbo");
eq(drawPack(cpu(12, ["turbo", "turbo-xl"]), "turbo").id, "turbo", "choosing Turbo keeps Turbo");
eq(drawPack(cpu(12, ["turbo"]), "turbo-xl"), { id: "turbo-xl", ready: false }, "choosing Turbo+ before installing offers its install");
// per-device recommendation (Ali: "recommend the best Studio model for each device")
const devs = [
  ["4 GB budget phone", { ramGB: 4, cores: 8, bigCores: 2, freeGB: 20, platform: "android" }, "turbo", 384],
  ["6 GB mid phone", { ramGB: 6, cores: 8, bigCores: 2, freeGB: 30, platform: "android" }, "turbo", 512],
  ["8 GB Honor-class", { ramGB: 8, cores: 8, bigCores: 4, freeGB: 40, platform: "android" }, "turbo-xl", 512],
  ["8 GB but 4 GB free", { ramGB: 8, cores: 8, bigCores: 4, freeGB: 4, platform: "android" }, "turbo", 512],
  ["12 GB flagship", { ramGB: 12, cores: 8, bigCores: 5, freeGB: 100, platform: "android" }, "turbo-xl", 512],
  ["16 GB laptop", { ramGB: 16, cores: 8, bigCores: 8, freeGB: 200, platform: "desktop" }, "turbo-xl", 512],
  ["32 GB desktop", { ramGB: 32, cores: 16, bigCores: 16, freeGB: 500, platform: "desktop" }, "turbo-xl", 512],
];
for (const [what, d, pack, side] of devs) { const r = recommendStudioPack(d); eq([r.pack, r.side, r.estSeconds > 0], [pack, side, true], `recommendation: ${what} → ${pack} @ ${side} (${r.estSeconds} s)`); }
eq(recommendStudioPack(devs[6][1]).alternatives.some((a) => a.pack === "klein-4b"), true, "computers with 16 GB+ are also offered the slow best-quality pack");
eq(recommendStudioPack(devs[2][1]).alternatives.some((a) => a.pack === "klein-4b"), false, "phones are not offered the minutes-a-picture pack");
eq(recommendStudioPack(devs[2][1]).estSeconds < recommendStudioPack(devs[1][1]).estSeconds, true, "the XL pick is estimated faster than Turbo on a slower phone");
eq(drawPack({ ramGB: 12, cores: 8, bigCores: 5, freeGB: 100, gpuState: "cpu", packs: [] }).id, "turbo-xl", "first run on a 12 GB phone preselects the recommended pack");
console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
process.exit(fails.length ? 1 : 0);
