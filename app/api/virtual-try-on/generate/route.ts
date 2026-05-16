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

async function downloadAsBase64(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);

  const contentType = response.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
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

    // 5. Download person image and convert to Base64
    const personImageBase64 = await downloadAsBase64(personImageUrl);

    // 6. Fetch clothing images from library + custom uploads, convert to Base64
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
        if (cloth.imageBase64) {
          clothingImagesBase64.push(cloth.imageBase64);
        } else if (cloth.imageUrl) {
          const base64 = await downloadAsBase64(cloth.imageUrl);
          clothingImagesBase64.push(base64);
        }
      }
    }

    // Download custom clothing images from URLs
    for (const url of customClothingUrls) {
      const base64 = await downloadAsBase64(url);
      clothingImagesBase64.push(base64);
    }

    if (clothingImagesBase64.length === 0) {
      return NextResponse.json(
        { error: "No valid clothing images found" },
        { status: 400 }
      );
    }

    // 7. Get user tier for watermark decision
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    const userTier = userData[0]?.planKey && userData[0].planKey !== "free" ? "paid" : "free";
    const hasWatermark = userTier === "free";

    // 8. Call Seedream API
    console.log(`[VirtualTryOn] Generating for user ${userId} (${userTier})`);

    const { taskId, status } = await generateVirtualTryOn(
      personImageBase64,
      clothingImagesBase64
    );

    // 9. Create database record
    const tryOnRecord = await createVirtualTryOn(
      userId,
      personImageBase64,
      clothingIds,
      taskId,
      hasWatermark
    );

    // 10. Deduct quota and credits
    await deductVirtualTryOnQuota(userId);

    console.log(`[VirtualTryOn] Created record ${tryOnRecord.id} for task ${taskId}`);

    // 11. Return response
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
