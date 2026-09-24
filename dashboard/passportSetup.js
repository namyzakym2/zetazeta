const passport = require('passport');
const { Strategy: DiscordStrategy } = require('passport-discord');

// Configure Passport exactly once. The dashboard can be started standalone or
// embedded inside the bot process, so this module is intentionally idempotent.
if (!global.__zetaPassportConfigured) {
  const clientID = process.env.CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const baseUrl = String(process.env.DASHBOARD_URL || '').replace(/\/$/, '');
  const callbackURL = process.env.DISCORD_REDIRECT_URI || `${baseUrl}/auth/discord/callback`;

  if (!clientID || !clientSecret || !callbackURL) {
    throw new Error('Discord OAuth is not configured. Set CLIENT_ID, DISCORD_CLIENT_SECRET and DASHBOARD_URL (or DISCORD_REDIRECT_URI).');
  }

  passport.use('discord', new DiscordStrategy({
    clientID,
    clientSecret,
    callbackURL,
    scope: ['identify', 'guilds']
  }, (accessToken, refreshToken, profile, done) => {
    // The dashboard needs the user's Discord guild list to determine which
    // servers they can manage. Keep the OAuth profile in the server-side session.
    profile.accessToken = undefined;
    profile.refreshToken = undefined;
    done(null, profile);
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  global.__zetaPassportConfigured = true;
  console.log(`🔐 Discord OAuth configured: ${callbackURL}`);
}

module.exports = passport;
