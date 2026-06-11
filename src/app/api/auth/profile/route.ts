import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtVerify } from 'jose';
import { databaseService, getPersistentConnection } from '@/lib/database';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function PUT(request: NextRequest) {
  try {
    // 1. Verify the JWT cookie to identify the user
    const token = request.cookies.get('dashvora_token')?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    let payload: { userId: number; name: string; email: string };
    try {
      const result = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
      payload = result.payload as any;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    const userId = payload.userId;

    // 2. Parse the request body
    const { name, email, currentPassword, newPassword } = await request.json();

    // 3. Get persistent database connection
    let connectionId: string;
    try {
      connectionId = await getPersistentConnection();
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed.' },
        { status: 503 }
      );
    }

    // 4. Fetch the current user record (need the password_hash to verify current password)
    const userResult = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id, name, email, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found.' },
        { status: 404 }
      );
    }

    const currentUser = userResult.rows[0];

    // 5. Build the update fields
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Track what will be in the new JWT
    let newName = currentUser.name;
    let newEmail = currentUser.email;

    // --- Update name ---
    if (name !== undefined && name !== null) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Name cannot be empty.' },
          { status: 400 }
        );
      }
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
      newName = name.trim();
    }

    // --- Update email ---
    if (email !== undefined && email !== null) {
      if (typeof email !== 'string' || email.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Email cannot be empty.' },
          { status: 400 }
        );
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { success: false, error: 'Please provide a valid email address.' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      // If email is changing, check it's not taken by another user
      if (normalizedEmail !== currentUser.email) {
        const existingResult = await databaseService.executeWriteQuery(
          connectionId,
          'SELECT id FROM users WHERE email = $1 AND id != $2',
          [normalizedEmail, userId]
        );

        if (existingResult.rows.length > 0) {
          return NextResponse.json(
            { success: false, error: 'This email is already in use by another account.' },
            { status: 409 }
          );
        }
      }

      updates.push(`email = $${paramIndex++}`);
      params.push(normalizedEmail);
      newEmail = normalizedEmail;
    }

    // --- Update password ---
    if (newPassword !== undefined && newPassword !== null) {
      // Require current password for security
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to set a new password.' },
          { status: 400 }
        );
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 8 characters.' },
          { status: 400 }
        );
      }

      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, currentUser.password_hash);
      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect.' },
          { status: 401 }
        );
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      updates.push(`password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    // If nothing to update
    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update.' },
        { status: 400 }
      );
    }

    // 6. Execute the update
    updates.push(`updated_at = NOW()`);
    params.push(userId);

    const updateResult = await databaseService.executeWriteQuery(
      connectionId,
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, created_at`,
      params
    );

    const updatedUser = updateResult.rows[0];

    // 7. Re-issue JWT with updated details
    const newToken = jwt.sign(
      {
        userId: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        createdAt: updatedUser.created_at,
      },
    });

    response.cookies.set('dashvora_token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('[API/Auth/Profile] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
