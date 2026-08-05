import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { deployKitPlugin } from "./vite-deploy-kit";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mcpPlugin(), deployKitPlugin()].filter(Boolean),
  resolve: {
    alias: [
      // ใช้ client แบบ runtime config (รองรับ Supabase self-hosted / เปลี่ยน backend หลัง deploy)
      {
        find: /^@\/integrations\/supabase\/client$/,
        replacement: path.resolve(__dirname, "./src/integrations/supabase/appClient.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },

  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/@tiptap/")) return "vendor-tiptap";
          // Do not manually split Recharts/d3. It has circular module edges that
          // can crash production builds with "Cannot access ... before initialization".
          if (id.includes("/jspdf") || id.includes("/html2canvas")) return "vendor-pdf";
          if (id.includes("/xlsx")) return "vendor-xlsx";
          if (id.includes("/leaflet")) return "vendor-map";
          if (id.includes("/@vladmandic/face-api")) return "vendor-face";
          if (id.includes("/react-router")) return "vendor-router";
          if (
            id.match(/\/react(-dom)?\//) &&
            !id.includes("react-hook-form") &&
            !id.includes("react-day-picker")
          )
            return "vendor-react";
        },
      },
    },
  },
}));
