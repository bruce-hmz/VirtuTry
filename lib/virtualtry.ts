import { db } from "@/lib/db";
import { user as userTable, tryOnQuota, virtualTryOn, clothing } from "@/lib/db/schema";
import { deductCredits, getUserCredits } from "@/lib/credits";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Virtual try-on credit cost
export const VIRTUAL_TRY_ON_CREDIT_COST = 50;

// Quota limits per tier
export const QUOTA_LIMITS = {
  free: {
    daily: 3,
    monthly: 90, // ~3 per day
  },
  paid: {
    daily: Infinity,
    monthly: 200,
  },
};

// Max clothing items per try-on
export const MAX_CLOTHING_PER_TRY_ON = {
  free: 1,
  paid: 3,
};

/**
 * Get user's try-on quotas (daily and monthly)
 */
export async function getVirtualTryOnQuota(userId: string) {
  const quotas = await db
    .select()
    .from(tryOnQuota)
    .where(eq(tryOnQuota.userId, userId));

  const daily = quotas.find(q => q.quotaType === "daily");
  const monthly = quotas.find(q => q.quotaType === "monthly");

  return { daily, monthly };
}

/**
 * Initialize user's try-on quotas (called on first use or subscription change)
 */
export async function initializeUserQuotas(userId: string, userTier: "free" | "paid") {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const nextMonthStart = new Date(now);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
  nextMonthStart.setDate(1);
  nextMonthStart.setHours(0, 0, 0, 0);

  try {
    await db.transaction(async (tx) => {
      // Daily quota
      const dailyQuotas = await tx
        .select()
        .from(tryOnQuota)
        .where(
          and(
            eq(tryOnQuota.userId, userId),
            eq(tryOnQuota.quotaType, "daily"),
            gt(tryOnQuota.resetAt, now)
          )
        );

      if (dailyQuotas.length === 0) {
        await tx.insert(tryOnQuota).values({
          id: randomUUID(),
          userId,
          quotaType: "daily",
          quotaLimit: QUOTA_LIMITS[userTier].daily,
          quotaUsed: 0,
          resetAt: tomorrowStart,
        });
      }

      // Monthly quota
      const monthlyQuotas = await tx
        .select()
        .from(tryOnQuota)
        .where(
          and(
            eq(tryOnQuota.userId, userId),
            eq(tryOnQuota.quotaType, "monthly"),
            gt(tryOnQuota.resetAt, now)
          )
        );

      if (monthlyQuotas.length === 0) {
        await tx.insert(tryOnQuota).values({
          id: randomUUID(),
          userId,
          quotaType: "monthly",
          quotaLimit: QUOTA_LIMITS[userTier].monthly,
          quotaUsed: 0,
          resetAt: nextMonthStart,
        });
      }
    });
  } catch (error) {
    console.error("Error initializing quotas:", error);
    throw error;
  }
}

/**
 * Reinitialize user's try-on quotas when plan changes
 * Updates quota limits but preserves current usage counts
 */
