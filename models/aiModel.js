const pool = require("../database/connection");

const AI_REQUIREMENTS = [
  ["ACC-FRS-AI-001", "Recommendation Engine", "The system shall provide personalized recommendations for businesses, products, and services.", "high"],
  ["ACC-FRS-AI-002", "Smart Search", "The system shall enhance search with auto-suggestions and ranked results.", "high"],
  ["ACC-FRS-AI-003", "Fraud Detection System", "The system shall detect and flag suspicious activities and high-risk transactions.", "critical"],
  ["ACC-FRS-AI-004", "User Behavior Analysis", "The system shall analyze user behavior patterns accurately.", "high"],
  ["ACC-FRS-AI-005", "Predictive Analytics", "The system shall provide useful market, demand, and business predictions.", "medium"],
  ["ACC-FRS-AI-006", "Continuous Learning", "The system shall improve recommendations over time through persisted feedback and interactions.", "high"],
  ["ACC-FRS-AI-007", "AI-Based Alerts", "The system shall generate timely and relevant fraud and opportunity alerts.", "high"],
  ["ACC-FRS-AI-008", "Data Privacy in AI", "The system shall respect consent, minimization, access, and deletion controls for AI data.", "critical"],
  ["ACC-FRS-AI-009", "AI Model Monitoring", "The system shall monitor model and scoring performance.", "medium"],
  ["ACC-FRS-AI-010", "AI Activity Logging", "The system shall log recommendations, alerts, searches, decisions, and model actions.", "medium"],
];

const recommendationTypes = ["business", "product", "service", "opportunity"];
const fraudStatuses = ["open", "reviewing", "confirmed", "dismissed", "blocked"];
const alertStatuses = ["unread", "acknowledged", "resolved", "dismissed"];

