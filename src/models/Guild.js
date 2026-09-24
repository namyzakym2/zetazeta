const { Schema, model } = require('../db/mysqlCompat');

const ShortcutSchema = new Schema(
  {
    command: { type: String, required: true },   // e.g. "credit"
    shortcut: { type: String, required: true },   // e.g. "c" or "رصيدي"
    enabled: { type: Boolean, default: true }
  },
  { _id: true }
);

const CommandPermissionSchema = new Schema(
  {
    command: { type: String, required: true },        // slash command name, e.g. "ban"
    roleId: { type: String, required: true },
    allowed: { type: Boolean, default: true }          // true = whitelisted, false = explicitly blocked
  },
  { _id: true }
);

const CommandStateSchema = new Schema(
  {
    command: { type: String, required: true },
    enabled: { type: Boolean, default: true }
  },
  { _id: false }
);

const TicketButtonSchema = new Schema(
  {
    label: String,
    emoji: String,
    style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
    categoryId: String,
    // legacy: رتبة دعم فني وحيدة — لا تزال تُقرأ كـ fallback إذا supportRoleIds فاضية.
    supportRoleId: String,
    // جديد: أكثر من رتبة دعم فني لنفس التصنيف — كلهم يشوفون التذكرة ويتم
    // منشنهم عند فتحها (بدل رتبة وحيدة فقط).
    supportRoleIds: { type: [String], default: [] },
    description: { type: String, default: '' }, // يظهر في وصف التذكرة عند فتحها من هذا التصنيف
    image: { type: String, default: '' }
  },
  { _id: true }
);

// زر جاهز يضاف تلقائيًا داخل كل تذكرة تُفتح من هذا البانل (بدل تشغيل
// /ticket-button-add يدويًا في كل مرة) — الضغط عليه "يوريك نص" الرد المحفوظ.
const TicketQuickButtonSchema = new Schema(
  {
    label: { type: String, required: true },
    emoji: { type: String, default: '' },
    style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Secondary' },
    response: { type: String, required: true }
  },
  { _id: true }
);

const TicketSettingsSchema = new Schema(
  {
    // اسم مخصص للبانل (يُستخدم فقط للتمييز بين البانلات المتعددة بالداشبورد،
    // البانل الرئيسي القديم اسمه فاضي دايمًا).
    name: { type: String, default: '' },
    enabled: { type: Boolean, default: false },
    panelChannelId: { type: String, default: '' },
    // فاضي افتراضيًا: يعني "استخدم اسم السيرفر نفسه" بدل نص ثابت متل "DEVIL SUPPORT".
    panelTitle: { type: String, default: '' },
    panelDescription: { type: String, default: 'هل تحتاج إلى مساعدة؟ اضغط الزر لفتح تذكرة.' },
    panelColor: { type: String, default: '#0f2158' },
    panelImage: { type: String, default: '' },
    panelThumbnail: { type: String, default: '' },
    // فاضي افتراضيًا: يعني "استخدم اسم السيرفر نفسه" بدل نص ثابت متل "ZETA SUPPORT".
    panelFooter: { type: String, default: '' },
    buttons: { type: [TicketButtonSchema], default: [] },
    // شكل أزرار "فتح تذكرة" في البانل: أزرار عادية (بحد أقصى 5) أو قائمة سلكت
    // منسدلة (بحد أقصى 25 تصنيف).
    openDisplayType: { type: String, enum: ['buttons', 'menu'], default: 'buttons' },
    // شكل أزرار الإجراءات داخل التذكرة نفسها (استلام/استدعاء/إضافة/...): أزرار
    // عادية أو قائمة سلكت واحدة تجمعها كلها.
    actionDisplayType: { type: String, enum: ['buttons', 'menu'], default: 'buttons' },
    quickButtons: { type: [TicketQuickButtonSchema], default: [] },
    maxTicketsPerUser: { type: Number, default: 1 },
    ticketNameFormat: { type: String, default: 'ticket-{username}' },
    closeButton: { type: Boolean, default: true },
    claimButton: { type: Boolean, default: true },
    transcriptButton: { type: Boolean, default: true },
    deleteButton: { type: Boolean, default: true },
    transcriptChannelId: { type: String, default: '' },
    // أرشيف HTML كامل للمحادثة يُرسل لصاحب التذكرة بالخاص (بالإضافة لروم
    // الأرشيف أعلاه) قبل حذف التذكرة — انظر ticketService.closeTicket.
    sendTranscriptToOwner: { type: Boolean, default: true },
    // تقييم الإدارة بعد إغلاق التذكرة (1-5 نجوم يرسلها صاحب التذكرة في الخاص).
    ratingEnabled: { type: Boolean, default: true },
    ratingChannelId: { type: String, default: '' },
    // يطلب من صاحب التذكرة كتابة ملاحظة نصية بعد اختيار عدد النجوم (مودال).
    ratingRequireComment: { type: Boolean, default: false },
    // تخصيص رسالة الترحيب والتحكم بالقفل التلقائي للتذاكر
    ticketWelcomeTemplate: { type: String, default: '' },
    autoCloseEnabled: { type: Boolean, default: false },
    autoCloseMinutes: { type: Number, default: 1440 }
  },
  { _id: true }
);

const LogEventSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    channelId: { type: String, default: '' },
    color: { type: String, default: '' }
  },
  { _id: false }
);

const LogSettingsSchema = new Schema(
  {
    memberChannelId: { type: String, default: '' },
    moderationChannelId: { type: String, default: '' },
    ticketChannelId: { type: String, default: '' },
    messageChannelId: { type: String, default: '' },
    automodChannelId: { type: String, default: '' },
    systemChannelId: { type: String, default: '' },

    // Granular per-action channels — each falls back to moderationChannelId
    // / moderationLogs when not set (see logService.resolveTarget).
    inviteChannelId: { type: String, default: '' },
    banChannelId: { type: String, default: '' },
    kickChannelId: { type: String, default: '' },
    timeoutChannelId: { type: String, default: '' },
    roleChannelId: { type: String, default: '' },
    channelChannelId: { type: String, default: '' },
    threadChannelId: { type: String, default: '' },
    nicknameChannelId: { type: String, default: '' },

    memberLogs: { type: Boolean, default: true },
    moderationLogs: { type: Boolean, default: true },
    ticketLogs: { type: Boolean, default: true },
    messageLogs: { type: Boolean, default: false },
    automodLogs: { type: Boolean, default: true },
    systemLogs: { type: Boolean, default: true },

    inviteLogs: { type: Boolean, default: true },
    banLogs: { type: Boolean, default: true },
    kickLogs: { type: Boolean, default: true },
    timeoutLogs: { type: Boolean, default: true },
    roleLogs: { type: Boolean, default: true },
    channelLogs: { type: Boolean, default: true },
    threadLogs: { type: Boolean, default: true },
    nicknameLogs: { type: Boolean, default: true },

    // Per-event overrides used by the dashboard. Empty means use the legacy
    // category routing/toggle above, so existing servers keep their settings.
    logEvents: { type: Map, of: LogEventSchema, default: () => ({}) }
  },
  { _id: false }
);

const AutomodSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    bannedWords: { type: [String], default: [] },
    spamProtection: { type: Boolean, default: true },
    floodProtection: { type: Boolean, default: true },
    mentionSpamLimit: { type: Number, default: 5 },
    linksProtection: { type: Boolean, default: false },
    duplicateMessageProtection: { type: Boolean, default: true }
  },
  { _id: false }
);

const AutoResponderSchema = new Schema(
  {
    trigger: { type: String, required: true },
    // 'contains'   -> trigger appears anywhere in the message
    // 'exact'      -> message content matches trigger exactly (after trim)
    // 'startsWith' -> message starts with trigger
    matchType: { type: String, enum: ['contains', 'exact', 'startsWith'], default: 'contains' },
    caseSensitive: { type: Boolean, default: false },
    // Multiple possible replies — src/systems/autoResponder.js picks one at random
    // each time the rule fires, so the bot doesn't sound repetitive. `response`
    // (singular) is kept for backward compatibility with rules saved before this
    // field existed; it's treated as a single-item responses list when present and
    // `responses` is empty. Supports {user} (mention), {username}, {server}
    // placeholders — replaced before sending.
    response: { type: String, default: '' },
    responses: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    // Whether the reply pings the user (Discord notification) or just shows
    // the quoted reply line silently. Defaults to true — a silent reply reads
    // as "the bot didn't actually respond to me".
    mentionUser: { type: Boolean, default: true },
    // Role/channel restrictions, Probot-style whitelist + blacklist:
    // - enabledRoleIds/enabledChannelIds non-empty => ONLY those roles/channels trigger the rule
    // - disabledRoleIds/disabledChannelIds => those roles/channels NEVER trigger it (checked after the whitelist)
    // All empty (the default) => no restriction, fires anywhere for anyone.
    enabledRoleIds: { type: [String], default: [] },
    disabledRoleIds: { type: [String], default: [] },
    enabledChannelIds: { type: [String], default: [] },
    disabledChannelIds: { type: [String], default: [] }
  },
  { _id: true }
);

const SellerRoomSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: '' },
    // Only members holding this role can post freely in the room. Everyone else's
    // messages get deleted + warned + logged. See src/systems/sellerRoom.js.
    sellerRoleId: { type: String, default: '' }
  },
  { _id: false }
);

const AutoRoleInviteRuleSchema = new Schema(
  {
    invite: { type: String, required: true },   // invite code (not full URL), e.g. "aBc123"
    roleId: { type: String, required: true }
  },
  { _id: true }
);

const AutoRoleRulesSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    // Multi-role lists — additive on top of the legacy single autoRoleId below.
    memberRoleIds: { type: [String], default: [] },
    botRoleIds: { type: [String], default: [] },
    inviteRoles: { type: [AutoRoleInviteRuleSchema], default: [] }
  },
  { _id: false }
);

const EmbedFieldSchema = new Schema(
  {
    name: { type: String, default: '' },
    value: { type: String, default: '' },
    inline: { type: Boolean, default: false }
  },
  { _id: false }
);

// Saved "Embed Builder" messages — dashboard's equivalent of next-generation's
// Embed Messages page. Purely a library of reusable embeds; sending one to a
// channel happens on-demand via POST /:guildId/embeds/:embedId/send and never
// deletes/edits any other message, sends nothing encrypted, and never touches
// a webhook — it just posts through the logged-in bot client like any other
// dashboard action (ticket panel, welcome message, etc).
const SavedEmbedSchema = new Schema(
  {
    name: { type: String, required: true },          // internal label shown in the dashboard list
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    color: { type: String, default: '#0f2158' },
    authorName: { type: String, default: '' },
    authorIcon: { type: String, default: '' },
    image: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    footer: { type: String, default: '' },
    timestamp: { type: Boolean, default: false },
    fields: { type: [EmbedFieldSchema], default: [] }
  },
  { _id: true, timestamps: true }
);

// Staff Points system (نقاط التذاكر) — points awarded to staff for claiming/closing
// tickets and (optionally) for running specific moderation commands, with anti-abuse
// guards and role rewards at point thresholds. Actual per-user scores/history live in
// their own collection (src/models/StaffScore.js), not here — this is config only.
const StaffPointsCommandSchema = new Schema(
  {
    name: { type: String, required: true },   // slash command name, e.g. "ban"
    points: { type: Number, default: 1 }
  },
  { _id: false }
);

const StaffPointsRewardSchema = new Schema(
  {
    points: { type: Number, required: true }, // threshold — reward triggers once total points >= this
    roleId: { type: String, default: '' },
    label: { type: String, default: '' }
  },
  { _id: true }
);

const StaffPointsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    logsChannelId: { type: String, default: '' },
    ticketPoints: {
      enabled: { type: Boolean, default: false },
      claim: { enabled: { type: Boolean, default: true }, points: { type: Number, default: 5 } },
      close: { enabled: { type: Boolean, default: true }, points: { type: Number, default: 3 } }
    },
    commandPoints: {
      enabled: { type: Boolean, default: false },
      commands: { type: [StaffPointsCommandSchema], default: [] }
    },
    antiAbuse: {
      enabled: { type: Boolean, default: true },
      noSelfClaim: { type: Boolean, default: true },
      noDuplicatePoints: { type: Boolean, default: true },
      cooldownMinutes: { type: Number, default: 60 }
    },
    rewards: {
      enabled: { type: Boolean, default: false },
      list: { type: [StaffPointsRewardSchema], default: [] }
    }
  },
  { _id: false }
);

// Component Panels (رسائل المكونات) — embed-style messages with interactive buttons
// and/or a select menu attached, each wired to a simple action (give/remove a role,
// or reply with a text message). Sending happens on-demand via
// POST /:guildId/components/:panelId/send (dashboard/routes/admin.js); clicks are
// routed by src/systems/componentPanels.js via customId `panel_btn_<panelId>_<compId>`
// / `panel_sel_<panelId>_<compId>`.
const ComponentActionSchema = new Schema(
  {
    type: { type: String, enum: ['giveRole', 'removeRole', 'toggleRole', 'sendMessage'], default: 'sendMessage' },
    roleId: { type: String, default: '' },     // for giveRole / removeRole / toggleRole
    message: { type: String, default: '' }      // for sendMessage — sent as an ephemeral reply
  },
  { _id: false }
);

