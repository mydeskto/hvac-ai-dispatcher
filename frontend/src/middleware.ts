import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get('hvac_session')?.value);
  const isLogin = request.nextUrl.pathname === '/login';

  if (!signedIn && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (signedIn && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
