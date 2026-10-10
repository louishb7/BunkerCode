import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("/@codemirror/state/") ||
            id.includes("/@codemirror/view/")
          )
            return "code-editor-core";
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.BUNKERCODE_API_URL ?? "http://127.0.0.1:3001",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
