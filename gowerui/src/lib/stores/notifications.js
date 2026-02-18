import { writable } from 'svelte/store';

/**
 * @typedef {{id: string, message: string, type: 'info'|'success'|'error'|'warning'}} Toast
 */

function createNotificationStore() {
    /** @type {import('svelte/store').Writable<Toast[]>} */
    const { subscribe, update } = writable([]);

    return {
        subscribe,
        /**
         * @param {string} message 
         * @param {'info' | 'success' | 'error' | 'warning'} type 
         * @param {number} timeout 
         */
        add: (message, type = 'info', timeout = 3000) => {
            const id = crypto.randomUUID();
            update(n => [...n, { id, message, type }]);

            if (timeout > 0) {
                setTimeout(() => {
                    update(n => n.filter(t => t.id !== id));
                }, timeout);
            }
        },
        remove: (id) => update(n => n.filter(t => t.id !== id))
    };
}

export const notifications = createNotificationStore();
