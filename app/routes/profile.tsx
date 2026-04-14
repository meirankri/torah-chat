import type { Route } from "./+types/profile";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { useState } from "react";
import { useSearchParams } from "react-router";

interface ProfileData {
  id: string;
  email: string;
  name: string;
  plan: string;
  provider: string;
  questionsThisMonth: number;
  trialEndsAt: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    throw new Response("Auth not configured", { status: 503 });
  }

  const auth = await requireAuth(request, jwtSecret);
  const userRepo = new D1UserRepository(env.DB);
  const user = await userRepo.findById(auth.userId);

  if (!user) {
    throw new Response("User not found", { status: 404 });
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      provider: user.provider,
      questionsThisMonth: user.questionsThisMonth,
      trialEndsAt: user.trialEndsAt,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    } satisfies ProfileData,
  };
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loggingOut, setLoggingOut] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const paymentStatus = searchParams.get("payment");

  const handleManageSubscription = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setPortalError(data.error ?? t("errors.serverConnection"));
        return;
      }
      window.location.href = data.url;
    } catch {
      setPortalError(t("errors.serverConnection"));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  const planLabel =
    t(`profile.plans.${user.plan}`, { defaultValue: user.plan });

  const providerLabel =
    user.provider === "google"
      ? t("profile.providers.google")
      : t("profile.providers.email");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("profile.title")}
          </h1>
        </div>

        {paymentStatus === "success" && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            {t("pricing.paymentSuccess")}
          </div>
        )}

        {portalError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {portalError}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.name")}
              </dt>
              <dd className="text-gray-900 dark:text-white">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.email")}
              </dt>
              <dd className="text-gray-900 dark:text-white">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.plan")}
              </dt>
              <dd className="text-gray-900 dark:text-white">{planLabel}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.questionsThisMonth")}
              </dt>
              <dd className="text-gray-900 dark:text-white">
                {user.questionsThisMonth}
              </dd>
            </div>
            {user.trialEndsAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t("profile.fields.trialEndsAt")}
                </dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(user.trialEndsAt).toLocaleDateString(i18n.language)}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.loginVia")}
              </dt>
              <dd className="text-gray-900 dark:text-white">{providerLabel}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-3">
              <Link
                to="/chat"
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
              >
                {t("nav.chat")}
              </Link>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {loggingOut ? t("profile.loggingOut") : t("profile.logout")}
              </button>
            </div>

            {/* Stripe subscription management */}
            {user.stripeCustomerId ? (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full rounded-md border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
              >
                {portalLoading ? t("common.loading") : t("profile.manageSubscription")}
              </button>
            ) : (
              <Link
                to="/pricing"
                className="block w-full rounded-md border border-blue-300 bg-white px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
              >
                {t("profile.upgradePlan")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