const ComponentOptionSchema = new Schema(
  {
    label: { type: String, required: true },
    emoji: { type: String, default: '' },
    action: { type: ComponentActionSchema, default: () => ({}) }
  },
  { _id: true }
);

const MessageComponentSchema = new Schema(
  {
    kind: { type: String, enum: ['button', 'select'], default: 'button' },
    // Button-only fields:
    label: { type: String, default: '' },
    emoji: { type: String, default: '' },
    style: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
    action: { type: ComponentActionSchema, default: () => ({}) },
    // Select-menu-only fields:
    placeholder: { type: String, default: 'اختر...' },
    options: { type: [ComponentOptionSchema], default: [] }
  },
  { _id: true }
);

const ComponentPanelSchema = new Schema(
  {
    name: { type: String, required: true },    // internal label shown in the dashboard list
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    color: { type: String, default: '#0f2158' },
    image: { type: String, default: '' },
    footer: { type: String, default: '' },
    components: { type: [MessageComponentSchema], default: [] } // max 5 (one Discord action row each)
  },
  { _id: true, timestamps: true }
);

// Interaction Points (نقاط التفاعل) — a points system for regular members (not
// staff) based on activity (currently: qualifying messages). Points don't grant VC —
// they unlock role rewards ("ترقيات") at configurable thresholds, e.g. "Active Member"
// at 100 points, "VIP" at 500, etc. Running totals live in their own collection
// (src/models/InteractionScore.js); this is config only. Applied in
// src/events/messageCreate.js via src/services/interactionPointsService.js.
const InteractionPointsRewardSchema = new Schema(
  {
    points: { type: Number, required: true }, // threshold — role granted once total points >= this
    roleId: { type: String, default: '' },
    label: { type: String, default: '' }
  },
  { _id: true }
);

const InteractionPointsSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    pointsPerMessage: { type: Number, default: 1 },     // points granted per qualifying message
    cooldownSeconds: { type: Number, default: 60 },      // anti-farm cooldown per member
    minMessageLength: { type: Number, default: 1 },      // ignore very short/empty messages
    excludedChannelIds: { type: [String], default: [] }, // channels that never grant points
    logsChannelId: { type: String, default: '' },        // optional: announce role promotions here
    rewards: { type: [InteractionPointsRewardSchema], default: [] }
  },
  { _id: false }
);

// Rank Shop (متجر الرتب) — sell server roles for real-money bank transfers. Admin
// configures the bank/payment info + priced roles via /rank-shop; members buy via
// the panel's select menu (or /rank-shop buy), which opens a private room (like a
// ticket) showing the bank details and a "لقد حوّلت" button. Staff then confirms
// the transfer manually (button in the room, or /rank-shop confirm anywhere) which
// grants the role. Orders themselves live in their own collection (see
// src/models/RankOrder.js) — this is config only. See src/systems/rankShop.js and
// src/services/rankShopService.js.
const RankItemSchema = new Schema(
  {
    roleId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String, default: '' }
  },
  { _id: true }
);

const RankShopSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    // Category new private purchase rooms get created under. Empty = server root.
    categoryId: { type: String, default: '' },
    // Optional role that gets access to + gets pinged in every purchase room
    // (e.g. "Sales Staff"). Anyone with Manage Server can always confirm/reject
    // regardless of this role.
    staffRoleId: { type: String, default: '' },
    currency: { type: String, default: 'دج' },
    bank: {
      bankName: { type: String, default: '' },
      accountHolder: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      // Free-form extra instructions (RIB/IBAN/CCP/Baridimob/etc, working hours...)
      notes: { type: String, default: '' }
    },
    ranks: { type: [RankItemSchema], default: [] }
  },
  { _id: false }
);

