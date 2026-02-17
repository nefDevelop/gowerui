import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Extracts a JSON string from a text that might contain other content.
 * @param {string} text 
 * @returns {any}
 */
function extractJson(text) {
    const startIdx = text.indexOf('[');
    const startObjIdx = text.indexOf('{');

    let actualStart = -1;
    let actualEnd = -1;

    if (startIdx !== -1 && (startObjIdx === -1 || startIdx < startObjIdx)) {
        actualStart = startIdx;
        actualEnd = text.lastIndexOf(']');
    } else if (startObjIdx !== -1) {
        actualStart = startObjIdx;
        actualEnd = text.lastIndexOf('}');
    }

    if (actualStart !== -1 && actualEnd !== -1 && actualEnd > actualStart) {
        const jsonStr = text.substring(actualStart, actualEnd + 1);
        try {
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('Failed to parse extracted JSON:', e);
        }
    }
    return null;
}

/**
 * Runs a gower CLI command and returns the output as a parsed object if possible.
 * @param {string[]} args
 * @returns {Promise<any>}
 */
export async function runGower(args, silent = false) {
    const startTime = Date.now();
    try {
        const result = await invoke('run_gower_command', { args });
        const duration = Date.now() - startTime;
        if (!silent) {
            const parsed = extractJson(result);
            return parsed || result;
        } else {
            return extractJson(result) || result;
        }
    } catch (e) {
        const duration = Date.now() - startTime;
        console.error(`[GOWER] Command failed (${duration}ms):`, e);
        throw e;
    }
}

/**
 * Gets the application context (paths, etc.)
 */
export async function getAppContext() {
    return await invoke('get_app_context');
}

/**
 * Checks if the system has a battery.
 */
export async function checkBattery() {
    return await invoke('check_battery');
}

/**
 * Maps items to include the correct thumbnail URL for Tauri.
 * @param {any[]} items 
 * @param {string} cachePath 
 * @returns {any[]}
 */
export function mapThumbnails(items, cachePath) {
    if (!items) return [];
    return items.map(item => {
        // Priority: thumbnail -> url -> path (absolute) -> id/ext (cache)
        let path = item.thumbnail || item.url || item.path || '';

        if (path.startsWith('http') || path.startsWith('asset:') || path.startsWith('https://asset.')) {
            // Already a valid URL or asset URL, keep it
            item.thumbnail = path;
        } else if (path !== '' && (path.startsWith('/') || path.startsWith('C:\\') || path.startsWith('\\'))) {
            // It's an absolute local path, must use convertFileSrc
            let converted = convertFileSrc(path);

            // Safety fallback for Linux: ensure it starts with asset://localhost
            if (converted.startsWith('/') && !converted.startsWith('asset:')) {
                converted = `asset://localhost${converted}`;
            } else if (converted === path && !path.startsWith('asset:')) {
                converted = `asset://localhost${path}`;
            }

            item.thumbnail = converted;
        } else if (item.id && item.ext) {
            // Use cache fallback
            const ext = item.ext.startsWith('.') ? item.ext : `.${item.ext}`;
            const fullPath = `${cachePath}/thumbs/${item.id}${ext}`;
            let converted = convertFileSrc(fullPath);
            if (converted.startsWith('/') && !converted.startsWith('asset:')) {
                converted = `asset://localhost${fullPath}`;
            } else if (converted === fullPath && !fullPath.startsWith('asset:')) {
                converted = `asset://localhost${fullPath}`;
            }
            item.thumbnail = converted;
        } else {
            // No valid path found
            item.thumbnail = '';
        }

        return item;
    });
}

/**
 * Common gower commands mapped to easy-to-use functions.
 */
export const gower = {
    getStatus: () => runGower(['status', '--json']),
    getFeed: (page = 1, limit = 9, color = '', sort = 'smart') => {
        const args = ['feed', 'show', '--page', String(page), '--limit', String(limit), '--sort', sort, '--json'];
        if (color) args.push('--color', color.replace('#', ''));
        return runGower(args);
    },
    /**
     * @param {string} idOrUrl
     * @param {string} [monitor]
     */
    setWallpaper: (idOrUrl, monitor = '') => {
        const args = ['set', idOrUrl];
        if (monitor) args.push('--target-monitor', monitor);
        return runGower(args);
    },
    updateFeed: () => runGower(['feed', 'update']),
    /**
     * @param {string} [color]
     */
    getFavorites: (color = '') => {
        const args = ['favorites', 'list', '--json'];
        if (color) args.push('--color', color.replace('#', ''));
        return runGower(args);
    },
    /** @param {string} id */
    addFavorite: (id) => runGower(['favorites', 'add', id]),
    /** @param {string} id */
    removeFavorite: (id) => runGower(['favorites', 'remove', id]),
    /** @param {string} id */
    blacklist: (id) => runGower(['blacklist', 'add', id]),
    /** @param {string} id */
    download: (id) => runGower(['download', id, '--to-collection']),
    /**
     * @param {string} text
     * @param {string} provider
     * @param {number} [page]
     */
    search: (text, provider, page = 1) => {
        const args = ['explore', text, '--provider', provider.toLowerCase(), '--page', String(page), '--json'];
        return runGower(args);
    },
    getDaemonStatus: () => runGower(['daemon', 'status', '--json'], true),
    getConfig: () => runGower(['config', 'show', '--json'], true),
    /**
     * @param {string} key
     * @param {any} value
     */
    setConfig: (key, value) => {
        // Handle boolean vs string/int
        return runGower(['config', 'set', `${key}=${value}`]);
    },
    /** @param {boolean} enable */
    toggleDaemon: async (enable) => {
        const cmd = ['daemon', enable ? 'start' : 'stop'];
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
        const args = ['config', 'provider', 'add', name, url];
        if (key) args.push(key);
        return runGower(args);
    },

    /** @param {string} name */
    removeProvider: (name) => runGower(['config', 'provider', 'remove', name]),

    /**
     * @param {string} subreddit
     * @param {string} sort
     */
    addRedditProvider: (subreddit, sort) => {
        const name = `reddit-${subreddit}`;
        const url = `https://www.reddit.com/r/${subreddit}/${sort}/.json`;
        return runGower(['config', 'provider', 'add', name, url]);
    },
    getCurrentWallpapers: () => runGower(['status', '--wallpapers', '--json']),
    getMonitors: () => runGower(['status', '--monitors', '--json'], true),
    getFeedColors: () => runGower(['feed', 'get', 'colors', '--json'], true),
    getFavoritesColors: () => runGower(['favorites', 'get', 'colors', '--json'], true),
    /** @param {string} id */
    deleteWallpaper: (id) => runGower(['wallpaper', id, '--delete', '--file', '--force']),
    undoWallpaper: () => runGower(['set', 'undo']),
    /** @param {string} pathOrUrl */
    openPath: async (pathOrUrl) => {
        const { openUrl, revealItemInDir } = await import('@tauri-apps/plugin-opener');
        if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('file')) {
            return await openUrl(pathOrUrl);
        }
        return await revealItemInDir(pathOrUrl);
    }
};

