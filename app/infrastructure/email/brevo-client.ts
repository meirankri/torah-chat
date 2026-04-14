export interface EmailContact {
  email: string;
  name?: string;
}

export interface SendEmailParams {
  to: EmailContact;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface BrevoConfig {
  apiKey: string;
  senderEmail: string;
  senderName: string;
}

export class BrevoClient {
  private readonly apiUrl = "https://api.brevo.com/v3/smtp/email";

  constructor(private readonly config: BrevoConfig) {}

  async sendEmail(params: SendEmailParams): Promise<void> {
    const body = {
      sender: {
        email: this.config.senderEmail,
        name: this.config.senderName,
      },
      to: [{ email: params.to.email, name: params.to.name ?? params.to.email }],
      subject: params.subject,
      htmlContent: params.htmlContent,
      ...(params.textContent ? { textContent: params.textContent } : {}),
    };

    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(`Brevo API error ${response.status}: ${errorText}`);
    }
  }
}

export function createBrevoClient(env: Record<string, string>): BrevoClient | null {
  const apiKey = env.BREVO_API_KEY;
  const senderEmail = env.BREVO_SENDER_EMAIL ?? "noreply@torahchat.app";
  const senderName = env.BREVO_SENDER_NAME ?? "Torah Chat";

  if (!apiKey) return null;

  return new BrevoClient({ apiKey, senderEmail, senderName });
}
