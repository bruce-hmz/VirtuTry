import { auth } from "@/lib/auth";
import {
  canUserTryOn,
  createVirtualTryOn,
  deductVirtualTryOnQuota,
} from "@/lib/virtualtry";
import { generateVirtualTryOn } from "@/lib/volcano-engine/seedream";
import { db } from "@/lib/db";
import { user as userTable, clothing } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GenerateRequest {
  personImageUrl: string;
  clothingIds?: string[];
  customClothingUrls?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please login first." },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Parse request body
    const body = (await request.json()) as GenerateRequest;
    const { personImageUrl, clothingIds = [], customClothingUrls = [] } = body;

    // 3. Validate input
    if (!personImageUrl || typeof personImageUrl !== "string") {
      return NextResponse.json(
        { error: "Person image URL is required" },
        { status: 400 }
      );
    }

    const totalClothing = clothingIds.length + customClothingUrls.length;
    if (totalClothing === 0) {
      return NextResponse.json(
        { error: "At least one clothing image is required" },
        { status: 400 }
      );
    }

    // 4. Check user quotas and permissions
    const { allowed, reason } = await canUserTryOn(userId, totalClothing);
    if (!allowed) {
      return NextResponse.json(
        { error: reason || "Try-on not allowed" },
        { status: 429 }
      );
    }

    // 5. Collect clothing image URLs from library + custom uploads
    const clothingImageUrls: string[] = [];

    if (clothingIds.length > 0) {
      const dbClothings = await db
        .select()
        .from(clothing)
        .where(
          inArray(
            clothing.id,
            clothingIds.filter(id => id && typeof id === "string")
          )
        );

      for (const cloth of dbClothings) {
        if (cloth.imageUrl) {
          clothingImageUrls.push(cloth.imageUrl);
        } else if (cloth.imageBase64) {
          clothingImageUrls.push(cloth.imageBase64);
        }
      }
    }

    // Add custom clothing image URLs
    for (const url of customClothingUrls) {
      if (url && typeof url === "string") {
        clothingImageUrls.push(url);
      }
    }

    if (clothingImageUrls.length === 0) {
      return NextResponse.json(
        { error: "No valid clothing images found" },
        { status: 400 }
      );
    }

    // 6. Get user tier for watermark decision
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const userTier = userData[0]?.planKey && userData[0].planKey !== "free" ? "paid" : "free";
    const hasWatermark = userTier === "free";

    // 7. Call Seedream API
    console.log(`[VirtualTryOn] Generating for user ${userId} (${userTier})`);

    const { taskId, status, imageUrl: resultUrl } = await generateVirtualTryOn(
      personImageUrl,
      clothingImageUrls
    );

    // 8. Create database record
    const tryOnRecord = await createVirtualTryOn(
      userId,
      personImageUrl,
      clothingIds,
      taskId,
      hasWatermark
    );

    // If result is already available, update it
    if (resultUrl && status === "completed") {
      const { updateVirtualTryOnResult } = await import("@/lib/virtualtry");
      await updateVirtualTryOnResult(taskId, resultUrl);
    }

    // 9. Deduct quota and credits
    await deductVirtualTryOnQuota(userId);

    console.log(`[VirtualTryOn] Created record ${tryOnRecord.id} for task ${taskId}`);

    // 10. Return response
    return NextResponse.json({
      success: true,
      taskId,
      tryOnId: tryOnRecord.id,
      status,
      resultImageUrl: resultUrl || undefined,
      message: resultUrl
        ? "Virtual try-on completed."
        : "Virtual try-on submitted. Poll /api/virtual-try-on/status for results.",
      userTier,
      hasWatermark,
    });
  } catch (error) {
    console.error("[VirtualTryOn] Error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate virtual try-on";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
