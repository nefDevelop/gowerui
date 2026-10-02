import { notifications } from "./stores/notifications";

/**
 * Escanea desde `start` hasta el carácter de cierre que balancea el de apertura,
 * respetando cadenas y escapes, e intenta parsear el trozo resultante.
 *
 * @param {string} text
 * @param {number} start índice del carácter de apertura
 * @param {'{' | '['} open
 * @returns {any | null} el valor parseado, o null si no cierra bien o no es JSON válido
 */
function scanBalancedJson(text, start, open) {
  const closer = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    // Contamos los dos tipos de corchete: el candidato puede empezar por uno y
    // anidar el otro (p. ej. un objeto con un array dentro).
    if (ch === "{" || ch === "[") {
      depth++;
      continue;
    }

    if (ch === "}" || ch === "]") {
      depth--;
      if (depth > 0) continue;

      // Si el primer cierre no corresponde al tipo de apertura, el candidato es
      // basura (por ejemplo la "[DEBUG]" de un log): lo descartamos.
      if (ch !== closer) return null;

      try {
        return JSON.parse(text.substring(start, i + 1));
      } catch {
        return null;
      }
    }
  }

  return null; // JSON truncado
}

/**
 * Extrae un JSON de un texto que puede contener otros contenidos (logs del CLI,
 * mensajes de error...). Devuelve null si no hay ningún JSON válido.
 *
 * No basta con buscar el primer '{' o '[': el CLI suele anteponer logs como
 * "[DEBUG] ...", y ese corchete no abre un array. Por eso se prueban todos los
 * candidatos en orden de aparición y se devuelve el primero que parsea.
 *
 * @param {string} text
 * @returns {any | null}
 */
function extractJson(text) {
  if (typeof text !== "string") return text;

  let braceIdx = text.indexOf("{");
  let bracketIdx = text.indexOf("[");

  while (braceIdx !== -1 || bracketIdx !== -1) {
    const useBrace = braceIdx !== -1 && (bracketIdx === -1 || braceIdx < bracketIdx);
    const open = /** @type {'{' | '['} */ (useBrace ? "{" : "[");
    const idx = useBrace ? braceIdx : bracketIdx;

    // Avanzamos el puntero del candidato elegido antes de escanear para no
    // quedarnos bloqueados en el mismo índice si este falla.
    if (useBrace) braceIdx = text.indexOf("{", idx + 1);
    else bracketIdx = text.indexOf("[", idx + 1);

    const parsed = scanBalancedJson(text, idx, open);
    if (parsed !== null) return parsed;
  }

  return null;
}

/**
 * Runs a gower CLI command and returns the output as a parsed object if possible.
 * @param {string[]} args
 * @param {boolean} [silent]
 * @param {boolean} [background]
 * @returns {Promise<any>}
 */
