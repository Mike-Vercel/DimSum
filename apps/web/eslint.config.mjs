import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Production build used by the end-to-end tests, and their reports.
    ".next-e2e/**",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    // Vendored MapLibre bundles copied from node_modules at build time.
    "public/maplibre/**",
  ]),
  {
    // Playwright fixtures receive a `use` callback that is not a React hook.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
]);

export default eslintConfig;
