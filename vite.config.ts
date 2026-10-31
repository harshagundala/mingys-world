import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.MINGY_LOCAL_PORT || 4101}`,
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    // Let route imports define shared chunks. Manual vendor groups recursively
    // pulled Rapier into the shared renderer, making both games download it.
  },
});
