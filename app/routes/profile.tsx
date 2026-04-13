import type { Route } from "./+types/profile";
import { useLoaderData, Link, useNavigate } from "react-router";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";
import { useState } from "react";

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

const PLAN_LABELS: Record<string, string> = {
  free_trial: "Essai gratuit",
  standard: "Standard",
  premium: "Premium",
  expired: "Expiré",
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      navigate("/login");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Mon profil
          </h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nom
              </dt>
              <dd className="text-gray-900 dark:text-white">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email
              </dt>
              <dd className="text-gray-900 dark:text-white">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Plan
              </dt>
              <dd className="text-gray-900 dark:text-white">
                {PLAN_LABELS[user.plan] ?? user.plan}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Questions ce mois
              </dt>
              <dd className="text-gray-900 dark:text-white">
                {user.questionsThisMonth}
              </dd>
            </div>
            {user.trialEndsAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Fin de l'essai
                </dt>
                <dd className="text-gray-900 dark:text-white">
                  {new Date(user.trialEndsAt).toLocaleDateString("fr-FR")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Connexion via
              </dt>
              <dd className="text-gray-900 dark:text-white">
                {user.provider === "google" ? "Google" : "Email"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex gap-3">
            <Link
              to="/chat"
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-center font-medium text-white hover:bg-blue-700"
            >
              Retour au chat
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {loggingOut ? "..." : "Déconnexion"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
