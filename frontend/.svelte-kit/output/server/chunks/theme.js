import { w as writable } from "./index.js";
function createNotificationStore() {
  const { subscribe, update } = writable([]);
  return {
    subscribe,
    /**
     * @param {string} message
     * @param {'info' | 'success' | 'error' | 'warning'} type
     * @param {number} timeout
     */
    add: (message, type = "info", timeout = 3e3) => {
      const id = crypto.randomUUID();
      update((n) => [...n, { id, message, type }]);
      if (timeout > 0) {
        setTimeout(() => {
          update((n) => n.filter((t) => t.id !== id));
        }, timeout);
      }
    },
    /** @param {string} id */
    remove: (id) => update((n) => n.filter((t) => t.id !== id))
  };
}
const notifications = createNotificationStore();
function createThemeStore() {
  const savedTheme = typeof localStorage !== "undefined" ? (
    /** @type {Theme} */
    localStorage.getItem("gower-theme")
  ) : "system";
  const initialTheme = savedTheme || "system";
  const { subscribe, set, update } = writable(initialTheme);
  return {
    subscribe,
    /** @param {Theme} t */
    set: (t) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("gower-theme", t);
      }
      updateDOM(t);
      set(t);
    },
    toggle: () => {
      update((current) => {
        const newTheme = current === "light" ? "dark" : "light";
        localStorage.setItem("gower-theme", newTheme);
        updateDOM(newTheme);
        return newTheme;
      });
    }
  };
}
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
}
createThemeStore();
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
    const current = localStorage.getItem("gower-theme");
    if (current === "system") {
      updateDOM("system");
    }
  });
}
export {
  notifications as n
};
