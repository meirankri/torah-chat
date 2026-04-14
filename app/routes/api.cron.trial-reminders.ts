/**
 * Internal cron endpoint for sending trial reminder emails.
 * Called by Cloudflare Workers scheduled trigger (or external cron).
 * Protected by CRON_SECRET header.
 */
import type { Route } from "./+types/api.cron.trial-reminders";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { createBrevoClient } from "~/infrastructure/email/brevo-client";
import { sendTrialReminderEmail } from "~/application/services/email-service";

const REMINDER_DAYS = [3, 1]; // Send reminders when N days left in trial

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = context.cloudflare.env;
  const cronSecret = (env as Record<string, string>).CRON_SECRET;

  // Protect the endpoint
  if (cronSecret) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!env.DB) {
    return Response.json({ error: "DB not configured" }, { status: 503 });
  }

  const emailClient = createBrevoClient(env as Record<string, string>);
  if (!emailClient) {
    return Response.json({ error: "Email not configured", sent: 0 });
  }

  const appUrl = (env as Record<string, string>).APP_URL ?? "https://torahchat.app";
  const userRepo = new D1UserRepository(env.DB);

  let sent = 0;
  const errors: string[] = [];

  // Find users whose trial ends in REMINDER_DAYS days
  for (const daysLeft of REMINDER_DAYS) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysLeft);
    const targetDateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

    try {
      const users = await userRepo.findUsersWithTrialEndingOn(targetDateStr ?? "");

      for (const user of users) {
        try {
          await sendTrialReminderEmail(
            { emailClient, appUrl },
            { email: user.email, name: user.name ?? "", daysLeft }
          );
          sent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${user.email}: ${msg}`);
          console.error(`[TrialReminder] Failed for ${user.email}:`, err);
        }
      }
    } catch (err) {
      console.error(`[TrialReminder] DB query failed for daysLeft=${daysLeft}:`, err);
    }
  }

  return Response.json({ sent, errors: errors.length > 0 ? errors : undefined });
}
