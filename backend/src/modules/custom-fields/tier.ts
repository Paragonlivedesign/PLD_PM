export type TierName = "starter" | "professional" | "enterprise";

export type TierLimits = {
  maxFieldsPerEntityType: number;
  maxSearchableFieldsPerEntityType: number;
  maxSelectOptionsPerField: number;
};

const TIERS: Record<TierName, TierLimits> = {
  starter: { maxFieldsPerEntityType: 10, maxSearchableFieldsPerEntityType: 3, maxSelectOptionsPerField: 20 },
  professional: {
    maxFieldsPerEntityType: 50,
    maxSearchableFieldsPerEntityType: 15,
    maxSelectOptionsPerField: 100,
  },
  enterprise: {
    maxFieldsPerEntityType: 200,
    maxSearchableFieldsPerEntityType: 50,
    maxSelectOptionsPerField: 500,
  },
};

export function getTenantTier(): TierName {
  const raw = (process.env.PLD_TENANT_TIER ?? "professional").toLowerCase();
  if (raw === "starter" || raw === "professional" || raw === "enterprise") return raw;
  return "professional";
}

export function getTierLimits(tier: TierName = getTenantTier()): TierLimits {
  return TIERS[tier];
}