export async function reinitializeUserQuotas(userId: string, userTier: "free" | "paid") {
  try {
    await db.transaction(async (tx) => {
      const now = new Date();

      const nextMonthStart = new Date(now);
      nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
      nextMonthStart.setDate(1);
      nextMonthStart.setHours(0, 0, 0, 0);

      const tomorrowStart = new Date(now);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      tomorrowStart.setHours(0, 0, 0, 0);

      const dailyQuotas = await tx
        .select()
        .from(tryOnQuota)
        .where(
          and(eq(tryOnQuota.userId, userId), eq(tryOnQuota.quotaType, "daily"))
        )
        .limit(1);

      if (dailyQuotas.length > 0) {
        await tx
          .update(tryOnQuota)
          .set({
            quotaLimit: userTier === "paid" ? Infinity : QUOTA_LIMITS.free.daily,
            resetAt: tomorrowStart,
          })
          .where(
            and(eq(tryOnQuota.userId, userId), eq(tryOnQuota.quotaType, "daily"))
          );
      } else {
        await tx.insert(tryOnQuota).values({
          id: randomUUID(),
          userId,
          quotaType: "daily",
          quotaLimit: userTier === "paid" ? Infinity : QUOTA_LIMITS.free.daily,
          quotaUsed: 0,
          resetAt: tomorrowStart,
        });
      }

      const monthlyQuotas = await tx
        .select()
        .from(tryOnQuota)
        .where(
          and(eq(tryOnQuota.userId, userId), eq(tryOnQuota.quotaType, "monthly"))
        )
        .limit(1);

      if (monthlyQuotas.length > 0) {
        await tx
          .update(tryOnQuota)
          .set({
            quotaLimit: QUOTA_LIMITS[userTier].monthly,
            resetAt: nextMonthStart,
          })
          .where(
            and(eq(tryOnQuota.userId, userId), eq(tryOnQuota.quotaType, "monthly"))
          );
      } else {
        await tx.insert(tryOnQuota).values({
          id: randomUUID(),
          userId,
          quotaType: "monthly",
          quotaLimit: QUOTA_LIMITS[userTier].monthly,
          quotaUsed: 0,
          resetAt: nextMonthStart,
        });
      }
    });
  } catch (error) {
    console.error("Error reinitializing quotas:", error);
    throw error;
  }
}

/**
 * Check if user can perform a virtual try-on
 */
