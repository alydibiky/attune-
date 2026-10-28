/* v8.7 (Ali agreed to persona 7's launch advice): the Play Store build leaves out the Video Downloader, the keyboard and the
   overlay for its first review. The app says which build it is (NativeBridge.playBuild); a browser or the APK is not Play. */
export const PLAY_BUILD = (() => { try { const N = typeof window !== "undefined" ? window.AttuneNative : null; return !!(N && N.playBuild && N.playBuild()); } catch (e) { return false; } })();
/** The pages the Play build does not have. */
export const NOT_IN_PLAY = new Set(PLAY_BUILD ? ["video"] : []);
