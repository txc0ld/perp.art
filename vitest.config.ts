import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "src/*" path alias for vitest.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` resolves to its throwing client variant under vitest's
      // default conditions; in the real Next server runtime it's a no-op. Stub
      // it so server modules (e.g. the LogLedger relayer) are unit-testable.
      "server-only": fileURLToPath(new URL("./src/lib/web3/empty-module.ts", import.meta.url)),
    },
  },
});
