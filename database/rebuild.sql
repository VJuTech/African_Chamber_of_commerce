-- Rebuild the database schema for the account/authentication flow.
-- Run this script from a PostgreSQL-compatible SQL client.

-- Drop all dependent tables first so the script can be rerun safely.
-- Order matters: drop tables with foreign keys first, then referenced tables.
DROP TABLE IF EXISTS payment_refunds CASCADE;
DROP TABLE IF EXISTS payment_gateway_events CASCADE;
DROP TABLE IF EXISTS payment_audit_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS logistics_notifications CASCADE;
DROP TABLE IF EXISTS logistics_audit_logs CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS order_audit_logs CASCADE;
DROP TABLE IF EXISTS order_disputes CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS marketplace_audit_logs CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS trust_audit_logs CASCADE;
DROP TABLE IF EXISTS review_reports CASCADE;
DROP TABLE IF EXISTS business_reviews CASCADE;
DROP TABLE IF EXISTS event_audit_logs CASCADE;
DROP TABLE IF EXISTS event_feedback CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS event_records CASCADE;
DROP TABLE IF EXISTS business_directory_search_logs CASCADE;
DROP TABLE IF EXISTS business_connection_reports CASCADE;
DROP TABLE IF EXISTS business_connection_blocks CASCADE;
DROP TABLE IF EXISTS business_connections CASCADE;
DROP TABLE IF EXISTS business_profile_audit_logs CASCADE;
DROP TABLE IF EXISTS business_profiles CASCADE;
DROP TABLE IF EXISTS business_audit_logs CASCADE;
DROP TABLE IF EXISTS business_administrators CASCADE;
DROP TABLE IF EXISTS business_accounts CASCADE;
DROP TABLE IF EXISTS account_verification_codes CASCADE;
DROP TABLE IF EXISTS membership_audit_logs CASCADE;
DROP TABLE IF EXISTS membership_history CASCADE;
DROP TABLE IF EXISTS user_memberships CASCADE;
DROP TABLE IF EXISTS membership_features CASCADE;
DROP TABLE IF EXISTS membership_limits CASCADE;
DROP TABLE IF EXISTS membership_tiers CASCADE;
DROP TABLE IF EXISTS profile_contact_change_requests CASCADE;
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
  preferred_display_name VARCHAR(200),
  date_of_birth DATE,
  gender VARCHAR(50),
  nationality VARCHAR(100),
  country_of_residence VARCHAR(100),
  state_province VARCHAR(100),
  city VARCHAR(100),
  time_zone VARCHAR(100),
  alternative_phone VARCHAR(30),
  mailing_address TEXT,
  username VARCHAR(100) UNIQUE,
  profile_photo_path VARCHAR(255),
  profile_photo_mime_type VARCHAR(100),
  communication_preferences JSONB NOT NULL DEFAULT '{
    "emailNotifications": true,
    "smsNotifications": true,
    "pushNotifications": true,
    "marketingCommunications": false,
    "newsletterSubscription": false,
    "eventReminders": true,
    "procurementNotifications": true,
    "marketplaceUpdates": true
  }'::jsonb,
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
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
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

-- Account verification codes for initial signup verification.
CREATE TABLE account_verification_codes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  details JSONB
);

-- Contact change requests keep the existing verified value active until the
-- replacement address or mobile number is confirmed.
CREATE TABLE profile_contact_change_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_type VARCHAR(20) NOT NULL,
  current_value VARCHAR(255),
  pending_value VARCHAR(255) NOT NULL,
  verification_token VARCHAR(120) NOT NULL UNIQUE,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  details JSONB
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_account_verification_codes_user_id ON account_verification_codes(user_id);
CREATE INDEX idx_account_verification_codes_status ON account_verification_codes(status);
CREATE INDEX idx_account_verification_codes_expires_at ON account_verification_codes(expires_at);
CREATE INDEX idx_profile_contact_change_requests_user_id ON profile_contact_change_requests(user_id);
CREATE INDEX idx_profile_contact_change_requests_status ON profile_contact_change_requests(status);

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

