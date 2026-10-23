import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vitest/config";

// getUserMedia (the mounted-phone scanner) only works in a secure context, so the
// dev server is https by default. The certificate is self-signed: the phone shows
// a warning once, accept it. Use HTTP=1 to serve plain http for UI work.
const https = process.env.HTTP ? undefined : {};

export default defineConfig({
  // relative asset URLs: the built app works at / on a phone LAN server and at
  // /omr/ on GitHub Pages, with no base-path flag
  base: "./",
  plugins: process.env.HTTP ? [] : [basicSsl()],
  server: {
    host: true,
    https,
    fs: { allow: [".."] },
  },
  test: { include: ["tests/**/*.test.ts"] },
});
