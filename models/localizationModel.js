const pool = require("../database/connection");

const DEFAULT_LOCALE = "en-NG";
const FALLBACK_LOCALE = "en";
const SUPPORTED_LOCALES = ["en-NG", "fr-FR", "ar-EG", "pt-PT"];

const seedLanguages = [
  ["en", "English", "English", "ltr", true, true],
  ["fr", "French", "Francais", "ltr", true, false],
  ["ar", "Arabic", "العربية", "rtl", true, false],
  ["pt", "Portuguese", "Portugues", "ltr", true, false],
];

const seedCurrencies = [
  ["NGN", "Nigerian naira", "₦", 2, true],
  ["GHS", "Ghanaian cedi", "GH₵", 2, true],
  ["ZAR", "South African rand", "R", 2, true],
  ["USD", "US dollar", "$", 2, true],
];

const seedTranslations = [
  ["en", "navigation.settings", "Settings"],
  ["en", "navigation.localization", "Language and region"],
  ["en", "localization.title", "Language and region"],
  ["en", "localization.description", "Choose the language, currency, region, and time format used across ACC."],
  ["en", "localization.save", "Save preferences"],
  ["en", "localization.saved", "Language and region preferences saved."],
  ["en", "notification.orderPlaced.title", "Order placed"],
  ["en", "notification.orderPlaced.message", "Order #{orderId} has been placed."],
  ["en", "notification.paymentCompleted.title", "Payment completed"],
  ["en", "notification.paymentCompleted.message", "Payment for order #{orderId} was completed."],
  ["en", "notification.newMessage.title", "New message"],
  ["en", "notification.newMessage.message", "{text}"],
  ["en", "notification.eventRegistration.title", "Event registration confirmed"],
  ["en", "notification.eventRegistration.message", "{title} registration was recorded."],
  ["en", "notification.eventReminder.title", "Event reminder"],
  ["en", "notification.eventReminder.message", "{title} is coming up."],
  ["en", "notification.generic.title", "ACC update"],
  ["en", "notification.generic.message", "There is a new {event} update."],
  ["fr", "navigation.settings", "Parametres"],
  ["fr", "navigation.localization", "Langue et region"],
  ["fr", "localization.title", "Langue et region"],
  ["fr", "localization.description", "Choisissez la langue, la devise, la region et le format horaire utilises par ACC."],
  ["fr", "localization.save", "Enregistrer les preferences"],
  ["ar", "navigation.settings", "الإعدادات"],
  ["ar", "navigation.localization", "اللغة والمنطقة"],
  ["ar", "localization.title", "اللغة والمنطقة"],
  ["ar", "localization.save", "حفظ التفضيلات"],
  ["pt", "navigation.settings", "Definicoes"],
  ["pt", "navigation.localization", "Idioma e regiao"],
  ["pt", "localization.title", "Idioma e regiao"],
  ["pt", "localization.save", "Guardar preferencias"],
];

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS localization_languages (
      id SERIAL PRIMARY KEY,
      code VARCHAR(12) UNIQUE NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      native_name VARCHAR(120) NOT NULL,
      text_direction VARCHAR(3) NOT NULL DEFAULT 'ltr' CHECK (text_direction IN ('ltr', 'rtl')),
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS localization_currencies (
      id SERIAL PRIMARY KEY,
      code VARCHAR(3) UNIQUE NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      symbol VARCHAR(12) NOT NULL,
      decimal_places SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 6),
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS localization_translations (
      id SERIAL PRIMARY KEY,
      locale VARCHAR(12) NOT NULL,
      translation_key VARCHAR(180) NOT NULL,
      translation_value TEXT NOT NULL,
      context VARCHAR(180),
      version INTEGER NOT NULL DEFAULT 1,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (locale, translation_key)
    );
    CREATE TABLE IF NOT EXISTS localization_exchange_rates (
      id SERIAL PRIMARY KEY,
      base_currency VARCHAR(3) NOT NULL REFERENCES localization_currencies(code),
      target_currency VARCHAR(3) NOT NULL REFERENCES localization_currencies(code),
      rate NUMERIC(20, 10) NOT NULL CHECK (rate > 0),
      source VARCHAR(120) NOT NULL DEFAULT 'admin',
      effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (base_currency, target_currency, effective_at)
    );
    CREATE TABLE IF NOT EXISTS user_localization_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      language_code VARCHAR(12) NOT NULL DEFAULT 'en' REFERENCES localization_languages(code),
      locale VARCHAR(12) NOT NULL DEFAULT 'en-NG',
      currency_code VARCHAR(3) NOT NULL DEFAULT 'NGN' REFERENCES localization_currencies(code),
      region_code VARCHAR(12) NOT NULL DEFAULT 'NG',
      time_format VARCHAR(3) NOT NULL DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
      date_format VARCHAR(24) NOT NULL DEFAULT 'dd/MM/yyyy',
      auto_detect BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS localization_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(80) NOT NULL,
      locale VARCHAR(12),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS localization_translations_locale_idx ON localization_translations(locale);
    CREATE INDEX IF NOT EXISTS localization_exchange_rates_lookup_idx ON localization_exchange_rates(base_currency, target_currency, effective_at DESC);
    CREATE INDEX IF NOT EXISTS localization_audit_logs_created_idx ON localization_audit_logs(created_at DESC);
  `);

  for (const language of seedLanguages) {
    await pool.query(`INSERT INTO localization_languages (code, display_name, native_name, text_direction, is_enabled, is_default) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (code) DO NOTHING`, language);
  }
  for (const currency of seedCurrencies) {
    await pool.query(`INSERT INTO localization_currencies (code, display_name, symbol, decimal_places, is_enabled) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code) DO NOTHING`, currency);
  }
  for (const translation of seedTranslations) {
    await pool.query(`INSERT INTO localization_translations (locale, translation_key, translation_value) VALUES ($1, $2, $3) ON CONFLICT (locale, translation_key) DO NOTHING`, translation);
  }
  await pool.query(`INSERT INTO localization_exchange_rates (base_currency, target_currency, rate, source) VALUES
    ('NGN', 'NGN', 1, 'system'), ('GHS', 'GHS', 1, 'system'), ('ZAR', 'ZAR', 1, 'system'), ('USD', 'USD', 1, 'system')
    ON CONFLICT (base_currency, target_currency, effective_at) DO NOTHING`);
}

async function getSupportedLanguages() {
  const result = await pool.query("SELECT * FROM localization_languages WHERE is_enabled = TRUE ORDER BY is_default DESC, display_name ASC");
  return result.rows;
}

async function getSupportedCurrencies() {
  const result = await pool.query("SELECT * FROM localization_currencies WHERE is_enabled = TRUE ORDER BY code ASC");
  return result.rows;
}

async function getTranslations(locale) {
  const language = String(locale || DEFAULT_LOCALE).split("-")[0].toLowerCase();
  const result = await pool.query("SELECT translation_key, translation_value FROM localization_translations WHERE locale IN ($1, $2) ORDER BY locale ASC", [FALLBACK_LOCALE, language]);
  return result.rows.reduce((translations, row) => {
    translations[row.translation_key] = row.translation_value;
    return translations;
  }, {});
}

function interpolate(value, variables = {}) {
  return String(value || "").replace(/\{(\w+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match);
}

async function translate(key, locale, variables = {}) {
  const translations = await getTranslations(locale);
  return interpolate(translations[key] || key, variables);
}

function detectLocale(acceptLanguage = "") {
  const languages = String(acceptLanguage).split(",").map((part) => part.split(";")[0].trim().toLowerCase());
  const match = languages.find((language) => SUPPORTED_LOCALES.some((locale) => locale.toLowerCase().split("-")[0] === language.split("-")[0]));
  return match ? SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === match.split("-")[0]) || DEFAULT_LOCALE : DEFAULT_LOCALE;
}

async function getUserPreferences(userId) {
  if (!userId) return null;
  const result = await pool.query("SELECT * FROM user_localization_preferences WHERE user_id = $1", [userId]);
  return result.rows[0] || null;
}

async function saveUserPreferences(userId, preferences, audit = {}) {
  const result = await pool.query(`INSERT INTO user_localization_preferences (user_id, language_code, locale, currency_code, region_code, time_format, date_format, auto_detect) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (user_id) DO UPDATE SET language_code = EXCLUDED.language_code, locale = EXCLUDED.locale, currency_code = EXCLUDED.currency_code, region_code = EXCLUDED.region_code, time_format = EXCLUDED.time_format, date_format = EXCLUDED.date_format, auto_detect = EXCLUDED.auto_detect, updated_at = CURRENT_TIMESTAMP RETURNING *`, [userId, preferences.languageCode, preferences.locale, preferences.currencyCode, preferences.regionCode, preferences.timeFormat, preferences.dateFormat, preferences.autoDetect]);
  await writeAudit({ userId, actorId: userId, eventType: "preferences_updated", locale: preferences.locale, details: preferences, ...audit });
  return result.rows[0];
}

async function writeAudit({ userId = null, actorId = null, eventType, locale = null, details = {}, ip = null, userAgent = null }) {
  await pool.query("INSERT INTO localization_audit_logs (user_id, actor_id, event_type, locale, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6, $7)", [userId, actorId, eventType, locale, JSON.stringify(details), ip, userAgent]);
}

async function getExchangeRate(baseCurrency, targetCurrency) {
  if (baseCurrency === targetCurrency) return 1;
  const result = await pool.query("SELECT rate FROM localization_exchange_rates WHERE base_currency = $1 AND target_currency = $2 ORDER BY effective_at DESC LIMIT 1", [baseCurrency, targetCurrency]);
  if (result.rows[0]) return Number(result.rows[0].rate);
  const inverse = await pool.query("SELECT rate FROM localization_exchange_rates WHERE base_currency = $1 AND target_currency = $2 ORDER BY effective_at DESC LIMIT 1", [targetCurrency, baseCurrency]);
  if (inverse.rows[0]) return 1 / Number(inverse.rows[0].rate);
  throw new Error(`Exchange rate unavailable for ${baseCurrency} to ${targetCurrency}.`);
}

async function convertCurrency(amount, baseCurrency, targetCurrency) {
  const rate = await getExchangeRate(baseCurrency, targetCurrency);
  return { amount: Number(amount) * rate, rate, baseCurrency, targetCurrency };
}

function formatCurrency(amount, currency = "NGN", locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(amount) || 0);
}

function formatDate(value, locale = DEFAULT_LOCALE, options = {}) {
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

function formatNumber(value, locale = DEFAULT_LOCALE, options = {}) {
  return new Intl.NumberFormat(locale, options).format(Number(value) || 0);
}

async function getAdminData() {
  const [languages, currencies, translations, rates, audits] = await Promise.all([
    pool.query("SELECT * FROM localization_languages ORDER BY display_name ASC"),
    pool.query("SELECT * FROM localization_currencies ORDER BY code ASC"),
    pool.query("SELECT t.*, u.name AS updated_by_name FROM localization_translations t LEFT JOIN users u ON u.id = t.updated_by ORDER BY t.locale ASC, t.translation_key ASC LIMIT 500"),
    pool.query("SELECT * FROM localization_exchange_rates ORDER BY effective_at DESC LIMIT 200"),
    pool.query("SELECT a.*, u.name AS actor_name FROM localization_audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC LIMIT 100"),
  ]);
  return { languages: languages.rows, currencies: currencies.rows, translations: translations.rows, rates: rates.rows, audits: audits.rows };
}

async function updateLanguage(actorId, code, enabled, request = {}) {
  const result = await pool.query("UPDATE localization_languages SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP WHERE code = $2 RETURNING *", [Boolean(enabled), code]);
  if (!result.rowCount) throw new Error("Language was not found.");
  await writeAudit({ actorId, eventType: "language_status_updated", locale: code, details: { enabled: Boolean(enabled) }, ...request });
  return result.rows[0];
}

async function upsertTranslation(actorId, locale, translationKey, translationValue, context, request = {}) {
  if (!locale || !translationKey || !translationValue) throw new Error("Locale, translation key, and value are required.");
  const result = await pool.query(`INSERT INTO localization_translations (locale, translation_key, translation_value, context, updated_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (locale, translation_key) DO UPDATE SET translation_value = EXCLUDED.translation_value, context = EXCLUDED.context, updated_by = EXCLUDED.updated_by, version = localization_translations.version + 1, updated_at = CURRENT_TIMESTAMP RETURNING *`, [locale, translationKey, translationValue, context || null, actorId]);
  await writeAudit({ actorId, eventType: "translation_updated", locale, details: { translationKey }, ...request });
  return result.rows[0];
}

async function upsertExchangeRate(actorId, baseCurrency, targetCurrency, rate, source, request = {}) {
  const numericRate = Number(rate);
  if (!baseCurrency || !targetCurrency || !Number.isFinite(numericRate) || numericRate <= 0) throw new Error("A valid positive exchange rate is required.");
  const result = await pool.query("INSERT INTO localization_exchange_rates (base_currency, target_currency, rate, source, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *", [baseCurrency, targetCurrency, numericRate, source || "admin", actorId]);
  await writeAudit({ actorId, eventType: "exchange_rate_updated", details: { baseCurrency, targetCurrency, rate: numericRate, source: source || "admin" }, ...request });
  return result.rows[0];
}

module.exports = { ensureSchema, getSupportedLanguages, getSupportedCurrencies, getTranslations, translate, detectLocale, getUserPreferences, saveUserPreferences, writeAudit, getExchangeRate, convertCurrency, formatCurrency, formatDate, formatNumber, getAdminData, updateLanguage, upsertTranslation, upsertExchangeRate, DEFAULT_LOCALE, FALLBACK_LOCALE };
