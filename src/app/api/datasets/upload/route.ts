import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

interface UploadRequest {
  tableName: string;
  displayName: string;
  columns: { name: string; type: 'number' | 'string' | 'date' }[];
  rows: Record<string, any>[];
}

const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB limit

/**
 * POST /api/datasets/upload
 *
 * Accepts parsed file data and creates a new table in the application's
 * PostgreSQL database. The table name is sanitized from the filename.
 *
 * Request body:
 * {
 *   tableName: string,       // sanitized table name
 *   displayName: string,     // user-friendly name
 *   columns: [{ name, type }],
 *   rows: [{ col: val }, ...]
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
    const body: UploadRequest = await request.json();
    const { tableName, displayName, columns, rows } = body;

    if (!tableName || !columns || !rows || columns.length === 0) {
      return NextResponse.json(
        { success: false, error: 'tableName, columns, and rows are required.' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No data rows to insert.' },
        { status: 400 }
      );
    }

    // Sanitize table name: only allow alphanumeric and underscores
    const safeTableName = tableName
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[^a-z]+/, 't_') // must start with a letter
      .substring(0, 63); // PostgreSQL max identifier length

    // Ensure table name is unique per user by prefixing
    const finalTableName = `usr_${userId}_${safeTableName}`;

    const connectionId = await getPersistentConnection();

    try {
      // Build CREATE TABLE statement
      const columnDefs = columns.map((col) => {
        const safeColName = col.name.replace(/[^a-z0-9_]/g, '_').toLowerCase();
        let pgType: string;
        switch (col.type) {
          case 'number':
            pgType = 'DOUBLE PRECISION';
            break;
          case 'date':
            pgType = 'DATE';
            break;
          default:
            pgType = 'TEXT';
        }
        return `"${safeColName}" ${pgType}`;
      });

      // Drop existing table with same name (if any)
      await databaseService.executeWriteQuery(
        connectionId,
        `DROP TABLE IF EXISTS "${finalTableName}"`
      );

      // Create the table
      await databaseService.executeWriteQuery(
        connectionId,
        `CREATE TABLE "${finalTableName}" (${columnDefs.join(', ')})`
      );

      // Insert rows in batches of 500
      const batchSize = 500;
      const safeColumnNames = columns.map((c) => `"${c.name.replace(/[^a-z0-9_]/g, '_').toLowerCase()}"`);

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valuePlaceholders: string[] = [];
        const flatValues: any[] = [];
        let paramIdx = 1;

        for (const row of batch) {
          const rowPlaceholders: string[] = [];
          for (const col of columns) {
            const safeName = col.name.replace(/[^a-z0-9_]/g, '_').toLowerCase();
            const val = row[col.name] !== undefined ? row[col.name] : (row[safeName] ?? null);
            rowPlaceholders.push(`$${paramIdx++}`);
            // Convert empty strings to null for numeric columns
            if (col.type === 'number' && (val === '' || val === null || val === undefined)) {
              flatValues.push(null);
            } else if (col.type === 'number') {
              const num = Number(val);
              flatValues.push(isNaN(num) ? null : num);
            } else {
              flatValues.push(val !== null && val !== undefined ? String(val) : null);
            }
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const insertSQL = `INSERT INTO "${finalTableName}" (${safeColumnNames.join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
        await databaseService.executeWriteQuery(connectionId, insertSQL, flatValues);
      }

      // Verify count
      const countResult = await databaseService.executeWriteQuery(
        connectionId,
        `SELECT COUNT(*) as cnt FROM "${finalTableName}"`
      );
      const insertedCount = parseInt(countResult.rows[0]?.cnt || '0', 10);

      // Register table metadata in user_uploaded_datasets
      await databaseService.executeWriteQuery(
        connectionId,
        `INSERT INTO user_uploaded_datasets (user_id, table_name, original_filename, display_name, columns, row_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id, table_name) DO UPDATE SET
           row_count = EXCLUDED.row_count,
           columns = EXCLUDED.columns,
           updated_at = NOW()`,
        [
          userId,
          finalTableName,
          displayName,
          displayName,
          JSON.stringify(columns),
          insertedCount,
        ]
      );

      return NextResponse.json({
        success: true,
        dataset: {
          id: `server_${tableName}_${Date.now()}`,
          name: displayName,
          tableName: finalTableName,
          columns,
          rowCount: insertedCount,
          description: `Uploaded dataset "${displayName}" stored in PostgreSQL.`,
          sourceType: 'server_upload',
        },
      });
    } catch (err: any) {
      // Cleanup on failure
      await databaseService.executeWriteQuery(
        connectionId,
        `DROP TABLE IF EXISTS "${finalTableName}"`
      ).catch(() => {});
      throw err;
    }
  } catch (err: any) {
    console.error('[API/Datasets/Upload] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}
