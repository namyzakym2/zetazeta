const express = require('express');
const passport = require('passport');
const router = require('../asyncRouter')(express.Router());

const DEMO_USER = {
  id: '123456789012345678',
  username: 'ZETA Admin',
  discriminator: '0001',
  avatar: null,
  guilds: [
    {
      id: '112233445566778899',
      name: 'سيرفر ZETA التجريبي',
      icon: null,
      owner: true,
      permissions: '8'
    }
  ]
};

function startDiscordLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return res.redirect('/dashboard/');

  if (!process.env.CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    return req.logIn(DEMO_USER, (err) => {
      if (err) return res.redirect('/?login=failed');
      return res.redirect('/dashboard/');
    });
  }

  // OAuth authorization codes are single-use. State protection also prevents a
  // stale callback from another browser/session being accepted by this session.
  return passport.authenticate('discord', { state: true })(req, res, next);
}

router.get('/discord', startDiscordLogin);
router.get('/demo', (req, res) => {
  req.logIn(DEMO_USER, (err) => {
    if (err) return res.redirect('/?login=failed');
    return res.redirect('/dashboard/');
  });
});

router.get('/discord/callback', (req, res, next) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';

  // If the browser/proxy replays the exact same callback URL, Discord will answer
  // invalid_grant/invalid code. Avoid sending the user into a confusing 500 page.
  if (code && req.session?.zetaLastOAuthCode === code) {
    return res.redirect('/auth/discord?reason=stale_code');
  }
  if (code && req.session) req.session.zetaLastOAuthCode = code;

  return passport.authenticate('discord', (err, user, info) => {
    if (err) {
      const message = String(err?.message || info?.message || '').toLowerCase();
      console.error('Discord OAuth callback failed:', err?.message || err);

      if (req.session) {
        delete req.session.zetaLastOAuthCode;
        req.session.save(() => {});
      }

      // invalid_grant is Discord's normal response for an expired/replayed OAuth
      // authorization code. Start a completely fresh authorization flow.
      if (message.includes('invalid') || message.includes('grant') || message.includes('code')) {
        return res.redirect('/auth/discord?reason=oauth_code');
      }
      return res.redirect('/?login=failed');
    }

    if (!user) {
      if (req.session) {
        delete req.session.zetaLastOAuthCode;
        req.session.save(() => {});
      }
      return res.redirect('/?login=failed');
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Discord OAuth session login failed:', loginErr);
        return res.redirect('/?login=failed');
      }

      if (req.session) {
        // The authorization code has served its purpose; never keep it around.
        delete req.session.zetaLastOAuthCode;
      }
      return res.redirect('/dashboard/');
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout(() => {
    if (req.session) {
      req.session.destroy(() => res.redirect('/'));
    } else {
      res.redirect('/');
    }
  });
});

module.exports = router;
