# SnowyStudio — F-16 Painter

An **offline 3D War Thunder skin painter** for the F-16A Block 20 MLU. Paint on a rotatable aircraft model, preview decals before placing them, and export War Thunder user skins.

## Getting started

1. Click **Code → Download ZIP** on GitHub and extract the downloaded folder.
2. Open `index.html` in **Chrome or Edge** with WebGL2 / hardware acceleration enabled.
3. Select a paint tool, decal, or camo preset in the left panel, then paint on the F-16.
4. Click **Export War Thunder skin** to download the TGA + `.blk` skin ZIP.

There are no dependencies to install, no backend to run, and no internet connection required after downloading.

## V3 features

- Rotatable/zoomable 3D F-16A Block 20 MLU with UV-mapped 4K skin texture
- Solid, soft, rough, spray, mountain, and eraser brushes
- Arctic, Alpine, Digital, Naval and Desert camouflage presets
- Custom image decals (PNG/JPEG), built-in stamps and **live hover decal preview**
- Decal size, rotation, opacity; click to place or press Escape to cancel
- Undo/redo, paint layers, import base texture, project save/open
- War Thunder user-skin ZIP export with 4096×4096 TGA and compatible `.blk`

## Controls

- **Right mouse drag** — orbit camera
- **Mouse wheel** — zoom
- **Left drag** — draw with selected brush / erase
- **Left click** — place selected decal (after preview)
- **Escape** — cancel decal placement / switch to orbit
- **Ctrl+Z** — undo

## Source structure

- `index.html`: UI and offline script loader
- `app.js`: WebGL2 renderer, UV-based painting, editor logic, TGA/ZIP export
- `assets/model-init.js`, `model-part-*.js`, `model-final.js`: aircraft mesh data
- `assets/texture-init.js`, `texture-part-*.js`, `texture-final.js`: original 4K base color texture
- `assets/inspiration.webp`: Alpine livery concept reference image

**Why multiple data scripts?** Large local asset files were split into small JavaScript pieces for reliable uploading. They are reassembled in the browser before `app.js` starts. Do not delete or reorder any `*-part-*.js` files.

## Compatibility and limitations

Desktop Chrome or Edge with WebGL2. Paint changes apply to the aircraft's main skin material; cockpit internals and weapons use other textures. Live 3D painting and War Thunder in-game import should be verified on your own PC; this repository was validated for source completeness, data decoding, and export file structure, not an automated live in-game test.

## Attribution

Independent fan-made editor, not affiliated with Gaijin Entertainment or War Thunder. Game-derived model and texture data and the user-provided livery concept are included for this project; their respective rights remain with the original rights holders. Check applicable permissions before republishing any included third-party assets.
