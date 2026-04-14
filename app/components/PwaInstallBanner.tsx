import { useTranslation } from "react-i18next";
import { usePwa } from "~/lib/use-pwa";

export function PwaInstallBanner() {
  const { t } = useTranslation();
  const { canInstall, isInstalled, promptInstall } = usePwa();

  if (!canInstall || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              {t("pwa.installTitle")}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t("pwa.installSubtitle")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={promptInstall}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            {t("pwa.install")}
          </button>
        </div>
      </div>
    </div>
  );
}
