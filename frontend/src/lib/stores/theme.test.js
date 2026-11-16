import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { theme } from './theme';

describe('Theme Store', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        document.documentElement.className = '';
    });

    it('should initialize with default value "system"', () => {
        const current = get(theme);
        expect(current).toBe('system');
    });

    it('should change theme and persist to localStorage', () => {
        theme.set('dark');
        expect(get(theme)).toBe('dark');
        expect(localStorage.setItem).toHaveBeenCalledWith('gower-theme', 'dark');
        expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    });

    it('should change to light theme and update DOM', () => {
        theme.set('light');
        expect(get(theme)).toBe('light');
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
        expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    });

    it('should toggle theme cycle (Light -> Dark -> Light)', () => {
        theme.set('light');
        theme.toggle();
        expect(get(theme)).toBe('dark');
        theme.toggle();
        expect(get(theme)).toBe('light');
    });

    it('should handle system preference detection (simulated)', () => {
        // Mock matchMedia to return light
        /** @type {import('vitest').Mock} */
        (window.matchMedia).mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        theme.set('system');
        // updateDOM is internal but called by set('system')
        // In our implementation, updateDOM checks matches
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    });
});

/**
 * El store es un singleton: para probar el arranque hay que recargar el módulo
 * con `matchMedia` configurado antes de importarlo.
 */
describe('Theme Store initialization', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        document.documentElement.className = '';
        vi.resetModules();
    });

    it('aplica el tema del sistema al cargar el módulo', async () => {
        window.matchMedia.mockReturnValue({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        const { theme: freshTheme } = await import('./theme');

        expect(get(freshTheme)).toBe('system');
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
        expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    });

    it('un tema guardado manda sobre el sistema', async () => {
        localStorage.setItem('gower-theme', 'light');
        window.matchMedia.mockReturnValue({
            matches: false, // el escritorio está en oscuro
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        const { theme: freshTheme } = await import('./theme');

        expect(get(freshTheme)).toBe('light');
        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
    });

    it('un valor guardado desconocido cae en system', async () => {
        localStorage.setItem('gower-theme', 'banana');
        window.matchMedia.mockReturnValue({
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        });

        const { theme: freshTheme } = await import('./theme');

        expect(get(freshTheme)).toBe('system');
    });

    it('sigue los cambios del sistema cuando el modo es system', async () => {
        /** @type {(() => void) | undefined} */
        let onSystemChange;
        window.matchMedia.mockImplementation(() => ({
            matches: false,
            addEventListener: (_event, handler) => {
                onSystemChange = handler;
            },
            removeEventListener: vi.fn(),
        }));

        await import('./theme');
        expect(document.documentElement.classList.contains('dark-theme')).toBe(true);

        // El escritorio cambia a claro: el listener debe repintar.
        window.matchMedia.mockImplementation(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        expect(onSystemChange).toBeTypeOf('function');
        onSystemChange?.();

        expect(document.documentElement.classList.contains('light-theme')).toBe(true);
        expect(document.documentElement.classList.contains('dark-theme')).toBe(false);
    });

    it('una elección manual ignora los cambios del sistema', async () => {
        /** @type {(() => void) | undefined} */
        let onSystemChange;
        window.matchMedia.mockImplementation(() => ({
            matches: false,
            addEventListener: (_event, handler) => {
                onSystemChange = handler;
            },
            removeEventListener: vi.fn(),
        }));

        const { theme: freshTheme } = await import('./theme');
        freshTheme.set('dark');

        // El escritorio pasa a claro, pero el usuario eligió oscuro.
        window.matchMedia.mockImplementation(() => ({
            matches: true,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));
        onSystemChange?.();

        expect(get(freshTheme)).toBe('dark');
        expect(document.documentElement.classList.contains('dark-theme')).toBe(true);
    });
});
