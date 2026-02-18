<script>
    import { createEventDispatcher } from "svelte";

    export let colors = [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
        "#FFFFFF",
        "#000000",
    ]; // Default rainbow
    export let selectedColor = "";

    const dispatch = createEventDispatcher();

    /** @param {string} color */
    function selectColor(color) {
        dispatch("select", color);
    }
</script>

<div class="color-filter glass-card">
    {#each colors as color, i}
        <button
            type="button"
            class="color-segment"
            style="background-color: {color};"
            class:first={i === 0}
            class:last={i === colors.length - 1}
            class:selected={selectedColor === color}
            onclick={() => selectColor(color)}
            aria-label="Seleccionar color {color}"
        >
            {#if selectedColor === color}
                <span class="material-icons check-icon">check</span>
            {/if}
        </button>
    {/each}
</div>

<style>
    .color-filter {
        display: flex;
        height: 48px;
        width: 100%;
        border-radius: var(--radius-s);
        overflow: hidden;
        border: 1px solid var(--outline);
    }

    .color-segment {
        flex: 1;
        cursor: pointer;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
        border: none;
        padding: 0;
    }

    .color-segment:hover {
        filter: brightness(1.1);
    }

    /* Selection overlay logic */
    .color-segment.selected::after {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4); /* Darken slightly to show check */
    }

    .check-icon {
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        z-index: 10;
        font-size: 20px;
    }
</style>
