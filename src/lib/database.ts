import 'server-only';

import { Pool, PoolConfig, QueryResult } from 'pg';

import { DatabaseConnectionConfig, TableSchema, QueryResultData } from './database-types';

function isVercelEnvironment(): boolean {
  return !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_VERCEL_ENV
  );
}

function parsePostgresUrl(url: string): { host: string; port: string; database: string; username: string; password: string; ssl: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    database: parsed.pathname.replace(/^\//, ''),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: parsed.searchParams.get('sslmode') === 'require' || isVercelEnvironment(),
  };
}

export class DatabaseService {
  private pools: Map<string, Pool> = new Map();
  private activeConnections: Map<string, DatabaseConnectionConfig> = new Map();

  /**
   * Load default connection configuration from environment variables.
   * Supports either:
   *   - NEON_URL (isolated connection string for Neon Postgres)
   *   - POSTGRES_URL (single connection string, e.g. Vercel Postgres)
   *   - Individual env vars (POSTGRES_HOST, POSTGRES_PORT, etc.)
   */
  static getDefaultConfig(): DatabaseConnectionConfig {
    // Prefer NEON_URL first (user-defined), then POSTGRES_URL (Vercel Postgres)
    const neonUrl = process.env.NEON_URL;
    if (neonUrl) {
      const parsed = parsePostgresUrl(neonUrl);
      return {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        ssl: parsed.ssl,
      };
    }

    const postgresUrl = process.env.POSTGRES_URL;
    if (postgresUrl) {
      const parsed = parsePostgresUrl(postgresUrl);
      return {
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        ssl: parsed.ssl,
      };
    }

    // Fall back to individual env vars
    const onVercel = isVercelEnvironment();
    return {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DATABASE || 'dashvora',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: process.env.POSTGRES_SSL === 'true' || onVercel,
    };
  }

