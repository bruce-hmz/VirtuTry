"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Wand2, History, Shirt } from "lucide-react";
import Link from "next/link";
import { ImageUploader } from "@/features/virtual-try-on/components/image-uploader";
import { VirtualTryOnResult } from "@/features/virtual-try-on/components/try-on-result";
import { QuotaDisplay } from "@/features/virtual-try-on/components/quota-display";

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
}

export default function TryOnPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("virtualTryOn");

  const [personImage, setPersonImage] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<ClothingItem[]>([]);
  const [customClothingUrls, setCustomClothingUrls] = useState<string[]>([]);
  const [showWardrobe, setShowWardrobe] = useState(false);

  const [status, setStatus] = useState<"idle" | "pending" | "processing" | "completed" | "failed">("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [hasWatermark, setHasWatermark] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [quota, setQuota] = useState({ daily: { quotaLimit: 3, quotaUsed: 0 }, monthly: { quotaLimit: 90, quotaUsed: 0 } });
  const [credits, setCredits] = useState(0);
  const [planKey, setPlanKey] = useState("free");
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [loadingWardrobe, setLoadingWardrobe] = useState(false);

  const maxClothing = planKey && planKey !== "free" ? 3 : 1;

  useEffect(() => {
    fetchUserData();
    fetchWardrobe();

    const idsParam = searchParams.get("ids");
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        fetch(`/api/clothing/list?limit=50`)
          .then((res) => res.ok ? res.json() : { items: [] })
          .then((data) => {
            const items = (data.items || []).filter((c: ClothingItem) => ids.includes(c.id));
            setSelectedClothing(items.slice(0, 1));
          });
      }
    }
  }, []);

  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/user/try-on-quota");
      if (res.ok) {
        const data = await res.json();
        setQuota({ daily: data.daily, monthly: data.monthly });
        setCredits(data.credits ?? 0);
        setPlanKey(data.planKey ?? "free");
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  };

  const fetchWardrobe = async () => {
    setLoadingWardrobe(true);
    try {
      const res = await fetch("/api/clothing/list?limit=50");
      if (res.ok) {
        const data = await res.json();
        setWardrobeItems(data.items || []);
      }
    } catch (err) {
      console.error("Failed to fetch wardrobe:", err);
    }
    setLoadingWardrobe(false);
  };

  const totalClothing = selectedClothing.length + customClothingUrls.length;

  const pollResult = useCallback(async (tid: string) => {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/virtual-try-on/status?taskId=${tid}`);
        if (!res.ok) throw new Error("Failed to query status");

        const data = await res.json();

        if (data.status === "completed") {
          setStatus("completed");
          setResultImageUrl(data.resultImageUrl);
          return;
        }

        if (data.status === "failed") {
          setStatus("failed");
          setErrorMessage(data.error || "Generation failed");
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          setStatus("failed");
          setErrorMessage("Timed out waiting for result");
        }
      } catch (err) {
        setStatus("failed");
        setErrorMessage(err instanceof Error ? err.message : "Polling failed");
      }
    };

    poll();
  }, []);

  const handleGenerate = async () => {
    if (!personImage || totalClothing === 0 || generating) return;

    setGenerating(true);
    setStatus("pending");
    setResultImageUrl(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/virtual-try-on/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personImageUrl: personImage,
          clothingIds: selectedClothing.map((c) => c.id),
          customClothingUrls: customClothingUrls,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setTaskId(data.taskId);
      setStatus("processing");
      setHasWatermark(data.hasWatermark);
      setCredits((prev) => Math.max(0, prev - 50));

      await fetchUserData();
      pollResult(data.taskId);
    } catch (err) {
      setStatus("failed");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start generation");
    }
    setGenerating(false);
  };

  const handleWardrobeSelect = (item: ClothingItem) => {
    setSelectedClothing((prev) => {
      const exists = prev.find((c) => c.id === item.id);
      if (exists) return prev.filter((c) => c.id !== item.id);
      if (prev.length >= maxClothing) return prev;
      return [...prev, item];
    });
  };

  const handleReset = () => {
    setStatus("idle");
    setResultImageUrl(null);
    setErrorMessage(null);
    setTaskId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pt-24 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/try-on/history`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              <History className="h-4 w-4" />
              {t("history")}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Image Upload */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Person Image */}
              <div className="md:col-span-1">
                <ImageUploader
                  label={t("yourPhoto")}
                  onImageSelect={(base64) => setPersonImage(base64)}
                  onClear={() => setPersonImage(null)}
                  previewUrl={personImage || undefined}
                  disabled={status === "pending" || status === "processing"}
                />
              </div>

              {/* Clothing Selection */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">
                    {t("clothing")} ({totalClothing}/{maxClothing})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowWardrobe(!showWardrobe)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                  >
                    <Shirt className="h-4 w-4" />
                    {showWardrobe ? t("hideLibrary") : t("fromLibrary")}
                  </button>
                </div>

                {/* Selected clothing items */}
                <div className="grid grid-cols-3 gap-3">
                  {selectedClothing.map((item) => (
                    <div key={item.id} className="relative aspect-square rounded-lg border border-border bg-muted overflow-hidden">
                      <ImageUploader
                        label=""
                        onImageSelect={() => {}}
                        onClear={() => setSelectedClothing((prev) => prev.filter((c) => c.id !== item.id))}
                        previewUrl={item.imageUrl}
                        disabled={status === "pending" || status === "processing"}
                      />
                      <p className="absolute bottom-0 inset-x-0 bg-background/80 px-2 py-1 text-xs truncate">
                        {item.name}
                      </p>
                    </div>
                  ))}

                  {/* Slots for custom uploads */}
                  {Array.from({ length: maxClothing - selectedClothing.length }).map((_, i) => (
                    <ImageUploader
                      key={`custom-${i}`}
                      label={`Clothing ${totalClothing + i + 1}`}
                      onImageSelect={(url) => setCustomClothingUrls((prev) => [...prev, url])}
                      onClear={() => setCustomClothingUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      previewUrl={customClothingUrls[i]}
                      disabled={status === "pending" || status === "processing"}
                    />
                  ))}
                </div>

                {/* Wardrobe picker */}
                {showWardrobe && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <h4 className="text-sm font-medium mb-3">{t("clothingLibrary")}</h4>
                    {loadingWardrobe ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : wardrobeItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("noClothing")}</p>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                        {wardrobeItems.map((item) => {
                          const isSelected = selectedClothing.some((c) => c.id === item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleWardrobeSelect(item)}
                              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                isSelected
                                  ? "border-primary"
                                  : "border-transparent hover:border-muted-foreground/50"
                              }`}
                            >
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="object-cover w-full h-full"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Generate button */}
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!personImage || totalClothing === 0 || generating || status === "processing"}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wand2 className="h-5 w-5" />
                  {generating || status === "processing"
                    ? t("generating")
                    : t("generate")}
                </button>
              </div>
            </div>

            {/* Result */}
            <VirtualTryOnResult
              status={status}
              resultImageUrl={resultImageUrl || undefined}
              hasWatermark={hasWatermark}
              errorMessage={errorMessage || undefined}
              onRetry={handleReset}
            />
          </div>

          {/* Right: Quota Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 p-6 rounded-xl border border-border bg-card">
              <h3 className="font-semibold text-foreground mb-4">{t("usage")}</h3>
              <QuotaDisplay
                quota={quota}
                credits={credits}
                onUpgrade={() => router.push(`/${locale}/pricing`)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
