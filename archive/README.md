# archive/ — features taken out of Attune, kept to bring back (Ali's rule, 4 Nov 2026)

> "Anything that we remove should be removed from the app, but you have to save its code — if we want to return it later by a
> prompt it is very easy and does not take time." — Ali

Each folder holds a removed feature's code exactly as it was (moved with `git mv`, so its history is intact), its tests, the
pieces cut out of shared files (`attune-routes.jsx.txt`), and a README with the steps to restore it.

| Folder | What | Removed | Why |
|---|---|---|---|
| `studio/` | Studio: pictures made on the phone, the Honor-like photo editor, Eraser / Eraser HD | 4 Nov 2026 (v9.1) | Not part of the organiser brand (VISION.md); heavy on the phone's GPU |
| `business/` | Business: ERP builder + templates, Books, Shop/POS, client portal, Insights, the business website; Fleet & rentals (cranes, warehouse), Site reports, Crane toolkit (load charts, lift plan) | 4 Nov 2026 (v9.1) | Becomes the separate product **Attune Business** |

**How removal works in the app:** `web-src/removed.js` lists the removed tool ids; every list, hub, group, guide, Home tile and
"/" command skips them. The screens, their imports and their files are gone from the build.
**To bring a feature back:** tell Claude "bring back <name> from archive/" — the folder's README has the exact steps.
