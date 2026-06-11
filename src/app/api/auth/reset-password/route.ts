import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { databaseService, getPersistentConnection } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: 'Token and new password are required.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    // Connect to database
    let connectionId: string;
    try {
      connectionId = await getPersistentConnection();
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed.' },
        { status: 503 }
      );
    }

    // Find the reset token
    const tokenResult = await databaseService.executeWriteQuery(
      connectionId,
      `SELECT id, user_id, expires_at, used
       FROM password_reset_tokens
       WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      );
    }

    const resetRecord = tokenResult.rows[0];

    // Check if already used
    if (resetRecord.used) {
      return NextResponse.json(
        { success: false, error: 'This reset link has already been used. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if expired
    const expiresAt = new Date(resetRecord.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update the user's password
    await databaseService.executeWriteQuery(
      connectionId,
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [passwordHash, resetRecord.user_id]
    );

    // Mark the token as used
    await databaseService.executeWriteQuery(
      connectionId,
      `UPDATE password_reset_tokens SET used = TRUE WHERE id = $1`,
      [resetRecord.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now sign in with your new password.',
    });
  } catch (err: any) {
    console.error('[API/Auth/ResetPassword] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
