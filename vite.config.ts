import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://127.0.0.1:3001", ws: true } } },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules") &&
            /three|react-three\/fiber|react-three\/drei/.test(id)
          )
            return "three";
          if (id.includes("rapier")) return "physics";
        },
      },
    },
  },
});
