import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` opens sockets and loads its own optional native accelerator at
  // runtime; bundling it into the server build breaks both. External means the
  // deployed image requires it from node_modules, the way node expects.
  serverExternalPackages: ["pg"],

  // db/schema.sql is read at runtime, through a path built at runtime, so the
  // build tracer cannot see it. On a server that is harmless — the file is
  // simply there. In a serverless bundle only traced files are shipped, and
  // the first API call would die with ENOENT. Naming it here ships it.
  outputFileTracingIncludes: {
    "/api/**": ["./db/schema.sql"],
  },
};

export default nextConfig;
