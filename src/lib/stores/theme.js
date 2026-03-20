import { writable, derived } from "svelte/store";

/**
 * @typedef {'light' | 'dark' | 'system'} Theme
 */

function createThemeStore() {
  // 1. Get saved theme from localStorage or default to 'system' (or 'dark' as safe fallback)
  /** @type {Theme} */
  const savedTheme = typeof localStorage !== "undefined" ? /** @type {Theme} */ (localStorage.getItem("gower-theme")) : "system";

  const initialTheme = savedTheme || "system";

  const { subscribe, set, update } = writable(initialTheme);

  return {
    subscribe,
    /** @param {Theme} t */
    set: (t) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gower-theme", t);
      }
      // Update the document class immediately
      updateDOM(t);
      set(t);
    },
    toggle: () => {
      update((current) => {
        // Simple toggle for the navbar button: Light -> Dark -> Light (ignoring system for the toggle button to keep it simple, or maybe cycle?)
        // If system, we determine what it resolves to and flip it.
        // Actually, the plan says we replace the toggle with a selector in settings.
        // But for the navbar quick toggle, we might want to keep it simple:
        // If current is 'light' -> go 'dark'. Else -> go 'light'.
        // This effectively overrides 'system' if used.
        const newTheme = current === "light" ? "dark" : "light";
        localStorage.setItem("gower-theme", newTheme);
        updateDOM(newTheme);
        return newTheme;
      });
    },
  };
}

/**
 * @param {Theme} theme
 */
function updateDOM(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const isSystem = theme === "system";

  let effectiveTheme = theme;
  if (isSystem) {
    const systemLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    effectiveTheme = systemLight ? "light" : "dark";
  }

  if (effectiveTheme === "light") {
    root.classList.add("light-theme");
    root.classList.remove("dark-theme");
  } else {
    root.classList.add("dark-theme");
    root.classList.remove("light-theme");
  }

  // console.log(`[Theme] Applies: ${effectiveTheme} (Mode: ${theme})`);
}

export const theme = createThemeStore();

// Initialize listener for system changes if mode is system
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    // We only care if the current store value is 'system'
    // But we can't easily access the store value here without subscribing.
    // A cleaner way is to re-run updateDOM if the store is 'system'.
    // For simplicity, we can just check localStorage or let the store handle it if we want to be purely reactive.
    // Let's just blindly updateDOM with the current storage value if it's system.
    const current = localStorage.getItem("gower-theme");
    if (current === "system") {
      updateDOM("system");
    }
  });
}
