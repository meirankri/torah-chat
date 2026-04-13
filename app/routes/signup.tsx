import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { AuthForm } from "~/components/auth/AuthForm";
import { GoogleSignInButton } from "~/components/auth/GoogleSignInButton";

const SIGNUP_FIELDS = [
  {
    name: "name",
    type: "text",
    label: "Nom",
    placeholder: "Votre nom",
    autoComplete: "name",
  },
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
    placeholder: "Min. 8 caractères, 1 majuscule, 1 chiffre",
    autoComplete: "new-password",
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: Record<string, string>) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
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
            Inscription
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Créez votre compte Torah Chat
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <GoogleSignInButton label="S'inscrire avec Google" />

          <div className="my-4 flex items-center">
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
            <span className="px-3 text-sm text-gray-500 dark:text-gray-400">
              ou
            </span>
            <div className="flex-1 border-t border-gray-300 dark:border-gray-600" />
          </div>

          <AuthForm
            fields={SIGNUP_FIELDS}
            submitLabel="S'inscrire"
            onSubmit={handleSubmit}
            error={error}
            loading={loading}
          />
        </div>

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Déjà un compte ?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
