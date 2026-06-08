import { writable, derived } from 'svelte/store';
import { dictionary } from '../i18n/locales';

function createI18nStore() {
    // Try to load language from localStorage or default to browser language or 'es'
    const storedLocale = typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null;
    const initialLocale = storedLocale || (typeof navigator !== 'undefined' && navigator.language.startsWith('en') ? 'en' : 'es');

    const locale = writable(initialLocale);

    const { subscribe, set, update } = locale;

    return {
        subscribe,
        /** @param {string} l */
        set: (l) => {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('locale', l);
            }
            set(l);
        },
        update
    };
}

export const locale = createI18nStore();

/** @type {import('svelte/store').Readable<(key: string, vars?: Record<string, any>) => string>} */
export const t = derived(locale, ($locale) =>
    /**
     * @param {string} key
     * @param {Record<string, any>} [vars={}]
     * @returns {string}
     */
    (key, vars = {}) => {
        // Helper to access nested properties if we decide to nest later (currently flat)
        // For now, simple lookup
        /** @type {any} */
        const dict = dictionary;
        /** @type {string} */
        let text = dict[$locale]?.[key] || key;

        // Simple variable replacement {var}
        Object.entries(vars).forEach(([k, v]) => {
            const regex = new RegExp(`{${k}}`, 'g');
            text = text.replace(regex, String(v));
        });

        return text;
    }
);

// Helper to get raw dictionary if needed
export const locales = Object.keys(dictionary);
