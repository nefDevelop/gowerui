<script>
    import { createEventDispatcher } from "svelte";
    import { fade } from "svelte/transition";

    export let sortOptions = [
        "Smart",
        "Newest",
        "Oldest",
        "Source",
        "Unseen",
        "Random",
    ];
    export let currentSort = "Smart";
    export let currentPage = 1;

    const dispatch = createEventDispatcher();

    function handleSortChange(e) {
        dispatch("sort", e.target.value);
    }

    function handlePageChange(e) {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
            dispatch("page", val);
        }
    }

    function handleUndo() {
        dispatch("undo");
    }
</script>

<div class="sort-bar glass-card">
    <div class="left">
        <span class="icon">sort</span>
        <select
            class="sort-select"
            value={currentSort}
            onchange={handleSortChange}
        >
            {#each sortOptions as option}
                <option value={option}>{option}</option>
            {/each}
        </select>
        <span class="chevron material-icons">expand_more</span>
    </div>

    <div class="center">
        <input
            type="number"
            min="1"
            value={currentPage}
            onchange={handlePageChange}
        />
    </div>

    <div class="right">
        <button class="icon-btn" onclick={handleUndo} title="Deshacer">
            undo
        </button>
    </div>
</div>

<style>
    .sort-bar {
        /* Height auto to accommodate new inputs */
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px;
        background: var(--surface-container-highest);
        border: 1px solid var(--outline);
        border-radius: var(--radius-s);
    }

    .left {
        position: relative;
        display: flex;
        align-items: center;
        width: 140px;
    }

    .icon {
        font-family: "Material Icons", sans-serif; /* Assuming material icons loaded or simpler approach needed */
        font-size: 16px;
        color: var(--primary);
        padding: 0 8px;
        pointer-events: none;
    }

    .sort-select {
        background-color: transparent;
        border: none;
        padding: 4px 24px 4px 8px; /* Compact padding */
        font-size: 0.9rem;
        width: 100%;
        background-image: none; /* Remove arrow from app.css */
    }

    option {
        background: var(--surface-container);
        color: var(--on-surface);
    }

    .chevron {
        position: absolute;
        right: 4px;
        font-size: 18px;
        color: var(--primary);
        pointer-events: none;
    }

    .center input {
        width: 50px;
        text-align: center;
        padding: 4px; /* Simpler padding for small bar */
    }

    .right {
        padding-right: 4px;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: var(--on-surface);
        opacity: 0.5;
        cursor: pointer;
        font-family: "Material Icons", sans-serif;
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .icon-btn:hover {
        opacity: 1;
        color: var(--primary);
    }
</style>
