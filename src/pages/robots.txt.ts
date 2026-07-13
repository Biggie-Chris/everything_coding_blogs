import { site } from "@config/site";

export async function GET() {
  const body = ["User-agent: *", "Allow: /", "", `Sitemap: ${site.siteUrl}/sitemap-index.xml`].join(
    "\n",
  );

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
