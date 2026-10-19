# Panel translucency and background blur

> Status: accepted on 2026-10-19. Describes the current approach to the translucency of the translation panel and the toolbar, the load measurement, and the practices it relies on.

## Decision

- The background of the panel and the toolbar is `rgb(255 255 255 / α)`, where α = `panelOpacity / 100`. The setting ranges from 25 to 100 percent, 75 by default.
- While the opacity is below 100 percent, `backdrop-filter: blur(16px) saturate(1.6)` works under the panel and the toolbar. At 100 percent the filter is removed entirely (`data-translucent="false"`).
- Only the background shows through. Text, borders and shadows stay opaque.
- The panel appears over 170 ms, and only `opacity` and `transform` are animated. The blur radius is not animated. `prefers-reduced-motion` turns the animation off.
- A hidden panel gets `display: none`, so it has no layer to blur.

## Why

- The visual reference is Apple's translucent materials: a blurred surface shows the context of the page and still does not get in the way of reading. At 75 percent the translation reads well on busy pages, which was checked by hand.
- The decision about the load stays with the user. On a weak machine, moving the slider to 100 percent turns the blur off completely.

## How Chromium computes the blur

- An element with `backdrop-filter` gets its own render surface.
- The blur is recomputed only in frames where something under the element changes: on scroll, video or an animation in the background. The blur needs neighboring pixels, so any change under the panel extends the damage area to the panel's full size. On a still page the blur costs nothing.
- Before blurring, Chromium downscales the picture under the element. So the cost depends first of all on the area, not on the radius.
- The main risk is machines without hardware acceleration: virtual machines, remote desktop, a blocklisted driver. There the CPU computes the blur.

## Measurement

Date: 2026-10-19, Chrome 155.

**Method.** A separate Chrome profile in headless mode. A 1280×900 page with text, gradients and tiles. On top of it, fixed 344×220 panels with the same CSS as in `src/content.css`. Each run lasts 3 seconds: a 9 px scroll in every `requestAnimationFrame`, recording the intervals between frames. Two modes:

- **GPU:** a discrete graphics card on the level of an NVIDIA RTX 5070 Ti, a 144 Hz monitor;
- **no GPU:** `--disable-gpu --disable-gpu-compositing`, compositing on a 16-thread CPU, a 60 Hz frame.

One panel covers about 6 percent of the screen, and 16 panels cover the whole screen.

| How much blur is on screen | GPU | No GPU |
|---|---|---|
| No blur, any number of panels | 144 fps | 60 fps |
| 75 % opacity, no blur, 16 panels | 144 fps | 60 fps |
| 1 panel, our CSS | 144 fps | 60 fps |
| 4 panels | 144 fps | 59 fps, one dropped frame |
| 16 panels, the whole screen | 144 fps | 21 fps |
| 16 panels, `blur(16px)` without `saturate` | 144 fps | 22 fps |
| 16 panels, `blur(8px) saturate(1.6)` | 144 fps | 23 fps |
| 48 overlapping panels, about three screens | 103 fps | 9 fps |

**Conclusions:**

- On a GPU one panel costs nothing. Frames start to drop at a blur area about 50 times larger than our panel.
- Without a GPU one panel also fits in a frame. Blurring the whole screen is what slows down, and the extension never does that.
- A radius of 8 and 16 px costs the same, and `saturate(1.6)` adds no load. There is no point in reducing the radius for performance.

**Limitations:**

- The measurement was done on one machine with a strong CPU. On a weak laptop without a GPU the margin is smaller.
- `requestAnimationFrame` intervals show whether the browser keeps up with frames, but not the exact GPU time.

## Practices

### Applied

1. **Blur a small area.** Only the panel and the toolbar are blurred, not the background of the whole page. The cost grows with the area.
2. **Do not animate the blur.** The radius is constant, and the panel's appearance animates `opacity` and `transform`.
3. **Do not keep a layer while the panel is not visible.** A hidden panel gets `display: none`, and `will-change` is not used.
4. **Do not save on the radius.** The measurement showed no difference between 8 and 16 px, so the radius that looks better stays.
5. **Give the user a switch.** 100 percent opacity removes the filter entirely.

### Considered and postponed

- **`prefers-reduced-transparency: reduce`.** Chrome supports it since version 118. The query matches when "Transparency effects" is off in Windows or "Reduce transparency" is on in macOS. Apple's system materials replace the blur with a solid background under this setting, because the blur makes reading harder for people with low vision. Now translucency is controlled by the slider in the settings. If the system setting needs to be respected, one rule in `src/content.css` is enough: under this query the background becomes opaque and `backdrop-filter` is removed.
- **The loading skeleton.** The `stx-shimmer` animation moves `background-position`, so every frame needs a repaint, and under the blur also a filter recomputation. Loading is usually shorter than a second, so the animation was not moved to `transform`.

## Sources

- [Chromium Render Surfaces](https://canary.grida.co/docs/wg/research/chromium/render-surfaces) and [Chromium effect optimizations](https://grida.co/docs/wg/research/chromium/effect-optimizations): an analysis of the Chromium compositor sources (`cc/`): a separate surface for `backdrop-filter`, the extended damage area under a blur, the downscaled filter input. This is a secondary analysis, and the details were checked against our own measurement.
- [W3C FXTF: backdrop-filter and composited scrolling](https://lists.w3.org/Archives/Public/public-fxtf-archive/2018Nov/0098.html): a discussion of the specification: scrolling should not slow down noticeably because of `backdrop-filter`.
- [Mozilla Bug 1732817](https://bug635044.bugzilla.mozilla.org/show_bug.cgi?id=1732817): fixed blurred panels over scrolling content slow down scrolling on Android. Turning the filter off removes the problem, and Chrome handles the same page noticeably better.
- [Red Hat Bug 2395768](https://bugzilla.redhat.com/show_bug.cgi?id=2395768): `backdrop-filter: blur` is slow without hardware acceleration.
- [Chrome Developers: CSS prefers-reduced-transparency](https://developer.chrome.com/blog/css-prefers-reduced-transparency): the media query, supported since Chrome 118, and its relation to the system settings of Windows, macOS and iOS.
- [WWDC 2018, Session 230](https://developer.apple.com/videos/play/wwdc2018/230) and [SwiftUI: accessible appearance](https://developer.apple.com/documentation/swiftui/accessible-appearance.md): how Apple's system materials behave with Reduce Transparency on, and why.
