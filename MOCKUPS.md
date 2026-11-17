# Mock-ups before building (Ali's rule, 5 Nov 2026)

> Ali: "add an md to GitHub for everything like that — produce these mock-ups before building."

**Any change people will see on a screen gets a mock-up first. Ali picks, then Claude builds.** This covers a new screen, a
redesign, a new card or flow, colours, layout, or the order of things. Objective bug fixes that leave the look as it is
(a wrong number, a crash, a button that does nothing) are just fixed, with no mock-up.

> **Rule (Ali, 9 Nov 2026):** every options / mock-up page has a checkbox and a note box on EVERY option, and a sticky bar that
> collects the ticked codes with their notes and copies them in one tap ("Copy my picks"). See CLAUDE.md.

## The steps

1. **Options**: make **4–6 concrete options** (2–4 for a small change) as phone mock-ups on one published page (an Artifact).
   - Use Attune's real look: the current theme colours (burgundy since v9.5), Nunito, the real card style.
   - Use Ali's **real examples and numbers**: Sheikh 19,500 in instalments of 2,500, the maid every Saturday 600, hotels near
     the Haram, Talabat koshary, his categories. Numbers in a mock-up must add up.
   - For each option give a letter and number (A1, P2, F3…), a name, one line on what it is, one plus and one minus, and mark
     **one "Recommended"**.
   - Show light and dark if colour matters; phone first (desktop when the screen differs there).
