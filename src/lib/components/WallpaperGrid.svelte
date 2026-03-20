<script>
    import { createEventDispatcher } from "svelte";
    import { t } from "$lib/stores/i18n";
    import { fade } from "svelte/transition";
    import { checkFileExists, normalizeId } from "$lib/api";

    let {
        items = [],
        loading = false,
        type = "home", // 'home' | 'favorites' | 'search' | 'current'
        favoritesList = [], // List of favorite items to check status
        collectionPath = ""
    } = $props();

    const dispatch = createEventDispatcher();

    /** @type {Set<string>} */
    const notifiedErrors = new Set();

    // Reactive Set for O(1) lookups and guaranteed reactivity
    let favoriteIds = $derived(new Set(favoritesList.map(f => normalizeId(f.id))));

    /**
     * @param {string} id
     */
    function handleImageError(id) {
        if (!notifiedErrors.has(id)) {
            console.error(`[GOWER] Image failed to load for ID: ${id}. Thumbnail URL: ${items.find(i => i.id === id)?.thumbnail}, Path: ${items.find(i => i.id === id)?.path}`);
            notifiedErrors.add(id);
        }
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

        if (cleanPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(cleanPath)) {
            if (!cleanPath.includes("/cache/") && !cleanPath.includes("\\cache\\")) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param {any} item
     */
    function handleWallpaperClick(item) {
        console.log(`[Wallpaper Click] ID: ${item.id}`);
        console.log(`  - Is Favorite: ${isFavorite(item)}`);
        console.log(`  - Is Downloaded: ${isDownloaded(item)}`);
        console.log(`  - Source: ${item.source}`);
        console.log(`  - Path: ${item.path}`);
        dispatch("preview", item);
    }
</script>

<div class="grid premium-scroll">
    {#each items as item (item.id)}
        <div
            class="card glass-card"
            onclick={() => handleWallpaperClick(item)}
            oncontextmenu={(e) => {
                e.preventDefault();
                dispatch("contextmenu", { item, x: e.clientX, y: e.clientY });
            }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === "Enter" && handleWallpaperClick(item)}
        >
            <img
                src={item.thumbnail}
                alt={item.id}
                loading="lazy"
                onerror={(e) => {
                    handleImageError(item.id);
                    const target = /** @type {HTMLImageElement} */ (
                        e.currentTarget
                    );
                    target.src =
                        "https://placehold.co/400x400/1a1a2e/bb86fc?text=No%20Image";
                }}
            />

            <div class="overlay">
                <div class="actions">
                    <button
                        onclick={(e) => {
                            e.stopPropagation();
                            dispatch("block", item);
                        }}
                        title={$t("grid.add_to_blacklist")}
                        class="block-btn"
                    >
                        <span class="material-icons">visibility_off</span>
                    </button>

                    {#if type !== "favorites"}
                        <button
                            onclick={(e) => {
                                e.stopPropagation();
                                dispatch("favorite", item);
                            }}
                            title={isFavorite(item)
                                ? $t("grid.remove_from_favorites") : $t("grid.add_to_favorites")
                            }
                        >
                            <span 
                                class="material-icons"
                                class:active={isFavorite(item)}
                            >
                                {isFavorite(item) ? "favorite" : "favorite_border"}
                            </span>
                        </button>
                    {/if}

                    {#if !isDownloaded(item)}
                        <button
                            onclick={(e) => {
                                e.stopPropagation();
                                dispatch("download", item);
                            }}
                            title={$t("grid.download")}
                            class="download-btn"
                        >
                            <span class="material-icons">download</span>
                        </button>
                    {/if}

                    {#if type === "favorites"}
                        <button
                            class="danger"
                            onclick={(e) => {
                                e.stopPropagation();
                                dispatch("favorite", item);
                            }}
                            title={$t("common.delete")}
                        >
                            <span class="material-icons">delete</span>
                        </button>
                    {/if}
                </div>
            </div>

            {#if isFavorite(item) && type !== "favorites"}
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

    {#if loading && items.length === 0}
        {#each Array(9) as _}
            <div class="card skeleton"></div>
        {/each}
    {/if}
</div>

<style>
    .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-auto-rows: min-content;
        align-content: start;
        gap: 5px;
        padding: 5px 0;
        min-height: 480px;
    }

    .card {
        position: relative;
        aspect-ratio: 1/1;
        border-radius: var(--radius-s);
        overflow: hidden;
        background: var(--surface-container);
        border: 1px solid transparent;
        transition: border-color 0.2s;
    }

    .card:hover {
        border-color: var(--primary);
    }

    .card img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s;
    }
    .card:hover img {
        transform: scale(1.05);
    }

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
            to top,
            rgba(0, 0, 0, 0.8),
            transparent 40%
        );
        opacity: 0;
        transition: opacity 0.2s;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 8px;
    }

    .card:hover .overlay {
        opacity: 1;
    }

    .actions {
        display: flex;
        justify-content: center;
        gap: 8px; /* Reduced gap to fit more buttons */
    }

    button {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s;
    }
    button:hover {
        background: var(--primary);
        color: black;
    }
    button.danger:hover,
    button.block-btn:hover {
        background: var(--error);
        color: white;
    }
    button.download-btn:hover {
        background: #4caf50; /* Green for download */
        color: white;
    }

    .material-icons {
        font-size: 20px;
    }
    .material-icons.active {
        color: var(--error);
    }

    .fav-badge {
        position: absolute;
        top: 6px;
        right: 6px;
        color: var(--error);
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
        pointer-events: none;
    }

    .download-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        color: #4caf50;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
        pointer-events: none;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .download-badge .material-icons {
        font-size: 14px;
    }

    .skeleton {
        background: linear-gradient(
            90deg,
            var(--surface-container) 25%,
            var(--surface-container-high) 50%,
            var(--surface-container) 75%
        );
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
    }
    @keyframes loading {
        0% {
            background-position: 200% 0;
        }
        100% {
            background-position: -200% 0;
        }
    }
</style>
