import { auth } from "@/lib/auth";
import { updateVirtualTryOnResult, markTryOnFailed } from "@/lib/virtualtry";
import { querySeedreamStatus } from "@/lib/volcano-engine/seedream";
import { db } from "@/lib/db";
import { virtualTryOn as virtualTryOnTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface StatusRequest {
  taskId: string;
}

/**
 * Query the status of a virtual try-on task
 * GET /api/virtual-try-on/status?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get taskId from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json(
        { error: "taskId query parameter is required" },
        { status: 400 }
      );
    }

    // 3. Query Seedream API
    console.log(`[VirtualTryOn] Querying status for task ${taskId}`);

    const result = await querySeedreamStatus(taskId);

    // 4. Update database based on result
    const imageUrl = result.data?.[0]?.url || result.data?.[0]?.b64_json;

    if (imageUrl) {
      console.log(`[VirtualTryOn] Task ${taskId} completed`);
      await updateVirtualTryOnResult(taskId, imageUrl);

      return NextResponse.json({
        taskId,
        status: "completed",
        resultImageUrl: imageUrl,
        message: "Try-on completed successfully",
      });
    } else if (result.error) {
      console.error(`[VirtualTryOn] Task ${taskId} failed:`, result.error);
      await markTryOnFailed(taskId, result.error.message || "Unknown error");

      return NextResponse.json({
        taskId,
        status: "failed",
        error: result.error.message || "Try-on generation failed",
      });
    } else {
      return NextResponse.json({
        taskId,
        status: "processing",
        message: "Try-on is still processing. Please check again in a few seconds.",
      });
    }
  } catch (error) {
    console.error("[VirtualTryOn] Status query error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to query try-on status";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
