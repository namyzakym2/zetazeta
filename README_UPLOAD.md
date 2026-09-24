# ZETA asset + giveaway + server profile patch

## Giveaway
- Default prize: **2 ريال**.
- Entry reaction resolves the custom `party` emoji from the current server first, then the bot application's custom emojis.
- The original giveaway embed is sent once and is never edited.
- When the giveaway ends, the winner/result is sent as a new message.

## Server bot profile
Use `/botprofile` in the target server:
- `name` changes the bot's **server nickname only**.
- `avatar` changes the bot's **server profile avatar only**.
- It does not change the bot's global Discord username/avatar.
- Requires `Manage Server` permission by default.

The asset uploader remains non-destructive: existing same-name emojis/stickers are reused; missing assets are uploaded from the bundled PNG files.


Final patch included: greet command, static reaction giveaway, ZETA ticket emojis, and PM2 persistent restart config.
