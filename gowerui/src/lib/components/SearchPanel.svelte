<script>
    import { gower } from "$lib/api";
    import WallpaperGrid from "./WallpaperGrid.svelte";

    /** @type {{cache_path: string, config_path: string, user_home: string} | null} */
    export let appContext = null;
    /** @type {any[]} */
    export let favoritesList = []; // To check if item is fav

    let searchQuery = "";
    /** @type {any[]} */
    let searchResults = [];
    let loading = false;
    let selectedProvider = "wallhaven";

    const providers = ["wallhaven", "reddit"]; // Could come from config

    async function handleSearch() {
        if (!searchQuery) return;
        loading = true;
        searchResults = [];
        try {
            const result = await gower.search(searchQuery, selectedProvider);
            if (result && appContext) {
                searchResults = result.map((/** @type {any} */ item) => {
                    return item;
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            loading = false;
        }
    }
</script>

<div class="search-panel">
    <div class="search-bar glass-card">
        <select bind:value={selectedProvider}>
            {#each providers as p}
                <option value={p}>{p}</option>
            {/each}
        </select>
        <input
            type="text"
            placeholder="Buscar wallpapers..."
            bind:value={searchQuery}
            onkeydown={(e) => e.key === "Enter" && handleSearch()}
        />
        <button class="btn-primary" onclick={handleSearch}>Ir</button>
    </div>

    <!-- Apps/Plugins Grid (Placeholder until logic confirmed) -->
    <!-- QML had a grid of apps/plugins. For now we focus on search results -->

    <div class="results-area">
        {#if loading || searchResults.length > 0}
            <WallpaperGrid
                items={searchResults}
                {loading}
                type="search"
                {favoritesList}
                on:set={(e) => gower.setWallpaper(e.detail.id)}
            />
        {:else if !loading && searchQuery}
            <div class="empty">No se encontraron resultados.</div>
        {:else}
            <div class="empty hint">
                Selecciona un proveedor y busca algo increíble.
            </div>
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
        /* Remove card style from container to let inputs stand on their own or keep it? 
           User wants spacing. Inputs have their own borders now.
           Let's remove the background/border from this container to avoid double-boxing.
        */
        background: transparent;
        border: none;
        backdrop-filter: none;
        padding: 0;
    }

    /* Reset specific styles to inherit global premium inputs */

    option {
        background: var(--surface-container);
        color: var(--on-surface);
    }

    input {
        flex: 1;
    }

    /* Remove specific local styles to use global */

    .results-area {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .empty {
        margin-top: 40px;
        text-align: center;
        color: var(--on-surface-variant);
        opacity: 0.7;
    }
    .hint {
        margin-top: 100px;
        font-size: 0.9rem;
    }
</style>
