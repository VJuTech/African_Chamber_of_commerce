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
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS shopping_carts CASCADE;
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
DROP TABLE IF EXISTS log_monitor_alerts CASCADE;
DROP TABLE IF EXISTS error_logs CASCADE;
DROP TABLE IF EXISTS application_logs CASCADE;
DROP TABLE IF EXISTS log_retention_policies CASCADE;
DROP TABLE IF EXISTS qa_reports CASCADE;
DROP TABLE IF EXISTS qa_bugs CASCADE;
DROP TABLE IF EXISTS qa_test_runs CASCADE;
DROP TABLE IF EXISTS qa_test_cases CASCADE;
DROP TABLE IF EXISTS qa_test_plans CASCADE;
DROP TABLE IF EXISTS release_audit_logs CASCADE;
DROP TABLE IF EXISTS release_monitoring CASCADE;
DROP TABLE IF EXISTS release_compatibility CASCADE;
DROP TABLE IF EXISTS release_notes CASCADE;
DROP TABLE IF EXISTS release_plans CASCADE;
DROP TABLE IF EXISTS release_versions CASCADE;
DROP TABLE IF EXISTS notification_audit_logs CASCADE;
DROP TABLE IF EXISTS notification_deliveries CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS compliance_audit_logs CASCADE;
DROP TABLE IF EXISTS compliance_regulatory_reports CASCADE;
DROP TABLE IF EXISTS compliance_cross_border_rules CASCADE;
DROP TABLE IF EXISTS compliance_aml_restrictions CASCADE;
DROP TABLE IF EXISTS compliance_transaction_flags CASCADE;
DROP TABLE IF EXISTS compliance_business_cases CASCADE;
DROP TABLE IF EXISTS compliance_kyc_documents CASCADE;
DROP TABLE IF EXISTS compliance_kyc_cases CASCADE;
DROP TABLE IF EXISTS user_consent_records CASCADE;
DROP TABLE IF EXISTS compliance_policy_versions CASCADE;
DROP TABLE IF EXISTS compliance_policies CASCADE;
DROP TABLE IF EXISTS data_management_audit_logs CASCADE;
DROP TABLE IF EXISTS data_recovery_requests CASCADE;
DROP TABLE IF EXISTS data_backup_schedules CASCADE;
DROP TABLE IF EXISTS data_versions CASCADE;
DROP TABLE IF EXISTS data_archives CASCADE;
DROP TABLE IF EXISTS data_integrity_checks CASCADE;
DROP TABLE IF EXISTS data_catalog_resources CASCADE;
DROP TABLE IF EXISTS performance_optimization_actions CASCADE;
DROP TABLE IF EXISTS performance_peak_load_checks CASCADE;
DROP TABLE IF EXISTS performance_cache_entries CASCADE;
DROP TABLE IF EXISTS performance_capacity_profiles CASCADE;
DROP TABLE IF EXISTS performance_request_metrics CASCADE;
DROP TABLE IF EXISTS messaging_notifications CASCADE;
DROP TABLE IF EXISTS messaging_audit_logs CASCADE;
DROP TABLE IF EXISTS message_deletions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS messaging_blocks CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS requirement_compliance_controls CASCADE;
DROP TABLE IF EXISTS requirement_changes CASCADE;
DROP TABLE IF EXISTS requirement_validation_rules CASCADE;
DROP TABLE IF EXISTS requirement_traceability CASCADE;
DROP TABLE IF EXISTS requirements CASCADE;
DROP TABLE IF EXISTS platform_integration_events CASCADE;
DROP TABLE IF EXISTS platform_integrations CASCADE;
DROP TABLE IF EXISTS admin_moderation_reports CASCADE;
DROP TABLE IF EXISTS admin_audit_logs CASCADE;
DROP TABLE IF EXISTS system_feature_flags CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS analytics_report_audits CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS security_audit_logs CASCADE;
DROP TABLE IF EXISTS security_alerts CASCADE;
DROP TABLE IF EXISTS ai_audit_logs CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;
DROP TABLE IF EXISTS ai_alerts CASCADE;
DROP TABLE IF EXISTS ai_predictions CASCADE;
DROP TABLE IF EXISTS ai_fraud_cases CASCADE;
DROP TABLE IF EXISTS ai_search_queries CASCADE;
DROP TABLE IF EXISTS ai_recommendations CASCADE;
DROP TABLE IF EXISTS ai_interaction_events CASCADE;
DROP TABLE IF EXISTS ai_user_profiles CASCADE;
DROP TABLE IF EXISTS partnership_audit_logs CASCADE;
DROP TABLE IF EXISTS partnership_monitoring CASCADE;
DROP TABLE IF EXISTS partnership_exchanges CASCADE;
DROP TABLE IF EXISTS partnership_verifications CASCADE;
DROP TABLE IF EXISTS partnership_access_grants CASCADE;
DROP TABLE IF EXISTS partnership_credentials CASCADE;
DROP TABLE IF EXISTS partnership_integrations CASCADE;
DROP TABLE IF EXISTS partnership_partners CASCADE;
DROP TABLE IF EXISTS security_mfa_challenges CASCADE;
DROP TABLE IF EXISTS security_mfa_methods CASCADE;
DROP TABLE IF EXISTS security_login_attempts CASCADE;
DROP TABLE IF EXISTS security_policies CASCADE;
DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
DROP TABLE IF EXISTS api_rate_limit_windows CASCADE;
DROP TABLE IF EXISTS api_request_logs CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS api_clients CASCADE;
DROP TABLE IF EXISTS deployment_audit_logs CASCADE;
DROP TABLE IF EXISTS deployment_backups CASCADE;
DROP TABLE IF EXISTS deployment_alerts CASCADE;
DROP TABLE IF EXISTS deployment_metrics CASCADE;
DROP TABLE IF EXISTS deployment_releases CASCADE;
DROP TABLE IF EXISTS deployment_environments CASCADE;
DROP TABLE IF EXISTS onboarding_migration_audit_logs CASCADE;
DROP TABLE IF EXISTS onboarding_assistance CASCADE;
DROP TABLE IF EXISTS migration_api_sources CASCADE;
DROP TABLE IF EXISTS migration_rows CASCADE;
DROP TABLE IF EXISTS migration_jobs CASCADE;
DROP TABLE IF EXISTS onboarding_profiles CASCADE;
DROP TABLE IF EXISTS assistant_support_messages CASCADE;
DROP TABLE IF EXISTS assistant_support_requests CASCADE;
DROP TABLE IF EXISTS user_ux_preferences CASCADE;
DROP TABLE IF EXISTS localization_audit_logs CASCADE;
DROP TABLE IF EXISTS user_localization_preferences CASCADE;
DROP TABLE IF EXISTS localization_exchange_rates CASCADE;
DROP TABLE IF EXISTS localization_translations CASCADE;
DROP TABLE IF EXISTS localization_currencies CASCADE;
DROP TABLE IF EXISTS localization_languages CASCADE;

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

