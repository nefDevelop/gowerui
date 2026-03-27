<script>
    import { notifications } from "../stores/notifications";
    import { fly, fade } from "svelte/transition";
    import { flip } from "svelte/animate";

    /** @param {'info' | 'success' | 'error' | 'warning'} type */
    function getTypeColor(type) {
        switch (type) {
            case "error":
                return "var(--error, #cf6679)"; // Red/Pink
            case "success":
                return "var(--success, #03dac6)"; // Teal/Green
            case "warning":
                return "var(--warning, #ffb74d)"; // Orange
            default:
                return "var(--primary, #bb86fc)"; // Purple
        }
    }

    /** @param {'info' | 'success' | 'error' | 'warning'} type */
    function getIcon(type) {
        switch (type) {
            case "error":
                return "error_outline";
            case "success":
                return "check_circle";
            case "warning":
                return "warning_amber";
            default:
                return "info";
        }
    }
</script>

<div class="toast-container">
    {#each $notifications as toast (toast.id)}
        <div
            class="toast"
            class:error={toast.type === "error"}
            class:success={toast.type === "success"}
            animate:flip={{ duration: 300 }}
            transition:fly={{ x: 50, duration: 300 }}
        >
            <span class="material-icons icon">{getIcon(toast.type)}</span>
            <span class="message">{toast.message}</span>
            <button
                class="close-btn"
                onclick={() => notifications.remove(toast.id)}
            >
                <span class="material-icons">close</span>
            </button>
            <div
                class="progress-bar"
                style:background-color={getTypeColor(toast.type)}
            ></div>
        </div>
    {/each}
</div>

<style>
    .toast-container {
        position: fixed;
        top: 40px; /* Below titlebar/nav */
        right: 12px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        z-index: 9999;
        pointer-events: none;
    }

    .toast {
        pointer-events: auto;
        background: rgba(20, 20, 20, 0.85);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 240px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        border-left: 3px solid var(--primary);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .toast.error {
        border-left-color: var(--error, #cf6679);
    }
    .toast.success {
        border-left-color: var(--success, #03dac6);
    }

    .icon {
        font-size: 18px;
        opacity: 0.9;
    }

    .toast.error .icon {
        color: var(--error, #cf6679);
    }
    .toast.success .icon {
        color: var(--success, #03dac6);
    }

    .message {
        flex: 1;
        font-size: 0.8rem;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: white;
        opacity: 0.4;
        cursor: pointer;
        padding: 2px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }

    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        opacity: 1;
    }

    .close-btn .material-icons {
        font-size: 14px;
    }

    .progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        width: 100%;
        opacity: 0.6;
    }
</style>
