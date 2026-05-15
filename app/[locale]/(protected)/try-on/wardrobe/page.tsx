"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Search } from "lucide-react";
import { ClothingSelector } from "@/features/virtual-try-on/components/clothing-selector";

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  tags: string[];
  imageUrl: string;
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "dress", label: "Dress" },
  { value: "shirt", label: "Shirt" },
  { value: "coat", label: "Coat" },
  { value: "pants", label: "Pants" },
  { value: "skirt", label: "Skirt" },
  { value: "top", label: "Top" },
  { value: "jacket", label: "Jacket" },
  { value: "sweater", label: "Sweater" },
];

export default function WardrobePage() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("virtualTryOn.wardrobe");

  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, [category]);

  const fetchItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (category) params.set("category", category);

      const res = await fetch(`/api/clothing/list?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wardrobe");
    }
    setLoading(false);
  };

  const filtered = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
    : items;

  const handleSelect = () => {
    const params = new URLSearchParams();
    params.set("ids", selectedIds.join(","));
    router.push(`/${locale}/try-on?${params}`);
  };

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
            <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.value === "" ? t("all") : cat.label}
            </button>
          ))}

          <div className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Content */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">{t("noItems")}</p>
          </div>
        ) : (
          <>
            <ClothingSelector
              items={filtered}
              selectedIds={selectedIds}
              onToggle={(id) =>
                setSelectedIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((i) => i !== id)
                    : [...prev, id]
                )
              }
              maxSelection={3}
            />

            {selectedIds.length > 0 && (
              <div className="fixed bottom-8 inset-x-0 flex justify-center pointer-events-none">
                <div className="pointer-events-auto px-6 py-3 rounded-xl bg-foreground text-background shadow-lg flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedIds.length} {t("selected")}
                  </span>
                  <button
                    type="button"
                    onClick={handleSelect}
                    className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    {t("useForTryOn")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
