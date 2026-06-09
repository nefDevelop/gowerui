// Wails requires adapter-static with a fallback to index.html for SPA mode
import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      fallback: "index.html",
    }),
    paths: {
      relative: true,
    },
  },
};

export default config;
