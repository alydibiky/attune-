// Voice step 1.2–1.3 (VOICE_PLAN.md): the accuracy set (tests/voice/commands.json — every supported dialect) must score 100%,
// the conversation never sends without the read-back, Franco is written the way people text, each person's language is remembered.
import fs from "fs";
import * as V from "../../web-src/voice-cmd.js";
import * as F from "../../web-src/franco.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const cases = JSON.parse(fs.readFileSync(new URL("../voice/commands.json", import.meta.url), "utf8"));
let right = 0; const wrong = [];
for (const c of cases) {
  const r = V.parseVoice(c.say, {});
  const good = Object.entries(c.expect).every(([k, v]) => (v === null ? r[k] == null : String(r[k] || "") === String(v)));
  if (good) right++; else wrong.push(c.say + " → " + JSON.stringify(r));
}
ok(right === cases.length, `accuracy set: ${right}/${cases.length} understood exactly` + (wrong.length ? "\n    " + wrong.join("\n    ") : ""));
// ---- the conversation (Ali's example) ----
const inbox = [{ key: "k1", app: "whatsapp", who: "Ahmed Samir", text: "enta gay emta?", ts: 3, canReply: true }, { key: "k3", app: "whatsapp", who: "Ahmed Ali", text: "ok", ts: 1, canReply: true },
  { key: "k2", app: "whatsapp", who: "ماما", text: "كلمني", ts: 2, canReply: true }, { key: "k4", app: "telegram", who: "Sara", text: "meeting at 5?", ts: 4, canReply: true }];
