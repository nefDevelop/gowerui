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
        window.matchMedia.mockReturnValue({
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
