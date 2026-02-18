<script>
    import { notifications } from "../stores/notifications";
    import { fly, fade } from "svelte/transition";
    import { flip } from "svelte/animate";

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
            transition:fly={{ y: 20, duration: 300 }}
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
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        z-index: 9999;
        pointer-events: none; /* Allow clicking through container */
    }

    .toast {
        pointer-events: auto;
        background: rgba(30, 30, 30, 0.95);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 300px;
        max-width: 450px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        border-left: 4px solid var(--primary);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .toast.error {
        border-left-color: var(--error, #cf6679);
    }
    .toast.success {
        border-left-color: var(--success, #03dac6);
    }

    .icon {
        font-size: 20px;
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
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: white;
        opacity: 0.5;
        cursor: pointer;
        padding: 4px;
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
        font-size: 16px;
    }
</style>
