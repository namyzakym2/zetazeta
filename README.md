# 😈 ZETA

A full-featured Discord bot: DC (ZetaBot Coins) economy, activity/XP tracking, moderation,
AutoMod, tickets (with a full setup wizard + live preview), welcome/leave, suggestions,
per-guild command shortcuts (English + Arabic), a user dashboard, and an admin dashboard —
built on Node.js, Discord.js v14, MySQL (mysql2) compatibility layer, and Express.

## 1. Requirements

- Node.js 18+
- A MySQL database (for example Bot-Hosting MySQL)
- A Discord Application + Bot (https://discord.com/developers/applications)

## 2. Install

```bash
npm install
```

## 3. Configure `.env`

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Where to get it |
|---|---|
| `DISCORD_TOKEN` | Discord Developer Portal → your app → Bot → Reset Token |
| `CLIENT_ID` | Discord Developer Portal → your app → General Information → Application ID |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | MySQL connection settings |
| `DISCORD_CLIENT_SECRET` / `CLIENT_SECRET` | Developer Portal → General Information → Client Secret |
| `DASHBOARD_URL` | The public URL of your dashboard, e.g. `http://localhost:3000` in dev |
| `SESSION_SECRET` | Any long random string |
| `VOTE_API_KEY` / `VOTE_WEBHOOK_SECRET` | From Voite.gg once your bot is listed there (see §9) |

Never commit your real `.env` — only `.env.example` (with blank secrets) is tracked.

**Required bot permissions/intents (enable in the Developer Portal → Bot):**
- `SERVER MEMBERS INTENT`
- `MESSAGE CONTENT INTENT`

**Required OAuth2 redirect** (Developer Portal → OAuth2 → Redirects):
`{DASHBOARD_URL}/auth/discord/callback` e.g. `http://localhost:3000/auth/discord/callback`

## 4. Run

```bash
npm install
npm run deploy   # registers all slash commands with Discord
npm start        # starts the bot
```

In a second terminal, run the dashboard:

```bash
npm run dashboard
```

## 5. Connect MongoDB

Just set `MONGODB_URI` in `.env`. Both `src/bot.js` and `dashboard/server.js` connect to
it independently via Mongoose using the same connection string, so the bot and dashboard
always read/write the same data.

## 5.5 Enable image uploads (Cloudinary)

Any image field in the dashboard (ticket panel image, embed builder image/thumbnail/
author icon, component-panel image) can now be filled by uploading a picture straight
from your phone or computer instead of pasting a URL — a "📤 رفع صورة من جهازك" button
appears under each of those fields.

1. Create a free account at https://cloudinary.com.
2. From your Cloudinary Dashboard home page, copy **Cloud name**, **API Key**, and
   **API Secret** into `.env`:
   ```
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
3. Restart the dashboard. If these are left empty, the upload button still shows but
   returns a clear "not configured" error instead of crashing — pasting a URL manually
   still works either way.

Uploads go through `POST /api/upload` (login required), are capped at 8MB, accept
PNG/JPG/WEBP/GIF, and are auto-resized/compressed on Cloudinary's side so a full-size
phone photo doesn't get stored or served at full resolution.

## 6. Add Discord OAuth2 (Dashboard login)

1. In the Developer Portal, go to OAuth2 → General and copy your **Client Secret** into
   `DISCORD_CLIENT_SECRET`.
2. Add the redirect URL described above.
3. Visit `{DASHBOARD_URL}/auth/discord` to log in. The dashboard uses the `identify` and
   `guilds` OAuth2 scopes to know which servers you can administer (Owner, Administrator,
   or Manage Guild).

## 7. Deploy slash commands

```bash
npm run deploy
```

This registers commands **globally** (can take up to 1 hour to appear everywhere). For
instant updates while developing, edit `src/deploy-commands.js` and swap
`Routes.applicationCommands(...)` for `Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)`.

## 8. Using `/setup-ticket`

- `/setup-ticket` opens a Discord **Modal** to set the panel's title, description, color,
  footer, and image (Discord modals cap out at 5 fields).
- For **multiple buttons** (each with its own category + support role), open the Admin
  Dashboard → your server → **Tickets** tab. You'll see a live preview that updates as you
  edit the panel and add/remove buttons (max 5, matching Discord's per-row limit).
- Once configured, run `/ticket-panel` in the channel where you want the panel posted.

## 9. Configuring Log Channels

Two ways:
- Quick: `/system logs channel:#your-logs` sets one channel for everything.
- Full control: Admin Dashboard → **Logs** tab lets you set a **separate channel per log
  type** (Member, Moderation, Economy, Ticket, Message, AutoMod, System, Vote) and toggle
  each type ON/OFF independently.

