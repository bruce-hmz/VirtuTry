export type BillingKind = "subscription" | "one_time";

export type PlanKey =
  | "starter_monthly"
  | "starter_yearly"
  | "pro_monthly"
  | "pro_yearly";

export type PackKey = "pack_200" | "tryon_10" | "tryon_50" | "tryon_100";

export type GrantScheduleConfig =
  | {
      mode: "per_cycle";
    }
  | {
      mode: "installments";
      grantsPerCycle: number;
      intervalMonths: number;
      creditsPerGrant?: number;
      initialGrants?: number;
    };

type SubscriptionPlan = {
  key: PlanKey;
  kind: "subscription";
  priceCents: number;
  currency: "usd";
  creditsPerCycle: number;
  cycle: "month" | "year";
  // To be filled when Creem IDs are available
  creemPriceId?: string;
  grantSchedule?: GrantScheduleConfig;
};

type OneTimePack = {
  key: PackKey;
  kind: "one_time";
  priceCents: number;
  currency: "usd";
  credits: number;
  creemPriceId?: string;
};

export const subscriptionPlans: Record<PlanKey, SubscriptionPlan> = {
  starter_monthly: {
    key: "starter_monthly",
    kind: "subscription",
    priceCents: 2900,
    currency: "usd",
    creditsPerCycle: 1000,
    cycle: "month",
    creemPriceId: "prod_KOmXB0HE59CxSgcnGSH3J",
    grantSchedule: { mode: "per_cycle" },
  },
  starter_yearly: {
    key: "starter_yearly",
    kind: "subscription",
    priceCents: 29000,
    currency: "usd",
    creditsPerCycle: 12000,
    cycle: "year",
    creemPriceId: "prod_2V1LbGt2bLmZpKgmASTiCN",
    grantSchedule: {
      mode: "installments",
      grantsPerCycle: 12,
      intervalMonths: 1,
      creditsPerGrant: 1000,
      initialGrants: 1,
    },
  },
  pro_monthly: {
    key: "pro_monthly",
    kind: "subscription",
    priceCents: 9900,
    currency: "usd",
    creditsPerCycle: 10000,
    cycle: "month",
    creemPriceId: "prod_6enLqYwSXuDE8XY5gNeavo",
    grantSchedule: { mode: "per_cycle" },
  },
  pro_yearly: {
    key: "pro_yearly",
    kind: "subscription",
    priceCents: 99000,
    currency: "usd",
    creditsPerCycle: 120000,
    cycle: "year",
    creemPriceId: "prod_2TAWEHwHg36KkU3YOS3sOV",
    grantSchedule: {
      mode: "installments",
      grantsPerCycle: 12,
      intervalMonths: 1,
      creditsPerGrant: 10000,
      initialGrants: 1,
    },
  },
};

export const oneTimePacks: Record<PackKey, OneTimePack> = {
  pack_200: {
    key: "pack_200",
    kind: "one_time",
    priceCents: 500,
    currency: "usd",
    credits: 200,
    creemPriceId: "prod_3SiroZeMbMQidMVFDMUzKy",
  },
  tryon_10: {
    key: "tryon_10",
    kind: "one_time",
    priceCents: 299,
    currency: "usd",
    credits: 500,
    creemPriceId: undefined,
  },
  tryon_50: {
    key: "tryon_50",
    kind: "one_time",
    priceCents: 1099,
    currency: "usd",
    credits: 2500,
    creemPriceId: undefined,
  },
  tryon_100: {
    key: "tryon_100",
    kind: "one_time",
    priceCents: 1899,
    currency: "usd",
    credits: 5000,
    creemPriceId: undefined,
  },
};

export const VIRTUAL_TRY_ON_PLANS = {
  free: {
    dailyQuota: 3,
    monthlyQuota: 90,
    maxClothingPerTry: 1,
    hasWatermark: true,
  },
  starter: {
    priceCents: 999,
    monthlyQuota: 200,
    maxClothingPerTry: 3,
    hasWatermark: false,
  },
  pro: {
    priceCents: 1999,
    monthlyQuota: 1000,
    maxClothingPerTry: 5,
    hasWatermark: false,
  },
} as const;

export function isSubscriptionKey(key: string): key is PlanKey {
  return (key as PlanKey) in subscriptionPlans;
}

export function isPackKey(key: string): key is PackKey {
  return (key as PackKey) in oneTimePacks;
}
