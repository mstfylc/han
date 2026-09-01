import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` opens sockets and loads its own optional native accelerator at
  // runtime; bundling it into the server build breaks both. External means the
  // deployed image requires it from node_modules, the way node expects.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
