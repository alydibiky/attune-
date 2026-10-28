/* ---- v8.7 Attune's referral server — two Firebase functions (Cloud Functions 2nd gen) + Firestore. See README.md for the
   setup (Ali: a Firebase project, Play's notifications on, the function allowed in Play Console). The rules: logic.js.
     referral      POST {op: "hello"|"redeem", token, ref?, purchaseToken?, productId?} — token = the Google token the app got
                   from Google's own sign-in screen (openid email); Google tells us whose it is
     playEvents    Play's real-time notifications (Pub/Sub topic "play-rtdn"): a new subscription → the friend who invited gets
                   their month                                                                                               */
"use strict";
const { onRequest } = require("firebase-functions/v2/https");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { google } = require("googleapis");
const crypto = require("crypto");
const L = require("./logic");

initializeApp();
const db = getFirestore();
const PACKAGE = "com.aldibiki.attune";
const ANDROID_CLIENTS = defineString("ANDROID_CLIENT_IDS", { default: "" });   // the app's OAuth client id(s), comma-separated
const ACCOUNT_SALT = defineString("ACCOUNT_SALT", { default: "attune" });       // any random words, set once, never changed

const store = {
  get: async (col, id) => { const d = await db.collection(col).doc(String(id)).get(); return d.exists ? d.data() : null; },
  set: (col, id, doc) => db.collection(col).doc(String(id)).set(doc),
};
const publisher = async () => google.androidpublisher({ version: "v3", auth: await new google.auth.GoogleAuth({ scopes: ["https://www.googleapis.com/auth/androidpublisher"] }).getClient() });
const play = {
  expiry: async (productId, token) => +((await (await publisher()).purchases.subscriptions.get({ packageName: PACKAGE, subscriptionId: productId, token })).data.expiryTimeMillis || 0),
  defer: async (productId, token, from, to) => (await publisher()).purchases.subscriptions.defer({ packageName: PACKAGE, subscriptionId: productId, token,
    requestBody: { deferralInfo: { expectedExpiryTimeMillis: String(from), desiredExpiryTimeMillis: String(to) } } }),
};

/** Who the Google token belongs to — asked of Google itself, and only for tokens made for Attune's app. */
async function whoIs(token) {
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
  if (!r.ok) throw new Error("Google did not recognise the sign-in");
  const t = await r.json(), ok = ANDROID_CLIENTS.value().split(",").map((x) => x.trim()).filter(Boolean);
  if (!t.sub) throw new Error("Google did not say who you are");
  if (ok.length && !ok.includes(t.azp) && !ok.includes(t.aud)) throw new Error("This sign-in was not made by Attune");
  return t.sub;
}
const acctOf = (uid) => crypto.createHmac("sha256", ACCOUNT_SALT.value()).update(uid).digest("hex").slice(0, 40);

exports.referral = onRequest({ cors: true, region: "europe-west1" }, async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const b = req.body || {}, uid = await whoIs(String(b.token || ""));
    if (b.op === "redeem") return res.json(await L.redeem(store, uid));
    return res.json(await L.hello(store, { uid, acct: acctOf(uid), ref: b.ref, purchaseToken: b.purchaseToken, productId: b.productId }));
  } catch (e) { res.status(400).json({ error: String((e && e.message) || e) }); }
});

exports.playEvents = onMessagePublished({ topic: "play-rtdn", region: "europe-west1" }, async (event) => {
  const msg = JSON.parse(Buffer.from(event.data.message.data || "", "base64").toString() || "{}"), n = msg.subscriptionNotification;
  if (!n || n.notificationType !== 4) return;   // 4 = SUBSCRIPTION_PURCHASED (a new subscription)
  const p = (await (await publisher()).purchases.subscriptionsv2.get({ packageName: PACKAGE, token: n.purchaseToken })).data;
  const acct = p.externalAccountIdentifiers && p.externalAccountIdentifiers.obfuscatedExternalAccountId;
  console.log("referral", await L.purchase(store, play, { acct }));
});
