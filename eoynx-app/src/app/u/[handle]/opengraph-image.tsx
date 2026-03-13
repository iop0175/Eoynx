import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Profile";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function ProfileOGImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio, avatar_url")
    .eq("handle", handle)
    .single();

  // Fetch stats
  const { count: itemCount } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profile?.id || "")
    .eq("visibility", "public");

  const { count: followerCount } = await supabase
    .from("followers")
    .select("id", { count: "exact", head: true })
    .eq("following_id", profile?.id || "");

  const displayName = profile?.display_name || `@${handle}`;
  const bio = profile?.bio || "EOYNX Collection";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            opacity: 0.8,
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
              border: "4px solid rgba(255,255,255,0.2)",
            }}
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={displayName}
                width={152}
                height={152}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 64, color: "white" }}>
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Name */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              marginBottom: 8,
            }}
          >
            {displayName}
          </div>

          {/* Handle */}
          <div
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 24,
            }}
          >
            @{handle}
          </div>

          {/* Bio */}
          {bio && (
            <div
              style={{
                fontSize: 20,
                color: "rgba(255,255,255,0.6)",
                maxWidth: 600,
                textAlign: "center",
                marginBottom: 32,
                lineHeight: 1.4,
              }}
            >
              {bio.length > 100 ? bio.slice(0, 100) + "..." : bio}
            </div>
          )}

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 48,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "white" }}>{itemCount}</span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}>Items</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: "white" }}>{followerCount}</span>
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }}>Followers</span>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
            EOYNX
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
