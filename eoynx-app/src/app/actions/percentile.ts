"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PercentileResult = {
  overallPercentile: number;
  categoryPercentiles: Record<string, number>;
  totalValue: number;
  itemCount: number;
};

/**
 * Calculate percentile ranking for a user based on their total collection value
 * 
 * Percentile = (Number of users with lower value / Total users) * 100
 * Top X% = 100 - Percentile (lower is better, meaning higher value)
 */
export async function calculateUserPercentile(userId: string): Promise<PercentileResult> {
  const supabase = await createSupabaseServerClient();

  // Get all users' total values (from item_values table)
  // For now, we'll use a simplified approach: count items * estimated value
  // In production, this would use actual item_values
  
  // Get user's items with values
  const { data: userItems } = await supabase
    .from("items")
    .select(`
      id,
      category,
      item_values(value_minor)
    `)
    .eq("owner_id", userId)
    .eq("visibility", "public");

  // Calculate user's total value
  let userTotalValue = 0;
  const categoryValues: Record<string, number> = {};

  (userItems ?? []).forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = item.item_values as any[];
    const itemValue = values?.[0]?.value_minor ?? 0;
    userTotalValue += itemValue;

    if (item.category) {
      categoryValues[item.category] = (categoryValues[item.category] ?? 0) + itemValue;
    }
  });

  // Get all users' total values for comparison
  const { data: allUsersItems } = await supabase
    .from("items")
    .select(`
      owner_id,
      category,
      item_values(value_minor)
    `)
    .eq("visibility", "public");

  // Aggregate by user
  const userTotals: Record<string, number> = {};
  const userCategoryTotals: Record<string, Record<string, number>> = {};

  (allUsersItems ?? []).forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = item.item_values as any[];
    const itemValue = values?.[0]?.value_minor ?? 0;
    
    const ownerId = item.owner_id;
    userTotals[ownerId] = (userTotals[ownerId] ?? 0) + itemValue;

    if (item.category) {
      if (!userCategoryTotals[ownerId]) {
        userCategoryTotals[ownerId] = {};
      }
      userCategoryTotals[ownerId][item.category] = 
        (userCategoryTotals[ownerId][item.category] ?? 0) + itemValue;
    }
  });

  // Calculate overall percentile
  const allValues = Object.values(userTotals);
  const totalUsers = allValues.length;

  if (totalUsers === 0) {
    return {
      overallPercentile: 50,
      categoryPercentiles: {},
      totalValue: userTotalValue,
      itemCount: userItems?.length ?? 0,
    };
  }

  // Count users with lower total value
  const usersWithLowerValue = allValues.filter((v) => v < userTotalValue).length;
  
  // Percentile (higher is better - user has higher value than X% of users)
  const percentile = (usersWithLowerValue / totalUsers) * 100;
  
  // Top X% (lower number = better ranking)
  // If percentile is 90, user is in Top 10%
  const topPercentile = Math.max(1, Math.round(100 - percentile));

  // Calculate category percentiles
  const categoryPercentiles: Record<string, number> = {};
  const categories = ["luxury", "accessories", "cars", "real-estate"];

  for (const category of categories) {
    const categoryUserValues = Object.entries(userCategoryTotals)
      .filter(([, cats]) => cats[category] > 0)
      .map(([, cats]) => cats[category]);

    if (categoryUserValues.length === 0) {
      categoryPercentiles[category] = 50;
      continue;
    }

    const userCatValue = categoryValues[category] ?? 0;
    const lowerCount = categoryUserValues.filter((v) => v < userCatValue).length;
    const catPercentile = (lowerCount / categoryUserValues.length) * 100;
    categoryPercentiles[category] = Math.max(1, Math.round(100 - catPercentile));
  }

  return {
    overallPercentile: topPercentile,
    categoryPercentiles,
    totalValue: userTotalValue,
    itemCount: userItems?.length ?? 0,
  };
}

/**
 * Get percentile for display (simplified version for profile cards)
 */
export async function getDisplayPercentile(userId: string): Promise<number> {
  const result = await calculateUserPercentile(userId);
  return result.overallPercentile;
}

/**
 * Calculate percentile based on item count only (fallback when no values)
 */
export async function calculateItemCountPercentile(userId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();

  // Get user's item count
  const { count: userItemCount } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("visibility", "public");

  // Get all users' item counts
  const { data: allCounts } = await supabase
    .from("items")
    .select("owner_id")
    .eq("visibility", "public");

  // Count items per user
  const userCounts: Record<string, number> = {};
  (allCounts ?? []).forEach((item) => {
    userCounts[item.owner_id] = (userCounts[item.owner_id] ?? 0) + 1;
  });

  const allItemCounts = Object.values(userCounts);
  const totalUsers = allItemCounts.length;

  if (totalUsers === 0) return 50;

  const currentUserCount = userItemCount ?? 0;
  const lowerCount = allItemCounts.filter((c) => c < currentUserCount).length;
  const percentile = (lowerCount / totalUsers) * 100;

  return Math.max(1, Math.round(100 - percentile));
}