function normalizeQuery(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function recommendationTarget(type, row) {
  return { id: Number(row.id), type, title: row.title || row.business_name, description: row.description || row.business_description || "", category: row.category || row.industry_category || "", score: Number(row.score || 0), reason: row.reason || "Relevant to your recent activity." };
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_user_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      recommendations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      behavior_analysis_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      fraud_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      personalization_scope VARCHAR(20) NOT NULL DEFAULT 'platform' CHECK (personalization_scope IN ('none','platform','business')),
      interests JSONB NOT NULL DEFAULT '[]'::jsonb,
      consent_version VARCHAR(40) NOT NULL DEFAULT '1.0',
      consented_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_interaction_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      business_id INTEGER REFERENCES business_accounts(id) ON DELETE SET NULL,
      event_type VARCHAR(80) NOT NULL,
      resource_type VARCHAR(60),
      resource_id VARCHAR(120),
      query_text VARCHAR(160),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recommendation_type VARCHAR(30) NOT NULL CHECK (recommendation_type IN ('business','product','service','opportunity')),
      target_id BIGINT NOT NULL,
      target_type VARCHAR(40) NOT NULL,
      score NUMERIC(8,4) NOT NULL DEFAULT 0,
      reason VARCHAR(500) NOT NULL,
      model_version VARCHAR(80) NOT NULL DEFAULT 'rules-v1',
      feedback VARCHAR(20) CHECK (feedback IN ('positive','negative','dismissed')),
      status VARCHAR(20) NOT NULL DEFAULT 'shown' CHECK (status IN ('shown','clicked','dismissed','expired')),
      generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      feedback_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS ai_search_queries (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      query_text VARCHAR(160) NOT NULL,
      suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
      result_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      result_count INTEGER NOT NULL DEFAULT 0,
      ranking_version VARCHAR(80) NOT NULL DEFAULT 'rank-v1',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_fraud_cases (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      subject_type VARCHAR(30) NOT NULL,
      subject_id BIGINT,
      risk_score NUMERIC(8,4) NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
      risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low','medium','high','critical')),
      indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','confirmed','dismissed','blocked')),
      resolution_note TEXT,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS ai_predictions (
      id BIGSERIAL PRIMARY KEY,
      business_id INTEGER REFERENCES business_accounts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      prediction_type VARCHAR(60) NOT NULL,
      subject_type VARCHAR(40) NOT NULL,
      subject_id BIGINT,
      forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
      confidence NUMERIC(8,4) NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
      horizon VARCHAR(60) NOT NULL,
      model_version VARCHAR(80) NOT NULL DEFAULT 'forecast-v1',
      generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS ai_alerts (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      fraud_case_id BIGINT REFERENCES ai_fraud_cases(id) ON DELETE CASCADE,
      prediction_id BIGINT REFERENCES ai_predictions(id) ON DELETE CASCADE,
      alert_type VARCHAR(40) NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','medium','high','critical')),
      title VARCHAR(220) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','acknowledged','resolved','dismissed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS ai_models (
      id BIGSERIAL PRIMARY KEY,
      model_key VARCHAR(100) NOT NULL,
      version VARCHAR(80) NOT NULL,
      model_type VARCHAR(60) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active','testing','retired','degraded')),
      precision_score NUMERIC(8,4),
      recall_score NUMERIC(8,4),
      recommendation_ctr NUMERIC(8,4),
      false_positive_rate NUMERIC(8,4),
      training_events INTEGER NOT NULL DEFAULT 0,
      last_evaluated_at TIMESTAMPTZ,
      notes TEXT,
      UNIQUE(model_key, version)
    );
    CREATE TABLE IF NOT EXISTS ai_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(100) NOT NULL,
      decision VARCHAR(100),
      model_version VARCHAR(80),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ai_interaction_user_created_idx ON ai_interaction_events(user_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS ai_recommendations_user_created_idx ON ai_recommendations(user_id, generated_at DESC);
    CREATE INDEX IF NOT EXISTS ai_search_queries_query_idx ON ai_search_queries(query_text, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_fraud_cases_status_idx ON ai_fraud_cases(status, risk_score DESC, detected_at DESC);
    CREATE INDEX IF NOT EXISTS ai_alerts_status_idx ON ai_alerts(status, severity, created_at DESC);
    CREATE INDEX IF NOT EXISTS ai_audit_created_idx ON ai_audit_logs(created_at DESC);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('ai.recommendations.read','ai_intelligence','read','View personalized recommendations and AI insights.'), ('ai.interactions.write','ai_intelligence','write','Record consented AI interaction and recommendation feedback.'), ('admin.ai.read','admin_ai','read','View AI recommendations, fraud, alerts, predictions, and model health.'), ('admin.ai.manage','admin_ai','manage','Manage AI cases, alerts, model monitoring, privacy controls, and decisions.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin','compliance_officer') AND p.permission_key IN ('admin.ai.read','admin.ai.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of AI_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ($1,$2,$3,'AI administrator','PostgreSQL source data and applicable consent are available.','AI decisions, recommendations, alerts, privacy actions, and model health are durable and auditable.',$4,'functional',ARRAY['ai_interaction_events','ai_recommendations','ai_fraud_cases','ai_predictions','ai_alerts','ai_models','ai_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes) SELECT id,$2,'views/ai/dashboard.ejs and views/admin/ai.ejs','GET /ai and GET /admin/ai',ARRAY['ai_user_profiles','ai_interaction_events','ai_recommendations','ai_search_queries','ai_fraud_cases','ai_predictions','ai_alerts','ai_models','ai_audit_logs'],'tests/chapter43-ai.test.js','AI and Recommendation System','1.0','complete','Chapter 43 intelligence controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id=$1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As an ACC user or operator, I want ${name.toLowerCase()} so the platform becomes more useful and trustworthy.`]);
  }
  await pool.query(`INSERT INTO ai_models (model_key, version, model_type, status, notes) VALUES ('recommendation','rules-v1','explainable-ranking','active','Category, behavior, popularity, and freshness scoring.'), ('search','rank-v1','text-ranking','active','PostgreSQL full-text and prefix suggestion ranking.'), ('fraud','rules-v1','risk-scoring','active','Velocity, amount, repetition, and account-age signals.'), ('forecast','forecast-v1','trend-baseline','active','Database trend baseline for demand and opportunity forecasts.') ON CONFLICT (model_key, version) DO NOTHING`);
}

async function audit(eventType, details = {}, actorId = null, userId = null, decision = null, modelVersion = null) { await pool.query("INSERT INTO ai_audit_logs (actor_id,user_id,event_type,decision,model_version,details) VALUES ($1,$2,$3,$4,$5,$6)", [actorId, userId, eventType, decision, modelVersion, details]); }

async function getConsent(userId) { const result = await pool.query("SELECT user_id AS \"userId\", recommendations_enabled AS \"recommendationsEnabled\", behavior_analysis_enabled AS \"behaviorAnalysisEnabled\", fraud_alerts_enabled AS \"fraudAlertsEnabled\", personalization_scope AS \"personalizationScope\", interests, consent_version AS \"consentVersion\", consented_at AS \"consentedAt\" FROM ai_user_profiles WHERE user_id=$1", [Number(userId)]); return result.rows[0] || { userId: Number(userId), recommendationsEnabled: false, behaviorAnalysisEnabled: false, fraudAlertsEnabled: true, personalizationScope: "none", interests: [], consentedAt: null, consentVersion: "1.0" }; }
async function saveConsent(userId, input = {}) { const scope = ["none", "platform", "business"].includes(input.personalizationScope) ? input.personalizationScope : "none"; const enabled = scope !== "none"; const result = await pool.query(`INSERT INTO ai_user_profiles (user_id,recommendations_enabled,behavior_analysis_enabled,fraud_alerts_enabled,personalization_scope,interests,consent_version,consented_at) VALUES ($1,$2,$3,$4,$5,$6,$7,CASE WHEN $2 OR $3 THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT (user_id) DO UPDATE SET recommendations_enabled=$2, behavior_analysis_enabled=$3, fraud_alerts_enabled=$4, personalization_scope=$5, interests=$6, consent_version=$7, consented_at=CASE WHEN $2 OR $3 THEN CURRENT_TIMESTAMP ELSE NULL END, updated_at=CURRENT_TIMESTAMP RETURNING user_id AS \"userId\", recommendations_enabled AS \"recommendationsEnabled\", behavior_analysis_enabled AS \"behaviorAnalysisEnabled\", fraud_alerts_enabled AS \"fraudAlertsEnabled\", personalization_scope AS \"personalizationScope\", interests, consent_version AS \"consentVersion\", consented_at AS \"consentedAt\"`, [Number(userId), enabled, input.behaviorAnalysisEnabled !== false && enabled, input.fraudAlertsEnabled !== false, scope, JSON.stringify(Array.isArray(input.interests) ? input.interests.slice(0, 30) : []), String(input.consentVersion || "1.0")]); await audit("privacy_consent_updated", { scope, recommendationsEnabled: enabled }, Number(userId), Number(userId), "consent_updated"); return result.rows[0]; }

async function recordInteraction(userId, input = {}) { const consent = await getConsent(userId); if (!consent.behaviorAnalysisEnabled) return { success: false, suppressed: true, message: "Behavior analysis is disabled for this account." }; const result = await pool.query("INSERT INTO ai_interaction_events (user_id,business_id,event_type,resource_type,resource_id,query_text,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, occurred_at AS \"occurredAt\"", [Number(userId), Number(input.businessId) || null, String(input.eventType || "interaction").slice(0, 80), input.resourceType || null, input.resourceId == null ? null : String(input.resourceId), normalizeQuery(input.queryText) || null, input.metadata || {}]); await audit("interaction_recorded", { interactionId: result.rows[0].id, eventType: input.eventType }, null, Number(userId), "stored"); return { success: true, ...result.rows[0] }; }

async function getInterestCategories(userId) { const result = await pool.query(`SELECT COALESCE(NULLIF(ml.category,''),'General') AS category, COUNT(*)::integer AS weight FROM ai_interaction_events e JOIN marketplace_listings ml ON ml.id::text=e.resource_id WHERE e.user_id=$1 AND e.event_type IN ('listing_view','listing_click','search_click','recommendation_click') GROUP BY 1 ORDER BY weight DESC LIMIT 8`, [Number(userId)]); return result.rows; }
async function getRecommendations(userId, type = "all", limit = 8) { const consent = await getConsent(userId); if (!consent.recommendationsEnabled) return { enabled: false, recommendations: [], message: "Enable personalized recommendations in AI privacy settings." }; const categories = await getInterestCategories(userId); const category = categories[0] && categories[0].category; const values = [Number(userId), Math.min(Math.max(Number(limit) || 8, 1), 30)]; const typeCondition = recommendationTypes.includes(type) ? "AND ml.listing_type = $3" : ""; if (typeCondition) values.push(type === "product" ? "product" : type); const result = await pool.query(`SELECT ml.id, ml.title, ml.description, ml.category, ml.listing_type AS type, (CASE WHEN $3::text <> '' AND LOWER(ml.category)=LOWER($3) THEN 45 ELSE 0 END + LEAST(30, COALESCE(SUM(CASE WHEN e.event_type IN ('listing_view','listing_click') THEN 8 ELSE 0 END),0)) + GREATEST(0, 20 - EXTRACT(DAY FROM CURRENT_TIMESTAMP - ml.created_at))) AS score, CASE WHEN LOWER(ml.category)=LOWER($3) THEN 'Matches your recent interests.' ELSE 'Popular and recently active on ACC.' END AS reason FROM marketplace_listings ml LEFT JOIN ai_interaction_events e ON e.resource_id=ml.id::text AND e.resource_type='listing' WHERE ml.status='active' AND ml.visibility='public' AND ml.user_id <> $1 ${typeCondition} GROUP BY ml.id ORDER BY score DESC, ml.created_at DESC LIMIT $2`, [Number(userId), values[1], category || ""]); const recommendations = result.rows.map((row) => recommendationTarget(row.type === "service" ? "service" : "product", row)); for (const item of recommendations) await pool.query("INSERT INTO ai_recommendations (user_id,recommendation_type,target_id,target_type,score,reason) VALUES ($1,$2,$3,'marketplace_listing',$4,$5)", [Number(userId), item.type, item.id, item.score, item.reason]); await audit("recommendations_generated", { count: recommendations.length, category: category || null }, null, Number(userId), "generated", "rules-v1"); return { enabled: true, recommendations }; }

async function smartSearch(userId, query, limit = 12) { const normalized = normalizeQuery(query); if (!normalized) return { query: "", suggestions: [], results: [] }; const values = [`%${normalized}%`, normalized, Math.min(Math.max(Number(limit) || 12, 1), 30)]; const result = await pool.query(`SELECT ml.id, ml.title, ml.description, ml.category, ml.listing_type AS type, (CASE WHEN LOWER(ml.title)=LOWER($2) THEN 100 WHEN ml.title ILIKE $1 THEN 70 WHEN ml.category ILIKE $1 THEN 50 ELSE 20 END + ts_rank(to_tsvector('simple', COALESCE(ml.title,'') || ' ' || COALESCE(ml.description,'') || ' ' || COALESCE(ml.category,'')), plainto_tsquery('simple',$2))*20) AS score FROM marketplace_listings ml WHERE ml.status='active' AND ml.visibility='public' AND (ml.title ILIKE $1 OR ml.description ILIKE $1 OR ml.category ILIKE $1 OR ml.tags::text ILIKE $1) ORDER BY score DESC, ml.created_at DESC LIMIT $3`, values); const suggestionsResult = await pool.query("SELECT DISTINCT category AS value FROM marketplace_listings WHERE status='active' AND category ILIKE $1 ORDER BY category LIMIT 6", [`${normalized}%`]); const suggestions = suggestionsResult.rows.map((row) => row.value); const results = result.rows.map((row) => recommendationTarget(row.type === "service" ? "service" : "product", { ...row, reason: "Ranked by relevance, category, and freshness." })); await pool.query("INSERT INTO ai_search_queries (user_id,query_text,suggestions,result_ids,result_count) VALUES ($1,$2,$3,$4,$5)", [Number(userId) || null, normalized, JSON.stringify(suggestions), JSON.stringify(results.map((item) => item.id)), results.length]); await audit("smart_search_executed", { query: normalized, resultCount: results.length }, null, Number(userId) || null, "ranked", "rank-v1"); return { query: normalized, suggestions, results }; }

async function evaluateFraud(input = {}, actorId = null) { const orderId = Number(input.orderId) || null; let order = null; if (orderId) { const result = await pool.query("SELECT id,buyer_id,seller_id,total_price,created_at FROM orders WHERE id=$1", [orderId]); order = result.rows[0]; } const userId = Number(input.userId || (order && order.buyer_id)) || null; const indicators = []; let score = 0; if (order && Number(order.total_price) >= 5000) { score += 30; indicators.push("high_value_transaction"); } if (order) { const velocity = await pool.query("SELECT COUNT(*)::integer AS count FROM orders WHERE buyer_id=$1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'", [order.buyer_id]); if (Number(velocity.rows[0].count) >= 4) { score += 40; indicators.push("rapid_repeated_orders"); } } if (input.repeatedActions >= 5) { score += 30; indicators.push("rapid_repeated_actions"); } score = Math.min(100, score); const riskLevel = score >= 80 ? "critical" : score >= 55 ? "high" : score >= 25 ? "medium" : "low"; if (score < 25) { await audit("fraud_evaluation_completed", { orderId, score, indicators }, actorId, userId, "low_risk", "rules-v1"); return { flagged: false, score, riskLevel, indicators }; } const result = await pool.query("INSERT INTO ai_fraud_cases (user_id,order_id,subject_type,subject_id,risk_score,risk_level,indicators) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [userId, orderId, orderId ? "order" : "user", orderId || userId, score, riskLevel, JSON.stringify(indicators)]); const alert = await pool.query("INSERT INTO ai_alerts (user_id,fraud_case_id,alert_type,severity,title,message) VALUES ($1,$2,'fraud', $3,$4,$5) RETURNING id", [userId, result.rows[0].id, riskLevel === "critical" ? "critical" : riskLevel, "Suspicious activity detected", `AI risk score ${score}/100: ${indicators.join(", ")}`]); await audit("fraud_alert_triggered", { caseId: result.rows[0].id, alertId: alert.rows[0].id, score, indicators }, actorId, userId, "flagged", "rules-v1"); return { flagged: true, userId, caseId: result.rows[0].id, alertId: alert.rows[0].id, score, riskLevel, indicators }; }

async function createPrediction(actorId, input = {}) { const businessId = Number(input.businessId) || null; const query = businessId ? "SELECT COUNT(*)::integer AS orders, COALESCE(SUM(total_price),0) AS revenue FROM orders o JOIN marketplace_listings ml ON ml.id=o.listing_id WHERE ml.business_id=$1 AND o.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'" : "SELECT COUNT(*)::integer AS orders, COALESCE(SUM(total_price),0) AS revenue FROM orders WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'"; const result = await pool.query(query, businessId ? [businessId] : []); const orders = Number(result.rows[0].orders); const revenue = Number(result.rows[0].revenue); const forecast = { expectedOrdersNext30Days: Math.round(orders / 3), expectedRevenueNext30Days: Number((revenue / 3).toFixed(2)), basis: "90-day PostgreSQL transaction trend" }; const prediction = await pool.query("INSERT INTO ai_predictions (business_id,user_id,prediction_type,subject_type,subject_id,forecast,confidence,horizon) VALUES ($1,$2,'demand','business',$3,$4,$5,'next_30_days') RETURNING id", [businessId, actorId, businessId || actorId, JSON.stringify(forecast), orders ? 68 : 20]); await audit("prediction_generated", { predictionId: prediction.rows[0].id, forecast }, actorId, actorId, "generated", "forecast-v1"); return { id: prediction.rows[0].id, forecast, confidence: orders ? 68 : 20, horizon: "next_30_days" }; }

async function getAdminDashboard() { const [cases, alerts, predictions, models, interactions, recommendations, searches] = await Promise.all([pool.query("SELECT f.*, u.email FROM ai_fraud_cases f LEFT JOIN users u ON u.id=f.user_id ORDER BY f.detected_at DESC LIMIT 50"), pool.query("SELECT * FROM ai_alerts ORDER BY created_at DESC LIMIT 50"), pool.query("SELECT * FROM ai_predictions ORDER BY generated_at DESC LIMIT 30"), pool.query("SELECT * FROM ai_models ORDER BY model_key, version"), pool.query("SELECT COUNT(*)::integer AS count FROM ai_interaction_events WHERE occurred_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'"), pool.query("SELECT COUNT(*)::integer AS count, COUNT(*) FILTER (WHERE feedback='positive')::integer AS positive FROM ai_recommendations WHERE generated_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'"), pool.query("SELECT COUNT(*)::integer AS count FROM ai_search_queries WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'")]); return { cases: cases.rows, alerts: alerts.rows, predictions: predictions.rows, models: models.rows, metrics: { interactions: interactions.rows[0].count, recommendations: recommendations.rows[0].count, positiveFeedback: recommendations.rows[0].positive, searches: searches.rows[0].count, openCases: cases.rows.filter((row) => ["open", "reviewing"].includes(row.status)).length, unreadAlerts: alerts.rows.filter((row) => row.status === "unread").length } }; }
async function updateFraudCase(actorId, id, status, resolutionNote) { if (!fraudStatuses.includes(status)) throw new Error("Unsupported fraud case status."); const result = await pool.query("UPDATE ai_fraud_cases SET status=$1,resolution_note=$2,resolved_at=CASE WHEN $1 IN ('confirmed','dismissed','blocked') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=$3 RETURNING id", [status, resolutionNote || null, Number(id)]); if (!result.rowCount) throw new Error("Fraud case not found."); await audit("fraud_case_updated", { caseId: id, status }, actorId, null, status); return { success: true }; }
async function updateAlert(actorId, id, status) { if (!alertStatuses.includes(status)) throw new Error("Unsupported AI alert status."); const result = await pool.query("UPDATE ai_alerts SET status=$1,resolved_at=CASE WHEN $1 IN ('resolved','dismissed') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=$2 RETURNING id", [status, Number(id)]); if (!result.rowCount) throw new Error("AI alert not found."); await audit("ai_alert_updated", { alertId: id, status }, actorId, null, status); return { success: true }; }
async function giveRecommendationFeedback(userId, id, feedback) { if (!["positive", "negative", "dismissed"].includes(feedback)) throw new Error("Unsupported recommendation feedback."); const result = await pool.query("UPDATE ai_recommendations SET feedback=$1,status=CASE WHEN $1='dismissed' THEN 'dismissed' ELSE 'clicked' END,feedback_at=CURRENT_TIMESTAMP WHERE id=$2 AND user_id=$3 RETURNING id", [feedback, Number(id), Number(userId)]); if (!result.rowCount) throw new Error("Recommendation not found."); await audit("recommendation_feedback_recorded", { recommendationId: id, feedback }, null, Number(userId), feedback); return { success: true }; }
async function getUserInsights(userId) { const result = await pool.query("SELECT event_type AS \"eventType\", COUNT(*)::integer AS count FROM ai_interaction_events WHERE user_id=$1 AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '90 days' GROUP BY event_type ORDER BY count DESC LIMIT 10", [Number(userId)]); return { patterns: result.rows }; }

async function ensureMemberPermissions() {
  await pool.query("INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('registered_user','verified_user','business_member','business_admin') AND p.permission_key IN ('ai.recommendations.read','ai.interactions.write') ON CONFLICT DO NOTHING");
}

async function getRecommendationsSafe(userId, type = "all", limit = 8) {
  const consent = await getConsent(userId);
  if (!consent.recommendationsEnabled) return { enabled: false, recommendations: [], message: "Enable personalized recommendations in AI privacy settings." };
  const categories = await getInterestCategories(userId);
  const category = categories[0] && categories[0].category ? categories[0].category : "";
  const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 30);
  const requestedType = recommendationTypes.includes(type) && !["business", "opportunity"].includes(type) ? type : "";
  const typeCondition = requestedType ? "AND ml.listing_type = $4" : "";
  const result = await pool.query(`SELECT ml.id, ml.title, ml.description, ml.category, ml.listing_type AS type,
    (CASE WHEN $3::text <> '' AND LOWER(ml.category)=LOWER($3) THEN 45 ELSE 0 END
      + LEAST(30, COALESCE(SUM(CASE WHEN e.event_type IN ('listing_view','listing_click') THEN 8 ELSE 0 END),0))
      + GREATEST(0, 20 - EXTRACT(DAY FROM CURRENT_TIMESTAMP - ml.created_at))) AS score,
    CASE WHEN LOWER(ml.category)=LOWER($3) THEN 'Matches your recent interests.' ELSE 'Popular and recently active on ACC.' END AS reason
    FROM marketplace_listings ml LEFT JOIN ai_interaction_events e ON e.resource_id=ml.id::text AND e.resource_type='listing'
    WHERE ml.status='active' AND ml.visibility='public' AND ml.user_id <> $1 ${typeCondition}
    GROUP BY ml.id ORDER BY score DESC, ml.created_at DESC LIMIT $2`,
    [Number(userId), safeLimit, category, requestedType || null]);
  const recommendations = result.rows.map((row) => recommendationTarget(row.type === "service" ? "service" : "product", row));
  for (const item of recommendations) await pool.query("INSERT INTO ai_recommendations (user_id,recommendation_type,target_id,target_type,score,reason) VALUES ($1,$2,$3,'marketplace_listing',$4,$5)", [Number(userId), item.type, item.id, item.score, item.reason]);
  await audit("recommendations_generated", { count: recommendations.length, category: category || null }, null, Number(userId), "generated", "rules-v1");
  return { enabled: true, recommendations };
}

module.exports = { AI_REQUIREMENTS, ensureSchema, ensureMemberPermissions, getConsent, saveConsent, recordInteraction, getRecommendations: getRecommendationsSafe, smartSearch, evaluateFraud, createPrediction, getAdminDashboard, updateFraudCase, updateAlert, giveRecommendationFeedback, getUserInsights };
