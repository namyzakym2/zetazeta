require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('../src/db/mysqlCompat');
const path = require('path');
 
// Safety net: an async Express route that throws without its own try/catch becomes an
// unhandled promise rejection, which crashes the whole dashboard process on modern
// Node versions. Log it and stay up.
process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled promise rejection (dashboard stayed online):', err);
});
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught exception (dashboard stayed online):', err);
});
 
/**
 * IMPORTANT: everything that can fail (env validation, MongoDB connection, session
 * store creation, passport setup) now happens INSIDE this async start() function,
 * which is wrapped in start().catch(...) at the bottom. Previously several of these
 * ran at the top level of the file, outside any try/catch — if MYSQL_URL or an
 * OAuth env var was missing, that could throw synchronously during module load,
 * which our uncaughtException handler would swallow, but execution of the rest of
 * the file (mounting routes, calling app.listen()) would simply never happen. The
 * process stayed alive with no visible crash, which is exactly what "dashboard is
 * broken with no error" looks like. Now any failure here is caught, logged clearly,
 * and the process exits with a real error message instead of hanging silently.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.embedded] — true when required/started from src/bot.js
 *   (the bot and dashboard sharing one process). When embedded: missing env vars
 *   just log a warning and skip starting the dashboard instead of process.exit(1)
 *   (which would kill the bot too), and an already-open Mongo connection is reused
 *   instead of opening a second one.
 * @param {import('discord.js').Client} [opts.discordClient] — when embedded, the
 *   already-logged-in bot client, so dashboard actions (e.g. admin panel changes)
 *   can post to Discord log channels via logService instead of that being silently
 *   skipped like it is when the dashboard runs as a separate standalone process.
 */
async function start(opts = {}) {
  const { embedded = false, discordClient = null } = opts;
 
  // Accept the names people commonly use in .env as aliases.
  // The dashboard historically required DISCORD_CLIENT_SECRET + DASHBOARD_URL,
  // while many deployments use CLIENT_SECRET/PORT instead.
  process.env.DISCORD_CLIENT_SECRET =
    process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET_KEY || '';
  process.env.CLIENT_ID = process.env.CLIENT_ID || process.env.APPLICATION_ID || '';
  process.env.DASHBOARD_URL =
    process.env.DASHBOARD_URL || process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || process.env.DASHBOARD_SESSION_SECRET || 'zeta-local-session-secret-change-me';
 
  const required = ['CLIENT_ID', 'DISCORD_CLIENT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (!process.env.MYSQL_URL && !(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE)) missing.push('MYSQL_URL (or MYSQL_HOST/MYSQL_USER/MYSQL_DATABASE)');
  if (missing.length) {
    console.error('❌ Dashboard cannot start — missing required .env variables:');
    for (const key of missing) console.error(`   - ${key}`);
    console.error('ضع CLIENT_ID و CLIENT_SECRET و MYSQL_URL في .env. ويمكنك وضع DASHBOARD_URL كرابط الداش العام.');
    if (embedded) {
      console.error('⚠️ تخطي تشغيل الداشبورد تلقائيًا (البوت سيستمر شغالًا).');
      return null;
    }
    process.exit(1);
  }
 
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect();
    console.log('🗄️  Dashboard reusing MySQL connection');
  } else {
    console.log('🗄️  Dashboard reusing existing MySQL connection');
  }
 
  for (const modelName of mongoose.modelNames()) {
    try {
      await mongoose.model(modelName).syncIndexes();
    } catch (err) {
      console.error(`⚠️ Index sync failed for model "${modelName}":`, err.message);
    }
  }
  console.log('✅ Database indexes synced with current schemas.');
 
  const app = express();
  if (discordClient) app.set('discordClient', discordClient);
 
  // --- Diagnostics: tell us WHERE the slowness is when the dashboard/login feels slow. ---
  // 1) Any request slower than 1.5s (including the Discord OAuth callback used by login).
  app.use((req, res, next) => {
    const started = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - started;
      if (ms >= 1500) console.warn(`🐢 slow request: ${req.method} ${req.originalUrl.split('?')[0]} took ${ms}ms (status ${res.statusCode})`);
    });
    next();
  });
  // 2) Event-loop stalls. The bot and the dashboard share one process, so when the bot is busy
  //    (big DB reads, JSON parsing) every dashboard request and the login callback just wait.
  if (!global.__zetaLagMonitor) {
    global.__zetaLagMonitor = true;
    let expected = Date.now() + 500;
    setInterval(() => {
      const lag = Date.now() - expected;
      if (lag > 400) console.warn(`⏱️ event loop was blocked for ~${lag}ms (bot + dashboard share this process)`);
      expected = Date.now() + 500;
    }, 500).unref();
  }
 
  // If you run this behind a reverse proxy (Nginx, Pterodactyl's proxy, Cloudflare,
  // etc.) — very common — this is required for secure cookies/sessions to work
  // correctly over HTTPS. Harmless if you're not behind a proxy.
  app.set('trust proxy', 1);
 
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
 
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      
      cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
    })
  );
 
  app.use(passport.initialize());
  app.use(passport.session());
 
  require('./passportSetup');
 
  const authRoutes = require('./routes/auth');
  const userRoutes = require('./routes/user');
  const adminRoutes = require('./routes/admin');
  const webhookRoutes = require('./routes/webhooks');
  const devilPanelRoutes = require('./routes/devilPanel');
  const uploadRoutes = require('./routes/upload');
 
  app.use('/auth', authRoutes);
  app.use('/user', userRoutes);
  app.use('/admin', adminRoutes);
  app.use('/webhooks', webhookRoutes);
  app.use('/devil-panel', devilPanelRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/dashboard', express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    // Images rarely change: let the browser keep them for a week instead of re-checking each visit.
    setHeaders: (res, filePath) => {
      if (/[\\/]images[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }));
 
  // Stable dashboard entry points. This also makes /dashboard and /dashboard/
  // behave consistently behind Pterodactyl/Cloudflare/reverse proxies.
  app.get('/dashboard', (req, res) => res.redirect('/dashboard/'));
 
  app.get('/', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return res.redirect('/dashboard/profile.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'landing.html'));
  });
 
  // Catch-all error handler — turns any error passed via next(err), or thrown in a
  // non-async route, into a clean JSON 500 instead of an unstyled crash page.
  app.use((err, req, res, next) => {
    console.error('Express error handler caught:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });
 
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`🌐 Dashboard running at http://localhost:${port}`));
  return { app, server };
}
 
// Only auto-run when this file is executed directly (`node dashboard/server.js` /
// `npm run dashboard`). When required from src/bot.js (auto-start on boot), bot.js
// calls start({ embedded: true, discordClient }) itself instead.
if (require.main === module) {
  start().catch((err) => {
    console.error('❌ Failed to start dashboard:', err);
    process.exit(1);
  });
}
 
module.exports = { start };