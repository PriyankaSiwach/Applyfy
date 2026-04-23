import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/siteUrl";

/** Public marketing and product entry pages (HTML). */
const PATHS: string[] = [
  "/",
  "/about",
  "/pricing",
  "/features",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/roadmap",
  "/analyze",
  "/match",
  "/cover",
  "/interview",
  "/sign-in",
  "/sign-up",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();
  return PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified,
  }));
}
