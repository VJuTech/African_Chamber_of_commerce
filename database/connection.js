/**
 * PostgreSQL Connection (CommonJS)
 */

require("dotenv").config()
const { Pool } = require("pg")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // required for Render
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
})

pool.on("error", (err) => {
  console.error("PostgreSQL pool error:", err && err.message ? err.message : err)
})

module.exports = pool