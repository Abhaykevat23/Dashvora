import 'server-only';

import { createPool, Pool, PoolConnection } from 'mysql2/promise';
import { DatabaseConnectionConfig, TableSchema, QueryResultData } from './database-types';

export class MySQLDatabaseService {
  private pools: Map<string, Pool> = new Map();
  private activeConnections: Map<string, DatabaseConnectionConfig> = new Map();

  /**
   * Build a mysql2 connection config from our generic config.
   */
  private buildPoolConfig(config: DatabaseConnectionConfig) {
    return {
      host: config.host,
      port: parseInt(config.port, 10) || 3306,
      database: config.database,
      user: config.username,
      password: config.password || '',
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 10000,
    };
  }

  /**
   * Generate a unique connection ID for a config.
   */
  private getConnectionId(config: DatabaseConnectionConfig): string {
    return `mysql:${config.host}:${config.port}/${config.database}`;
  }

  /**
   * Connect to a MySQL database and return the connection ID.
   */
  async connect(config: DatabaseConnectionConfig): Promise<string> {
    const connectionId = this.getConnectionId(config);

    if (this.pools.has(connectionId)) {
      await this.disconnect(connectionId);
    }

    const poolConfig = this.buildPoolConfig(config);

    try {
      const pool = createPool(poolConfig);

      // Test the connection
      const conn = await pool.getConnection();
      conn.release();

      (pool as any).on('error', (err: any) => {
        console.error(`[MySQLDatabaseService] Unexpected pool error for ${connectionId}:`, err.message);
      });

      this.pools.set(connectionId, pool);
      this.activeConnections.set(connectionId, config);

      return connectionId;
    } catch (error: any) {
      throw new Error(`MySQL connection failed: ${error.message}`);
    }
  }

  /**
   * Test a MySQL connection without storing it.
   */
  async testConnection(config: DatabaseConnectionConfig): Promise<{ success: boolean; error?: string }> {
    const poolConfig = this.buildPoolConfig(config);
    let pool: Pool | null = null;

    try {
      pool = createPool(poolConfig);
      const conn = await pool.getConnection();
      conn.release();
      await pool.end();
      return { success: true };
    } catch (error: any) {
      if (pool) await pool.end().catch(() => {});
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnect from a MySQL database.
   */
  async disconnect(connectionId: string): Promise<void> {
    const pool = this.pools.get(connectionId);
    if (pool) {
      try {
        await pool.end();
      } catch (err) {
        console.error(`[MySQLDatabaseService] Error closing pool ${connectionId}:`, err);
      }
      this.pools.delete(connectionId);
      this.activeConnections.delete(connectionId);
    }
  }

  /**
   * Fetch the schema (tables and columns) from a connected MySQL database.
   */
  async fetchSchema(connectionId: string): Promise<TableSchema[]> {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`No active MySQL connection found for: ${connectionId}`);
    }

    try {
      // Get all tables
      const [tables] = await pool.query('SHOW TABLES');
      const tableNames: string[] = (tables as any[]).map((row: any) => Object.values(row)[0] as string);

      const result: TableSchema[] = [];

      for (const tableName of tableNames) {
        const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
        const rows = columns as any[];
        const cols = rows.map((col: any) => ({
          name: col.Field,
          type: this.mapMySQLType(col.Type),
          nullable: col.Null === 'YES',
        }));
        result.push({ tableName, columns: cols });
      }

      return result;
    } catch (error: any) {
      throw new Error(`Failed to fetch MySQL schema: ${error.message}`);
    }
  }

  /**
   * Map MySQL data types to simplified types.
   */
  private mapMySQLType(mysqlType: string): string {
    const typeStr = mysqlType.toLowerCase();
    if (typeStr.includes('int') || typeStr.includes('decimal') || typeStr.includes('float') || typeStr.includes('double') || typeStr.includes('numeric') || typeStr.includes('real')) {
      return 'number';
    }
    if (typeStr.includes('date') || typeStr.includes('time') || typeStr.includes('timestamp') || typeStr.includes('year')) {
      return 'date';
    }
    return 'string';
  }

  /**
   * Execute a SELECT query against the connected MySQL database.
   */
  async executeQuery(connectionId: string, sql: string): Promise<QueryResultData> {
    const pool = this.pools.get(connectionId);
    if (!pool) {
      throw new Error(`No active MySQL connection found for: ${connectionId}`);
    }

    const upperSql = sql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      throw new Error('Security Violation: Only SELECT queries are allowed.');
    }

    const forbidden = ['DROP', 'UPDATE', 'ALTER', 'INSERT', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE', 'DELETE'];
    for (const verb of forbidden) {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      if (regex.test(sql)) {
        throw new Error(`Security Violation: Command '${verb}' is not permitted. Only read-only SELECT operations are allowed.`);
      }
    }

    const startTime = performance.now();

    try {
      const cleanSql = sql.trim().replace(/;$/, '');
      const [rows] = await pool.query(cleanSql);
      const rowData = rows as any[];
      const queryTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

      // Extract columns from the first row
      const columns = rowData.length > 0 ? Object.keys(rowData[0]) : [];

      return {
        columns,
        rows: rowData as Record<string, any>[],
        rowCount: rowData.length,
        queryTimeMs,
        sql: cleanSql,
      };
    } catch (error: any) {
      throw new Error(`MySQL query execution failed: ${error.message}`);
    }
  }

  /**
   * Get list of active MySQL connection IDs.
   */
  getActiveConnections(): string[] {
    return Array.from(this.activeConnections.keys());
  }
}

// Singleton instance
export const mysqlDatabaseService = new MySQLDatabaseService();
