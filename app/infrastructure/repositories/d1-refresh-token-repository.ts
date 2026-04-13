import type { RefreshToken } from "~/domain/entities/auth";
import type { RefreshTokenRepository } from "~/domain/repositories/refresh-token-repository";

interface D1RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

function rowToRefreshToken(row: D1RefreshTokenRow): RefreshToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class D1RefreshTokenRepository implements RefreshTokenRepository {
  constructor(private db: D1Database) {}

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<RefreshToken> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, input.userId, input.tokenHash, input.expiresAt, now)
      .run();

    return {
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: now,
    };
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    const row = await this.db
      .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?")
      .bind(tokenHash)
      .first<D1RefreshTokenRow>();
    return row ? rowToRefreshToken(row) : null;
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
      .bind(userId)
      .run();
  }

  async deleteExpired(): Promise<void> {
    await this.db
      .prepare("DELETE FROM refresh_tokens WHERE expires_at < ?")
      .bind(new Date().toISOString())
      .run();
  }
}
