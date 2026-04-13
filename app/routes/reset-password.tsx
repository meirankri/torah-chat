import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AuthForm } from "~/components/auth/AuthForm";

const RESET_PASSWORD_FIELDS = [
  {
    name: "newPassword",
    type: "password",
    label: "Nouveau mot de passe",
    placeholder: "Min. 8 caractères, 1 majuscule, 1 chiffre",
    autoComplete: "new-password",
  },
];

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [error, setError] = useState<string | null>(
    !token || !email ? "Lien de réinitialisation invalide" : null
  );
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Réinitialiser le mot de passe
          </h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {success ? (
            <div className="text-center">
              <p className="text-sm text-green-700 dark:text-green-400">
                Mot de passe réinitialisé avec succès.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Se connecter
              </Link>
            </div>
          ) : (
            <AuthForm
              fields={RESET_PASSWORD_FIELDS}
              submitLabel="Réinitialiser"
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
