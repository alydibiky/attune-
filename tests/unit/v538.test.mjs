// Unit tests for v5.38: the Video Downloader's link reading (web-src/video.js).
import * as V from "../../web-src/video.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- links ----
eq(V.linkIn("Watch this 👇 Crane lift https://example.com/v/lift.mp4?x=1. Amazing"), "https://example.com/v/lift.mp4?x=1", "the link is taken out of shared text");
eq(["https://youtu.be/abc", "https://m.youtube.com/watch?v=1", "https://www.tiktok.com/@a/video/1", "https://www.instagram.com/reel/x", "https://fb.watch/x", "https://x.com/a/status/1", "https://vimeo.com/123"].map((u) => V.classify(u).site),
  ["YouTube", "YouTube", "TikTok", "Instagram", "Facebook", "X", "Vimeo"], "sites that forbid downloading are refused by name");
eq(V.classify("https://notyoutube.com/a.mp4").kind, "direct", "…but only those sites (notyoutube.com is fine)");
eq(V.classify("https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing"), { kind: "drive", id: "1AbCdEfGhIjKlMn", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing" }, "a Google Drive share link → its file id");
eq(V.classify("https://www.dropbox.com/scl/fi/abc/lift.mp4?rlkey=k&dl=0").url, "https://www.dropbox.com/scl/fi/abc/lift.mp4?rlkey=k&dl=1", "a Dropbox link → dl=1 (the file, not the preview page)");
eq(V.classify("https://archive.org/details/night_of_the_living_dead"), { kind: "archive", id: "night_of_the_living_dead", url: "https://archive.org/details/night_of_the_living_dead" }, "archive.org item");
eq(V.classify("https://commons.wikimedia.org/wiki/File:Crane_lifting_a_beam.webm").title, "File:Crane lifting a beam.webm", "Wikimedia Commons file page");
eq(V.classify("https://en.wikipedia.org/wiki/Crane#/media/File:Big_crane.ogv").title, "File:Big crane.ogv", "a video opened from a Wikipedia article");
eq([V.classify("https://cdn.site.com/live/index.m3u8").kind, V.classify("ftp://x/a.mp4").kind, V.classify("hello").kind, V.classify("https://site.com/news/1").kind], ["stream", "bad", "bad", "page"], "live streams, bad links and pages");

// ---- Google Drive's "download anyway" page ----
const drive = `<html><form id="download-form" action="https://drive.usercontent.google.com/download" method="get"><input type="submit" value="Download anyway"/><input type="hidden" name="id" value="1Abc"><input type="hidden" name="export" value="download"><input type="hidden" name="confirm" value="t"><input type="hidden" name="uuid" value="u-123"></form></html>`;
eq(V.driveConfirm(drive, "https://drive.usercontent.google.com/"), "https://drive.usercontent.google.com/download?id=1Abc&export=download&confirm=t&uuid=u-123", "Drive's virus-scan page → the real download link");

// ---- a web page with a video ----
const page = `<html><head><title>Site news</title><meta property="og:title" content="Tower crane assembly &amp; test"><meta property="og:video" content="https://cdn.news.com/v/assembly_720p.mp4"></head><body>
<video poster="p.jpg"><source src="/media/assembly_1080p.mp4" type="video/mp4" label="1080p"><source src="/media/assembly_480.webm" type="video/webm" res="480"></video>
<a href="/files/interview.mp3">Audio</a><script>var cfg={"file":"https://cdn.news.com/v/assembly_720p.mp4"}</script><source src="https://cdn.news.com/live/master.m3u8" type="application/x-mpegURL"></body></html>`;
const pc = V.pageChoices(page, "https://news.com/story/5");
eq(pc.title, "Tower crane assembly & test", "the page's title");
eq(V.sortChoices(pc).map((c) => [V.qualityText(c), c.ext, c.url]), [["1080p", "mp4", "https://news.com/media/assembly_1080p.mp4"], ["720p", "mp4", "https://cdn.news.com/v/assembly_720p.mp4"], ["480p", "webm", "https://news.com/media/assembly_480.webm"], ["Audio only", "mp3", "https://news.com/files/interview.mp3"]],
  "every version on the page, best first, audio last (relative links made full; the duplicate and the stream dropped)");
eq(pc.hls, true, "…and the page's stream is noticed");

// ---- archive.org ----
const meta = { metadata: { title: "Night of the Living Dead" }, files: [
  { name: "night.mp4", format: "h.264", size: "734003200", height: "480", width: "640" }, { name: "night_512kb.mp4", format: "512Kb MPEG4", size: "209715200" },
  { name: "night.ogv", format: "Ogg Video", size: "300000000", height: "360" }, { name: "night.mp3", format: "VBR MP3", size: "90000000" }, { name: "night_thumb.jpg", format: "JPEG" }, { name: "night_meta.xml", format: "Metadata" }] };
const ac = V.sortChoices(V.archiveChoices(meta, "night_of_the_living_dead"));
eq(ac.map((c) => V.qualityText(c) + " " + c.ext + " " + V.sizeText(c.size)), ["480p mp4 734 MB", "360p ogv 300 MB", "240p mp4 210 MB", "Audio only mp3 90 MB"], "archive.org: its videos and audio with sizes (pictures and metadata skipped)");
eq(ac[0].url, "https://archive.org/download/night_of_the_living_dead/night.mp4", "…with the download link");

// ---- Wikimedia Commons ----
const api = { query: { pages: { "5": { title: "File:Crane lifting a beam.webm", videoinfo: [{ url: "https://upload.wikimedia.org/c/Crane.webm", width: 1920, height: 1080, size: 52000000, mime: "video/webm",
  derivatives: [{ src: "https://upload.wikimedia.org/c/Crane.webm", type: "video/webm" }, { src: "https://upload.wikimedia.org/t/Crane.webm.720p.vp9.webm", type: "video/webm", transcodekey: "720p.vp9.webm", height: 720 }, { src: "https://upload.wikimedia.org/t/Crane.webm.360p.webm", type: "video/webm", transcodekey: "360p.webm", height: 360 }, { src: "https://upload.wikimedia.org/t/Crane.webm.ogg", type: "audio/ogg", transcodekey: "ogg" }] }] } } } };
const cc = V.sortChoices(V.commonsChoices(api));
eq(cc.map((c) => V.qualityText(c)), ["1080p", "720p", "360p", "Audio only"], "Commons: the original and its 720p / 360p / audio versions");
eq(V.commonsChoices(api).title, "Crane lifting a beam", "…and its title");

// ---- names ----
eq(V.fileName('Tower crane: "assembly" / test', { url: "x", ext: "mp4", height: 720 }), "Tower crane assembly test 720p.mp4", "a safe file name with the quality");
eq(V.fileName("", { url: "https://a.com/v/%D9%88%D9%86%D8%B4.webm?x", ext: "webm", height: 0 }), "ونش.webm", "…or the link's own (Arabic) name");
eq(V.fileName("Talk", { url: "x", ext: "mp3", audio: true }), "Talk.mp3", "audio has no quality in the name");
eq([V.heightOf("clip_1080p.mp4"), V.heightOf("1280x720"), V.heightOf("HD"), V.heightOf("nothing")], [1080, 720, 720, 0], "quality from names");

if (fails.length) { console.log(`\n${fails.length} FAILED`); process.exit(1); } else console.log("\nALL PASSED");
