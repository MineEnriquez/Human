import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "server/**/*.test.ts"],
    // Tests never call the real Claude API.
    env: { ANTHROPIC_API_KEY: "" },
  },
});
