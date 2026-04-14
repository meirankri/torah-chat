import { Link } from "react-router";
import { useTranslation } from "react-i18next";

interface QuotaWarningBannerProps {
  used: number;
  limit: number;
}

const QUOTA_WARNING_THRESHOLD = 0.8;

export function QuotaWarningBanner({ used, limit }: QuotaWarningBannerProps) {
  const { t } = useTranslation();
  const remaining = limit - used;
  const ratio = used / limit;

  if (ratio < QUOTA_WARNING_THRESHOLD) return null;

  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/30">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <p className="text-sm text-amber-800 dark:text-amber-300">
          {t("chat.quotaWarning", { remaining })}
        </p>
        <Link
          to="/pricing"
          className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
        >
          {t("chat.quotaWarningUpgrade")}
        </Link>
      </div>
    </div>
  );
}
