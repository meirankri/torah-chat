import type { Route } from "./+types/home";
import { redirect } from "react-router";
import { optionalAuth } from "~/lib/auth/middleware";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  const jwtSecret = (env as Record<string, string>).JWT_SECRET;

  if (jwtSecret) {
    const auth = await optionalAuth(request, jwtSecret);
    if (auth) {
      return redirect("/chat");
    }
    return redirect("/login");
  }

  // Auth not configured — redirect to chat (dev mode)
  return redirect("/chat");
}

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat" },
    { name: "description", content: "Chatbot IA Torah avec sources" },
  ];
}

export default function Home() {
  return null;
}
