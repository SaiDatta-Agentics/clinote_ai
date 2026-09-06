import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext()],
  build: {
    rolldownOptions: {
      // Cloudflare bindings are only loaded on the Cloudflare runtime. Keep the
      // module unresolved in the Azure bundle; Azure reads process.env instead.
      external: ["cloudflare:workers"],
    },
  },
});
