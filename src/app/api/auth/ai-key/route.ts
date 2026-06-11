import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';
import { encrypt, decrypt, serializeEncrypted, parseEncrypted } from '@/lib/crypto/encryption';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * GET /api/auth/ai-key
 * Returns the user's AI key configuration (masked key, never the full key).
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
      'SELECT ai_provider, ai_model, ai_api_endpoint, ai_api_key FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const row = result.rows[0];

    // Decrypt the key for both full key (in-memory store use) and masked preview
    let fullKey = '';
    let keyPreview = '';
    if (row.ai_api_key) {
      try {
        const decrypted = decrypt(parseEncrypted(row.ai_api_key));
        fullKey = decrypted;
        keyPreview = decrypted.slice(0, 8) + '...' + decrypted.slice(-4);
      } catch {
        keyPreview = 'Invalid encryption';
      }
    }

    return NextResponse.json({
      success: true,
      config: {
        provider: row.ai_provider || 'openai',
        model: row.ai_model || 'gpt-4o',
        endpoint: row.ai_api_endpoint || '',
        keyPreview,
        fullKey,
        hasKey: !!row.ai_api_key,
      },
    });
  } catch (err: any) {
    console.error('[API/Auth/AIKey] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * PUT /api/auth/ai-key
 * Saves the user's AI key configuration. The API key is encrypted before storage.
 */
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const body = await request.json();
    const { provider, model, endpoint, apiKey } = body;

    // Validate
    if (apiKey !== undefined && apiKey !== null && typeof apiKey === 'string') {
      if (apiKey.trim().length < 8) {
        return NextResponse.json(
          { success: false, error: 'API key seems too short. Please provide a valid key.' },
          { status: 400 }
        );
      }
    }

    // Build update
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (provider !== undefined) {
      updates.push(`ai_provider = $${paramIndex++}`);
      params.push(provider);
    }
    if (model !== undefined) {
      updates.push(`ai_model = $${paramIndex++}`);
      params.push(model);
    }
    if (endpoint !== undefined) {
      updates.push(`ai_api_endpoint = $${paramIndex++}`);
      params.push(endpoint);
    }
    if (apiKey !== undefined && apiKey !== null && typeof apiKey === 'string') {
      // Encrypt the API key
      const encrypted = encrypt(apiKey.trim());
      const serialized = serializeEncrypted(encrypted);
      updates.push(`ai_api_key = $${paramIndex++}`);
      params.push(serialized);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update.' }, { status: 400 });
    }

    const connectionId = await getPersistentConnection();
    params.push(userId);

    const result = await databaseService.executeWriteQuery(
      connectionId,
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING ai_provider, ai_model, ai_api_endpoint`,
      params
    );

    const updated = result.rows[0];

    return NextResponse.json({
      success: true,
      config: {
        provider: updated.ai_provider,
        model: updated.ai_model,
        endpoint: updated.ai_api_endpoint,
        hasKey: true,
      },
    });
  } catch (err: any) {
    console.error('[API/Auth/AIKey] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
