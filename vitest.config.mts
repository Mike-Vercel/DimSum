import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@/": `${path.join(root, "apps/web/src")}/`,
      // Server modules guard against client bundling with "server-only"; plain Node is fine.
      "server-only": path.join(root, "apps/web/test/empty-module.ts"),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/web/src/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
});
