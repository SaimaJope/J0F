export const SITE_LOCK_COOKIE = "jf_site_lock";
export const SITE_LOCK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const DEFAULT_SITE_LOCK_PIN = "7777";
const TOKEN_VERSION = "v1";
const TOKEN_SKEW_SECONDS = 60;
const encoder = new TextEncoder();

export function getSiteLockPin() {
  return process.env.SITE_LOCK_PIN?.trim() || DEFAULT_SITE_LOCK_PIN;
}

export async function createSiteLockToken() {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const payload = `${TOKEN_VERSION}.${issuedAt}`;
  const signature = await sign(payload);

  return `${payload}.${signature}`;
}

export async function isValidSiteLockToken(token: string | undefined) {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, issuedAtValue, signature] = parts;
  if (version !== TOKEN_VERSION || !issuedAtValue || !signature) return false;

  const issuedAt = Number(issuedAtValue);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isFinite(issuedAt)) return false;
  if (issuedAt > now + TOKEN_SKEW_SECONDS) return false;
  if (now - issuedAt > SITE_LOCK_COOKIE_MAX_AGE) return false;

  const expected = await sign(`${version}.${issuedAtValue}`);
  return constantTimeEqual(signature, expected);
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSiteLockSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  return toBase64Url(signature);
}

function getSiteLockSecret() {
  return process.env.SITE_LOCK_SECRET?.trim() || getSiteLockPin();
}

function toBase64Url(buffer: ArrayBuffer) {
  let value = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}
