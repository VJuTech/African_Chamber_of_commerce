/* subscriptionModel.js - Chapter 20 subscription and recurring billing data access. */
const pool = require("../database/connection");

// Return a plan catalog with JSON feature metadata ready for the plan cards.
async function getPlans() {
  const result = await pool.query(`SELECT sp.*, mt.tier_level FROM subscription_plans sp JOIN membership_tiers mt ON mt.id = sp.tier_id WHERE sp.is_active = TRUE ORDER BY mt.tier_level ASC`);
  return result.rows;
}

// Return the current subscription, invoices, and recent in-app notifications.
async function getDashboard(userId) {
  const [subscription, invoices, notifications] = await Promise.all([
    pool.query(`SELECT s.*, sp.display_name, sp.plan_key, sp.description, sp.monthly_price, sp.quarterly_price, sp.yearly_price, sp.listing_limit, sp.visibility_boost, sp.priority_support, sp.features FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id WHERE s.user_id = $1`, [userId]),
    pool.query(`SELECT si.*, payment.payment_method FROM subscription_invoices si JOIN subscriptions s ON s.id = si.subscription_id LEFT JOIN LATERAL (SELECT payment_method FROM subscription_payments WHERE invoice_id = si.id ORDER BY created_at DESC LIMIT 1) payment ON TRUE WHERE s.user_id = $1 ORDER BY si.created_at DESC`, [userId]),
    pool.query(`SELECT * FROM subscription_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6`, [userId]),
  ]);
  return { subscription: subscription.rows[0] || null, invoices: invoices.rows, notifications: notifications.rows };
}

// Calculate the server-owned recurring price for a selected billing cycle.
function priceForCycle(plan, billingCycle) {
  const prices = { monthly: plan.monthly_price, quarterly: plan.quarterly_price, yearly: plan.yearly_price };
  return Number(prices[billingCycle] || 0);
}

// Persist activation and its related billing records as one transaction.
async function subscribe(userId, planKey, billingCycle, paymentMethod = "card") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const planResult = await client.query("SELECT * FROM subscription_plans WHERE plan_key = $1 AND is_active = TRUE", [planKey]);
    if (!planResult.rows[0]) throw new Error("Subscription plan not found.");
    const plan = planResult.rows[0];
    if (!["monthly", "quarterly", "yearly"].includes(billingCycle)) throw new Error("Unsupported billing cycle.");
    const amount = priceForCycle(plan, billingCycle);
    const periodMonths = { monthly: 1, quarterly: 3, yearly: 12 }[billingCycle];
    const subscriptionResult = await client.query(`INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status, current_period_end, payment_method) VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP + ($4 || ' months')::interval, $5) ON CONFLICT (user_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, billing_cycle = EXCLUDED.billing_cycle, status = 'active', current_period_start = CURRENT_TIMESTAMP, current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = FALSE, pending_plan_id = NULL, payment_method = EXCLUDED.payment_method, updated_at = CURRENT_TIMESTAMP RETURNING *`, [userId, plan.id, billingCycle, periodMonths, paymentMethod]);
    const subscription = subscriptionResult.rows[0];
    let invoice = null;
    if (amount > 0) {
      const invoiceResult = await client.query(`INSERT INTO subscription_invoices (subscription_id, invoice_number, amount, payment_date, payment_method, status) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, 'paid') RETURNING *`, [subscription.id, `ACC-${new Date().getFullYear()}-${Date.now()}`, amount, paymentMethod]);
      invoice = invoiceResult.rows[0];
      await client.query(`INSERT INTO subscription_payments (invoice_id, user_id, payment_reference, amount, payment_method, status, processed_at) VALUES ($1, $2, $3, $4, $5, 'successful', CURRENT_TIMESTAMP)`, [invoice.id, userId, `SUB-${Date.now()}`, amount, paymentMethod]);
    }
    await client.query(`INSERT INTO user_memberships (user_id, tier_id, membership_status, membership_start_date, renewal_date) VALUES ($1, $2, 'active', CURRENT_TIMESTAMP, $3) ON CONFLICT (user_id) DO UPDATE SET tier_id = EXCLUDED.tier_id, membership_status = 'active', renewal_date = EXCLUDED.renewal_date`, [userId, plan.tier_id, subscription.current_period_end]);
    await client.query("UPDATE users SET current_tier_id = $1, membership_tier_updated_at = CURRENT_TIMESTAMP WHERE id = $2", [plan.tier_id, userId]);
    await client.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'activated', 'Subscription activated', $2)", [userId, `${plan.display_name} is now active. Your next billing date is ${new Date(subscription.current_period_end).toLocaleDateString()}.`]);
    await client.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, details) VALUES ($1, $2, 'subscription_created', $3)", [userId, subscription.id, JSON.stringify({ plan: plan.plan_key, billingCycle, amount })]);
    await client.query("COMMIT");
    return { subscription, invoice, plan };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Apply upgrades immediately and schedule downgrades for the current billing period end.
