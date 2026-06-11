import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../lib/database';
import { mysqlDatabaseService } from '../../../lib/mysqlDatabase';
import { DatabaseConnectionConfig } from '../../../lib/database-types';

/**
 * POST /api/db
 * 
 * Server-side endpoint for all database operations (PostgreSQL and MySQL).
 * Routes to the correct driver based on the `type` field.
 *
 * Request body:
 * {
 *   action: "connect" | "test" | "disconnect" | "query" | "schema",
 *   type?: "PostgreSQL" | "MySQL",       // defaults to PostgreSQL
 *   connectionId?: string,
 *   config?: { host, port, database, username, password, ssl },
 *   sql?: string
 * }
 */

interface DbApiRequest {
  action: 'connect' | 'test' | 'disconnect' | 'query' | 'schema';
  type?: 'PostgreSQL' | 'MySQL';
  connectionId?: string;
  config?: {
    host: string;
    port: string;
    database: string;
    username: string;
    password?: string;
    ssl: boolean;
  };
  sql?: string;
}

function getService(type?: string) {
  if (type === 'MySQL') {
    return mysqlDatabaseService;
  }
  return databaseService;
}

export async function POST(request: NextRequest) {
  try {
    const body: DbApiRequest = await request.json();
    const { action, type, connectionId, config, sql } = body;
    const service = getService(type);

    switch (action) {
      // ---------- CONNECT ----------
      case 'connect': {
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'Missing database config' },
            { status: 400 }
          );
        }
        if (!config.host || !config.database) {
          return NextResponse.json(
            { success: false, error: 'Host and database name are required' },
            { status: 400 }
          );
        }

        const defaultPort = type === 'MySQL' ? '3306' : '5432';
        const fullConfig: DatabaseConnectionConfig = {
          host: config.host,
          port: config.port || defaultPort,
          database: config.database,
          username: config.username || (type === 'MySQL' ? 'root' : 'postgres'),
          password: config.password || '',
          ssl: config.ssl,
        };

        try {
          const poolId = await service.connect(fullConfig);

          // Fetch schema on connect
          let schema: Record<string, string[]> | undefined;
          try {
            const tables = await service.fetchSchema(poolId);
            schema = {};
            for (const table of tables) {
              schema[table.tableName] = table.columns.map(c => c.name);
            }
          } catch (schemaErr) {
            console.warn(`[API/DB] Schema fetch failed on connect:`, schemaErr);
          }

          return NextResponse.json({
            success: true,
            connectionId: poolId,
            schema,
            lastSyncedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          });
        } catch (err: any) {
          return NextResponse.json(
            { success: false, error: err.message },
            { status: 503 }
          );
        }
      }

      // ---------- TEST ----------
      case 'test': {
        if (!config) {
          return NextResponse.json(
            { success: false, error: 'Missing database config' },
            { status: 400 }
          );
        }

        const defaultPort = type === 'MySQL' ? '3306' : '5432';
        const fullConfig: DatabaseConnectionConfig = {
          host: config.host,
          port: config.port || defaultPort,
          database: config.database,
          username: config.username || (type === 'MySQL' ? 'root' : 'postgres'),
          password: config.password || '',
          ssl: config.ssl,
        };

        const result = await service.testConnection(fullConfig);
        return NextResponse.json(result);
      }

      // ---------- DISCONNECT ----------
      case 'disconnect': {
        if (!connectionId) {
          return NextResponse.json(
            { success: false, error: 'Missing connectionId' },
            { status: 400 }
          );
        }

        await service.disconnect(connectionId);
        return NextResponse.json({ success: true });
      }

      // ---------- QUERY ----------
      case 'query': {
        if (!connectionId) {
          return NextResponse.json(
            { success: false, error: 'Missing connectionId' },
            { status: 400 }
          );
        }
        if (!sql) {
          return NextResponse.json(
            { success: false, error: 'Missing sql query' },
            { status: 400 }
          );
        }

        try {
          const result = await service.executeQuery(connectionId, sql);
          return NextResponse.json({ success: true, data: result });
        } catch (err: any) {
          return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
          );
        }
      }

      // ---------- SCHEMA ----------
      case 'schema': {
        if (!connectionId) {
          return NextResponse.json(
            { success: false, error: 'Missing connectionId' },
            { status: 400 }
          );
        }

        try {
          const tables = await service.fetchSchema(connectionId);
          const schema: Record<string, string[]> = {};
          for (const table of tables) {
            schema[table.tableName] = table.columns.map(c => c.name);
          }
          return NextResponse.json({
            success: true,
            schema,
            lastSyncedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          });
        } catch (err: any) {
          return NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
          );
        }
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('[API/DB] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
