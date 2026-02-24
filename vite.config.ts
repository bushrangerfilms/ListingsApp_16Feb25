import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    strictPort: true,
    hmr: {
      clientPort: 443,
    },
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React + router (shared by all routes)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching layer
          'vendor-query': ['@tanstack/react-query'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Charts (only used in analytics/admin pages)
          'vendor-charts': ['recharts'],
          // Drag-and-drop (only used in CRM kanban)
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
}));
