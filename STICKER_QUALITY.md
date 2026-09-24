# ZETA sticker quality

- New master sticker artwork is stored in `assets/stickers-hq/` at 1280x1280 RGBA PNG.
- Discord static sticker uploads are prepared from those masters at 320x320 RGBA PNG, using high-quality Lanczos downsampling and lossless PNG compression.
- The bot does not JPEG-compress, palette-convert, or repeatedly recompress the artwork during startup sync.
- Existing same-name Discord stickers are never deleted, replaced, or recreated.
