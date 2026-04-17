import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

interface ModelSelectorProps {
  selectedModel: "standard" | "premium";
  onModelChange: (model: "standard" | "premium") => void;
  geminiCredits: number;
}

export function ModelSelector({ selectedModel, onModelChange, geminiCredits }: ModelSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const premiumExhausted = geminiCredits <= 0;
  const label = selectedModel === "premium" ? t("chat.modelPremium") : t("chat.modelStandard");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {selectedModel === "premium" && <span className="text-amber-500">⭐</span>}
        {label}
        <svg className="h-3.5 w-3.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {/* Standard */}
          <button
            type="button"
            onClick={() => { onModelChange("standard"); setOpen(false); }}
            className={`flex w-full flex-col px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
              selectedModel === "standard" ? "bg-blue-50 dark:bg-blue-900/20" : ""
            } rounded-t-lg`}
          >
            <div className="flex items-center gap-2">
              {selectedModel === "standard" && <span className="text-blue-600 dark:text-blue-400">●</span>}
              <span className="font-medium text-gray-900 dark:text-white">{t("chat.modelStandard")}</span>
            </div>
            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("chat.modelStandardDesc")}
            </span>
          </button>

          {/* Premium */}
          <button
            type="button"
            onClick={() => {
              if (!premiumExhausted) {
                onModelChange("premium");
                setOpen(false);
              }
            }}
            disabled={premiumExhausted}
            className={`flex w-full flex-col px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
              selectedModel === "premium" ? "bg-blue-50 dark:bg-blue-900/20" : ""
            } ${premiumExhausted ? "opacity-60" : ""} rounded-b-lg border-t border-gray-100 dark:border-gray-700`}
          >
            <div className="flex items-center gap-2">
              {selectedModel === "premium" && <span className="text-blue-600 dark:text-blue-400">●</span>}
              <span className="text-amber-500">⭐</span>
              <span className="font-medium text-gray-900 dark:text-white">{t("chat.modelPremium")}</span>
            </div>
            <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {t("chat.modelPremiumDesc")}
            </span>
            <span className={`mt-1 text-xs font-medium ${
              premiumExhausted
                ? "text-red-500 dark:text-red-400"
                : "text-amber-600 dark:text-amber-400"
            }`}>
              {premiumExhausted
                ? t("chat.modelPremiumExhausted")
                : t("chat.modelPremiumCredits", { count: geminiCredits })}
            </span>
            {premiumExhausted && (
              <Link
                to="/pricing"
                onClick={(e) => e.stopPropagation()}
                className="mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {t("chat.modelPremiumUpgrade")}
              </Link>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
