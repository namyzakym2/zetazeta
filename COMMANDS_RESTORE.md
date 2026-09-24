# ZETA command registry safety

This build fixes the command disappearance seen after the previous deployment changes.

- Slash-command option JSON is normalized so required options are placed before optional options, as required by Discord.
- Automatic deployment is fail-closed: if any command file cannot load/validate, the existing Discord command registry is left untouched instead of being replaced with a partial list.
- The emoji payload transformer now avoids recursive traversal of Discord.js class instances and circular objects.
- `/giveaway start` includes `duration`, `winners`, `prize`, `role`, and `channel`; `/giveaway end` and `/giveaway reroll` remain available.
- Giveaway entry remains reaction-based with the `party` custom emoji; the original giveaway message is never edited.
