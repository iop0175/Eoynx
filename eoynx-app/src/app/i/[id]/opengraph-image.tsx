import { ImageResponse } from "next/og";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "edge";
export const alt = "Item";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function ItemOGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch item data
  const { data: item } = await supabase
    .from("items")
    .select(`
      title,
      description,
      image_url,
      brand,
      category,
      visibility,
      profiles(handle, display_name)
    `)
    .eq("id", id)
    .single();

  // Don't show OG for private items
  if (!item || item.visibility === "private") {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            fontSize: 48,
            color: "white",
          }}
        >
          EOYNX
        </div>
      ),
      { ...size }
    );
  }

  const title = item.title || "Item";
  const description = item.description || "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner = item.profiles as any;
  const ownerName = owner?.display_name || `@${owner?.handle}` || "Unknown";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          backgroundColor: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Left side - Image */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          }}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={title}
              width={500}
              height={500}
              style={{ objectFit: "cover", borderRadius: 16 }}
            />
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
              }}
            >
              📦
            </div>
          )}
        </div>

        {/* Right side - Info */}
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 48,
            background: "linear-gradient(135deg, #16213e 0%, #0f3460 100%)",
          }}
        >
          {/* Category/Brand badges */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            {item.brand && (
              <div
                style={{
                  backgroundColor: "rgba(124,58,237,0.3)",
                  color: "#a78bfa",
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {item.brand}
              </div>
            )}
            {item.category && (
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.7)",
                  padding: "8px 16px",
                  borderRadius: 20,
                  fontSize: 16,
                }}
              >
                {item.category}
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "white",
              marginBottom: 16,
              lineHeight: 1.2,
            }}
          >
            {title.length > 50 ? title.slice(0, 50) + "..." : title}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: 20,
                color: "rgba(255,255,255,0.6)",
                marginBottom: 32,
                lineHeight: 1.4,
              }}
            >
              {description.length > 120 ? description.slice(0, 120) + "..." : description}
            </div>
          )}

          {/* Owner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: "auto",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {ownerName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 18, color: "white", fontWeight: 500 }}>{ownerName}</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>on EOYNX</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
