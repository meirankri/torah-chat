import type {
  AuthTokens,
  LoginCredentials,
  SignupInput,
  ResetPasswordInput,
} from "~/domain/entities/auth";
import type { User } from "~/domain/entities/user";
import type { UserRepository } from "~/domain/repositories/user-repository";
import type { RefreshTokenRepository } from "~/domain/repositories/refresh-token-repository";
import { hashPassword, verifyPassword } from "./password-service";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "./token-service";
import { validateSignupInput, validateEmail } from "~/lib/auth/validation";
import type { GoogleOAuthClient } from "~/infrastructure/oauth/google-oauth-client";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const FREE_TRIAL_DAYS = 7;
const REFRESH_TOKEN_DAYS = 7;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export interface AuthDeps {
  userRepo: UserRepository;
  refreshTokenRepo: RefreshTokenRepository;
  jwtSecret: string;
}

export interface GoogleAuthDeps extends AuthDeps {
  googleClient: GoogleOAuthClient;
  googleClientId: string;
  googleClientSecret: string;
}

function createTokenExpiresAt(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function generateTokens(
  userId: string,
  email: string,
  deps: AuthDeps
): Promise<AuthTokens> {
  const accessToken = await createAccessToken(userId, email, deps.jwtSecret);
  const refreshTokenJwt = await createRefreshToken(userId, deps.jwtSecret);

  const tokenHash = await hashToken(refreshTokenJwt);
  await deps.refreshTokenRepo.create({
    userId,
    tokenHash,
    expiresAt: createTokenExpiresAt(REFRESH_TOKEN_DAYS),
  });

  return { accessToken, refreshToken: refreshTokenJwt };
}

export async function signup(
  input: SignupInput,
  deps: AuthDeps
): Promise<{ user: User; tokens: AuthTokens }> {
  const validationError = validateSignupInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const existing = await deps.userRepo.findByEmail(input.email.toLowerCase());
  if (existing) {
    throw new Error("Un compte existe déjà avec cet email");
  }

  const passwordHash = await hashPassword(input.password);
  const trialEndsAt = createTokenExpiresAt(FREE_TRIAL_DAYS);

  const user = await deps.userRepo.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
    provider: "email",
    language: "fr",
  });

  // Set trial end date and mark email as verified (MVP stub)
  const updatedUser = await deps.userRepo.update(user.id, {
    trialEndsAt,
    emailVerified: true,
  });

  const tokens = await generateTokens(updatedUser.id, updatedUser.email, deps);
  return { user: updatedUser, tokens };
}

