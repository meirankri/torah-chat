import type { BrevoClient } from "~/infrastructure/email/brevo-client";

export interface EmailDeps {
  emailClient: BrevoClient;
  appUrl: string;
}

export async function sendWelcomeEmail(
  deps: EmailDeps,
  params: { email: string; name: string; trialDays: number }
): Promise<void> {
  const { email, name, trialDays } = params;
  const displayName = name || email.split("@")[0] || "cher utilisateur";

  await deps.emailClient.sendEmail({
    to: { email, name },
    subject: "Bienvenue sur Torah Chat !",
    htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:30px">
    <h1 style="color:#2563eb;margin:0">Torah Chat</h1>
    <p style="color:#666;margin:5px 0">Explorez la sagesse juive</p>
  </div>
  <h2>Bienvenue, ${displayName} !</h2>
  <p>Votre compte Torah Chat a été créé avec succès. Vous bénéficiez d'un essai gratuit de <strong>${trialDays} jours</strong> incluant 50 questions.</p>
  <p>Posez vos questions sur la Torah, le Talmud, la Halakha, la Hassidout et bien plus encore — avec des sources vérifiées sur Sefaria.</p>
  <div style="text-align:center;margin:30px 0">
    <a href="${deps.appUrl}/chat" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Commencer à explorer
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#999;font-size:12px;text-align:center">
    Torah Chat — Ne pas répondre à cet email.
  </p>
</body>
</html>`,
    textContent: `Bienvenue sur Torah Chat, ${displayName} !\n\nVotre essai gratuit de ${trialDays} jours commence maintenant.\nAccédez au chat : ${deps.appUrl}/chat\n\nTorah Chat`,
  });
}

export async function sendPasswordResetEmail(
  deps: EmailDeps,
  params: { email: string; name: string; resetToken: string }
): Promise<void> {
  const { email, name, resetToken } = params;
  const resetUrl = `${deps.appUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
  const displayName = name || email.split("@")[0] || "cher utilisateur";

  await deps.emailClient.sendEmail({
    to: { email, name },
    subject: "Réinitialisation de votre mot de passe — Torah Chat",
    htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:30px">
    <h1 style="color:#2563eb;margin:0">Torah Chat</h1>
  </div>
  <h2>Réinitialisation de mot de passe</h2>
  <p>Bonjour ${displayName},</p>
  <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en définir un nouveau :</p>
  <div style="text-align:center;margin:30px 0">
    <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Réinitialiser mon mot de passe
    </a>
  </div>
  <p style="color:#666;font-size:14px">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  <p style="color:#666;font-size:12px">Lien direct : <a href="${resetUrl}">${resetUrl}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#999;font-size:12px;text-align:center">
    Torah Chat — Ne pas répondre à cet email.
  </p>
</body>
</html>`,
    textContent: `Réinitialisation de mot de passe — Torah Chat\n\nBonjour ${displayName},\n\nCliquez sur ce lien pour réinitialiser votre mot de passe (valide 1h) :\n${resetUrl}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nTorah Chat`,
  });
}

export async function sendTrialReminderEmail(
  deps: EmailDeps,
  params: { email: string; name: string; daysLeft: number }
): Promise<void> {
  const { email, name, daysLeft } = params;
  const displayName = name || email.split("@")[0] || "cher utilisateur";
  const dayText = daysLeft === 1 ? "1 jour" : `${daysLeft} jours`;

  await deps.emailClient.sendEmail({
    to: { email, name },
    subject: `Votre essai Torah Chat se termine dans ${dayText}`,
    htmlContent: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333">
  <div style="text-align:center;margin-bottom:30px">
    <h1 style="color:#2563eb;margin:0">Torah Chat</h1>
  </div>
  <h2>Votre essai se termine bientôt</h2>
  <p>Bonjour ${displayName},</p>
  <p>Il ne vous reste plus que <strong>${dayText}</strong> sur votre essai gratuit Torah Chat.</p>
  <p>Pour continuer à explorer la sagesse juive sans interruption, abonnez-vous dès maintenant :</p>
  <div style="text-align:center;margin:30px 0">
    <a href="${deps.appUrl}/pricing" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">
      Voir les plans
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:30px 0">
  <p style="color:#999;font-size:12px;text-align:center">
    Torah Chat — Ne pas répondre à cet email.
  </p>
</body>
</html>`,
    textContent: `Torah Chat — Il ne vous reste plus que ${dayText} d'essai.\n\nAbonnez-vous pour continuer : ${deps.appUrl}/pricing\n\nTorah Chat`,
  });
}
