const localizationModel = require("../models/localizationModel");

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get("user-agent") || "" };
}

async function settingsPage(req, res, next) {
  try {
    const [preferences, languages, currencies] = await Promise.all([
      localizationModel.getUserPreferences(currentUser(req).id),
      localizationModel.getSupportedLanguages(),
      localizationModel.getSupportedCurrencies(),
    ]);
    return res.render("localization/settings", {
      title: "Language and region",
      user: currentUser(req),
      preferences: preferences || {
        language_code: "en", locale: localizationModel.DEFAULT_LOCALE, currency_code: "NGN", region_code: "NG", time_format: "24h", date_format: "dd/MM/yyyy", auto_detect: true,
      },
      languages,
      currencies,
    });
  } catch (error) {
    return next(error);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const languageCode = String(req.body.languageCode || "en").toLowerCase();
    const locale = String(req.body.locale || localizationModel.DEFAULT_LOCALE);
    const currencyCode = String(req.body.currencyCode || "NGN").toUpperCase();
    const regionCode = String(req.body.regionCode || "NG").toUpperCase();
    const timeFormat = req.body.timeFormat === "12h" ? "12h" : "24h";
    const dateFormat = String(req.body.dateFormat || "dd/MM/yyyy").slice(0, 24);
    const autoDetect = req.body.autoDetect === "on";
    const languages = await localizationModel.getSupportedLanguages();
    const currencies = await localizationModel.getSupportedCurrencies();
    if (!languages.some((language) => language.code === languageCode) || !currencies.some((currency) => currency.code === currencyCode)) {
      throw new Error("The selected language or currency is not available.");
    }
    await localizationModel.saveUserPreferences(req.session.user.id, { languageCode, locale, currencyCode, regionCode, timeFormat, dateFormat, autoDetect }, requestMeta(req));
    return res.redirect("/settings/localization?message=Language+and+region+preferences+saved.");
  } catch (error) {
    return next(error);
  }
}

module.exports = { settingsPage, updatePreferences };
