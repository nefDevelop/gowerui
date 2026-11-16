import { get, writable } from "svelte/store";
import { mapThumbnails } from "$lib/api";

/**
 * Store de una lista paginada de wallpapers (feed o favoritos).
 *
 * La lógica vivía en `+page.svelte` y se movió sin cambios de comportamiento:
 * mismos topes de página, mismo criterio para enseñar el skeleton y las mismas
 * peticiones en paralelo. Lo que cambia entre feed y favoritos es el tamaño de
 * página y la función del CLI que se invoca.
 *
 * @param {object} options
 * @param {number} options.pageSize
 * @param {(page: number, limit: number, color: string, sort: string) => Promise<any[]>} options.fetchPage
 * @param {() => Promise<any[]>} options.fetchColors
 * @param {import("svelte/store").Readable<string>} options.color Store compartida del color seleccionado
 * @param {string} options.label Prefijo de los logs
 * @param {boolean} [options.guardConcurrentLoads] Favoritos ignora una carga si ya hay otra en curso
 */
export function createWallpaperListStore({
  pageSize,
  fetchPage,
  fetchColors,
  color,
  label,
  guardConcurrentLoads = false,
}) {
  const store = writable({
    /** @type {any[]} */
    items: [],
    page: 1,
    sort: "Smart",
    /** @type {string[]} */
    colors: [],
    loading: false,
  });

  const { subscribe, update } = store;

  // Fuera del store: la UI no necesita la ruta de caché, solo la usan las
  // miniaturas. Evita re-renders por un dato que no se pinta.
  let cachePath = "";

  // Identifica la última carga lanzada. Una respuesta que llegue después de
  // otra más reciente se descarta: con la rueda o los eventos de background
  // hay peticiones solapadas, y sin esto una respuesta vieja podía pisar la
  // lista buena.
  let requestToken = 0;

  /**
   * Sin cachePath no se pueden construir las miniaturas, así que las cargas
   * anteriores al AppContext se descartan (antes se comprobaba `appContext`).
   * @param {string} path
   */
  function setCachePath(path) {
    cachePath = path || "";
  }

  /** @param {string} sort */
  function setSort(sort) {
    update((state) => ({ ...state, sort }));
  }

  /**
   * El spinner de la rejilla también se usa al aplicar a todos los monitores,
   * que no carga ninguna página.
   * @param {boolean} value
   */
  function setLoading(value) {
    update((state) => ({ ...state, loading: Boolean(value) }));
  }

  /**
   * Elimina un item de la lista sin recargar, para el feedback optimista de
   * bloquear/borrar.
   * @param {any} id
   */
  function remove(id) {
    update((state) => ({
      ...state,
      items: state.items.filter((item) => item.id !== id),
    }));
  }

  /**
   * @param {{reset?: boolean, skipColors?: boolean, page?: number}} [options]
   */
  async function load({ reset = false, skipColors = false, page } = {}) {
    const state = get(store);

    if (!cachePath) return;
    if (guardConcurrentLoads && state.loading) return;

    const token = ++requestToken;
    const targetPage = reset ? 1 : (page ?? state.page);

    if (targetPage !== state.page) {
      update((current) => ({ ...current, page: targetPage }));
    }
    // Solo se enseña el skeleton si no hay nada que pintar: recargar una lista
    // ya visible no debe parpadear.
    if (state.items.length === 0) {
      update((current) => ({ ...current, loading: true }));
    }

    try {
      const tasks = [
        fetchPage(targetPage, pageSize, get(color), state.sort.toLowerCase()),
      ];
      if (!skipColors) {
        tasks.push(fetchColors());
      }

      const [result, colorsResult] = await Promise.all(tasks);

      // Llegó una carga posterior mientras esta estaba en vuelo: manda la
      // última y esta respuesta ya no interesa.
      if (token !== requestToken) return;

      update((current) => ({
        ...current,
        items: mapThumbnails(result || [], cachePath),
        colors:
          !skipColors && Array.isArray(colorsResult)
            ? colorsResult
            : current.colors,
      }));
      console.log(`[${label}] Lista cargada. Items:`, get(store).items.length);
    } catch (e) {
      if (token !== requestToken) return;
      console.error(`[${label}] Error al cargar la lista:`, e);
    } finally {
      // Solo la petición vigente apaga el spinner.
      if (token === requestToken) {
        update((current) => ({ ...current, loading: false }));
      }
    }
  }

  return { subscribe, load, setCachePath, setSort, setLoading, remove };
}
