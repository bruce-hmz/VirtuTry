"use client";

import { useCallback, useState } from "react";
import { Upload, X, AlertCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface ImageUploaderProps {
  onImageSelect: (base64: string) => void;
  onClear: () => void;
  previewUrl?: string;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function ImageUploader({
  onImageSelect,
  onClear,
  previewUrl,
  label,
  className,
  disabled,
}: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG, and WebP are supported");
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        return;
      }

      setLoading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          onImageSelect(result);
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>

      {previewUrl ? (
        <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-border bg-muted">
          <Image
            src={previewUrl}
            alt={label}
            fill
            className="object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "relative w-full aspect-[3/4] rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            "flex flex-col items-center justify-center gap-2",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !disabled && document.getElementById(`upload-${label.replace(/\s+/g, "-")}`)?.click()}
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center px-4">
                Drop or click to upload
              </span>
              <span className="text-xs text-muted-foreground/60">Max 10MB</span>
            </>
          )}
          <input
            id={`upload-${label.replace(/\s+/g, "-")}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInput}
            className="hidden"
            disabled={disabled}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
