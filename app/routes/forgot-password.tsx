import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthForm } from "~/components/auth/AuthForm";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const forgotPasswordFields = [
    {
      name: "email",
      type: "email",
      label: t("auth.fields.email"),
      placeholder: t("auth.fields.emailPlaceholder"),
      autoComplete: "email",
    },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const result = await response.json();
        setError((result as { error: string }).error);
        return;
      }

      setSuccess(true);
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
            {t("auth.forgotPassword.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t("auth.forgotPassword.subtitle")}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {success ? (
            <div className="text-center">
              <p className="text-sm text-green-700 dark:text-green-400">
                {t("auth.forgotPassword.successMessage")}
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("auth.forgotPassword.backToLogin")}
              </Link>
            </div>
          ) : (
            <AuthForm
              fields={forgotPasswordFields}
              submitLabel={t("auth.forgotPassword.submit")}
              onSubmit={handleSubmit}
              error={error}
              loading={loading}
            />
          )}
        </div>

        {!success && (
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
