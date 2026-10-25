# "Ya Attune" — the voice assistant (Ali's pick, 25 Oct 2026)

**Read this first if you continue the voice work.** Ali: "start in the most efficient way possible, and after each step upload a
handoff on GitHub so the next chat knows everything and nothing is lost." → tick the steps below as they land, and keep the
"State" table true.

## What Ali asked for (his words, summarised)
- A hands-free assistant you talk to, in your own dialect, that runs your life (Money, reminders, Agents, Health…) and your
  phone (messages, calls, maps, apps) — offline, private, **really accurate and powerful**.
- **Franco**: "I tell it in Arabic to send person X something, it asks me which language, I say Franco or Arabic" — and it
  remembers per person.
- **Global**: not Egypt-only — every region's dialect and its own "Franco" (Gulf / Levantine Arabizi, Darija + French,
  Hinglish, Roman Urdu), local apps, currencies and dates.

## Rules for this feature (do not break)
1. **Code decides, never a guess.** The command is read by code (`web-src/voice-cmd.js`); two people with the same name, a
   missing message, an unknown app → a question, not an action. The AI model is only a fallback for free chat.
2. **Read back before sending.** A message is never sent without the person hearing/seeing it and saying "send" (ابعت/send/
   yes). "Send without asking" is per person and off by default.