export async function canUserTryOn(
  userId: string,
  clothingCount: number
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // 1. Check user exists and not banned
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    if (userData.length === 0) {
      return { allowed: false, reason: "User not found" };
    }

    const u = userData[0];
    if (u.banned) {
      return { allowed: false, reason: `Account banned: ${u.banReason}` };
    }

    // 2. Determine user tier
    const userTier = u.planKey && u.planKey !== "free" ? "paid" : "free";

    // 3. Check clothing count limit
    const maxClothing = MAX_CLOTHING_PER_TRY_ON[userTier];
    if (clothingCount < 1 || clothingCount > maxClothing) {
      return {
        allowed: false,
        reason: `Need 1-${maxClothing} clothing items for ${userTier} users`,
      };
    }

    // 4. Ensure quotas are initialized
    const quotas = await getVirtualTryOnQuota(userId);
    if (!quotas.daily || !quotas.monthly) {
      await initializeUserQuotas(userId, userTier);
    }

    // 5. Check daily quota
    const now = new Date();
    const dailyQuotas = await db
      .select()
      .from(tryOnQuota)
      .where(
        and(
          eq(tryOnQuota.userId, userId),
          eq(tryOnQuota.quotaType, "daily"),
          gt(tryOnQuota.resetAt, now)
        )
      )
      .limit(1);

    if (dailyQuotas.length > 0) {
      const quota = dailyQuotas[0];
      if (quota.quotaUsed >= quota.quotaLimit) {
        return {
          allowed: false,
          reason: `Daily limit reached (${quota.quotaUsed}/${quota.quotaLimit})`,
        };
      }
    }

    // 6. Check monthly quota
    const monthlyQuotas = await db
      .select()
      .from(tryOnQuota)
      .where(
        and(
          eq(tryOnQuota.userId, userId),
          eq(tryOnQuota.quotaType, "monthly"),
          gt(tryOnQuota.resetAt, now)
        )
      )
      .limit(1);

    if (monthlyQuotas.length > 0) {
      const quota = monthlyQuotas[0];
      if (quota.quotaUsed >= quota.quotaLimit) {
        return {
          allowed: false,
          reason: `Monthly limit reached (${quota.quotaUsed}/${quota.quotaLimit})`,
        };
      }
    }

    // 7. Check credits
    const credits = await getUserCredits(userId);
    if (credits < VIRTUAL_TRY_ON_CREDIT_COST) {
      return {
        allowed: false,
        reason: `Insufficient credits (need ${VIRTUAL_TRY_ON_CREDIT_COST}, have ${credits})`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking try-on eligibility:", error);
    return { allowed: false, reason: "Internal error" };
  }
}

/**
 * Deduct try-on quota and credits
 */
export async function deductVirtualTryOnQuota(userId: string) {
  try {
    const now = new Date();

    // Deduct daily quota
    await db
      .update(tryOnQuota)
      .set({ quotaUsed: sql`${tryOnQuota.quotaUsed} + 1` })
      .where(
        and(
          eq(tryOnQuota.userId, userId),
          eq(tryOnQuota.quotaType, "daily"),
          gt(tryOnQuota.resetAt, now)
        )
      );

    // Deduct monthly quota
    await db
      .update(tryOnQuota)
      .set({ quotaUsed: sql`${tryOnQuota.quotaUsed} + 1` })
      .where(
        and(
          eq(tryOnQuota.userId, userId),
          eq(tryOnQuota.quotaType, "monthly"),
          gt(tryOnQuota.resetAt, now)
        )
      );

    // Deduct credits
    await deductCredits(userId, VIRTUAL_TRY_ON_CREDIT_COST, "virtual_try_on");
  } catch (error) {
    console.error("Error deducting try-on quota:", error);
    throw error;
  }
}

/**
 * Create try-on record
 */
export async function createVirtualTryOn(
  userId: string,
  personImageUrl: string,
  clothingIds: string[],
  seedreamTaskId: string,
  hasWatermark: boolean
) {
  try {
    const tryOnRecord = await db
      .insert(virtualTryOn)
      .values({
        id: randomUUID(),
        userId,
        personImageUrl,
        clothingIds: clothingIds,
        seedreamTaskId,
        status: "pending",
        hasWatermark,
        creditsUsed: VIRTUAL_TRY_ON_CREDIT_COST,
      })
      .returning();

    return tryOnRecord[0];
  } catch (error) {
    console.error("Error creating try-on record:", error);
    throw error;
  }
}

/**
 * Update try-on record with result
 */
export async function updateVirtualTryOnResult(
  taskId: string,
  resultImageUrl: string
) {
  try {
    const updated = await db
      .update(virtualTryOn)
      .set({
        status: "completed",
        resultImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(virtualTryOn.seedreamTaskId, taskId))
      .returning();

    return updated[0];
  } catch (error) {
    console.error("Error updating try-on result:", error);
    throw error;
  }
}

/**
 * Mark try-on as failed
 */
export async function markTryOnFailed(taskId: string, errorMessage: string) {
  try {
    const updated = await db
      .update(virtualTryOn)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(virtualTryOn.seedreamTaskId, taskId))
      .returning();

    return updated[0];
  } catch (error) {
    console.error("Error marking try-on as failed:", error);
    throw error;
  }
}

/**
 * Get try-on history for user
 */
export async function getVirtualTryOnHistory(
  userId: string,
  limit = 10,
  offset = 0
) {
  try {
    const items = await db
      .select()
      .from(virtualTryOn)
      .where(eq(virtualTryOn.userId, userId))
      .orderBy(desc(virtualTryOn.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(virtualTryOn)
      .where(eq(virtualTryOn.userId, userId));

    return { items, total: Number(count) };
  } catch (error) {
    console.error("Error fetching try-on history:", error);
    throw error;
  }
}

/**
 * Delete try-on record
 */
export async function deleteVirtualTryOn(tryOnId: string, userId: string) {
  try {
    await db
      .delete(virtualTryOn)
      .where(
        and(
          eq(virtualTryOn.id, tryOnId),
          eq(virtualTryOn.userId, userId)
        )
      );
  } catch (error) {
    console.error("Error deleting try-on record:", error);
    throw error;
  }
}

/**
 * Get available clothing by category
 */
export async function getClothingByCategory(
  category: string,
  limit = 20,
  offset = 0
) {
  try {
    const items = await db
      .select()
      .from(clothing)
      .where(
        and(
          eq(clothing.category, category),
          eq(clothing.active, true)
        )
      )
      .limit(limit)
      .offset(offset);

    return items;
  } catch (error) {
    console.error("Error fetching clothing:", error);
    throw error;
  }
}
