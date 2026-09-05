import type { MetadataRoute } from "next";

/** Personal deployment — robots noindex until public (product spec §59). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
