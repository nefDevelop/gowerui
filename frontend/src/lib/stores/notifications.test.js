import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications } from './notifications';

/** Vacía el store: es un singleton a nivel de módulo y su estado persiste
 *  entre tests, así que hay que reiniciarlo explícitamente. */
function clearNotifications() {
    for (const toast of get(notifications)) {
        notifications.remove(toast.id);
    }
}

describe('Notifications Store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearNotifications();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearNotifications();
    });

    it('should start with an empty list', () => {
        expect(get(notifications)).toEqual([]);
    });

    it('should add a notification with the given type', () => {
        notifications.add('Fondo aplicado', 'success', 0);

        const toasts = get(notifications);
        expect(toasts).toHaveLength(1);
        expect(toasts[0]).toMatchObject({ message: 'Fondo aplicado', type: 'success' });
        expect(toasts[0].id).toEqual(expect.any(String));
    });

    it('should default to the "info" type', () => {
        notifications.add('Hola', undefined, 0);

        expect(get(notifications)[0].type).toBe('info');
    });

    it('should auto-remove the notification once the timeout elapses', () => {
        notifications.add('Temporal', 'info', 3000);
        expect(get(notifications)).toHaveLength(1);

        vi.advanceTimersByTime(2999);
        expect(get(notifications)).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(get(notifications)).toHaveLength(0);
    });

    it('should keep the notification when timeout is 0', () => {
        notifications.add('Permanente', 'warning', 0);

        vi.advanceTimersByTime(60_000);
        expect(get(notifications)).toHaveLength(1);
    });

    it('should remove only the notification with the matching id', () => {
        notifications.add('Primera', 'info', 0);
        notifications.add('Segunda', 'error', 0);

        const [first] = get(notifications);
        notifications.remove(first.id);

        const toasts = get(notifications);
        expect(toasts).toHaveLength(1);
        expect(toasts[0].message).toBe('Segunda');
    });

    it('should ignore the removal of an unknown id', () => {
        notifications.add('Única', 'info', 0);

        notifications.remove('id-inexistente');

        expect(get(notifications)).toHaveLength(1);
    });

    it('should stack multiple notifications keeping insertion order', () => {
        notifications.add('A', 'info', 0);
        notifications.add('B', 'info', 0);
        notifications.add('C', 'info', 0);

        expect(get(notifications).map((t) => t.message)).toEqual(['A', 'B', 'C']);
    });

    it('should generate unique ids for each notification', () => {
        notifications.add('A', 'info', 0);
        notifications.add('B', 'info', 0);

        const [first, second] = get(notifications);
        expect(first.id).not.toBe(second.id);
    });
});