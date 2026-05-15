import { describe, it, expect } from "vitest";

describe("VirtualTryOn Constants", () => {
  it("has correct credit cost", async () => {
    const { VIRTUAL_TRY_ON_CREDIT_COST } = await import("@/lib/virtualtry");
    expect(VIRTUAL_TRY_ON_CREDIT_COST).toBe(50);
  });

  it("has correct quota limits for free tier", async () => {
    const { QUOTA_LIMITS } = await import("@/lib/virtualtry");
    expect(QUOTA_LIMITS.free.daily).toBe(3);
    expect(QUOTA_LIMITS.free.monthly).toBe(90);
  });

  it("has correct quota limits for paid tier", async () => {
    const { QUOTA_LIMITS } = await import("@/lib/virtualtry");
    expect(QUOTA_LIMITS.paid.daily).toBe(Infinity);
    expect(QUOTA_LIMITS.paid.monthly).toBe(200);
  });

  it("has correct max clothing per try-on", async () => {
    const { MAX_CLOTHING_PER_TRY_ON } = await import("@/lib/virtualtry");
    expect(MAX_CLOTHING_PER_TRY_ON.free).toBe(1);
    expect(MAX_CLOTHING_PER_TRY_ON.paid).toBe(3);
  });
});

describe("VIRTUAL_TRY_ON_PLANS from billing config", () => {
  it("matches PRD spec for free plan", async () => {
    const { VIRTUAL_TRY_ON_PLANS } = await import("@/constants/billing");
    expect(VIRTUAL_TRY_ON_PLANS.free.dailyQuota).toBe(3);
    expect(VIRTUAL_TRY_ON_PLANS.free.monthlyQuota).toBe(90);
    expect(VIRTUAL_TRY_ON_PLANS.free.maxClothingPerTry).toBe(1);
    expect(VIRTUAL_TRY_ON_PLANS.free.hasWatermark).toBe(true);
  });

  it("matches PRD spec for starter plan", async () => {
    const { VIRTUAL_TRY_ON_PLANS } = await import("@/constants/billing");
    expect(VIRTUAL_TRY_ON_PLANS.starter.priceCents).toBe(999);
    expect(VIRTUAL_TRY_ON_PLANS.starter.monthlyQuota).toBe(200);
    expect(VIRTUAL_TRY_ON_PLANS.starter.maxClothingPerTry).toBe(3);
    expect(VIRTUAL_TRY_ON_PLANS.starter.hasWatermark).toBe(false);
  });

  it("matches PRD spec for pro plan", async () => {
    const { VIRTUAL_TRY_ON_PLANS } = await import("@/constants/billing");
    expect(VIRTUAL_TRY_ON_PLANS.pro.priceCents).toBe(1999);
    expect(VIRTUAL_TRY_ON_PLANS.pro.monthlyQuota).toBe(1000);
    expect(VIRTUAL_TRY_ON_PLANS.pro.maxClothingPerTry).toBe(5);
    expect(VIRTUAL_TRY_ON_PLANS.pro.hasWatermark).toBe(false);
  });
});
