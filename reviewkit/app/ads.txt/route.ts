import { getSite } from "@/lib/site";

/**
 * ads.txt, generated from content/site.json so there is one place to change it.
 * Google will not serve ads at scale without this file once you are approved.
 */
export const dynamic = "force-static";

export function GET() {
  const site = getSite();
  const lines: string[] = [];

  if (site.adsense.publisherId) {
    // ads.txt wants the pub- form, not the ca-pub- form used in the ad tag.
    const pub = site.adsense.publisherId.replace(/^ca-/, "");
    lines.push(`google.com, ${pub}, DIRECT, f08c47fec0942fa0`);
  } else {
    lines.push("# No AdSense publisher ID set yet.");
    lines.push("# Add it to content/site.json as adsense.publisherId once you are approved.");
  }

  for (const extra of site.adsTxtExtra) lines.push(extra);

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
