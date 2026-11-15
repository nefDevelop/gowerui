<script>
    import { gower } from "$lib/api";
    import { t } from "$lib/stores/i18n";

    /**
     * @type {{
     *   config: any,
     *   status: any,
     *   updateConfig: (key: string, value: any) => void,
     *   onrefresh?: () => void,
     * }}
     */
    let { config, status, updateConfig, onrefresh } = $props();

    let isDaemonTransitioning = $state(false);
    let optimisticDaemonState = $state(false);

    /** @param {any} e */
    async function toggleDaemon(e) {
        const newState = e.target.checked;
        isDaemonTransitioning = true;
        optimisticDaemonState = newState;

        try {
            await gower.toggleDaemon(newState);
            // Wait a small moment for process to settle
            setTimeout(() => {
                onrefresh?.();
                isDaemonTransitioning = false;
            }, 1000);
        } catch (err) {
            isDaemonTransitioning = false;
            onrefresh?.();
        }
    }
</script>

<div class="section glass-card">
    <h3>{$t("settings.daemon")}</h3>
    <div class="row">
        <span>{$t("settings.daemon.status")}</span>
        <div class="status-control">
            <span
                class="status-text"
                class:active={isDaemonTransitioning
                    ? optimisticDaemonState
                    : status?.daemon_running ||
                      status?.daemon?.running ||
                      status?.running}
                class:transitioning={isDaemonTransitioning}
            >
                {#if isDaemonTransitioning}
                    {optimisticDaemonState
                        ? $t("settings.daemon.starting")
                        : $t("settings.daemon.stopping")}
                {:else}
                    {status?.daemon_running ||
                    status?.daemon?.running ||
                    status?.running
                        ? $t("settings.daemon.active")
                        : $t("settings.daemon.inactive")}
                {/if}
            </span>
            <label class="switch" class:disabled={isDaemonTransitioning}>
                <input
                    type="checkbox"
                    checked={isDaemonTransitioning
                        ? optimisticDaemonState
                        : status?.daemon_running ||
                          status?.daemon?.running ||
                          status?.running}
                    disabled={isDaemonTransitioning}
                    onchange={(e) => {
                        const target =
                            /** @type {HTMLInputElement} */ (e.target);
                        toggleDaemon(e);
                        updateConfig(
                            "behavior.daemon_enabled",
                            target.checked,
                        );
                    }}
                />
                <span class="slider"></span>
            </label>
        </div>
    </div>
    <div class="row">
        <span>{$t("settings.interval")}</span>
        <input
            type="number"
            value={config?.behavior?.change_interval || 30}
            onchange={(e) =>
                updateConfig(
                    "behavior.change_interval",
                    parseInt(
                        /** @type {HTMLInputElement} */ (e.target).value,
                    ),
                )}
        />
    </div>
    <div class="row">
        <span>{$t("settings.auto_download")}</span>
        <label class="switch">
            <input
                type="checkbox"
                checked={config?.behavior?.auto_download || false}
                onchange={(e) =>
                    updateConfig(
                        "behavior.auto_download",
                        /** @type {HTMLInputElement} */ (e.target).checked,
                    )}
            />
            <span class="slider"></span>
        </label>
    </div>
</div>
