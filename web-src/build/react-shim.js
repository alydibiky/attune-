// The page loads React once from vendor/react.js (window.React); the app's
// imports of "react" resolve here.
const R = window.React;
export const useState = R.useState, useMemo = R.useMemo, useEffect = R.useEffect, useRef = R.useRef,
  useCallback = R.useCallback, memo = R.memo, Fragment = R.Fragment, createElement = R.createElement;
export default R;
