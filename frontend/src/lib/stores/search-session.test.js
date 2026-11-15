import { afterEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import {
  SEARCH_STORAGE_KEY,
  SEARCH_TTL_MS,
  createSearchSession,
} from "./search-session";

/** localStorage en memoria, con las mismas claves que usa la app. */
function fakeStorage(initial = {}) {
  /** @type {Record<string, string>} */
  const data = { ...initial };
  return {
    data,
    getItem: vi.fn((key) => (key in data ? data[key] : null)),
    setItem: vi.fn((key, value) => {
      data[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete data[key];
    }),
  };
}

function savedSession(overrides = {}) {
  return JSON.stringify({
    searchResults: [{ id: "abc", url: "http://x/abc.png" }],
    searchQuery: "cats",
    searchPage: 2,
    selectedProvider: "reddit",
    lastSearchTime: 1_000,
    ...overrides,
  });
}

describe("search-session store", () => {
  /** @type {ReturnType<typeof createSearchSession> | undefined} */
  let session;

  afterEach(() => {
    session?.dispose();
    session = undefined;
  });

  it("no escribe nada en una sesión sin búsqueda", () => {
    const storage = fakeStorage();
    session = createSearchSession({ storage });

    session.query.set("gatos");

    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("persiste los cinco campos en cuanto hay una búsqueda", () => {
    const storage = fakeStorage();
    session = createSearchSession({ storage, now: () => 2_000 });

    session.lastSearchTime.set(1_500);
    session.results.set([{ id: 1, origin: "search" }]);
    session.query.set("gatos");
    session.page.set(3);
    session.provider.set("reddit");

    const saved = JSON.parse(storage.data[SEARCH_STORAGE_KEY]);
    expect(saved).toEqual({
      searchResults: [{ id: 1, origin: "search" }],
      searchQuery: "gatos",
      searchPage: 3,
      selectedProvider: "reddit",
      lastSearchTime: 1_500,
    });
  });

  it("restaura una sesión vigente y normaliza el origin que faltaba", () => {
    const storage = fakeStorage({ [SEARCH_STORAGE_KEY]: savedSession() });
    session = createSearchSession({ storage, now: () => 1_500 });

    expect(session.restore()).toBe(true);
    expect(get(session.query)).toBe("cats");
    expect(get(session.page)).toBe(2);
    expect(get(session.provider)).toBe("reddit");
    expect(get(session.lastSearchTime)).toBe(1_000);
    expect(get(session.results)).toEqual([
      { id: "abc", url: "http://x/abc.png", origin: "search" },
    ]);
  });

  it("no restaura una sesión caducada y limpia el storage", () => {
    const storage = fakeStorage({ [SEARCH_STORAGE_KEY]: savedSession() });
    session = createSearchSession({ storage, now: () => 1_000 + SEARCH_TTL_MS });

    expect(session.restore()).toBe(false);
    expect(get(session.results)).toEqual([]);
    expect(get(session.lastSearchTime)).toBe(0);
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_STORAGE_KEY);
  });

  it("un JSON corrupto no rompe el arranque", () => {
    const storage = fakeStorage({ [SEARCH_STORAGE_KEY]: "{no-es-json" });
    session = createSearchSession({ storage, now: () => 1_500 });

    expect(session.restore()).toBe(false);
    expect(storage.removeItem).toHaveBeenCalledWith(SEARCH_STORAGE_KEY);
  });

  it("expire vacía resultados, query y página, pero mantiene el proveedor", () => {
    const storage = fakeStorage({ [SEARCH_STORAGE_KEY]: savedSession() });
    let clock = 1_500;
    session = createSearchSession({ storage, now: () => clock });

    session.restore();
    clock = 1_000 + SEARCH_TTL_MS + 1;

    expect(session.expire()).toBe(true);
    expect(get(session.results)).toEqual([]);
    expect(get(session.query)).toBe("");
    expect(get(session.page)).toBe(1);
    expect(get(session.lastSearchTime)).toBe(0);
    expect(get(session.provider)).toBe("reddit");
    expect(storage.data[SEARCH_STORAGE_KEY]).toBeUndefined();
  });

  it("expire no toca una sesión vigente", () => {
    const storage = fakeStorage({ [SEARCH_STORAGE_KEY]: savedSession() });
    session = createSearchSession({ storage, now: () => 2_000 });
    session.restore();

    expect(session.expire()).toBe(false);
    expect(get(session.query)).toBe("cats");
  });

  it("dispose deja de persistir", () => {
    const storage = fakeStorage();
    session = createSearchSession({ storage, now: () => 2_000 });
    session.lastSearchTime.set(1_500);
    session.dispose();
    storage.setItem.mockClear();

    session.query.set("después de dispose");

    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
