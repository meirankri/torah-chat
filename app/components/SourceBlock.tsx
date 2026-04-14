import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageSource } from "~/domain/entities/source";

interface SourceBlockProps {
  source: MessageSource;
}

const CATEGORY_COLORS: Record<string, string> = {
  Talmud: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  Torah: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Halakhah: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  Midrash: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  Tanakh: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  Kabbalah: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  Chasidut: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  Mussar: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const DEFAULT_CATEGORY_COLOR =
  "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";

function getCategoryColor(category: string | null): string {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}

const COLLAPSED_MAX_LENGTH = 150;

export function SourceBlock({ source }: SourceBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const hebrewText = source.textHebrew ?? "";
  const translationText = source.textTranslation ?? "";
  const isLongContent =
    hebrewText.length > COLLAPSED_MAX_LENGTH ||
    translationText.length > COLLAPSED_MAX_LENGTH;

  const displayedHebrew =
    !expanded && hebrewText.length > COLLAPSED_MAX_LENGTH
      ? hebrewText.slice(0, COLLAPSED_MAX_LENGTH) + "..."
      : hebrewText;

  const displayedTranslation =
    !expanded && translationText.length > COLLAPSED_MAX_LENGTH
      ? translationText.slice(0, COLLAPSED_MAX_LENGTH) + "..."
      : translationText;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left dark:bg-gray-800"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {source.title ?? source.ref}
          </span>
          {source.category && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(source.category)}`}
            >
              {source.category}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Content */}
      <div
        className={`transition-all duration-200 ease-in-out ${expanded ? "max-h-[2000px] opacity-100" : "max-h-40 opacity-100"} overflow-hidden`}
      >
        <div className="space-y-3 px-4 py-3">
          {/* Hebrew text (RTL) */}
          {hebrewText && (
            <p
              dir="rtl"
              className="text-sm leading-relaxed text-gray-800 dark:text-gray-200"
            >
              {displayedHebrew}
            </p>
          )}

          {/* Separator */}
          {hebrewText && translationText && (
            <hr className="border-gray-200 dark:border-gray-700" />
          )}

          {/* Translation (LTR) */}
          {translationText && (
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {displayedTranslation}
            </p>
          )}

          {/* Expand/Collapse toggle */}
          {isLongContent && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              {expanded ? t("sources.showLess") : t("sources.showMore")}
            </button>
          )}
        </div>
      </div>

      {/* Footer: Sefaria link */}
      {source.sefariaUrl && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
          <a
            href={source.sefariaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t("sources.viewOnSefaria")}
          </a>
        </div>
      )}
    </div>
  );
}
