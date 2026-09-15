const pool = require("../database/connection");

const defaultPreferences = {
  highContrast: false,
  reducedMotion: false,
  onboardingCompleted: false,
  onboardingStep: 0,
};

async function ensureSchema() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS user_ux_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
      reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_step >= 0),
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

function mapPreferences(row = {}) {
  return {
    highContrast: Boolean(row.high_contrast),
    reducedMotion: Boolean(row.reduced_motion),
    onboardingCompleted: Boolean(row.onboarding_completed),
    onboardingStep: Number(row.onboarding_step || 0),
  };
}

async function getPreferences(userId) {
  const result = await pool.query(
    `SELECT high_contrast, reduced_motion, onboarding_completed, onboarding_step
     FROM user_ux_preferences
     WHERE user_id = $1`,
    [Number(userId)]
  );

  return result.rows[0] ? mapPreferences(result.rows[0]) : { ...defaultPreferences };
}

async function savePreferences(userId, input = {}) {
  const current = await getPreferences(userId);
  const preferences = {
    highContrast: input.highContrast === undefined ? current.highContrast : Boolean(input.highContrast),
    reducedMotion: input.reducedMotion === undefined ? current.reducedMotion : Boolean(input.reducedMotion),
    onboardingCompleted: input.onboardingCompleted === undefined ? current.onboardingCompleted : Boolean(input.onboardingCompleted),
    onboardingStep: input.onboardingStep === undefined ? current.onboardingStep : Math.max(0, Number(input.onboardingStep) || 0),
  };

  const result = await pool.query(
    `INSERT INTO user_ux_preferences (user_id, high_contrast, reduced_motion, onboarding_completed, onboarding_step)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       high_contrast = EXCLUDED.high_contrast,
       reduced_motion = EXCLUDED.reduced_motion,
       onboarding_completed = EXCLUDED.onboarding_completed,
       onboarding_step = EXCLUDED.onboarding_step,
       updated_at = CURRENT_TIMESTAMP
     RETURNING high_contrast, reduced_motion, onboarding_completed, onboarding_step`,
    [Number(userId), preferences.highContrast, preferences.reducedMotion, preferences.onboardingCompleted, preferences.onboardingStep]
  );

  return mapPreferences(result.rows[0]);
}

module.exports = {
  defaultPreferences,
  ensureSchema,
  getPreferences,
  savePreferences,
};
