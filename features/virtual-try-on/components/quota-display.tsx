"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuotaInfo {
  daily?: { quotaLimit: number; quotaUsed: number };
  monthly?: { quotaLimit: number; quotaUsed: number };
}

interface QuotaDisplayProps {
  quota: QuotaInfo;
  credits: number;
  onUpgrade?: () => void;
  className?: string;
}

export function QuotaDisplay({
  quota,
  credits,
  onUpgrade,
  className,
}: QuotaDisplayProps) {
  const t = useTranslations("virtualTryOn.quota");

  const dailyUsed = quota.daily?.quotaUsed ?? 0;
  const dailyLimit = quota.daily?.quotaLimit ?? 3;
  const dailyPercent = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;

  const monthlyUsed = quota.monthly?.quotaUsed ?? 0;
  const monthlyLimit = quota.monthly?.quotaLimit ?? 90;
  const monthlyPercent = monthlyLimit > 0 ? (monthlyUsed / monthlyLimit) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("daily")}</span>
          <span className={cn(
            "font-medium",
            dailyPercent >= 100 ? "text-destructive" : "text-foreground"
          )}>
            {dailyUsed}/{dailyLimit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              dailyPercent >= 100
                ? "bg-destructive"
                : dailyPercent >= 80
                  ? "bg-amber-500"
                  : "bg-primary"
            )}
            style={{ width: `${Math.min(dailyPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("monthly")}</span>
          <span className={cn(
            "font-medium",
            monthlyPercent >= 100 ? "text-destructive" : "text-foreground"
          )}>
            {monthlyUsed}/{monthlyLimit}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              monthlyPercent >= 100
                ? "bg-destructive"
                : monthlyPercent >= 80
                  ? "bg-amber-500"
                  : "bg-primary"
            )}
            style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("credits")}</span>
        <span className="font-medium text-foreground">{credits.toLocaleString()}</span>
      </div>

      {onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          <Zap className="h-4 w-4" />
          {t("upgrade")}
        </button>
      )}
    </div>
  );
}
