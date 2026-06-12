import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

interface DeleteRequest {
  tableName: string;
}

/**
 * POST /api/datasets/delete
 *
 * Drops the PostgreSQL table and removes metadata for a server-uploaded dataset.
 *
 * Request body:
 * {
 *   tableName: string  // the full server-side table name (e.g. "usr_1_sales_data")
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

    // Parse body
    const body: DeleteRequest = await request.json();
    const { tableName } = body;

    if (!tableName) {
      return NextResponse.json(
        { success: false, error: 'tableName is required.' },
        { status: 400 }
      );
    }

    // Security: only allow deleting tables that belong to this user
    const expectedPrefix = `usr_${userId}_`;
    if (!tableName.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { success: false, error: 'Access denied: you can only delete your own datasets.' },
        { status: 403 }
      );
    }

    const connectionId = await getPersistentConnection();

    // Drop the PostgreSQL table
    await databaseService.executeWriteQuery(
      connectionId,
      `DROP TABLE IF EXISTS "${tableName}"`
    );

    // Remove metadata from user_uploaded_datasets
    await databaseService.executeWriteQuery(
      connectionId,
      `DELETE FROM user_uploaded_datasets WHERE user_id = $1 AND table_name = $2`,
      [userId, tableName]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/Datasets/Delete] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
