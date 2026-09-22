import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isTechArea = pathname === '/tech' || pathname.startsWith('/tech/');
  const signedIn = Boolean(request.cookies.get('hvac_session')?.value);
  const techSignedIn = Boolean(request.cookies.get('hvac_tech')?.value);
  const isLogin = pathname === '/login';

  if (isTechArea) {
    if (!techSignedIn) return NextResponse.redirect(new URL('/login?role=tech', request.url));
    return NextResponse.next();
  }

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
