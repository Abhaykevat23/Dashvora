import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('dashvora_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    return NextResponse.json({
      success: true,
      user: {
        id: payload.userId,
        name: payload.name,
        email: payload.email,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token.' },
      { status: 401 }
    );
  }
}
