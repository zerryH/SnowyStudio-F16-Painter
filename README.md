# SnowyStudio — F-16A Block 20 MLU Painter

An offline WebGL2 3D aircraft skin painter for creating War Thunder user skins.

**Status:** GitHub publication in progress. The V3 HTML entrypoint is here; the JavaScript engine and aircraft data files must be uploaded from the original SnowyStudio V3 offline package before the page will work.

## Features in the original V3 package
- Rotatable and zoomable UV-mapped F-16A Block 20 MLU model
- Brushes, spray, eraser and mountain tools
- Winter/camouflage presets and color tools
- Custom PNG/JPG decals with **live hover preview** before placement
- Undo and redo; import/save project
- War Thunder 4096×4096 TGA + `.blk` skin ZIP export

## Finish uploading the package
1. Download/extract the **SnowyStudio F16 Painter V3 Live Decal Preview** package from the ChatGPT conversation where the project was created.
2. In the extracted folder you should have `index.html`, `app.js`, and `assets/`.
3. Use [GitHub Desktop](https://desktop.github.com/): clone this repository, copy the full V3 folder contents into the cloned folder, then commit and push. This preserves the exact version that was tested locally.
4. Open `index.html` in Chrome or Edge once all files are present.

## Project files
- `index.html` — interface
- `app.js` — WebGL2 painter, UI, UV painting, TGA and ZIP exporters (**not yet uploaded**)
- `assets/model-data.js` — original F-16 UV mesh (**not yet uploaded**)
- `assets/texture-data.js` — bundled base 4K texture (**not yet uploaded**)
- `assets/inspiration.png` — Alpine livery reference (**not yet uploaded**)

**Assets notice:** This project works with game-derived model and texture data. Check the game's user-content terms and redistribution permissions before distributing bundled game assets publicly.

This is an independent fan project, not affiliated with Gaijin Entertainment or War Thunder.
