# ZETA Canvas fonts added

Added local fonts for the Canvas renderer:

- Noto Sans + Noto Sans Arabic (existing)
- Noto Sans CJK (existing)
- Noto Serif / Noto Serif CJK (new serif fallback)
- Roboto Slab Regular/Bold (new display/slab style, close to the screenshot's bold slab look)
- Noto Color Emoji (new emoji font asset)

`src/utils/canvasFonts.js` now registers the new fonts and exposes:
- `displayFontSpec()` for the slab/display style
- `emojiFontSpec()` for emoji-only text
- `containsEmoji()` for emoji detection

Note: a screenshot cannot guarantee the exact original font file. Roboto Slab is included as the closest bundled display-style match to the visible "KAIZEN war" look.
