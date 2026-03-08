<script>
    import { createEventDispatcher } from "svelte";
    import { t } from "$lib/stores/i18n";
    import { fade } from "svelte/transition";

    /** @type {any[]} */
    export let currentWallpapers = []; // Array of items
    /** @type {any[]} */
    export let favoritesList = []; // Array of favorite items to check status

    const dispatch = createEventDispatcher();

    /**
     * @param {string} id
     */
    function isFavorite(id) {
        return favoritesList.some((f) => f.id === id);
    }

    /**
     * @param {any} item
     */
    function toggleFavorite(item) {
        dispatch("favorite", item);
    }

    /**
     * @param {any} item
     */
    function deleteWallpaper(item) {
        dispatch("delete", item);
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
                            class="favorite-btn"
                        >
                            <span class="material-icons" class:active={isFavorite(item.id)}>
                                {isFavorite(item.id) ? "favorite" : "favorite_border"}
                            </span>
                        </button>
                        <button
                            class="danger"
                            onclick={() => deleteWallpaper(item)}
                            title={$t("common.delete")}
                        >
                            <span class="material-icons">delete</span>
                        </button>
                    </div>
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
    button.danger:hover {
        color: var(--error);
        background: rgba(255, 0, 0, 0.2);
    }

    .material-icons {
        font-size: 20px;
    }

    .material-icons.active {
        color: var(--error);
    }
</style>
