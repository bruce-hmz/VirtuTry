import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { clothing } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, category, tags, active } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) {
      const validCategories = ["dress", "shirt", "coat", "pants", "skirt", "top", "jacket", "sweater", "other"];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.category = category;
    }
    if (tags !== undefined) updateData.tags = tags;
    if (active !== undefined) updateData.active = active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await db
      .update(clothing)
      .set(updateData)
      .where(eq(clothing.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: "Clothing not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated[0] });
  } catch (error) {
    console.error("[AdminClothingUpdate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update clothing" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const deleted = await db
      .delete(clothing)
      .where(eq(clothing.id, id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Clothing not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AdminClothingDelete] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete clothing" },
      { status: 500 }
    );
  }
}
