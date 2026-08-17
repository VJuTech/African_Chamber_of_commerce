-- Rebuild the database schema for the account/authentication flow and membership management.
-- Run this script from a PostgreSQL-compatible SQL client.
-- Chapter 9 - Membership & Account Management Integration

DROP TABLE IF EXISTS membership_audit_logs;
DROP TABLE IF EXISTS membership_history;
DROP TABLE IF EXISTS membership_features;
DROP TABLE IF EXISTS membership_limits;
DROP TABLE IF EXISTS membership_tiers;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- MEMBERSHIP TIERS TABLE - Defines available membership types
-- ============================================================================
CREATE TABLE membership_tiers (
  id SERIAL PRIMARY KEY,
  tier_name VARCHAR(100) NOT NULL UNIQUE,
  tier_slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  pricing DECIMAL(10, 2),
  billing_cycle VARCHAR(50),
  features JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default membership tiers
INSERT INTO membership_tiers (tier_name, tier_slug, description, pricing, billing_cycle) VALUES
('Basic Membership', 'basic', 'Entry-level membership with essential features', 0, 'free'),
('Premium Membership', 'premium', 'Advanced features and priority support', 99.99, 'monthly'),
('Enterprise Membership', 'enterprise', 'Full suite of features for large organizations', 499.99, 'annual'),
('Government/Institution Membership', 'government', 'Special tier for government and educational institutions', NULL, 'custom');

-- ============================================================================
-- USERS TABLE - Enhanced with membership tracking
-- ============================================================================
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
  -- CHAPTER 9: Membership & Account Management Fields
  membership_tier_id INTEGER DEFAULT 1,
  membership_status VARCHAR(50) NOT NULL DEFAULT 'active',
  account_status VARCHAR(50) NOT NULL DEFAULT 'active',
  membership_start_date TIMESTAMP,
  membership_expiry_date TIMESTAMP,
  membership_renewal_date TIMESTAMP,
  membership_renewal_auto BOOLEAN NOT NULL DEFAULT FALSE,
  previous_tier_id INTEGER,
  tier_change_date TIMESTAMP,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  suspended_at TIMESTAMP,
  is_deactivated BOOLEAN NOT NULL DEFAULT FALSE,
  deactivated_at TIMESTAMP,
  deactivation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_membership_tier
    FOREIGN KEY (membership_tier_id) REFERENCES membership_tiers(id) ON DELETE SET NULL,
  CONSTRAINT fk_previous_tier
    FOREIGN KEY (previous_tier_id) REFERENCES membership_tiers(id) ON DELETE SET NULL
);

-- ============================================================================
-- MEMBERSHIP LIMITS TABLE - Defines limits per tier
-- ============================================================================
CREATE TABLE membership_limits (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER NOT NULL,
  limit_key VARCHAR(100) NOT NULL,
  limit_value INTEGER,
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tier_limits
    FOREIGN KEY (tier_id) REFERENCES membership_tiers(id) ON DELETE CASCADE,
  UNIQUE(tier_id, limit_key)
);

-- ============================================================================
-- MEMBERSHIP FEATURES TABLE - Defines features per tier
-- ============================================================================
CREATE TABLE membership_features (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  feature_description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tier_features
    FOREIGN KEY (tier_id) REFERENCES membership_tiers(id) ON DELETE CASCADE,
  UNIQUE(tier_id, feature_name)
);

-- ============================================================================
-- MEMBERSHIP HISTORY TABLE - Tracks membership changes
-- ============================================================================
CREATE TABLE membership_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  previous_tier_id INTEGER,
  new_tier_id INTEGER,
  change_type VARCHAR(100) NOT NULL,
  effective_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  initiated_by VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_history
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_prev_tier_history
    FOREIGN KEY (previous_tier_id) REFERENCES membership_tiers(id) ON DELETE SET NULL,
  CONSTRAINT fk_new_tier_history
    FOREIGN KEY (new_tier_id) REFERENCES membership_tiers(id) ON DELETE SET NULL
);

-- ============================================================================
-- MEMBERSHIP AUDIT LOGS TABLE - Chapter 9 Requirement: ACC-FRS-MEM-008
-- ============================================================================
CREATE TABLE membership_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  event_type VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  previous_tier VARCHAR(100),
  new_tier VARCHAR(100),
  status_before VARCHAR(50),
  status_after VARCHAR(50),
  initiated_by VARCHAR(50),
  ip_address VARCHAR(45),
  reason TEXT,
  metadata JSONB,
  outcome VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_membership_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- AUDIT LOGS TABLE - General audit logging
-- ============================================================================
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

-- ============================================================================
-- SESSION TABLE - Used by connect-pg-simple for session storage
-- ============================================================================
CREATE TABLE session (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  PRIMARY KEY (sid)
);

-- ============================================================================
-- INDEXES for performance optimization
-- ============================================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_membership_status ON users(membership_status);
CREATE INDEX idx_users_account_status ON users(account_status);
CREATE INDEX idx_users_membership_expiry ON users(membership_expiry_date);
CREATE INDEX idx_membership_history_user ON membership_history(user_id);
CREATE INDEX idx_membership_history_change_type ON membership_history(change_type);
CREATE INDEX idx_membership_audit_user ON membership_audit_logs(user_id);
CREATE INDEX idx_membership_audit_event ON membership_audit_logs(event_type);
CREATE INDEX idx_membership_audit_created ON membership_audit_logs(created_at);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_session_expire ON session (expire);
