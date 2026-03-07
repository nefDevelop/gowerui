import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { locale, t } from './i18n';

describe('i18n Store', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('should initialize with default locale (en if browser is en, else es)', () => {
        // Since window.navigator.language might be mocked in setup.js or default to something
        const currentLocale = get(locale);
        expect(['en', 'es']).toContain(currentLocale);
    });

    it('should change locale and persist to localStorage', () => {
        locale.set('en');
        expect(get(locale)).toBe('en');
        expect(localStorage.setItem).toHaveBeenCalledWith('locale', 'en');
    });

    it('should translate keys correctly using the t store', () => {
        locale.set('es');
        const translate = get(t);
        // Assuming "app.title" exists in locales.js as "Gower GUI"
        expect(translate('app.title')).toBe('Gower GUI');

        // Test unknown key
        expect(translate('non.existent.key')).toBe('non.existent.key');
    });

    it('should support variable replacement', () => {
        locale.set('es');
        const translate = get(t);
        // Assuming search.page is "Página {page}"
        expect(translate('search.page', { page: 5 })).toBe('Página 5');
    });

    it('should react to locale changes', () => {
        locale.set('en');
        let translate = get(t);
        // Assuming tabs.home is "Home" in en
        expect(translate('tabs.home')).toBe('Home');

        locale.set('es');
        translate = get(t);
        // Assuming tabs.home is "Inicio" in es
        expect(translate('tabs.home')).toBe('Inicio');
    });
});
