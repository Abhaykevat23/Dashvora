import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

async function ensureTableCreated(connectionId: string) {
  await databaseService.executeWriteQuery(
    connectionId,
    `CREATE TABLE IF NOT EXISTS dashboards (
      id VARCHAR(255) PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      dataset_id VARCHAR(255) NOT NULL,
      config JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const connectionId = await getPersistentConnection();
    await ensureTableCreated(connectionId);

    const result = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id, workspace, title, dataset_id as "datasetId", config, created_at as "createdAt", updated_at as "updatedAt" FROM dashboards WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );

    return NextResponse.json({ success: true, dashboards: result.rows });
  } catch (err: any) {
    console.error('[API/Dashboards/GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const body = await request.json();
    const { id, workspace, title, datasetId, config } = body;

    if (!workspace || !title || !datasetId || !config) {
      return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }

    const connectionId = await getPersistentConnection();
    await ensureTableCreated(connectionId);

    const dashboardId = id || `dash_${Math.random().toString(36).substring(2, 9)}`;

    // Check if dashboard exists
    const checkResult = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id FROM dashboards WHERE id = $1 AND user_id = $2',
      [dashboardId, userId]
    );

    if (checkResult.rows.length > 0) {
      // Update
      await databaseService.executeWriteQuery(
        connectionId,
        'UPDATE dashboards SET workspace = $1, title = $2, dataset_id = $3, config = $4, updated_at = NOW() WHERE id = $5 AND user_id = $6',
        [workspace, title, datasetId, JSON.stringify(config), dashboardId, userId]
      );
    } else {
      // Insert
      await databaseService.executeWriteQuery(
        connectionId,
        'INSERT INTO dashboards (id, user_id, workspace, title, dataset_id, config, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [dashboardId, userId, workspace, title, datasetId, JSON.stringify(config)]
      );
    }

    return NextResponse.json({
      success: true,
      dashboard: {
        id: dashboardId,
        workspace,
        title,
        datasetId,
        config
      }
    });
  } catch (err: any) {
    console.error('[API/Dashboards/POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const userId = payload.userId;

    const { searchParams } = new URL(request.url);
    const dashboardId = searchParams.get('id');

    if (!dashboardId) {
      return NextResponse.json({ success: false, error: 'Dashboard ID is required.' }, { status: 400 });
    }

    const connectionId = await getPersistentConnection();
    await ensureTableCreated(connectionId);

    await databaseService.executeWriteQuery(
      connectionId,
      'DELETE FROM dashboards WHERE id = $1 AND user_id = $2',
      [dashboardId, userId]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API/Dashboards/DELETE] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
