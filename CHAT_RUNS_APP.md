# Chat runs the app — Ali's plan (21 Oct 2026)

_Ali: "make chat responsible for most things in the app". He picked **Home option A** (mock-ups:
https://claude.ai/artifact/Ngv9DmEQpCfq2CwPKZa47d — the box at the top with `/` commands, "Working on it" job cards with progress,
a pinned trip card, then Your day). Every session: read this page and tick what is done. Nothing here is decided again._

## What Ali asked for (his words, in short)
1. `/convert`, `/humanize`, `/translate`, `/scout …`, `/travel <country>` from the Home box — Home shows only the progress.
   `/travel` opens Travel and stays pinned on Home until the trip ends or he ends it. Daily news, Business, Health and Money keep
   their own pages.
2. **No slash, two meanings → ask.** If a sentence can mean two things, show the two options; he ticks one. Attune **learns what he
   usually means** and stops asking for that kind of sentence.
3. **Web search and Translate as options in the chat** (the Home box and Chat).
4. **Memory lives in the Mind app.** `/remember` a photo, video, recording or file "as …"; `/find` brings it back (a video or
   recording from the right second).
5. **To-do list from chat:** "add this to my to-do list" adds it; "what's in my to-do list" shows it (tick to finish).
6. **Maps and Metro in chat:** "I want to go to …" / "where is …" → the map (and the Metro route when it helps).
7. **Where things are:** "remember my passport is on the desk" → if it was last in the drawer, ask "not in the drawer any more?"
   (tick yes). "Where do I usually keep my passport?" → "the desk 5 times, the drawer 4 times".
8. **Shelf in the sidebar.**
9. **Video subtitles** reachable easily (and from any video, not only downloaded ones).
10. Code must be very solid, smart and smooth. (Not this plan: reading notifications — those features exist already.)

## Build steps (tick each when done, with its tests)
- [x] S1 `commands.js` — the `/` registry (English + Egyptian Arabic names), the parser, the meaning-guesser for plain sentences
      (ranked candidates; two close → ask), learned preferences (`attune:intent:prefs`). Unit tests.
- [x] S2 `jobs.js` + Home A — the job queue (waiting / working % / done / failed; one heavy model job at a time), job cards on
      Home, runners: convert, humanize, translate, scout, travel (pinned trip). Unit + e2e.
- [x] S3 To-do from chat (Mind to-dos): add, list, tick. Unit + e2e.
- [x] S4 Where things are (Mind): place records, "moved?" question, usual place by count. Unit + e2e.
- [x] S5 Maps + Metro answers in the box / Chat (map card, Metro route inline). e2e.
- [x] S6 Web + Translate options in the Home box and Chat. e2e.
- [x] S7 Shelf in the sidebar. e2e.
- [x] S8 `/remember` photo / video / recording / file → Mind with the label, words said (on-device speech), photo description,
      `/find` by words + meaning, playing from the right second. Native: transcribe any picked video/audio (Kotlin). Unit + e2e +
      branch APK build.
- [x] S9 Subtitles from any video on the phone (Video page + `/subtitles`).
- [x] S10 Reminds by itself from what was kept: dates and promises in kept photos and recordings (Mind's own promise reader, Pro),
      and "a year ago today you kept …" in Home's Attune noticed (one at most).

## Built (v6.48, 21–22 Oct 2026)
- Files: `commands.js` (the / list, meaning-guesser, ask + learn), `cmdrun.js` (one outcome per typed thing), `jobs.js` (the queue),
  `whereis.js` (where things are), `mediastore.js` (videos / recordings kept for Mind), `convert-run.js` (the converter, shared
  with the Convert page), `cmdbox-ui.jsx` (Home option A's pieces); wired in `home-ui.jsx`, `attune.jsx` (`cmd`, the runners,
  `cmdLocal` for Chat), `chat.jsx` (Translate mode, memory cards), `mind-ui.jsx` (player + seek, to-do tick), `video-ui.jsx`
  (any-video subtitles), `mapintent.js` ("I want to go to …"). Native: `Subtitles.kt` (any file), `NativeBridge.kt`
  (`cacheAppend`, `subtitlesFile`).
- Tests: `tests/unit/v748commands|cmdrun|jobs|where.test.mjs`, `tests/e2e_v748commands.py`, `tests/e2e_v748chat.py`.
- On Ali's phone to check: the words said in a video / recording (`/remember`, `/subtitles`) need Android 13+ and the offline speech
  pack (the same as Subtitles).

## Answers given to Ali
- **Subtitles today:** Tools → Video Downloader → a video you downloaded → "Subtitles" (Android 13+, the phone's offline speech
  pack). S9 adds any video from the phone.
- **Whole or part by part:** built step by step in one plan (this page), each step tested; milestones go to `main` after the full
  test run, so nothing is forgotten between sessions.
