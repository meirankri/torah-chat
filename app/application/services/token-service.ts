import { SignJWT, jwtVerify } from "jose";
import type { TokenPayload } from "~/domain/entities/auth";

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(
  userId: string,
  email: string,
  secret: string
): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecretKey(secret));
}

export async function createRefreshToken(
  userId: string,
  secret: string
): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getSecretKey(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string
): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  return {
    sub: payload.sub as string,
    email: payload.email as string,
    iat: payload.iat as number,
    exp: payload.exp as number,
  };
}

export async function verifyRefreshToken(
  token: string,
  secret: string
): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  return { sub: payload.sub as string };
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
