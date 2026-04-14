import { describe, it, expect, vi, beforeEach } from "vitest";
import { signup, login, refreshTokens, forgotPassword, resetPasswordWithEmail, logout } from "../auth-service";
import type { AuthDeps } from "../auth-service";
import type { User } from "~/domain/entities/user";
import type { RefreshToken } from "~/domain/entities/auth";
import type { UserRepository } from "~/domain/repositories/user-repository";
import type { RefreshTokenRepository } from "~/domain/repositories/refresh-token-repository";

const TEST_SECRET = "test-secret-key-at-least-32-chars-long";

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    passwordHash: null,
    provider: "email",
    providerId: null,
    language: "fr",
    plan: "free_trial",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    questionsThisMonth: 0,
    questionsResetAt: null,
    trialEndsAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    emailVerified: true,
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockDeps(): AuthDeps {
  const userRepo: UserRepository = {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByProvider: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    incrementQuestions: vi.fn(),
    resetMonthlyQuestions: vi.fn(),
  };

  const refreshTokenRepo: RefreshTokenRepository = {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    deleteByUserId: vi.fn(),
    deleteExpired: vi.fn(),
  };

  return { userRepo, refreshTokenRepo, jwtSecret: TEST_SECRET };
}

describe("auth-service", () => {
  let deps: AuthDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  describe("signup", () => {
    it("crée un utilisateur et retourne tokens", async () => {
      const mockUser = createMockUser();
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(deps.userRepo.create).mockResolvedValue(mockUser);
      vi.mocked(deps.userRepo.update).mockResolvedValue(mockUser);
      vi.mocked(deps.refreshTokenRepo.create).mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        tokenHash: "hash",
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      const result = await signup(
        { name: "Test", email: "test@example.com", password: "Password1" },
        deps
      );

      expect(result.user).toBeDefined();
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken).toBeTruthy();
      expect(deps.userRepo.create).toHaveBeenCalled();
    });

    it("rejette si email déjà utilisé", async () => {
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(createMockUser());

      await expect(
        signup(
          { name: "Test", email: "test@example.com", password: "Password1" },
          deps
        )
      ).rejects.toThrow("Un compte existe déjà");
    });

    it("rejette si input invalide", async () => {
      await expect(
        signup({ name: "", email: "test@example.com", password: "Password1" }, deps)
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    it("connecte avec les bons identifiants", async () => {
      // Hash for "Password1"
      const { hashPassword: hashPw } = await import("../password-service");
      const hash = await hashPw("Password1");

      const mockUser = createMockUser({ passwordHash: hash });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(deps.refreshTokenRepo.create).mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        tokenHash: "hash",
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });

      const result = await login(
        { email: "test@example.com", password: "Password1" },
        deps
      );

      expect(result.user.id).toBe("user-1");
      expect(result.tokens.accessToken).toBeTruthy();
    });

    it("rejette si email inconnu", async () => {
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(null);

      await expect(
        login({ email: "unknown@example.com", password: "Password1" }, deps)
      ).rejects.toThrow("Email ou mot de passe incorrect");
    });

    it("rejette si mauvais mot de passe et incrémente tentatives", async () => {
      const { hashPassword: hashPw } = await import("../password-service");
      const hash = await hashPw("Password1");
      const mockUser = createMockUser({ passwordHash: hash });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(deps.userRepo.update).mockResolvedValue(mockUser);

      await expect(
        login({ email: "test@example.com", password: "Wrong1Password" }, deps)
      ).rejects.toThrow("Email ou mot de passe incorrect");

      expect(deps.userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({
        failedLoginAttempts: 1,
      }));
    });

    it("verrouille le compte après 5 tentatives", async () => {
      const { hashPassword: hashPw } = await import("../password-service");
      const hash = await hashPw("Password1");
      const mockUser = createMockUser({
        passwordHash: hash,
        failedLoginAttempts: 4,
      });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(deps.userRepo.update).mockResolvedValue(mockUser);

      await expect(
        login({ email: "test@example.com", password: "Wrong1Password" }, deps)
      ).rejects.toThrow("Email ou mot de passe incorrect");

      expect(deps.userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
      }));
    });

    it("rejette si compte verrouillé", async () => {
      const mockUser = createMockUser({
        passwordHash: "hash",
        lockedUntil: new Date(Date.now() + 60000).toISOString(),
      });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);

      await expect(
        login({ email: "test@example.com", password: "Password1" }, deps)
      ).rejects.toThrow("Compte temporairement verrouillé");
    });
  });

  describe("forgotPassword", () => {
    it("génère un reset token pour un email existant", async () => {
      const mockUser = createMockUser();
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(deps.userRepo.update).mockResolvedValue(mockUser);

      await forgotPassword("test@example.com", deps);

      expect(deps.userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({
        passwordResetToken: expect.stringMatching(/^[a-f0-9-]+$/),
        passwordResetExpiresAt: expect.stringMatching(/\d{4}/),
      }));
    });

    it("ne lance pas d'erreur pour un email inconnu", async () => {
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(null);

      await expect(forgotPassword("unknown@example.com", deps)).resolves.toBeUndefined();
    });
  });

  describe("resetPasswordWithEmail", () => {
    it("réinitialise le mot de passe avec un token valide", async () => {
      const mockUser = createMockUser({
        passwordResetToken: "valid-token",
        passwordResetExpiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);
      vi.mocked(deps.userRepo.update).mockResolvedValue(mockUser);

      await resetPasswordWithEmail("test@example.com", "valid-token", "NewPassword1", deps);

      expect(deps.userRepo.update).toHaveBeenCalledWith("user-1", expect.objectContaining({
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      }));
    });

    it("rejette si token invalide", async () => {
      const mockUser = createMockUser({
        passwordResetToken: "real-token",
        passwordResetExpiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);

      await expect(
        resetPasswordWithEmail("test@example.com", "wrong-token", "NewPassword1", deps)
      ).rejects.toThrow("Token de réinitialisation invalide");
    });

    it("rejette si token expiré", async () => {
      const mockUser = createMockUser({
        passwordResetToken: "valid-token",
        passwordResetExpiresAt: new Date(Date.now() - 60000).toISOString(),
      });
      vi.mocked(deps.userRepo.findByEmail).mockResolvedValue(mockUser);

      await expect(
        resetPasswordWithEmail("test@example.com", "valid-token", "NewPassword1", deps)
      ).rejects.toThrow("Token de réinitialisation expiré");
    });
  });

  describe("logout", () => {
    it("supprime les refresh tokens de l'utilisateur", async () => {
      await logout("user-1", deps);
      expect(deps.refreshTokenRepo.deleteByUserId).toHaveBeenCalledWith("user-1");
    });
  });
});
