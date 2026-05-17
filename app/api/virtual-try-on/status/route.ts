import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { virtualTryOn as virtualTryOnTable } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const records = await db
      .select()
      .from(virtualTryOnTable)
      .where(
        and(
          eq(virtualTryOnTable.seedreamTaskId, taskId),
          eq(virtualTryOnTable.userId, session.user.id)
        )
      )
      .limit(1);

    if (records.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const record = records[0];

    return NextResponse.json({
      taskId,
      status: record.status,
      resultImageUrl: record.resultImageUrl || undefined,
      error: record.errorMessage || undefined,
      message: record.status === "completed"
        ? "Try-on completed successfully"
        : record.status === "failed"
          ? record.errorMessage || "Try-on failed"
          : "Try-on is processing",
    });
  } catch (error) {
    console.error("[VirtualTryOn] Status query error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to query status" },
      { status: 500 }
    );
  }
}
