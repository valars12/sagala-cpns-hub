import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 5174,
  },
  plugins: [
    react(),
    legacy({
      targets: [
        "defaults",
        "not IE 11",
        "safari >= 13",
        "edge >= 88",
        "chrome >= 88",
        "firefox >= 78"
      ],
      modernPolyfills: true,
      renderLegacyChunks: true
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
