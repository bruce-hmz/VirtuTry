import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clothing } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const tags = searchParams.get("tags");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const conditions = [eq(clothing.active, true)];

    if (category) {
      conditions.push(eq(clothing.category, category));
    }

    if (tags) {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        conditions.push(sql`${clothing.tags} && ARRAY[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]`);
      }
    }

    const items = await db
      .select()
      .from(clothing)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(clothing)
      .where(and(...conditions));

    return NextResponse.json({
      items,
      total: Number(count),
      page,
      limit,
    });
  } catch (error) {
    console.error("[ClothingList] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch clothing" },
      { status: 500 }
    );
  }
}
