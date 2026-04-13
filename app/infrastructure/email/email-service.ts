export interface EmailService {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

export class StubEmailService implements EmailService {
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    console.log(
      `[STUB EMAIL] Verification email to ${email} with token: ${token}`
    );
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    console.log(
      `[STUB EMAIL] Password reset email to ${email} with token: ${token}`
    );
  }
}