## 10. Adding a shortcut (e.g. `c` → `/credit`)

Admin Dashboard → **Shortcuts** tab → "+ Add Shortcut":
- Command: `credit`
- Shortcut: `c` (or an Arabic word like `رصيدي`)

By default there's **no prefix required** — typing `c` (no `!`) runs `/credit`. Use
`/system prefix prefix:!` if you'd rather require a prefix character, or
`/system prefix prefix:none` to go back to no-prefix mode.

Shortcuts are per-server — adding one on Server A never affects Server B. Duplicate and
reserved shortcuts (`help`, `ping`, `setup-ticket`, `system`) are rejected automatically.

## 11. Connecting Voite.gg later

The vote system is fully isolated in `src/services/voteService.js` so you can swap
providers without touching commands or the economy code:

1. List ZETA on Voite.gg and get your bot's vote webhook credentials.
2. Set `VOTE_API_KEY` / `VOTE_WEBHOOK_SECRET` in `.env`.
3. Point Voite.gg's webhook at: `{DASHBOARD_URL}/webhooks/vote`
4. `dashboard/routes/webhooks.js` receives the vote, checks the secret, and calls
   `voteService.handleIncomingVote(...)`, which dedupes on `voteId` (unique in MongoDB)
   and only then credits DC. **`/vote` itself never grants DC** — it only shows the link.
5. If Voite.gg's payload field names differ from the placeholder shape documented at the
   top of `webhooks.js`, just adjust the destructuring in that one file.

## 12. Adding servers / managing settings

Invite the bot with an OAuth2 URL generated from the Developer Portal (scopes: `bot`,
`applications.commands`; permissions: Administrator, or the specific permissions listed
in §3). Once added, any Owner/Admin/Manage-Guild member of that server just logs in at
`{DASHBOARD_URL}` — no need to know or type a server ID:

1. Login redirects to **`/dashboard/profile.html`** — your Discord profile, a live list
   of every server you can manage (only servers where the bot is actually installed show
   up), and your own DC/activity stats across all of them.
2. Click **"Manage"** on any server card to open its Admin Dashboard
   (`/dashboard/?guildId=...` — this is filled in automatically by the button, you never
   type it yourself).

If a server you own/administer doesn't show up on the picker, it means ZETA hasn't
been invited to it yet — invite it first, then refresh the page (the bot syncs its guild
list to the database on startup and whenever it joins/leaves a server).

---

## Project Structure

```
ZETA/
├── src/
│   ├── bot.js                  # Discord client entry point
│   ├── deploy-commands.js      # Registers slash commands
│   ├── commands/                economy | activity | moderation | system
│   ├── events/                  ready, guildCreate, guildDelete, messageCreate,
│   │                              interactionCreate, member add/remove
│   ├── systems/                 welcome, leave, automod, tickets, suggestions, reports,
│   │                              publicCaptchaTransfer, prefixHandler
│   ├── services/                 economyService, activityService, voteService, logService,
│   │                              shortcutService, ticketService, translationService,
│   │                              captchaService
│   ├── models/                  User (per-server activity/warnings), Wallet (GLOBAL DC
│   │                              balance), Guild, Warning, Ticket, Vote, Suggestion,
│   │                              Transaction, Report, BotGuild
│   └── utils/                   permissions, formatMoney, time
├── dashboard/
│   ├── server.js
│   ├── passportSetup.js
│   ├── middleware.js             ensureAuth, ensureGuildAdmin (checks bot presence too)
│   ├── routes/                  auth, user, admin, webhooks
│   └── public/                  profile.html (server picker), index.html (admin panel),
│                                  images/logo.png, css/, js/
├── scripts/
│   └── migrate-global-currency.js  # one-time: run before first boot if upgrading
│                                      from the old per-server balance schema
├── locales/                     ar.json, en.json
├── .env.example
└── package.json
```