export async function runGower(args, silent = false, background = false) {
  const startTime = Date.now();
  try {
    // @ts-ignore
    const result = await window.go.main.App.RunGowerCommand(args, background);

    if (background) return result; // Usually "Backgrounded"

    return extractJson(result) || result;
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[GOWER] Command failed (${duration}ms):`, args, e);

    if (!silent) {
      const err = /** @type {any} */ (e);
      const msg = typeof err === "string" ? err : err.message || "Error desconocido";
      notifications.add(`Error: ${msg}`, "error", 5000);
    }

    throw e;
  }
}

/**
 * Gets the application context (paths, etc.)
 */
export async function getAppContext() {
  // @ts-ignore
  return await window.go.main.App.GetAppContext();
}

/**
 * Checks if the system has a battery.
 */
export async function checkBattery() {
  // @ts-ignore
  return await window.go.main.App.CheckBattery();
}

/**
 * Checks if a file exists at the given path.
 * @param {string} path
 */
export async function checkFileExists(path) {
  // @ts-ignore
  return await window.go.main.App.CheckFileExists(path);
}

/**
 * Maps items to include the correct thumbnail URL for Wails.
 * @param {any[]} items
 * @param {string} cachePath
 * @returns {any[]}
 */
export function mapThumbnails(items, cachePath) {
  if (!items) return [];
  return items.map((item) => {
    const newItem = { ...item };

    // Priority: thumbnail -> url -> path (absolute) -> id/ext (cache)
    let thumbnailSource = newItem.thumbnail || newItem.url || newItem.path || "";

    if (thumbnailSource.startsWith("http") || thumbnailSource.startsWith("data:")) {
      newItem.thumbnail = thumbnailSource;
    } else if (
      thumbnailSource !== "" &&
      (thumbnailSource.startsWith("/") || thumbnailSource.startsWith("C:\\") || thumbnailSource.startsWith("\\"))
    ) {
      // Use Wails AssetHandler prefix
      newItem.thumbnail = `/local-asset/${thumbnailSource}`;
      newItem.path = thumbnailSource;
    } else if (item.id && item.ext) {
      // Use cache fallback
      const ext = item.ext.startsWith(".") ? item.ext : `.${item.ext}`;
      const fullPath = `${cachePath}/thumbs/${item.id}${ext}`;
      newItem.thumbnail = `/local-asset/${fullPath}`;
      newItem.path = fullPath;
    } else {
      newItem.thumbnail = "";
    }

    return newItem;
  });
}

/**
 * Normalizes an item ID for consistent comparison.
 * @param {string | number} id
 * @returns {string}
 */
export function normalizeId(id) {
  return String(id).trim();
}

/**
 * Common gower commands mapped to easy-to-use functions.
 */
export const gower = {
  getStatus: () => runGower(["status", "--json"]),
  getFeed: (page = 1, limit = 9, color = "", sort = "smart") => {
    const args = ["feed", "show", "--page", String(page), "--limit", String(limit), "--sort", sort, "--json"];
    if (color) args.push("--color", color.replace("#", ""));
    return runGower(args);
  },
  /**
   * @param {string} idOrUrl
   * @param {string} [monitor]
   */
  setWallpaper: (idOrUrl, monitor = "") => {
    const args = ["set", idOrUrl];
    if (monitor) args.push("--target-monitor", monitor);
    return runGower(args, false, true); // Background
  },
  /**
   * @param {string} [monitor]
   */
  setRandom: (monitor = "") => {
    const args = ["set", "random"];
    if (monitor) args.push("--target-monitor", monitor);
    return runGower(args, false, true);
  },
  updateFeed: () => runGower(["feed", "update"], false, true), // Background
  /**
   * @param {string} [color]
   * @param {number} [page]
   * @param {number} [limit]
   * @param {string} [sort]
   */
  getFavorites: (page = 1, limit = 9, color = "", sort = "smart") => {
    const args = ["favorites", "list", "--page", String(page), "--limit", String(limit), "--json"];
    if (color) args.push("--color", color.replace("#", "")); // Color is optional
    return runGower(args);
  },
  /** @param {string} id */
  addFavorite: (id) => runGower(["favorites", "add", id], false, false),
  /** @param {string} id */
  removeFavorite: (id) => runGower(["favorites", "remove", id], false, false),
  /** @param {string} id */
  blacklist: (id) => runGower(["blacklist", "add", id], false, false),
  /** @param {string} id */
  download: (id) => runGower(["download", id, "--to-collection"], false, true),
  /**
   * @param {string} text
   * @param {string} provider
   * @param {number} [page]
   */
  search: (text, provider, page = 1) => {
    const args = ["explore", text, "--provider", provider.toLowerCase(), "--page", String(page), "--json"];
    return runGower(args);
  },
  getDaemonStatus: () => runGower(["daemon", "status", "--json"], true),
  getConfig: () => runGower(["config", "show", "--json"], true),
  /**
   * @param {string} key
   * @param {any} value
   */
  setConfig: (key, value) => {
    return runGower(["config", "set", `${key}=${value}`]);
  },
  /** @param {boolean} enable */
  toggleDaemon: async (enable) => {
    const cmd = ["daemon", enable ? "start" : "stop"];
    try {
      const response = await runGower(cmd);
      return response;
    } catch (e) {
      throw e;
    }
  },

  /**
   * @param {string} name
   * @param {string} url
   * @param {string} key
   */
  addProvider: (name, url, key) => {
    const args = ["config", "provider", "add", name, url];
    if (key) args.push(key);
    return runGower(args);
  },

  /** @param {string} name */
  removeProvider: (name) => runGower(["config", "provider", "remove", name]),

  /**
   * @param {string} subreddit
   * @param {string} sort
   */
  addRedditProvider: (subreddit, sort) => {
    const name = `reddit-${subreddit}`;
    const url = `https://www.reddit.com/r/${subreddit}/${sort}/.json`;
    return runGower(["config", "provider", "add", name, url]);
  },
  getCurrentWallpapers: () => runGower(["status", "--wallpapers", "--json"]),
  getMonitors: () => runGower(["status", "--monitors", "--json"], true),
  getFeedColors: () => runGower(["feed", "get", "colors", "--json"], true),
  getFavoritesColors: () => runGower(["favorites", "get", "colors", "--json"], true),
  /** @param {string} id */
  deleteWallpaper: (id) => runGower(["wallpaper", id, "--delete", "--file", "--force"], false, false),
  undoWallpaper: () => runGower(["set", "undo"], false, true),
  /** @param {string} pathOrUrl */
  openPath: async (pathOrUrl) => {
    // @ts-ignore
    return await window.go.main.App.OpenPath(pathOrUrl);
  },
};
