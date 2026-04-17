import type { AuthProvider, CreateUserInput, User } from "../entities/user";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByProvider(provider: AuthProvider, providerId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
  incrementQuestions(id: string): Promise<void>;
  resetMonthlyQuestions(id: string): Promise<void>;
  decrementGeminiCredits(id: string): Promise<number>;
  findByStripeCustomerId(customerId: string): Promise<User | null>;
  findUsersWithTrialEndingOn(dateStr: string): Promise<User[]>;
}