-- ========================================
-- CHAPTER 10: BUSINESS ACCOUNT REGISTRATION
-- ========================================
CREATE TABLE business_accounts (
  id SERIAL PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(120) NOT NULL,
  country_of_registration VARCHAR(120) NOT NULL,
  business_address TEXT NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  industry_category VARCHAR(120) NOT NULL,
  registration_number VARCHAR(120),
  tax_identification_number VARCHAR(120),
  website VARCHAR(255),
  business_description TEXT,
  logo VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ownership_role VARCHAR(100) NOT NULL DEFAULT 'Business Owner',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verification_status VARCHAR(50) DEFAULT 'not_started',
  verification_notes TEXT,
  verified_at TIMESTAMP,
  rejected_reason TEXT,
  suspended_at TIMESTAMP,
  UNIQUE (business_name, country_of_registration)
);

CREATE TABLE business_administrators (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'Administrator',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  invited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  UNIQUE (business_id, user_id)
);

CREATE TABLE business_audit_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- CHAPTER 11: BUSINESS PROFILE MANAGEMENT
-- ========================================
CREATE TABLE business_profiles (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL UNIQUE REFERENCES business_accounts(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(120) NOT NULL,
  industry_category VARCHAR(120) NOT NULL,
  business_description TEXT,
  email_address VARCHAR(255),
  phone_number VARCHAR(50),
  website VARCHAR(255),
  physical_address TEXT NOT NULL,
  logo_path VARCHAR(255),
  cover_banner VARCHAR(255),
  visibility VARCHAR(30) NOT NULL DEFAULT 'public',
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  year_established INTEGER,
  number_of_employees INTEGER,
  operating_hours VARCHAR(200),
  service_areas JSONB DEFAULT '[]'::jsonb,
  social_links JSONB DEFAULT '{}'::jsonb,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE business_profile_audit_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_business_accounts_owner_id ON business_accounts(owner_id);
CREATE INDEX idx_business_accounts_status ON business_accounts(status);
CREATE INDEX idx_business_accounts_country ON business_accounts(country_of_registration);
CREATE INDEX idx_business_administrators_business_id ON business_administrators(business_id);
CREATE INDEX idx_business_administrators_user_id ON business_administrators(user_id);
CREATE INDEX idx_business_audit_logs_business_id ON business_audit_logs(business_id);
CREATE INDEX idx_business_audit_logs_event_type ON business_audit_logs(event_type);
CREATE INDEX idx_business_profiles_business_id ON business_profiles(business_id);
CREATE INDEX idx_business_profiles_visibility ON business_profiles(visibility);
CREATE INDEX idx_business_profile_audit_logs_business_id ON business_profile_audit_logs(business_id);
CREATE INDEX idx_business_profile_audit_logs_event_type ON business_profile_audit_logs(event_type);

ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS search_rank INTEGER NOT NULL DEFAULT 0;
ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS membership_level VARCHAR(60) NOT NULL DEFAULT 'Basic';
ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS state_region VARCHAR(120);

CREATE TABLE business_directory_search_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  keyword VARCHAR(255),
  filters JSONB,
  results_count INTEGER DEFAULT 0,
  clicked_business_id INTEGER REFERENCES business_accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_business_directory_search_logs_user_id ON business_directory_search_logs(user_id);
CREATE INDEX idx_business_directory_search_logs_keyword ON business_directory_search_logs(keyword);

CREATE TABLE business_connections (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(30) NOT NULL DEFAULT 'user',
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sender_id, receiver_id)
);

CREATE TABLE business_connection_blocks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, target_id)
);

CREATE TABLE business_connection_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL,
  report_type VARCHAR(60) NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_business_connections_sender_id ON business_connections(sender_id);
CREATE INDEX idx_business_connections_receiver_id ON business_connections(receiver_id);
CREATE INDEX idx_business_connections_status ON business_connections(status);
CREATE INDEX idx_business_connection_blocks_user_id ON business_connection_blocks(user_id);
CREATE INDEX idx_business_connection_reports_user_id ON business_connection_reports(user_id);

