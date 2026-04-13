import type { Route } from "./+types/api.profile";
import { requireAuth } from "~/lib/auth/middleware";
import { D1UserRepository } from "~/infrastructure/repositories/d1-user-repository";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;
  if (!jwtSecret) {
    return Response.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }

  const auth = await requireAuth(request, jwtSecret);
  const userRepo = new D1UserRepository(env.DB);
  const user = await userRepo.findById(auth.userId);

  if (!user) {
    return Response.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  return Response.json({
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
    },
  });
}
