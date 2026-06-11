/**
 * Client-safe type definitions for database operations.
 * This file contains NO server-only code — safe to import in client components.
 */

export interface DatabaseConnectionConfig {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface TableSchema {
  tableName: string;
  columns: { name: string; type: string; nullable: boolean }[];
}

export interface QueryResultData {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  queryTimeMs: number;
  sql: string;
}

export interface DbApiResponse<T = any> {
  success: boolean;
  error?: string;
  connectionId?: string;
  schema?: Record<string, string[]>;
  lastSyncedAt?: string;
  data?: T;
}
