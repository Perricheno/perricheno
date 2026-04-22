import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  
  // Skip type checking in production builds (faster CI/CD)
  // Type checking is done separately in CI
  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_TYPE_CHECK === 'true',
  },
  
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
};

export default nextConfig;
