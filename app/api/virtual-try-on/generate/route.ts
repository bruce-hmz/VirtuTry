import { auth } from "@/lib/auth";
import {
  canUserTryOn,
  createVirtualTryOn,
  deductVirtualTryOnQuota,
  initializeUserQuotas,
} from "@/lib/virtualtry";
import { generateVirtualTryOn } from "@/lib/volcano-engine/seedream";
import { db } from "@/lib/db";
import { user as userTable, clothing } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GenerateRequest {
  personImageBase64: string;
  clothingIds?: string[]; // IDs from clothing library
  customClothingImages?: string[]; // Base64 images uploaded by user
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
    const { personImageBase64, clothingIds = [], customClothingImages = [] } = body;

    // 3. Validate input
    if (!personImageBase64 || typeof personImageBase64 !== "string") {
      return NextResponse.json(
        { error: "Person image (Base64 format) is required" },
        { status: 400 }
      );
    }

    // Check Base64 format
    if (!personImageBase64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format. Expected data:image/...;base64,..." },
        { status: 400 }
      );
    }

    const totalClothing = clothingIds.length + customClothingImages.length;
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
        { status: 429 } // Rate limit status
      );
    }

    // 5. Fetch clothing images from library
    let clothingImagesBase64: string[] = [];

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
        // Use cached Base64 if available, otherwise fetch from URL
        if (cloth.imageBase64) {
          clothingImagesBase64.push(cloth.imageBase64);
        } else if (cloth.imageUrl) {
          // TODO: Fetch from URL and convert to Base64 if needed
          // For now, just use the URL as-is (Seedream should support URLs)
          clothingImagesBase64.push(cloth.imageUrl);
        }
      }
    }

    // Add custom clothing images
    clothingImagesBase64.push(...customClothingImages);

    if (clothingImagesBase64.length === 0) {
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

    const { taskId, status } = await generateVirtualTryOn(
      personImageBase64,
      clothingImagesBase64
    );

    // 8. Create database record
    const tryOnRecord = await createVirtualTryOn(
      userId,
      personImageBase64,
      clothingIds,
      taskId,
      hasWatermark
    );

    // 9. Deduct quota and credits (immediately deducted, failure won't refund)
    await deductVirtualTryOnQuota(userId);

    console.log(`[VirtualTryOn] Created record ${tryOnRecord.id} for task ${taskId}`);

    // 10. Return response
    return NextResponse.json({
      success: true,
      taskId,
      tryOnId: tryOnRecord.id,
      status,
      message: "Virtual try-on submitted. Poll /api/virtual-try-on/status for results.",
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
