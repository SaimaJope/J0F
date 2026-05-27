import { NextResponse } from "next/server";
import {
  createSiteLockToken,
  getSiteLockPin,
  SITE_LOCK_COOKIE,
  SITE_LOCK_COOKIE_MAX_AGE
} from "@/lib/site-lock";

export const runtime = "edge";

type UnlockPayload = {
  pin?: unknown;
};

export async function POST(request: Request) {
  let body: UnlockPayload;

  try {
    body = (await request.json()) as UnlockPayload;
  } catch {
    return errorResponse("Invalid request.", 400);
  }

  if (body.pin !== getSiteLockPin()) {
    return errorResponse("Invalid PIN.", 401);
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(SITE_LOCK_COOKIE, await createSiteLockToken(), {
    httpOnly: true,
    maxAge: SITE_LOCK_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  response.headers.set("Cache-Control", "no-store");

  return response;
}

function errorResponse(message: string, status: number) {
  const response = NextResponse.json({ error: message }, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
