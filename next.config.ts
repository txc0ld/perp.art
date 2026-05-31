import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't infer a parent
  // directory when multiple lockfiles exist on the machine.
  turbopack: {
    root: __dirname,
    resolveAlias: {
      // wagmi's optional "tempo" connector dynamic-imports a package named
      // "accounts" that we don't use; alias it to an empty stub so the
      // bundler can resolve it (the connector is never instantiated).
      accounts: "./src/lib/web3/empty-module.ts",
    },
  },
};

export default nextConfig;
