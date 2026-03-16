"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PercentileResult = {
  overallPercentile: number;
  categoryPercentiles: Record<string, number>;
  totalValue: number;
  itemCount: number;
};

export type DemographicPercentileResult = {
  overallPercentile: number;
  ageGroupPercentile: number | null;
  countryPercentile: number | null;
  ageGroupLabel: string | null;
  countryCode: string | null;
  totalValue: number;
  itemCount: number;
  ageGroupSampleSize: number;
  countrySampleSize: number;
};

type OwnerTotals = {
  userTotals: Record<string, number>;
  userCategoryTotals: Record<string, Record<string, number>>;
  itemCountByOwner: Record<string, number>;
};

function computeTopPercentile(currentValue: number, values: number[]): number {
  if (values.length === 0) return 50;
  const usersWithLowerValue = values.filter((v) => v < currentValue).length;
  const percentile = (usersWithLowerValue / values.length) * 100;
  return Math.max(1, Math.round(100 - percentile));
}

function calcAgeFromBirthDate(birthDate: string): number | null {
  const dob = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

function ageGroupFromBirthDate(birthDate: string | null): { key: string; label: string } | null {
  if (!birthDate) return null;
  const age = calcAgeFromBirthDate(birthDate);
  if (age === null) return null;
  const start = Math.floor(age / 10) * 10;
  const end = start + 9;
  return {
    key: `${start}-${end}`,
    label: `${start}-${end}`,
  };
}

async function getOwnerTotals(): Promise<OwnerTotals> {
  const supabase = await createSupabaseServerClient();
  const { data: allUsersItems } = await supabase
    .from("items")
    .select(`
      owner_id,
      category,
      item_values(value_minor)
    `)
    .eq("visibility", "public");

  const userTotals: Record<string, number> = {};
  const userCategoryTotals: Record<string, Record<string, number>> = {};
  const itemCountByOwner: Record<string, number> = {};

  (allUsersItems ?? []).forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = item.item_values as any[];
    const itemValue = values?.[0]?.value_minor ?? 0;
    const ownerId = item.owner_id;

    userTotals[ownerId] = (userTotals[ownerId] ?? 0) + itemValue;
    itemCountByOwner[ownerId] = (itemCountByOwner[ownerId] ?? 0) + 1;

    if (item.category) {
      if (!userCategoryTotals[ownerId]) {
        userCategoryTotals[ownerId] = {};
      }
      userCategoryTotals[ownerId][item.category] =
        (userCategoryTotals[ownerId][item.category] ?? 0) + itemValue;
    }
  });

  return { userTotals, userCategoryTotals, itemCountByOwner };
}

export async function calculateUserPercentile(userId: string): Promise<PercentileResult> {
  const supabase = await createSupabaseServerClient();
  const { userTotals, userCategoryTotals, itemCountByOwner } = await getOwnerTotals();

  const userTotalValue = userTotals[userId] ?? 0;
  const allValues = Object.values(userTotals);
  const totalUsers = allValues.length;

  if (totalUsers === 0) {
    return {
      overallPercentile: 50,
      categoryPercentiles: {},
      totalValue: userTotalValue,
      itemCount: itemCountByOwner[userId] ?? 0,
    };
  }

  // Get category totals for current user
  const { data: userItems } = await supabase
    .from("items")
    .select(`
      id,
      category,
      item_values(value_minor)
    `)
    .eq("owner_id", userId)
    .eq("visibility", "public");

  const categoryValues: Record<string, number> = {};
  (userItems ?? []).forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = item.item_values as any[];
    const itemValue = values?.[0]?.value_minor ?? 0;
    if (item.category) {
      categoryValues[item.category] = (categoryValues[item.category] ?? 0) + itemValue;
    }
  });

  const topPercentile = computeTopPercentile(userTotalValue, allValues);

  const categoryPercentiles: Record<string, number> = {};
  const categories = ["luxury", "accessories", "cars", "real-estate"];

  for (const category of categories) {
    const categoryUserValues = Object.entries(userCategoryTotals)
      .filter(([, cats]) => (cats[category] ?? 0) > 0)
      .map(([, cats]) => cats[category]);

    if (categoryUserValues.length === 0) {
      categoryPercentiles[category] = 50;
      continue;
    }

    const userCatValue = categoryValues[category] ?? 0;
    categoryPercentiles[category] = computeTopPercentile(userCatValue, categoryUserValues);
  }

  return {
    overallPercentile: topPercentile,
    categoryPercentiles,
    totalValue: userTotalValue,
    itemCount: itemCountByOwner[userId] ?? 0,
  };
}

export async function calculateUserDemographicPercentiles(
  userId: string
): Promise<DemographicPercentileResult> {
  const supabase = await createSupabaseServerClient();
  const { userTotals, itemCountByOwner } = await getOwnerTotals();

  const ownerIds = Object.keys(userTotals);
  const userTotalValue = userTotals[userId] ?? 0;
  const overallPercentile = computeTopPercentile(userTotalValue, Object.values(userTotals));

  if (ownerIds.length === 0) {
    return {
      overallPercentile,
      ageGroupPercentile: null,
      countryPercentile: null,
      ageGroupLabel: null,
      countryCode: null,
      totalValue: userTotalValue,
      itemCount: 0,
      ageGroupSampleSize: 0,
      countrySampleSize: 0,
    };
  }

  const [{ data: me }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("id,birth_date,country_code").eq("id", userId).maybeSingle(),
    supabase.from("profiles").select("id,birth_date,country_code").in("id", ownerIds),
  ]);

  const meAgeGroup = ageGroupFromBirthDate(me?.birth_date ?? null);
  const meCountryCode = (me?.country_code ?? null)?.toUpperCase() ?? null;

  const ageGroupValues: number[] = [];
  const countryValues: number[] = [];

  for (const profile of profiles ?? []) {
    const ownerTotal = userTotals[profile.id];
    if (ownerTotal === undefined) continue;

    const ageGroup = ageGroupFromBirthDate(profile.birth_date ?? null);
    if (meAgeGroup && ageGroup?.key === meAgeGroup.key) {
      ageGroupValues.push(ownerTotal);
    }

    const cc = (profile.country_code ?? null)?.toUpperCase() ?? null;
    if (meCountryCode && cc === meCountryCode) {
      countryValues.push(ownerTotal);
    }
  }

  return {
    overallPercentile,
    ageGroupPercentile: meAgeGroup ? computeTopPercentile(userTotalValue, ageGroupValues) : null,
    countryPercentile: meCountryCode ? computeTopPercentile(userTotalValue, countryValues) : null,
    ageGroupLabel: meAgeGroup?.label ?? null,
    countryCode: meCountryCode,
    totalValue: userTotalValue,
    itemCount: itemCountByOwner[userId] ?? 0,
    ageGroupSampleSize: ageGroupValues.length,
    countrySampleSize: countryValues.length,
  };
}

export async function getDisplayPercentile(userId: string): Promise<number> {
  const result = await calculateUserPercentile(userId);
  return result.overallPercentile;
}

export async function calculateItemCountPercentile(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  const { count: userItemCount } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("visibility", "public");

  const { data: allCounts } = await supabase
    .from("items")
    .select("owner_id")
    .eq("visibility", "public");

  const userCounts: Record<string, number> = {};
  (allCounts ?? []).forEach((item) => {
    userCounts[item.owner_id] = (userCounts[item.owner_id] ?? 0) + 1;
  });

  const allItemCounts = Object.values(userCounts);
  if (allItemCounts.length === 0) return 50;

  return computeTopPercentile(userItemCount ?? 0, allItemCounts);
}
