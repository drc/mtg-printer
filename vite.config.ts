import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  server: { allowedHosts: [".trycloudflare.com"] },
  test: { environment: "node" },
});
