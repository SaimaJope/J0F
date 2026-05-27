import { NextRequest, NextResponse } from "next/server";
import { isValidSiteLockToken, SITE_LOCK_COOKIE } from "./lib/site-lock";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isOpenPath(pathname)) {
    return NextResponse.next();
  }

  const isUnlocked = await isValidSiteLockToken(
    request.cookies.get(SITE_LOCK_COOKIE)?.value
  );

  if (pathname === "/lock" || pathname.startsWith("/lock/")) {
    if (!isUnlocked) return NextResponse.next();

    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isUnlocked) {
    return NextResponse.next();
  }

  const lockUrl = new URL("/lock", request.url);
  const nextPath = `${pathname}${search}`;

  if (nextPath !== "/") {
    lockUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(lockUrl);
}

function isOpenPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/api/site-lock" ||
    pathname === "/logo.png" ||
    pathname === "/favicon.ico"
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"]
};
