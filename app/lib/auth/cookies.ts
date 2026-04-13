import type { AuthTokens } from "~/domain/entities/auth";

const ACCESS_TOKEN_NAME = "access_token";
const REFRESH_TOKEN_NAME = "refresh_token";
const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

function buildCookie(
  name: string,
  value: string,
  maxAge: number,
  isProduction: boolean
): string {
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (isProduction) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function setAuthCookies(
  headers: Headers,
  tokens: AuthTokens,
  isProduction = true
): void {
  headers.append(
    "Set-Cookie",
    buildCookie(
      ACCESS_TOKEN_NAME,
      tokens.accessToken,
      ACCESS_TOKEN_MAX_AGE,
      isProduction
    )
  );
  headers.append(
    "Set-Cookie",
    buildCookie(
      REFRESH_TOKEN_NAME,
      tokens.refreshToken,
      REFRESH_TOKEN_MAX_AGE,
      isProduction
    )
  );
}

export function clearAuthCookies(
  headers: Headers,
  isProduction = true
): void {
  headers.append(
    "Set-Cookie",
    buildCookie(ACCESS_TOKEN_NAME, "", 0, isProduction)
  );
  headers.append(
    "Set-Cookie",
    buildCookie(REFRESH_TOKEN_NAME, "", 0, isProduction)
  );
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      cookies[key.trim()] = rest.join("=").trim();
    }
  }
  return cookies;
}

export function getAccessToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  return cookies[ACCESS_TOKEN_NAME] ?? null;
}

export function getRefreshToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  return cookies[REFRESH_TOKEN_NAME] ?? null;
}
