import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { notifications } from "./stores/notifications";

/**
 * Extracts a JSON string from a text that might contain other content.
 * @param {string} text
 * @returns {any}
 */
function extractJson(text) {
  const startIdx = text.indexOf("[");
  const startObjIdx = text.indexOf("{");

  let actualStart = -1;
  let actualEnd = -1;

  if (startIdx !== -1 && (startObjIdx === -1 || startIdx < startObjIdx)) {
    actualStart = startIdx;
    actualEnd = text.lastIndexOf("]");
  } else if (startObjIdx !== -1) {
    actualStart = startObjIdx;
    actualEnd = text.lastIndexOf("}");
  }

  if (actualStart !== -1 && actualEnd !== -1 && actualEnd > actualStart) {
    const jsonStr = text.substring(actualStart, actualEnd + 1);
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error("Failed to parse extracted JSON:", e);
    }
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
    const result = await invoke("run_gower_command", { args, background });
    const duration = Date.now() - startTime;

    if (background) return result; // Usually "Backgrounded"

    if (!silent) {
      const parsed = extractJson(result);
      return parsed || result;
    } else {
      return extractJson(result) || result;
    }
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(`[GOWER] Command failed (${duration}ms):`, e);

    if (!silent) {
      const err = /** @type {any} */ (e);
      const msg = typeof err === "string" ? err : err.message || "Error desconocido";
      // Clean up error message if it's too technical or verbose?
      // For now, raw message is better than nothing.
      notifications.add(`Error: ${msg}`, "error", 5000);
    }

    throw e;
  }
}

/**
 * Gets the application context (paths, etc.)
 */
export async function getAppContext() {
  return await invoke("get_app_context");
}

/**
 * Checks if the system has a battery.
 */
export async function checkBattery() {
  return await invoke("check_battery");
}

/**
 * Checks if a file exists at the given path.
 * @param {string} path
 */
export async function checkFileExists(path) {
  return await invoke("check_file_exists", { path });
}

/**
 * Maps items to include the correct thumbnail URL for Tauri.
 * @param {any[]} items
 * @param {string} cachePath
 * @returns {any[]}
 */
export function mapThumbnails(items, cachePath) {
  if (!items) return [];
  return items.map((item) => {
    const newItem = { ...item }; // Create a shallow copy to preserve all original properties

    // Priority: thumbnail -> url -> path (absolute) -> id/ext (cache)
    let thumbnailSource = newItem.thumbnail || newItem.url || newItem.path || "";

    if (thumbnailSource.startsWith("http") || thumbnailSource.startsWith("asset:") || thumbnailSource.startsWith("https://asset.")) {
      // Already a valid URL or asset URL, keep it
      newItem.thumbnail = thumbnailSource;
    } else if (
      thumbnailSource !== "" &&
      (thumbnailSource.startsWith("/") || thumbnailSource.startsWith("C:\\") || thumbnailSource.startsWith("\\"))
    ) {
      // It's an absolute local path, convert it to a Tauri asset URL.
      const originalLocalPath = thumbnailSource;
      newItem.thumbnail = convertFileSrc(originalLocalPath);
      newItem.path = originalLocalPath;
    } else if (item.id && item.ext) {
      // Use cache fallback
      const ext = item.ext.startsWith(".") ? item.ext : `.${item.ext}`;
      const fullPath = `${cachePath}/thumbs/${item.id}${ext}`;
      const originalCachePath = fullPath;
      newItem.thumbnail = convertFileSrc(originalCachePath);
      newItem.path = originalCachePath;
    } else {
      // No valid path found
      newItem.thumbnail = "";
    }

    return newItem;
  });
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
   */
  getFavorites: (color = "") => {
    const args = ["favorites", "list", "--json"];
    if (color) args.push("--color", color.replace("#", ""));
    return runGower(args);
  },
  /** @param {string} id */
  addFavorite: (id) => runGower(["favorites", "add", id], false, true),
  /** @param {string} id */
  removeFavorite: (id) => runGower(["favorites", "remove", id], false, true),
  /** @param {string} id */
  blacklist: (id) => runGower(["blacklist", "add", id], false, true),
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
    // Handle boolean vs string/int
    return runGower(["config", "set", `${key}=${value}`]);
  },
  /** @param {boolean} enable */
  toggleDaemon: async (enable) => {
    const cmd = ["daemon", enable ? "start" : "stop"];
    try {
      const response = await runGower(cmd);
      return response;
    } catch (e) {
      console.error(`Error en daemon:`, e);
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
  deleteWallpaper: (id) => runGower(["wallpaper", id, "--delete", "--file", "--force"], false, true),
  undoWallpaper: () => runGower(["set", "undo"], false, true),
  /** @param {string} pathOrUrl */
  openPath: async (pathOrUrl) => {
    const { openUrl, revealItemInDir } = await import("@tauri-apps/plugin-opener");
    if (pathOrUrl.startsWith("http") || pathOrUrl.startsWith("file")) {
      return await openUrl(pathOrUrl);
    }
    return await revealItemInDir(pathOrUrl);
  },
};
