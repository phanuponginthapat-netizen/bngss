import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { deployKitPlugin } from "./vite-deploy-kit";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ["bngss.lovable.app", "localhost", ".lovableproject.com", ".lovable.app"],
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" ? deployKitPlugin() : null].filter(Boolean),
  optimizeDeps: {
    exclude: ["capacitor-apk-updater"],
  },
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
          if (id.includes("/jspdf") || id.includes("/html2canvas")) return "vendor-pdf";
          if (id.includes("/xlsx")) return "vendor-xlsx";
          if (id.includes("/leaflet")) return "vendor-map";
          if (id.includes("/recharts") || id.includes("/d3-")) return "vendor-charts";
          if (id.includes("/@tanstack/")) return "vendor-query";
          if (id.includes("/@vladmandic/face-api")) return "vendor-face";
          if (id.includes("/@tensorflow/tfjs")) return "vendor-tfjs";
          if (id.includes("/face-api") || id.includes("/faceapi")) return "vendor-face";
          if (id.includes("/react-router")) return "vendor-router";
          if (id.includes("/radix-ui")) return "vendor-radix";
          if (id.includes("/sonner") || id.includes("/lucide")) return "vendor-ui";
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
