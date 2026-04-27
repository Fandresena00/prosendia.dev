import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://vendeo.ai";

  return {
    rules: [
      {
        // Main crawlers — full access to public pages
        userAgent: [
          "Googlebot",
          "Bingbot",
          "DuckDuckBot",
          "Slurp",
          "Baiduspider",
        ],
        allow: ["/", "/terms", "/privacy", "/sign-in", "/sign-up"],
        disallow: [
          "/dashboard",
          "/inbox",
          "/posts-comments",
          "/business-profile",
          "/analytics",
          "/accounts",
          "/settings",
          "/billing",
          "/api/",
          "/_next/",
          "/static/",
        ],
        crawlDelay: 1,
      },
      {
        // AI training crawlers — block all
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "CCBot",
          "anthropic-ai",
          "Claude-Web",
          "cohere-ai",
          "Bytespider",
          "Amazonbot",
          "PerplexityBot",
        ],
        disallow: ["/"],
      },
      {
        // SEO / archival bots — public pages only, no crawl delay
        userAgent: ["ia_archiver", "Screaming Frog SEO Spider"],
        allow: ["/", "/terms", "/privacy"],
        disallow: ["/api/", "/_next/", "/dashboard", "/inbox"],
      },
      {
        // Everyone else — same as main policy
        userAgent: "*",
        allow: ["/", "/terms", "/privacy", "/sign-in", "/sign-up"],
        disallow: [
          "/dashboard",
          "/inbox",
          "/posts-comments",
          "/products",
          "/analytics",
          "/ai-settings",
          "/accounts",
          "/settings",
          "/billing",
          "/api/",
          "/_next/",
          "/static/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
