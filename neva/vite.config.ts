import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi } from "./server/api";

// In dev, the /api routes run inside the Vite server so `npm run dev` is the only command.
// In production, server/index.ts serves dist/ and the same handlers.
export default defineConfig({
  plugins: [
    react(),
    {
      name: "neva-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          handleApi(req, res).catch(next);
        });
      },
    },
  ],
});
