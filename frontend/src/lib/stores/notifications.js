import { writable } from "svelte/store";

/**
 * @typedef {'info' | 'success' | 'error' | 'warning'} ToastType
 * @typedef {{id: string, message: string, type: ToastType}} Toast
 */

/** Tiempo por defecto hasta la auto-eliminación de un toast. */
const DEFAULT_TIMEOUT = 3000;

function createNotificationStore() {
  /** @type {import('svelte/store').Writable<Toast[]>} */
  const { subscribe, update } = writable([]);

  /**
   * Temporizadores vivos, indexados por id de toast. Necesarios para poder
   * cancelar la eliminación programada cuando el toast se actualiza: si no, el
   * temporizador del mensaje anterior lo borraría antes de tiempo.
   *
   * @type {Map<string, ReturnType<typeof setTimeout>>}
   */
  const timers = new Map();

  /**
   * Cancela el temporizador pendiente de un toast, si lo hay.
   * @param {string} id
   */
  function clearTimer(id) {
    const handle = timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.delete(id);
    }
  }

  /**
   * Programa la eliminación de un toast. Con timeout <= 0 lo deja fijo, que es
   * lo que se usa para toasts que el llamante va a mutar después.
   *
   * @param {string} id
   * @param {number} timeout
   */
  function scheduleRemoval(id, timeout) {
    clearTimer(id);
    if (timeout > 0) {
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          update((n) => n.filter((t) => t.id !== id));
        }, timeout),
      );
    }
  }

  return {
    subscribe,
    /**
     * Añade un toast y devuelve su id, para poder actualizarlo o quitarlo más
     * tarde en lugar de apilar otro.
     *
     * @param {string} message
     * @param {ToastType} [type]
     * @param {number} [timeout] ms hasta la auto-eliminación; 0 lo deja fijo
     * @returns {string} el id del toast creado
     */
    add: (message, type = "info", timeout = DEFAULT_TIMEOUT) => {
      const id = crypto.randomUUID();
      update((n) => [...n, { id, message, type }]);
      scheduleRemoval(id, timeout);
      return id;
    },
    /**
     * Sustituye el mensaje (y opcionalmente el tipo) de un toast existente, y
     * rearma su temporizador de eliminación. Devuelve false si el id ya no está
     * en la lista.
     *
     * @param {string} id
     * @param {string} message
     * @param {ToastType} [type]
     * @param {number} [timeout]
     * @returns {boolean}
     */
    update: (id, message, type, timeout = DEFAULT_TIMEOUT) => {
      let found = false;

      update((n) =>
        n.map((t) => {
          if (t.id !== id) return t;
          found = true;
          return type === undefined
            ? { ...t, message }
            : { ...t, message, type };
        }),
      );

      if (!found) return false;

      scheduleRemoval(id, timeout);
      return true;
    },
    /**
     * @param {string} id
     * @returns {boolean} true si el toast existía y se ha eliminado
     */
    remove: (id) => {
      clearTimer(id);
      let removed = false;
      update((n) => {
        removed = n.some((t) => t.id === id);
        return n.filter((t) => t.id !== id);
      });
      return removed;
    },
  };
}

export const notifications = createNotificationStore();
