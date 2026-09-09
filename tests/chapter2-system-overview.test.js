const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require('../models/systemOverviewModel');
assert.equal(typeof model.getOverview, 'function');
assert.equal(typeof model.updateIntegrationStatus, 'function');
assert.equal(model.architectureLayers.length, 5);
assert.ok(model.architectureLayers.find((layer) => layer.key === 'database').detail.includes('Organization-aware'));
assert.ok(!model.architectureLayers.find((layer) => layer.key === 'database').detail.includes('Multi-tenant'));

const rebuildSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'rebuild.sql'), 'utf8');
[
  'CREATE TABLE platform_integrations',
  'CREATE TABLE platform_integration_events',
  "('moderator', 'Moderator'",
  "('compliance_officer', 'Compliance Officer'",
  "'platform_overview.read'",
  "'platform_overview.manage'",
].forEach((fragment) => assert.ok(rebuildSql.includes(fragment), `Missing Chapter 2 schema fragment: ${fragment}`));

assert.ok(fs.existsSync(path.join(__dirname, '..', 'views', 'admin', 'system-overview.ejs')));
assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'styles', 'system-overview.css')));
console.log('Chapter 2 system overview contract: PASS');