## Bot going "offline" / commands not registering / dashboard crashing

### Dashboard specifically: silent hang with no error shown

`dashboard/server.js` used to set up the session store (`MongoStore.create(...)`) and
other config at the **top level of the file**, before validating any `.env` variables
and before `mongoose.connect()` ran. If `MONGODB_URI` or an OAuth variable (`CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DASHBOARD_URL`, `SESSION_SECRET`) was missing, that setup
could throw synchronously outside of any function. Our `uncaughtException` safety net
would log it, but the rest of the file — mounting routes, calling `app.listen()` —
would simply never run, since the throw happened outside any async chain the `.catch()`
could see. Net effect: the process stayed alive with no visible crash, while the
dashboard never actually started listening. That's exactly what "dashboard is broken,
no error" looks like from the outside.

Fixed by moving **everything that can fail** (env validation, MongoDB connection,
session store, passport setup, route mounting) inside a single `async start()` function
wrapped in `start().catch(err => { ...; process.exit(1); })`. Now:
- Missing `.env` variables print a clear list of exactly what's missing and exit
  cleanly, instead of failing silently.
- Any other startup failure (bad Mongo URI, etc.) is caught and logged with the real
  error, instead of hanging with the process alive but nothing listening.

If the dashboard still doesn't come up after this fix, the console output will now
tell you exactly why — paste it and it can be fixed precisely.

### Bot process

This was one root cause with three symptoms, now fixed:

1. **The real bug:** `src/events/interactionCreate.js` had `return someHandler(interaction)`
   in several places instead of `await someHandler(interaction); return;`. Returning a
   promise from inside a `try` block **without awaiting it** means its rejection never
   reaches the `catch` block — it becomes an *unhandled promise rejection* instead. On
   modern Node.js, an unhandled rejection **terminates the entire process** by default.
   So a single failed database write during one command (e.g. the duplicate-key error
   below) was silently killing the whole bot, which is why it looked "offline" and why
   commands stopped responding — the process wasn't running anymore, not because the
   commands failed to register.
2. **The database error that triggered it:** `E11000 duplicate key error ... index:
   userId_1` — a leftover single-field unique index on `User.userId` from an earlier
   schema version, conflicting with the current compound `{guildId, userId}` unique
   index (a user legitimately has one document per server, so the old single-field
   index was wrong and had to go). `src/bot.js` and `dashboard/server.js` now call
   `Model.syncIndexes()` for every model on startup, which automatically drops stale
   indexes like this and creates any missing ones — no manual `mongosh` step needed
   anymore, on this or future deploys. `getOrCreateUser()` and `activityService`'s user
   creation were also switched to atomic `findOneAndUpdate(..., {upsert:true})` instead
   of find-then-create, closing the race condition that could trigger this error in the
   first place.
3. **Defense in depth:** both `src/bot.js` and `dashboard/server.js` now register
   `process.on('unhandledRejection', ...)` and `process.on('uncaughtException', ...)`
   handlers that log the error instead of crashing — so even an error in code we
   haven't found yet won't take the whole bot or dashboard down.

Slash commands are already registered **globally** (`Routes.applicationCommands(...)`
in `deploy-commands.js`, not per-guild) — if they still don't show up in Discord after
this fix, re-run `npm run deploy` and check its console output for errors; global
commands can also take up to an hour to propagate to every server after a fresh deploy.

