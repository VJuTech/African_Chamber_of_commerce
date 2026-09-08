const pool = require("../database/connection");

async function createTestUser(label) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await pool.query(
    `INSERT INTO users (first_name, last_name, name, email, phone, country, password_hash, role, status, registration_state, email_verified, phone_verified, consent_terms, consent_privacy)
     VALUES ($1, 'Test', $2, $3, $4, 'Nigeria', 'test-only-hash', 'member', 'active', 'active', TRUE, TRUE, TRUE, TRUE)
     RETURNING id`,
    [label, `${label} Test`, `${label.toLowerCase()}-${suffix}@example.test`, `+234${String(Date.now()).slice(-10)}`]
  );
  return result.rows[0].id;
}

async function createTestBusiness(ownerId) {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const result = await pool.query(
    `INSERT INTO business_accounts (business_name, business_type, country_of_residence, country_of_registration, business_address, contact_email, contact_phone, industry_category, owner_id, status, verification_status)
     VALUES ($1, 'Limited Liability Company', 'Nigeria', 'Nigeria', 'Test address', $2, '+2348000000000', 'Agriculture', $3, 'verified', 'verified')
     RETURNING id`,
    [`ACC Test Business ${suffix}`, `business-${suffix}@example.test`, ownerId]
  );
  return result.rows[0].id;
}

async function removeTestUsers(userIds) {
  if (!userIds.length) return;
  await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [userIds]);
}

module.exports = { createTestUser, createTestBusiness, removeTestUsers };