3. **The person's own words.** Only translated / made formal when asked ("اكتبها بأدب", "make it formal").
4. **Private.** Voice and messages stay on the phone. Messages are read from notifications (Notification access, already
   used by Money and Message alerts); replies go through the app's own notification reply (RemoteInput) — WhatsApp,
   Telegram, Messenger, Signal… SMS is never read (Attune's promise).
5. **The correct contact (Ali, 25 Oct).** A reply uses the conversation's own notification key (exact chat). Two people with
   the same name → asked. A short name ("Ali") only matches exactly / through ALIAS, never by sound. A person who only wrote in
   a group is NEVER reached through the group's key (the app opens on them instead); a group only when named as the group.
   The read-back shows the full name, the app and their last message. No recent chat → the app opens with the text ready and
   the person picks the contact (no guessing a phone number).
6. **Measured accuracy.** `tests/voice/commands.json` = real-style commands in every supported dialect with the expected
   result; `tests/unit/v1100voice.test.mjs` scores it and fails under the bar. Add a line for every bug found.

## Phases and steps (tick as done)
### Phase 1 — talk or type, and it acts (no wake word yet)
- [x] 1.0 This plan (VOICE_PLAN.md)
- [x] 1.1 Mock-ups for Ali: the voice screen + car mode, 3 options (`design/voice-options.html` + `.png`, sent in chat 25 Oct) —
      **Ali picked A (calm orb)** — "A is good but make sure it sends the correct contact"
- [x] 1.2 Engine (pure JS, unit-tested): `voice-cmd.js` — send / who messaged me / read / reply / call / open app / log money /
      remind, in Egyptian, Gulf, Levantine, Darija, English (+ Hinglish words); the dialogue (asks language, reads back,
      confirms, picks between two Ahmeds); `franco.js` — Arabic → Franco (Egyptian 3/2/7/5, Gulf variants), Franco detection,
      per-person language memory
- [x] 1.3 Accuracy set `tests/voice/commands.json` (68 lines: Egyptian, Gulf, Levantine, Darija, English, Hinglish) + scorer
      `tests/unit/v1100voice.test.mjs` (must be 68/68 — add a line for every new phrase or bug)
- [x] 1.4 Android: recent chat messages from notifications with their reply action (`ChatInbox.kt`), `chatInbox()` /
      `chatReply({key, text})` in NativeBridge; fallback = open the app with the text (PhoneActions whatsapp)
- [x] 1.5 Wire it: the Home box (typed) and its mic (spoken) run the voice dialogue; answers are spoken (speak / voicecall.js)
- [x] 1.6 The voice screen Ali picked (A, calm orb): `web-src/voice-ui.jsx` VoiceScreen — orb, heard words, one card (ask with
      option buttons / read-back with full contact + app + their last message + Change (inline edit) / Send / messages /
      done), typing box, mic; hands-free loop (listens again while a question is open); opened by the orb button in the Home box
      (`home-voice`), "/voice", or the `attune-voice` event; not-a-message sentences go to the Home box (doFromHome) and the
      answer is spoken (speakWait → speak → speechSynthesis)
### Phase 2 — car mode, more dialects, nicknames
- [x] 2.1 Car mode — voice-ui.jsx `car` view (design A's car screen): the newest message big + read aloud by itself (polls
      chatInbox every 6 s), Read / Reply (reply by voice to that person — a group sender never through the group), Talk,
      Messages · N, Navigate (asks where → Google Maps directions via openAnyApp), a typing box for a passenger; opened by the
      🚗 button on the voice screen or by saying «وضع العربية» / "car mode". Android Auto: later
- [~] 2.2 Dialects: understanding = Egyptian, Gulf, Levantine, Darija, English, Hinglish (75/75); Attune's spoken replies in
      Gulf / Levantine / Darija (voice-cmd.js DIALECT, from the country) + their yes/no («زين», «واخا», «بعتها», «ما بدي»).
      Still to do: Turkish, Spanish, French, Hindi/Urdu replies and commands; per-country message apps
- [x] 2.3 Nicknames: a name with no such contact → "مين «ماما»؟" with the recent chats + "someone else"; the pick is
      remembered (franco.js aliasFor / rememberAlias, key "~name" in attune:voice:people) and used next time
### Phase 3 — "يا أتيون" wake word
- [ ] 3.1 A tiny always-listening model (low power), Egyptian + Gulf + English voices; clear notification + on/off switch
      (Google Play rules on background microphone)

## State (update every step)
| Step | Files | Status |
|---|---|---|
| 1.0 plan | VOICE_PLAN.md | done |
| 1.1 mock-ups | design/voice-options.html, design/voice-options.png | Ali picked A (calm orb) |
| 1.2 engine | web-src/voice-cmd.js (parseVoice, voiceTurn, findPeople, skeleton), web-src/franco.js (toFranco eg/gulf/lev/maghreb, isFranco, styleOf, per-person memory `attune:voice:people`), web-src/franco-words.js (built by tools/franco_words.py from Franco.kt) | done, not wired yet |
| 1.4 android | ChatInbox.kt (+PayListener hook), NativeBridge chatInbox / chatReply | CI compile check run 40227788489 |
| 1.5–1.6 wiring + screen A | web-src/voice-ui.jsx, attune.jsx (voiceOpen, navTo "voice", /voice app, overlay), home-ui.jsx (orb button) | e2e tests/e2e_v1100voice.py passes |
| 1.3 accuracy | tests/voice/commands.json, tests/unit/v1100voice.test.mjs | 68/68 + conversation + correct-contact checks |

## SMS — Ali picked B (25 Oct): an opt-in switch, off by default
"Read SMS notifications" (`web-src/sms-ui.jsx` SmsSwitch, in Message alerts and on the voice screen) → `Prefs.smsNotifs` /
`setSmsNotifs` (NativeBridge `smsNotifs()` / `setSmsNotifs(on)`) → `WatchMatch.smsAllowed` (set by PayListener on every
notification). With it on: Message alerts ("any" or "sms" rules), ChatInbox ("who messaged me", voice replies through the SMS
app's own Reply; no recent chat → the SMS app opens with the text). Never the SMS inbox (no SMS permission), never one-time
codes (`PayLog.isOtp` in ChatInbox and MessageWatch). Recall and Automations still never read SMS. Privacy policy updated
(EN + AR, "Messages and SMS notifications (optional)"). Kotlin test: tests/kotlin/WatchMatchTest.kt.
**Ali must update the Play Console data-safety form** (messages read on device, not shared) before release.

## Money evidence (Ali, 25 Oct: "make sure it reads SMS and logs them to Money if there is an expense — and I want the
## evidence of the complete real message for confirmation")
Bank SMS shown as notifications already reach Money through the payment reader (PayListener → PayLog, OTPs never). Now every
payment keeps `evidence {text (the complete message, ≤2000), from, app, ts}` (paylog.js evidenceOf / toTxns / appendToLedger,
Yusr add-txns), the review card shows it before Add (paylog-ui.jsx Evidence), "See the messages" lists the auto-added ones
with theirs, and the transaction sheet in Money shows "The message as it arrived" (Yusr #tx-evidence). Test:
tests/e2e_v727paylog.py. The Money payment reader is separate from the SMS switch (it was already disclosed; privacy text now
names bank SMS and the kept evidence).

## Next steps (for the next chat)
1. Phase 2.2 rest: Turkish / Spanish / French / Hindi-Urdu commands + replies (global). 2. Phase 3 wake word «يا أتيون».
3. English translation of an Arabic message when the
person picks English (state.draft.needs = "translate" — wire to the model with a read-back). 5. "Make it formal" (needs = "formal").

## Ideas parked for later (Ali)
- "Attune Saves" (the app that pays for itself — a monthly "Attune saved you EGP 3,420" with receipts): Ali said "I will do
  this idea later". Its plan is in the chat of 25 Oct; the pieces: Guardian (charged twice), Overpaying + Cancel kit, Agents
  (price drops), Money ledger, Scout fair-price meter, Missions.