## Dashboard fixes: profile page, server picker, and the logo

Three things were broken and are now fixed:

1. **"Profile doesn't show after login"** — `/user` used to return raw JSON with no
   visual page at all, so logging in just dumped JSON in your browser. There's now a
   real page at `/dashboard/profile.html` (see §12) with your avatar, username, server
   list, and DC/activity stats rendered properly.
2. **"No servers show up when picking one"** — there was no server picker UI at all;
   you had to know and manually type a server ID in the URL. The bot now keeps a
   `BotGuild` collection in MongoDB in sync with the servers it's actually in (on
   startup, and on every join/leave), and the dashboard cross-references that against
   your Discord OAuth2 guild list to build a real, clickable server list.
3. **The logo** — your uploaded logo is now used as the dashboard's favicon and header
   icon (`dashboard/public/images/logo.png`) on every page (login screen, profile page,
   admin panel). If you want it as the bot's actual Discord avatar too, upload the same
   file in the Developer Portal → your app → General Information → App Icon.

As a side fix, the admin API (`ensureGuildAdmin` in `dashboard/middleware.js`) now also
double-checks the bot is actually in a server before allowing any dashboard action on
it — previously it only checked your Discord permissions, so manually editing the
`guildId` in the URL to a server without the bot would silently create empty database
records for it.

## Full Command List (29 slash commands)

**Economy:** `/credit`, `/credit user:@x amount:y` (transfer), `/daily`, `/vote`

**Activity:** `/speak`, `/leaderboard`

**Moderation:** `/ban`, `/unban`, `/softban`, `/massban`, `/kick`, `/timeout`, `/mute`,
`/unmute`, `/warn`, `/unwarn`, `/warnings`, `/clear`, `/lock`, `/unlock`, `/lockdown`,
`/unlockdown`, `/nickname`, `/role add|remove`, `/slowmode`, `/voice kick|mute|unmute`

**System / Admin:** `/system` (welcome, leave, autorole, logs, suggestions, reports,
automod, locale, prefix), `/ticket-panel`, `/setup-ticket`, `/announce`, `/report`

Every moderation command checks a **real Discord permission** before running (never
hidden-command-only) and every action that changes state is written to the Logs system.

### Newer additions

- **`/mute` / `/unmute`** — a dedicated "Muted" role (auto-created once per server,
  channel overwrites applied automatically) that's fully separate from Discord's native
  timeout, useful for indefinite mutes.
- **`/unban`, `/softban`, `/massban`** — `/softban` bans+immediately unbans to purge a
  spammer's recent messages without a lasting ban; `/massban` bans a batch of user IDs
  (gated behind Administrator, capped at 50 per run).
- **`/nickname`, `/role add|remove`** — quick member management; `/role` refuses to
  touch any role positioned above the bot's own top role.
- **`/slowmode`** — sets a channel's rate limit (0–21600 seconds).
- **`/voice kick|mute|unmute`** — disconnect or server-mute a member currently in a
  voice channel.
- **`/warnings`** — view a member's full warning history (active + removed) in one
  embed; `/unwarn` removes the most recent active warning.
- **`/lockdown` / `/unlockdown`** — emergency, server-wide lock of every text channel
  in one command (Administrator only), with `/unlockdown` restoring exactly the
  channels it locked.
- **`/report`** — lets any member submit a report about another member straight to an
  admin-configured reports channel. Admins get **Mark Reviewed / Dismiss** buttons on
  the report embed, and the whole queue (pending + resolved) is also visible and
  actionable from the Admin Dashboard's new **Reports** tab. Enable it with
  `/system reports channel:#reports` or from the dashboard.
