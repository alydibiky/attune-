# Build plan, 18 Oct 2026 — Ali: "I like all the options, do them all … make them right, smooth, easy to use, explained"

Source pages: agent options + 41 upgrades https://claude.ai/artifact/3SKvXz5Ah5ArEkPfXP3rhM, agent ideas round 2
https://claude.ai/artifact/LQ1s1sqbSGJtSC8vfZQLec. Extra asks in the same message:
- **Studio like the Honor Gallery**: erase people/objects in about a second, smooth, offline, free, without heating the phone;
  generate pictures easily and coolly.
- **Sync with two choices**: Google (cloud, Google Drive) **or** local Wi-Fi.
- **How to use**: every feature explained, "how to get the most of the app", building a strong lifestyle with it.
- Above all: right, proper code; smooth; easy to understand.

## Rules for every item
1. Code first (الكود الأول): the numbers, plans and checks are code with unit tests; the model only writes words.
2. Each item: pure module + unit test, UI + e2e test, Egyptian Arabic strings, a How-to entry, a HANDOFF line.
3. Batches are pushed to main only after `bash tests/run_all.sh` passes; each batch gets an APK.
4. A feature that can't be done well on a phone is said so, not shipped half-working.

## Order (highest value and lowest risk first)
| Batch | Items | Why first |
|---|---|---|
| 1 | M1 safe to spend · M2 installments vs cash · M4 promise score · M5 cancel kit · W1 WhatsApp order → job · D2 wait or buy · X1 Franco-Arabic | code-only, used daily, small risk |
| 2 | How to use rewrite (every feature + lifestyle plan) · H5 Instant tile · H6 Shelf review · S4 brand kit · W3 voice site report · W6 clip + subtitles · X3 privacy report | explanations and small wins |
| 3 | **Missions phase 1** (engine, night loop, debrief: save money, lose weight, buy a thing) · M3 one timeline | the new level |
| 4 | **Studio eraser** (tap to select + inpaint on GPU/NPU) and faster generation | Ali's Honor-gallery ask |
| 5 | **Sync**: Google Drive (encrypted, app folder) or local Wi-Fi (pairing code) | Ali's ask; needs a Google Cloud OAuth client from Ali |
| 6 | Missions phase 2 (forecast, conflicts) = Life Simulator (B) inside · F2 adaptive coach · H3 charts · D3 Mind recall · C4 project brain | |
| 7 | Recall (C) · S3 Doc chat tables · C1 assistants learn · C5 artifacts keep data · W2 lift plan · W4 catalogue · W5 prompt lab | |
| 8 | Large: H2 voice conversation · H4 interpreter · S1 worksheet check · S2 paper → Word · S5 mock interview · D1 pronunciation · D4 news threads · D5 metro offline · D6 trip pack · F1 depth portions · F3 labs + pills · F4 cycle temp · C2 photo edit by sentence · C3 automations · X2 engine tuner · X4 = sync | |
| 9 | Missions phases 3–4 (30+ kinds, company missions) | |

Progress is kept in HANDOFF §5.85+ and NEXT_SESSION AC.
