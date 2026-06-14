import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules") && /react|react-dom|framer-motion/.test(id)) {
            return "vendor";
          }
          return null;
        },
      },
    },
  },
  publicDir: "public",
});
