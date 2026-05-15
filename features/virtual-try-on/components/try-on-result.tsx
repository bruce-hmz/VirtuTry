"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TryOnResultProps {
  status: "idle" | "pending" | "processing" | "completed" | "failed";
  resultImageUrl?: string;
  hasWatermark?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  className?: string;
}

export function VirtualTryOnResult({
  status,
  resultImageUrl,
  hasWatermark,
  errorMessage,
  onRetry,
  className,
}: TryOnResultProps) {
  const t = useTranslations("virtualTryOn");

  const [saving, setSaving] = useState(false);

  const handleDownload = async () => {
    if (!resultImageUrl) return;
    setSaving(true);
    try {
      const response = await fetch(resultImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `virtual-try-on-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
    setSaving(false);
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-lg font-semibold text-foreground">{t("result")}</h3>

      <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <span className="text-sm">{t("status.idle")}</span>
          </div>
        )}

        {(status === "pending" || status === "processing") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {status === "pending" ? t("status.pending") : t("status.processing")}
            </span>
          </div>
        )}

        {status === "completed" && resultImageUrl && (
          <>
            <Image
              src={resultImageUrl}
              alt="Try-on result"
              fill
              className="object-cover"
            />
            {hasWatermark && (
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-background/80 text-xs text-muted-foreground">
                VirtuTry
              </div>
            )}
          </>
        )}

        {status === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/50">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <span className="text-sm text-destructive text-center px-4">
              {errorMessage || t("status.failed")}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="h-4 w-4" />
                {t("retry")}
              </button>
            )}
          </div>
        )}
      </div>

      {status === "completed" && resultImageUrl && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {saving ? t("generating") : t("download")}
          </button>
        </div>
      )}
    </div>
  );
}
