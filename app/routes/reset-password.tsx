import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { AuthForm } from "~/components/auth/AuthForm";

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [error, setError] = useState<string | null>(
    !token || !email ? t("auth.resetPassword.invalidLink") : null
  );
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const resetPasswordFields = [
    {
      name: "newPassword",
      type: "password",
      label: t("auth.fields.newPassword"),
      placeholder: t("auth.fields.passwordNewPlaceholder"),
      autoComplete: "new-password",
    },
  ];

  const handleSubmit = async (data: Record<string, string>) => {
    if (!token || !email) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          token,
          newPassword: data.newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
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
            {t("auth.resetPassword.title")}
          </h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {success ? (
            <div className="text-center">
              <p className="text-sm text-green-700 dark:text-green-400">
                {t("auth.resetPassword.successMessage")}
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {t("auth.resetPassword.loginLink")}
              </Link>
            </div>
          ) : (
            <AuthForm
              fields={resetPasswordFields}
              submitLabel={t("auth.resetPassword.submit")}
              onSubmit={handleSubmit}
              error={error}
              loading={loading || !token || !email}
            />
          )}
        </div>
      </div>
    </div>
  );
}
