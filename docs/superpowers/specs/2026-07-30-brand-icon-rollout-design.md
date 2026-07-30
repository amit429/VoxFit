# Brand icon rollout

## Problem

VoxFit has a new brand mark (mic + heartbeat pulse, lavender-on-black) supplied as a 512×512 raster PNG. It needs to become the web favicon, the Android/Play Store app icon, and the app's in-product "logo" wherever a mic glyph currently stands in for the brand.

## Source asset

`src/assets/icon/icon-512.png` — 512×512, alpha channel present, black background baked into the image. Good as-is for anywhere the image is composited whole. Not usable for the two record buttons, which need a monochrome glyph recolorable via CSS (`currentColor`) inside a solid lavender circle — a flattened black-background PNG would show as a mismatched square/black patch there.

To cover that case, a hand-traced SVG recreation of the mic+pulse glyph (`fill="currentColor"`, transparent background) is added as a second, vector form of the same mark, registered into the existing `vox-icon` / ionicons `addIcons()` pattern so it behaves like any other icon (tone- and size-aware).

## Changes

1. **Web favicon** — replace `src/assets/icon/favicon.png` with the new mark; add `apple-touch-icon` and additional favicon sizes to `src/index.html`.
2. **Android / Play Store app icon** — add `@capacitor/assets` as a dev dependency, place the source icon under `resources/`, run generation to regenerate `mipmap-*` and adaptive icon layers, then `npx cap sync android`.
3. **Welcome screen badge** (`src/app/pages/auth/welcome/welcome.page.html`) — swap the generic `mic-outline` ionicon for the new SVG glyph inside the existing badge box. No layout change.
4. **Record buttons** (`voice-log`, `diet-voice-log` pages) — swap `vox-icon name="mic"` for the new SVG glyph. Same lavender circle, white glyph via `currentColor`, `mic-pulse` animation untouched.
5. **Home header** (`src/app/pages/home/home.page.html`) — add a small icon badge (lavender glyph, `surface-2`/`hairline` box, similar treatment to the welcome badge but compact) to the left of the greeting text, as a persistent brand mark.

## Out of scope

- No PWA `manifest.webmanifest` exists in the repo today and none is being added — favicon only, per the current app shell.
- No changes to the tab bar itself (four functional tabs, no room for a non-functional 5th brand icon — home header covers this instead, per user's approval of that alternative).
- No re-theming of surrounding UI; this is an asset swap plus the icon-system registration needed to make it reusable.

## Testing

- `npm run build:dev` succeeds.
- Visual check in dev server: welcome screen badge, both record buttons, home header, browser tab favicon.
- Android icon regeneration verified by inspecting generated `mipmap-*` files (no device build required for this change).
