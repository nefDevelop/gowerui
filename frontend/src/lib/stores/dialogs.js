import { writable } from "svelte/store";

// Geometría del menú contextual. La ventana mide 440x750, pero los límites de
// 480x800 son los que decidían el volteo: se conservan tal cual para no mover
// el menú de sitio.
const MENU_WIDTH = 160;
const MENU_HEIGHT = 120;
const LIMIT_WIDTH = 480;
const LIMIT_HEIGHT = 800;

/**
 * Calcula la posición del menú contextual para que no se salga de la ventana.
 * Es una función pura para poder testear los dos volteos sin montar la página.
 *
 * @param {number} x
 * @param {number} y
 * @param {object} [bounds]
 * @param {number} [bounds.menuWidth]
 * @param {number} [bounds.menuHeight]
 * @param {number} [bounds.limitWidth]
 * @param {number} [bounds.limitHeight]
 */
export function positionContextMenu(
  x,
  y,
  {
    menuWidth = MENU_WIDTH,
    menuHeight = MENU_HEIGHT,
    limitWidth = LIMIT_WIDTH,
    limitHeight = LIMIT_HEIGHT,
  } = {},
) {
  return {
    x: x + menuWidth > limitWidth ? x - menuWidth : x,
    y: y + menuHeight > limitHeight ? y - menuHeight : y,
  };
}

/**
 * Estado de los diálogos y del menú contextual de la página.
 *
 * Antes eran cinco `$state` sueltos y el menú se mutaba con
 * `contextMenu.open = false`; con un store hay que usar `update`, porque mutar
 * el objeto no notifica a los suscriptores.
 */
export function createDialogState() {
  /** @type {import("svelte/store").Writable<any|null>} */
  const previewItem = writable(null);
  const previewOpen = writable(false);
  const contextMenu = writable({ open: false, x: 0, y: 0, item: null });
  const deleteOpen = writable(false);
  /** @type {import("svelte/store").Writable<any|null>} */
  const itemToDelete = writable(null);

  return {
    previewItem,
    previewOpen,
    contextMenu,
    deleteOpen,
    itemToDelete,

    /** @param {any} item */
    openPreview(item) {
      previewItem.set(item);
      previewOpen.set(true);
    },

    /** Oculta el modal pero conserva el item, como antes. */
    closePreview() {
      previewOpen.set(false);
    },

    /**
     * @param {any} item
     * @param {number} x
     * @param {number} y
     */
    openContextMenu(item, x, y) {
      const position = positionContextMenu(x, y);
      contextMenu.set({
        open: true,
        x: position.x,
        y: position.y,
        item,
      });
    },

    closeContextMenu() {
      contextMenu.update((state) => ({ ...state, open: false }));
    },

    /** @param {any} item */
    requestDelete(item) {
      itemToDelete.set(item);
      deleteOpen.set(true);
    },

    closeDelete() {
      deleteOpen.set(false);
    },
  };
}
