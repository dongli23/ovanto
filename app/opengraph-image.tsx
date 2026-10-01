import { ImageResponse } from "next/og";

export const alt = "Ovanto AI creative tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f5f8f4",
          color: "#162023",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "86px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ alignItems: "center", display: "flex", gap: 16 }}>
            <div
              style={{
                background: "#ef7f63",
                borderRadius: "999px 999px 999px 4px",
                height: 34,
                transform: "rotate(-18deg)",
                width: 34,
              }}
            />
            <span style={{ fontSize: 38, fontWeight: 800 }}>Ovanto</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1.04,
            }}
          >
            <span>Make the idea</span>
            <span>visible.</span>
          </div>
          <div style={{ color: "#647176", fontSize: 25 }}>AI creative tools, right in your browser.</div>
        </div>
        <div
          style={{
            background: "#cfeee0",
            borderRadius: 44,
            height: 320,
            transform: "rotate(8deg)",
            width: 270,
          }}
        />
      </div>
    ),
    size,
  );
}
