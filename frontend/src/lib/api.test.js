import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
    runGower,
    mapThumbnails,
    normalizeId,
    wallpaperTarget,
    gower,
    getAppContext,
    checkBattery,
    checkFileExists,
    getAppVersion,
    getGowerStatus,
    setCustomGowerPath,
    pickGowerBinary,
    pickDirectory,
} from './api';
import { notifications } from './stores/notifications';

/** Mock del binding Wails `window.go.main.App`. */
function mockBackend(overrides = {}) {
    const app = {
        RunGowerCommand: vi.fn().mockResolvedValue(''),
        GetAppContext: vi.fn().mockResolvedValue({ cache_path: '/cache', config_path: '/config', user_home: '/home/u' }),
        CheckBattery: vi.fn().mockResolvedValue(true),
        CheckFileExists: vi.fn().mockReturnValue(true),
        OpenPath: vi.fn().mockResolvedValue(undefined),
        GetGowerStatus: vi.fn().mockResolvedValue({ resolved_path: '/usr/bin/gower', configured_path: '', available: true, error: '' }),
        SetCustomGowerPath: vi.fn().mockResolvedValue(undefined),
        PickFile: vi.fn().mockResolvedValue(''),
        PickDirectory: vi.fn().mockResolvedValue(''),
        GetAppVersion: vi.fn().mockResolvedValue('0.2.4'),
        ...overrides,
    };
    // @ts-ignore
    window.go = { main: { App: app } };
    return app;
}

/** Últimos argumentos con los que se invocó RunGowerCommand. */
function lastCall(app) {
    const call = app.RunGowerCommand.mock.calls.at(-1);
    return { args: call[0], background: call[1] };
}

/** Vacía el store de notificaciones (singleton a nivel de módulo). */
function clearNotifications() {
    for (const toast of get(notifications)) {
        notifications.remove(toast.id);
    }
}

describe('api / runGower', () => {
    beforeEach(() => {
        mockBackend();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        clearNotifications();
    });

    afterEach(() => {
        clearNotifications();
        vi.restoreAllMocks();
    });

    it('should extract the JSON payload from noisy output', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('log line\n[{"id":"1"}]\ntrailing log') });

        await expect(runGower(['status', '--json'])).resolves.toEqual([{ id: '1' }]);
    });

    it('should extract a JSON object payload even with a bracketed log prefix', async () => {
        // Regresión: el "[" de "[DEBUG]" se detectaba antes que el "{" y se
        // elegía la rama de array, que no tenía "]" de cierre.
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('[DEBUG] {"count":3}') });

        await expect(runGower(['status', '--json'])).resolves.toEqual({ count: 3 });
    });

    it('should prefer the candidate that appears first in the text', async () => {
        // El objeto abre antes que el array que anida: devolver solo el array
        // interno perdería datos.
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('{"data":[1,2]}') });

        await expect(runGower(['status', '--json'])).resolves.toEqual({ data: [1, 2] });
    });

    it('should skip log brackets and still find a trailing array', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('[INFO] fetched [{"id":1}]') });

        await expect(runGower(['feed', '--json'])).resolves.toEqual([{ id: 1 }]);
    });

    it('should ignore braces that appear inside strings', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('{"msg":"a } b"}') });

        await expect(runGower(['status', '--json'])).resolves.toEqual({ msg: 'a } b' });
    });

    it('should handle escaped quotes inside strings', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('{"msg":"say \\"hi\\""}') });

        await expect(runGower(['status', '--json'])).resolves.toEqual({ msg: 'say "hi"' });
    });

    it('should not treat a quoted brace as a JSON start', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('error: unexpected "{" token') });

        await expect(runGower(['status'])).resolves.toBe('error: unexpected "{" token');
    });

    it('should return raw text when the JSON is truncated', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('{"count": 3') });

        await expect(runGower(['status', '--json'])).resolves.toBe('{"count": 3');
    });

    it('should return raw text when there is no JSON to extract', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('plain output') });

        await expect(runGower(['version'])).resolves.toBe('plain output');
    });

    it('should forward the background flag without parsing the output', async () => {
        const app = mockBackend({ RunGowerCommand: vi.fn().mockResolvedValue('Backgrounded') });

        await expect(runGower(['set', '1'], false, true)).resolves.toBe('Backgrounded');
        expect(lastCall(app)).toEqual({ args: ['set', '1'], background: true });
    });

    it('should rethrow the backend error and notify the user', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockRejectedValue('gower exited with 1') });

        await expect(runGower(['status'])).rejects.toBe('gower exited with 1');

        const toasts = get(notifications);
        expect(toasts).toHaveLength(1);
        expect(toasts[0].type).toBe('error');
        expect(toasts[0].message).toContain('gower exited with 1');
    });

    it('should rethrow without notifying when silent is true', async () => {
        mockBackend({ RunGowerCommand: vi.fn().mockRejectedValue('boom') });

        await expect(runGower(['status'], true)).rejects.toBe('boom');
        expect(get(notifications)).toHaveLength(0);
    });
});

