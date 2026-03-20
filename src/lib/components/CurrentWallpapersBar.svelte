<script>
    import { t } from "$lib/stores/i18n";
    import { notifications } from "$lib/stores/notifications";
    import { fade } from "svelte/transition";
    import { normalizeId } from "$lib/api";

    let {
        currentWallpapers = [],
        favoritesList = [],
        collectionPath = "",
        onfavorite,
        onblacklist
    } = $props();

    // Reactive Set for O(1) lookups and guaranteed reactivity
    let favoriteIds = $derived(new Set(favoritesList.map(f => normalizeId(f.id))));

    /**
     * @param {any} item
     */
    function toggleFavorite(item) {
        if (onfavorite) onfavorite(item);
    }

    /**
     * @param {any} item 
     */
    function blacklistWallpaper(item) {
        if (onblacklist) onblacklist(item);
    }

    /**
     * @param {any} item
     */
    function isFavorite(item) {
        if (!item || !item.id) return false;
        return favoriteIds.has(normalizeId(item.id));
    }

    /**
     * @param {any} item
     */
    function isDownloaded(item) {
        if (!item) return false;
        if (item.source === "local") return true;
        if (!item.path) return false;

        const pathStr = item.path || "";
        const cleanCollection = (collectionPath || "").replace(/[\\/]$/, "");
        const cleanPath = pathStr.replace(/[\\/]$/, "");
        
        if (cleanCollection && cleanPath.startsWith(cleanCollection)) {
            return true;
        }

        // Fallback: Si es ruta absoluta y NO está en ninguna carpeta de caché, se asume que es local/descargada
        if (cleanPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(cleanPath)) {
            if (!cleanPath.includes("/cache/") && !cleanPath.includes("\\cache\\")) {
                return true;
            }
        }

        return false;
    }
</script>

{#if currentWallpapers.length > 0}
    <div class="current-bar glass-card" transition:fade>
        <div class="scroll-container">
            {#each currentWallpapers as item}
                <div class="wallpaper-item">
                    <img src={item.thumbnail} alt={item.id} />

                    <div class="overlay">
                        <button
                            onclick={() => toggleFavorite(item)}
                            title={$t("common.favorite")}
                        >
                            <span class="material-icons" class:active={isFavorite(item)}>
                                {isFavorite(item) ? "favorite" : "favorite_border"}
                            </span>
                        </button>
                        <button
                            class="block-btn"
                            onclick={() => blacklistWallpaper(item)}
                            title={$t("grid.add_to_blacklist")}
                        >
                            <span class="material-icons">visibility_off</span>
                        </button>
                    </div>

                    {#if isFavorite(item)}
                        <div class="fav-badge">
                            <span class="material-icons">favorite</span>
                        </div>
                    {/if}

                    {#if isDownloaded(item)}
                        <div class="download-badge">
                            <span class="material-icons">save</span>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .current-bar {
        position: relative;
        width: 100%;
        padding: 8px 0 4px 0;
        z-index: 100;
        margin-top: 4px;
        flex-shrink: 0;
    }

    .scroll-container {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
        justify-content: center;
    }

    .scroll-container::-webkit-scrollbar {
        height: 4px;
    }
    .scroll-container::-webkit-scrollbar-thumb {
        background: var(--surface-container-highest);
        border-radius: 2px;
    }

    .wallpaper-item {
        position: relative;
        height: 100px;
        border-radius: var(--radius-m);
        overflow: hidden;
        flex-shrink: 0;
        cursor: pointer;
        border: 2px solid var(--primary);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .wallpaper-item img {
        height: 100%;
        width: auto;
        object-fit: contain;
    }

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .wallpaper-item:hover .overlay {
        opacity: 1;
    }

    button {
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    button:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    button.block-btn:hover {
        color: var(--error);
        background: rgba(255, 0, 0, 0.2);
    }

    .material-icons {
        font-size: 20px;
    }

    .material-icons.active {
        color: var(--error);
    }

    .fav-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        color: var(--error);
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
        pointer-events: none;
    }
    .fav-badge .material-icons { font-size: 16px; }

    .download-badge {
        position: absolute;
        top: 4px;
        left: 4px;
        color: #4caf50;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
        pointer-events: none;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 50%;
        width: 18px;
        height: 18px;
        display: flex; align-items: center; justify-content: center;
    }
    .download-badge .material-icons { font-size: 12px; }
</style>
