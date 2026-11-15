import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, writable } from "svelte/store";

// El mock se declara con hoisted para que exista antes de que `vi.mock` lo use.
const api = vi.hoisted(() => ({
  getFeed: vi.fn(),
  getFeedColors: vi.fn(),
  getFavorites: vi.fn(),
  getFavoritesColors: vi.fn(),
}));

vi.mock("$lib/api", () => ({
  gower: {
    getFeed: api.getFeed,
    getFeedColors: api.getFeedColors,
    getFavorites: api.getFavorites,
    getFavoritesColors: api.getFavoritesColors,
  },
  mapThumbnails: (items) => items,
}));

import { createFeedStore, createFavoritesStore } from "./wallpapers";

describe("feed y favoritos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    api.getFeed.mockResolvedValue([{ id: 1 }]);
    api.getFeedColors.mockResolvedValue(["#ffffff"]);
    api.getFavorites.mockResolvedValue([{ id: 2 }]);
    api.getFavoritesColors.mockResolvedValue(["#000000"]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("el feed pide 10 items (9 + buffer) con el color compartido", async () => {
    const color = writable("#123456");
    const feed = createFeedStore({ color });
    feed.setCachePath("/cache");
    feed.setSort("Newest");

    await feed.load();

    expect(api.getFeed).toHaveBeenCalledWith(1, 10, "#123456", "newest");
    expect(api.getFeedColors).toHaveBeenCalledTimes(1);
    expect(api.getFavorites).not.toHaveBeenCalled();
    expect(get(feed).items).toEqual([{ id: 1 }]);
    expect(get(feed).colors).toEqual(["#ffffff"]);
  });

  it("favoritos pide 9 y usa sus propias funciones", async () => {
    const color = writable("");
    const favorites = createFavoritesStore({ color });
    favorites.setCachePath("/cache");

    await favorites.load({ page: 3 });

    expect(api.getFavorites).toHaveBeenCalledWith(3, 9, "", "smart");
    expect(api.getFavoritesColors).toHaveBeenCalledTimes(1);
    expect(api.getFeed).not.toHaveBeenCalled();
  });

  it("cada lista mantiene su propio sort", async () => {
    const color = writable("");
    const feed = createFeedStore({ color });
    const favorites = createFavoritesStore({ color });
    feed.setCachePath("/cache");
    favorites.setCachePath("/cache");

    feed.setSort("A-Z");
    favorites.setSort("Oldest");

    expect(get(feed).sort).toBe("A-Z");
    expect(get(favorites).sort).toBe("Oldest");
  });
});
