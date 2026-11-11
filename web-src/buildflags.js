/* v8.7 (Ali agreed to persona 7's launch advice): the Play Store build leaves out the Video Downloader, the keyboard and the
   overlay for its first review. The app says which build it is (NativeBridge.playBuild); a browser or the APK is not Play. */
export const PLAY_BUILD = (() => { try { const N = typeof window !== "undefined" ? window.AttuneNative : null; return !!(N && N.playBuild && N.playBuild()); } catch (e) { return false; } })();
/** The pages the Play build does not have. */
export const NOT_IN_PLAY = new Set(PLAY_BUILD ? ["video"] : []);
/** v9.9.15: reading Gmail needs Google's verification of the app (gmail.readonly is a "restricted" scope: review + a yearly security
 *  assessment, docs/GMAIL_VERIFICATION.md). Until that is passed, the Play build hides "Connect Gmail" (the export and paste still
 *  work); set to true the day Google approves. Test APKs keep the card for the 100 named test users. */
export const GMAIL_VERIFIED = false;
