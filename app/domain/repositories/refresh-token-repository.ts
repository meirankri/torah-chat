import type { RefreshToken } from "../entities/auth";

export interface RefreshTokenRepository {
  create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  deleteByUserId(userId: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
