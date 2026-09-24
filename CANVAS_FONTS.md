# ZETA Canvas fonts

The bot now bundles local fonts for server-side `@napi-rs/canvas` rendering:

- `NotoSans-Regular/Bold.ttf` — Latin/English and broad Unicode coverage
- `NotoSansArabic-Regular/Bold.ttf` — Arabic script
- `NotoSansCJK-Regular/Bold.ttc` — Chinese/Japanese/Korean glyph coverage

`src/utils/canvasFonts.js` registers the fonts through `GlobalFonts.registerFromPath()` and
selects a family based on the text script. The server-side welcome card, profile card,
leaderboard, and captcha renderer use it automatically.

This is designed to prevent missing-glyph boxes for Arabic, English and CJK text. No
network font download is required at runtime.

Note: "all languages" cannot be guaranteed by three font families alone; languages that
need specialized scripts may require an additional Noto Sans script font. Latin, Arabic,
and CJK are covered explicitly here, with the Latin Noto Sans family serving as the
general fallback.
