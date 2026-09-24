const fs = require('fs');
const path = require('path');

const locales = {};
for (const file of fs.readdirSync(path.join(__dirname, '..', '..', 'locales'))) {
  if (file.endsWith('.json')) {
    const code = file.replace('.json', '');
    locales[code] = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'locales', file), 'utf8'));
  }
}

const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || 'ar';

/**
 * t(locale, key, vars) — translation lookup with {placeholder} interpolation.
 * Falls back to DEFAULT_LOCALE, then to the raw key if missing everywhere.
 */
function t(locale, key, vars = {}) {
  const table = locales[locale] || locales[DEFAULT_LOCALE] || {};
  let str = table[key] ?? locales[DEFAULT_LOCALE]?.[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

module.exports = { t, locales, DEFAULT_LOCALE };
