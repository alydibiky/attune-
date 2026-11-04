# archive/ — features taken out of Attune, kept to bring back (Ali's rule, 4 Nov 2026)

> "Anything that we remove should be removed from the app, but you have to save its code — if we want to return it later by a
> prompt it is very easy and does not take time." — Ali

Each folder: the feature's files (git mv, history intact), the screens cut out of attune.jsx (`attune-routes.jsx.txt`), its tests,
and a README with the exact steps to restore it. In the app, `web-src/removed.js` lists the removed ids (REMOVED) and the ones
folded into another feature (FOLDED); every list, hub, guide, sidebar, Home tile and "/" command skips them.

| Folder | What | Why (FEATURES.md) |
|---|---|---|
| `studio/` | Studio, photo editor, Eraser | not the organiser; heavy on the GPU |
| `business/` | Business, Books, Shop/POS, ERP, Fleet & rentals, Site reports, Crane toolkit | → **Attune Business** |
| `fit/` | Fit & Food, Food photo, Cycle, the Health page | → **Attune Fit** |
| `deal/` | Deal Check (+ contracts) | folded into Money Guardian |
| `learn/` | Learn daily page, Homework Coach | maybe Attune Learn; the morning news stays |
| `code/` | the Code page | Chat's Run and the Python checker stay |
| `video/` | Video Downloader, cut, slow replay | Play policy; subtitles stay in Translate |
| `prompt-tools/` | Improve a prompt, Compress, Humanize, Copilot, Prompt lab pages | Chat does them (prompttools.js) |
| `map/` | offline Maps + directions, the Metro page | places open Google Maps (gomaps.js); Metro stays in Chat |
| `keyboard/` | the Attune keyboard | privacy / Play risk |
Folded (no app of its own, still used): **Scout** — its results open from an Agent card.
**To bring a feature back:** tell Claude "bring back <name> from archive/".
