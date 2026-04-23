import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/siteUrl";

/** Public marketing and legal pages only. */
const PUBLIC_PATHS = [
  "/",
  "/about",
  "/pricing",
  "/features",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified,
  }));
}