export async function login(
  credentials: LoginCredentials,
  deps: AuthDeps
): Promise<{ user: User; tokens: AuthTokens }> {
  const user = await deps.userRepo.findByEmail(credentials.email.toLowerCase());
  if (!user) {
    throw new Error("Email ou mot de passe incorrect");
  }

  // Check if account is locked
  if (user.lockedUntil) {
    const lockExpiry = new Date(user.lockedUntil).getTime();
    if (lockExpiry > Date.now()) {
      throw new Error("Compte temporairement verrouillé. Réessayez plus tard.");
    }
    // Lock expired, reset
    await deps.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  if (!user.passwordHash) {
    throw new Error(
      "Ce compte utilise la connexion Google. Utilisez le bouton Google pour vous connecter."
    );
  }

  const valid = await verifyPassword(credentials.password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const update: Partial<User> = { failedLoginAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MS
      ).toISOString();
    }

    await deps.userRepo.update(user.id, update);
    throw new Error("Email ou mot de passe incorrect");
  }

  // Reset failed attempts on successful login
  if (user.failedLoginAttempts > 0) {
    await deps.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  const tokens = await generateTokens(user.id, user.email, deps);
  return { user, tokens };
}

export async function refreshTokens(
  refreshTokenJwt: string,
  deps: AuthDeps
): Promise<AuthTokens> {
  const payload = await verifyRefreshToken(refreshTokenJwt, deps.jwtSecret);
  const tokenHash = await hashToken(refreshTokenJwt);

  const storedToken = await deps.refreshTokenRepo.findByTokenHash(tokenHash);
  if (!storedToken) {
    throw new Error("Refresh token invalide");
  }

  if (new Date(storedToken.expiresAt).getTime() < Date.now()) {
    throw new Error("Refresh token expiré");
  }

  const user = await deps.userRepo.findById(payload.sub);
  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  // Delete old refresh tokens for this user and create new ones
  await deps.refreshTokenRepo.deleteByUserId(user.id);
  return generateTokens(user.id, user.email, deps);
}

export async function forgotPassword(
  email: string,
  deps: AuthDeps
): Promise<{ resetToken: string; userName: string } | null> {
  const emailError = validateEmail(email);
  if (emailError) {
    // Silently return to not reveal if email exists
    return null;
  }

  const user = await deps.userRepo.findByEmail(email.toLowerCase());
  if (!user) {
    // Silently return to not reveal if email exists
    return null;
  }

  const resetToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString();

  await deps.userRepo.update(user.id, {
    passwordResetToken: resetToken,
    passwordResetExpiresAt: expiresAt,
  });

  return { resetToken, userName: user.name ?? "" };
}

export async function resetPassword(
  input: ResetPasswordInput,
  deps: AuthDeps
): Promise<void> {
  // We need to find the user by reset token - search by iterating is not ideal,
  // but for MVP with small user base it's acceptable.
  // A production solution would use a dedicated lookup table.
  // For now, we'll pass the email alongside the token from the frontend.
  throw new Error("Not implemented - requires email in request");
}

export async function resetPasswordWithEmail(
  email: string,
  token: string,
  newPassword: string,
  deps: AuthDeps
): Promise<void> {
  const user = await deps.userRepo.findByEmail(email.toLowerCase());
  if (!user) {
    throw new Error("Token de réinitialisation invalide");
  }

  if (
    !user.passwordResetToken ||
    user.passwordResetToken !== token
  ) {
    throw new Error("Token de réinitialisation invalide");
  }

  if (
    !user.passwordResetExpiresAt ||
    new Date(user.passwordResetExpiresAt).getTime() < Date.now()
  ) {
    throw new Error("Token de réinitialisation expiré");
  }

  const passwordHash = await hashPassword(newPassword);
  await deps.userRepo.update(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
}

export async function googleOAuth(
  code: string,
  redirectUri: string,
  deps: GoogleAuthDeps
): Promise<{ user: User; tokens: AuthTokens }> {
  const googleTokens = await deps.googleClient.exchangeCodeForToken(
    code,
    redirectUri,
    deps.googleClientId,
    deps.googleClientSecret
  );

  const googleUser = await deps.googleClient.getUserInfo(
    googleTokens.access_token
  );

  // Try to find existing user by Google provider
  let user = await deps.userRepo.findByProvider("google", googleUser.id);

  if (!user) {
    // Try to find by email (maybe signed up with email before)
    user = await deps.userRepo.findByEmail(googleUser.email.toLowerCase());

    if (user) {
      // Link Google to existing account
      user = await deps.userRepo.update(user.id, {
        provider: "google",
        providerId: googleUser.id,
        emailVerified: true,
      });
    } else {
      // Create new user
      user = await deps.userRepo.create({
        email: googleUser.email.toLowerCase(),
        name: googleUser.name || googleUser.email.split("@")[0] || "User",
        provider: "google",
        providerId: googleUser.id,
        language: "fr",
      });

      user = await deps.userRepo.update(user.id, {
        trialEndsAt: createTokenExpiresAt(FREE_TRIAL_DAYS),
        emailVerified: true,
      });
    }
  }

  const tokens = await generateTokens(user.id, user.email, deps);
  return { user, tokens };
}

export async function logout(
  userId: string,
  deps: AuthDeps
): Promise<void> {
  await deps.refreshTokenRepo.deleteByUserId(userId);
}
