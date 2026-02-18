<script>
    import { createEventDispatcher } from "svelte";

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
        <span class="material-icons info-icon">sort</span>
        <select
            class="sort-select"
            value={currentSort}
            onchange={handleSortChange}
        >
            {#each sortOptions as option}
                <option value={option}>{option}</option>
            {/each}
        </select>
    </div>

    <div class="center">
        <div class="paginator">
            <input
                type="number"
                min="1"
                value={currentPage}
                onchange={handlePageChange}
            />
        </div>
    </div>

    <div class="right">
        <button class="icon-btn" onclick={handleUndo} title="Deshacer">
            <span class="material-icons">undo</span>
        </button>
    </div>
</div>

<style>
    .sort-bar {
        position: relative;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding: 0 16px;
        background: var(--surface-container-highest);
        border: 1px solid var(--outline);
        border-radius: var(--radius-m);
        width: 100%;
        box-sizing: border-box;
        height: 40px;
    }

    .left,
    .right {
        flex: 1;
        display: flex;
        align-items: center;
    }

    .left {
        justify-content: flex-start;
    }

    .right {
        justify-content: flex-end;
    }

    .center {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: auto;
    }

    .info-icon {
        font-size: 18px;
        color: var(--primary);
        margin-right: 8px;
        flex-shrink: 0;
    }

    .sort-select {
        background-color: transparent;
        border: none;
        padding: 4px 20px 4px 4px;
        font-size: 0.85rem;
        width: 110px;
        color: var(--on-surface);
        cursor: pointer;
        appearance: none;
        outline: none;
        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22gray%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2082.2c3.6-3.6%205.4-7.8%205.4-12.8%200-5-1.8-9.3-5.4-12.9z%22%2F%3E%3C%2Fsvg%3E");
        background-repeat: no-repeat;
        background-position: right 0 center;
        background-size: 10px;
        font-weight: 500;
    }

    .sort-select:hover {
        color: var(--primary);
    }

    option {
        background: var(--surface-container-high);
        color: var(--on-surface);
    }

    .paginator {
        background: var(--surface-container);
        padding: 1px 12px;
        border-radius: var(--radius-l);
        border: 1px solid var(--outline-variant);
        display: flex;
        align-items: center;
    }

    .center input {
        width: 32px;
        text-align: center;
        padding: 2px;
        background: transparent;
        border: none;
        color: var(--on-surface);
        font-size: 0.9rem;
        font-weight: bold;
        outline: none;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: var(--on-surface);
        opacity: 0.6;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6px;
        transition: all 0.2s;
        border-radius: 50%;
    }
    .icon-btn:hover {
        opacity: 1;
        color: var(--primary);
        background: rgba(255, 255, 255, 0.05);
    }
    .icon-btn .material-icons {
        font-size: 20px;
    }
</style>
