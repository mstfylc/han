import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; it must be required at runtime, not
  // bundled — bundling breaks its .node binding lookup.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