INSERT INTO business_accounts (
  business_name,
  business_type,
  country_of_registration,
  business_address,
  contact_email,
  contact_phone,
  industry_category,
  registration_number,
  tax_identification_number,
  website,
  business_description,
  logo,
  status,
  owner_id,
  ownership_role,
  verification_status,
  verification_notes,
  created_at,
  updated_at
)
SELECT
  'ACC Demo Holding',
  'Limited Liability Company (LLC)',
  'Nigeria',
  'Plot 18, Lekki Phase 1, Lagos, Nigeria',
  'hello@accdemo.com',
  '+2348000001000',
  'Trade Facilitation',
  'RC-2024-1001',
  'TIN-ACC-1001',
  'https://accdemo.com',
  'A sample ACC business profile used to demonstrate the business registration workflow.',
  NULL,
  'verified',
  u.id,
  'Business Owner',
  'approved',
  'Approved by the ACC verification team.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM users u
WHERE u.email = 'admin@acc.com'
ON CONFLICT (business_name, country_of_registration) DO NOTHING;

INSERT INTO business_audit_logs (
  business_id,
  user_id,
  event_type,
  outcome,
  details,
  created_at
)
SELECT ba.id, ba.owner_id, 'registration_started', 'started', '{"source":"seed"}'::jsonb, CURRENT_TIMESTAMP
FROM business_accounts ba
WHERE ba.business_name = 'ACC Demo Holding'
ON CONFLICT DO NOTHING;