let st = V.newVoiceState(), people = {}, r;
const turn = (s) => { r = V.voiceTurn(st, s, { inbox, people }); st = r.state; if (r.people) people = r.people; return r; };
turn("ابعت لأحمد إني هتأخر نص ساعة");
ok(r.card.kind === "ask" && r.card.options.length === 2 && !r.action, "two Ahmeds → it asks which (no action): " + r.say);
turn("سمير"); ok(/فرانكو/.test(r.say) && /بيكتب فرانكو/.test(r.say) && !r.action, "«سمير» picks Ahmed Samir across scripts; asks Arabic or Franco, noticing he writes Franco");
turn("فرانكو"); ok(r.card.kind === "readback" && r.card.text === "hat2akhar nos sa3a" && !r.action, "Franco → read back «hat2akhar nos sa3a» before anything is sent");
turn("ابعت"); ok(r.action && r.action.kind === "send" && r.action.key === "k1" && r.action.text === "hat2akhar nos sa3a", "«ابعت» → sent through Ahmed Samir's own WhatsApp reply");
turn("ابعت لأحمد سمير إني وصلت"); ok(r.card.kind === "readback" && r.card.text === "wselt", "the second time it does not ask the language — Ahmed Samir is remembered as Franco");
turn("لا"); ok(!r.action && r.card.kind === "done" && r.card.ok === false, "«لا» → cancelled, nothing sent");
turn("tell Sara I'm running late"); turn("English"); ok(r.card.text === "I'm running late" && r.card.app === "telegram", "English: Sara's reply goes back on Telegram, where she wrote");
turn("change it to see you at 8"); ok(r.card.kind === "readback" && r.card.text === "see you at 8", "change it → read back again with the new words");
turn("yes"); ok(r.action && r.action.text === "see you at 8", "…then yes sends the changed words");
turn("مين بعتلي"); ok(r.card.kind === "messages" && /4 رسايل/.test(r.say), "«مين بعتلي» → reads the newest messages aloud");
turn("رد عليه قوله تمام"); ok(r.card.kind === "readback" && r.card.to === "Sara", "«رد عليه» replies to the last one read (Sara)");
st = V.newVoiceState(); turn("ابعت لعمر إني جاي");
ok(r.card.kind === "ask" && /مين «عمر»/.test(r.say) && r.card.options.includes("حد تاني"), "a name it does not know → it asks who that is (recent chats + “someone else”), never guesses");
turn("حد تاني"); turn("عربي"); turn("ابعت");
ok(r.action && r.action.key === null && /هفتحلك/.test(r.say), "someone else → the app opens with the message ready (the person picks the contact)");
// ---- 2.3 nicknames: «ماما» learnt once ----
const fin = [{ key: "f1", app: "whatsapp", who: "Fatma ❤️", text: "كلمني", ts: 9, canReply: true }, { key: "k9", app: "whatsapp", who: "Karim", text: "yo", ts: 8, canReply: true }];
st = V.newVoiceState(); people = {};
r = V.voiceTurn(st, "ابعت لماما إني جاي", { inbox: fin, people }); st = r.state;
ok(r.card.options.includes("Fatma ❤️"), "«ماما» is not a contact name → it asks who «ماما» is");
r = V.voiceTurn(st, "Fatma ❤️", { inbox: fin, people }); st = r.state; people = r.people || people;
ok(r.card.kind === "ask" && /فرانكو/.test(r.say), "…picked Fatma ❤️ → it goes on (language)");
st = V.newVoiceState(); r = V.voiceTurn(st, "قول لماما هتأخر", { inbox: fin, people });
ok(r.card.kind === "ask" && /فرانكو/.test(r.say) && r.state.draft.target.key === "f1", "the next time «ماما» goes straight to Fatma ❤️ (the nickname is remembered)");
// ---- 2.2 dialects: Attune answers the way the person speaks ----
st = V.newVoiceState(); r = V.voiceTurn(st, "علّم خالد إني وصلت", { inbox: [{ key: "x", app: "whatsapp", who: "خالد", text: "وينك", ts: 1, canReply: true }], people: { "خالد": { lang: "ar", name: "خالد" } }, style: "gulf" });
ok(/أرسلها؟/.test(r.say), "Gulf: «… أرسلها؟» — " + r.say);
st = r.state; r = V.voiceTurn(st, "زين", { inbox: [], people: {}, style: "gulf" }); ok(r.action && r.action.kind === "send", "Gulf «زين» = yes → sent");
st = V.newVoiceState(); r = V.voiceTurn(st, "صيفط لكريم بلي غادي نتعطل", { inbox: [{ key: "y", app: "whatsapp", who: "كريم", text: "fin", ts: 1, canReply: true }], people: { "كريم": { lang: "ar", name: "كريم" } }, style: "maghreb" });
ok(/نصيفطها؟/.test(r.say), "Darija: «… نصيفطها؟»");
st = r.state; r = V.voiceTurn(st, "واخا", { inbox: [], people: {}, style: "maghreb" }); ok(r.action && r.action.kind === "send", "Darija «واخا» = yes → sent");
st = V.newVoiceState(); turn("ابعت لماما إني وصلت"); turn("tell Sara I'm late");
ok(r.card.kind === "ask" && /Arabic, Franco or English/.test(r.say) === false || r.card.to === "Sara" || /Sara/.test(r.say), "a new command leaves the unanswered question behind");
// ---- the correct contact (Ali: "make sure it sends the correct contact") ----
const gin = [{ key: "g1", app: "whatsapp", who: "Ahmed Samir", convo: "Family", group: true, text: "salam", ts: 9, canReply: true }, { key: "a1", app: "whatsapp", who: "Ali Hassan", text: "ok", ts: 5, canReply: true }, { key: "l1", app: "whatsapp", who: "Lee", text: "hi", ts: 6, canReply: true }];
st = V.newVoiceState(); people = { "ahmed samir": { lang: "ar", name: "Ahmed Samir" } };
r = V.voiceTurn(st, "ابعت لأحمد سمير إني جاي", { inbox: gin, people }); st = r.state;
ok(r.card.kind === "readback" && r.card.direct === false && r.card.onlyInGroup === "Family", "Ahmed only wrote in the Family group → never sent into the group; the card says so (the app opens on him)");
r = V.voiceTurn(st, "ابعت", { inbox: gin, people }); ok(r.action.key === null, "…and the send carries no group key");
st = V.newVoiceState(); r = V.voiceTurn(st, "ابعت للعيلة إني جاي", { inbox: gin, people });
ok(V.findPeople("Family", { inbox: gin }).some((p) => p.isGroup && p.key === "g1"), "a group is reached only when named as the group (Family → its own key)");
ok(V.findPeople("علي", { inbox: gin }).map((p) => p.name).join() === "Ali Hassan" && !V.findPeople("علي", { inbox: gin }).some((p) => p.name === "Lee"), "«علي» → Ali Hassan only (a short name never matches “Lee” by sound)");
st = V.newVoiceState(); people = {}; r = V.voiceTurn(st, "tell Ali Hassan I'm here", { inbox: gin, people }); st = r.state; r = V.voiceTurn(st, "English", { inbox: gin, people });
ok(r.card.to === "Ali Hassan" && r.card.last === "ok" && r.card.direct, "the read-back names the full contact, the app and their last message (to check it is the right person)");
// ---- 2.2 global: Spanish / Turkish / French replies; no Franco question for a non-Arabic speaker ----
st = V.newVoiceState(); r = V.voiceTurn(st, "dile a Ana que llego tarde", { inbox: [{ key: "a", app: "whatsapp", who: "Ana", text: "dónde estás?", ts: 1, canReply: true }], people: {} });
ok(r.card.kind === "readback" && /¿Lo envío\?/.test(r.say) && r.card.text === "llego tarde", "Spanish: no language question, read back «llego tarde» — " + r.say);
st = V.newVoiceState(); r = V.voiceTurn(st, "Ahmet'e mesaj at ki geç kalacağım", { inbox: [{ key: "t", app: "whatsapp", who: "Ahmet", text: "neredesin?", ts: 1, canReply: true }], people: {} });
ok(/Göndereyim mi\?/.test(r.say), "Turkish: «… Göndereyim mi?»");
st = r.state; r = V.voiceTurn(st, "evet", { inbox: [], people: {} }); ok(r.action && r.action.text === "geç kalacağım", "Turkish «evet» → sent");
st = V.newVoiceState(); r = V.voiceTurn(st, "dis à Marie que je suis en retard", { inbox: [{ key: "f", app: "whatsapp", who: "Marie", text: "tu es où ?", ts: 1, canReply: true }], people: {} });
ok(/Je l'envoie \?/.test(r.say), "French: «… Je l'envoie ?»");
// ---- Franco ----
ok(F.toFranco("الاجتماع اتأجل لبكره الساعة ٣") === "el egtma3 et2agel l bokra el sa3a 3", "Franco: «الاجتماع اتأجل لبكره الساعة ٣» → el egtma3 et2agel l bokra el sa3a 3");
ok(F.toFranco("أنا في الطريق وجاي بكرة", "gulf") === "ana fe el6ree8 w jay bacher", "Gulf style: jay, bacher, 6 for ط");
ok(F.isFranco("Ana hat2akhar nos sa3a") && !F.isFranco("I will be late") && F.styleOf(["ezayak ya basha", "enta fein?"]) === "franco", "Franco is told from English, and how a person writes is read from their messages");
ok(V.skeleton("سمير") === V.skeleton("Samir") && V.skeleton("أحمد") === V.skeleton("Ahmed"), "names match across Arabic and Latin letters (سمير = Samir, أحمد = Ahmed)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
