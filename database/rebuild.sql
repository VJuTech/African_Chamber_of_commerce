-- Rebuild the database schema for the account/authentication flow.
-- Run this script from a PostgreSQL-compatible SQL client.

-- Drop dependent tables first so the script can be rerun safely.
DROP TABLE IF EXISTS membership_audit_logs CASCADE;
DROP TABLE IF EXISTS membership_history CASCADE;
DROP TABLE IF EXISTS user_memberships CASCADE;
DROP TABLE IF EXISTS membership_features CASCADE;
DROP TABLE IF EXISTS membership_limits CASCADE;
DROP TABLE IF EXISTS membership_tiers CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(30),
  country VARCHAR(100) NOT NULL,
  preferred_language VARCHAR(50),
  referral_code VARCHAR(80),
  organization_name VARCHAR(200),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
  registration_state VARCHAR(50) NOT NULL DEFAULT 'started',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  consent_terms BOOLEAN NOT NULL DEFAULT FALSE,
  consent_privacy BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version VARCHAR(50),
  privacy_version VARCHAR(50),
  verified_member BOOLEAN NOT NULL DEFAULT FALSE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP NULL,
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  user_id INTEGER,
  outcome VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Table used by connect-pg-simple for session storage
CREATE TABLE session (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
CREATE INDEX idx_session_expire ON session (expire);

-- ========================================
-- CHAPTER 9: MEMBERSHIP & ACCOUNT MANAGEMENT SCHEMA
-- ========================================

-- Membership Tiers Table (ACC-FRS-MEM-001, MEM-002, MEM-003)
CREATE TABLE membership_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(100) NOT NULL UNIQUE,
  tier_level INTEGER NOT NULL UNIQUE,
  description TEXT,
  pricing DECIMAL(10, 2),
  billing_cycle VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Membership Features Table (Feature availability per tier)
CREATE TABLE membership_features (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
  feature_name VARCHAR(200) NOT NULL,
  feature_description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Membership Limits Table (Usage limits per tier)
CREATE TABLE membership_limits (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
  limit_type VARCHAR(100) NOT NULL,
  limit_value INTEGER,
  limit_description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User Membership Tracking (ACC-FRS-MEM-001)
CREATE TABLE user_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier_id INTEGER NOT NULL REFERENCES membership_tiers(id),
  membership_status VARCHAR(50) NOT NULL DEFAULT 'active',
  membership_start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  membership_expiry_date TIMESTAMP,
  renewal_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Membership History Table (Track all membership changes)
CREATE TABLE membership_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_tier_id INTEGER REFERENCES membership_tiers(id),
  to_tier_id INTEGER REFERENCES membership_tiers(id),
  change_type VARCHAR(50) NOT NULL,
  reason TEXT,
  scheduled_date TIMESTAMP,
  completed_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Membership Audit Logs Table (ACC-FRS-MEM-008)
CREATE TABLE membership_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  membership_tier VARCHAR(100),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB,
  outcome VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Update users table to add membership-related columns (ACC-FRS-MEM-004, MEM-005, MEM-006, MEM-007)
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_tier_id INTEGER REFERENCES membership_tiers(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier_updated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_membership_expiry_notified_at TIMESTAMP;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_memberships_user_id ON user_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_tier_id ON user_memberships(tier_id);
CREATE INDEX IF NOT EXISTS idx_user_memberships_status ON user_memberships(membership_status);
CREATE INDEX IF NOT EXISTS idx_membership_history_user_id ON membership_history(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_history_change_type ON membership_history(change_type);
CREATE INDEX IF NOT EXISTS idx_membership_audit_logs_user_id ON membership_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_audit_logs_event_type ON membership_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_membership_audit_logs_created_at ON membership_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_users_current_tier_id ON users(current_tier_id);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);

-- Seed Default Membership Tiers
INSERT INTO membership_tiers (tier_name, tier_level, description, pricing, billing_cycle)
VALUES
  ('Basic', 1, 'Basic membership with essential features', 0.00, 'monthly'),
  ('Premium', 2, 'Premium membership with enhanced features', 99.99, 'monthly'),
  ('Enterprise', 3, 'Enterprise membership with full features', 499.99, 'monthly'),
  ('Government/Institution', 4, 'Special membership for government and institutional bodies', 0.00, 'annual')
ON CONFLICT (tier_name) DO NOTHING;

-- Seed Default Features for Basic Tier
INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'View Public Listings', 'Access to view public listings and opportunities', TRUE
FROM membership_tiers WHERE tier_name = 'Basic'
ON CONFLICT DO NOTHING;

INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'Profile Management', 'Create and manage user profile', TRUE
FROM membership_tiers WHERE tier_name = 'Basic'
ON CONFLICT DO NOTHING;

-- Seed Default Features for Premium Tier
INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'Post Tenders', 'Post business tenders', TRUE
FROM membership_tiers WHERE tier_name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'Advanced Analytics', 'Access to advanced analytics dashboard', TRUE
FROM membership_tiers WHERE tier_name = 'Premium'
ON CONFLICT DO NOTHING;

-- Seed Default Features for Enterprise Tier
INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'Dedicated Support', 'Access to dedicated customer support', TRUE
FROM membership_tiers WHERE tier_name = 'Enterprise'
ON CONFLICT DO NOTHING;

INSERT INTO membership_features (tier_id, feature_name, feature_description, enabled)
SELECT id, 'API Access', 'Full API access for integrations', TRUE
FROM membership_tiers WHERE tier_name = 'Enterprise'
ON CONFLICT DO NOTHING;

-- Seed Default Limits
INSERT INTO membership_limits (tier_id, limit_type, limit_value, limit_description)
SELECT id, 'listings_per_month', 5, 'Number of listings allowed per month'
FROM membership_tiers WHERE tier_name = 'Basic'
ON CONFLICT DO NOTHING;

INSERT INTO membership_limits (tier_id, limit_type, limit_value, limit_description)
SELECT id, 'listings_per_month', 50, 'Number of listings allowed per month'
FROM membership_tiers WHERE tier_name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO membership_limits (tier_id, limit_type, limit_value, limit_description)
SELECT id, 'listings_per_month', NULL, 'Unlimited listings'
FROM membership_tiers WHERE tier_name = 'Enterprise'
ON CONFLICT DO NOTHING;
