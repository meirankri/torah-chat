import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat" },
    { name: "description", content: "Chatbot IA Torah avec sources" },
  ];
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          Torah Chat
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Chatbot IA avec sources
        </p>
      </div>
    </main>
  );
}
