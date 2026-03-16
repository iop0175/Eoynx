import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "EOYNX";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          color: "#0f172a",
          background:
            "radial-gradient(circle at 12% 20%, #fde68a 0%, transparent 38%), radial-gradient(circle at 88% 8%, #5eead4 0%, transparent 30%), linear-gradient(160deg, #fffbeb 0%, #f8fafc 100%)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 2, fontWeight: 700 }}>EOYNX</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>
            Public Luxury Collections
          </div>
          <div style={{ fontSize: 30, color: "#334155" }}>
            SEO-first profiles, share-ready item pages, verified value context.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