async function changePlan(userId, planKey) {
  const result = await pool.query(`SELECT s.*, current_plan.plan_key AS current_plan_key, current_tier.tier_level AS current_level, target_tier.tier_level AS target_level, target.id AS target_plan_id FROM subscriptions s JOIN subscription_plans current_plan ON current_plan.id = s.plan_id JOIN membership_tiers current_tier ON current_tier.id = current_plan.tier_id JOIN subscription_plans target ON target.plan_key = $2 JOIN membership_tiers target_tier ON target_tier.id = target.tier_id WHERE s.user_id = $1`, [userId, planKey]);
  const subscription = result.rows[0];
  if (!subscription) throw new Error("Active subscription not found.");
  const immediate = subscription.target_level > subscription.current_level;
  const update = await pool.query(`UPDATE subscriptions SET ${immediate ? "plan_id = $2, pending_plan_id = NULL, cancel_at_period_end = FALSE" : "pending_plan_id = $2"}, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *`, [userId, subscription.target_plan_id]);
  await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, details) VALUES ($1, $2, 'plan_changed', $3)", [userId, subscription.id, JSON.stringify({ from: subscription.current_plan_key, to: planKey, effective: immediate ? "immediate" : "next_billing_cycle" })]);
  return { subscription: update.rows[0], effective: immediate ? "immediate" : "next billing cycle" };
}

// Schedule cancellation without removing access before the paid period ends.
async function cancel(userId) {
  const result = await pool.query("UPDATE subscriptions SET cancel_at_period_end = TRUE, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 RETURNING *", [userId]);
  if (!result.rows[0]) throw new Error("Active subscription not found.");
  await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type) VALUES ($1, $2, 'subscription_cancelled')", [userId, result.rows[0].id]);
  await pool.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'cancelled', 'Cancellation scheduled', 'Your subscription will remain active until the current billing period ends.')", [userId]);
  return result.rows[0];
}

// Process due subscriptions; gateway integration can replace the deterministic result passed by the job.
async function processDueSubscriptions(paymentSuccessful = true, maxRetries = 3) {
  const dueResult = await pool.query(`SELECT s.*, sp.display_name, sp.monthly_price, sp.quarterly_price, sp.yearly_price FROM subscriptions s JOIN subscription_plans sp ON sp.id = s.plan_id WHERE s.status = 'active' AND s.current_period_end <= CURRENT_TIMESTAMP`);
  const processed = [];
  for (const subscription of dueResult.rows) {
    const amount = priceForCycle(subscription, subscription.billing_cycle);
    const invoiceNumber = `ACC-${new Date().getFullYear()}-${Date.now()}-${subscription.id}`;
    if (subscription.cancel_at_period_end) {
      await pool.query("UPDATE subscriptions SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [subscription.id]);
      await pool.query("UPDATE user_memberships SET membership_status = 'expired' WHERE user_id = $1", [subscription.user_id]);
      await pool.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'expired', 'Subscription expired', 'Your subscription has ended. Choose a new plan whenever you are ready.')", [subscription.user_id]);
      await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type) VALUES ($1, $2, 'subscription_expired')", [subscription.user_id, subscription.id]);
      processed.push({ id: subscription.id, status: "expired" });
      continue;
    }
    if (!paymentSuccessful && subscription.retry_count < maxRetries) {
      await pool.query("UPDATE subscriptions SET retry_count = retry_count + 1, next_retry_at = CURRENT_TIMESTAMP + INTERVAL '1 day', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [subscription.id]);
      await pool.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'payment_failed', 'Payment failed', $2)", [subscription.user_id, `We could not renew ${subscription.display_name}. We will retry your payment automatically.`]);
      await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, details) VALUES ($1, $2, 'renewal_failed', $3)", [subscription.user_id, subscription.id, JSON.stringify({ retryCount: subscription.retry_count + 1 })]);
      processed.push({ id: subscription.id, status: "retrying" });
      continue;
    }
    if (!paymentSuccessful) {
      await pool.query("UPDATE subscriptions SET status = 'suspended', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [subscription.id]);
      await pool.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'payment_failed', 'Subscription suspended', 'Your subscription has been suspended after repeated payment failures.')", [subscription.user_id]);
      await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type) VALUES ($1, $2, 'subscription_suspended')", [subscription.user_id, subscription.id]);
      processed.push({ id: subscription.id, status: "suspended" });
      continue;
    }
    const periodMonths = { monthly: 1, quarterly: 3, yearly: 12 }[subscription.billing_cycle];
    const nextPlan = subscription.pending_plan_id || subscription.plan_id;
    const renewed = await pool.query(`UPDATE subscriptions SET plan_id = $2, pending_plan_id = NULL, status = 'active', current_period_start = CURRENT_TIMESTAMP, current_period_end = CURRENT_TIMESTAMP + ($3 || ' months')::interval, retry_count = 0, next_retry_at = NULL, cancel_at_period_end = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [subscription.id, nextPlan, periodMonths]);
    const invoice = await pool.query("INSERT INTO subscription_invoices (subscription_id, invoice_number, amount, payment_date, payment_method, status) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'card', 'paid') RETURNING id", [subscription.id, invoiceNumber, amount]);
    await pool.query("INSERT INTO subscription_payments (invoice_id, user_id, payment_reference, amount, payment_method, status, processed_at) VALUES ($1, $2, $3, $4, 'card', 'successful', CURRENT_TIMESTAMP)", [invoice.rows[0].id, subscription.user_id, `SUB-${Date.now()}-${subscription.id}`, amount]);
    await pool.query("INSERT INTO subscription_notifications (user_id, notification_type, title, message) VALUES ($1, 'renewed', 'Subscription renewed', $2)", [subscription.user_id, `${subscription.display_name} renewed successfully.`]);
    await pool.query("INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type) VALUES ($1, $2, 'renewal_processed')", [subscription.user_id, subscription.id]);
    processed.push({ id: renewed.rows[0].id, status: "renewed" });
  }
  return processed;
}

// Expose the data operations used by the Chapter 20 controller and billing worker.
module.exports = { getPlans, getDashboard, subscribe, changePlan, cancel, processDueSubscriptions };