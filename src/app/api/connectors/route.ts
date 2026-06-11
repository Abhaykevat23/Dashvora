import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';
import { mysqlDatabaseService } from '@/lib/mysqlDatabase';
import { encrypt, decrypt, serializeEncrypted, parseEncrypted } from '@/lib/crypto/encryption';
import { DatabaseConnectionConfig } from '@/lib/database-types';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

function getService(type?: string) {
  if (type === 'MySQL') return mysqlDatabaseService;
  return databaseService;
}

/**
 * GET /api/connectors
 * Returns all saved connectors for the authenticated user (passwords decrypted).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const connectionId = await getPersistentConnection();
    const result = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id, name, type, host, port, database_name, username, password_encrypted, ssl, created_at FROM user_connectors WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const connectors = result.rows.map((row: any) => {
      let password = '';
      if (row.password_encrypted) {
        try {
          password = decrypt(parseEncrypted(row.password_encrypted));
        } catch {
          password = '';
        }
      }
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        host: row.host,
        port: row.port,
        database: row.database_name,
        username: row.username,
        password,
        ssl: row.ssl,
      };
    });

    return NextResponse.json({ success: true, connectors });
  } catch (err: any) {
    console.error('[API/Connectors/GET] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/connectors
 * Saves a new connector (password encrypted) and optionally connects to test it.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const body = await request.json();
    const { name, type, host, port, database: dbName, username, password, ssl } = body;

    if (!name || !host || !dbName) {
      return NextResponse.json(
        { success: false, error: 'Name, host, and database are required.' },
        { status: 400 }
      );
    }

    const connectorId = `saved_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const defaultPort = type === 'MySQL' ? '3306' : '5432';

    // Encrypt the password
    let passwordEncrypted = '';
    if (password) {
      const encrypted = encrypt(password);
      passwordEncrypted = serializeEncrypted(encrypted);
    }

    const connectionId = await getPersistentConnection();

    // Check if connector with same name already exists for this user
    const existing = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id FROM user_connectors WHERE user_id = $1 AND name = $2',
      [userId, name]
    );

    let finalId = connectorId;

    if (existing.rows.length > 0) {
      // Update existing connector
      finalId = existing.rows[0].id;
      const updateFields: string[] = [];
      const params: any[] = [];
      let idx = 1;

      updateFields.push(`type = $${idx++}`); params.push(type || 'PostgreSQL');
      updateFields.push(`host = $${idx++}`); params.push(host);
      updateFields.push(`port = $${idx++}`); params.push(port || defaultPort);
      updateFields.push(`database_name = $${idx++}`); params.push(dbName);
      updateFields.push(`username = $${idx++}`); params.push(username || '');
      updateFields.push(`ssl = $${idx++}`); params.push(!!ssl);
      if (passwordEncrypted) {
        updateFields.push(`password_encrypted = $${idx++}`);
        params.push(passwordEncrypted);
      }
      updateFields.push('updated_at = NOW()');
      params.push(finalId);

      await databaseService.executeWriteQuery(
        connectionId,
        `UPDATE user_connectors SET ${updateFields.join(', ')} WHERE id = $${idx}`,
        params
      );
    } else {
      // Insert new connector
      await databaseService.executeWriteQuery(
        connectionId,
        `INSERT INTO user_connectors (id, user_id, name, type, host, port, database_name, username, password_encrypted, ssl, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          finalId, userId, name, type || 'PostgreSQL',
          host, port || defaultPort, dbName, username || '',
          passwordEncrypted || '', !!ssl,
        ]
      );
    }

    return NextResponse.json({
      success: true,
      connector: { id: finalId, name, type, host, port, database: dbName, username, ssl },
    });
  } catch (err: any) {
    console.error('[API/Connectors/POST] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE /api/connectors?id=xxx
 * Deletes a saved connector.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const { searchParams } = new URL(request.url);
    const connectorId = searchParams.get('id');

    if (!connectorId) {
      return NextResponse.json({ success: false, error: 'Connector ID is required.' }, { status: 400 });
    }

    const connectionId = await getPersistentConnection();
    await databaseService.executeWriteQuery(
      connectionId,
      'DELETE FROM user_connectors WHERE id = $1 AND user_id = $2',
      [connectorId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/Connectors/DELETE] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