// تقديم الإدارة (Staff Applications) — بانل فيه زر "تقديم الآن"، الضغط عليه
// يفتح مودال بأسئلة محددة من الإعدادات (بحد أقصى 5 — قيد الديسكورد على عدد
// حقول المودال)، الجواب يترسل كـ Embed لروم المراجعة المحدد بأزرار قبول/رفض،
// والقرار يوصل للمتقدم بالخاص (DM). التقديمات نفسها محفوظة في مجموعة منفصلة
// (src/models/StaffApplication.js) — هذا إعدادات فقط. انظر
// src/systems/applications.js و src/services/applicationService.js.
const ApplicationQuestionSchema = new Schema(
  {
    text: { type: String, required: true } // نص السؤال كما يظهر بالمودال
  },
  { _id: true }
);

const ApplicationPanelSchema = new Schema(
  {
    // اسم داخلي للتمييز بين أكثر من نوع تقديم (مثلاً: "إداري"، "مطور فرق").
    name: { type: String, required: true, default: 'تقديم الإدارة' },
    enabled: { type: Boolean, default: true },
    panelChannelId: { type: String, default: '' }, // آخر قناة أُرسل فيها البانل
    panelTitle: { type: String, default: '📋 تقديم الإدارة' },
    panelDescription: {
      type: String,
      default: 'تبي تنضم لفريق الإدارة؟ اضغط الزر بالأسفل وجاوب على الأسئلة.'
    },
    panelColor: { type: String, default: '#0f2158' },
    panelImage: { type: String, default: '' },
    panelThumbnail: { type: String, default: '' },
    panelFooter: { type: String, default: '' },
    buttonLabel: { type: String, default: '📋 تقديم الآن' },
    buttonEmoji: { type: String, default: '📋' },
    buttonStyle: { type: String, enum: ['Primary', 'Secondary', 'Success', 'Danger'], default: 'Primary' },
    // بحد أقصى 5 أسئلة (قيد الديسكورد: 5 حقول مودال كحد أقصى).
    questions: { type: [ApplicationQuestionSchema], default: [{ text: 'ليش تستحق تكون إداري؟' }] },
    // روم مراجعة التقديمات (تُستخدم إذا createTicketOnSubmit موقوفة).
    reviewChannelId: { type: String, default: '' },
    // بدل إرسال التقديم لروم ثابت، افتح تكت خاص لكل تقديم (زي نظام التذاكر) —
    // المتقدم يقدر يتواصل مع الإدارة داخله، والقرار (قبول/رفض) يصير من نفس التكت.
    createTicketOnSubmit: { type: Boolean, default: false },
    // التصنيف (Category) اللي يتحط تحته تكت التقديم — إجباري عمليًا إذا
    // createTicketOnSubmit مفعّلة حتى تشتغل صلاحيات القناة صح.
    ticketCategoryId: { type: String, default: '' },
    // رتبة تُمنشن بروم المراجعة عند وصول تقديم جديد (اختياري).
    reviewPingRoleId: { type: String, default: '' },
    // رتبة تُمنح تلقائيًا للمتقدم عند القبول (اختياري).
    acceptRoleId: { type: String, default: '' },
    // منع تقديم أكثر من مرة وهو عنده تقديم "قيد المراجعة" لنفس البانل.
    preventDuplicatePending: { type: Boolean, default: true },
    acceptMessage: { type: String, default: '✅ مبروك! تم قبول تقديمك في **{guild}**.' },
    rejectMessage: { type: String, default: '❌ للأسف تم رفض تقديمك في **{guild}**.' }
  },
  { _id: true }
);

const GuildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },

    locale: { type: String, default: 'ar' },
    isPremium: { type: Boolean, default: false },
    // Empty string ('') means shortcuts trigger with NO prefix at all — just typing
    // the shortcut word itself (e.g. "c" or "رصيدي") runs the command. This is the
    // default now; set it back to "!" (or any string) via /system prefix if preferred.
    prefix: { type: String, default: '' },

    dailyBaseReward: { type: Number, default: 500 },
    streakBonus: { type: Number, default: 100 },
    voteReward: { type: Number, default: 1000 },
    transferTaxPercent: { type: Number, default: 2.5 },

    welcome: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      message: { type: String, default: 'أهلًا بك {mention} في سيرفر {server}\nاستمتع بوقتك معنا 😈' },
      // Optional custom background for the generated welcome image card (see
      // src/utils/welcomeCard.js). Empty string = fall back to the plain text
      // embed (old behaviour), so servers that never set one are unaffected.
      backgroundImage: { type: String, default: '' },
      // Custom text drawn ON the card image itself (separate from `message`, which
      // is still sent as the normal Discord message content above the image).
      // Supports the same {mention}/{username}/{server}/{membercount} placeholders.
      // Empty = card falls back to its default "WELCOME / username / server" text.
      cardText: { type: String, default: '' },
      // Where the member's avatar circle is drawn on the card: top/center/bottom
      // vertically, left/center/right horizontally. Legacy 9-spot preset — still
      // used as a fallback whenever avatarX/avatarY below are unset (old configs,
      // or a server that never touched the new picker).
      avatarPosition: { type: String, default: 'top-center' },
      // Precise placement, set by dragging the marker on the dashboard preview (or
      // typing exact numbers) — percentage of the card's width/height (0-100), so it
      // stays correct regardless of the final card's pixel size. null = not set yet,
      // fall back to avatarPosition. Takes priority over avatarPosition when present.
      avatarX: { type: Number, default: null },
      avatarY: { type: Number, default: null }
    },
    greet: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      message: { type: String, default: 'أهلًا {user} في {server}! تمت دعوتك بواسطة {invited}.' },
      deleteAfterSeconds: { type: Number, default: 0, min: 0, max: 86400 }
    },
    leave: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      message: { type: String, default: '{username} غادر السيرفر. نتمنى نشوفك مرة ثانية.' }
    },
    levelUp: {
      // channelId === '' means "announce in whichever channel the user leveled up in"
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      message: { type: String, default: '🎉 {mention} وصل إلى الفل **{level}**!' }
    },

    // Level/activity controls exposed by the dashboard. Defaults preserve the
    // original ZETA behaviour (1 XP/message, 60s cooldown, voice disabled).
    levelSettings: {
      enabled: { type: Boolean, default: true },
      xpPerMessage: { type: Number, default: 1, min: 0, max: 100 },
      messageCooldownSeconds: { type: Number, default: 60, min: 0, max: 3600 },
      xpPerVoiceMinute: { type: Number, default: 0, min: 0, max: 100 },
      resetOnLeave: { type: Boolean, default: false },
      disabledChannelIds: { type: [String], default: [] },
      disabledRoleIds: { type: [String], default: [] },
      roleMultipliers: [{
        roleId: { type: String, default: '' },
        multiplier: { type: Number, default: 1, min: 0, max: 10 }
      }],
      channelMultipliers: [{
        channelId: { type: String, default: '' },
        multiplier: { type: Number, default: 1, min: 0, max: 10 }
      }]
    },

    autoRoleId: { type: String, default: '' }, // legacy: single role, still set from /system + dashboard General tab
    // Richer "Auto Rules" engine (member/bot lists + invite-based roles) — additive
    // on top of autoRoleId, applied by src/systems/autoRoleRules.js.
    autoRoleRules: { type: AutoRoleRulesSchema, default: () => ({}) },
    muteRoleId: { type: String, default: '' },

    suggestions: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' }
    },

    reports: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' }
    },

    sellerRoom: { type: SellerRoomSchema, default: () => ({}) },
    rankShop: { type: RankShopSchema, default: () => ({}) },
    autoResponders: { type: [AutoResponderSchema], default: [] },
    automod: { type: AutomodSettingsSchema, default: () => ({}) },
    ticketSettings: { type: TicketSettingsSchema, default: () => ({}) },
    // بانلات تذاكر إضافية (بجانب البانل الرئيسي أعلاه) — كل واحد له نفس
    // الحقول بالضبط (قناة/عنوان/أزرار/سلكت/أزرار جاهزة...) ويُدار من الداشبورد.
    ticketPanels: { type: [TicketSettingsSchema], default: [] },
    logSettings: { type: LogSettingsSchema, default: () => ({}) },
    staffPoints: { type: StaffPointsSchema, default: () => ({}) },
    shortcuts: { type: [ShortcutSchema], default: [] },
    commandPermissions: { type: [CommandPermissionSchema], default: [] },
    // Dashboard command enable/disable state per server. Missing entries mean enabled.
    commandStates: { type: [CommandStateSchema], default: [] },
    savedEmbeds: { type: [SavedEmbedSchema], default: [] },
    componentPanels: { type: [ComponentPanelSchema], default: [] },
    interactionPoints: { type: InteractionPointsSchema, default: () => ({}) },
    // بانلات "تقديم الإدارة" — يدعم أكثر من نوع تقديم بنفس السيرفر.
    applicationPanels: { type: [ApplicationPanelSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = model('Guild', GuildSchema);
