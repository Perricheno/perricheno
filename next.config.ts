import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  
  // Skip type checking in production builds (faster CI/CD)
  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_TYPE_CHECK === 'true',
  },
  
  // Disable source maps in production for faster builds
  productionBrowserSourceMaps: false,
  
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
};

export default nextConfig;
