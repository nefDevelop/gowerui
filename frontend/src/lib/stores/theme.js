import { writable } from "svelte/store";

/**
 * @typedef {'light' | 'dark' | 'system'} Theme
 */

const STORAGE_KEY = "gower-theme";
const LIGHT_QUERY = "(prefers-color-scheme: light)";
/** @type {Set<string>} */
const VALID_THEMES = new Set(["light", "dark", "system"]);

/**
 * Lee el tema guardado. Un valor ausente o desconocido cae en `system`: la
 * app debe seguir al escritorio salvo que el usuario haya elegido otra cosa.
 *
 * @returns {Theme}
 */
function readStoredTheme() {
  if (typeof localStorage === "undefined") return "system";

  const saved = localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.has(saved ?? "") ? /** @type {Theme} */ (saved) : "system";
}

/**
 * Tema efectivo que está aplicando el escritorio en este momento.
 *
 * @returns {'light' | 'dark'}
 */
function systemTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }

  return window.matchMedia(LIGHT_QUERY).matches ? "light" : "dark";
}

/**
 * Pinta el tema en el documento. `system` se resuelve contra
 * `prefers-color-scheme`, que es lo que expone el escritorio a la webview.
 *
 * @param {Theme} theme
 */
function updateDOM(theme) {
  if (typeof document === "undefined") return;

  const effective = theme === "system" ? systemTheme() : theme;
  const root = document.documentElement;

  root.classList.toggle("light-theme", effective === "light");
  root.classList.toggle("dark-theme", effective === "dark");
}

function createThemeStore() {
  /** @type {Theme} */
  let mode = readStoredTheme();

  const { subscribe, set } = writable(mode);

  /**
   * Aplica y persiste un tema. El arranque no persiste: solo lo hace una
   * elección explícita del usuario.
   *
   * @param {Theme} next
   */
  function apply(next) {
    mode = next;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next);
    }
    updateDOM(next);
    set(next);
  }

  // Aplicar antes de devolver el store: la primera pintura ya sale con el
  // tema correcto y no hay parpadeo de oscuro a claro.
  updateDOM(mode);

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const media = window.matchMedia(LIGHT_QUERY);
    const onSystemChange = () => {
      // Con una elección manual (light/dark) el escritorio no manda.
      if (mode === "system") updateDOM(mode);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onSystemChange);
    } else if (typeof media.addListener === "function") {
      // WebKitGTK antiguo: MediaQueryList no implementa addEventListener.
      media.addListener(onSystemChange);
    }
  }

  return {
    subscribe,
    /** @param {Theme} t */
    set: apply,
    toggle: () => {
      // Se alterna respecto al tema efectivo, no al valor guardado: si el
      // sistema está en claro y el modo es `system`, el botón va a oscuro.
      const effective = mode === "system" ? systemTheme() : mode;
      apply(effective === "light" ? "dark" : "light");
    },
  };
}

export const theme = createThemeStore();