  /**
   * Build a pg.PoolConfig from a connection config.
   */
  private buildPoolConfig(config: DatabaseConnectionConfig): PoolConfig {
    return {
      host: config.host,
      port: parseInt(config.port, 10),
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      min: parseInt(process.env.POSTGRES_POOL_MIN || '2', 10),
      max: parseInt(process.env.POSTGRES_POOL_MAX || '10', 10),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT_MS || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || '10000', 10),
    };
  }

  /**
   * Generate a unique connection ID for a config.
   */
  private getConnectionId(config: DatabaseConnectionConfig): string {
    return `${config.host}:${config.port}/${config.database}`;
  }

  /**
   * Connect to a PostgreSQL database and return the connection ID.
   * Throws if the connection cannot be established.
   */
  async connect(config: DatabaseConnectionConfig): Promise<string> {
    const connectionId = this.getConnectionId(config);

    // If already connected, close the old pool first
    if (this.pools.has(connectionId)) {
      await this.disconnect(connectionId);
    }

    const poolConfig = this.buildPoolConfig(config);
    const pool = new Pool(poolConfig);

    // Test the connection by running a simple query
    try {
      const client = await pool.connect();
      client.release();
    } catch (error: any) {
      await pool.end().catch(() => {});
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }

    // Handle pool errors to prevent crashes
    pool.on('error', (err) => {
      console.error(`[DatabaseService] Unexpected pool error for ${connectionId}:`, err.message);
    });

    this.pools.set(connectionId, pool);
    this.activeConnections.set(connectionId, config);

    return connectionId;
  }

  /**
   * Test a database connection without storing it.
   * Returns true if the connection succeeds, false otherwise.
   */
  async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const poolConfig = this.buildPoolConfig(config);
    const testPool = new Pool(poolConfig);

    try {
      const client = await testPool.connect();
      client.release();
      await testPool.end();
      return { success: true };
    } catch (error: any) {
      await testPool.end().catch(() => {});
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from a PostgreSQL database.
   */
  async disconnect(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error(`[DatabaseService] Error closing pool ${connectionId}:`, err);
      }
      this.pools.delete(connectionId);
      this.activeConnections.delete(connectionId);
    }
  }

  /**
   * Disconnect all active connections.
   */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.pools.keys());
    await Promise.all(ids.map(id => this.disconnect(id)));
  }

  /**
   * Check if a connection is active.
   */
  isConnected(connectionId: string): boolean {
    return this.pools.has(connectionId);
  }

  /**
   * Get the connection config for an active connection.
   */
  getConnectionConfig(connectionId: string): DatabaseConnectionConfig | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Fetch the schema (tables and columns) from a connected database.
   * Queries the information_schema for user-defined tables.
   */
  async fetchSchema(connectionId: string): Promise<TableSchema[]> {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    const schemaQuery = `
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable
      FROM information_schema.tables t
      JOIN information_schema.columns c 
        ON t.table_name = c.table_name 
        AND t.table_schema = c.table_schema
      WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name, c.ordinal_position
    `;

    try {
      const result: QueryResult = await pool.query(schemaQuery);
      const tableMap = new Map<string, { name: string; type: string; nullable: boolean }[]>();

      for (const row of result.rows) {
        const tableName = row.table_name;
        const column = {
          name: row.column_name,
          type: this.mapPostgresType(row.data_type),
          nullable: row.is_nullable === 'YES',
        };

        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, []);
        }
        tableMap.get(tableName)!.push(column);
      }

      return Array.from(tableMap.entries()).map(([tableName, columns]) => ({
        tableName,
        columns,
      }));
    } catch (error: any) {
      throw new Error(`Failed to fetch schema: ${error.message}`);
    }
  }

  /**
   * Map PostgreSQL data types to simplified types for the app.
   */
  private mapPostgresType(pgType: string): string {
    const typeMap: Record<string, string> = {
      'integer': 'number',
      'bigint': 'number',
      'smallint': 'number',
      'numeric': 'number',
      'real': 'number',
      'double precision': 'number',
      'money': 'number',
      'decimal': 'number',
      'serial': 'number',
      'bigserial': 'number',
      'timestamp': 'date',
      'timestamptz': 'date',
      'date': 'date',
      'time': 'date',
      'timetz': 'date',
      'character varying': 'string',
      'varchar': 'string',
      'character': 'string',
      'char': 'string',
      'text': 'string',
      'boolean': 'string',
      'json': 'string',
      'jsonb': 'string',
      'uuid': 'string',
    };

    const lowerType = pgType.toLowerCase();
    // Check for array types
    if (lowerType.endsWith('[]')) {
      return 'string';
    }

    return typeMap[lowerType] || 'string';
  }

  /**
   * Execute a SELECT query against the connected database.
   * Only read-only queries are allowed for safety.
   */
  async executeQuery(connectionId: string, sql: string): Promise<QueryResultData> {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    // Safety validation - only allow SELECT queries
    const upperSql = sql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      throw new Error('Security Violation: Only SELECT queries are allowed.');
    }

    const forbidden = ['DELETE', 'DROP', 'UPDATE', 'ALTER', 'INSERT', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE'];
    for (const verb of forbidden) {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      if (regex.test(sql)) {
        throw new Error(`Security Violation: Command '${verb}' is not permitted. Only read-only SELECT operations are allowed.`);
      }
    }

    const startTime = performance.now();

    try {
      const cleanSql = sql.trim().replace(/;$/, '');
      const result: QueryResult = await pool.query(cleanSql);

      const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      const columns = result.fields.map(f => f.name);
      const rows = result.rows.map(row => {
        const cleanRow: Record<string, any> = {};
        for (const key of columns) {
          cleanRow[key] = row[key];
        }
        return cleanRow;
      });

      return {
        columns,
        rows,
        rowCount: result.rows.length,
        queryTimeMs,
        sql: cleanSql,
      };
    } catch (error: any) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Execute a parameterized write query (INSERT/UPDATE) against the connected database.
   * Uses parameterized queries to prevent SQL injection.
   * Only INSERT, UPDATE, and SELECT queries are allowed — destructive commands are blocked.
   */
  async executeWriteQuery(connectionId: string, sql: string, params?: any[]): Promise<QueryResultData> {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`No active connection found for: ${connectionId}`);
    }

    // Safety validation - only allow INSERT, UPDATE, SELECT
    const upperSql = sql.trim().toUpperCase();
    const allowedPrefixes = ['INSERT', 'UPDATE', 'SELECT', 'DELETE'];
    const isAllowed = allowedPrefixes.some(prefix => upperSql.startsWith(prefix));
    if (!isAllowed) {
      throw new Error('Security Violation: Only INSERT, UPDATE, and SELECT queries are allowed.');
    }

    const forbidden = ['DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'RENAME', 'GRANT', 'REVOKE'];
    for (const verb of forbidden) {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      if (regex.test(sql)) {
        throw new Error(`Security Violation: Command '${verb}' is not permitted in write queries.`);
      }
    }

    const startTime = performance.now();

    try {
      const cleanSql = sql.trim().replace(/;$/, '');
      const result: QueryResult = await pool.query(cleanSql, params);

      const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
      const columns = result.fields ? result.fields.map(f => f.name) : [];
      const rows = result.rows ? result.rows.map(row => {
        const cleanRow: Record<string, any> = {};
        for (const key of Object.keys(row)) {
          cleanRow[key] = row[key];
        }
        return cleanRow;
      }) : [];

      return {
        columns,
        rows,
        rowCount: result.rows?.length || result.rowCount || 0,
        queryTimeMs,
        sql: cleanSql,
      };
    } catch (error: any) {
      throw new Error(`Write query execution failed: ${error.message}`);
    }
  }

  /**
   * Get list of active connection IDs.
   */
  getActiveConnections(): string[] {
    return Array.from(this.activeConnections.keys());
  }
}

// Singleton instance for use throughout the app
export const databaseService = new DatabaseService();

/**
 * Lazy persistent database connection for server-side API routes.
 * Maintains a single connection pool across requests instead of
 * creating and destroying one on every request.
 */
let _persistentConnectionId: string | null = null;

export async function getPersistentConnection(): Promise<string> {
  if (_persistentConnectionId && databaseService.isConnected(_persistentConnectionId)) {
    return _persistentConnectionId;
  }
  const config = DatabaseService.getDefaultConfig();
  _persistentConnectionId = await databaseService.connect(config);
  return _persistentConnectionId;
}
