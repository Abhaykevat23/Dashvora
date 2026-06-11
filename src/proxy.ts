import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'dashvora-dev-secret-change-in-production';

// Pre-encode the secret once (reuse across invocations)
const secretKey = new TextEncoder().encode(JWT_SECRET);

/**
 * Build a redirect URL to the login page, preserving the intended destination.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  // Read the JWT cookie
  const token = request.cookies.get('dashvora_token')?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  try {
    // Verify the JWT using jose (Edge-compatible)
    await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    // Token is valid — allow the request
    return NextResponse.next();
  } catch {
    // Token is invalid or expired — redirect to login
    return redirectToLogin(request);
  }
}

/**
 * Configure which routes this proxy runs on.
 * We scope it to only run on paths we care about for performance.
 */
export const config = {
  matcher: [
    // Protected routes
    '/dashboard',
    '/dashboard/:path*',

    // Also run on API auth routes (so we can add cookie refresh later if needed)
    // Note: We intentionally exclude /api/auth/login and /api/auth/signup
  ],
};
