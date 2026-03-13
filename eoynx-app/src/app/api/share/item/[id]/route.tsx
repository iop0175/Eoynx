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
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Fetch item data
  const { data: item } = await supabase
    .from("items")
    .select(`
      id,
      title,
      description,
      image_url,
      brand,
      category,
      visibility,
      profiles(handle, display_name, avatar_url)
    `)
    .eq("id", id)
    .single();

  if (!item || item.visibility === "private") {
    return new Response("Item not found", { status: 404 });
  }

  // Fetch item value
  const { data: itemValue } = await supabase
    .from("item_values")
    .select("value_minor, currency")
    .eq("item_id", id)
    .single();

  const formattedValue = itemValue?.value_minor 
    ? `$${(itemValue.value_minor / 100).toLocaleString()}`
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner = item.profiles as any;
  const ownerName = owner?.display_name || `@${owner?.handle}` || "Unknown";
  const title = item.title || "Item";
  const description = item.description || "";

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
        }}
      >
        {/* Top branding */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "40px 80px",
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>
            EOYNX
          </span>
        </div>

        {/* Image area */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "0 60px",
            flex: 1,
            maxHeight: 900,
          }}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={title}
              width={960}
              height={800}
              style={{ 
                objectFit: "cover", 
                borderRadius: 32,
                border: "4px solid rgba(255,255,255,0.1)",
              }}
            />
          ) : (
            <div
              style={{
                width: 600,
                height: 600,
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 120,
              }}
            >
              📦
            </div>
          )}
        </div>

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "40px 80px",
          }}
        >
          {/* Category/Brand badges */}
          <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
            {item.brand && (
              <div
                style={{
                  backgroundColor: "rgba(124,58,237,0.3)",
                  color: "#a78bfa",
                  padding: "12px 24px",
                  borderRadius: 24,
                  fontSize: 24,
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
                  padding: "12px 24px",
                  borderRadius: 24,
                  fontSize: 24,
                }}
              >
                {item.category}
              </div>
            )}
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            {title.length > 40 ? title.slice(0, 40) + "..." : title}
          </div>

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: 26,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.4,
                marginBottom: 24,
              }}
            >
              {description.length > 100 ? description.slice(0, 100) + "..." : description}
            </div>
          )}

          {/* Value badge */}
          {formattedValue && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 32,
              }}
            >
              <div
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  padding: "16px 32px",
                  borderRadius: 20,
                  fontSize: 36,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                {formattedValue}
              </div>
            </div>
          )}

          {/* Owner info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginTop: "auto",
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                backgroundColor: "rgba(124,58,237,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {ownerName.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 26, color: "white", fontWeight: 500 }}>{ownerName}</span>
              <span style={{ fontSize: 20, color: "rgba(255,255,255,0.5)" }}>on EOYNX</span>
            </div>
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "24px 80px 48px",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: "12px 24px",
              fontSize: 22,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            eoynx.com/i/{id.slice(0, 8)}...
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
    }
  );
}
