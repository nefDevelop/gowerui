<script>
    import { createEventDispatcher } from "svelte";
    import { fade, scale } from "svelte/transition";
    import { convertFileSrc } from "@tauri-apps/api/core";

    /**
     * @typedef {Object} WallpaperItem
     * @property {string} id
     * @property {string} [thumbnail]
     */

    /** @type {boolean} */
    export let open = false;
    /** @type {WallpaperItem | null} */
    export let item = null;

    const dispatch = createEventDispatcher();

    function confirm() {
        dispatch("confirm", item);
        close();
    }

    function close() {
        dispatch("close");
        open = false;
    }
</script>

{#if open && item}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        class="modal-overlay"
        transition:fade
        onclick={close}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") close();
        }}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="modal glass-card"
            transition:scale
            onclick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            tabindex="-1"
        >
            <h3>Eliminar Wallpaper?</h3>

            {#if item?.thumbnail}
                <div class="preview">
                    <img
                        src={convertFileSrc(item.thumbnail)}
                        alt="Wallpaper to delete"
                        class="preview-img"
                    />
                </div>
                <p class="title">{item.id}</p>
            {:else}
                <p class="title">{item?.id || "Unknown Item"}</p>
            {/if}

            <div class="actions">
                <button class="cancel" onclick={close}>Cancelar</button>
                <button class="delete" onclick={confirm}>Eliminar</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
    }

    .modal {
        background: var(--surface);
        padding: var(--spacing-l);
        border-radius: var(--radius-m);
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-m);
        align-items: center;
    }

    h3 {
        margin: 0;
        color: var(--on-surface);
    }

    .preview {
        width: 200px;
        height: 112px;
        border-radius: var(--radius-s);
        overflow: hidden;
        border: 1px solid var(--outline);
    }
    .preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .title {
        margin: 0;
        font-size: 0.9rem;
        color: var(--surface-variant-text);
        text-align: center;
        word-break: break-all;
    }

    .actions {
        display: flex;
        gap: 16px;
        width: 100%;
    }

    button {
        flex: 1;
        padding: 8px;
        border-radius: var(--radius-s);
        font-weight: bold;
        cursor: pointer;
        border: none;
    }

    .cancel {
        background: var(--surface-container-highest);
        color: var(--on-surface);
    }
    .cancel:hover {
        background: var(--surface-hover);
    }

    .delete {
        background: var(--error);
        color: var(--on-error);
    }
    .delete:hover {
        opacity: 0.9;
    }
</style>