-- ========================================
-- CHAPTER 15: EVENTS & BUSINESS ENGAGEMENTS
-- ========================================
CREATE TABLE IF NOT EXISTS event_records (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  organizer VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL DEFAULT 'physical',
  event_format VARCHAR(50) NOT NULL DEFAULT 'physical',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  location TEXT,
  visibility VARCHAR(30) NOT NULL DEFAULT 'public',
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  capacity INTEGER,
  ticket_type VARCHAR(50) NOT NULL DEFAULT 'free',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event_records(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_name VARCHAR(200),
  email VARCHAR(255),
  ticket_type VARCHAR(50) DEFAULT 'standard',
  payment_status VARCHAR(50) DEFAULT 'pending',
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_feedback (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES event_records(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comments TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_audit_logs (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES event_records(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_records_status ON event_records(status);
CREATE INDEX IF NOT EXISTS idx_event_records_event_type ON event_records(event_type);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_feedback_event_id ON event_feedback(event_id);

-- ========================================
-- CHAPTER 16: TRUST, RATINGS & REVIEW SYSTEM
-- ========================================
CREATE TABLE IF NOT EXISTS business_reviews (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  comments TEXT,
  categories JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'approved',
  response TEXT,
  response_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  response_at TIMESTAMP,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flag_reason TEXT,
  moderation_note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS review_reports (
  id SERIAL PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES business_reviews(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(80) NOT NULL,
  details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trust_audit_logs (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_reviews_business_id ON business_reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_business_reviews_user_id ON business_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);

-- ========================================
-- CHAPTER 17: MARKETPLACE LISTINGS
-- ========================================
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(120) NOT NULL,
  listing_type VARCHAR(40) NOT NULL DEFAULT 'product',
  pricing_model VARCHAR(40) NOT NULL DEFAULT 'fixed',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_price DECIMAL(10,2) DEFAULT 0,
  max_price DECIMAL(10,2) DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  inventory INTEGER DEFAULT 0,
  availability VARCHAR(50) DEFAULT 'in_stock',
  visibility VARCHAR(30) NOT NULL DEFAULT 'public',
  location VARCHAR(255),
  media JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_audit_logs (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_business_id ON marketplace_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);

-- ========================================
-- CHAPTER 18: ORDER MANAGEMENT
-- ========================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  listing_title VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50) DEFAULT 'card',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivery_method VARCHAR(80) DEFAULT 'standard',
  shipping_address TEXT,
  tracking_details TEXT,
  notes TEXT,
  cancelled_at TIMESTAMP,
  refunded_at TIMESTAMP,
  dispute_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_disputes (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_audit_logs (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_disputes_order_id ON order_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_audit_logs_order_id ON order_audit_logs(order_id);

-- ========================================
-- CHAPTER 21: LOGISTICS & DELIVERY MANAGEMENT
-- ========================================
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  shipment_reference VARCHAR(120) NOT NULL UNIQUE,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivery_method VARCHAR(80) NOT NULL DEFAULT 'standard',
  carrier VARCHAR(120) NOT NULL,
  tracking_number VARCHAR(120) NOT NULL UNIQUE,
  estimated_delivery_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivery_address TEXT,
  status_details TEXT,
  delivered_at TIMESTAMP,
  delivery_confirmed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistics_audit_logs (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS logistics_notifications (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  notification_type VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_logistics_audit_logs_shipment_id ON logistics_audit_logs(shipment_id);
CREATE INDEX IF NOT EXISTS idx_logistics_notifications_shipment_id ON logistics_notifications(shipment_id);

-- ========================================
-- CHAPTER 19: PAYMENT PROCESSING SYSTEM
-- ========================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  transaction_id VARCHAR(120) NOT NULL UNIQUE,
  payment_reference VARCHAR(120) NOT NULL UNIQUE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50) DEFAULT 'card',
  provider VARCHAR(50) NOT NULL DEFAULT 'paystack',
  status VARCHAR(50) NOT NULL DEFAULT 'initiated',
  refund_status VARCHAR(50) NOT NULL DEFAULT 'not_requested',
  gateway_response VARCHAR(50) DEFAULT 'pending',
  gateway_reference VARCHAR(120),
  initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  failure_reason TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_gateway_events (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  reference VARCHAR(120),
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  reason TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_buyer_id ON payments(buyer_id);
CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payment_audit_logs_payment_id ON payment_audit_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_events_payment_id ON payment_gateway_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_id ON payment_refunds(payment_id);

-- ========================================
-- CHAPTER 20: SUBSCRIPTION & BILLING SYSTEM
-- ========================================

-- Subscription plans extend membership tiers with billing-specific configuration.
CREATE TABLE IF NOT EXISTS subscription_plans (
  id SERIAL PRIMARY KEY,
  tier_id INTEGER NOT NULL UNIQUE REFERENCES membership_tiers(id) ON DELETE RESTRICT,
  plan_key VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  monthly_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
  quarterly_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (quarterly_price >= 0),
  yearly_price DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (yearly_price >= 0),
  listing_limit INTEGER,
  visibility_boost INTEGER NOT NULL DEFAULT 0,
  priority_support BOOLEAN NOT NULL DEFAULT FALSE,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One current subscription exists per subscriber; pending plans support scheduled downgrades.
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
  pending_plan_id INTEGER REFERENCES subscription_plans(id),
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'expired', 'cancelled', 'suspended')),
  current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP,
  payment_method VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Invoice records are immutable billing records linked to a subscription payment attempt.
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_number VARCHAR(80) NOT NULL UNIQUE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_date TIMESTAMP,
  due_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'failed', 'void')),
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Payment attempts connect recurring billing to the Chapter 19 payment vocabulary.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL DEFAULT 'paystack',
  payment_reference VARCHAR(120) NOT NULL UNIQUE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_method VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed')),
  failure_reason TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- In-app delivery record for activation, renewal, failure, and expiry notifications.
CREATE TABLE IF NOT EXISTS subscription_notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Subscription audit events provide the required lifecycle trail.
CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user_id ON subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_notifications_user_id ON subscription_notifications(user_id);

-- ========================================
-- CHAPTER 22: PROCUREMENT & B2B SOURCING
-- ========================================

-- Procurement requests remain separate from marketplace listings because they represent buyer-led sourcing events.
CREATE TABLE IF NOT EXISTS procurement_rfqs (
  id SERIAL PRIMARY KEY,
  rfq_reference VARCHAR(120) NOT NULL UNIQUE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(120) NOT NULL,
  quantity_required INTEGER NOT NULL CHECK (quantity_required > 0),
  unit_of_measurement VARCHAR(50) NOT NULL DEFAULT 'units',
  budget_amount DECIMAL(12, 2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  budget_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  delivery_location TEXT,
  delivery_date_required DATE,
  visibility VARCHAR(30) NOT NULL DEFAULT 'open',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Quotations link supplier offers to a single RFQ and preserve the evaluation decision.
CREATE TABLE IF NOT EXISTS procurement_quotations (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_reference VARCHAR(120) NOT NULL UNIQUE,
  quoted_price DECIMAL(12, 2) NOT NULL CHECK (quoted_price > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  delivery_timeframe VARCHAR(100),
  terms_conditions TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (rfq_id, supplier_id)
);

-- Awarded procurement orders provide explicit hand-off points to payment and logistics services.
CREATE TABLE IF NOT EXISTS procurement_orders (
  id SERIAL PRIMARY KEY,
  procurement_reference VARCHAR(120) NOT NULL UNIQUE,
  buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quotation_id INTEGER REFERENCES procurement_quotations(id) ON DELETE SET NULL,
  order_amount DECIMAL(12, 2) NOT NULL CHECK (order_amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  delivery_location TEXT,
  expected_delivery_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit records support transparency across request, bid, award, and closure events.
CREATE TABLE IF NOT EXISTS procurement_audit_logs (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
  quotation_id INTEGER REFERENCES procurement_quotations(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES procurement_orders(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for the buyer, supplier, status, and audit review paths.
CREATE INDEX IF NOT EXISTS idx_procurement_rfqs_buyer_id ON procurement_rfqs(buyer_id);
CREATE INDEX IF NOT EXISTS idx_procurement_rfqs_status ON procurement_rfqs(status);
CREATE INDEX IF NOT EXISTS idx_procurement_quotations_rfq_id ON procurement_quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_procurement_quotations_supplier_id ON procurement_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_buyer_id ON procurement_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_procurement_orders_supplier_id ON procurement_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_audit_logs_user_id ON procurement_audit_logs(user_id);

-- ========================================
-- CHAPTER 23: CONTRACT MANAGEMENT SYSTEM
-- ========================================

-- Store contract parties, commercial terms, lifecycle state, and Chapter 22/18/19 references.
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  contract_reference VARCHAR(120) NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  scope_of_work TEXT,
  payment_terms TEXT,
  delivery_obligations TEXT,
  penalties_conditions TEXT,
  template_type VARCHAR(50) NOT NULL DEFAULT 'procurement',
  content TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  procurement_order_id INTEGER REFERENCES procurement_orders(id) ON DELETE SET NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  terminated_at TIMESTAMP
);

-- Keep signer identity, version, timestamp, and signature evidence auditable.
CREATE TABLE IF NOT EXISTS contract_signatures (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signature_hash VARCHAR(128),
  signature_version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Store metadata for privately managed generated documents and supporting files.
CREATE TABLE IF NOT EXISTS contract_documents (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  storage_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL DEFAULT 'attachment',
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve every contract mutation for legal and operational review.
CREATE TABLE IF NOT EXISTS contract_audit_logs (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for authorized party lookup, lifecycle dashboards, documents, and audit review.
CREATE INDEX IF NOT EXISTS idx_contracts_creator_id ON contracts(creator_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_procurement_order_id ON contracts(procurement_order_id);
CREATE INDEX IF NOT EXISTS idx_contracts_order_id ON contracts(order_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract_id ON contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_audit_logs_contract_id ON contract_audit_logs(contract_id);

-- ========================================
-- CHAPTER 24: DISPUTE RESOLUTION SYSTEM
-- ========================================

-- Store cases linked to existing orders or contracts and preserve the participant set.
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  dispute_reference VARCHAR(120) NOT NULL UNIQUE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  raised_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  moderator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_type VARCHAR(50),
  resolution_details TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP
);

-- Keep evidence private while retaining integrity metadata and submitter accountability.
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id SERIAL PRIMARY KEY,
  dispute_id INTEGER NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  storage_name VARCHAR(255),
  checksum VARCHAR(128),
  content TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve every review, mediation, resolution, escalation, and closure decision.
CREATE TABLE IF NOT EXISTS dispute_audit_logs (
  id SERIAL PRIMARY KEY,
  dispute_id INTEGER REFERENCES disputes(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for case history, moderation queues, evidence review, and audit access.
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_contract_id ON disputes(contract_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_moderator_id ON disputes(moderator_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_audit_logs_dispute_id ON dispute_audit_logs(dispute_id);

-- ========================================
-- CHAPTER 25: NOTIFICATION & ALERT SYSTEM
-- ========================================

-- Store generated recipient alerts independently from channel delivery attempts.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  priority VARCHAR(30) NOT NULL DEFAULT 'normal',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(500) NOT NULL DEFAULT '/notifications',
  status VARCHAR(30) NOT NULL DEFAULT 'unread',
  dedupe_key VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

-- Track each in-app, email, SMS, or push attempt for delivery reliability and retries.
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (notification_id, channel)
);

-- Persist per-user channel, category, frequency, and spam-control preferences.
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  channels JSONB NOT NULL DEFAULT '["in_app", "email", "push"]'::jsonb,
  notification_types JSONB NOT NULL DEFAULT '["system", "transaction", "social", "event"]'::jsonb,
  frequency VARCHAR(30) NOT NULL DEFAULT 'immediate',
  max_per_hour INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Record generation, sending, reading, failure, retry, and preference events.
CREATE TABLE IF NOT EXISTS notification_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT REFERENCES notifications(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  channel VARCHAR(30),
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_queue ON notification_deliveries(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_notification_audit_logs_user ON notification_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_user_id ON subscription_audit_logs(user_id);

-- Seed the four Chapter 20 plans and their feature-access metadata.
INSERT INTO membership_tiers (tier_name, tier_level, description, pricing, billing_cycle)
VALUES ('Free', 0, 'A free starting plan for every ACC member.', 0, 'monthly')
ON CONFLICT (tier_name) DO NOTHING;

INSERT INTO subscription_plans (tier_id, plan_key, display_name, description, monthly_price, quarterly_price, yearly_price, listing_limit, visibility_boost, priority_support, features)
SELECT id, 'free', 'Free', 'A practical starting point for exploring ACC.', 0, 0, 0, 1, 0, FALSE, '["ACC directory profile", "Community access"]'::jsonb FROM membership_tiers WHERE tier_name = 'Free'
ON CONFLICT (plan_key) DO NOTHING;

INSERT INTO subscription_plans (tier_id, plan_key, display_name, description, monthly_price, quarterly_price, yearly_price, listing_limit, visibility_boost, priority_support, features)
SELECT id, 'basic', 'Basic', 'Essential tools for an active business presence.', 19, 51, 190, 3, 1, FALSE, '["ACC directory profile", "Business listings", "Standard discovery"]'::jsonb FROM membership_tiers WHERE tier_name = 'Basic'
ON CONFLICT (plan_key) DO NOTHING;

INSERT INTO subscription_plans (tier_id, plan_key, display_name, description, monthly_price, quarterly_price, yearly_price, listing_limit, visibility_boost, priority_support, features)
SELECT id, 'premium', 'Premium', 'More reach, more listings, and faster support.', 59, 159, 590, 10, 3, TRUE, '["Everything in Basic", "Premium tools", "Visibility boost", "Priority support"]'::jsonb FROM membership_tiers WHERE tier_name = 'Premium'
ON CONFLICT (plan_key) DO NOTHING;

INSERT INTO subscription_plans (tier_id, plan_key, display_name, description, monthly_price, quarterly_price, yearly_price, listing_limit, visibility_boost, priority_support, features)
SELECT id, 'enterprise', 'Enterprise', 'A full growth suite for established organizations.', 149, 402, 1490, NULL, 5, TRUE, '["Everything in Premium", "Unlimited listings", "Dedicated support", "Enterprise visibility"]'::jsonb FROM membership_tiers WHERE tier_name = 'Enterprise'
ON CONFLICT (plan_key) DO NOTHING;
