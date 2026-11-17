// v10.2: in the app bundle the Egyptian Arabic dictionary comes from www/i18n/ar.js (loaded by shell.html when Arabic is chosen,
// or quietly after the first screen); node tests import the real web-src/i18n-ar.js
export const AR = (typeof window !== "undefined" && window.__ATTUNE_DICTS && window.__ATTUNE_DICTS.ar) || {};
