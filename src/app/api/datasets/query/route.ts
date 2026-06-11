import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';
import { QueryResultData } from '@/lib/database-types';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * POST /api/datasets/query
 *
 * Executes a read-only SQL query against the application's own PostgreSQL database.
 * Used for querying server-uploaded datasets (large files stored as PG tables).
 *
 * Request body:
 * {
 *   tableName: string,    // The full table name (e.g. "usr_42_my_data")
 *   sql: string           // The SQL query to execute (SELECT only)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const body = await request.json();
    const { tableName, sql } = body;

    if (!tableName || !sql) {
      return NextResponse.json(
        { success: false, error: 'tableName and sql are required.' },
        { status: 400 }
      );
    }

    // Security: only allow queries against tables owned by this user
    const expectedPrefix = `usr_${userId}_`;
    if (!tableName.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: you can only query your own datasets.' },
        { status: 403 }
      );
    }

    // Security: only SELECT queries allowed
    const upperSql = sql.trim().toUpperCase();
    if (!upperSql.startsWith('SELECT')) {
      return NextResponse.json(
        { success: false, error: 'Only SELECT queries are allowed.' },
        { status: 403 }
      );
    }

    const forbidden = ['DELETE', 'DROP', 'UPDATE', 'ALTER', 'INSERT', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE'];
    for (const verb of forbidden) {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      if (regex.test(sql)) {
        return NextResponse.json(
          { success: false, error: `Security Violation: Command '${verb}' is not permitted.` },
          { status: 403 }
        );
      }
    }

    const connectionId = await getPersistentConnection();
    const result: QueryResultData = await databaseService.executeQuery(connectionId, sql);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[API/Datasets/Query] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Query failed.' },
      { status: 500 }
    );
  }
}
