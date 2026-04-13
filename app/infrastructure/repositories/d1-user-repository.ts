import type { CreateUserInput, User, AuthProvider } from "~/domain/entities/user";
import type { UserRepository } from "~/domain/repositories/user-repository";

interface D1UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  provider: string;
  provider_id: string | null;
  language: string;
  plan: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  questions_this_month: number;
  questions_reset_at: string | null;
  trial_ends_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  email_verified: number;
  email_verification_token: string | null;
  password_reset_token: string | null;
  password_reset_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: D1UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    provider: row.provider as User["provider"],
    providerId: row.provider_id,
    language: row.language as User["language"],
    plan: row.plan as User["plan"],
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    questionsThisMonth: row.questions_this_month,
    questionsResetAt: row.questions_reset_at,
    trialEndsAt: row.trial_ends_at,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: row.locked_until,
    emailVerified: row.email_verified === 1,
    emailVerificationToken: row.email_verification_token,
    passwordResetToken: row.password_reset_token,
    passwordResetExpiresAt: row.password_reset_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1UserRepository implements UserRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first<D1UserRow>();
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<D1UserRow>();
    return row ? rowToUser(row) : null;
  }

  async findByProvider(
    provider: AuthProvider,
    providerId: string
  ): Promise<User | null> {
    const row = await this.db
      .prepare("SELECT * FROM users WHERE provider = ? AND provider_id = ?")
      .bind(provider, providerId)
      .first<D1UserRow>();
    return row ? rowToUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO users (id, email, name, password_hash, provider, provider_id, language, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.email,
        input.name,
        input.passwordHash ?? null,
        input.provider,
        input.providerId ?? null,
        input.language,
        now,
        now
      )
      .run();

    const user = await this.findById(id);
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const fieldMap: Record<string, string> = {
      email: "email",
      name: "name",
      passwordHash: "password_hash",
      provider: "provider",
      providerId: "provider_id",
      language: "language",
      plan: "plan",
      stripeCustomerId: "stripe_customer_id",
      stripeSubscriptionId: "stripe_subscription_id",
      questionsThisMonth: "questions_this_month",
      questionsResetAt: "questions_reset_at",
      trialEndsAt: "trial_ends_at",
      failedLoginAttempts: "failed_login_attempts",
      lockedUntil: "locked_until",
      emailVerified: "email_verified",
      emailVerificationToken: "email_verification_token",
      passwordResetToken: "password_reset_token",
      passwordResetExpiresAt: "password_reset_expires_at",
    };

    const sets: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(data)) {
      const column = fieldMap[key];
      if (!column) continue;

      sets.push(`${column} = ?`);
      if (key === "emailVerified") {
        values.push(value ? 1 : 0);
      } else {
        values.push(value as string | number | null);
      }
    }

    if (sets.length === 0) {
      const user = await this.findById(id);
      if (!user) throw new Error("User not found");
      return user;
    }

    sets.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    await this.db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    const user = await this.findById(id);
    if (!user) throw new Error("User not found");
    return user;
  }

  async incrementQuestions(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE users SET questions_this_month = questions_this_month + 1, updated_at = ? WHERE id = ?"
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  async resetMonthlyQuestions(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        "UPDATE users SET questions_this_month = 0, questions_reset_at = ?, updated_at = ? WHERE id = ?"
      )
      .bind(now, now, id)
      .run();
  }
}
