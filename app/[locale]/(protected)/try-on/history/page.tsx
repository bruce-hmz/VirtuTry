"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface TryOnRecord {
  id: string;
  personImageUrl: string;
  resultImageUrl: string | null;
  hasWatermark: boolean;
  status: string;
  creditsUsed: number;
  createdAt: string;
}

export default function TryOnHistoryPage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("virtualTryOn");

  const [items, setItems] = useState<TryOnRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState("all");
  const limit = 12;

  useEffect(() => {
    fetchHistory();
  }, [page, timeFilter]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      const res = await fetch(`/api/virtual-try-on/history?${params}`);
      if (!res.ok) throw new Error("Failed to fetch history");

      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this try-on record?")) return;

    try {
      const res = await fetch(`/api/virtual-try-on/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `try-on-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("myHistory")}</h1>
            <p className="text-muted-foreground mt-1">{t("historySubtitle")}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          {[
            { value: "all", label: "All" },
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setTimeFilter(filter.value);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                timeFilter === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <span className="text-sm text-muted-foreground ml-auto">
            {total} {total === 1 ? "record" : "records"}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-6">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">{t("noHistory")}</p>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/try-on`)}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("startTryOn")}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted"
                >
                  {item.resultImageUrl ? (
                    <Image
                      src={item.resultImageUrl}
                      alt="Try-on result"
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                      {item.status === "failed" ? "Failed" : "Processing..."}
                    </div>
                  )}

                  {item.hasWatermark && item.resultImageUrl && (
                    <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-background/80 text-xs text-muted-foreground">
                      VirtuTry
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

                  {/* Actions */}
                  <div className="absolute inset-x-0 bottom-0 p-3 flex gap-2 translate-y-full group-hover:translate-y-0 transition-transform">
                    {item.resultImageUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownload(item.resultImageUrl!)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-background/90 text-sm hover:bg-background transition-colors"
                      >
                        <Download className="h-3 w-3" />
                        {t("download")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-lg bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Timestamp */}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded bg-background/80 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
