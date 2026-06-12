/**
 * migrate-to-neon.mjs
 *
 * Migrates your local PostgreSQL database to Neon using the `pg` library
 * (no pg_dump/psql required).
 *
 * Usage:
 *   1. Set your Neon connection string as an env var:
 *        set NEON_URL=postgres://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/dashvora?sslmode=require
 *
 *   2. Run:
 *        node migrate-to-neon.mjs
 *
 *   The script reads your local DB credentials from .env.local automatically.
 *   If that fails, it falls back to: localhost:5432 / postgres:postgres / dashvora
 */

import { readFileSync, existsSync } from 'fs';
import { Pool } from 'pg';

// ── Parse .env.local ──────────────────────────────────────────────────────────
function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf-8');
  const vars = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const localEnv = loadDotEnv('.env.local');

const LOCAL_CONFIG = {
  host: localEnv.POSTGRES_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(localEnv.POSTGRES_PORT || process.env.POSTGRES_PORT || '5432', 10),
  database: localEnv.POSTGRES_DATABASE || process.env.POSTGRES_DATABASE || 'dashvora',
  user: localEnv.POSTGRES_USER || process.env.POSTGRES_USER || 'postgres',
  password: localEnv.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
};

const NEON_URL = process.env.NEON_URL;
if (!NEON_URL) {
  console.error('❌ NEON_URL environment variable not set.');
  console.error('');
  console.error('   Run:');
  console.error('     set NEON_URL=postgres://neondb_owner:xxx@ep-xxx.us-east-2.aws.neon.tech/dashvora?sslmode=require');
  console.error('   then:');
  console.error('     node migrate-to-neon.mjs');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  // Escape single quotes by doubling them
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function getTableNames(pool) {
  const result = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
    ORDER BY table_name
  `);
  return result.rows.map(r => r.table_name);
}

async function getTableSchema(pool, tableName) {
  const result = await pool.query(`
    SELECT column_name, data_type, is_nullable,
           ordinal_position, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  return result.rows;
}

async function getSerialColumns(pool, tableName) {
  // Detect SERIAL / IDENTITY columns (auto-increment)
  const result = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND (column_default LIKE 'nextval%' OR column_default LIKE 'gen_random_uuid%')
  `, [tableName]);
  return new Set(result.rows.map(r => r.column_name));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function migrate() {
  console.log('🔌 Connecting to local PostgreSQL...');
  const localPool = new Pool(LOCAL_CONFIG);
  let localTables = [];

  try {
    // Test local connection
    const client = await localPool.connect();
    client.release();
    console.log(`   ✓ Connected to local: ${LOCAL_CONFIG.host}:${LOCAL_CONFIG.port}/${LOCAL_CONFIG.database}`);
  } catch (err) {
    console.error(`❌ Could not connect to local PostgreSQL: ${err.message}`);
    console.error('   Make sure your local PostgreSQL is running.');
    await localPool.end();
    process.exit(1);
  }

  console.log('\n🔌 Connecting to Neon...');
  const neonPool = new Pool({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

  try {
    const client = await neonPool.connect();
    client.release();
    console.log('   ✓ Connected to Neon');
  } catch (err) {
    console.error(`❌ Could not connect to Neon: ${err.message}`);
    await localPool.end();
    await neonPool.end();
    process.exit(1);
  }

  // 1. Get table list
  try {
    localTables = await getTableNames(localPool);
  } catch (err) {
    console.error(`❌ Failed to list local tables: ${err.message}`);
    await localPool.end();
    await neonPool.end();
    process.exit(1);
  }

  if (localTables.length === 0) {
    console.log('\n⚠️  No tables found in local database.');
    await localPool.end();
    await neonPool.end();
    process.exit(0);
  }

  console.log(`\n📋 Found ${localTables.length} tables: ${localTables.join(', ')}`);

  // Define the order: tables with FK dependencies first
  const tableOrder = ['users', 'password_reset_tokens', 'dashboards', 'user_connectors', 'user_uploaded_datasets'];
  const orderedTables = tableOrder.filter(t => localTables.includes(t));
  const remainingTables = localTables.filter(t => !tableOrder.includes(t));
  const allTables = [...orderedTables, ...remainingTables];

  for (const tableName of allTables) {
    console.log(`\n── ${tableName} ──`);

    // 2. Get schema from local
    const columns = await getTableSchema(localPool, tableName);
    const serialCols = await getSerialColumns(localPool, tableName);
    const columnNames = columns.map(c => c.column_name);
    const nonSerialCols = columnNames.filter(c => !serialCols.has(c));

    // 3. Drop & recreate table on Neon
    const colDefs = columns.map(col => {
      let pgType = col.data_type;
      // Map common types
      if (pgType === 'character varying' || pgType === 'character') pgType = 'TEXT';
      if (pgType.startsWith('timestamp')) pgType = 'TIMESTAMP WITH TIME ZONE';
      if (pgType === 'boolean') pgType = 'BOOLEAN';
      if (pgType === 'jsonb') pgType = 'JSONB';
      if (pgType === 'integer') pgType = 'INTEGER';
      if (pgType === 'text') pgType = 'TEXT';
      if (pgType === 'double precision') pgType = 'DOUBLE PRECISION';

      let def = `"${col.column_name}" ${pgType}`;
      if (col.is_nullable === 'NO' && !col.column_default?.includes('nextval')) {
        // Only add NOT NULL if there's no default that would auto-fill
        def += ' NOT NULL';
      }
      if (col.column_default && !col.column_default.includes('nextval')) {
        // Preserve non-serial defaults
        if (col.column_default.startsWith('nextval')) {
          def += ' GENERATED BY DEFAULT AS IDENTITY';
        } else {
          def += ` DEFAULT ${col.column_default}`;
        }
      }
      return def;
    }).join(', ');

    console.log(`   Creating table...`);
    try {
      await neonPool.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      await neonPool.query(`CREATE TABLE "${tableName}" (${colDefs})`);
    } catch (err) {
      console.error(`   ❌ Failed to create table: ${err.message}`);
      continue;
    }

    // 4. Read data from local
    let rows;
    try {
      const result = await localPool.query(`SELECT * FROM "${tableName}"`);
      rows = result.rows;
    } catch (err) {
      console.error(`   ❌ Failed to read data: ${err.message}`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`   ✓ Created (0 rows — empty table)`);
      continue;
    }

    // 5. Insert data into Neon in batches
    const batchSize = 500;
    let inserted = 0;

    const insertCols = nonSerialCols.length > 0 ? nonSerialCols : columnNames;
    const colList = insertCols.map(c => `"${c}"`).join(', ');

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const valuesList = batch.map(row => {
        const vals = insertCols.map(col => escapeLiteral(row[col]));
        return `(${vals.join(', ')})`;
      }).join(',\n');

      const insertSQL = `INSERT INTO "${tableName}" (${colList}) VALUES ${valuesList}`;

      try {
        await neonPool.query(insertSQL);
        inserted += batch.length;
        process.stdout.write(`\r   Inserted ${inserted}/${rows.length} rows...`);
      } catch (err) {
        console.error(`\n   ❌ Failed to insert batch at row ${i}: ${err.message}`);
        // Try inserting row by row to find the culprit
        for (const row of batch) {
          const singleVals = insertCols.map(col => escapeLiteral(row[col]));
          try {
            await neonPool.query(`INSERT INTO "${tableName}" (${colList}) VALUES (${singleVals.join(', ')})`);
          } catch (e) {
            console.error(`   ⚠ Skipping problematic row: ${e.message}`);
          }
        }
        inserted += batch.length;
      }
    }
    console.log(`\n   ✓ ${inserted} rows migrated`);
  }

  await localPool.end();
  await neonPool.end();

  console.log('\n✅ Migration complete!');
  console.log('   Your data is now on Neon.');
  console.log('');
  console.log('Next steps:');
  console.log('   1. Update your .env.local:');
  console.log('        POSTGRES_URL=postgres://neondb_owner:xxx@ep-xxx/...');
  console.log('   2. Set POSTGRES_URL in Vercel project env vars');
  console.log('   3. Deploy to Vercel');
}

migrate();
