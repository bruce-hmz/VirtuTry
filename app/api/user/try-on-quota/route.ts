import { NextRequest, NextResponse } from "next/server";
import { getActiveSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { user as userTable, tryOnQuota } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const access = await getActiveSessionUser(request.headers);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const userId = access.user.id;
    const now = new Date();

    const quotas = await db
      .select()
      .from(tryOnQuota)
      .where(
        and(
          eq(tryOnQuota.userId, userId),
          gt(tryOnQuota.resetAt, now)
        )
      );

    const daily = quotas.find(q => q.quotaType === "daily");
    const monthly = quotas.find(q => q.quotaType === "monthly");

    const userData = await db
      .select({ credits: userTable.credits, planKey: userTable.planKey })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);

    return NextResponse.json({
      daily: daily ? {
        quotaLimit: daily.quotaLimit,
        quotaUsed: daily.quotaUsed,
        resetAt: daily.resetAt,
      } : { quotaLimit: 3, quotaUsed: 0 },
      monthly: monthly ? {
        quotaLimit: monthly.quotaLimit,
        quotaUsed: monthly.quotaUsed,
        resetAt: monthly.resetAt,
      } : { quotaLimit: 90, quotaUsed: 0 },
      credits: userData[0]?.credits ?? 0,
      planKey: userData[0]?.planKey ?? "free",
    });
  } catch (error) {
    console.error("Error fetching try-on quota:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
