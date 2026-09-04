import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  transpilePackages: ["@livelecture/shared"],
};

export default nextConfig;
