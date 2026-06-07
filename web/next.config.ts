import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.env.VERCEL ? __dirname : path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
