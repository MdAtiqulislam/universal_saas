import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@universal/ui", "@universal/types"],
};

export default nextConfig;