- **Public, chat-based CAPTCHA transfers with a transfer tax** — `/credit
  user:@someone amount:10000` (or the `c @someone 10000` shortcut) doesn't move DC
  instantly. It posts a distorted, scrambled-number image **publicly in the channel**
  (rendered server-side with `@napi-rs/canvas`, never touching a third-party API) —
  everyone can see it, but only the sender's next message in that channel is checked
  as the code attempt. **No button, no modal** — you just type the 6-character code as
  a normal chat message within 2 minutes (max 3 attempts) to confirm.
  A per-server **transfer tax** (`Guild.transferTaxPercent`, default **2.5%**,
  editable from the Admin Dashboard's Economy tab) is deducted from what the recipient
  receives — the sender still pays the full amount they typed. On success:
  - Everyone in the channel sees a public receipt:
    ```
    ✅ مبروك! 💰 | @Sender, has transferred `9750 DC` 😈to @Recipient
    ```
    (that's 10,000 DC sent minus the 2.5% tax = 9,750 DC actually received)
  - the **recipient also gets a DM** formatted as a bank-style receipt:
    ```
    🏧 | Transfer Receipt
    You have received 9,750 DC from SenderName#0001 (ID: 123456789012345678)
    Reason: No reason provided
    Tax: 2.5% (250 DC) was deducted from this transfer.
    New Global Balance: 14,750 DC
    ```
  Because confirmation is a plain chat message (not a Modal), the `c` prefix shortcut
  now supports transfers too — `c @user 10000` works exactly like the slash command.
- **Anti-fraud: minimum account age for transfers** — Discord accounts younger than
  **30 days** (checked against the account's real Discord creation timestamp, not
  anything the user can fake) cannot send transfers at all — `/credit` and `c` will
  refuse with a clear message. This only blocks *sending*; a brand-new account can
  still receive DC and check its own balance.
- **`/credit` balance display** matches a bank-bot style, e.g.:
  ```
  🏦 | @You, your account balance is `$12500` DC 😈.
  ```
  `/credit user:@someone` with **no amount** shows *that person's* global balance
  instead of your own — useful for checking someone else's DC without transferring
  anything. Give both `user` and `amount` to trigger a transfer instead. The `c`
  shortcut mirrors this exactly: `c @user` shows their balance, `c` shows yours, `c
  @user 100` transfers.

### Shortcuts now work with NO prefix by default

`Guild.prefix` now defaults to an **empty string**, so shortcuts trigger by typing the
word directly — no `!` needed. Example: typing `c` runs `/credit`, typing `رصيدي` does
the same in Arabic. This is per-server and fully configurable:
- `/system prefix prefix:!` sets it back to a `!`-style prefix (or any string you want).
- `/system prefix prefix:none` clears it again (back to no-prefix mode).

Because there's no prefix to gate on, every message is checked against the shortcut
list — this is a cheap in-memory/DB lookup and only *acts* on messages whose first word
exactly matches a configured shortcut, so normal chat is unaffected.

### CAPTCHA image dependency

Transfers use [`@napi-rs/canvas`](https://www.npmjs.com/package/@napi-rs/canvas) to draw
the confirmation image. It ships prebuilt binaries for common platforms (no native Cairo
build required), so `npm install` is normally all you need. If your hosting platform has
no matching prebuild, check that package's README for a source-build fallback.

## Economy rules (enforced in code, not just docs)

- The **only** currency is DC (ZetaBot Coins).
- **DC is GLOBAL** — one balance per Discord user (`src/models/Wallet.js`, keyed by
  `userId` only, no `guildId`), shared across every server ZETA is in. If you check
  `/credit` in Server A, then check it again in Server B, you see the exact same number.
  This is a deliberate split from the **Activity system** (`src/models/User.js`, keyed
  by `guildId + userId`), which stays per-server on purpose — your level/XP/messages in
  one server have nothing to do with another, only DC is shared.
- Each server can still tune its own **rates** (Daily Base Reward, Streak Bonus, Vote
  Reward, Transfer Tax %) from `Guild` settings / the Admin Dashboard — those numbers
  just all pay into or out of the same global balance no matter which server you
  claimed/transferred in.
- DC sources: `/daily`, `/vote` (real, confirmed votes only). Movement: `/credit user:@x amount:y`.
  Corrections: Admin Dashboard (logged as `admin` transactions, and yes — an admin of
  ANY server the bot is in can adjust anyone's global balance; this is intentionally
  powerful since the economy itself is shared).
- No `/bank`, `/pay`, `/shop`, `/inventory`, `/coinflip`, `/dice`, `/slots`, `/work`.
- Activity (XP/Level/Messages via `/speak`) **never** grants DC — it's a fully separate
  system, now literally living in a different MongoDB collection than the economy too.
- All balance changes are atomic MongoDB operations (`findOneAndUpdate` with `$inc` and,
  for debits, a `balance: {$gte: amount}` filter so a balance can never go negative even
  under concurrent requests) and are recorded in the `Transaction` collection.

### ⚠️ If you already have live balance data: run the migration once

If your bot was already running with real DC balances stored **per-server** under the
old schema, switching to this code as-is would make everyone's balance show as `0` —
the old numbers aren't deleted, just no longer read from the new global Wallet
collection. Before starting the bot with this update, run this **once**:

```bash
npm run migrate-currency
```

This reads everyone's old per-server balances directly from the database, sums them
per person (e.g. 50,000 DC in Server A + 10,000 DC in Server B → 60,000 DC globally),
and writes one `Wallet` document per user. It's read-only on the old data (nothing is
deleted) and safe to run before first boot. See `scripts/migrate-global-currency.js`
for exactly what it does — **do not run it more than once**, or balances will be
double-counted.

If this is a fresh install with no prior balance data, you can skip this step entirely
(the script will just tell you there's nothing to migrate).

## ZETA branded emojis & stickers

Set `ZETA_SUPPORT_GUILD_ID` (or `SUPPORT_GUILD_ID`) to the official support server ID. On startup ZETA creates its application emojis and mirrors the pack into that support guild. The bot needs **Manage Expressions** in the support server for the guild emoji/sticker mirror. Application emojis are managed on the application itself through `client.application.emojis`; guild emojis and stickers are separate guild assets.

## ZETA asset publishing
`src/bot.js` is the single startup entry point. It starts the bot and embedded dashboard, then synchronizes the Application Emoji pack and the branded Support Server emoji/sticker pack.

For the support server, the bot must actually be a member and have **Create Expressions** + **Manage Expressions**. Discord also limits server expression slots; ZETA now detects the current capacity and reports exactly how many assets were created/skipped instead of failing silently.


## Dashboard OAuth2

Set `CLIENT_ID`, `CLIENT_SECRET`, `DASHBOARD_URL`, and optionally `DISCORD_CALLBACK_URL`. Register the exact callback URL in Discord Developer Portal: `<DASHBOARD_URL>/auth/discord/callback`. `src/bot.js` starts the bot and dashboard together.


## ZETA final feature patch
- `/greet room:#welcome message:"..." seconds:10` supports `{server}`, `{user}`, `{invited}`.
- Greeting deletion delay is measured after the greeting is sent.
- Giveaway entry uses the ZETA `party` custom emoji reaction; the original giveaway message is never edited. Results are sent as a new message.
- Giveaway prize defaults to `2 ريال` when omitted.
- Ticket action/default emojis resolve to ZETA custom emojis.
- `ecosystem.config.json` provides safe persistent restart settings for PM2 (`pm2 start ecosystem.config.json`).

## MongoDB full reset

This build includes a dedicated database reset command. It is **not** run automatically when the bot starts.

1. Put the target MongoDB connection string in `.env` as `MONGODB_URI`.
2. Run:

```bash
npm run db:clear -- --confirm
```

This permanently drops the **entire MongoDB database** selected by `MONGODB_URI`, including all ZETA collections and dashboard/session data stored there. It does not delete Discord emojis, stickers, or files on the host.


## Secret ZetaBot Panel (الواحة السرية)

The hidden panel is protected by Discord identity/role checks. Set these values in `.env`:

```env
OWNER_ID=1071164421222695042
DEVIL_PANEL_GUILD_ID=YOUR_SECRET_SERVER_ID
DEVIL_PANEL_ROLE_ID=YOUR_SECRET_ROLE_ID
BOT_SECRET_CODE=YOUR_PRIVATE_CODE
```

The configured `OWNER_ID` can enter the hidden panel directly. Other users must have the configured `DEVIL_PANEL_ROLE_ID` role in `DEVIL_PANEL_GUILD_ID`.

To open the hidden panel from the dashboard, log in with Discord and click the dashboard profile/avatar **5 times quickly**. The hidden panel opens in a new tab.

For the server setup:
1. Create a private server/category for the panel.
2. Create a role such as `𝗩𝗘𝗥𝗗𝗢 𝗢𝗪𝗡𝗘𝗥` or `𝗩𝗘𝗥𝗗𝗢 𝗦𝗘𝗖𝗥𝗘𝗧`.
3. Give that role access to the private category/channels.
4. Copy the server ID into `DEVIL_PANEL_GUILD_ID` and the role ID into `DEVIL_PANEL_ROLE_ID` (Discord Developer Mode must be enabled to copy IDs).
5. Give the bot access to that server and the required channels.

Do not share `BOT_SECRET_CODE`.


## مركز الأوامر في لوحة التحكم

صفحة **مركز الأوامر** تعرض أوامر ZETA الفعلية من ملفات `src/commands`، مع بحث سريع وتصنيف حسب النظام، ونافذة إعداد لكل أمر. من داخلها يمكن إدارة اختصارات `!` العربية والإنجليزية، وتحديد رولات مسموح لها أو ممنوعة من استخدام أمر محدد.

رابط الداشبورد العام في Bot-Hosting:
`https://zeta.apps.bot-hosting.cloud/dashboard/`


## Command Center v2

مركز الأوامر الجديد يستخدم واجهة قابلة للطي: القوائم والتفاصيل لا تظهر كلها في الأعلى، بل تظهر عند الضغط على «خيارات» أو عند فتح الأمر.

- البحث السريع عن الأوامر.
- فلترة التصنيف والحالة من قائمة «خيارات».
- محرر الأمر بقطاعات قابلة للفتح والإغلاق.
- الاختصارات العربية والإنجليزية من داخل الأمر عبر Enter.
- شرح مختصر لطريقة الاختصارات داخل قائمة الخيارات.
- تصميم متجاوب للجوال.

## Command Center v3
- Compact command cards inspired by the mobile reference: command name, description, enable/disable switch, and edit button.
- Command details are collapsed into a drawer and sections only open when clicked.
- Arabic/English UI toggle for the Command Center.
- Per-server command enable/disable state is persisted in MongoDB and enforced at runtime.
- Shortcut manager supports enabling/disabling custom shortcuts and keeps built-in Arabic/English shortcuts available even after custom shortcuts are added.


### مركز الأوامر v4
تم فصل الأوامر داخل مركز الأوامر إلى تصنيفات مستقلة، منها: الإدارة، المساعدة، العامة، الإشراف، التذاكر، السحوبات، الاقتصاد، النشاط، البلاغات، التقديمات، الأتمتة والأدوات. زر خيارات يفتح الفلاتر والتقسيمات عند الحاجة فقط.

## OAuth / Discord connection fixes
- Discord OAuth callback is normalized to the public origin and `/auth/discord/callback`, avoiding accidental `/dashboard//auth/...` callbacks when `DASHBOARD_URL` ends with `/dashboard/`.
- `DISCORD_CALLBACK_URL` remains supported as the exact override and should match the Redirect URI registered in the Discord Developer Portal.
- OAuth state protection and stale authorization-code handling were added so replayed/expired Discord codes start a fresh login instead of producing a confusing `TokenError: Invalid "code" in request` page.
- Discord REST timeout/retry was increased to 30s/3 retries to better tolerate temporary slow connections from hosting proxies.
