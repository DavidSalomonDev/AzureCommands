import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite 8 resolves the `@/*` alias from tsconfig.json natively, so no
  // `vite-tsconfig-paths` plugin is needed.
  resolve: { tsconfigPaths: true },
  test: {
    // The suite covers pure logic, so it runs in Node. The one file that
    // needs a browser (the localStorage repository) opts into jsdom with a
    // `@vitest-environment` docblock.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
