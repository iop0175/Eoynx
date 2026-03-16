import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";

const SIZE = { width: 1080, height: 1920 };

function computeTopPercentile(currentValue: number, values: number[]): number {
  if (values.length === 0) return 50;
  const lowerCount = values.filter((v) => v < currentValue).length;
  const percentile = (lowerCount / values.length) * 100;
  return Math.max(1, Math.round(100 - percentile));
}

function calcAgeFromBirthDate(birthDate: string): number | null {
  const dob = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  if (age < 0 || age > 120) return null;
  return age;
}

function ageGroupFromBirthDate(birthDate: string | null): { key: string; label: string } | null {
  if (!birthDate) return null;
  const age = calcAgeFromBirthDate(birthDate);
  if (age === null) return null;
  const start = Math.floor(age / 10) * 10;
  const end = start + 9;
  return { key: `${start}-${end}`, label: `${start}-${end}` };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,handle,display_name,birth_date,country_code")
    .eq("handle", handle)
    .maybeSingle();

  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  const { data: allItems } = await supabase
    .from("items")
    .select("owner_id,item_values(value_minor)")
    .eq("visibility", "public");

  const userTotals: Record<string, number> = {};
  for (const item of allItems ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (item.item_values as any[])?.[0]?.value_minor ?? 0;
    userTotals[item.owner_id] = (userTotals[item.owner_id] ?? 0) + value;
  }

  const ownerIds = Object.keys(userTotals);
  const userValue = userTotals[profile.id] ?? 0;
  const overallPercentile = computeTopPercentile(userValue, Object.values(userTotals));

  const { data: ownerProfiles } = ownerIds.length
    ? await supabase.from("profiles").select("id,birth_date,country_code").in("id", ownerIds)
    : { data: [] as Array<{ id: string; birth_date: string | null; country_code: string | null }> };

  const meAgeGroup = ageGroupFromBirthDate(profile.birth_date ?? null);
  const meCountryCode = (profile.country_code ?? null)?.toUpperCase() ?? null;
  const sameAgeValues: number[] = [];
  const sameCountryValues: number[] = [];

  for (const p of ownerProfiles ?? []) {
    const total = userTotals[p.id];
    if (total === undefined) continue;
    if (meAgeGroup && ageGroupFromBirthDate(p.birth_date ?? null)?.key === meAgeGroup.key) {
      sameAgeValues.push(total);
    }
    if (meCountryCode && (p.country_code ?? "").toUpperCase() === meCountryCode) {
      sameCountryValues.push(total);
    }
  }

  const ranking = {
    overallPercentile,
    ageGroupPercentile: meAgeGroup ? computeTopPercentile(userValue, sameAgeValues) : null,
    countryPercentile: meCountryCode ? computeTopPercentile(userValue, sameCountryValues) : null,
    ageGroupLabel: meAgeGroup?.label ?? null,
    countryCode: meCountryCode,
  };
  const displayName = profile.display_name ?? `@${profile.handle}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 72,
          background: "linear-gradient(160deg, #0a0a0a 0%, #111827 45%, #1f2937 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.65, marginBottom: 24 }}>EOYNX Ranking Card</div>
        <div style={{ fontSize: 64, fontWeight: 800, marginBottom: 8 }}>{displayName}</div>
        <div style={{ fontSize: 32, opacity: 0.7, marginBottom: 36 }}>@{profile.handle}</div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            borderRadius: 28,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            padding: 36,
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 22, opacity: 0.72 }}>Global</div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1 }}>Top {ranking.overallPercentile}%</div>

          <div style={{ marginTop: 20, fontSize: 22, opacity: 0.72 }}>
            Similar age ({ranking.ageGroupLabel ?? "N/A"})
          </div>
          <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1 }}>
            {ranking.ageGroupPercentile ? `Top ${ranking.ageGroupPercentile}%` : "N/A"}
          </div>

          <div style={{ marginTop: 20, fontSize: 22, opacity: 0.72 }}>
            Country ({ranking.countryCode ?? "N/A"})
          </div>
          <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1 }}>
            {ranking.countryPercentile ? `Top ${ranking.countryPercentile}%` : "N/A"}
          </div>
        </div>

        <div style={{ marginTop: "auto", fontSize: 28, opacity: 0.62 }}>
          eoynx.com/u/{profile.handle}
        </div>
      </div>
    ),
    SIZE
  );
}
