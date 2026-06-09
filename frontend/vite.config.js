import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit()],

  // Vite options tailored for Wails development
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
}));
