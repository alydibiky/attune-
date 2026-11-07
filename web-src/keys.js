/* v9.8 (Ali, 7 Nov: "there is no Shift+Enter on the phone — it answers by itself, I can't put lines under each other"):
   one rule for every text box. On a phone / tablet (touch) Enter is a NEW LINE and only the Send button sends; on a computer
   (mouse / trackpad) Enter sends and Shift+Enter is a new line. Never while a keyboard is still composing a word (IME). */
export function isTouchOnly() {
  try { return !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches); } catch (e) { return false; }
}
export function enterSends(e) {
  if (!e || e.key !== "Enter" || e.shiftKey || e.altKey) return false;
  if ((e.nativeEvent && e.nativeEvent.isComposing) || e.keyCode === 229) return false;
  return !isTouchOnly();
}
