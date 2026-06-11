import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { databaseService, getPersistentConnection } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

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

    // Check if user exists (but don't reveal that to the client — security best practice)
    const userResult = await databaseService.executeWriteQuery(
      connectionId,
      'SELECT id, name, email FROM users WHERE email = $1',
      [normalizedEmail]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    const user = userResult.rows[0];

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Clean up any existing unused tokens for this user
    await databaseService.executeWriteQuery(
      connectionId,
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used = FALSE AND expires_at < NOW()`,
      [user.id]
    );

    // Store token in database
    await databaseService.executeWriteQuery(
      connectionId,
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Try to send email via nodemailer if SMTP is configured
    let emailSent = false;

    if (process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Dashvora" <${process.env.SMTP_USER || 'noreply@dashvora.app'}>`,
          to: user.email,
          subject: 'Reset your Dashvora password',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #06b6d4, #7c3aed); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h1 style="font-size: 20px; color: #111; margin: 0;">Reset Your Password</h1>
              </div>
              <p style="color: #555; font-size: 14px; line-height: 1.6;">
                Hi <strong>${user.name}</strong>,
              </p>
              <p style="color: #555; font-size: 14px; line-height: 1.6;">
                We received a request to reset the password for your Dashvora account. Click the button below to set a new password:
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #06b6d4, #7c3aed); color: white; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600;">
                  Reset Password
                </a>
              </div>
              <p style="color: #888; font-size: 12px; line-height: 1.5;">
                This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #aaa; font-size: 11px; text-align: center;">
                Dashvora — AI Analytics Engine
              </p>
            </div>
          `,
        });
        emailSent = true;
      } catch (emailErr: any) {
        console.error('[API/Auth/ForgotPassword] Failed to send email:', emailErr.message);
        // Don't block the flow — return the reset link directly in dev
      }
    } else {
      console.log('[API/Auth/ForgotPassword] SMTP not configured. Reset link (dev only):', resetUrl);
    }

    // If email wasn't sent (dev mode or SMTP failure), return the link in the response
    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'If an account exists with that email, a password reset link has been sent.'
        : 'Email service not configured. Use the reset link below (dev mode):',
      resetUrl: emailSent ? undefined : resetUrl,
    });
  } catch (err: any) {
    console.error('[API/Auth/ForgotPassword] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
