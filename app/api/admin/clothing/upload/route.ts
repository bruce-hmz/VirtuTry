import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { clothing } from "@/lib/db/schema";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const name = formData.get("name") as string | null;
    const category = formData.get("category") as string | null;
    const tagsRaw = formData.get("tags") as string | null;

    if (!file || !name || !category) {
      return NextResponse.json(
        { error: "file, name, and category are required" },
        { status: 400 }
      );
    }

    const validCategories = ["dress", "shirt", "coat", "pants", "skirt", "top", "jacket", "sweater", "other"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    const tags = tagsRaw
      ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean)
      : [];

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

    const cloth = await db.insert(clothing).values({
      id: randomUUID(),
      name,
      category,
      tags,
      imageUrl: base64,
      imageBase64: base64,
    }).returning();

    return NextResponse.json({
      success: true,
      clothingId: cloth[0].id,
    });
  } catch (error) {
    console.error("[AdminClothingUpload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload clothing" },
      { status: 500 }
    );
  }
}
