import { defineConfig } from "vitest/config";

export default defineConfig({
  // fixtures/ and the template live one level up, next to the tools that build them
  server: { host: true, fs: { allow: [".."] } },
  test: { include: ["tests/**/*.test.ts"] },
});
