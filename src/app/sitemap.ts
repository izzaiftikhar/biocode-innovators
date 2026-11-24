
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const publicPages = [
    "",
    "/research",
    "/courses",
    "/fellowship",
    "/student-journal",
    "/internships",
    "/community",
    "/updates",
    "/about",
    "/faq",
    "/contact",
    "/founder",
  ];

  return publicPages.map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
