import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_TYPE_CHECK === "true",
  },

  productionBrowserSourceMaps: false,

  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
};

export default withNextIntl(nextConfig);
