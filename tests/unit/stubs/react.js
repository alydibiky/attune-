// Test stand-in for React: lets a .jsx module's pure functions load in Node (no rendering).
const noop = () => null;
export const useState = (v) => [typeof v === "function" ? v() : v, noop];
export const useMemo = (f) => f(); export const useEffect = noop; export const useRef = (v) => ({ current: v }); export const useCallback = (f) => f;
export const createElement = noop; export const Fragment = "f";
export default { createElement, Fragment, useState, useMemo, useEffect, useRef, useCallback };
