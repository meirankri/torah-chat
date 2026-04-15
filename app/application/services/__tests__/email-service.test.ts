import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWelcomeEmail, sendPasswordResetEmail, sendTrialReminderEmail, sendPaymentFailedEmail } from "../email-service";
import type { BrevoClient } from "~/infrastructure/email/brevo-client";

function makeEmailClient(): BrevoClient {
  return { sendEmail: vi.fn().mockResolvedValue(undefined) } as unknown as BrevoClient;
}

const deps = { appUrl: "https://app.example.com" };

describe("sendWelcomeEmail", () => {
  it("appelle sendEmail avec le bon sujet", async () => {
    const emailClient = makeEmailClient();
    await sendWelcomeEmail({ ...deps, emailClient }, {
      email: "user@example.com", name: "Alice", trialDays: 7,
    });
    expect(emailClient.sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(emailClient.sendEmail).mock.calls[0]![0];
    expect(call.subject).toContain("Torah Chat");
    expect(call.to.email).toBe("user@example.com");
    expect(call.htmlContent).toContain("7");
  });
});

describe("sendPasswordResetEmail", () => {
  it("inclut le lien de reset dans le contenu", async () => {
    const emailClient = makeEmailClient();
    await sendPasswordResetEmail({ ...deps, emailClient }, {
      email: "user@example.com", name: "Bob", resetToken: "abc-123",
    });
    expect(emailClient.sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(emailClient.sendEmail).mock.calls[0]![0];
    expect(call.htmlContent).toContain("abc-123");
    expect(call.htmlContent).toContain("https://app.example.com");
    expect(call.textContent).toContain("abc-123");
  });
});

describe("sendTrialReminderEmail", () => {
  it("mentionne le nombre de jours restants", async () => {
    const emailClient = makeEmailClient();
    await sendTrialReminderEmail({ ...deps, emailClient }, {
      email: "user@example.com", name: "Carol", daysLeft: 3,
    });
    expect(emailClient.sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(emailClient.sendEmail).mock.calls[0]![0];
    expect(call.htmlContent).toContain("3");
    expect(call.htmlContent).toContain("https://app.example.com/pricing");
  });
});

describe("sendPaymentFailedEmail", () => {
  it("envoie un email d'échec de paiement avec lien profil", async () => {
    const emailClient = makeEmailClient();
    await sendPaymentFailedEmail({ ...deps, emailClient }, {
      email: "user@example.com", name: "Dan",
    });
    expect(emailClient.sendEmail).toHaveBeenCalledOnce();
    const call = vi.mocked(emailClient.sendEmail).mock.calls[0]![0];
    expect(call.subject).toContain("paiement");
    expect(call.to.email).toBe("user@example.com");
    expect(call.htmlContent).toContain("https://app.example.com/profile");
  });

  it("utilise le nom de l'email si le nom est vide", async () => {
    const emailClient = makeEmailClient();
    await sendPaymentFailedEmail({ ...deps, emailClient }, {
      email: "dan@example.com", name: "",
    });
    const call = vi.mocked(emailClient.sendEmail).mock.calls[0]![0];
    expect(call.htmlContent).toContain("dan");
  });
});
