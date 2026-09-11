const PDFDocument = require("pdfkit");
const analyticsModel = require("../models/analyticsModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function isGlobal(req) { return Boolean(req.access && req.access.permissions.includes("analytics.global.read")); }
function filters(req) { return { from: req.query.from || "", to: req.query.to || "" }; }
function csv(rows) {
  const keys = rows.length ? Object.keys(rows[0]) : [];
  return [keys.join(","), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] == null ? "" : row[key])).join(","))].join("\n");
}

async function dashboard(req, res, next) {
  try {
    const global = isGlobal(req);
    const range = filters(req);
    const [data, businesses] = await Promise.all([
      analyticsModel.getDashboard({ userId: currentUser(req).id, global, ...range }),
      global ? Promise.resolve([]) : analyticsModel.getBusinessOptions(currentUser(req).id),
    ]);
    return res.render("analytics/dashboard", { title: global ? "Platform analytics" : "Business analytics", user: currentUser(req), global, businesses, ...data, ...range, refreshUrl: `/analytics/data?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` });
  } catch (error) { return next(error); }
}

async function data(req, res, next) {
  try { return res.json({ success: true, ...(await analyticsModel.getDashboard({ userId: currentUser(req).id, global: isGlobal(req), ...filters(req) })) }); } catch (error) { return next(error); }
}

async function event(req, res, next) {
  try { await analyticsModel.recordEvent({ userId: currentUser(req).id, eventName: req.body.eventName, resourceType: req.body.resourceType, resourceId: req.body.resourceId, metadata: req.body.metadata || {} }); return res.status(201).json({ success: true }); } catch (error) { return next(error); }
}

async function report(req, res, next) {
  try {
    const format = String(req.query.format || "html").toLowerCase();
    const range = filters(req);
    const result = await analyticsModel.getReport({ userId: currentUser(req).id, global: isGlobal(req), type: req.params.type, ...range });
    await analyticsModel.auditReport({ userId: currentUser(req).id, type: result.type, format, filters: range, rowCount: result.rows.length });
    if (format === "csv" || format === "xlsx" || format === "excel") {
      res.type("text/csv").attachment(`${result.type}-report.${format === "csv" ? "csv" : "xls"}`);
      return res.send(csv(result.rows));
    }
    if (format === "pdf") {
      res.type("application/pdf").attachment(`${result.type}-report.pdf`);
      const document = new PDFDocument({ margin: 48 });
      document.pipe(res);
      document.fontSize(18).text(`ACC ${result.type} report`);
      document.fontSize(10).text(`Period: ${result.bounds.start.toISOString()} to ${result.bounds.end.toISOString()}`).moveDown();
      result.rows.forEach((row) => document.fontSize(9).text(Object.entries(row).map(([key, value]) => `${key}: ${value == null ? "" : value}`).join(" | ")));
      return document.end();
    }
    return res.render("analytics/report", { title: `${result.type} report`, user: currentUser(req), global: isGlobal(req), ...result, from: range.from, to: range.to });
  } catch (error) { return next(error); }
}

module.exports = { dashboard, data, event, report };
