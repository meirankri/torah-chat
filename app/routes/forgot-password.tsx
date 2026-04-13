import { useState } from "react";
import { Link } from "react-router";
import { AuthForm } from "~/components/auth/AuthForm";

const FORGOT_PASSWORD_FIELDS = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "votre@email.com",
    autoComplete: "email",
  },
];

export default function ForgotPassword() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
            Mot de passe oublié
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Entrez votre email pour recevoir un lien de réinitialisation
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          {success ? (
            <div className="text-center">
              <p className="text-sm text-green-700 dark:text-green-400">
                Si un compte existe avec cet email, vous recevrez un lien de
                réinitialisation.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <AuthForm
              fields={FORGOT_PASSWORD_FIELDS}
              submitLabel="Envoyer le lien"
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
              Retour à la connexion
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