describe('api / command builders', () => {
    beforeEach(() => {
        mockBackend();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        clearNotifications();
    });

    afterEach(() => {
        clearNotifications();
        vi.restoreAllMocks();
    });

    it('should build the status command', async () => {
        const app = mockBackend();
        await gower.getStatus();
        expect(lastCall(app).args).toEqual(['status', '--json']);
    });

    it('should build the feed command with defaults', async () => {
        const app = mockBackend();
        await gower.getFeed();
        expect(lastCall(app).args).toEqual(['feed', 'show', '--page', '1', '--limit', '9', '--sort', 'smart', '--json']);
    });

    it('should strip the # from the color filter', async () => {
        const app = mockBackend();
        await gower.getFeed(2, 20, '#ff0000', 'newest');
        expect(lastCall(app).args).toEqual([
            'feed', 'show', '--page', '2', '--limit', '20', '--sort', 'newest', '--json', '--color', 'ff0000',
        ]);
    });

    it('should omit the color flag when no color is given', async () => {
        const app = mockBackend();
        await gower.getFeed(1, 9, '', 'smart');
        expect(lastCall(app).args).not.toContain('--color');
    });

    it('should run setWallpaper in background mode', async () => {
        const app = mockBackend();
        await gower.setWallpaper('abc123');
        expect(lastCall(app)).toEqual({ args: ['set', 'abc123'], background: true });
    });

    it('should add the target monitor when provided', async () => {
        const app = mockBackend();
        await gower.setWallpaper('abc123', 'HDMI-1');
        expect(lastCall(app).args).toEqual(['set', 'abc123', '--target-monitor', 'HDMI-1']);
    });

    it('should set a random wallpaper', async () => {
        const app = mockBackend();
        await gower.setRandom();
        expect(lastCall(app).args).toEqual(['set', 'random']);
    });

    it('should lowercase the provider in search', async () => {
        const app = mockBackend();
        await gower.search('gato', 'Reddit', 3);
        expect(lastCall(app).args).toEqual(['explore', 'gato', '--provider', 'reddit', '--page', '3', '--json']);
    });

    it('should build the delete command with forced flags', async () => {
        const app = mockBackend();
        await gower.deleteWallpaper('42');
        expect(lastCall(app)).toEqual({
            args: ['wallpaper', '42', '--delete', '--file', '--force'],
            background: false,
        });
    });

    it('should start or stop the daemon', async () => {
        const app = mockBackend();
        await gower.toggleDaemon(true);
        expect(lastCall(app).args).toEqual(['daemon', 'start']);

        await gower.toggleDaemon(false);
        expect(lastCall(app).args).toEqual(['daemon', 'stop']);
    });

    it('should build the reddit provider URL', async () => {
        const app = mockBackend();
        await gower.addRedditProvider('wallpapers', 'top');
        expect(lastCall(app).args).toEqual([
            'config', 'provider', 'add', 'reddit-wallpapers', 'https://www.reddit.com/r/wallpapers/top/.json',
        ]);
    });

    it('should write config values as key=value', async () => {
        const app = mockBackend();
        await gower.setConfig('theme', 'dark');
        expect(lastCall(app).args).toEqual(['config', 'set', 'theme=dark']);
    });

    it('should run the silent commands without raising notifications', async () => {
        const app = mockBackend({ RunGowerCommand: vi.fn().mockRejectedValue('nope') });

        await expect(gower.getDaemonStatus()).rejects.toBe('nope');
        await expect(gower.getConfig()).rejects.toBe('nope');
        await expect(gower.getMonitors()).rejects.toBe('nope');
        await expect(gower.getFeedColors()).rejects.toBe('nope');

        expect(get(notifications)).toHaveLength(0);
        expect(app.RunGowerCommand).toHaveBeenCalledTimes(4);
    });
});

