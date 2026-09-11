const express = require("express");
const pool = require("../database/connection");

const router = express.Router();

router.get("/healthz", async (req, res) => {
  const startedAt = Date.now();
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({ status: "healthy", service: "acc", environment: process.env.DEPLOYMENT_ENV || "development", database: "healthy", responseTimeMs: Date.now() - startedAt, timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(503).json({ status: "unhealthy", service: "acc", environment: process.env.DEPLOYMENT_ENV || "development", database: "unavailable", responseTimeMs: Date.now() - startedAt, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
