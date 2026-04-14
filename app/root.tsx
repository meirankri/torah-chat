import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useTranslation } from "react-i18next";

import type { Route } from "./+types/root";
import "./app.css";
import "~/i18n/config";
import { isRTL } from "~/i18n/config";

export function Layout({ children }: { children: React.ReactNode }) {
  // i18n may not be ready during SSR — default to "fr" / ltr
  let lang = "fr";
  let dir: "ltr" | "rtl" = "ltr";

  if (typeof window !== "undefined") {
    const storedLang =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("torah-chat-lang="))
        ?.split("=")[1] ?? navigator.language.split("-")[0];
    lang = ["fr", "en", "he"].includes(storedLang) ? storedLang : "fr";
    dir = isRTL(lang) ? "rtl" : "ltr";
  }

  return (
    <html lang={lang} dir={dir}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useTranslation();

  let message = t("errors.oops");
  let details = t("errors.unexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("common.error");
    details =
      error.status === 404
        ? t("errors.notFound")
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