describe('api / thin backend delegates', () => {
    it('should delegate getAppContext', async () => {
        const app = mockBackend();
        await expect(getAppContext()).resolves.toEqual({ cache_path: '/cache', config_path: '/config', user_home: '/home/u' });
        expect(app.GetAppContext).toHaveBeenCalled();
    });

    it('should delegate checkBattery', async () => {
        const app = mockBackend();
        await expect(checkBattery()).resolves.toBe(true);
        expect(app.CheckBattery).toHaveBeenCalled();
    });

    it('should delegate checkFileExists', async () => {
        const app = mockBackend();
        await expect(checkFileExists('/tmp/a.png')).resolves.toBe(true);
        expect(app.CheckFileExists).toHaveBeenCalledWith('/tmp/a.png');
    });
});

describe('api / app version', () => {
    it('should delegate getAppVersion', async () => {
        const app = mockBackend();
        await expect(getAppVersion()).resolves.toBe('0.2.4');
        expect(app.GetAppVersion).toHaveBeenCalled();
    });

    // Sin -ldflags el backend responde "dev"; la UI debe mostrarlo igual.
    it('should surface the dev fallback', async () => {
        mockBackend({ GetAppVersion: vi.fn().mockResolvedValue('dev') });
        await expect(getAppVersion()).resolves.toBe('dev');
    });
});

describe('api / gower binary path', () => {
    it('should delegate getGowerStatus', async () => {
        const app = mockBackend();
        const status = await getGowerStatus();
        expect(status.available).toBe(true);
        expect(status.resolved_path).toBe('/usr/bin/gower');
        expect(app.GetGowerStatus).toHaveBeenCalled();
    });

    it('should report an unavailable gower without throwing', async () => {
        mockBackend({
            GetGowerStatus: vi.fn().mockResolvedValue({
                resolved_path: '',
                configured_path: '',
                available: false,
                error: 'gower executable not found',
            }),
        });

        const status = await getGowerStatus();
        expect(status.available).toBe(false);
        expect(status.error).toBe('gower executable not found');
    });

    it('should persist the selected gower path', async () => {
        const app = mockBackend();
        await setCustomGowerPath('/opt/gower');
        expect(app.SetCustomGowerPath).toHaveBeenCalledWith('/opt/gower');
    });

    it('should allow clearing the gower path', async () => {
        const app = mockBackend();
        await setCustomGowerPath('');
        expect(app.SetCustomGowerPath).toHaveBeenCalledWith('');
    });

    it('should propagate a rejected path so the UI can warn', async () => {
        mockBackend({ SetCustomGowerPath: vi.fn().mockRejectedValue('no such file: /nope') });

        await expect(setCustomGowerPath('/nope')).rejects.toBe('no such file: /nope');
    });

    // El título se pasa desde el caller porque los diálogos nativos no pasan por
    // el i18n del frontend.
    it('should pass the localised title to the file dialog', async () => {
        const app = mockBackend({ PickFile: vi.fn().mockResolvedValue('/opt/gower') });

        await expect(pickGowerBinary('Select the gower executable')).resolves.toBe('/opt/gower');
        expect(app.PickFile).toHaveBeenCalledWith('Select the gower executable');
    });

    it('should return an empty string when the file dialog is cancelled', async () => {
        mockBackend({ PickFile: vi.fn().mockResolvedValue('') });
        await expect(pickGowerBinary('t')).resolves.toBe('');
    });

    it('should pass the localised title to the directory dialog', async () => {
        const app = mockBackend({ PickDirectory: vi.fn().mockResolvedValue('/home/u/walls') });

        await expect(pickDirectory('Wallpapers Folder')).resolves.toBe('/home/u/walls');
        expect(app.PickDirectory).toHaveBeenCalledWith('Wallpapers Folder');
    });
});

