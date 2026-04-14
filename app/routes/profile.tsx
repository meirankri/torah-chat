import type { Route } from "./+types/profile";
import { useLoaderData, Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { useState, useRef } from "react";
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
  stripeCustomerId: string | null;
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
      stripeCustomerId: user.stripeCustomerId,
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

  // Name editing state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user.name);
  const [displayName, setDisplayName] = useState(user.name);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleEditName = () => {
    setNameValue(displayName);
    setEditingName(true);
    setNameError(null);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleCancelEditName = () => {
    setEditingName(false);
    setNameValue(displayName);
    setNameError(null);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setNameSaving(true);
    setNameError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setNameError(err.error ?? t("errors.unexpected"));
        return;
      }
      setDisplayName(trimmed);
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 2500);
    } catch {
      setNameError(t("errors.serverConnection"));
    } finally {
      setNameSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setDeleteError(err.error ?? t("errors.unexpected"));
        setDeleting(false);
        return;
      }
      navigate("/login");
    } catch {
      setDeleteError(t("errors.serverConnection"));
      setDeleting(false);
    }
  };

  const planLabel = t(`profile.plans.${user.plan}`, { defaultValue: user.plan });
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

            {/* Name — editable */}
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t("profile.fields.name")}
              </dt>
              <dd className="mt-1">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") handleCancelEditName();
                      }}
                      maxLength={100}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={nameSaving}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {nameSaving ? "..." : t("profile.saveName")}
                    </button>
                    <button
                      onClick={handleCancelEditName}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {t("profile.cancelEdit")}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 dark:text-white">{displayName}</span>
                    <button
                      onClick={handleEditName}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {t("profile.editName")}
                    </button>
                    {nameSuccess && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        ✓ {t("profile.nameUpdated")}
                      </span>
                    )}
                  </div>
                )}
                {nameError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</p>
                )}
              </dd>
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

            {/* Delete account */}
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20"
              >
                {t("profile.deleteAccount")}
              </button>
            ) : (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
                <p className="mb-3 text-sm text-red-800 dark:text-red-300">
                  {t("profile.deleteAccountConfirm")}
                </p>
                {deleteError && (
                  <p className="mb-2 text-xs text-red-600 dark:text-red-400">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? t("profile.deleting") : t("profile.deleteAccountConfirmButton")}
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                    disabled={deleting}
                    className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {t("profile.deleteAccountCancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
