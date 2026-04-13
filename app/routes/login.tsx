import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router";
import { AuthForm } from "~/components/auth/AuthForm";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";

const LOGIN_FIELDS = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "votre@email.com",
    autoComplete: "email",
  },
  {
    name: "password",
    type: "password",
    label: "Mot de passe",
    placeholder: "Votre mot de passe",
    autoComplete: "current-password",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "google_auth_failed"
      ? "La connexion Google a échoué. Veuillez réessayer."
      : searchParams.get("error") === "google_not_configured"
        ? "La connexion Google n'est pas configurée."
        : null
  );
  const [loading, setLoading] = useState(false);

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
            Connexion
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Connectez-vous pour accéder à Torah Chat
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <GoogleSignInButton />

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">
              ou
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
          </div>

          <AuthForm
            fields={LOGIN_FIELDS}
            submitLabel="Se connecter"
            onSubmit={handleSubmit}
            error={error}
            loading={loading}
          />

          <div className="mt-4 text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Pas encore de compte ?{" "}
          <Link
            to="/signup"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
