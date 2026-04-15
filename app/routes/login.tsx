import type { Route } from "./+types/login";
import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthForm } from "~/components/auth/AuthForm";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";
import { AppleSignInButton } from "~/components/auth/AppleSignInButton";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat — Connexion" },
    { name: "description", content: "Connectez-vous à Torah Chat pour poser vos questions sur la Torah, le Talmud et la Halakha." },
  ];
}

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "google_auth_failed"
      ? t("auth.login.googleFailed")
      : searchParams.get("error") === "google_not_configured"
        ? t("auth.login.googleNotConfigured")
        : null
  );
  const [loading, setLoading] = useState(false);

  const loginFields = [
    {
      name: "email",
      type: "email",
      label: t("auth.fields.email"),
      placeholder: t("auth.fields.emailPlaceholder"),
      autoComplete: "email",
    },
    {
      name: "password",
      type: "password",
      label: t("auth.fields.password"),
      placeholder: t("auth.fields.passwordPlaceholder"),
      autoComplete: "current-password",
    },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError((result as { error: string }).error);
        return;
      }

      navigate("/chat");
    } catch {
      setError(t("errors.serverConnection"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("auth.login.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("auth.login.subtitle")}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="space-y-2">
            <GoogleSignInButton />
            <AppleSignInButton />
          </div>

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">
              {t("common.or")}
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
          </div>

          <AuthForm
            fields={loginFields}
            submitLabel={t("auth.login.submit")}
            onSubmit={handleSubmit}
            error={error}
            loading={loading}
          />

          <div className="mt-4 text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("auth.login.forgotPassword")}
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {t("auth.login.noAccount")}{" "}
          <Link
            to="/signup"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {t("auth.login.signupLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
