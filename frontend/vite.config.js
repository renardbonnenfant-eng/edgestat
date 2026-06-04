import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En dev, /api est relayé vers le backend Express : le frontend ne connaît
// jamais l'URL ni la clé d'API-Football, seulement son propre backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