describe('api / mapThumbnails', () => {
    it('should return an empty array for nullish input', () => {
        expect(mapThumbnails(null, '/cache')).toEqual([]);
        expect(mapThumbnails(undefined, '/cache')).toEqual([]);
    });

    it('should keep remote and data URLs untouched', () => {
        const [item] = mapThumbnails([{ id: '1', thumbnail: 'https://cdn/img.png' }], '/cache');
        expect(item.thumbnail).toBe('https://cdn/img.png');
    });

    it('should keep data URIs untouched', () => {
        const [item] = mapThumbnails([{ id: '1', thumbnail: 'data:image/png;base64,AAA' }], '/cache');
        expect(item.thumbnail).toBe('data:image/png;base64,AAA');
    });

    it('should prefix absolute paths with the Wails asset handler route', () => {
        const [item] = mapThumbnails([{ id: '1', path: '/home/u/wall.png' }], '/cache');
        expect(item.thumbnail).toBe('/local-asset//home/u/wall.png');
        expect(item.path).toBe('/home/u/wall.png');
    });

    it('should prefer thumbnail over url and path', () => {
        const [item] = mapThumbnails([
            { id: '1', thumbnail: 'https://cdn/a.png', url: 'https://cdn/b.png', path: '/tmp/c.png' },
        ], '/cache');
        expect(item.thumbnail).toBe('https://cdn/a.png');
    });

    it('should fall back to url when thumbnail is missing', () => {
        const [item] = mapThumbnails([{ id: '1', url: 'https://cdn/b.png', path: '/tmp/c.png' }], '/cache');
        expect(item.thumbnail).toBe('https://cdn/b.png');
    });

    it('should build the cache path from id and ext when no source is available', () => {
        const [item] = mapThumbnails([{ id: '9', ext: 'jpg' }], '/home/u/.cache/gower');
        expect(item.thumbnail).toBe('/local-asset//home/u/.cache/gower/thumbs/9.jpg');
    });

    it('should normalize an ext that already includes the dot', () => {
        const [item] = mapThumbnails([{ id: '9', ext: '.png' }], '/cache');
        expect(item.thumbnail).toBe('/local-asset//cache/thumbs/9.png');
    });

    it('should set an empty thumbnail when there is nothing usable', () => {
        const [item] = mapThumbnails([{ id: '1' }], '/cache');
        expect(item.thumbnail).toBe('');
    });

    it('should not mutate the input items', () => {
        const original = [{ id: '9', ext: 'png' }];
        mapThumbnails(original, '/cache');
        expect(original[0].thumbnail).toBeUndefined();
    });
});

describe('api / normalizeId', () => {
    it('should stringify numeric ids', () => {
        expect(normalizeId(42)).toBe('42');
    });

    it('should trim surrounding whitespace', () => {
        expect(normalizeId('  abc  ')).toBe('abc');
    });
});

describe('api / wallpaperTarget', () => {
    it('should use the id for a wallpaper from the feed', () => {
        expect(wallpaperTarget({ id: 'wh_1' })).toBe('wh_1');
    });

    it('should use the url for a search result', () => {
        const item = {
            id: 'wh_6lepll',
            url: 'https://w.wallhaven.cc/full/6l/wallhaven-6lepll.png',
            origin: 'search',
        };
        expect(wallpaperTarget(item)).toBe(item.url);
    });

    it('should fall back to the id when a search result has no url', () => {
        expect(wallpaperTarget({ id: 'wh_9', origin: 'search' })).toBe('wh_9');
    });

    it('should prefer the url when the caller knows the item is from search', () => {
        const item = { id: 'wh_5', url: 'https://cdn/e.png' };
        expect(wallpaperTarget(item, true)).toBe(item.url);
    });

    it('should strip the local_ prefix from the id', () => {
        expect(wallpaperTarget({ id: 'local_77' })).toBe('77');
    });

    // Regresión: gower set no acepta rutas; las trata como id y responde
    // "wallpaper with ID /home/... not found". Un wallpaper de la colección
    // local ya tiene id en el feed, así que se aplica por id.
    it('should never send a local file path as the target', () => {
        const item = {
            id: 'bg_20260125',
            path: '/home/u/Imágenes/Wallpapers/bg_20260125 [d].jpg',
            url: '/home/u/Imágenes/Wallpapers/bg_20260125 [d].jpg',
        };
        expect(wallpaperTarget(item)).toBe('bg_20260125');
    });
});