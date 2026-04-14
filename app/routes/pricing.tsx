import type { Route } from "./+types/pricing";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Torah Chat — Plans & Tarifs" },
    { name: "description", content: "Choisissez votre plan Torah Chat" },
  ];
}

interface PlanCardProps {
  name: string;
  price: string;
  description: string;
  features: string[];
  priceId: string | null;
  isCurrentPlan?: boolean;
  highlighted?: boolean;
  onSelect: (priceId: string) => void;
  loading: boolean;
}

function PlanCard({
  name,
  price,
  description,
  features,
  priceId,
  isCurrentPlan,
  highlighted,
  onSelect,
  loading,
}: PlanCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex flex-col rounded-2xl border p-6 ${
        highlighted
          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      }`}
    >
      {highlighted && (
        <div className="mb-4 inline-flex self-start rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
          {t("pricing.recommended")}
        </div>
      )}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
      <div className="mt-2">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{price}</span>
        {price !== t("pricing.free") && (
          <span className="ml-1 text-sm text-gray-500 dark:text-gray-400">
            {t("pricing.perMonth")}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>

      <ul className="mt-4 flex-1 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrentPlan ? (
          <div className="rounded-lg bg-gray-100 px-4 py-2 text-center text-sm font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {t("pricing.currentPlan")}
          </div>
        ) : priceId ? (
          <button
            onClick={() => onSelect(priceId)}
            disabled={loading}
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
              highlighted
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            }`}
          >
            {loading ? t("common.loading") : t("pricing.subscribe")}
          </button>
        ) : (
          <Link
            to="/signup"
            className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            {t("pricing.startTrial")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("payment") === "cancelled" ? t("pricing.paymentCancelled") : null
  );

  const handleSelectPlan = async (priceId: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json() as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (response.status === 401) {
          navigate("/login?redirect=/pricing");
          return;
        }
        setError(data.error ?? t("errors.serverConnection"));
        return;
      }

      window.location.href = data.url;
    } catch {
      setError(t("errors.serverConnection"));
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: t("pricing.plans.trial.name"),
      price: t("pricing.free"),
      description: t("pricing.plans.trial.description"),
      features: t("pricing.plans.trial.features", { returnObjects: true }) as string[],
      priceId: null,
      highlighted: false,
    },
    {
      name: t("pricing.plans.standard.name"),
      price: "9,99€",
      description: t("pricing.plans.standard.description"),
      features: t("pricing.plans.standard.features", { returnObjects: true }) as string[],
      priceId: "__STRIPE_PRICE_STANDARD__",
      highlighted: true,
    },
    {
      name: t("pricing.plans.premium.name"),
      price: "19,99€",
      description: t("pricing.plans.premium.description"),
      features: t("pricing.plans.premium.features", { returnObjects: true }) as string[],
      priceId: "__STRIPE_PRICE_PREMIUM__",
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {t("pricing.title")}
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
            {t("pricing.subtitle")}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {searchParams.get("payment") === "success" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            {t("pricing.paymentSuccess")}
          </div>
        )}

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.name}
              {...plan}
              onSelect={handleSelectPlan}
              loading={loading}
            />
          ))}
        </div>

        {/* Back to chat */}
        <div className="mt-10 text-center">
          <Link
            to="/chat"
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← {t("nav.chat")}
          </Link>
        </div>
      </div>
    </div>
  );
}
