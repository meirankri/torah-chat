import { redirect } from "react-router";
import { getAccessToken } from "./cookies";
import { verifyAccessToken } from "~/application/services/token-service";

interface AuthInfo {
  userId: string;
  email: string;
}

export async function requireAuth(
  request: Request,
  jwtSecret: string
): Promise<AuthInfo> {
  const token = getAccessToken(request);
  if (!token) {
    throw redirect("/login");
  }

  try {
    const payload = await verifyAccessToken(token, jwtSecret);
    return { userId: payload.sub, email: payload.email };
  } catch {
    throw redirect("/login");
  }
}

export async function optionalAuth(
  request: Request,
  jwtSecret: string
): Promise<AuthInfo | null> {
  const token = getAccessToken(request);
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token, jwtSecret);
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
