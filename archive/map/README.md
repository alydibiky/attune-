# Offline Maps + the Metro page — archived 4 Nov 2026 (v9.1)

Whole-country offline maps (44 countries, OSM + Overture places, search, add a missing place), offline turn-by-turn directions
(car / walk, the optional route file), and the Cairo Metro page (its tab next to Maps).
Ali, 4 Nov: Google Maps has offline download — so places open Google Maps.

## What happens now
- `web-src/gomaps.js`: a place → a Google Maps search, or directions; opened in the Google Maps app when it is on the phone
  (NativeBridge.openInApp), else the website. Chat's place card, Travel's map button and every "open the map" use it.
- Chat: "take me to City Stars" / «وديني سيتي ستارز» starts the directions in Google Maps (tests/unit/v911gomaps.test.mjs).
- Metro stays a Chat / Home answer ("metro from Maadi to Dokki" → line, changes, minutes, ticket: metro.js metroAsk).
- Android: the map / route engines stay compiled, unused. Downloaded map files stay on the phone.

## What is here
- `web-src/`: map-ui.jsx, metro-ui.jsx, offlinemap.js, route.js (git mv); `attune-routes.jsx.txt`: the "map" and "metro" screens.

## To bring it back
git mv the files back; remove "map", "metro" from web-src/removed.js; imports `MapPage` (map-ui.jsx), `MetroPage` (metro-ui.jsx) in
attune.jsx; paste the routes; the "attune-map" event and `openMap` back to `localStorage.setItem("attune:map:ask", q); navTo("map")`.