-- CHAPTER 31: durable user experience preferences and onboarding state.
CREATE TABLE user_ux_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_step INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_step >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CHAPTER 33: localization and multi-language support.
CREATE TABLE localization_languages (
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
CREATE TABLE localization_currencies (
  id SERIAL PRIMARY KEY,
  code VARCHAR(3) UNIQUE NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  symbol VARCHAR(12) NOT NULL,
  decimal_places SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_places BETWEEN 0 AND 6),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE localization_translations (
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
CREATE TABLE localization_exchange_rates (
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
CREATE TABLE user_localization_preferences (
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
CREATE TABLE localization_audit_logs (
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
INSERT INTO localization_languages (code, display_name, native_name, text_direction, is_default) VALUES
  ('en', 'English', 'English', 'ltr', TRUE), ('fr', 'French', 'Francais', 'ltr', FALSE), ('ar', 'Arabic', 'العربية', 'rtl', FALSE), ('pt', 'Portuguese', 'Portugues', 'ltr', FALSE);
INSERT INTO localization_currencies (code, display_name, symbol, decimal_places) VALUES
  ('NGN', 'Nigerian naira', '₦', 2), ('GHS', 'Ghanaian cedi', 'GH₵', 2), ('ZAR', 'South African rand', 'R', 2), ('USD', 'US dollar', '$', 2);
INSERT INTO localization_translations (locale, translation_key, translation_value) VALUES
  ('en', 'navigation.settings', 'Settings'), ('en', 'navigation.localization', 'Language and region'),
  ('en', 'localization.title', 'Language and region'), ('en', 'localization.description', 'Choose the language, currency, region, and time format used across ACC.'),
  ('en', 'localization.save', 'Save preferences'), ('en', 'notification.orderPlaced.title', 'Order placed'),
  ('en', 'notification.orderPlaced.message', 'Order #{orderId} has been placed.'), ('en', 'notification.paymentCompleted.title', 'Payment completed'),
  ('en', 'notification.paymentCompleted.message', 'Payment for order #{orderId} was completed.'), ('en', 'notification.newMessage.title', 'New message'),
  ('en', 'notification.newMessage.message', '{text}'), ('en', 'notification.eventRegistration.title', 'Event registration confirmed'),
  ('en', 'notification.eventRegistration.message', '{title} registration was recorded.'), ('en', 'notification.eventReminder.title', 'Event reminder'),
  ('en', 'notification.eventReminder.message', '{title} is coming up.'), ('en', 'notification.generic.title', 'ACC update'),
  ('en', 'notification.generic.message', 'There is a new {event} update.');
INSERT INTO localization_exchange_rates (base_currency, target_currency, rate, source) VALUES
  ('NGN', 'NGN', 1, 'system'), ('GHS', 'GHS', 1, 'system'), ('ZAR', 'ZAR', 1, 'system'), ('USD', 'USD', 1, 'system');

-- ========================================
-- CHAPTER 5: REQUIREMENTS & TRACEABILITY
-- ========================================

CREATE TABLE requirements (
  id SERIAL PRIMARY KEY,
  requirement_id VARCHAR(40) NOT NULL UNIQUE CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$'),
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  actor VARCHAR(200) NOT NULL,
  preconditions TEXT NOT NULL,
  postconditions TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  category VARCHAR(30) NOT NULL CHECK (category IN ('functional', 'non_functional', 'security', 'performance')),
  dependencies TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requirement_traceability (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL UNIQUE REFERENCES requirements(id) ON DELETE CASCADE,
  user_story TEXT NOT NULL,
  ui_reference VARCHAR(255) NOT NULL,
  api_reference VARCHAR(255) NOT NULL,
  database_objects TEXT[] NOT NULL DEFAULT '{}',
  test_case VARCHAR(255) NOT NULL,
  sprint VARCHAR(100) NOT NULL,
  release VARCHAR(100) NOT NULL,
  coverage_status VARCHAR(30) NOT NULL DEFAULT 'partial' CHECK (coverage_status IN ('complete', 'partial', 'missing', 'blocked')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requirement_validation_rules (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  field_name VARCHAR(120) NOT NULL,
  rule_key VARCHAR(120) NOT NULL,
  rule_description TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (requirement_id, field_name, rule_key)
);

CREATE TABLE requirement_changes (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('created', 'updated', 'deprecated', 'restored')),
  change_summary TEXT NOT NULL,
  previous_snapshot JSONB,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (requirement_id, version)
);

CREATE TABLE requirement_compliance_controls (
  id SERIAL PRIMARY KEY,
  requirement_id INTEGER NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  framework VARCHAR(120) NOT NULL,
  control_key VARCHAR(120) NOT NULL,
  control_description TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'implemented', 'review_required', 'not_applicable')),
  evidence_reference VARCHAR(255),
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (requirement_id, framework, control_key)
);

CREATE INDEX idx_requirements_category_status ON requirements(category, status);
CREATE INDEX idx_requirement_traceability_coverage ON requirement_traceability(coverage_status);
CREATE INDEX idx_requirement_validation_rules_requirement ON requirement_validation_rules(requirement_id);
CREATE INDEX idx_requirement_changes_requirement ON requirement_changes(requirement_id, version DESC);
CREATE INDEX idx_requirement_compliance_requirement ON requirement_compliance_controls(requirement_id);

INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies)
VALUES
  ('FR-AUTH-001', 'Account registration and verification', 'A user can submit valid registration details, verify their account, and activate access.', 'Guest user', 'Registration form is available and required fields are present.', 'A verified user account and audit event exist in PostgreSQL.', 'critical', 'functional', ARRAY['users', 'account_verification_codes']),
  ('FR-BIZ-001', 'Business registration workflow', 'A verified user can create, save, submit, and track a business registration.', 'Verified user', 'User is authenticated and has completed account verification.', 'Business record, ownership, status, and audit history are persisted.', 'high', 'functional', ARRAY['business_accounts', 'business_audit_logs']),
  ('FR-MKT-001', 'Marketplace order journey', 'A buyer can browse a listing, add it to a persistent cart, check out, and initiate payment.', 'Verified buyer', 'Listing is public, active, and available.', 'Cart, order, payment, and audit records are created in PostgreSQL.', 'critical', 'functional', ARRAY['marketplace_listings', 'shopping_carts', 'cart_items', 'orders', 'payments']),
  ('FR-PROC-001', 'Procurement tender lifecycle', 'A buyer can publish a tender, receive bids, evaluate them, and award a procurement order.', 'Verified buyer and supplier', 'Buyer and supplier accounts are verified.', 'RFQ, quotation, award, order, notification, and audit records are persisted.', 'high', 'functional', ARRAY['procurement_rfqs', 'procurement_quotations', 'procurement_orders']),
  ('FR-MSG-001', 'Messaging delivery lifecycle', 'Users can send, deliver, read, and respond to messages in an authorized conversation.', 'Authenticated user', 'Participants have access to the conversation and are not blocked.', 'Message status and notification/audit records reflect delivery and reading.', 'high', 'functional', ARRAY['conversations', 'messages', 'messaging_notifications']),
  ('FR-SEC-001', 'Access control enforcement', 'Protected actions require an authenticated user with the required role and permission.', 'Platform administrator', 'RBAC schema and session access context are available.', 'Unauthorized actions are denied and critical role changes are audited.', 'critical', 'security', ARRAY['roles', 'permissions', 'user_roles', 'audit_logs']),
  ('FR-OPS-001', 'Validation and error recovery', 'Invalid input is returned to the user, unexpected failures are logged, and retryable payment/notification operations can retry.', 'Any platform user', 'A workflow action has been submitted.', 'Validation feedback, durable error records, and retry audit events exist.', 'high', 'non_functional', ARRAY['audit_logs', 'payment_gateway_events', 'notification_deliveries'])
ON CONFLICT (requirement_id) DO NOTHING;

-- ========================================
-- CHAPTER 37: AVAILABILITY & RELIABILITY
-- ========================================
CREATE TABLE IF NOT EXISTS availability_services (
  id BIGSERIAL PRIMARY KEY,
  service_key VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  criticality VARCHAR(20) NOT NULL DEFAULT 'critical' CHECK (criticality IN ('critical','non_critical')),
  health_url VARCHAR(500),
  expected_response_ms INTEGER NOT NULL DEFAULT 2000 CHECK (expected_response_ms > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  degraded_mode BOOLEAN NOT NULL DEFAULT FALSE,
  backup_service_key VARCHAR(120),
  last_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('healthy','degraded','failed','unknown')),
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability_health_checks (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES availability_services(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy','degraded','failed')),
  response_time_ms INTEGER,
  http_status INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability_redundancy_components (
  id BIGSERIAL PRIMARY KEY,
  component_key VARCHAR(120) NOT NULL UNIQUE,
  component_type VARCHAR(40) NOT NULL CHECK (component_type IN ('application','database','backup','network','service')),
  primary_reference VARCHAR(255) NOT NULL,
  secondary_reference VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','degraded','unavailable','testing')),
  failover_mode VARCHAR(30) NOT NULL DEFAULT 'automatic' CHECK (failover_mode IN ('automatic','manual','none')),
  last_verified_at TIMESTAMPTZ,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability_incidents (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning','critical')),
  incident_type VARCHAR(40) NOT NULL CHECK (incident_type IN ('downtime','degraded','health_check_failure','database_failure')),
  title VARCHAR(200) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS availability_failover_events (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
  from_reference VARCHAR(255),
  to_reference VARCHAR(255),
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('automatic','manual','test')),
  outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('initiated','completed','failed')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability_recovery_actions (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT REFERENCES availability_incidents(id) ON DELETE SET NULL,
  action_type VARCHAR(40) NOT NULL CHECK (action_type IN ('retry','restart','degrade','restore','failover')),
  status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('requested','in_progress','completed','failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  notes TEXT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS availability_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(80) NOT NULL,
  incident_id BIGINT REFERENCES availability_incidents(id) ON DELETE SET NULL,
  service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
  outcome VARCHAR(30) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS availability_checks_service_idx ON availability_health_checks(service_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS availability_incidents_status_idx ON availability_incidents(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS availability_audit_created_idx ON availability_audit_logs(created_at DESC);
INSERT INTO availability_services (service_key, display_name, criticality, health_url, backup_service_key) VALUES
  ('postgresql', 'PostgreSQL database', 'critical', '/healthz', NULL),
  ('web_application', 'ACC web application', 'critical', '/healthz', 'web_application_backup'),
  ('notifications', 'Notification delivery', 'non_critical', '/healthz', NULL),
  ('assistant', 'ACC Assistance', 'non_critical', '/healthz', NULL)
ON CONFLICT (service_key) DO NOTHING;
INSERT INTO availability_redundancy_components (component_key, component_type, primary_reference, secondary_reference, status, failover_mode, notes) VALUES
  ('application_instances', 'application', 'Configured production instance pool', 'Configured standby instance pool', 'ready', 'automatic', 'Provider/load-balancer failover must be enabled in the deployment target.'),
  ('web_application_backup', 'application', 'Primary ACC web application', 'Configured standby ACC web application', 'ready', 'automatic', 'Standby application target used by automatic availability failover.'),
  ('postgresql_backup', 'backup', 'Primary PostgreSQL database', 'Encrypted verified backup', 'ready', 'manual', 'Database promotion requires the managed PostgreSQL provider or operator runbook.'),
  ('notification_delivery', 'service', 'In-app notification queue', 'Email/SMS provider queue', 'ready', 'automatic', 'Non-critical channels may degrade while in-app alerts continue.')
ON CONFLICT (component_key) DO NOTHING;
INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES
  ('ACC-FRS-AVAIL-001','High availability','The system shall maintain at least 99.9% uptime with availability evidence persisted for review.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_services','availability_health_checks']),
  ('ACC-FRS-AVAIL-002','Fault tolerance','The platform shall continue functioning when a monitored component fails.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_incidents','availability_recovery_actions']),
  ('ACC-FRS-AVAIL-003','Redundant infrastructure','The platform shall record redundant services and backup infrastructure supporting continuity.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_redundancy_components']),
  ('ACC-FRS-AVAIL-004','Automatic failover','The platform shall detect an unavailable service and record an automatic failover action.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_failover_events']),
  ('ACC-FRS-AVAIL-005','System health monitoring','The platform shall continuously persist service health and response-time checks.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_health_checks']),
  ('ACC-FRS-AVAIL-006','Error recovery','The platform shall record retry and recovery actions for failed services.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','high','non_functional',ARRAY['availability_recovery_actions']),
  ('ACC-FRS-AVAIL-007','Graceful degradation','The platform shall identify non-critical features that can be degraded while core services remain available.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','high','non_functional',ARRAY['availability_services']),
  ('ACC-FRS-AVAIL-008','Backup systems availability','The platform shall track whether backup systems are ready and when they were last verified.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_redundancy_components','deployment_backups']),
  ('ACC-FRS-AVAIL-009','Incident alerting','The platform shall create immediate administrator alerts for availability incidents.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','critical','non_functional',ARRAY['availability_incidents','deployment_alerts']),
  ('ACC-FRS-AVAIL-010','Availability audit logging','Downtime, failover, and recovery actions shall be recorded in an auditable PostgreSQL log.','Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.','high','non_functional',ARRAY['availability_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT id, 'As an operations administrator, I want availability controls so ACC remains dependable.', 'views/admin/availability.ejs', 'GET /admin/availability and POST /admin/availability/health-checks', ARRAY['availability_services','availability_health_checks','availability_incidents','availability_audit_logs'], 'tests/chapter37-availability.test.js', 'Reliability', '1.0', 'complete', 'Chapter 37 availability controls are PostgreSQL-backed.'
FROM requirements WHERE requirement_id LIKE 'ACC-FRS-AVAIL-%'
ON CONFLICT (requirement_id) DO NOTHING;

-- ========================================
-- CHAPTER 38: MAINTENANCE & SUPPORT
-- ========================================
CREATE TABLE IF NOT EXISTS support_slas (id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE, priority VARCHAR(20) NOT NULL CHECK (priority IN ('low','medium','high','critical')), response_minutes INTEGER NOT NULL CHECK (response_minutes > 0), resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes >= response_minutes), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_tickets (id BIGSERIAL PRIMARY KEY, ticket_number VARCHAR(30) NOT NULL UNIQUE, reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, category VARCHAR(30) NOT NULL CHECK (category IN ('bug','question','incident','feature','maintenance','other')), maintenance_type VARCHAR(20) CHECK (maintenance_type IN ('corrective','preventive','adaptive','perfective')), priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')), status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')), sla_id BIGINT REFERENCES support_slas(id) ON DELETE SET NULL, first_responded_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_ticket_comments (id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL, internal BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_ticket_attachments (id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE, uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, original_name VARCHAR(255) NOT NULL, storage_path TEXT NOT NULL, mime_type VARCHAR(120) NOT NULL, file_size INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS maintenance_windows (id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT, maintenance_type VARCHAR(20) NOT NULL CHECK (maintenance_type IN ('corrective','preventive','adaptive','perfective')), starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at), status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')), notify_users BOOLEAN NOT NULL DEFAULT TRUE, created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS maintenance_logs (id BIGSERIAL PRIMARY KEY, maintenance_window_id BIGINT REFERENCES maintenance_windows(id) ON DELETE SET NULL, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('update','fix','system_change','window_created','window_completed')), summary TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS knowledge_base_articles (id BIGSERIAL PRIMARY KEY, slug VARCHAR(180) NOT NULL UNIQUE, title VARCHAR(220) NOT NULL, article_type VARCHAR(20) NOT NULL CHECK (article_type IN ('faq','tutorial','guide')), summary TEXT NOT NULL, body TEXT NOT NULL, published BOOLEAN NOT NULL DEFAULT TRUE, author_id INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS support_improvements (id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')), source_ticket_id BIGINT REFERENCES support_tickets(id) ON DELETE SET NULL, owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS support_comments_ticket_idx ON support_ticket_comments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS maintenance_windows_dates_idx ON maintenance_windows(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS maintenance_logs_created_idx ON maintenance_logs(created_at DESC);
INSERT INTO support_slas (name, priority, response_minutes, resolution_minutes) VALUES ('Critical support','critical',30,240),('High support','high',120,1440),('Standard support','medium',480,4320),('Low support','low',1440,10080) ON CONFLICT (name) DO NOTHING;
INSERT INTO knowledge_base_articles (slug, title, article_type, summary, body, published) VALUES
  ('getting-started','Getting started with ACC','guide','Find your way around the ACC workspace and business tools.','Sign in, complete your profile, then use the workspace navigation to discover directory, networking, marketplace, events, and procurement services.',TRUE),
  ('reporting-an-issue','How to report an issue','tutorial','Learn what information helps the support team respond quickly.','Include the page, steps to reproduce, expected behavior, observed behavior, and a screenshot when available. Choose the priority that best describes the business impact.',TRUE),
  ('account-security','Account security FAQ','faq','Answers to common account and access questions.','Use the account recovery flow for forgotten credentials and contact ACC support when you see activity you do not recognize.',TRUE)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-SUP-001','Issue reporting system','Users can report issues with screenshots attached.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','critical','functional',ARRAY['support_tickets','support_ticket_attachments']),
('ACC-FRS-SUP-002','Ticket management system','Support tickets are created and tracked through open, in-progress, and resolved states.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','critical','functional',ARRAY['support_tickets']),
('ACC-FRS-SUP-003','Support dashboard','Support teams can review ticket overview and priority levels.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','high','functional',ARRAY['support_tickets','support_slas']),
('ACC-FRS-SUP-004','User notifications for support','Users receive notifications when support tickets are received or resolved.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','high','functional',ARRAY['support_tickets','notifications']),
('ACC-FRS-SUP-005','SLA management','Response and resolution targets are monitored for support tickets.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','high','functional',ARRAY['support_slas','support_tickets']),
('ACC-FRS-SUP-006','System maintenance scheduling','Authorized operators can schedule maintenance windows and notify users.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','high','functional',ARRAY['maintenance_windows']),
('ACC-FRS-SUP-007','Bug tracking system','Internal bugs and issues are documented and resolved.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','critical','functional',ARRAY['support_tickets','support_ticket_comments']),
('ACC-FRS-SUP-008','Knowledge base and help center','Users can find FAQs, tutorials, and guides.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','high','functional',ARRAY['knowledge_base_articles']),
('ACC-FRS-SUP-009','Maintenance logging','Updates, fixes, and system changes are logged.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','medium','functional',ARRAY['maintenance_logs']),
('ACC-FRS-SUP-010','Continuous improvement tracking','Platform improvements are documented over time.','ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.','medium','functional',ARRAY['support_improvements'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As an ACC user, I want maintenance and support controls so platform support is dependable.','views/support/help-center.ejs and views/admin/support.ejs','POST /support/tickets and GET /admin/support',ARRAY['support_tickets','support_slas','maintenance_windows','maintenance_logs','knowledge_base_articles','support_improvements'],'tests/chapter38-support.test.js','Maintenance and Support','1.0','complete','Chapter 38 support controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-SUP-%' ON CONFLICT (requirement_id) DO NOTHING;

-- ========================================
-- CHAPTER 39: LOGGING & ERROR HANDLING
-- ========================================
CREATE TABLE IF NOT EXISTS application_logs (id BIGSERIAL PRIMARY KEY, event_type VARCHAR(120) NOT NULL, severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical','warning','info')), source VARCHAR(80) NOT NULL DEFAULT 'application', user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, request_id VARCHAR(120), method VARCHAR(12), path VARCHAR(500), outcome VARCHAR(30) NOT NULL DEFAULT 'success', message TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, previous_hash VARCHAR(64), record_hash VARCHAR(64) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS error_logs (id BIGSERIAL PRIMARY KEY, application_log_id BIGINT REFERENCES application_logs(id) ON DELETE SET NULL, error_name VARCHAR(160), error_code VARCHAR(80), message TEXT NOT NULL, stack_trace TEXT, severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')), recoverable BOOLEAN NOT NULL DEFAULT FALSE, recovery_action VARCHAR(120), status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS log_retention_policies (id BIGSERIAL PRIMARY KEY, log_type VARCHAR(40) NOT NULL UNIQUE CHECK (log_type IN ('application','error','security','audit')), retention_days INTEGER NOT NULL CHECK (retention_days > 0), active BOOLEAN NOT NULL DEFAULT TRUE, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS log_monitor_alerts (id BIGSERIAL PRIMARY KEY, alert_type VARCHAR(80) NOT NULL, severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')), message TEXT NOT NULL, signature VARCHAR(180), occurrence_count INTEGER NOT NULL DEFAULT 1, status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')), first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (alert_type, signature, status));
CREATE INDEX IF NOT EXISTS application_logs_created_idx ON application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS application_logs_severity_idx ON application_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_status_idx ON error_logs(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS log_monitor_alerts_status_idx ON log_monitor_alerts(status, last_seen_at DESC);
INSERT INTO log_retention_policies (log_type, retention_days) VALUES ('application',365),('error',730),('security',1095),('audit',2555) ON CONFLICT (log_type) DO NOTHING;
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-LOG-001','Event logging','Critical system events are recorded accurately.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','non_functional',ARRAY['application_logs']),
('ACC-FRS-LOG-002','Error logging','Application errors are captured with diagnostic details.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','non_functional',ARRAY['error_logs']),
('ACC-FRS-LOG-003','Log storage','Logs are centralized and securely accessible.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','non_functional',ARRAY['application_logs','error_logs']),
('ACC-FRS-LOG-004','Error classification','Errors are categorized as critical, warning, or info.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','high','non_functional',ARRAY['error_logs']),
('ACC-FRS-LOG-005','User-friendly error messages','Users receive understandable error responses.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','non_functional',ARRAY['error_logs']),
('ACC-FRS-LOG-006','Error recovery mechanisms','Retry and fail-safe recovery actions are recorded.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','high','non_functional',ARRAY['error_logs','application_logs']),
('ACC-FRS-LOG-007','Log monitoring','Anomalies in logs are detected and surfaced.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','non_functional',ARRAY['log_monitor_alerts']),
('ACC-FRS-LOG-008','Log retention policy','Log retention periods are defined and reviewable.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','medium','non_functional',ARRAY['log_retention_policies']),
('ACC-FRS-LOG-009','Secure logging','Logs are protected against unauthorized modification and access.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','security',ARRAY['application_logs','admin_audit_logs']),
('ACC-FRS-LOG-010','Logging audit trail','Activities can be traced through durable log records.','Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.','critical','security',ARRAY['application_logs','audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As a platform operator, I want logging and error controls so ACC remains diagnosable and accountable.','views/admin/logging.ejs and error responses','GET /admin/logging and global error handler',ARRAY['application_logs','error_logs','log_retention_policies','log_monitor_alerts'],'tests/chapter39-logging.test.js','Diagnostics','1.0','complete','Chapter 39 logging controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-LOG-%' ON CONFLICT (requirement_id) DO NOTHING;

-- ========================================
-- CHAPTER 40: TESTING & QUALITY ASSURANCE
-- ========================================
CREATE TABLE IF NOT EXISTS qa_test_plans (id BIGSERIAL PRIMARY KEY, name VARCHAR(180) NOT NULL, release_key VARCHAR(80) NOT NULL, scope TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','approved','archived')), owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS qa_test_cases (id BIGSERIAL PRIMARY KEY, plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE CASCADE, requirement_id BIGINT REFERENCES requirements(id) ON DELETE SET NULL, case_key VARCHAR(40) NOT NULL UNIQUE, title VARCHAR(220) NOT NULL, test_type VARCHAR(20) NOT NULL CHECK (test_type IN ('unit','integration','system','uat','performance','security')), execution_mode VARCHAR(20) NOT NULL CHECK (execution_mode IN ('automated','manual')), scenario TEXT NOT NULL, expected_result TEXT NOT NULL, priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')), active BOOLEAN NOT NULL DEFAULT TRUE, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS qa_test_runs (id BIGSERIAL PRIMARY KEY, plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE SET NULL, case_id BIGINT NOT NULL REFERENCES qa_test_cases(id) ON DELETE CASCADE, run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('unit','integration','system','uat','regression','performance','security')), execution_mode VARCHAR(20) NOT NULL CHECK (execution_mode IN ('automated','manual')), result VARCHAR(20) NOT NULL CHECK (result IN ('passed','failed','blocked','skipped','pending')), duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0), evidence JSONB NOT NULL DEFAULT '{}'::jsonb, notes TEXT, executed_by INTEGER REFERENCES users(id) ON DELETE SET NULL, executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS qa_bugs (id BIGSERIAL PRIMARY KEY, bug_key VARCHAR(40) NOT NULL UNIQUE, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')), status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','fixed','retest','closed','rejected')), test_case_id BIGINT REFERENCES qa_test_cases(id) ON DELETE SET NULL, reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL, assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, resolution_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS qa_reports (id BIGSERIAL PRIMARY KEY, report_key VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL, report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('test_results','bug_summary','release_readiness')), plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE SET NULL, summary JSONB NOT NULL DEFAULT '{}'::jsonb, generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS qa_cases_type_idx ON qa_test_cases(test_type, execution_mode, active);
CREATE INDEX IF NOT EXISTS qa_runs_result_idx ON qa_test_runs(result, executed_at DESC);
CREATE INDEX IF NOT EXISTS qa_bugs_status_idx ON qa_bugs(status, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS qa_reports_created_idx ON qa_reports(created_at DESC);
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-QA-001','Unit testing','Individual components are tested independently.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','non_functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-002','Integration testing','Interactions between platform modules are validated.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','non_functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-003','System testing','Complete platform functionality is validated end to end.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','non_functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-004','User acceptance testing','Real users can approve the platform before release.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-005','Automated testing','Automated scripts support repeatable validation.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','high','non_functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-006','Manual testing','Testers can record human-driven validation.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','high','functional',ARRAY['qa_test_cases','qa_test_runs']),
('ACC-FRS-QA-007','Regression testing','Existing features are re-tested after changes.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','non_functional',ARRAY['qa_test_runs']),
('ACC-FRS-QA-008','Performance testing','System behavior under load is validated against targets.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','high','performance',ARRAY['qa_test_runs','performance_request_metrics']),
('ACC-FRS-QA-009','Security testing','Security checks identify and track vulnerabilities.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','critical','security',ARRAY['qa_test_runs','qa_bugs']),
('ACC-FRS-QA-010','Test reporting','Results and bug summaries are available for review.','QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.','high','functional',ARRAY['qa_reports','qa_bugs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As a QA operator, I want testing and quality controls so releases are validated before deployment.','views/admin/qa.ejs','GET /admin/qa and POST /admin/qa/*',ARRAY['qa_test_plans','qa_test_cases','qa_test_runs','qa_bugs','qa_reports'],'tests/chapter40-qa.test.js','Testing and QA','1.0','complete','Chapter 40 QA controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-QA-%' ON CONFLICT (requirement_id) DO NOTHING;

-- ========================================
-- CHAPTER 41: VERSIONING & RELEASE MANAGEMENT
-- ========================================
CREATE TABLE IF NOT EXISTS release_versions (id BIGSERIAL PRIMARY KEY, version VARCHAR(80) NOT NULL UNIQUE, major INTEGER NOT NULL CHECK (major >= 0), minor INTEGER NOT NULL CHECK (minor >= 0), patch INTEGER NOT NULL CHECK (patch >= 0), prerelease VARCHAR(120), build_metadata VARCHAR(120), component VARCHAR(120) NOT NULL DEFAULT 'acc-platform', commit_sha VARCHAR(120), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS release_plans (id BIGSERIAL PRIMARY KEY, version_id BIGINT NOT NULL REFERENCES release_versions(id) ON DELETE CASCADE, release_type VARCHAR(20) NOT NULL CHECK (release_type IN ('major','minor','patch','hotfix')), title VARCHAR(220) NOT NULL, scope TEXT NOT NULL, environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL, scheduled_at TIMESTAMPTZ, status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','ready','released','rolled_back','cancelled')), qa_report_id BIGINT REFERENCES qa_reports(id) ON DELETE SET NULL, previous_version_id BIGINT REFERENCES release_versions(id) ON DELETE SET NULL, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS release_notes (id BIGSERIAL PRIMARY KEY, release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE, category VARCHAR(20) NOT NULL CHECK (category IN ('feature','bug_fix','change','security','breaking')), title VARCHAR(220) NOT NULL, body TEXT NOT NULL, audience VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (audience IN ('user','admin','internal')), created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS release_compatibility (id BIGSERIAL PRIMARY KEY, release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE, integration_name VARCHAR(160) NOT NULL, minimum_version VARCHAR(80), compatibility_status VARCHAR(20) NOT NULL DEFAULT 'required' CHECK (compatibility_status IN ('required','verified','deprecated','breaking')), verification_notes TEXT, verified_at TIMESTAMPTZ, verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS release_monitoring (id BIGSERIAL PRIMARY KEY, release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE, environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL, status VARCHAR(20) NOT NULL CHECK (status IN ('healthy','watch','incident','resolved')), error_rate NUMERIC(7,4) CHECK (error_rate IS NULL OR error_rate >= 0), response_time_ms INTEGER CHECK (response_time_ms IS NULL OR response_time_ms >= 0), issue_summary TEXT, recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS release_audit_logs (id BIGSERIAL PRIMARY KEY, release_plan_id BIGINT REFERENCES release_plans(id) ON DELETE SET NULL, version_id BIGINT REFERENCES release_versions(id) ON DELETE SET NULL, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, event_type VARCHAR(80) NOT NULL, outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS release_plans_status_idx ON release_plans(status, scheduled_at);
CREATE INDEX IF NOT EXISTS release_notes_plan_idx ON release_notes(release_plan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS release_monitoring_plan_idx ON release_monitoring(release_plan_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS release_audit_created_idx ON release_audit_logs(created_at DESC);
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-REL-001','Version control system','System components and release versions are tracked accurately.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','critical','non_functional',ARRAY['release_versions','release_audit_logs']),
('ACC-FRS-REL-002','Semantic versioning','Versions follow Major.Minor.Patch semantic versioning.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','non_functional',ARRAY['release_versions']),
('ACC-FRS-REL-003','Release planning','Release schedules and feature lists are planned in advance.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','functional',ARRAY['release_plans','release_notes']),
('ACC-FRS-REL-004','Release deployment','Prepared versions can be deployed through a controlled workflow.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','critical','functional',ARRAY['release_plans','deployment_releases']),
('ACC-FRS-REL-005','Rollback mechanism','A release can be safely reverted to a previous version.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','critical','functional',ARRAY['release_plans','deployment_releases']),
('ACC-FRS-REL-006','Release notes','New features, fixes, and changes are documented.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','functional',ARRAY['release_notes']),
('ACC-FRS-REL-007','Feature flagging','Features can be enabled or disabled without redeployment.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','functional',ARRAY['system_feature_flags','release_audit_logs']),
('ACC-FRS-REL-008','Backward compatibility','Compatibility requirements for older integrations are recorded.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','functional',ARRAY['release_compatibility']),
('ACC-FRS-REL-009','Release monitoring','Post-release behavior and issues are monitored.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','critical','non_functional',ARRAY['release_monitoring','deployment_metrics']),
('ACC-FRS-REL-010','Release audit logging','Version, deployment, and rollback activities are durably logged.','Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.','high','security',ARRAY['release_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As a release administrator, I want versioning and release controls so ACC evolves safely.','views/admin/releases.ejs','GET /admin/releases and POST /admin/releases/*',ARRAY['release_versions','release_plans','release_notes','release_compatibility','release_monitoring','release_audit_logs'],'tests/chapter41-release.test.js','Versioning and Release Management','1.0','complete','Chapter 41 release controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-REL-%' ON CONFLICT (requirement_id) DO NOTHING;

-- Chapter 32 mobile and installable PWA access layer.
DROP TABLE IF EXISTS mobile_uploads CASCADE;
DROP TABLE IF EXISTS mobile_location_events CASCADE;
DROP TABLE IF EXISTS mobile_sync_queue CASCADE;
DROP TABLE IF EXISTS mobile_push_subscriptions CASCADE;
DROP TABLE IF EXISTS mobile_devices CASCADE;
CREATE TABLE mobile_devices (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, installation_id VARCHAR(180) NOT NULL, platform VARCHAR(20) NOT NULL CHECK (platform IN ('android','ios','web','other')), device_label VARCHAR(120), user_agent VARCHAR(500), capabilities JSONB NOT NULL DEFAULT '{}'::jsonb, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, installation_id));
CREATE TABLE mobile_push_subscriptions (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id BIGINT REFERENCES mobile_devices(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, subscription JSONB NOT NULL, enabled BOOLEAN NOT NULL DEFAULT TRUE, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE mobile_sync_queue (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL, client_action_id VARCHAR(180) NOT NULL, action_type VARCHAR(80) NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','synced','rejected')), error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, synced_at TIMESTAMPTZ, UNIQUE(user_id, client_action_id));
CREATE TABLE mobile_location_events (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL, latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180), accuracy_m NUMERIC(10,2), purpose VARCHAR(40) NOT NULL DEFAULT 'nearby_search', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE mobile_uploads (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL, original_name VARCHAR(255) NOT NULL, stored_path VARCHAR(500) NOT NULL, mime_type VARCHAR(120) NOT NULL, size_bytes INTEGER NOT NULL CHECK (size_bytes > 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-MOB-001','Mobile and PWA availability','Members can access ACC services through responsive web and an installable PWA on Android and iOS.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-002','Secure mobile authentication','Mobile access uses the shared verified account session and exposes optional platform biometric capability detection.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','critical','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-003','Responsive mobile experience','Core member workflows remain usable on small touch screens and low bandwidth connections.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-004','Push notifications','The platform stores device push subscriptions and links them to persisted notification preferences.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-005','Offline cache and sync','The client can queue non-sensitive actions offline and reconcile them with PostgreSQL after reconnecting.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-006','Camera and document capture','Authenticated members can submit validated image or document uploads from a mobile device.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-007','Location services','Members can opt in to store coarse location signals for nearby business and delivery experiences.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','medium','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-008','Backend synchronization','Mobile device state, sync operations, and upload metadata are durable and auditable in PostgreSQL.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','critical','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-009','Low-bandwidth performance','Mobile responses support compact payloads, cache headers, and connection-aware client behavior.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','high','functional',ARRAY['mobile_devices','mobile_sync_queue']),
('ACC-FRS-MOB-010','Secure storage and transport','Sensitive data remains server-side, sessions are HttpOnly, and mobile endpoints validate ownership and input.','ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.','critical','functional',ARRAY['mobile_devices','mobile_sync_queue'])
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT r.id, v.user_story, v.ui_reference, v.api_reference, v.database_objects, v.test_case, 'Foundation', '1.0', v.coverage_status, v.notes
FROM requirements r
JOIN (VALUES
  ('FR-AUTH-001', 'As a guest, I want to verify my account so I can access the platform.', 'views/accounts/register.ejs, views/accounts/verify-account.ejs', 'POST /register, POST /verify-account', ARRAY['users','account_verification_codes','audit_logs'], 'Account verification acceptance flow', 'Foundation', '1.0', 'complete', 'Registration and verification are implemented.'),
  ('FR-BIZ-001', 'As a verified member, I want to register a business and track its review state.', 'views/business/register.ejs, views/business/detail.ejs', 'POST /business/register, POST /business/:id/submit', ARRAY['business_accounts','business_audit_logs'], 'tests/chapter10-business-register.test.js', 'Foundation', '1.0', 'complete', 'Business workflow is PostgreSQL-backed.'),
  ('FR-MKT-001', 'As a buyer, I want to purchase a marketplace product through a persistent cart.', 'views/marketplace/detail.ejs, views/cart/index.ejs, views/orders/cart-checkout.ejs', 'POST /cart/items, POST /cart/checkout', ARRAY['marketplace_listings','shopping_carts','cart_items','orders','payments'], 'tests/chapter17-marketplace.test.js', 'Foundation', '1.0', 'complete', 'Cart and checkout were added in Chapter 4.'),
  ('FR-PROC-001', 'As a buyer, I want to compare supplier bids and award the best quotation.', 'views/procurement/dashboard.ejs, views/procurement/detail.ejs', 'POST /procurement/:id/bids, POST /procurement/:id/award', ARRAY['procurement_rfqs','procurement_quotations','procurement_orders'], 'tests/chapter22-procurement.test.js', 'Foundation', '1.0', 'complete', 'Tender lifecycle is implemented.'),
  ('FR-MSG-001', 'As a participant, I want to send and read replies in a conversation.', 'views/messaging/index.ejs, views/messaging/conversation.ejs', 'POST /messages/send', ARRAY['conversations','messages','messaging_notifications'], 'tests/chapter14-messaging.test.js', 'Foundation', '1.0', 'complete', 'Message status transitions are implemented.'),
  ('FR-SEC-001', 'As an administrator, I want access decisions to be permission checked and auditable.', 'views/admin/access-control.ejs', 'GET /admin/access-control, POST /admin/access-control/roles', ARRAY['roles','permissions','user_roles','audit_logs'], 'RBAC acceptance checks', 'Foundation', '1.0', 'complete', 'RBAC administration is implemented.'),
  ('FR-OPS-001', 'As a user, I want clear validation errors and a retry path when operations fail.', 'views/error/500.ejs, views/payments/detail.ejs', 'POST /payments/:id/retry', ARRAY['audit_logs','payment_gateway_events','notification_deliveries'], 'tests/chapter19-payment.test.js, tests/chapter25-notifications.test.js', 'Foundation', '1.0', 'partial', 'Payment and notification retries exist; broader workflow retry coverage remains.' )
) AS v(requirement_key, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_validation_rules (requirement_id, field_name, rule_key, rule_description, error_message)
SELECT r.id, v.field_name, v.rule_key, v.rule_description, v.error_message
FROM requirements r
JOIN (VALUES
  ('FR-AUTH-001', 'email', 'required_and_format', 'Email is required and must use a valid address format.', 'Enter a valid email address.'),
  ('FR-BIZ-001', 'businessName', 'required_and_length', 'Business name is required and must be between 2 and 200 characters.', 'Enter a valid business name.'),
  ('FR-MKT-001', 'quantity', 'positive_integer', 'Cart quantity must be a positive whole number.', 'Quantity must be at least 1.'),
  ('FR-PROC-001', 'closingDate', 'future_date', 'A tender closing date must be in the future.', 'Choose a future closing date.'),
  ('FR-MSG-001', 'message', 'required_and_length', 'Message content is required and must not exceed the platform limit.', 'Enter a message within the allowed length.'),
  ('FR-SEC-001', 'permission', 'known_permission', 'Access decisions must reference a registered permission.', 'Select a registered permission.'),
  ('FR-OPS-001', 'retryCount', 'bounded_integer', 'Retry count must be a non-negative bounded integer.', 'Retry count is invalid.')
) AS v(requirement_key, field_name, rule_key, rule_description, error_message) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, field_name, rule_key) DO NOTHING;

INSERT INTO requirement_compliance_controls (requirement_id, framework, control_key, control_description, status, evidence_reference)
SELECT r.id, v.framework, v.control_key, v.control_description, v.status, v.evidence_reference
FROM requirements r
JOIN (VALUES
  ('FR-AUTH-001', 'Data protection', 'DP-01', 'Account data is collected for a stated purpose and protected in PostgreSQL.', 'implemented', 'users and audit_logs'),
  ('FR-MKT-001', 'Financial regulations', 'FIN-01', 'Payment initiation and status changes are auditable and tied to an order.', 'implemented', 'payments and payment_gateway_events'),
  ('FR-PROC-001', 'Cross-border compliance', 'XBR-01', 'Procurement records retain jurisdiction and supplier evidence for cross-border review.', 'review_required', 'procurement RFQ and quotation records'),
  ('FR-MSG-001', 'Data protection', 'DP-02', 'Message access is restricted to conversation participants and security events are logged.', 'implemented', 'messaging access checks and audit_logs'),
  ('FR-SEC-001', 'Data protection', 'DP-03', 'Role and permission changes are auditable and restricted to authorized administrators.', 'implemented', 'roles, permissions, user_roles, audit_logs')
) AS v(requirement_key, framework, control_key, control_description, status, evidence_reference) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, framework, control_key) DO NOTHING;

INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary)
SELECT id, version, 'created', 'Initial Chapter 5 traceability baseline.' FROM requirements
ON CONFLICT (requirement_id, version) DO NOTHING;

-- Chapter 31: User experience and interface requirements.
INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies)
VALUES
  ('FR-UX-001', 'Intuitive navigation', 'Users can find platform features through logical navigation within three clicks.', 'Any platform user', 'The user can access the public or authenticated application shell.', 'Primary platform destinations are reachable through navigation, workspace, or dashboard links.', 'critical', 'functional', ARRAY['navigation', 'workspace', 'dashboard']),
  ('FR-UX-002', 'Responsive design', 'The interface adapts to desktop, tablet, and mobile screen sizes without breaking workflows.', 'Any platform user', 'The user accesses the platform from a supported viewport.', 'Content, controls, and navigation remain usable at the selected viewport.', 'critical', 'non_functional', ARRAY['responsive_styles', 'navigation']),
  ('FR-UX-003', 'Consistent UI design', 'Shared colors, typography, controls, and layout conventions are used across platform modules.', 'Any platform user', 'A platform page is rendered through the shared application shell.', 'The page uses the ACC design system and shared interaction patterns.', 'high', 'non_functional', ARRAY['shared_layout', 'shared_styles']),
  ('FR-UX-004', 'Form validation and error handling', 'Forms validate required and invalid input and present clear feedback to users.', 'Any platform user', 'A user submits a form or workflow action.', 'The user receives field or workflow feedback and invalid data is not silently accepted.', 'critical', 'functional', ARRAY['validation', 'feedback']),
  ('FR-UX-005', 'User feedback mechanism', 'The system provides immediate accessible feedback for successful, pending, and failed actions.', 'Any platform user', 'A user performs a platform action.', 'A status, success, error, loading, or alert response is visible to the user.', 'critical', 'functional', ARRAY['notifications', 'feedback']),
  ('FR-UX-006', 'Accessibility compliance', 'The interface supports screen readers, keyboard navigation, high contrast, and reduced motion preferences.', 'Any platform user', 'A user accesses a supported platform page.', 'Accessible structure, focus treatment, and durable accessibility preferences are available.', 'high', 'non_functional', ARRAY['accessibility', 'user_ux_preferences']),
  ('FR-UX-007', 'Dashboard usability', 'Dashboards present key metrics and direct actions in a clear, scannable layout.', 'Authenticated user', 'The user is authenticated and opens a dashboard.', 'The user can understand account or management status and reach common actions quickly.', 'high', 'functional', ARRAY['dashboard', 'metrics', 'workspace']),
  ('FR-UX-008', 'Minimize user actions', 'The platform reduces unnecessary steps through quick actions, saved preferences, and guided entry points.', 'Authenticated user', 'The user begins a common platform task.', 'The user can start or resume a task from a nearby action or saved preference.', 'high', 'functional', ARRAY['quick_actions', 'user_ux_preferences', 'onboarding']),
  ('FR-UX-009', 'Search and filtering', 'Directory and module search interfaces return accurate filtered results.', 'Any platform user', 'The relevant searchable records are available.', 'The user can search, filter, sort, and paginate matching results.', 'critical', 'functional', ARRAY['business_directory', 'search_filters']),
  ('FR-UX-010', 'User onboarding experience', 'New authenticated users receive a guided workspace setup path with clear next steps.', 'New authenticated user', 'The user has not completed workspace onboarding.', 'The user can follow setup links and persist completion state in PostgreSQL.', 'high', 'functional', ARRAY['workspace', 'onboarding', 'user_ux_preferences'])
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT r.id, v.user_story, v.ui_reference, v.api_reference, v.database_objects, v.test_case, 'Experience', '1.0', v.coverage_status, v.notes
FROM requirements r
JOIN (VALUES
  ('FR-UX-001', 'As a platform user, I want logical navigation so I can find features quickly.', 'views/layouts/layout.ejs, views/workspace.ejs, views/admin/dashboard.ejs', 'Shared navigation and workspace links', ARRAY['user_ux_preferences'], 'Shared navigation and breadcrumb acceptance checks', 'complete', 'Shared navbar, sidebar, workspace, and breadcrumbs are implemented.'),
  ('FR-UX-002', 'As a user on any device, I want the interface to remain usable.', 'public/styles/small.css, public/styles/medium.css, public/styles/large.css, public/styles/ux.css', 'Responsive HTML views', ARRAY['system_settings'], 'Responsive viewport acceptance checks', 'complete', 'Existing responsive styles plus Chapter 31 UX responsive rules are loaded globally.'),
  ('FR-UX-003', 'As a user, I want a consistent visual language across ACC.', 'views/Partials/head.ejs, public/styles/base.css, public/styles/ux.css', 'Shared layout stylesheet pipeline', ARRAY['system_settings'], 'Shared design system acceptance checks', 'complete', 'Shared styles are loaded through the common head partial.'),
  ('FR-UX-004', 'As a user, I want invalid form input explained clearly.', 'views/accounts, views/profile.ejs, views/* forms', 'Existing module form POST routes', ARRAY['audit_logs'], 'Validation and error feedback acceptance checks', 'complete', 'Existing module validation remains in place and shared error feedback is now announced.'),
  ('FR-UX-005', 'As a user, I want immediate feedback after an action.', 'views/layouts/layout.ejs, views/notifications/index.ejs', 'Existing module action routes and query feedback', ARRAY['notifications','notification_deliveries'], 'Feedback announcement acceptance checks', 'complete', 'Shared status and alert live regions preserve redirect feedback.'),
  ('FR-UX-006', 'As a user with accessibility needs, I want controls that respect my preferences.', 'views/layouts/layout.ejs, public/styles/ux.css', 'POST /preferences', ARRAY['user_ux_preferences'], 'Accessibility preference acceptance checks', 'complete', 'Skip navigation, focus states, high contrast, reduced motion, and persistence are implemented.'),
  ('FR-UX-007', 'As an authenticated user, I want dashboards to show status and next actions.', 'views/dashboard.ejs, views/admin/dashboard.ejs, views/workspace.ejs', 'GET /dashboard, GET /admin/dashboard, GET /workspace', ARRAY['requirements','analytics_events'], 'Dashboard usability acceptance checks', 'complete', 'Member and management dashboards expose metrics and direct navigation.'),
  ('FR-UX-008', 'As a member, I want quick actions and saved preferences to reduce repetition.', 'views/dashboard.ejs, views/workspace.ejs, views/layouts/layout.ejs', 'POST /preferences', ARRAY['user_ux_preferences'], 'Quick action and saved preference acceptance checks', 'complete', 'Workspace actions, onboarding links, and persisted accessibility preferences are available.'),
  ('FR-UX-009', 'As a user, I want accurate search and filters.', 'views/business/directory.ejs', 'GET /directory?keyword=&industry=&country=&sort=', ARRAY['business_accounts','business_directory_search_logs'], 'Directory filtering acceptance checks', 'complete', 'Directory search, exact industry filtering, sorting, and pagination are database-backed.'),
  ('FR-UX-010', 'As a new member, I want guided setup steps.', 'views/workspace.ejs', 'POST /onboarding/complete', ARRAY['user_ux_preferences'], 'Onboarding completion acceptance checks', 'complete', 'Onboarding state and completion are persisted in PostgreSQL.' )
) AS v(requirement_key, user_story, ui_reference, api_reference, database_objects, test_case, coverage_status, notes) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_validation_rules (requirement_id, field_name, rule_key, rule_description, error_message)
SELECT r.id, v.field_name, v.rule_key, v.rule_description, v.error_message
FROM requirements r
JOIN (VALUES
  ('FR-UX-001', 'navigationTarget', 'reachable_path', 'Navigation targets must resolve to an application path.', 'Choose a valid destination.'),
  ('FR-UX-002', 'viewport', 'supported_layout', 'Responsive layouts must remain usable across supported viewport sizes.', 'This layout is not available at the current size.'),
  ('FR-UX-003', 'component', 'shared_style', 'Shared controls must use the ACC design system.', 'Use the shared ACC component style.'),
  ('FR-UX-004', 'formField', 'required_or_valid', 'Required and invalid fields must return clear validation feedback.', 'Check the highlighted field and try again.'),
  ('FR-UX-005', 'feedback', 'announced_status', 'Action feedback must be available through an accessible status or alert region.', 'The action status could not be displayed.'),
  ('FR-UX-006', 'preference', 'persisted_boolean', 'Accessibility preferences must be persisted as boolean values for the user.', 'Choose a valid accessibility preference.'),
  ('FR-UX-007', 'dashboardMetric', 'visible_summary', 'Dashboard metrics must expose a readable label and value.', 'The dashboard summary is unavailable.'),
  ('FR-UX-008', 'quickAction', 'reachable_workflow', 'Quick actions must link to an existing workflow entry point.', 'Choose an available action.'),
  ('FR-UX-009', 'filter', 'database_backed', 'Search and filter values must be applied by the database query.', 'Enter a valid search or filter.'),
  ('FR-UX-010', 'onboardingStep', 'bounded_step', 'Onboarding steps must remain within the supported workflow range.', 'Choose a valid onboarding step.')
) AS v(requirement_key, field_name, rule_key, rule_description, error_message) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, field_name, rule_key) DO NOTHING;

INSERT INTO requirement_compliance_controls (requirement_id, framework, control_key, control_description, status, evidence_reference)
SELECT r.id, v.framework, v.control_key, v.control_description, v.status, v.evidence_reference
FROM requirements r
JOIN (VALUES
  ('FR-UX-001', 'Usability', 'UX-NAV-01', 'Primary destinations are reachable through shared navigation and workspace links.', 'implemented', 'shared layout and workspace'),
  ('FR-UX-002', 'Usability', 'UX-RESP-01', 'Responsive breakpoint styles preserve usable layouts across desktop, tablet, and mobile.', 'implemented', 'small.css, medium.css, large.css, ux.css'),
  ('FR-UX-003', 'Usability', 'UX-CONS-01', 'Common styles and components are loaded through the shared head partial.', 'implemented', 'views/Partials/head.ejs'),
  ('FR-UX-004', 'Accessibility', 'UX-FORM-01', 'Validation and feedback paths prevent silent failure and explain user action errors.', 'implemented', 'module validation utilities and shared feedback'),
  ('FR-UX-005', 'Accessibility', 'UX-FEED-01', 'Status and alert feedback uses semantic live regions.', 'implemented', 'views/layouts/layout.ejs'),
  ('FR-UX-006', 'Accessibility', 'UX-A11Y-01', 'Keyboard, screen-reader, high-contrast, and reduced-motion support are available.', 'implemented', 'ux.css and user_ux_preferences'),
  ('FR-UX-007', 'Usability', 'UX-DASH-01', 'Dashboards expose metrics and direct actions for member and management roles.', 'implemented', 'dashboard and admin dashboard views'),
  ('FR-UX-008', 'Usability', 'UX-EFF-01', 'Quick actions and preferences reduce repeated navigation and configuration.', 'implemented', 'workspace, dashboard, and preferences'),
  ('FR-UX-009', 'Data quality', 'UX-SEARCH-01', 'Directory search and filters execute against PostgreSQL records and retain query analytics.', 'implemented', 'businessDirectoryModel.js'),
  ('FR-UX-010', 'Usability', 'UX-ONBOARD-01', 'Onboarding progress is durable and can be completed through an authenticated workflow.', 'implemented', 'user_ux_preferences and POST /onboarding/complete')
) AS v(requirement_key, framework, control_key, control_description, status, evidence_reference) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, framework, control_key) DO NOTHING;

INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary)
SELECT id, version, 'created', 'Chapter 31 UX and interface baseline.' FROM requirements WHERE requirement_id LIKE 'FR-UX-%'
ON CONFLICT (requirement_id, version) DO NOTHING;

-- Chapter 33: Localization and multi-language support traceability.
INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies)
VALUES
  ('FR-LOC-001', 'Supported language catalog', 'Members can select an enabled ACC language from the PostgreSQL language catalog.', 'Authenticated member', 'The member can access Settings.', 'The selected enabled language is applied to subsequent views.', 'critical', 'functional', ARRAY['localization_languages', 'user_localization_preferences']),
  ('FR-LOC-002', 'Translation fallback', 'Missing translations resolve to the default English catalog or the translation key without breaking rendering.', 'Any platform user', 'A translation key is requested.', 'The interface renders a safe readable value.', 'critical', 'functional', ARRAY['localization_translations']),
  ('FR-LOC-003', 'Regional formatting', 'Dates, numbers, time, and currency are formatted using the member locale and preferences.', 'Authenticated member', 'The member has a locale preference or browser locale.', 'Display formatting follows the selected locale.', 'high', 'functional', ARRAY['user_localization_preferences']),
  ('FR-LOC-004', 'Currency catalog and conversion', 'Supported currencies and administrator-managed exchange rates are available for display conversion.', 'Member and administrator', 'Currencies and rates exist in PostgreSQL.', 'Display conversions retain source and target currency context without changing settlement records.', 'critical', 'functional', ARRAY['localization_currencies', 'localization_exchange_rates']),
  ('FR-LOC-005', 'Language and region settings', 'Members can persist language, locale, currency, region, date, time, and auto-detection preferences.', 'Authenticated member', 'The member submits valid settings.', 'Preferences are upserted and audited in PostgreSQL.', 'critical', 'functional', ARRAY['user_localization_preferences', 'localization_audit_logs']),
  ('FR-LOC-006', 'Guest locale detection', 'Guest requests use Accept-Language detection with a safe English fallback.', 'Guest user', 'The request includes an optional browser language header.', 'The request receives a supported locale without creating persistence.', 'high', 'functional', ARRAY['localization_languages']),
  ('FR-LOC-007', 'Localized notifications', 'Event-generated notifications are translated for each recipient and retain the locale used in audit metadata.', 'Notification service', 'A notification event has one or more recipients.', 'Localized title and message are stored in PostgreSQL and delivered through existing channels.', 'critical', 'functional', ARRAY['notifications', 'localization_translations', 'localization_audit_logs']),
  ('FR-LOC-008', 'Administrator localization management', 'Authorized administrators can manage language availability, translations, and exchange rates.', 'Authorized administrator', 'The administrator has admin.settings.manage.', 'Changes are persisted and audited.', 'critical', 'functional', ARRAY['localization_languages', 'localization_translations', 'localization_exchange_rates']),
  ('FR-LOC-009', 'Localization auditability', 'Preference, catalog, rate, and notification locale changes produce durable audit records.', 'System and administrator', 'A localization operation completes.', 'An audit row records actor, event, locale, details, and request metadata.', 'high', 'security', ARRAY['localization_audit_logs']),
  ('FR-LOC-010', 'Localization resilience', 'Unsupported or unavailable localization values do not break existing member, payment, subscription, or notification workflows.', 'Any platform user', 'A locale, rate, or translation may be unavailable.', 'Existing workflows remain available with safe default presentation.', 'critical', 'non_functional', ARRAY['localization', 'payments', 'subscriptions', 'notifications'])
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT r.id, v.user_story, v.ui_reference, v.api_reference, v.database_objects, v.test_case, 'Localization', '1.0', 'complete', v.notes
FROM requirements r JOIN (VALUES
  ('FR-LOC-001', 'As a member, I want to select my ACC language.', 'views/localization/settings.ejs', 'POST /settings/localization', ARRAY['localization_languages','user_localization_preferences'], 'Language selection acceptance checks', 'Enabled catalog values are validated and persisted.'),
  ('FR-LOC-002', 'As a user, I want missing translations to remain readable.', 'server.js, models/localizationModel.js', 'Shared translation helper', ARRAY['localization_translations'], 'Translation fallback acceptance checks', 'English and key fallback behavior is centralized.'),
  ('FR-LOC-003', 'As a member, I want dates and currency formatted for my region.', 'views/localization/settings.ejs, shared locals', 'formatCurrency, formatDate, formatNumber', ARRAY['user_localization_preferences'], 'Regional formatting acceptance checks', 'Intl formatters use the request locale.'),
  ('FR-LOC-004', 'As a member, I want display currency conversion without altering payment settlement.', 'models/localizationModel.js', 'convertCurrency, getExchangeRate', ARRAY['localization_currencies','localization_exchange_rates'], 'Currency conversion acceptance checks', 'Conversion is display-only and rate-backed.'),
  ('FR-LOC-005', 'As a member, I want language and region choices to persist.', 'views/localization/settings.ejs', 'POST /settings/localization', ARRAY['user_localization_preferences','localization_audit_logs'], 'Preference persistence acceptance checks', 'Upsert and audit operations use PostgreSQL.'),
  ('FR-LOC-006', 'As a guest, I want ACC to respect my browser language.', 'server.js', 'Accept-Language request middleware', ARRAY['localization_languages'], 'Guest locale detection acceptance checks', 'Supported language family detection falls back to English.'),
  ('FR-LOC-007', 'As a member, I want notification events in my language.', 'models/notificationModel.js', 'generateFromEvent', ARRAY['notifications','localization_translations','localization_audit_logs'], 'Localized notification acceptance checks', 'Recipient preferences determine stored notification text.'),
  ('FR-LOC-008', 'As an administrator, I want to maintain localization catalogs.', 'views/admin/localization.ejs', 'POST /admin/localization/*', ARRAY['localization_languages','localization_translations','localization_exchange_rates'], 'Admin localization acceptance checks', 'Existing admin.settings.manage protects mutations.'),
  ('FR-LOC-009', 'As an auditor, I want localization changes to be reviewable.', 'views/admin/localization.ejs', 'Localization audit queries', ARRAY['localization_audit_logs'], 'Localization audit acceptance checks', 'Actor and request metadata are stored.'),
  ('FR-LOC-010', 'As a platform user, I want localization failures not to break workflows.', 'views/layouts/layout.ejs, payment and subscription views', 'Shared fallback and existing module routes', ARRAY['localization_translations','localization_exchange_rates'], 'Localization resilience regression checks', 'Existing callers remain compatible and fallback is safe.')
) AS v(requirement_key, user_story, ui_reference, api_reference, database_objects, test_case, notes) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO requirement_validation_rules (requirement_id, field_name, rule_key, rule_description, error_message)
SELECT r.id, v.field_name, v.rule_key, v.rule_description, v.error_message FROM requirements r JOIN (VALUES
  ('FR-LOC-001','languageCode','enabled_language','Language must be enabled in PostgreSQL.','Choose an available language.'),
  ('FR-LOC-002','translationKey','fallback_value','A missing key must resolve to English or its key.','The translation is unavailable.'),
  ('FR-LOC-003','locale','supported_locale','Locale must be supported by the formatting runtime.','Choose a supported region.'),
  ('FR-LOC-004','rate','positive_rate','Exchange rates must be positive numeric values.','Enter a valid positive exchange rate.'),
  ('FR-LOC-005','preferences','persisted_preferences','Valid preference fields must be persisted for the authenticated user.','Check your language and region choices.'),
  ('FR-LOC-006','acceptLanguage','safe_detection','Unsupported browser language must fall back safely.','The browser language could not be detected.'),
  ('FR-LOC-007','recipientId','localized_recipient','Each notification recipient must resolve a locale before event insertion.','The notification recipient is invalid.'),
  ('FR-LOC-008','permission','admin_settings_manage','Catalog mutation requires the existing management permission.','You are not authorized to manage localization.'),
  ('FR-LOC-009','auditEvent','durable_audit','Localization mutations must create an audit record.','The audit record could not be created.'),
  ('FR-LOC-010','fallback','workflow_safe','Unavailable localization data must not prevent the base workflow.','Use the default display settings and try again.')
) AS v(requirement_key, field_name, rule_key, rule_description, error_message) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, field_name, rule_key) DO NOTHING;

INSERT INTO requirement_compliance_controls (requirement_id, framework, control_key, control_description, status, evidence_reference)
SELECT r.id, v.framework, v.control_key, v.control_description, 'implemented', v.evidence_reference FROM requirements r JOIN (VALUES
  ('FR-LOC-001','Localization','LOC-LANG-01','Supported languages are cataloged and enabled in PostgreSQL.','localization_languages'),
  ('FR-LOC-002','Localization','LOC-FALLBACK-01','Translation lookup uses English and key fallback.','models/localizationModel.js'),
  ('FR-LOC-003','Localization','LOC-FORMAT-01','Shared Intl formatters use the request locale.','server.js shared locals'),
  ('FR-LOC-004','Financial display','LOC-RATE-01','Exchange rates are stored with source and effective time.','localization_exchange_rates'),
  ('FR-LOC-005','Privacy','LOC-PREF-01','Member choices are durable and user-scoped.','user_localization_preferences'),
  ('FR-LOC-006','Usability','LOC-DETECT-01','Guest detection does not create persistence.','server.js middleware'),
  ('FR-LOC-007','Notifications','LOC-NOTIFY-01','Localized notification content is stored with locale audit metadata.','notification_audit_logs'),
  ('FR-LOC-008','Access control','LOC-ADMIN-01','Localization mutations require admin.settings.manage.','routes/adminRoute.js'),
  ('FR-LOC-009','Audit','LOC-AUDIT-01','Localization operations record actor and request metadata.','localization_audit_logs'),
  ('FR-LOC-010','Reliability','LOC-RESILIENCE-01','Fallbacks preserve existing workflows.','shared localization model and callers')
) AS v(requirement_key, framework, control_key, control_description, evidence_reference) ON r.requirement_id = v.requirement_key
ON CONFLICT (requirement_id, framework, control_key) DO NOTHING;

INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary)
SELECT id, 1, 'created', 'Chapter 33 localization and multi-language support baseline.' FROM requirements WHERE requirement_id LIKE 'FR-LOC-%'
ON CONFLICT (requirement_id, version) DO NOTHING;

-- Chapter 35: Data management and database requirements.
CREATE TABLE IF NOT EXISTS data_catalog_resources (id BIGSERIAL PRIMARY KEY, resource_key VARCHAR(120) NOT NULL UNIQUE, category VARCHAR(40) NOT NULL, table_name VARCHAR(120) NOT NULL, description TEXT NOT NULL, retention_days INTEGER NOT NULL CHECK (retention_days > 0), sensitive BOOLEAN NOT NULL DEFAULT FALSE, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS data_integrity_checks (id BIGSERIAL PRIMARY KEY, check_key VARCHAR(120) NOT NULL, status VARCHAR(30) NOT NULL CHECK (status IN ('passed','warning','failed')), findings JSONB NOT NULL DEFAULT '{}'::jsonb, rows_checked INTEGER NOT NULL DEFAULT 0, checked_by BIGINT REFERENCES users(id) ON DELETE SET NULL, checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS data_archives (id BIGSERIAL PRIMARY KEY, resource_key VARCHAR(120) NOT NULL REFERENCES data_catalog_resources(resource_key) ON DELETE RESTRICT, table_name VARCHAR(120) NOT NULL, record_id VARCHAR(120) NOT NULL, archived_data JSONB NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'archived' CHECK (status IN ('archived','restored','purged')), reason TEXT NOT NULL, archived_by BIGINT REFERENCES users(id) ON DELETE SET NULL, restored_by BIGINT REFERENCES users(id) ON DELETE SET NULL, archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, restored_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS data_versions (id BIGSERIAL PRIMARY KEY, resource_key VARCHAR(120) NOT NULL REFERENCES data_catalog_resources(resource_key) ON DELETE RESTRICT, record_id VARCHAR(120) NOT NULL, version_number INTEGER NOT NULL CHECK (version_number > 0), change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('created','updated','deleted','restored')), snapshot JSONB NOT NULL, changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (resource_key, record_id, version_number));
CREATE TABLE IF NOT EXISTS data_backup_schedules (id BIGSERIAL PRIMARY KEY, schedule_key VARCHAR(120) NOT NULL UNIQUE, frequency VARCHAR(40) NOT NULL CHECK (frequency IN ('hourly','daily','weekly','monthly')), retention_days INTEGER NOT NULL CHECK (retention_days > 0), storage_provider VARCHAR(80) NOT NULL, storage_reference TEXT, encrypted BOOLEAN NOT NULL DEFAULT TRUE, active BOOLEAN NOT NULL DEFAULT TRUE, last_run_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ, updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS data_recovery_requests (id BIGSERIAL PRIMARY KEY, backup_id BIGINT, target_resource VARCHAR(120), target_environment VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','in_progress','completed','rejected')), reason TEXT NOT NULL, requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL, requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMPTZ, notes TEXT);
CREATE TABLE IF NOT EXISTS data_management_audit_logs (id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, event_type VARCHAR(120) NOT NULL, resource_key VARCHAR(120), record_id VARCHAR(120), outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS data_integrity_checks_key_idx ON data_integrity_checks(check_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS data_archives_resource_idx ON data_archives(resource_key, status, archived_at DESC);
CREATE INDEX IF NOT EXISTS data_versions_record_idx ON data_versions(resource_key, record_id, version_number DESC);
CREATE INDEX IF NOT EXISTS data_audit_created_idx ON data_management_audit_logs(created_at DESC);
INSERT INTO data_catalog_resources (resource_key, category, table_name, description, retention_days, sensitive) VALUES
 ('users','user','users','Profiles, authentication state, preferences, and consent metadata.',3650,TRUE), ('business_accounts','business','business_accounts','Business registration, verification, ownership, and lifecycle data.',3650,FALSE), ('marketplace_listings','business','marketplace_listings','Business listings and publishing state.',1825,FALSE), ('orders','transaction','orders','Commerce order records and lifecycle state.',3650,TRUE), ('payments','transaction','payments','Payment records, gateway status, and settlement references.',3650,TRUE), ('procurement_rfqs','transaction','procurement_rfqs','Procurement requests and sourcing records.',3650,FALSE), ('audit_logs','system','audit_logs','Core application audit events.',3650,TRUE), ('analytics_events','system','analytics_events','Product activity and reporting events.',1095,TRUE), ('notifications','system','notifications','Member notifications and delivery state.',1095,TRUE)
ON CONFLICT (resource_key) DO NOTHING;
INSERT INTO data_backup_schedules (schedule_key, frequency, retention_days, storage_provider, encrypted, active) VALUES ('primary-postgresql-daily','daily',35,'encrypted-object-storage',TRUE,TRUE) ON CONFLICT (schedule_key) DO NOTHING;

INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies)
VALUES
 ('FR-DATA-001','Structured data storage','Platform data is organized in PostgreSQL tables with a catalog of user, business, transaction, and system resources.','Platform','PostgreSQL is available.','Data categories have durable table metadata.','critical','functional',ARRAY['data_catalog_resources','users','business_accounts','orders','payments']),
 ('FR-DATA-002','Data integrity enforcement','Constraints and validation checks reject or identify invalid relationships and records.','Platform','A data operation or integrity check executes.','Invalid records are prevented or surfaced with findings.','critical','security',ARRAY['foreign_keys','data_integrity_checks']),
 ('FR-DATA-003','Efficient data retrieval','Indexes support efficient integrity, archive, version, and audit queries.','Platform','Catalog and audit data exists.','Operational queries use indexed access paths.','high','performance',ARRAY['data_integrity_checks_key_idx','data_versions_record_idx']),
 ('FR-DATA-004','Data update and modification','Authorized data-management actions update operational records and persist the resulting evidence.','Administrator','The administrator has data-management permission.','Updates and actions are reflected in PostgreSQL audit records.','critical','functional',ARRAY['data_management_audit_logs','permissions']),
 ('FR-DATA-005','Deletion and archiving','Critical records can be archived with a JSON snapshot, reason, actor, and lifecycle status.','Administrator','The resource is cataloged.','Archived evidence is retained and searchable.','high','functional',ARRAY['data_archives','data_catalog_resources']),
 ('FR-DATA-006','Scheduled data backup','Backup schedules define frequency, retention, encrypted storage, and operational evidence.','Operations administrator','A production environment and storage target exist.','Backup requests and schedule metadata are persisted.','critical','functional',ARRAY['data_backup_schedules','deployment_backups']),
 ('FR-DATA-007','Data recovery','Authorized administrators can submit recovery requests against a backup and target environment.','Operations administrator','A failure or restoration need is identified.','A recovery request is tracked through a durable status lifecycle.','critical','functional',ARRAY['data_recovery_requests','deployment_backups']),
 ('FR-DATA-008','Data security','Sensitive resources are cataloged and protected by authenticated permission checks and encrypted backup requirements.','Security and operations administrator','RBAC and PostgreSQL are available.','Unauthorized data-management actions are denied.','critical','security',ARRAY['data_catalog_resources','permissions','data_backup_schedules']),
 ('FR-DATA-009','Data versioning','Critical record snapshots are retained as ordered versions with change types and actors.','Administrator','The resource is cataloged.','Change history can be retrieved by resource and record.','medium','functional',ARRAY['data_versions']),
 ('FR-DATA-010','Data audit logging','Data creation, update, archive, backup, recovery, integrity, and version activities are audited.','System and administrator','A data activity occurs.','Actor, event, resource, outcome, and details are retained.','critical','security',ARRAY['data_management_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT r.id, v.user_story, v.ui_reference, v.api_reference, v.database_objects, v.test_case, 'Data backbone', '1.0', 'complete', v.notes FROM requirements r JOIN (VALUES
 ('FR-DATA-001','As an administrator, I want a catalog of structured platform data.','views/admin/data-management.ejs','GET /admin/data-management',ARRAY['data_catalog_resources','users','business_accounts','orders','payments'],'Chapter 35 data catalog checks','PostgreSQL resource catalog and existing business tables are visible.'),
 ('FR-DATA-002','As an administrator, I want invalid data relationships identified.','views/admin/data-management.ejs','POST /admin/data-management/integrity-checks',ARRAY['data_integrity_checks'],'Chapter 35 integrity checks','Foreign keys and repeatable checks enforce data quality.'),
 ('FR-DATA-003','As an operator, I want indexed data-management queries.','views/admin/data-management.ejs','Data-management model queries',ARRAY['data_integrity_checks_key_idx','data_versions_record_idx','data_audit_created_idx'],'Chapter 35 query performance checks','Operational query indexes are created.'),
 ('FR-DATA-004','As an administrator, I want authorized data changes to persist correctly.','views/admin/data-management.ejs','POST /admin/data-management/*',ARRAY['data_management_audit_logs','permissions'],'Chapter 35 mutation checks','Mutations require admin.data.manage.'),
 ('FR-DATA-005','As an administrator, I want records archived with evidence.','views/admin/data-management.ejs','POST /admin/data-management/archive',ARRAY['data_archives'],'Chapter 35 archive checks','JSON snapshots and reasons are retained.'),
 ('FR-DATA-006','As an operations administrator, I want scheduled encrypted backups recorded.','views/admin/data-management.ejs, views/admin/deployment.ejs','POST /admin/data-management/backups',ARRAY['data_backup_schedules','deployment_backups'],'Chapter 35 backup checks','Schedule and backup evidence are PostgreSQL-backed.'),
 ('FR-DATA-007','As an operations administrator, I want recovery requests tracked.','views/admin/data-management.ejs','POST /admin/data-management/recovery',ARRAY['data_recovery_requests'],'Chapter 35 recovery checks','Recovery target and status are persisted.'),
 ('FR-DATA-008','As a security administrator, I want sensitive data controls and protected actions.','views/admin/data-management.ejs','RBAC middleware and encrypted schedule metadata',ARRAY['data_catalog_resources','permissions'],'Chapter 35 security checks','Private admin routes deny unauthorized users.'),
 ('FR-DATA-009','As an administrator, I want critical record changes versioned.','views/admin/data-management.ejs','POST /admin/data-management/versions',ARRAY['data_versions'],'Chapter 35 version checks','Snapshots receive ordered versions.'),
 ('FR-DATA-010','As an auditor, I want data activity searchable by event and resource.','views/admin/data-management.ejs','Data-management audit queries',ARRAY['data_management_audit_logs'],'Chapter 35 audit checks','Data-management actions create audit evidence.')
) AS v(requirement_key,user_story,ui_reference,api_reference,database_objects,test_case,notes) ON r.requirement_id=v.requirement_key ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary) SELECT id, version, 'created', 'Chapter 35 data management and database baseline.' FROM requirements WHERE requirement_id LIKE 'FR-DATA-%' ON CONFLICT (requirement_id, version) DO NOTHING;

-- Chapter 36: Performance and scalability requirements.
CREATE TABLE IF NOT EXISTS performance_request_metrics (id BIGSERIAL PRIMARY KEY, request_id VARCHAR(120), method VARCHAR(10) NOT NULL, path VARCHAR(500) NOT NULL, status_code INTEGER NOT NULL, response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0), is_api BOOLEAN NOT NULL DEFAULT FALSE, error BOOLEAN NOT NULL DEFAULT FALSE, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, environment_key VARCHAR(30) NOT NULL DEFAULT 'development', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS performance_capacity_profiles (id BIGSERIAL PRIMARY KEY, environment_key VARCHAR(30) NOT NULL UNIQUE, load_balancer_enabled BOOLEAN NOT NULL DEFAULT FALSE, horizontal_scaling_enabled BOOLEAN NOT NULL DEFAULT FALSE, vertical_scaling_enabled BOOLEAN NOT NULL DEFAULT FALSE, cdn_enabled BOOLEAN NOT NULL DEFAULT FALSE, cache_enabled BOOLEAN NOT NULL DEFAULT FALSE, target_concurrency INTEGER NOT NULL DEFAULT 100 CHECK (target_concurrency > 0), cpu_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (cpu_limit_percent > 0 AND cpu_limit_percent <= 100), memory_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (memory_limit_percent > 0 AND memory_limit_percent <= 100), cache_provider VARCHAR(80) NOT NULL DEFAULT 'PostgreSQL shared cache', cdn_provider VARCHAR(120), updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS performance_cache_entries (cache_key VARCHAR(240) PRIMARY KEY, payload JSONB NOT NULL, expires_at TIMESTAMPTZ NOT NULL, hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS performance_peak_load_checks (id BIGSERIAL PRIMARY KEY, environment_key VARCHAR(30) NOT NULL, requested_concurrency INTEGER NOT NULL CHECK (requested_concurrency > 0), observed_requests INTEGER NOT NULL DEFAULT 0, average_response_time_ms INTEGER, error_rate NUMERIC(7,4), status VARCHAR(30) NOT NULL CHECK (status IN ('passed','warning','failed')), findings JSONB NOT NULL DEFAULT '{}'::jsonb, checked_by INTEGER REFERENCES users(id) ON DELETE SET NULL, checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS performance_optimization_actions (id BIGSERIAL PRIMARY KEY, title VARCHAR(200) NOT NULL, area VARCHAR(80) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','rejected')), baseline_response_time_ms INTEGER, measured_response_time_ms INTEGER, notes TEXT, owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS performance_metrics_created_idx ON performance_request_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS performance_metrics_path_idx ON performance_request_metrics(path, created_at DESC);
CREATE INDEX IF NOT EXISTS performance_metrics_api_idx ON performance_request_metrics(is_api, created_at DESC);
CREATE INDEX IF NOT EXISTS performance_peak_checks_created_idx ON performance_peak_load_checks(checked_at DESC);
INSERT INTO performance_capacity_profiles (environment_key, load_balancer_enabled, horizontal_scaling_enabled, vertical_scaling_enabled, cdn_enabled, cache_enabled, target_concurrency, cache_provider, cdn_provider) VALUES ('development', FALSE, TRUE, TRUE, FALSE, TRUE, 50, 'PostgreSQL shared cache', NULL), ('staging', TRUE, TRUE, TRUE, TRUE, TRUE, 500, 'PostgreSQL shared cache', 'Configured deployment CDN'), ('production', TRUE, TRUE, TRUE, TRUE, TRUE, 2000, 'PostgreSQL shared cache', 'Configured deployment CDN') ON CONFLICT (environment_key) DO NOTHING;
INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES
 ('ACC-FRS-PERF-001','Fast response time','Pages target 3000 ms and APIs target 500 ms average response time.','Operations administrator','PostgreSQL and application telemetry are available.','Response evidence is persisted and reviewable.','critical','non_functional',ARRAY['performance_request_metrics']),
 ('ACC-FRS-PERF-002','Concurrent user support','The platform measures concurrent request activity and capacity posture.','Operations administrator','Telemetry is available.','Concurrent-user evidence is recorded.','critical','non_functional',ARRAY['performance_request_metrics','performance_capacity_profiles']),
 ('ACC-FRS-PERF-003','Load balancing','Traffic distribution and proxy posture are recorded for operations review.','Operations administrator','An environment profile exists.','Load-balancer posture is visible.','high','non_functional',ARRAY['performance_capacity_profiles']),
 ('ACC-FRS-PERF-004','Horizontal scaling','Environment instance ranges support adding application servers without downtime.','Operations administrator','Deployment environments are configured.','Horizontal scaling posture is recorded.','critical','non_functional',ARRAY['deployment_environments','performance_capacity_profiles']),
 ('ACC-FRS-PERF-005','Vertical scaling','CPU and memory capacity targets are recorded for resource upgrades.','Operations administrator','Runtime resource metrics are available.','Vertical scaling limits are reviewable.','high','non_functional',ARRAY['deployment_metrics','performance_capacity_profiles']),
 ('ACC-FRS-PERF-006','Caching mechanism','Frequently accessed data can use a PostgreSQL-backed cache with TTL and hit tracking.','Platform','A cache profile is enabled.','Cache entries and hits are durable.','high','performance',ARRAY['performance_cache_entries']),
 ('ACC-FRS-PERF-007','CDN integration','Static asset delivery posture and cache policy are visible to operators.','Operations administrator','A CDN provider is configured.','CDN readiness is reviewable per environment.','medium','non_functional',ARRAY['performance_capacity_profiles']),
 ('ACC-FRS-PERF-008','Performance monitoring','Response time, error rate, throughput, and resource metrics are persisted.','Platform','Requests are processed.','Performance metrics are queryable in real time.','critical','performance',ARRAY['performance_request_metrics','deployment_metrics']),
 ('ACC-FRS-PERF-009','Peak load handling','Peak-load checks record capacity results and findings.','Operations administrator','A capacity target exists.','Peak-load evidence is stored with status.','critical','performance',ARRAY['performance_peak_load_checks']),
 ('ACC-FRS-PERF-010','Performance optimization','Optimization actions are tracked with measured before and after evidence.','Operations administrator','A performance improvement is identified.','Optimization history is reviewable.','high','performance',ARRAY['performance_optimization_actions'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
SELECT r.id, 'As an operations administrator, I want durable performance controls and evidence.', 'views/admin/performance.ejs', 'GET /admin/performance and POST /admin/performance/*', ARRAY['performance_request_metrics','performance_capacity_profiles','performance_cache_entries','performance_peak_load_checks','performance_optimization_actions'], 'Chapter 36 performance control checks', 'Growth readiness', '1.0', 'complete', 'Performance telemetry and capacity controls are PostgreSQL-backed.' FROM requirements r WHERE r.requirement_id LIKE 'ACC-FRS-PERF-%' ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_validation_rules (requirement_id, field_name, rule_key, rule_description, error_message)
SELECT r.id, v.field_name, v.rule_key, v.rule_description, v.error_message FROM requirements r JOIN (VALUES
 ('ACC-FRS-PERF-001','responseTimeMs','page_or_api_target','Page response targets are 3000 ms and API response targets are 500 ms average.','The response time is above the configured target.'),
 ('ACC-FRS-PERF-002','targetConcurrency','positive_capacity','Concurrency targets must be positive integers.','Enter a valid concurrency target.'),
 ('ACC-FRS-PERF-003','loadBalancerEnabled','proxy_posture','Production traffic distribution must record load-balancer posture.','Configure the load-balancer posture.'),
 ('ACC-FRS-PERF-004','horizontalScalingEnabled','multi_instance_posture','Scalable environments must record horizontal scaling readiness.','Configure horizontal scaling readiness.'),
 ('ACC-FRS-PERF-005','cpuLimitPercent','bounded_resource_limit','CPU and memory thresholds must be between 1 and 100 percent.','Enter a resource threshold between 1 and 100.'),
 ('ACC-FRS-PERF-006','cacheKey','ttl_cache_entry','Cache entries require a key, JSON payload, and positive TTL.','Enter a valid cache entry.'),
 ('ACC-FRS-PERF-007','cdnProvider','delivery_provider','CDN-enabled environments must identify a delivery provider.','Identify the CDN provider.'),
 ('ACC-FRS-PERF-008','requestMetric','durable_metric','Request metrics must persist response time, status, error, and timestamp.','The performance metric is incomplete.'),
 ('ACC-FRS-PERF-009','requestedConcurrency','peak_check','Peak-load checks require a positive requested concurrency and recorded result.','Enter a valid peak-load check.'),
 ('ACC-FRS-PERF-010','optimizationAction','measured_improvement','Optimization actions should retain baseline and measured evidence when completed.','Add before-and-after performance evidence.')
) AS v(requirement_key, field_name, rule_key, rule_description, error_message) ON r.requirement_id = v.requirement_key ON CONFLICT (requirement_id, field_name, rule_key) DO NOTHING;
INSERT INTO requirement_compliance_controls (requirement_id, framework, control_key, control_description, status, evidence_reference)
SELECT r.id, 'Performance operations', v.control_key, v.control_description, 'implemented', v.evidence_reference FROM requirements r JOIN (VALUES
 ('ACC-FRS-PERF-001','PERF-RESP-01','Response targets are visible and supported by request timing telemetry.','performance_request_metrics'), ('ACC-FRS-PERF-002','PERF-CONC-01','Concurrency capacity is explicitly configured by environment.','performance_capacity_profiles'), ('ACC-FRS-PERF-003','PERF-LB-01','Load-balancer readiness is recorded per environment.','performance_capacity_profiles'), ('ACC-FRS-PERF-004','PERF-HS-01','Horizontal scaling posture is recorded alongside deployment instance ranges.','performance_capacity_profiles and deployment_environments'), ('ACC-FRS-PERF-005','PERF-VS-01','Vertical resource thresholds are recorded and reviewable.','performance_capacity_profiles and deployment_metrics'), ('ACC-FRS-PERF-006','PERF-CACHE-01','Cache payloads, TTLs, and hits are persisted in PostgreSQL.','performance_cache_entries'), ('ACC-FRS-PERF-007','PERF-CDN-01','CDN provider and enabled state are visible to operators.','performance_capacity_profiles'), ('ACC-FRS-PERF-008','PERF-MON-01','Latency, throughput, error, and resource metrics are queryable.','performance_request_metrics and deployment_metrics'), ('ACC-FRS-PERF-009','PERF-PEAK-01','Peak-load checks retain status, concurrency, latency, and error evidence.','performance_peak_load_checks'), ('ACC-FRS-PERF-010','PERF-OPT-01','Optimization actions retain measurable before-and-after evidence.','performance_optimization_actions')
) AS v(requirement_key, control_key, control_description, evidence_reference) ON r.requirement_id = v.requirement_key ON CONFLICT (requirement_id, framework, control_key) DO NOTHING;
INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary) SELECT id, version, 'created', 'Chapter 36 performance and scalability baseline.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-PERF-%' ON CONFLICT (requirement_id, version) DO NOTHING;

-- ========================================
-- CHAPTER 3: ROLE-BASED ACCESS CONTROL
-- ========================================

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  role_key VARCHAR(60) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  hierarchy_level INTEGER NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  permission_key VARCHAR(120) NOT NULL UNIQUE,
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(30) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'approve', 'reject', 'manage')),
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

INSERT INTO roles (role_key, display_name, hierarchy_level, description)
VALUES
  ('registered_user', 'Registered User', 2, 'A registered account with access to authenticated platform features.'),
  ('verified_user', 'Verified User', 3, 'A user who has completed account verification.'),
  ('business_member', 'Business Member', 4, 'A user who owns or belongs to a business.'),
  ('business_admin', 'Business Admin', 5, 'A user who manages a business profile and operations.'),
  ('moderator', 'Moderator', 6, 'A platform operator who reviews community, marketplace, and dispute activity.'),
  ('compliance_officer', 'Compliance Officer', 7, 'An administrator who reviews requirements, audit evidence, and regulatory controls.'),
  ('platform_admin', 'Platform Admin', 11, 'An administrator who manages users and platform activity.'),
  ('system_admin', 'System Administrator', 12, 'An administrator who manages platform operations and configuration.'),
  ('support_staff', 'Support Staff', 13, 'A support operator who assists members and reviews account activity.'),
  ('data_analyst', 'Data Analyst', 16, 'An analyst who prepares authorized platform and business insights.'),
  ('acc_management_admin', 'ACC Management Administrator', 14, 'The dedicated administrator for the ACC management dashboard.'),
  ('super_admin', 'Super Admin', 15, 'The highest platform administration role.')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO permissions (permission_key, resource, action, description)
VALUES
  ('users.create', 'users', 'create', 'Create user accounts.'),
  ('users.read', 'users', 'read', 'View user accounts and access status.'),
  ('users.update', 'users', 'update', 'Update user access and account details.'),
  ('users.delete', 'users', 'delete', 'Delete or deactivate user accounts.'),
  ('users.approve', 'users', 'approve', 'Approve user access requests.'),
  ('users.reject', 'users', 'reject', 'Reject user access requests.'),
  ('users.manage', 'users', 'manage', 'Manage user access roles.'),
  ('businesses.create', 'businesses', 'create', 'Create a business account.'),
  ('businesses.read', 'businesses', 'read', 'View business information.'),
  ('businesses.update', 'businesses', 'update', 'Update business information.'),
  ('businesses.delete', 'businesses', 'delete', 'Remove a business account.'),
  ('businesses.approve', 'businesses', 'approve', 'Approve a business account.'),
  ('businesses.reject', 'businesses', 'reject', 'Reject a business account.'),
  ('businesses.manage', 'businesses', 'manage', 'Manage owned or assigned business operations.'),
  ('requirements.read', 'requirements', 'read', 'View requirement coverage and traceability.'),
  ('requirements.manage', 'requirements', 'manage', 'Maintain requirements, validation rules, and compliance evidence.'),
  ('platform_overview.read', 'platform_overview', 'read', 'View system architecture, operating environment, and integration health.'),
  ('platform_overview.manage', 'platform_overview', 'manage', 'Update external integration status and operational notes.'),
  ('platform.audit.read', 'platform_audit', 'read', 'View platform audit activity.'),
  ('platform.settings.manage', 'platform_settings', 'manage', 'Manage platform access settings.'),
  ('admin.users.manage', 'admin_users', 'manage', 'Suspend, activate, and assign roles to user accounts.'),
  ('admin.businesses.manage', 'admin_businesses', 'manage', 'Approve, verify, restrict, and remove businesses.'),
  ('admin.moderation.manage', 'admin_moderation', 'manage', 'Review and action reported platform content.'),
  ('admin.settings.manage', 'admin_settings', 'manage', 'Manage platform settings and feature flags.'),
  ('admin.monitoring.read', 'admin_monitoring', 'read', 'View platform activity and performance metrics.'),
  ('admin.reports.read', 'admin_reports', 'read', 'Generate and export platform reports.'),
  ('admin.logs.read', 'admin_logs', 'read', 'Search platform and administrative logs.')
  ,('admin.security.read', 'admin_security', 'read', 'View security monitoring, alerts, and security audit events.')
  ,('admin.deployment.read', 'admin_deployment', 'read', 'View deployment environments, health metrics, releases, alerts, and backups.')
  ,('admin.deployment.manage', 'admin_deployment', 'manage', 'Manage deployment status, release records, monitoring, and backup operations.')
  ,('admin.api.manage', 'api_management', 'manage', 'Manage API clients, keys, webhooks, and integration settings.')
  ,('admin.api.monitor', 'api_monitoring', 'read', 'View API traffic, rate limits, errors, and delivery metrics.')
  ,('api.users.read', 'api_users', 'read', 'Read users through the versioned external API.')
  ,('api.businesses.read', 'api_businesses', 'read', 'Read businesses through the versioned external API.')
  ,('api.listings.read', 'api_listings', 'read', 'Read marketplace listings through the versioned external API.')
  ,('api.orders.read', 'api_orders', 'read', 'Read authorized orders through the versioned external API.')
  ,('api.payments.read', 'api_payments', 'read', 'Read authorized payments through the versioned external API.')
  ,('analytics.global.read', 'analytics', 'read', 'View global platform analytics.')
  ,('analytics.business.read', 'analytics', 'read', 'View authorized business analytics.')
  ,('analytics.reports.export', 'analytics_reports', 'manage', 'Generate and export analytics reports.')
  ,('admin.support.read', 'admin_support', 'read', 'View customer-care handoffs created by the ACC Assistant.')
  ,('admin.support.manage', 'admin_support', 'manage', 'Claim, respond to, and resolve customer-care handoffs.')
  ,('admin.data.read', 'admin_data', 'read', 'View data catalog, integrity, lifecycle, backup, recovery, and audit evidence.')
  ,('admin.data.manage', 'admin_data', 'manage', 'Manage data integrity checks, archives, versions, backups, and recovery requests.')
  ,('admin.performance.read', 'admin_performance', 'read', 'View performance telemetry, capacity, scaling, caching, CDN, and optimization evidence.')
  ,('admin.performance.manage', 'admin_performance', 'manage', 'Manage performance profiles, peak-load checks, and optimization actions.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('compliance_officer', 'platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key IN ('admin.data.read', 'admin.data.manage', 'admin.performance.read', 'admin.performance.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'business_admin' AND p.permission_key = 'businesses.manage'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin', 'super_admin')
  AND p.resource IN ('users', 'businesses', 'requirements', 'platform_overview', 'platform_audit', 'platform_settings')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'acc_management_admin'
  AND p.resource IN ('users', 'businesses', 'requirements', 'platform_overview', 'platform_audit', 'platform_settings')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'compliance_officer' AND p.permission_key IN ('requirements.read', 'platform_overview.read', 'platform.audit.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key LIKE 'admin.%'
ON CONFLICT DO NOTHING;

-- Chapter 29 API management access is restricted to platform operators.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key IN ('admin.api.manage', 'admin.api.monitor')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key IN ('api.users.read', 'api.businesses.read', 'api.listings.read', 'api.orders.read', 'api.payments.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'system_admin'
  AND p.permission_key IN ('users.read', 'requirements.read', 'platform_overview.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'moderator' AND p.permission_key = 'admin.moderation.manage'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'support_staff' AND p.permission_key IN ('admin.users.manage', 'admin.businesses.manage', 'admin.logs.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('support_staff', 'platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key IN ('admin.support.read', 'admin.support.manage')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'compliance_officer' AND p.permission_key IN ('admin.reports.read', 'admin.logs.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('data_analyst', 'platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
  AND p.permission_key IN ('analytics.global.read', 'analytics.reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('verified_user', 'business_member', 'business_admin')
  AND p.permission_key IN ('analytics.business.read', 'analytics.reports.export')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('business_admin', 'business_member') AND p.permission_key = 'analytics.business.read'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key = 'moderator' AND p.permission_key = 'platform_overview.read'
ON CONFLICT DO NOTHING;

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

-- ========================================
-- CHAPTER 28: SECURITY & ACCESS CONTROL
-- ========================================

CREATE TABLE security_policies (
  policy_key VARCHAR(100) PRIMARY KEY,
  policy_value JSONB NOT NULL,
  description TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  identifier_hash VARCHAR(128) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  outcome VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_mfa_methods (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_type VARCHAR(30) NOT NULL CHECK (method_type IN ('email', 'sms', 'authenticator')),
  secret_ciphertext TEXT,
  destination VARCHAR(255),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, method_type)
);

CREATE TABLE security_mfa_challenges (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method_id BIGINT NOT NULL REFERENCES security_mfa_methods(id) ON DELETE CASCADE,
  challenge_hash VARCHAR(128) NOT NULL UNIQUE,
  code_hash VARCHAR(128) NOT NULL,
  purpose VARCHAR(40) NOT NULL CHECK (purpose IN ('login', 'enrollment', 'sensitive_action')),
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE security_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  alert_type VARCHAR(80) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'acknowledged', 'resolved')),
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE security_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL,
  outcome VARCHAR(80) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO security_policies (policy_key, policy_value, description)
VALUES
  ('login_lockout', '{"maxAttempts":5,"durationMinutes":10}'::jsonb, 'Repeated failed login protection.'),
  ('mfa_challenge', '{"expiryMinutes":10,"maxAttempts":5}'::jsonb, 'MFA challenge lifetime and retry limit.'),
  ('session', '{"timeoutMinutes":30,"rememberDays":7}'::jsonb, 'Authenticated session lifetime defaults.')
ON CONFLICT (policy_key) DO NOTHING;

CREATE INDEX idx_security_login_attempts_user_created ON security_login_attempts(user_id, created_at DESC);
CREATE INDEX idx_security_login_attempts_ip_created ON security_login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_security_login_attempts_outcome ON security_login_attempts(outcome, created_at DESC);
CREATE INDEX idx_security_mfa_methods_user ON security_mfa_methods(user_id, enabled);
CREATE INDEX idx_security_mfa_challenges_user ON security_mfa_challenges(user_id, expires_at);
CREATE INDEX idx_security_alerts_user_status ON security_alerts(user_id, status, created_at DESC);
CREATE INDEX idx_security_alerts_created ON security_alerts(created_at DESC);
CREATE INDEX idx_security_audit_logs_user_created ON security_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_security_audit_logs_event_created ON security_audit_logs(event_type, created_at DESC);

-- ========================================
-- CHAPTER 29: API & INTEGRATION SYSTEM
-- ========================================

-- API clients identify external developers, partner systems, and mobile applications.
CREATE TABLE api_clients (
  id BIGSERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_name VARCHAR(160) NOT NULL,
  client_type VARCHAR(40) NOT NULL DEFAULT 'partner' CHECK (client_type IN ('developer', 'partner', 'mobile', 'internal')),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked')),
  description TEXT,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute > 0),
  allowed_origins JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Only a non-reversible hash is persisted. The raw key is shown once at creation.
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
  key_prefix VARCHAR(24) NOT NULL,
  key_hash VARCHAR(128) NOT NULL UNIQUE,
  label VARCHAR(120) NOT NULL DEFAULT 'Primary key',
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);

-- Request-level telemetry supports volume, error-rate, latency, auth, and audit reporting.
CREATE TABLE api_request_logs (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT REFERENCES api_clients(id) ON DELETE SET NULL,
  api_key_id BIGINT REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT 'v1',
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_id VARCHAR(100),
  error_code VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Database-backed fixed windows prevent rate-limit state from disappearing on restart.
CREATE TABLE api_rate_limit_windows (
  client_id BIGINT NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
  window_started_at TIMESTAMP NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, window_started_at)
);

CREATE TABLE webhook_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
  target_url VARCHAR(500) NOT NULL,
  secret_hash VARCHAR(128) NOT NULL,
  event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_deliveries (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_type VARCHAR(120) NOT NULL,
  event_id VARCHAR(120) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  attempts INTEGER NOT NULL DEFAULT 0,
  response_code INTEGER,
  response_body TEXT,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_clients_owner_status ON api_clients(owner_id, status);
CREATE INDEX idx_api_keys_client_status ON api_keys(client_id, status);
CREATE INDEX idx_api_request_logs_created ON api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_client_created ON api_request_logs(client_id, created_at DESC);
CREATE INDEX idx_api_request_logs_status ON api_request_logs(status_code, created_at DESC);
CREATE INDEX idx_api_rate_limit_windows_updated ON api_rate_limit_windows(updated_at);
CREATE INDEX idx_webhook_subscriptions_client_status ON webhook_subscriptions(client_id, status);
CREATE INDEX idx_webhook_deliveries_queue ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id, created_at DESC);

-- Chapter 2: external service registry and operational integration status.
CREATE TABLE platform_integrations (
  id SERIAL PRIMARY KEY,
  integration_key VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  integration_type VARCHAR(40) NOT NULL CHECK (integration_type IN ('payment', 'notification', 'hosting', 'cloud', 'other')),
  provider VARCHAR(120) NOT NULL,
  environment VARCHAR(30) NOT NULL DEFAULT 'production' CHECK (environment IN ('development', 'staging', 'production')),
  status VARCHAR(30) NOT NULL DEFAULT 'configured' CHECK (status IN ('configured', 'healthy', 'degraded', 'unavailable', 'not_configured')),
  endpoint_reference VARCHAR(255),
  last_checked_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_integration_events (
  id SERIAL PRIMARY KEY,
  integration_id INTEGER NOT NULL REFERENCES platform_integrations(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_integrations_type_status ON platform_integrations(integration_type, status);
CREATE INDEX idx_platform_integration_events_integration ON platform_integration_events(integration_id, created_at DESC);

-- ========================================
-- CHAPTER 30: SYSTEM DEPLOYMENT & INFRASTRUCTURE
-- ========================================

CREATE TABLE deployment_environments (
  id SERIAL PRIMARY KEY,
  environment_key VARCHAR(30) NOT NULL UNIQUE CHECK (environment_key IN ('development', 'qa', 'staging', 'production')),
  display_name VARCHAR(100) NOT NULL,
  provider VARCHAR(120) NOT NULL,
  region VARCHAR(120),
  base_url VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'healthy', 'degraded', 'maintenance', 'offline')),
  desired_instances INTEGER NOT NULL DEFAULT 1 CHECK (desired_instances > 0),
  min_instances INTEGER NOT NULL DEFAULT 1 CHECK (min_instances > 0),
  max_instances INTEGER NOT NULL DEFAULT 1 CHECK (max_instances >= min_instances),
  isolation_notes TEXT,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deployment_releases (
  id BIGSERIAL PRIMARY KEY,
  environment_id INTEGER NOT NULL REFERENCES deployment_environments(id) ON DELETE CASCADE,
  version VARCHAR(120) NOT NULL,
  commit_sha VARCHAR(120),
  pipeline_url VARCHAR(500),
  status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'building', 'deployed', 'failed', 'rolled_back')),
  deployed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  notes TEXT,
  UNIQUE (environment_id, version)
);

CREATE TABLE deployment_metrics (
  id BIGSERIAL PRIMARY KEY,
  environment_id INTEGER NOT NULL REFERENCES deployment_environments(id) ON DELETE CASCADE,
  cpu_percent NUMERIC(6,2) NOT NULL CHECK (cpu_percent >= 0),
  memory_percent NUMERIC(6,2) NOT NULL CHECK (memory_percent >= 0),
  response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  error_rate NUMERIC(7,4) NOT NULL DEFAULT 0 CHECK (error_rate >= 0),
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deployment_alerts (
  id BIGSERIAL PRIMARY KEY,
  environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE CASCADE,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  alert_type VARCHAR(80) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMP,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP
);

CREATE TABLE deployment_backups (
  id BIGSERIAL PRIMARY KEY,
  environment_id INTEGER NOT NULL REFERENCES deployment_environments(id) ON DELETE CASCADE,
  backup_type VARCHAR(30) NOT NULL CHECK (backup_type IN ('scheduled', 'manual', 'restore_test')),
  status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'running', 'completed', 'failed', 'restored')),
  storage_reference VARCHAR(500),
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  verified_at TIMESTAMP,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);

ALTER TABLE data_recovery_requests
  ADD CONSTRAINT data_recovery_requests_backup_id_fkey
  FOREIGN KEY (backup_id) REFERENCES deployment_backups(id) ON DELETE SET NULL;

CREATE TABLE deployment_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  outcome VARCHAR(50) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployment_releases_environment ON deployment_releases(environment_id, started_at DESC);
CREATE INDEX idx_deployment_metrics_environment ON deployment_metrics(environment_id, captured_at DESC);
CREATE INDEX idx_deployment_alerts_status ON deployment_alerts(status, triggered_at DESC);
CREATE INDEX idx_deployment_backups_environment ON deployment_backups(environment_id, started_at DESC);
CREATE INDEX idx_deployment_audit_created ON deployment_audit_logs(created_at DESC);

INSERT INTO deployment_environments (environment_key, display_name, provider, region, base_url, status, desired_instances, min_instances, max_instances, isolation_notes, configuration)
VALUES
  ('development', 'Development', 'Local / developer workstation', 'local', 'http://localhost:5500', 'planned', 1, 1, 1, 'Developer-only credentials and data boundary.', '{"pipeline":"manual","containerized":true}'::jsonb),
  ('qa', 'Quality assurance', 'Cloud deployment target', 'configured per deployment', NULL, 'planned', 1, 1, 2, 'Dedicated test database and isolated credentials.', '{"pipeline":"ci","containerized":true}'::jsonb),
  ('staging', 'Staging', 'Cloud deployment target', 'configured per deployment', NULL, 'planned', 2, 1, 4, 'Production-shaped environment with separate secrets and database.', '{"pipeline":"cd","containerized":true}'::jsonb),
  ('production', 'Production', 'Render / AWS / Azure / GCP', 'configured per deployment', NULL, 'planned', 2, 2, 10, 'Private database access, TLS, restricted operators, and isolated secrets.', '{"pipeline":"protected-cd","containerized":true,"load_balancer":true,"autoscaling":true}'::jsonb)
ON CONFLICT (environment_key) DO NOTHING;

INSERT INTO platform_integrations (integration_key, display_name, integration_type, provider, environment, status, endpoint_reference, notes)
VALUES
  ('primary_database', 'PostgreSQL system of record', 'cloud', 'PostgreSQL', 'production', 'healthy', 'DATABASE_URL', 'All authenticated sessions, commerce records, requirements, and audit data persist here.'),
  ('payment_gateway', 'Payment gateway', 'payment', 'Paystack-compatible gateway', 'production', 'configured', 'PAYMENT_GATEWAY_URL', 'Payment initiation and gateway events are linked to orders and audit records.'),
  ('notification_delivery', 'Notification delivery', 'notification', 'SMTP / in-app delivery', 'production', 'configured', 'SMTP_HOST', 'In-app notifications are persisted; external delivery depends on deployment configuration.'),
  ('cloud_hosting', 'Cloud hosting', 'hosting', 'Render', 'production', 'configured', 'APP_URL', 'The web process uses PostgreSQL because local upload storage is ephemeral on cloud hosting.')
ON CONFLICT (integration_key) DO NOTHING;

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
  country_of_residence VARCHAR(120) NOT NULL,
  country_of_registration VARCHAR(120) NOT NULL,
  business_address TEXT NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50) NOT NULL,
  industry_category VARCHAR(120) NOT NULL,
  registration_number VARCHAR(120),
  tax_identification_number VARCHAR(120),
  website VARCHAR(255),
  business_description TEXT,
  logo TEXT,
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

CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, role_id, business_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_user_roles_business_id ON user_roles(business_id);
CREATE UNIQUE INDEX idx_user_roles_global_unique ON user_roles(user_id, role_id) WHERE business_id IS NULL;

-- Backfill normalized roles for accounts created with the legacy users.role column.
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_key = CASE u.role
  WHEN 'super_admin' THEN 'super_admin'
  WHEN 'acc_management_admin' THEN 'acc_management_admin'
  ELSE 'registered_user'
END
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.role_key = 'verified_user'
WHERE u.email_verified = TRUE OR u.status = 'active'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id, business_id, assigned_by)
SELECT ba.owner_id, r.id, ba.id, ba.owner_id
FROM business_accounts ba
JOIN roles r ON r.role_key IN ('business_member', 'business_admin')
ON CONFLICT DO NOTHING;

-- Dedicated ACC Management administrator. Everyone still signs in through /login.
-- Login email: acc.management@acc.com
-- Login password: ACCadmin@2026!
INSERT INTO users (
  first_name, last_name, name, email, country, password_hash, role, status,
  registration_state, email_verified, phone_verified, consent_terms,
  consent_privacy, terms_version, privacy_version
)
VALUES (
  'ACC', 'Management', 'ACC Management Administrator', 'acc.management@acc.com', 'Nigeria',
  '$2b$10$fB03P0eN4Exph0WWKJeOJeBuwkCyyJVeWkXvYuemL.QTKB5ACjZQa',
  'acc_management_admin', 'active', 'completed', TRUE, TRUE, TRUE, TRUE, 'v1', 'v1'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'acc_management_admin',
  status = 'active',
  registration_state = 'completed',
  email_verified = TRUE,
  phone_verified = TRUE,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE u.email = 'acc.management@acc.com'
  AND r.role_key = 'acc_management_admin'
ON CONFLICT DO NOTHING;

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
ALTER TABLE business_accounts ADD COLUMN IF NOT EXISTS country_of_residence VARCHAR(120);
ALTER TABLE business_accounts ALTER COLUMN logo TYPE TEXT;

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
  country_of_residence,
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
WHERE u.email = 'acc.management@acc.com'
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
  flyer_path VARCHAR(255),
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
ALTER TABLE event_records ADD COLUMN IF NOT EXISTS flyer_path VARCHAR(255);
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
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_visibility ON marketplace_listings(visibility);

-- Chapter 4: PostgreSQL-backed shopping cart persistence.
CREATE TABLE shopping_carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cart_id, listing_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_listing_id ON cart_items(listing_id);

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

CREATE TABLE IF NOT EXISTS procurement_rfq_suppliers (
  rfq_id INTEGER NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rfq_id, supplier_id)
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

CREATE TABLE IF NOT EXISTS contract_parties (
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (contract_id, user_id)
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (contract_id, version)
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

-- ========================================
-- CHAPTER 14: NORMALIZED MESSAGING SCHEMA
-- ========================================

CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL DEFAULT 'user_to_user',
  subject VARCHAR(255) NOT NULL DEFAULT 'Conversation',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  type VARCHAR(30) NOT NULL DEFAULT 'text',
  status VARCHAR(30) NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS message_deletions (
  message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS messaging_blocks (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, target_id),
  CHECK (user_id <> target_id)
);

CREATE TABLE IF NOT EXISTS messaging_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messaging_notifications (
  id BIGSERIAL PRIMARY KEY,
  notification_type VARCHAR(120) NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_status ON messages(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_message_deletions_user ON message_deletions(user_id, message_id);
CREATE INDEX IF NOT EXISTS idx_messaging_blocks_user_target ON messaging_blocks(user_id, target_id);
CREATE INDEX IF NOT EXISTS idx_messaging_audit_created ON messaging_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messaging_notifications_user_created ON messaging_notifications(user_id, created_at DESC);

-- Assistant handoffs keep customer-care context durable without exposing private data to the assistant.
CREATE TABLE IF NOT EXISTS assistant_support_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  visitor_name VARCHAR(200),
  visitor_email VARCHAR(255),
  question TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'waiting', 'resolved', 'closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assistant_support_messages (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES assistant_support_requests(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_type VARCHAR(20) NOT NULL CHECK (author_type IN ('assistant', 'customer', 'agent')),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assistant_support_requests_queue ON assistant_support_requests(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_support_requests_assigned ON assistant_support_requests(assigned_to, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_support_messages_request ON assistant_support_messages(request_id, created_at);

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

-- ========================================
-- CHAPTER 26: ADMINISTRATION & SYSTEM MANAGEMENT
-- ========================================

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  value_type VARCHAR(30) NOT NULL DEFAULT 'json',
  description TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_feature_flags (
  id SERIAL PRIMARY KEY,
  feature_key VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- CHAPTER 27: ANALYTICS & REPORTING SYSTEM
-- ========================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  business_id INTEGER REFERENCES business_accounts(id) ON DELETE SET NULL,
  event_name VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80),
  resource_id VARCHAR(120),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_report_audits (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  report_type VARCHAR(80) NOT NULL,
  format VARCHAR(20) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_time ON analytics_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_business_time ON analytics_events(business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_time ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_report_audits_user_time ON analytics_report_audits(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id VARCHAR(120),
  outcome VARCHAR(30) NOT NULL DEFAULT 'success',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_moderation_reports (
  id BIGSERIAL PRIMARY KEY,
  content_type VARCHAR(30) NOT NULL CHECK (content_type IN ('listing', 'review', 'message')),
  content_id BIGINT NOT NULL,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(120) NOT NULL,
  details TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  action_taken VARCHAR(80),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_feature_flags_key ON system_feature_flags(feature_key);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON admin_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_moderation_queue ON admin_moderation_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_moderation_content ON admin_moderation_reports(content_type, content_id);

INSERT INTO system_settings (setting_key, setting_value, value_type, description)
VALUES
  ('notification.default_channels', '["in_app", "email"]'::jsonb, 'json', 'Default notification delivery channels.'),
  ('payment.currency', '"USD"'::jsonb, 'string', 'Default platform currency.'),
  ('payment.gateway_mode', '"configured"'::jsonb, 'string', 'Payment gateway operating mode.'),
  ('moderation.auto_publish_listings', 'true'::jsonb, 'boolean', 'Whether new marketplace listings publish automatically.')
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO system_feature_flags (feature_key, display_name, enabled, description)
VALUES
  ('marketplace', 'Marketplace', TRUE, 'Marketplace browsing and listing workflows.'),
  ('messaging', 'Messaging', TRUE, 'Member-to-member messaging workflows.'),
  ('procurement', 'Procurement', TRUE, 'B2B sourcing and tender workflows.'),
  ('events', 'Events', TRUE, 'Events and registration workflows.'),
  ('payments', 'Payments', TRUE, 'Payment and transaction workflows.')
ON CONFLICT (feature_key) DO NOTHING;

-- Chapter 34: Compliance and regulatory controls.
CREATE TABLE IF NOT EXISTS compliance_policies (id BIGSERIAL PRIMARY KEY, policy_key VARCHAR(80) NOT NULL UNIQUE, name VARCHAR(180) NOT NULL, description TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS compliance_policy_versions (id BIGSERIAL PRIMARY KEY, policy_id BIGINT NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE, version VARCHAR(40) NOT NULL, content TEXT NOT NULL, effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, published_by BIGINT REFERENCES users(id) ON DELETE SET NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (policy_id, version));
CREATE TABLE IF NOT EXISTS user_consent_records (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE, policy_id BIGINT NOT NULL REFERENCES compliance_policies(id) ON DELETE RESTRICT, policy_version_id BIGINT NOT NULL REFERENCES compliance_policy_versions(id) ON DELETE RESTRICT, consented BOOLEAN NOT NULL, ip_address INET, user_agent TEXT, consented_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS compliance_kyc_cases (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(30) NOT NULL DEFAULT 'not_started', risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown', reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL, decision_notes TEXT, submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS compliance_kyc_documents (id BIGSERIAL PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES compliance_kyc_cases(id) ON DELETE CASCADE, document_type VARCHAR(60) NOT NULL, storage_path TEXT NOT NULL, original_name TEXT NOT NULL, mime_type VARCHAR(120) NOT NULL, file_size INTEGER NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL, review_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS compliance_business_cases (id BIGSERIAL PRIMARY KEY, business_id BIGINT NOT NULL UNIQUE REFERENCES business_accounts(id) ON DELETE CASCADE, status VARCHAR(30) NOT NULL DEFAULT 'submitted', risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown', reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL, decision_notes TEXT, submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS compliance_transaction_flags (id BIGSERIAL PRIMARY KEY, payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL, order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, rule_key VARCHAR(100) NOT NULL, severity VARCHAR(20) NOT NULL DEFAULT 'medium', reason TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'open', reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL, resolution_notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS compliance_aml_restrictions (id BIGSERIAL PRIMARY KEY, user_id BIGINT REFERENCES users(id) ON DELETE CASCADE, business_id BIGINT REFERENCES business_accounts(id) ON DELETE CASCADE, reason TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, lifted_by BIGINT REFERENCES users(id) ON DELETE SET NULL, lifted_at TIMESTAMPTZ, CHECK (user_id IS NOT NULL OR business_id IS NOT NULL));
CREATE TABLE IF NOT EXISTS compliance_cross_border_rules (id BIGSERIAL PRIMARY KEY, origin_country VARCHAR(3) NOT NULL, destination_country VARCHAR(3) NOT NULL, action VARCHAR(30) NOT NULL DEFAULT 'review', reason TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (origin_country, destination_country));
CREATE TABLE IF NOT EXISTS compliance_regulatory_reports (id BIGSERIAL PRIMARY KEY, report_type VARCHAR(80) NOT NULL, filters JSONB NOT NULL DEFAULT '{}'::jsonb, row_count INTEGER NOT NULL DEFAULT 0, generated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS compliance_audit_logs (id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, subject_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, event_type VARCHAR(120) NOT NULL, entity_type VARCHAR(80), entity_id BIGINT, outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address INET, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT INTO compliance_policies (policy_key, name, description) VALUES ('terms','Terms of Service','The terms governing use of the ACC platform.'), ('privacy','Privacy Policy','How ACC collects, uses, stores, and protects personal data.'), ('aml','AML and Sanctions Policy','Anti-money laundering, counter-terrorist financing, and sanctions controls.') ON CONFLICT (policy_key) DO NOTHING;
INSERT INTO compliance_policy_versions (policy_id, version, content) SELECT id, '1.0', name || E'\n\n' || description FROM compliance_policies ON CONFLICT (policy_id, version) DO NOTHING;
CREATE INDEX IF NOT EXISTS compliance_flags_status_idx ON compliance_transaction_flags(status, severity);
CREATE INDEX IF NOT EXISTS compliance_audit_created_idx ON compliance_audit_logs(created_at DESC);

INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies)
VALUES
 ('FR-COMP-001','Consent and policy versioning','Users can review active legal policies and durable consent history is recorded by version.','Member','Active policy versions exist.','Consent records are persisted and auditable.','critical','functional',ARRAY['users','compliance_policies','user_consent_records']),
 ('FR-COMP-002','Privacy and data protection','Personal data processing is presented through an accessible privacy policy and protected workflows.','Member','User is authenticated for private data.','Access is authenticated and policy activity is audited.','critical','security',ARRAY['compliance_policies','compliance_audit_logs']),
 ('FR-COMP-003','Identity KYC workflow','Members can submit identity documents and authorized staff can review the KYC case.','Member and compliance reviewer','Member has an account.','KYC status and document metadata are persisted.','critical','functional',ARRAY['compliance_kyc_cases','compliance_kyc_documents']),
 ('FR-COMP-004','Business verification controls','Business verification submissions create a reviewable compliance case.','Business owner and compliance reviewer','Business registration exists.','Business compliance status is queued and audited.','critical','functional',ARRAY['business_accounts','compliance_business_cases']),
 ('FR-COMP-005','Transaction monitoring','Risk signals can be recorded against payments and orders for review.','Compliance reviewer','Payment or order exists.','Flags have severity, reason, status, and audit history.','critical','functional',ARRAY['payments','orders','compliance_transaction_flags']),
 ('FR-COMP-006','AML restrictions','Active AML restrictions prevent restricted users or businesses from initiating payments.','Compliance reviewer','A restriction is active.','Restricted payment requests are denied and auditable.','critical','security',ARRAY['compliance_aml_restrictions','payments']),
 ('FR-COMP-007','Regulatory reporting','Report metadata can be persisted for regulatory reporting and traceability.','Compliance reviewer','Authorized report access exists.','Report generation is attributable and retained.','high','functional',ARRAY['compliance_regulatory_reports','compliance_audit_logs']),
 ('FR-COMP-008','Cross-border controls','Origin and destination rules can be catalogued for cross-border review decisions.','Compliance reviewer','A country rule is configured.','Cross-border controls are durable and active-aware.','high','functional',ARRAY['compliance_cross_border_rules']),
 ('FR-COMP-009','Compliance audit logging','Compliance actions record actor, subject, entity, outcome, and details.','Compliance reviewer','Compliance operation executes.','Audit events are retained in PostgreSQL.','critical','security',ARRAY['compliance_audit_logs']),
 ('FR-COMP-010','Compliance operations access','Compliance queues and decisions are restricted to authorized administrators.','ACC administrator','RBAC access context exists.','Unauthorized access is denied.','critical','security',ARRAY['permissions','compliance_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;

INSERT INTO permissions (permission_key, resource, action, description) VALUES
  ('admin.availability.read','admin_availability','read','View service health, uptime evidence, failover posture, incidents, and recovery activity.'),
  ('admin.availability.manage','admin_availability','manage','Run health checks, record recovery actions, and resolve availability incidents.')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin')
  AND p.permission_key IN ('admin.availability.read','admin.availability.manage')
ON CONFLICT DO NOTHING;
INSERT INTO permissions (permission_key, resource, action, description) VALUES
  ('admin.support.read','admin_support','read','View support tickets, SLAs, maintenance windows, help content, and analytics.'),
  ('admin.support.manage','admin_support','manage','Manage tickets, maintenance windows, knowledge content, logs, and improvements.'),
  ('admin.logging.read','admin_logging','read','View application, error, security, audit, retention, and monitoring logs.'),
  ('admin.logging.manage','admin_logging','manage','Acknowledge log alerts and manage logging controls.'),
  ('admin.qa.read','admin_qa','read','View QA plans, test cases, runs, defects, and reports.'),
  ('admin.qa.manage','admin_qa','manage','Create and execute QA tests, track defects, and generate reports.'),
  ('admin.release.read','admin_release','read','View versions, release plans, notes, compatibility, monitoring, and audit history.'),
  ('admin.release.manage','admin_release','manage','Plan releases, deploy or rollback versions, manage flags, notes, compatibility, and monitoring.')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin')
  AND p.permission_key IN ('admin.support.read','admin.support.manage','admin.logging.read','admin.logging.manage','admin.qa.read','admin.qa.manage','admin.release.read','admin.release.manage')
ON CONFLICT DO NOTHING;

-- ========================================
-- CHAPTER 42: DATA MIGRATION & ONBOARDING
-- ========================================

CREATE TABLE onboarding_profiles (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  onboarding_type VARCHAR(20) NOT NULL CHECK (onboarding_type IN ('individual','business','enterprise')),
  current_step VARCHAR(60) NOT NULL DEFAULT 'account', progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','paused')),
  guidance JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE migration_jobs (
  id BIGSERIAL PRIMARY KEY, job_key VARCHAR(50) NOT NULL UNIQUE,
  import_type VARCHAR(20) NOT NULL CHECK (import_type IN ('users','businesses')),
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('manual','file','api')),
  source_name VARCHAR(255), file_name VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','validating','processing','completed','completed_with_errors','failed')),
  total_rows INTEGER NOT NULL DEFAULT 0, processed_rows INTEGER NOT NULL DEFAULT 0, valid_rows INTEGER NOT NULL DEFAULT 0, imported_rows INTEGER NOT NULL DEFAULT 0, error_rows INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE migration_rows (
  id BIGSERIAL PRIMARY KEY, job_id BIGINT NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE, row_number INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valid','imported','error')),
  target_id BIGINT, errors JSONB NOT NULL DEFAULT '[]'::jsonb, processed_at TIMESTAMPTZ, UNIQUE(job_id, row_number)
);
CREATE TABLE migration_api_sources (
  id BIGSERIAL PRIMARY KEY, source_key VARCHAR(100) NOT NULL UNIQUE, source_name VARCHAR(180) NOT NULL,
  import_type VARCHAR(20) NOT NULL CHECK (import_type IN ('users','businesses')), endpoint_url VARCHAR(500), active BOOLEAN NOT NULL DEFAULT TRUE,
  last_job_id BIGINT REFERENCES migration_jobs(id) ON DELETE SET NULL, created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE onboarding_assistance (
  id BIGSERIAL PRIMARY KEY, subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('user','business','migration_job')), subject_id BIGINT NOT NULL,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL, assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','assigned','in_progress','completed','cancelled')),
  task_title VARCHAR(220) NOT NULL, notes TEXT, due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE onboarding_migration_audit_logs (
  id BIGSERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, job_id BIGINT REFERENCES migration_jobs(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_migration_jobs_status ON migration_jobs(status, created_at DESC);
CREATE INDEX idx_migration_rows_job_status ON migration_rows(job_id, status, row_number);
CREATE INDEX idx_onboarding_assistance_status ON onboarding_assistance(status, due_at);
CREATE INDEX idx_onboarding_audit_created ON onboarding_migration_audit_logs(created_at DESC);

INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-ONB-001','User onboarding','Users complete guided account and profile onboarding.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','critical','functional',ARRAY['onboarding_profiles']),
('ACC-FRS-ONB-002','Business onboarding','Businesses can register and submit documents for verification.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','critical','functional',ARRAY['business_accounts']),
('ACC-FRS-ONB-003','Bulk onboarding','Authorized operators can bulk onboard users and businesses from CSV or Excel.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','high','functional',ARRAY['migration_jobs','migration_rows']),
('ACC-FRS-ONB-004','Data migration via files','Migration jobs parse uploaded CSV and Excel files into validated records.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','high','functional',ARRAY['migration_jobs']),
('ACC-FRS-ONB-005','API-based data migration','Authorized external systems can submit migration payloads through an API.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','high','functional',ARRAY['migration_api_sources']),
('ACC-FRS-ONB-006','Data validation during migration','Required fields and supported formats are validated before storage.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','critical','security',ARRAY['migration_rows']),
('ACC-FRS-ONB-007','Migration error handling','Invalid rows are retained with clear, reviewable errors.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','high','functional',ARRAY['migration_rows']),
('ACC-FRS-ONB-008','Migration progress tracking','Migration progress is visible through durable job counters and status.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','medium','functional',ARRAY['migration_jobs']),
('ACC-FRS-ONB-009','Assisted onboarding','Operators can assign guided onboarding tasks and support notes.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','medium','functional',ARRAY['onboarding_assistance']),
('ACC-FRS-ONB-010','Onboarding and migration logging','Onboarding, imports, and errors are logged in PostgreSQL.','Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding state is durable and reviewable.','high','security',ARRAY['onboarding_migration_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As an ACC growth operator, I want migration and onboarding controls so member growth is safe.','views/admin/onboarding.ejs','GET /admin/onboarding and POST /admin/onboarding/*',ARRAY['onboarding_profiles','migration_jobs','migration_rows','migration_api_sources','onboarding_assistance','onboarding_migration_audit_logs'],'tests/chapter42-onboarding.test.js','Data Migration and Onboarding','1.0','complete','Chapter 42 onboarding controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-ONB-%' ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO permissions (permission_key, resource, action, description) VALUES
('admin.onboarding.read','admin_onboarding','read','View onboarding profiles, migration jobs, progress, errors, and assistance.'),
('admin.onboarding.manage','admin_onboarding','manage','Create migrations, process imports, configure API sources, and manage assisted onboarding.')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.onboarding.read','admin.onboarding.manage')
ON CONFLICT DO NOTHING;

-- ========================================
-- CHAPTER 43: AI & RECOMMENDATION SYSTEM
-- ========================================

CREATE TABLE ai_user_profiles (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  recommendations_enabled BOOLEAN NOT NULL DEFAULT TRUE, behavior_analysis_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  fraud_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE, personalization_scope VARCHAR(20) NOT NULL DEFAULT 'platform' CHECK (personalization_scope IN ('none','platform','business')),
  interests JSONB NOT NULL DEFAULT '[]'::jsonb, consent_version VARCHAR(40) NOT NULL DEFAULT '1.0', consented_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ai_interaction_events (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, business_id INTEGER REFERENCES business_accounts(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL, resource_type VARCHAR(60), resource_id VARCHAR(120), query_text VARCHAR(160), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ai_recommendations (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(30) NOT NULL CHECK (recommendation_type IN ('business','product','service','opportunity')), target_id BIGINT NOT NULL,
  target_type VARCHAR(40) NOT NULL, score NUMERIC(8,4) NOT NULL DEFAULT 0, reason VARCHAR(500) NOT NULL,
  model_version VARCHAR(80) NOT NULL DEFAULT 'rules-v1', feedback VARCHAR(20) CHECK (feedback IN ('positive','negative','dismissed')),
  status VARCHAR(20) NOT NULL DEFAULT 'shown' CHECK (status IN ('shown','clicked','dismissed','expired')), generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, feedback_at TIMESTAMPTZ
);
CREATE TABLE ai_search_queries (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, query_text VARCHAR(160) NOT NULL,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb, result_ids JSONB NOT NULL DEFAULT '[]'::jsonb, result_count INTEGER NOT NULL DEFAULT 0,
  ranking_version VARCHAR(80) NOT NULL DEFAULT 'rank-v1', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE ai_fraud_cases (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  subject_type VARCHAR(30) NOT NULL, subject_id BIGINT, risk_score NUMERIC(8,4) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low','medium','high','critical')), indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','confirmed','dismissed','blocked')), resolution_note TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ
);
CREATE TABLE ai_predictions (
  id BIGSERIAL PRIMARY KEY, business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  prediction_type VARCHAR(60) NOT NULL, subject_type VARCHAR(40) NOT NULL, subject_id BIGINT, forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100), horizon VARCHAR(60) NOT NULL, model_version VARCHAR(80) NOT NULL DEFAULT 'forecast-v1',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMPTZ
);
CREATE TABLE ai_alerts (
  id BIGSERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, fraud_case_id BIGINT REFERENCES ai_fraud_cases(id) ON DELETE CASCADE,
  prediction_id BIGINT REFERENCES ai_predictions(id) ON DELETE CASCADE, alert_type VARCHAR(40) NOT NULL, severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','medium','high','critical')),
  title VARCHAR(220) NOT NULL, message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','acknowledged','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, resolved_at TIMESTAMPTZ
);
CREATE TABLE ai_models (
  id BIGSERIAL PRIMARY KEY, model_key VARCHAR(100) NOT NULL, version VARCHAR(80) NOT NULL, model_type VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','testing','retired','degraded')), precision_score NUMERIC(8,4), recall_score NUMERIC(8,4), recommendation_ctr NUMERIC(8,4), false_positive_rate NUMERIC(8,4), training_events INTEGER NOT NULL DEFAULT 0, last_evaluated_at TIMESTAMPTZ, notes TEXT,
  UNIQUE(model_key, version)
);
CREATE TABLE ai_audit_logs (
  id BIGSERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, decision VARCHAR(100), model_version VARCHAR(80), details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ai_interaction_user_created ON ai_interaction_events(user_id, occurred_at DESC);
CREATE INDEX idx_ai_recommendations_user_created ON ai_recommendations(user_id, generated_at DESC);
CREATE INDEX idx_ai_search_queries_query ON ai_search_queries(query_text, created_at DESC);
CREATE INDEX idx_ai_fraud_cases_status ON ai_fraud_cases(status, risk_score DESC, detected_at DESC);
CREATE INDEX idx_ai_alerts_status ON ai_alerts(status, severity, created_at DESC);
CREATE INDEX idx_ai_audit_created ON ai_audit_logs(created_at DESC);
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-AI-001','Recommendation Engine','The system shall provide personalized recommendations for businesses, products, and services.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','high','functional',ARRAY['ai_recommendations']),
('ACC-FRS-AI-002','Smart Search','The system shall enhance search with auto-suggestions and ranked results.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','high','functional',ARRAY['ai_search_queries','marketplace_listings']),
('ACC-FRS-AI-003','Fraud Detection System','The system shall detect and flag suspicious activities and high-risk transactions.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','critical','security',ARRAY['ai_fraud_cases','ai_alerts']),
('ACC-FRS-AI-004','User Behavior Analysis','The system shall analyze user behavior patterns accurately.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','high','functional',ARRAY['ai_interaction_events']),
('ACC-FRS-AI-005','Predictive Analytics','The system shall provide useful market, demand, and business predictions.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','medium','functional',ARRAY['ai_predictions','orders']),
('ACC-FRS-AI-006','Continuous Learning','The system shall improve recommendations over time through persisted feedback and interactions.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','high','functional',ARRAY['ai_interaction_events','ai_recommendations']),
('ACC-FRS-AI-007','AI-Based Alerts','The system shall generate timely and relevant fraud and opportunity alerts.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','high','functional',ARRAY['ai_alerts']),
('ACC-FRS-AI-008','Data Privacy in AI','The system shall respect consent, minimization, access, and deletion controls for AI data.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','critical','security',ARRAY['ai_user_profiles']),
('ACC-FRS-AI-009','AI Model Monitoring','The system shall monitor model and scoring performance.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','medium','non_functional',ARRAY['ai_models']),
('ACC-FRS-AI-010','AI Activity Logging','The system shall log recommendations, alerts, searches, decisions, and model actions.','AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.','medium','security',ARRAY['ai_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As an ACC user or operator, I want intelligence controls so the platform becomes more useful and trustworthy.','views/ai/dashboard.ejs and views/admin/ai.ejs','GET /ai and GET /admin/ai',ARRAY['ai_user_profiles','ai_interaction_events','ai_recommendations','ai_search_queries','ai_fraud_cases','ai_predictions','ai_alerts','ai_models','ai_audit_logs'],'tests/chapter43-ai.test.js','AI and Recommendation System','1.0','complete','Chapter 43 intelligence controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-AI-%' ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO permissions (permission_key, resource, action, description) VALUES
('ai.recommendations.read','ai_intelligence','read','View personalized recommendations and AI insights.'),
('ai.interactions.write','ai_intelligence','write','Record consented AI interaction and recommendation feedback.'),
('admin.ai.read','admin_ai','read','View AI recommendations, fraud, alerts, predictions, and model health.'),
('admin.ai.manage','admin_ai','manage','Manage AI cases, alerts, model monitoring, privacy controls, and decisions.')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin','compliance_officer') AND p.permission_key IN ('admin.ai.read','admin.ai.manage')
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.role_key IN ('registered_user','verified_user','business_member','business_admin') AND p.permission_key IN ('ai.recommendations.read','ai.interactions.write')
ON CONFLICT DO NOTHING;

-- ========================================
-- CHAPTER 44: THIRD-PARTY ECOSYSTEM & PARTNERSHIPS
-- ========================================

CREATE TABLE partnership_partners (
  id BIGSERIAL PRIMARY KEY, legal_name VARCHAR(180) NOT NULL, display_name VARCHAR(160) NOT NULL,
  partner_type VARCHAR(40) NOT NULL CHECK (partner_type IN ('financial','logistics','government','technology','business_network')),
  country_code VARCHAR(3), contact_email VARCHAR(180) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'applicant' CHECK (status IN ('applicant','onboarding','active','suspended','rejected')),
  api_client_id BIGINT REFERENCES api_clients(id) ON DELETE SET NULL, notes TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE partnership_integrations (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, name VARCHAR(160) NOT NULL,
  integration_type VARCHAR(30) NOT NULL CHECK (integration_type IN ('api','webhook','data_sharing','embedded')), service_area VARCHAR(40) NOT NULL,
  provider VARCHAR(160) NOT NULL, endpoint_url TEXT, auth_method VARCHAR(60) NOT NULL DEFAULT 'api_key', status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','configured','healthy','degraded','unavailable','revoked')),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb, last_checked_at TIMESTAMPTZ, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE partnership_credentials (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, key_prefix VARCHAR(32) NOT NULL,
  secret_hash VARCHAR(128) NOT NULL UNIQUE, scopes JSONB NOT NULL DEFAULT '[]'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  issued_by BIGINT REFERENCES users(id) ON DELETE SET NULL, expires_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMPTZ
);
CREATE TABLE partnership_access_grants (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, scope VARCHAR(80) NOT NULL,
  granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMPTZ,
  UNIQUE (partner_id, scope)
);
CREATE TABLE partnership_verifications (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, verification_type VARCHAR(50) NOT NULL,
  reference_number VARCHAR(160), source_name VARCHAR(180) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','expired')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb, verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL, verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE partnership_exchanges (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT REFERENCES partnership_partners(id) ON DELETE SET NULL, integration_id BIGINT REFERENCES partnership_integrations(id) ON DELETE SET NULL,
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound','outbound')), event_type VARCHAR(120) NOT NULL, external_reference VARCHAR(180), payload_hash VARCHAR(128),
  encrypted BOOLEAN NOT NULL DEFAULT TRUE, authenticated BOOLEAN NOT NULL DEFAULT TRUE, status VARCHAR(30) NOT NULL DEFAULT 'received', response_code INTEGER, latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE partnership_monitoring (
  id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, average_latency_ms INTEGER NOT NULL DEFAULT 0,
  uptime_percent NUMERIC(6,2) NOT NULL DEFAULT 100, last_event_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (partner_id, window_start)
);
CREATE TABLE partnership_audit_logs (
  id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, partner_id BIGINT REFERENCES partnership_partners(id) ON DELETE SET NULL,
  event_type VARCHAR(120) NOT NULL, outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_partnership_exchange_created ON partnership_exchanges(occurred_at DESC);
CREATE INDEX idx_partnership_audit_created ON partnership_audit_logs(created_at DESC);
CREATE INDEX idx_partnership_credentials_hash ON partnership_credentials(secret_hash);
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES
('ACC-FRS-PART-001','Third-Party Integration Support','The system shall support integration with external systems.','ACC partnership administrator','PostgreSQL and approved partner credentials are available.','External systems connect through governed integration records and exchange APIs.','critical','functional',ARRAY['partnership_partners','partnership_integrations']),
('ACC-FRS-PART-002','Partner Onboarding','The system shall onboard third-party partners.','ACC partnership administrator','A partner registration request is available.','Partner registration, credential issuance, and access approval are persisted.','high','functional',ARRAY['partnership_partners','partnership_credentials']),
('ACC-FRS-PART-003','API Access for Partners','The system shall provide APIs for partner systems.','ACC partnership administrator','An active partner credential with approved scopes exists.','Partner API requests are authenticated, scoped, and logged.','critical','security',ARRAY['partnership_credentials','partnership_exchanges']),
('ACC-FRS-PART-004','Secure Data Exchange','The system shall ensure secure communication with partners.','ACC partnership administrator','Partner authentication and exchange endpoint are configured.','Exchange encryption and authentication posture are recorded.','critical','security',ARRAY['partnership_exchanges']),
('ACC-FRS-PART-005','Payment Provider Integration','The system shall integrate with payment providers.','Financial partner','A financial partner is active.','Payment integration configuration and exchanges are reviewable.','critical','functional',ARRAY['partnership_integrations','payments']),
('ACC-FRS-PART-006','Logistics Integration','The system shall integrate with logistics providers.','Logistics partner','A logistics partner is active.','Shipment and delivery exchange events are available.','high','functional',ARRAY['partnership_integrations','shipments']),
('ACC-FRS-PART-007','Government Integration','The system shall integrate with government systems where applicable.','Government partner','A government or regulatory partner is active.','Verification exchanges and evidence are retained.','high','functional',ARRAY['partnership_integrations','partnership_verifications']),
('ACC-FRS-PART-008','Partner Monitoring','The system shall monitor partner activity and performance.','ACC partnership administrator','Partner exchanges have been recorded.','Partner request, failure, latency, and uptime metrics are available.','medium','non_functional',ARRAY['partnership_monitoring','partnership_exchanges']),
('ACC-FRS-PART-009','Partner Access Control','The system shall control partner permissions.','ACC partnership administrator','A partner scope has been reviewed.','Access scopes can be granted and revoked per partner.','critical','security',ARRAY['partnership_access_grants','partnership_credentials']),
('ACC-FRS-PART-010','Partnership Logging','The system shall log all partner interactions.','ACC partnership administrator','A partner workflow or exchange occurs.','API calls, exchanges, integration events, and decisions are audited.','high','security',ARRAY['partnership_audit_logs'])
ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes)
SELECT id,'As an ACC operator, I want governed partner integrations so the chamber can safely expand its ecosystem.','views/admin/partnerships.ejs','GET /admin/partnerships and /api/partners/v1/*',ARRAY['partnership_partners','partnership_integrations','partnership_credentials','partnership_access_grants','partnership_verifications','partnership_exchanges','partnership_monitoring','partnership_audit_logs'],'tests/chapter44-partnerships.test.js','Third-Party Ecosystem and Partnerships','1.0','complete','Chapter 44 partner governance and exchange APIs are PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-PART-%' ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO permissions (permission_key,resource,action,description) VALUES
('admin.partnerships.read','admin_partnerships','read','View partners, integrations, credentials, exchanges, metrics, and partnership audit evidence.'),
('admin.partnerships.manage','admin_partnerships','manage','Onboard partners, issue credentials, configure integrations, grant access, and manage partnership status.'),
('partner.profile.read','partner_profile','read','Read the authenticated partner profile and approved integration scope.'),
('partner.exchanges.write','partner_exchanges','create','Submit authenticated partner exchange events.')
ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.partnerships.read','admin.partnerships.manage') ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS roadmap_audit_logs, roadmap_scalability_plans, roadmap_feedback, roadmap_technology_evaluations, roadmap_innovations, roadmap_features, roadmap_goals, roadmap_phases CASCADE;
CREATE TABLE roadmap_phases (id BIGSERIAL PRIMARY KEY, phase_key VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL, description TEXT NOT NULL, sequence_number INTEGER NOT NULL UNIQUE, status VARCHAR(20) NOT NULL DEFAULT 'planned', target_start DATE, target_end DATE, owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_goals (id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, goal_area VARCHAR(100) NOT NULL, metric_name VARCHAR(120), target_value VARCHAR(120), status VARCHAR(20) NOT NULL DEFAULT 'active', owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_features (id BIGSERIAL PRIMARY KEY, phase_id BIGINT REFERENCES roadmap_phases(id) ON DELETE SET NULL, goal_id BIGINT REFERENCES roadmap_goals(id) ON DELETE SET NULL, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, priority VARCHAR(20) NOT NULL DEFAULT 'medium', status VARCHAR(30) NOT NULL DEFAULT 'idea', stakeholder_visibility VARCHAR(20) NOT NULL DEFAULT 'public', target_quarter VARCHAR(20), release_plan_id BIGINT REFERENCES release_plans(id) ON DELETE SET NULL, owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_innovations (id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, category VARCHAR(100) NOT NULL, hypothesis TEXT, expected_value TEXT, status VARCHAR(30) NOT NULL DEFAULT 'proposed', owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_technology_evaluations (id BIGSERIAL PRIMARY KEY, technology_name VARCHAR(180) NOT NULL, category VARCHAR(100) NOT NULL, use_case TEXT NOT NULL, evaluation_criteria JSONB NOT NULL DEFAULT '{}'::jsonb, recommendation TEXT, status VARCHAR(30) NOT NULL DEFAULT 'proposed', evaluated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, evaluated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_feedback (id BIGSERIAL PRIMARY KEY, feature_id BIGINT REFERENCES roadmap_features(id) ON DELETE SET NULL, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, stakeholder_name VARCHAR(160), stakeholder_email VARCHAR(180), feedback_type VARCHAR(50) NOT NULL DEFAULT 'suggestion', rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5), message TEXT NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMPTZ, reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL);
CREATE TABLE roadmap_scalability_plans (id BIGSERIAL PRIMARY KEY, area VARCHAR(120) NOT NULL, current_capacity VARCHAR(180) NOT NULL, target_capacity VARCHAR(180) NOT NULL, strategy TEXT NOT NULL, target_date DATE, status VARCHAR(20) NOT NULL DEFAULT 'planned', owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE roadmap_audit_logs (id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, entity_type VARCHAR(80) NOT NULL, entity_id BIGINT, event_type VARCHAR(100) NOT NULL, previous_value JSONB, next_value JSONB, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_roadmap_features_status ON roadmap_features(status, priority);
CREATE INDEX idx_roadmap_feedback_status ON roadmap_feedback(status, created_at DESC);
CREATE INDEX idx_roadmap_audit_created ON roadmap_audit_logs(created_at DESC);
INSERT INTO roadmap_phases (phase_key,name,description,sequence_number,status) VALUES ('phase-1','Core platform','Registration, marketplace, payments, compliance, and analytics.',1,'completed'),('phase-2','Expansion & optimization','Advanced analytics, mobile, discovery, UX, and regional expansion.',2,'active'),('phase-3','Intelligence & automation','AI recommendations, prediction, workflow automation, and fraud controls.',3,'active'),('phase-4','Ecosystem integration','Banks, government, logistics, and partner marketplace capabilities.',4,'active'),('phase-5','Continental infrastructure','Cross-border trade, identity, payments, financing, and credit systems.',5,'planned');
INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ('ACC-FRS-ROAD-001','Roadmap management','The system shall maintain a structured product roadmap.','ACC roadmap administrator','PostgreSQL and governance access are available.','Roadmap decisions are persisted.','high','functional',ARRAY['roadmap_phases','roadmap_features']),('ACC-FRS-ROAD-002','Feature planning','The system shall support planning of future features.','ACC roadmap administrator','A roadmap phase exists.','Features have accountable status and priority.','high','functional',ARRAY['roadmap_features']),('ACC-FRS-ROAD-003','Innovation tracking','The system shall track innovation initiatives.','ACC roadmap administrator','An initiative is proposed.','Innovation status and expected value are recorded.','medium','functional',ARRAY['roadmap_innovations']),('ACC-FRS-ROAD-004','Feedback-driven development','The system shall incorporate user feedback into roadmap decisions.','Stakeholder','A feedback message is submitted.','Feedback is reviewable and auditable.','high','functional',ARRAY['roadmap_feedback']),('ACC-FRS-ROAD-005','Technology evaluation','The system shall evaluate new technologies for adoption.','ACC roadmap administrator','A technology use case is defined.','Evaluation recommendation is persisted.','medium','functional',ARRAY['roadmap_technology_evaluations']),('ACC-FRS-ROAD-006','Roadmap visibility','The system shall provide visibility of future plans to stakeholders.','Stakeholder','The public roadmap is available.','Public features and phases are visible.','medium','functional',ARRAY['roadmap_phases','roadmap_features']),('ACC-FRS-ROAD-007','Strategic alignment','The system shall align roadmap with business goals.','ACC roadmap administrator','A strategic goal is defined.','Features can reference goals.','high','functional',ARRAY['roadmap_goals','roadmap_features']),('ACC-FRS-ROAD-008','Incremental delivery','The system shall deliver features in phases.','ACC roadmap administrator','A release plan is available.','Features can reference release plans and phases.','high','functional',ARRAY['roadmap_features','release_plans']),('ACC-FRS-ROAD-009','Scalability planning','The system shall plan for future scalability.','ACC roadmap administrator','A capacity gap is identified.','Capacity strategy and target are recorded.','high','non_functional',ARRAY['roadmap_scalability_plans']),('ACC-FRS-ROAD-010','Roadmap audit logging','The system shall log roadmap changes.','ACC roadmap administrator','A roadmap record changes.','The change is retained in an audit log.','medium','security',ARRAY['roadmap_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes) SELECT id,'As an ACC stakeholder, I want a governed future roadmap so delivery remains visible, aligned, and accountable.','views/roadmap/index.ejs and views/admin/roadmap.ejs','GET /roadmap and /admin/roadmap',ARRAY['roadmap_phases','roadmap_goals','roadmap_features','roadmap_innovations','roadmap_technology_evaluations','roadmap_feedback','roadmap_scalability_plans','roadmap_audit_logs'],'tests/chapter45-roadmap.test.js','Future enhancements and roadmap','1.0','complete','Chapter 45 roadmap governance is PostgreSQL-backed.' FROM requirements WHERE requirement_id LIKE 'ACC-FRS-ROAD-%' ON CONFLICT (requirement_id) DO NOTHING;
INSERT INTO permissions (permission_key,resource,action,description) VALUES ('roadmap.read','roadmap','read','View public roadmap plans.'),('admin.roadmap.read','admin_roadmap','read','View roadmap governance evidence.'),('admin.roadmap.manage','admin_roadmap','manage','Manage roadmap planning and audit evidence.') ON CONFLICT (permission_key) DO NOTHING;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.roadmap.read','admin.roadmap.manage') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('registered_user','verified_user','business_member','business_admin') AND p.permission_key='roadmap.read' ON CONFLICT DO NOTHING;
