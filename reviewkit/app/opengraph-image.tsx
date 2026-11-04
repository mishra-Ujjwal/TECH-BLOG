import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getSite } from "@/lib/site";

/**
 * The default share card, used by any page without a picture of its own.
 * ImageResponse cannot read CSS custom properties, so the colours below mirror the
 * brand tokens in app/globals.css (--brand-orange, --brand-navy). Change them together.
 */

export const alt = "TechWorld Blog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const site = getSite();
  const logo = `data:image/png;base64,${fs
    .readFileSync(path.join(process.cwd(), "public/brand/techworld-logo.png"))
    .toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ff6b2c",
          color: "#0e1424",
          padding: "64px 80px",
        }}
      >
        {/* The supplied logo on its own orange, 821 x 321 at source. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={site.name} width={460} height={180} style={{ marginLeft: -24, marginTop: -24 }} />
        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: "-0.035em",
            maxWidth: 980,
          }}
        >
          {site.tagline}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#0e1424",
            borderTop: "2px solid rgba(14, 20, 36, 0.25)",
            paddingTop: 28,
          }}
        >
          Measured, dated and signed by the person who tested it.
        </div>
      </div>
    ),
    size,
  );
}
