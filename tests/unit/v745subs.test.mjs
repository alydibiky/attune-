// v6.45 (W6) video subtitles: the recogniser's pieces → cues of ≤ 2 lines × 42 letters → a valid .srt.
import { wrapLines, cuesOf, srtOf, speechLang } from "../../web-src/video.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
ok(wrapLines("a ".repeat(50), 42).every((l) => l.length <= 42), "lines of at most 42 letters");
const cues = cuesOf([{ start: 1000, end: 4000, text: "Hello and welcome" }, { start: 5000, end: 17000, text: "الونش ده شايل خمسين طن على نص قطر عشرين متر والريح كانت سبعة متر في الثانية وده أقصى حاجة مسموح بيها في الجدول" }, { start: 18000, end: 19000, text: "  " }]);
ok(cues[0].start === 1000 && cues[0].end === 4000 && cues[0].text === "Hello and welcome", "a short piece is one cue with its own times");
ok(cues.length >= 3 && cues.slice(1).every((c) => c.text.split("\n").length <= 2) && cues[cues.length - 1].end === 17000 && cues[1].start === 5000, "a long piece → several cues of ≤ 2 lines sharing its time");
ok(!cues.some((c) => !c.text.trim()), "an empty piece makes no cue");
const srt = srtOf(cues);
ok(/^1\n00:00:01,000 --> 00:00:04,000\nHello and welcome\n\n2\n00:00:05,000 --> /.test(srt), "the .srt format: number, times hh:mm:ss,mmm, text, blank line");
ok(srtOf([{ start: 3723456, end: 3724000, text: "x" }]).includes("01:02:03,456 --> 01:02:04,000"), "an hour in: 01:02:03,456");
ok(speechLang("ar") === "ar-EG" && speechLang("xx") === "en-US", "Arabic is listened to as Egyptian Arabic");
