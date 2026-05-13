import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000", // ← port de votre backend
        pathname: "/uploads/**",
      },
    ],
  },
};

export default nextConfig;