2. **Ali picks**: he may pick one, or several "integrated". Don't build yet.
3. **Combined mock-up**: when he picks more than one, or adds wishes, draw **one screen** that joins them. Put a short
   "**What I understood**" list next to each. This is where a misunderstanding gets caught (for example "more than 1 option
   on more than 1 date" became the dates × best-3 offers grid).
4. **His "OK"** → build exactly that: all 20 languages, light and dark, phone and computer, a test for every rule, full
   suite, APK link.
5. **Record it**: the options link, his pick and the combined link go in `NEXT_CHAT.md` (and the feature's own notes),
   so the next session knows what was agreed.

## Where the pages are kept
- Published as private Artifacts (claude.ai/artifact/…); the links are listed below and in `NEXT_CHAT.md`.
- Keep the HTML source short and self-contained (no outside images); phone mock-ups at about 290 px wide.

## Log (newest first)
| Date | Screen | Options page | Ali's pick | Combined / built |
|---|---|---|---|---|
| 17 Nov 2026 | Computer look ("make an interface that looks well on a computer and appealing") | round 1 https://claude.ai/artifact/LAmhFhNDxoDLX9bvV5omtB (L1–L5) → "L4" but "I still did not accept 1 interface option"; asked: light version in the phone's colours, dark glass on the phone too, a calendar on the computer | round 2 https://claude.ai/artifact/Rfk4oCQFVqyNdsTJR2GBMo (docs/mockups/glass-look.html: G1 dark glass + week on Home · G2 light glass in the phone colours · G3 dark glass phone (no live blur) · G4 light glass phone · C1–C3 where the week lives) → **G1 ("why is the calendar messed up" — redrawn), G2, G3, C1** | combined https://claude.ai/artifact/3CUkeHy43iX4zzt9xBdwLQ (docs/mockups/glass-combined.html) — waiting for his OK |
| 17 Nov 2026 | Calendar ("I want the calendar to look very good") | https://claude.ai/artifact/Pfx2JXzwa7sD5KThoBHkmB (docs/mockups/calendar-styles.html: K1 all-day lane + hours with a now line · K2 each day a column of cards · K3 the week by kind; each dark + light glass) | **K1** → combined page updated with K1 (https://claude.ai/artifact/3CUkeHy43iX4zzt9xBdwLQ v2) → **OK-G1 OK-G2 OK-G3** → built v10.3 |
| 17 Nov 2026 | Computer layout ("like the mobile app put on a computer"), Agents listing ("fix the opening and the filling of the details … even if displaying it another way"), Tips ("don't appear good") | https://claude.ai/artifact/JCGhHo77srRGUjp4Q2f9WL (docs/mockups/desktop-agents-tips.html: D1–D4 · L1–L4 · T1–T3; recommended D1 L1 T1) | **D1**, **L1** ("but it should still redirect me to the right listing — I don't want to open the product in search and search again"), **T1 T2 T3** | combined https://claude.ai/artifact/CkbzEJEpupPdYdBKbjtxdn (docs/mockups/desktop-agents-tips-combined.html) — **"OK-D1 OK-L1 OK-T"** → L1 + T built; D1 built for Travel, Medicines, Projects (the rest next) |
| 13 Nov 2026 | Free vs Pro + the "set up your life" guide (Ali: "set what will be free and what will be pro … in a smart way"; "the app should guide pro users how to use that … popping on in the app or also being in the settings") | https://claude.ai/artifact/ExrP7vKai43EJDLSFVimHs (docs/mockups/free-pro.html: FP-1…4 split · PM-1…4 how Pro is shown · GD-1…5 the guide · GW-A…C who gets it · TR-1…3 trial; my recommended: FP-4 PM-1 GD-5 GW-A TR-3) | **FP-4** ("only if automation is really stronger, saves a lot of time and is always right, so no undo or rechecking") **PM-1 PM-2 PM-4 GD-5 GW-A TR-3** + 2 new ideas (model thinks with the app closed; a 24/7 agent that understands everything) | combined + new ideas: https://claude.ai/artifact/XF3TxLzpUYDzBmNPecpdTL (docs/mockups/free-pro-combined.html: OK-1…4 · BG-1…3 · BR-1…4) — waiting for his OK |
| 11 Nov 2026 (night) | Combined screens for the joined / noted picks (step 3) | https://claude.ai/artifact/HeHrRSrz3BNcDa9vwZhGNU | OK to all (12 Nov) | building (AUTOMATION_PLAN.md) |
| 11 Nov 2026 (later) | The 29 picked automation features — how each looks (Ali: "show me their interface … this is the last time I accept an idea without seeing how it will look") | https://claude.ai/artifact/NSsHTv8B6NSzN9eCS1Got8 (each feature X-A / X-B, Recommended marked) | see AUTOMATION_PLAN.md (his picks + notes) | combined: next row |
| 11 Nov 2026 | Research: automation + the best of 30 apps (Ali: "deeply think and research how to make the app very good in automation … take the best thing of each app") | https://claude.ai/artifact/VAmamnCKNj3gqxVNsadFo3 (AU1–AU8 automation · M1–M5 money · T1–T6 to-dos · N1–N3 notes · P1–P3 people · TR1–TR3 travel · PR1–PR2 projects · X1–X6 new) | AU1–AU8, M1 M3 M5, T1–T6, N1 N2 ("only if very accurate") N3, P1–P3, TR1 TR2 ("good if done right") TR3, X1 X2 X3 ("must read photos very well") X4 X6 ("excellent if it understands everything"); X5 later (after launch); not picked: AU-none, M2 M4, PR1 PR2 | screens: next row |
| 12 Nov 2026 | Agents & Scout — Ali: "I am tired of agents … keep them as they are now but just change the interface or how I am using it" (after his Scout screenshot) | https://claude.ai/artifact/E6UkVGJiwkMwVt846WEUii (round 2 after his Agents screenshot "Cards, List and Board are so confusing; every info clear; customization easy; details very clear": AV-1…AV-7 one Agents page (AV-6 like Claude Duet, AV-7 like ChatGPT Scheduled), SC-1…SC-3 instead of 100/100; source docs/mockups/agents-scout-ways.html) | Ali (no code): "editable as much as you can for every agent in an easy way; if there are 10 offers written in a good way, open any of them → the exact page" | combined https://claude.ai/artifact/DQyJJ7Pm2U8FujwNYz4eS3 (OK-1 list · OK-2 all offers each Open ↗ exact page · OK-3 what I watch, every line Change · OK-4 one-setting sheet) — **Ali: "OK-1 OK-2 OK-3 OK-4"** | built v9.9.21 (agentedit.js, agents-ui.jsx OK section, e2e_v9921agentsok) | — |
| 10 Nov 2026 | Agents ("scattered … how to auto-check … is the new find better?") + Follow-ups question cards ("not logical") | https://claude.ai/artifact/QBdtAc2f6TgLA44rLpgLBi (AG1–AG3 page · AC1–AC3 auto-check · AH1 plan first · FQ1–FQ3 cards) | **AG1 AG2 AC2 AC3 AH1** + AG2 = "see another date and another hotel with a good price"; subscriptions: ads ignored by themselves, a subscription added by itself + "who pays it" (his father pays Google AI Pro, he wants the reminder) | combined https://claude.ai/artifact/MKnujhxuS8SgLncLadhA1W — **"OK1", "OK2 — make sure it understands 99 percent of notifications", "Right" (his father pays; reminder only)** → built v9.9.13 |
| 8 Nov 2026 | Follow-ups from scratch ("confusing and scattered") | https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC (FU1–FU5) | **FU1** (one feed) | built v9.8.4, then Ali: "cancel FU1, tell me a better option" |
| 8 Nov 2026 | Follow-ups round 2 (FU1 cancelled) | https://claude.ai/artifact/FsAwRjNtSWY4Lb7fCVSfYY (FU6 Attune asks · FU7 one card · FU8 out/in/to do · FU9 no page · FU10 tiles) | **FU6** + "edit anything by talking" | built v9.9 |
| 10 Nov 2026 | Notifications: Attune asks, you tell it, it remembers | https://claude.ai/artifact/MmUidfQHioDS3NuqzTGJwV (A1 Follow-ups · A2 on the notification · A3 Home once a day · A4 Chat · L learned list) | **A1 A2 A4 L** ("integrate them in a good way … understands anything I type") | built v9.9.11 |
| 10 Nov 2026 | Money Report: move between months / day X to day Y | https://claude.ai/artifact/TeMyVf4p2FfgaJocDndgiT (P1 arrows + From/To · P2 chips · P3 say it · P4 calendar) | **P1** + "a specific date and category at the same time" | built v9.9.9 |
| 10 Nov 2026 | Radar card readable ("it looks really bad": dark words on dark in the light theme — fixed) + 3 looks | https://claude.ai/artifact/R1UWeisuGPnseigFyo1ar8 (A photo behind · B photo in the corner · C colour only) | **C** (colour only; "I don't like the photo this way") | built v9.9.8 |
| 10 Nov 2026 | Radar document card ("the extra things in Edit, easier to look at") | https://claude.ai/artifact/6bjm3PQWxPKhXUSFq8DWBx (R1–R4) | **R3** (looks like the real card) | built v9.9.7 (one option, as asked — no combined page) |
| 9 Nov 2026 | All open options (timetable photo, Chat checks your notes, Notion ideas, do it for me, several AI models, Found colour) | https://claude.ai/artifact/CQZCRBEDAcv7NJG6VG3V5J (T1 S1 G1 · N1–N5 · W1–W3 · M1–M5) | **T1 S1 G1 N1 N3 W1 W2 M1 M2 M3 M4** (W2: ask which Ahmed + pick a contact, Play-safe; M2: small models only) | G1 + S1 built v9.9.2 |
| 9 Nov 2026 | What I understood: T1 N1 N3 W1 W2 M1–M4 + new idea "teach Attune from notifications" (L1–L4) | https://claude.ai/artifact/UNQfGvdVLJyATkZ2JZDNHz | all OK (T1 N1 N3 W1 W2 M1–M4 L1–L4) | L, W2, T1 v9.9.3; M1, M3 v9.9.4 |
| 10 Nov 2026 | Documents: photos (D1), details (D2), secret fields (S1–S3) | https://claude.ai/artifact/X6Rovna21JhYvjpNu4hhfj | **D1 D2 S1** (+ per-detail lock incl. S2, own time) | built v9.9.5 |
| 8 Nov 2026 | Agents look again (A5–A8), Tools colours (T1–T4) | https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC | A5 + T1 | built in v9.8.2 |
| 7 Nov 2026 | Colours (more colours, less burgundy), Agents ("scattered"), Follow-ups ("poor"), Documents, a new big idea | https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC (C6–C9, A1–A4, F1–F4, D1–D4, I1–I4) | C6 · A3 · F1 · D1 · "I1 if done correctly" + another strong idea | C6 A3 F1 D1 + I1 built in v9.8; I5–I7 rejected ("too basic"); researched N1–N3 on the same page → Ali: "do N1 and N3" → built in v9.8 |
| 6 Nov 2026 | Message scheduler like Auto Text ("with my interface") | https://claude.ai/artifact/EJoWBPbPS2J5B5EsCEnmxj (M1–M3 how it sends · S1–S5 screens) | M3 + S1 + S2 + S3 ("go") | built in v9.7 (the M3 + S1 note on the page was the combined plan) |
| 6 Nov 2026 | Colours ("I didn't mean everything burgundy — darker, harder to read") | https://claude.ai/artifact/E8FbW1hcBmvmFHqWCAwk1P (C1–C5) | C1 quiet burgundy ("if done right — calm and clear") | built in v9.6 (no combined page needed: one option) |
| 5 Nov 2026 | Agents, Month plan, Follow-ups | https://claude.ai/artifact/1HJyhGHDsm5Ko9RXpK6ZrJ (A1–A6, P1–P6, F1–F6) | A3 + A4 with offers on several dates · P2 + P4 + P5 + P6 with savings goals over any time span · F1 + F4 | https://claude.ai/artifact/2T2ZRNTemt42fTyvYX6FeY — "OK", built in v9.6 |
| 5 Nov 2026 | Gemini research picks | https://claude.ai/artifact/GaNgb3thF9dSYox2Pt1HkA | none yet ("not inclined to accept anything" for now) | — |

## 12 Nov 2026 — phone rules (Bluetooth / charging / Wi-Fi) — step 1, waiting for Ali's pick
- Page: https://claude.ai/artifact/7HPTScnSAGUsUj6NKnK8Vf (docs/mockups/phone-rules.html). R1 A–D (how triggers fire: Bluetooth instant
  always; charging / Wi-Fi when Attune is open · with a permanent notification · within ~15 min (recommended C) · per rule), R2 A–B (pick
  the device from paired devices (recommended A) or learn it on the next connection).
- Ali picked R1-C + R2-A. Combined screen (step 3): https://claude.ai/artifact/UZqLbcCnLDKbytdgdbc1uY (docs/mockups/phone-rules-combined.html)
  — waiting for his OK.
- 13 Nov: Ali OK'd OK-1 OK-2 OK-3 → built in v9.9.26 (phonerules.js, PhoneRules.kt, rules-ui pickers).

## 13 Nov 2026 — place reminders: the background-location decision (step 1, waiting for Ali)
- https://claude.ai/artifact/AVJVQmU2W42JC1Kgf1Ju1g (docs/mockups/place-reminders.html): P-1 everywhere incl. Play (form + video + review),
  P-2 full APK first (recommended), P-3 only while Attune is open, P-4 leave it out.
- Ali picked P-2. Combined screen: https://claude.ai/artifact/6WqaNahzA9dm66YpDgcB8m (docs/mockups/place-reminders-combined.html) — Ali: "OK-2 OK-3 OK-4" (OK-1, the separate explanation screen, not OK'd → left out).
  Built in v9.9.28.

## 13 Nov 2026 — smart notifications (no new screen)
- Ali: "I want Attune to understand notifications very well, not keep asking like a stupid … really smart". Built without a new
  mock-up round: nothing new is drawn — it uses the screens he already OK'd (Autopilot's "Done for you" + Undo, I1; the trip list).
  What changed is WHEN Attune asks (only when it truly can't tell) — his own instruction. Earlier picks it replaces: I1 "nothing without
  a tap", A1/A2 "ask me about chats" (now only when he asks to teach, in Chat), TR1 B "ask first" (now only bookings without a code).

- 14 Nov 2026 (v9.9.38, from the 1M test): count goals CG-1..4 + week start WK-1..3 — docs/mockups/goals-week.html → https://claude.ai/artifact/Shh9zXeQFYVAZ8sDK6nMcL (waiting for Ali)
- 14 Nov 2026: Ali picked CG-3 (+ his book idea: plot, review, lessons, the PDF Chat answers from) and WK-2 + WK-3 → combined page docs/mockups/books-week-combined.html → https://claude.ai/artifact/Y7mhmLwv1vQornz2gc49Fb (waiting for his OK)
- 14 Nov 2026 (v9.9.39, Ali: "the left sidebar is very crowded with the 2 additions"): sidebar SB-1..4 (SB-4 recommended) — docs/mockups/sidebar.html → https://claude.ai/artifact/KfGxZstBvgu9cwSiNpck9h (waiting for Ali)
- 14 Nov 2026: Ali picked **SB-4** (one option, no wishes → built as shown): setup strip at the top until done, Knows · Backup · Settings at the bottom, Settings keeps Set up your life — tests/e2e_v9939sidebar.py
- 14 Nov 2026 (v9.9.39, Ali: "organise the app interface in the best way possible — is it necessary?"): UI-1..4 (UI-1 recommended) — docs/mockups/interface-tidy.html → https://claude.ai/artifact/HcHFCHBbGE3aD83u3b96hd (waiting for Ali)
- 14 Nov 2026: Ali picked **UI-1** (one option, no notes → built as shown): Home = box → Right now → To do → ONE noticed card; feature cards / Knows / Your week / Your day in My report; sidebar "More" group; tips make room — tests/e2e_v9939home.py
- 14 Nov 2026 (Ali: "the whole autopilot idea is very stupid" → the six rules agreed in chat): new Autopilot CH/EX/SL/DN/NS/AS options — docs/mockups/autopilot-new.html → https://claude.ai/artifact/NXQ3UaJ9VVT5TmpMcUaJrV (waiting for Ali)
- 14 Nov 2026: Ali picked CH-1 (+ "understand when I tell it I bought the shopping list"), EX-1, SL-1, DN-1, NS-2, AS-2 (+ "display the full message of everything — I want to check everything the app does myself") → combined docs/mockups/autopilot-combined.html (waiting for his OK)
- 16 Nov 2026 (v10.0.3, Ali: "how is Projects effective inside this app" + "My things vs the dates in Follow-ups"; "if it will be bad on the phone then we can make it on a computer only"): P1–P4 (link projects to Follow-ups / Money / People / add from anywhere), W1–W3 (where Projects lives — W2 recommended: light on the phone, files + questions on the computer), T1–T3 (where My things lives — T1 recommended: inside Money) — docs/mockups/projects-things.html → https://claude.ai/artifact/U5WpjKYfBNtG6gkpg8SAyb (waiting for Ali)
- 16 Nov 2026: Ali picked **P1 P2 P3 P4 W2 T1** (T1 note: "can't it be better in Follow-ups and can be linked to Money" → My things = a "Things" chip in Follow-ups, each price linked to its payment in Money) + asked "a lot of features we added in bulk — I don't know how to find each one" → combined page with "what I understood" (waiting for his OK) + the map of where every feature lives + F1–F3 (find a feature: side-menu search, How to use as the map, "where is …" in the Home box) — docs/mockups/projects-combined.html → https://claude.ai/artifact/LSwKU9ZuNeFL2d1b1L4Ziw
- 16 Nov 2026: Ali said **OK** ("OK — build P1 P2 P3 P4 W2 T1 (My things in Follow-ups)") + picked **F1 F3** → built in v10.1 (tests/e2e_v1010.py). One difference from the mock-up: Things I own is a section on Follow-ups, not a chip (Follow-ups has no chips row any more).
