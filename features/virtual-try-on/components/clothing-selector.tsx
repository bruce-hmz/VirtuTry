"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  tags: string[];
  imageUrl: string;
}

interface ClothingSelectorProps {
  items: ClothingItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  maxSelection: number;
}

export function ClothingSelector({
  items,
  selectedIds,
  onToggle,
  maxSelection,
}: ClothingSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {items.map((item) => {
        const isSelected = selectedIds.includes(item.id);
        const isDisabled = !isSelected && selectedIds.length >= maxSelection;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => !isDisabled && onToggle(item.id)}
            disabled={isDisabled}
            className={cn(
              "relative rounded-lg border-2 overflow-hidden transition-all text-left",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              isSelected
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-muted-foreground/50",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="relative aspect-square w-full bg-muted">
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-cover"
              />
              {isSelected && (
                <div className="absolute top-2 right-2 p-1 rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
