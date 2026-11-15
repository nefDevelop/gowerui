import { gower } from "$lib/api";
import { createWallpaperListStore } from "./wallpaper-list";

/**
 * Feed de la pestaña Home. Se piden 10 items para pintar 9: el extra es el
 * buffer que evita que la última fila quede coja mientras llega la siguiente
 * página.
 *
 * @param {{color: import("svelte/store").Readable<string>}} options
 */
export function createFeedStore({ color }) {
  return createWallpaperListStore({
    label: "feed",
    pageSize: 10,
    fetchPage: gower.getFeed,
    fetchColors: gower.getFeedColors,
    color,
  });
}

/**
 * Favoritos del usuario. La página es de 9 porque aquí no hay buffer.
 *
 * @param {{color: import("svelte/store").Readable<string>}} options
 */
export function createFavoritesStore({ color }) {
  return createWallpaperListStore({
    label: "favorites",
    pageSize: 9,
    fetchPage: gower.getFavorites,
    fetchColors: gower.getFavoritesColors,
    color,
    // Una carga de favoritos en curso ya va a traer la lista completa; otra
    // simultánea solo duplicaría peticiones (comportamiento previo).
    guardConcurrentLoads: true,
  });
}
