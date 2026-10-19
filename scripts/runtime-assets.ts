/**
 * Files from `assets/` that the extension loads at runtime. Only these are
 * copied to `dist/`. The rest of `assets/` is source material: `icon-16.svg`
 * is rendered into `icon-16.png`, and `icon-1024.png` is the Chrome Web Store
 * listing icon. `tests/build.test.ts` checks this list against the manifest
 * and the sources that reference `assets/`.
 */
export const RUNTIME_ASSETS = [
  "assets/icon.svg",
  "assets/icon-16.png",
  "assets/icon-32.png",
  "assets/icon-48.png",
  "assets/icon-128.png",
] as const;
