import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { routing } from './lib/i18n/routing';
import { authorizeRoute } from './lib/auth/authorize';

const handleI18n = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: request.nextUrl.protocol === 'https:',
  });

  const decision = authorizeRoute({
    pathname: request.nextUrl.pathname,
    isLoggedIn: Boolean(token),
    role: (token?.role as 'USER' | 'ADMIN' | undefined) ?? null,
  });

  if (decision.type === 'redirect') {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return handleI18n(request);
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
