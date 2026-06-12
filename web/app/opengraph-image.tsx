import { ImageResponse } from "next/og";

export const alt = "Sigma — on-chain portfolio VaR for tokenized equities on Robinhood Chain";
export const size = { width: 1200, height: 630 };
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
          padding: 72,
          backgroundColor: "#0a0c0f",
          backgroundImage:
            "linear-gradient(#232a31 1px, transparent 1px), linear-gradient(90deg, #232a31 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          color: "#e7ecf0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              border: "2px solid #00e599",
              color: "#00e599",
              fontSize: 40,
            }}
          >
            Σ
          </div>
          <div style={{ fontSize: 34, letterSpacing: 6, textTransform: "uppercase" }}>Sigma</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            On-chain portfolio VaR for tokenized equity collateral.
          </div>
          <div style={{ fontSize: 30, color: "#8b97a3", maxWidth: 980 }}>
            A Stylus risk engine prices the whole portfolio inside every borrow — and a
            policy-bound agent acts on it, with rationale recorded on-chain.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24 }}>
          {["Robinhood Chain", "Arbitrum Stylus", "Policy-bound agent"].map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                padding: "10px 22px",
                border: "1px solid #232a31",
                backgroundColor: "#121519",
                color: "#00e599",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
