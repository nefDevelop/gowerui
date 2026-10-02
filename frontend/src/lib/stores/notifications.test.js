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

    it('should report whether remove actually removed something', () => {
        notifications.add('Unica', 'info', 0);
        const [toast] = get(notifications);

        expect(notifications.remove(toast.id)).toBe(true);
        expect(notifications.remove('id-inexistente')).toBe(false);
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

describe('Notifications Store / update', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        clearNotifications();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearNotifications();
    });

    it('should return the id of the created notification', () => {
        const id = notifications.add('Descargando...', 'info', 0);

        expect(id).toEqual(expect.any(String));
        expect(get(notifications)[0].id).toBe(id);
    });

    // Regresión: el flujo de descarga pasaba el id devuelto por add() como
    // tercer argumento del add() siguiente, que es `timeout`. Como add() no
    // devolvía nada, ese timeout era undefined, `undefined > 0` era false y el
    // toast se quedaba en pantalla para siempre.
    it('should mutate a notification in place instead of stacking a new one', () => {
        const id = notifications.add('Descargando...', 'info', 0);

        notifications.update(id, 'Descarga iniciada', 'success');

        const toasts = get(notifications);
        expect(toasts).toHaveLength(1);
        expect(toasts[0]).toMatchObject({
            message: 'Descarga iniciada',
            type: 'success',
        });
    });

    it('should keep the previous type when update omits it', () => {
        const id = notifications.add('Aviso', 'warning', 0);

        notifications.update(id, 'Otro mensaje');

        expect(get(notifications)[0]).toMatchObject({
            message: 'Otro mensaje',
            type: 'warning',
        });
    });

    it('should report false when updating an unknown id', () => {
        expect(notifications.update('id-inexistente', 'Nada')).toBe(false);
    });

    it('should not update anything when the id is unknown', () => {
        notifications.add('Intacta', 'info', 0);

        notifications.update('id-inexistente', 'Cambiada');

        expect(get(notifications)[0].message).toBe('Intacta');
    });

    it('should schedule the removal of an updated notification', () => {
        const id = notifications.add('Descargando...', 'info', 0);
        notifications.update(id, 'Descarga iniciada', 'success');

        vi.advanceTimersByTime(2999);
        expect(get(notifications)).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(get(notifications)).toHaveLength(0);
    });

    it('should honour a custom timeout on update', () => {
        const id = notifications.add('Descargando...', 'info', 0);
        notifications.update(id, 'Error al descargar', 'error', 5000);

        vi.advanceTimersByTime(4999);
        expect(get(notifications)).toHaveLength(1);

        vi.advanceTimersByTime(1);
        expect(get(notifications)).toHaveLength(0);
    });

    // El temporizador del mensaje original no debe borrar el toast ya
    // actualizado, ni hacerlo antes de su propio plazo.
    it('should cancel the previous timer when the notification is updated', () => {
        const id = notifications.add('Descargando...', 'info', 1000);
        notifications.update(id, 'Descarga iniciada', 'success', 5000);

        vi.advanceTimersByTime(1000);
        expect(get(notifications)).toHaveLength(1);

        vi.advanceTimersByTime(4000);
        expect(get(notifications)).toHaveLength(0);
    });

    it('should keep a notification with timeout 0 until it is updated', () => {
        const id = notifications.add('Fijo', 'info', 0);

        vi.advanceTimersByTime(120_000);
        expect(get(notifications)).toHaveLength(1);

        notifications.update(id, 'Ya no fijo', 'success', 3000);
        vi.advanceTimersByTime(3000);
        expect(get(notifications)).toHaveLength(0);
    });

    it('should cancel the pending timer when the notification is removed', () => {
        const id = notifications.add('Temporal', 'info', 3000);
        notifications.remove(id);

        expect(get(notifications)).toHaveLength(0);
        // Si el temporizador siguiera vivo, intentaría eliminar un id ya
        // ausente; el store no debe romperse por ello.
        expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
        expect(get(notifications)).toHaveLength(0);
    });
});