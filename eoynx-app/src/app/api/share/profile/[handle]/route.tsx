import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export const runtime = "edge";

// 9:16 aspect ratio for stories/reels
const SIZE = {
  width: 1080,
  height: 1920,
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, avatar_url")
    .eq("handle", handle)
    .single();

  if (!profile) {
    return new Response("Profile not found", { status: 404 });
  }

  // Fetch stats
  const [{ count: itemCount }, { count: followerCount }] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("visibility", "public"),
    supabase
      .from("followers")
      .select("id", { count: "exact", head: true })
      .eq("following_id", profile.id),
  ]);

  // Calculate total value
  const { data: itemValues } = await supabase
    .from("items")
    .select("item_values(value_minor)")
    .eq("owner_id", profile.id)
    .eq("visibility", "public");

  let totalValue = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (itemValues ?? []).forEach((item: any) => {
    const values = item.item_values;
    if (values?.[0]?.value_minor) {
      totalValue += values[0].value_minor;
    }
  });

  // Format value (convert from minor units to major, e.g., cents to dollars)
  const formattedValue = totalValue > 0 
    ? `$${(totalValue / 100).toLocaleString()}`
    : "—";

  const displayName = profile.display_name || `@${handle}`;
  const bio = profile.bio || "EOYNX Collector";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: 80,
        }}
      >
        {/* Top branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 60,
          }}
        >
          <span style={{ fontSize: 36, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
            EOYNX
          </span>
        </div>

        {/* Avatar */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 48,
          }}
        >
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "6px solid rgba(255,255,255,0.2)",
            }}
          >
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                width={228}
                height={228}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 96, color: "white" }}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.6)",
              marginTop: 8,
            }}
          >
            @{handle}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.5)",
              textAlign: "center",
              marginBottom: 60,
              lineHeight: 1.4,
              maxWidth: 800,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {bio.length > 100 ? bio.slice(0, 100) + "..." : bio}
          </div>
        )}

        {/* Stats cards */}
        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            marginTop: "auto",
            marginBottom: 80,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: "32px 48px",
              minWidth: 180,
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: "white" }}>
              {itemCount ?? 0}
            </span>
            <span style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
              Items
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 24,
              padding: "32px 48px",
              minWidth: 180,
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: "white" }}>
              {followerCount ?? 0}
            </span>
            <span style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
              Followers
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              background: "rgba(124,58,237,0.3)",
              borderRadius: 24,
              padding: "32px 48px",
              minWidth: 180,
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 700, color: "#a78bfa" }}>
              {formattedValue}
            </span>
            <span style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>
              Total Value
            </span>
          </div>
        </div>

        {/* QR/Link hint */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "16px 32px",
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            eoynx.com/u/{handle}
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
    }
  );
}
