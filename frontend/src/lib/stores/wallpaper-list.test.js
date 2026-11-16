import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";
import { createWallpaperListStore } from "./wallpaper-list";

/** Promesa controlable para simular una petición que aún no ha terminado. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Crea un store con dependencias falsas. El color es un store real para probar
 * que la lista lee el valor compartido en el momento de la petición.
 */
function setup(overrides = {}) {
  const color = writable("");
  const fetchPage = vi.fn().mockResolvedValue([{ id: 1, url: "http://x/1.png" }]);
  const fetchColors = vi.fn().mockResolvedValue(["#ff0000"]);
  const store = createWallpaperListStore({
    label: "test",
    pageSize: 9,
    fetchPage,
    fetchColors,
    color,
    ...overrides,
  });
  store.setCachePath("/cache");
  return { store, color, fetchPage, fetchColors };
}

describe("wallpaper-list store", () => {
  beforeEach(() => {
    // El store loguea cada carga y cada error; no ensuciamos la salida.
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("no pide nada hasta conocer el cachePath", async () => {
    const color = writable("");
    const fetchPage = vi.fn();
    const store = createWallpaperListStore({
      label: "test",
      pageSize: 9,
      fetchPage,
      fetchColors: vi.fn(),
      color,
    });

    await store.load();

    expect(fetchPage).not.toHaveBeenCalled();
    expect(get(store).loading).toBe(false);
  });

  it("carga la página 1 con el color y el sort en minúsculas", async () => {
    const { store, color, fetchPage, fetchColors } = setup();
    color.set("#aabbcc");
    store.setSort("Newest");

    await store.load();

    expect(fetchPage).toHaveBeenCalledWith(1, 9, "#aabbcc", "newest");
    expect(fetchColors).toHaveBeenCalledTimes(1);
    expect(get(store).items).toHaveLength(1);
    expect(get(store).colors).toEqual(["#ff0000"]);
    expect(get(store).loading).toBe(false);
  });

  it("reset vuelve a la página 1 y una página explícita se recuerda", async () => {
    const { store, fetchPage } = setup();

    await store.load({ page: 4 });
    expect(get(store).page).toBe(4);

    await store.load();
    expect(fetchPage).toHaveBeenLastCalledWith(4, 9, "", "smart");

    await store.load({ reset: true });
    expect(fetchPage).toHaveBeenLastCalledWith(1, 9, "", "smart");
    expect(get(store).page).toBe(1);
  });

  it("skipColors no pide colores y conserva los anteriores", async () => {
    const { store, fetchColors } = setup();

    await store.load();
    expect(get(store).colors).toEqual(["#ff0000"]);

    fetchColors.mockClear();
    await store.load({ skipColors: true });

    expect(fetchColors).not.toHaveBeenCalled();
    expect(get(store).colors).toEqual(["#ff0000"]);
  });

  it("solo enseña el skeleton cuando la lista está vacía", async () => {
    const { store } = setup();

    /** @type {boolean[]} */
    const loadingStates = [];
    const unsubscribe = store.subscribe((state) => {
      loadingStates.push(state.loading);
    });

    await store.load();
    // Primera carga: true mientras se pide, false al terminar.
    expect(loadingStates).toContain(true);
    expect(get(store).loading).toBe(false);

    loadingStates.length = 0;
    await store.load();
    // Recargar con items ya pintados no debe hacer parpadear la rejilla.
    expect(loadingStates).not.toContain(true);

    unsubscribe();
  });

  it("un error conserva los items y apaga el spinner", async () => {
    const { store, fetchPage } = setup();
    await store.load();

    fetchPage.mockRejectedValueOnce(new Error("provider down"));
    await store.load({ reset: true });

    expect(get(store).items).toHaveLength(1);
    expect(get(store).loading).toBe(false);
  });

  it("remove quita el item por id sin recargar", async () => {
    const { store, fetchPage } = setup();
    await store.load();
    fetchPage.mockClear();

    store.remove(1);

    expect(get(store).items).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("setLoading permite el spinner externo de aplicar a todos los monitores", () => {
    const { store } = setup();

    store.setLoading(true);
    expect(get(store).loading).toBe(true);

    store.setLoading(false);
    expect(get(store).loading).toBe(false);
  });

  it("una respuesta vieja no pisa a la carga más reciente", async () => {
    const first = deferred();
    const second = deferred();
    let calls = 0;
    const fetchPage = vi.fn(() => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    });
    const color = writable("");
    const store = createWallpaperListStore({
      label: "test",
      pageSize: 9,
      fetchPage,
      fetchColors: vi.fn().mockResolvedValue([]),
      color,
    });
    store.setCachePath("/cache");

    const firstLoad = store.load();
    const secondLoad = store.load();

    // La segunda termina antes, así que debe quedarse con sus items.
    second.resolve([{ id: 2, url: "http://x/2.png" }]);
    await secondLoad;
    expect(get(store).items.map((item) => item.id)).toEqual([2]);

    // La primera llega tarde: se descarta y no pisa la lista.
    first.resolve([{ id: 1, url: "http://x/1.png" }]);
    await firstLoad;

    expect(get(store).items.map((item) => item.id)).toEqual([2]);
    expect(get(store).loading).toBe(false);
  });

  it("con guard ignora una segunda carga simultánea", async () => {
    const pending = deferred();
    const fetchPage = vi.fn(() => pending.promise);
    const color = writable("");
    const store = createWallpaperListStore({
      label: "test",
      pageSize: 9,
      fetchPage,
      fetchColors: vi.fn().mockResolvedValue([]),
      color,
      guardConcurrentLoads: true,
    });
    store.setCachePath("/cache");

    const first = store.load();
    const second = store.load();
    pending.resolve([]);
    await Promise.all([first, second]);

    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
