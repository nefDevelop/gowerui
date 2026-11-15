import { get, writable } from "svelte/store";

export const SEARCH_STORAGE_KEY = "gower_search_data";
/** Una búsqueda guardada caduca a los 15 minutos, incluso entre sesiones. */
export const SEARCH_TTL_MS = 15 * 60 * 1000;

/**
 * Sesión de búsqueda: resultados, paginación, proveedor y su persistencia en
 * localStorage.
 *
 * La lógica vivía en `+page.svelte` (un `$effect` para guardar, un bloque en
 * `onMount` para restaurar y una comprobación de caducidad en el efecto de
 * pestaña). Ahora está aquí y se puede testear con un reloj y un storage
 * inyectados.
 *
 * @param {object} [options]
 * @param {Storage} [options.storage]
 * @param {() => number} [options.now]
 * @param {number} [options.ttl]
 */
export function createSearchSession({
  storage = globalThis.localStorage,
  now = () => Date.now(),
  ttl = SEARCH_TTL_MS,
} = {}) {
  /** @type {import("svelte/store").Writable<any[]>} */
  const results = writable([]);
  const query = writable("");
  const page = writable(1);
  const provider = writable("wallhaven");
  const lastSearchTime = writable(0);

  function clearStorage() {
    if (storage) storage.removeItem(SEARCH_STORAGE_KEY);
  }

  /**
   * Serializa el estado actual. Solo se guarda si hubo una búsqueda: una
   * sesión virgen no debe escribir basura en localStorage.
   */
  function persist() {
    if (!storage) return;
    if (get(lastSearchTime) <= 0) return;

    storage.setItem(
      SEARCH_STORAGE_KEY,
      JSON.stringify({
        searchResults: get(results),
        searchQuery: get(query),
        searchPage: get(page),
        selectedProvider: get(provider),
        lastSearchTime: get(lastSearchTime),
      }),
    );
  }

  // Guardado automático: cualquier cambio en estos cinco valores se persiste,
  // igual que hacía el `$effect` de la página.
  const unsubscribers = [results, query, page, provider, lastSearchTime].map(
    (store) => store.subscribe(() => persist()),
  );

  /**
   * Restaura una búsqueda guardada si no ha caducado.
   * @returns {boolean} true si se restauró
   */
  function restore() {
    if (!storage) return false;

    const saved = storage.getItem(SEARCH_STORAGE_KEY);
    if (!saved) return false;

    /** @type {any} */
    let data;
    try {
      data = JSON.parse(saved);
    } catch {
      // Un JSON corrupto no puede tumbar el arranque de la app.
      clearStorage();
      return false;
    }

    if (!data || typeof data.lastSearchTime !== "number") {
      clearStorage();
      return false;
    }
    if (now() - data.lastSearchTime >= ttl) {
      clearStorage();
      return false;
    }

    // Los resultados guardados antes de que existiera `origin` se aplicarían
    // por id y gower respondería "wallpaper not found".
    const restored = (data.searchResults || []).map((item) => ({
      ...item,
      origin: item.origin || "search",
    }));

    results.set(restored);
    query.set(data.searchQuery || "");
    page.set(data.searchPage || 1);
    provider.set(data.selectedProvider || "wallhaven");
    lastSearchTime.set(data.lastSearchTime);
    return true;
  }

  /**
   * Descarta la búsqueda si superó el TTL. Devuelve true si la ha limpiado.
   */
  function expire() {
    const last = get(lastSearchTime);
    if (last <= 0 || now() - last <= ttl) return false;

    results.set([]);
    query.set("");
    page.set(1);
    lastSearchTime.set(0);
    clearStorage();
    return true;
  }

  /** Libera las suscripciones de guardado (útil en tests y al desmontar). */
  function dispose() {
    for (const unsubscribe of unsubscribers) unsubscribe();
  }

  return {
    results,
    query,
    page,
    provider,
    lastSearchTime,
    restore,
    persist,
    expire,
    dispose,
  };
}
