/**
 * deploy-schema.mjs
 *
 * Run this script ONCE to initialize your Neon Postgres database with
 * all the tables Dashvora needs.
 *
 * Usage:
 *   1. Ensure one of these env vars is available:
 *         NEON_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL
 *
 *      For local run:
 *         set NEON_URL=postgres://user:pass@host/db?sslmode=require
 *
 *   2. Run:
 *         node deploy-schema.mjs
 *
 * This script is idempotent — running it multiple times is safe.
 */

import { Pool } from 'pg';

const connectionString = process.env.NEON_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ NEON_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL environment variable not set.');
  console.error('   Set one of these, then run:');
  console.error('     set NEON_URL=postgres://... && node deploy-schema.mjs');
  process.exit(1);
}

console.log('🔌 Connecting to PostgreSQL...');

const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

const SCHEMA_SQL = `
-- ============================================================
-- Dashvora Database Schema
-- ============================================================

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  ai_provider   TEXT DEFAULT 'openai',
  ai_model      TEXT DEFAULT 'gpt-4o',
  ai_api_endpoint TEXT DEFAULT '',
  ai_api_key    TEXT DEFAULT '',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

-- 3. Dashboards
CREATE TABLE IF NOT EXISTS dashboards (
  id         VARCHAR(255) PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace  VARCHAR(255) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  dataset_id VARCHAR(255) NOT NULL,
  config     JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);

-- 4. Saved database connectors
CREATE TABLE IF NOT EXISTS user_connectors (
  id                 TEXT PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  type               TEXT NOT NULL DEFAULT 'PostgreSQL',
  host               TEXT NOT NULL,
  port               TEXT NOT NULL DEFAULT '5432',
  database_name      TEXT NOT NULL,
  username           TEXT NOT NULL DEFAULT '',
  password_encrypted TEXT NOT NULL DEFAULT '',
  ssl                BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_connectors_user_id ON user_connectors(user_id);

-- 5. Uploaded dataset metadata
CREATE TABLE IF NOT EXISTS user_uploaded_datasets (
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_name        TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  columns           TEXT NOT NULL DEFAULT '[]',
  row_count         INTEGER DEFAULT 0,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, table_name)
);
`;

async function deploy() {
  const client = await pool.connect();
  try {
    console.log('📦 Creating tables...');
    await client.query(SCHEMA_SQL);
    console.log('✅ All tables created successfully!');
    console.log('');
    console.log('Tables deployed:');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    for (const row of result.rows) {
      console.log(`   ✓ ${row.table_name}`);
    }
  } catch (err) {
    console.error('❌ Schema deployment failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deploy();
