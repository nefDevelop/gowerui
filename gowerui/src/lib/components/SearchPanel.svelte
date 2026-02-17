<script>
    import { gower, mapThumbnails } from "$lib/api";
    import WallpaperGrid from "./WallpaperGrid.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    let {
        favoritesModel = [],
        loading = $bindable(false),
        searchResults = $bindable([]),
        searchQuery = $bindable(""),
        searchPage = $bindable(1),
        selectedProvider = $bindable("wallhaven"),
        lastSearchTime = $bindable(0),
        config = null,
        status = null,
        appContext = null,
    } = $props();

    // Dynamically get enabled providers from status and config
    const providers = $derived(() => {
        const defaultList = ["wallhaven", "reddit", "bing", "unsplash", "nasa"];
        const enabled = new Set();

        // 1. Add defaults if enabled in status
        if (status?.providers) {
            Object.entries(status.providers).forEach(([p, isActive]) => {
                if (isActive) enabled.add(p);
            });
        }

        // 2. Add from config (in case status is stale or doesn't include it)
        if (config?.providers) {
            Object.entries(config.providers).forEach(([p, prov]) => {
                if (prov && prov.enabled) enabled.add(p);
            });
        }

        // 3. Add generic providers (Custom ones)
        if (config?.generic_providers) {
            Object.entries(config.generic_providers).forEach(([key, prov]) => {
                // If it's an array, key might be '0', but we want the provider name
                const name = prov?.name || key;
                if (name && name !== "generic" && prov?.enabled !== false) {
                    enabled.add(name);
                }
            });
        }

        // 4. Force at least wallhaven if nothing else
        if (enabled.size === 0) enabled.add("wallhaven");

        // Convert set to sorted array
        return Array.from(enabled).sort();
    });

    async function handleSearch(resetPage = true) {
        if (!searchQuery || loading) return;
        if (resetPage) searchPage = 1;

        loading = true;
        try {
            const result = await gower.search(
                searchQuery,
                selectedProvider,
                searchPage,
            );

            // Handle different API result structures
            let items = [];
            if (result && Array.isArray(result)) {
                items = result;
            } else if (result && typeof result === "object") {
                items =
                    result.results || result.items || result.wallpapers || [];
                if (items.length === 0) {
                    const firstArray = Object.values(result).find((val) =>
                        Array.isArray(val),
                    );
                    if (firstArray) items = firstArray;
                }
            }

            // USE the imported mapThumbnails
            const cachePath =
                appContext?.cache_path || config?.paths?.cache || "";

            const processedItems = mapThumbnails(items, cachePath).map(
                (item) => ({
                    ...item,
                    provider: item.provider || selectedProvider,
                }),
            );

            if (processedItems.length > 0 || resetPage) {
                searchResults = processedItems;
            }

            lastSearchTime = Date.now();
        } catch (e) {
            console.error("[SEARCH] Error:", e);
        } finally {
            loading = false;
        }
    }

    /**
     * @param {WheelEvent} e
     */
    function handleWheel(e) {
        if (loading) return;
        // Basic debounce: only trigger if scroll is significant
        if (Math.abs(e.deltaY) < 50) return;

        e.preventDefault();

        if (e.deltaY > 0) {
            searchPage++;
            handleSearch(false);
        } else if (e.deltaY < 0 && searchPage > 1) {
            searchPage--;
            handleSearch(false);
        }
    }
</script>

<div class="search-panel">
    <div class="search-bar">
        <select
            bind:value={selectedProvider}
            onchange={() => handleSearch(true)}
        >
            {#each providers() as p}
                <option value={p}>{p}</option>
            {/each}
        </select>
        <input
            type="text"
            placeholder="Buscar..."
            bind:value={searchQuery}
            onkeydown={(e) => e.key === "Enter" && handleSearch(true)}
        />
        <button class="btn-primary" onclick={() => handleSearch(true)}
            >Buscar</button
        >
    </div>

    <div class="results-area" onwheel={handleWheel}>
        {#if loading || searchResults.length > 0}
            <div class="grid-container premium-scroll">
                <WallpaperGrid
                    items={searchResults}
                    {loading}
                    type="search"
                    favoritesList={favoritesModel}
                    collectionPath={config?.paths?.wallpapers}
                    on:preview
                    on:contextmenu
                    on:block
                    on:favorite
                    on:download
                />
            </div>

            {#if searchResults.length > 0 && !loading}
                <div class="search-footer">
                    <div class="page-nav glass-card">
                        <button
                            class="icon-btn"
                            disabled={searchPage <= 1}
                            onclick={() => {
                                searchPage--;
                                handleSearch(false);
                            }}
                        >
                            <span class="material-icons">chevron_left</span>
                        </button>
                        <span class="page-num">Página {searchPage}</span>
                        <button
                            class="icon-btn"
                            onclick={() => {
                                searchPage++;
                                handleSearch(false);
                            }}
                        >
                            <span class="material-icons">chevron_right</span>
                        </button>
                    </div>
                </div>
            {/if}
        {:else if !loading && searchQuery}
            <div class="empty">No se encontraron resultados.</div>
        {:else}
            <div class="empty hint">Busca algo increíble.</div>
        {/if}
    </div>
</div>

<style>
    .search-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: var(--spacing-s);
        padding: 0;
    }

    .search-bar {
        display: flex;
        gap: var(--spacing-s);
        align-items: center;
        background: transparent;
        border: none;
        backdrop-filter: none;
        padding: 0;
        margin-bottom: var(--spacing-xs);
    }

    .results-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
    }

    .grid-container {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
    }

    .search-footer {
        flex-shrink: 0;
        display: flex;
        justify-content: center;
        padding: var(--spacing-s) 0;
        background: var(--background);
        border-top: 1px solid var(--outline);
    }

    .page-nav {
        display: flex;
        align-items: center;
        gap: var(--spacing-m);
        padding: var(--spacing-xs) var(--spacing-m);
        border-radius: var(--radius-l);
        background: var(--surface);
    }

    .page-num {
        font-weight: bold;
        min-width: 80px;
        text-align: center;
        font-size: 0.85rem;
        color: var(--primary);
    }

    .icon-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--on-surface);
        opacity: 0.8;
    }
    .icon-btn:hover:not(:disabled) {
        opacity: 1;
        color: var(--primary);
    }
    .icon-btn:disabled {
        opacity: 0.2;
        cursor: not-allowed;
    }
    .icon-btn .material-icons {
        font-size: 20px;
    }

    select {
        flex-shrink: 0;
        max-width: 110px;
        text-overflow: ellipsis;
    }

    option {
        background: var(--surface);
        color: var(--on-surface);
    }

    input {
        flex: 1;
    }

    .empty {
        margin-top: var(--spacing-l);
        text-align: center;
        color: var(--on-surface-variant);
        opacity: 0.7;
    }
    .hint {
        margin-top: 100px;
        font-size: 0.9rem;
    }
</style>
