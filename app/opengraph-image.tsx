import { ImageResponse } from "next/og";

// Next.js picks this file up automatically and adds the og:image tag for you.
export const alt = "Silk Road";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
          color: "#17171C",
        }}
      >
        <div style={{ display: "flex", fontSize: 130, fontWeight: 700, color: "#6C4FF6" }}>
          Silk Road
        </div>
        <div style={{ display: "flex", fontSize: 44, color: "#6B6B76", marginTop: 24 }}>
          Meet people on campus
        </div>
      </div>
    ),
    { ...size }
  );
}
