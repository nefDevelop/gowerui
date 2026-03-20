<script>
    import { gower, checkBattery } from "$lib/api";
    import { t, locale } from "$lib/stores/i18n";
    import { theme } from "$lib/stores/theme";
    import { createEventDispatcher, onMount } from "svelte";
    import { slide, fade } from "svelte/transition";

    /** @type {{config: any, status: any}} */
    let { config = $bindable(), status } = $props();

    const dispatch = createEventDispatcher();
    
    let showProviders = $state(false);
    let newProvider = $state({ name: "", url: "", key: "" });
    let hasBattery = $state(false);
    let providerToDelete = $state({ open: false, key: "", name: "" });

    onMount(async () => {
        hasBattery = await checkBattery();
    });

    /**
     * @param {string} key
     * @param {any} value
     */
    function updateConfig(key, value) {
        // Optimistic update
        const keys = key.split(".");
        if (keys.length === 2) {
            config[keys[0]][keys[1]] = value;
        }
        gower.setConfig(key, value);
    }

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
                dispatch("refresh");
                isDaemonTransitioning = false;
            }, 1000);
        } catch (err) {
            // console.error("Daemon toggle failed:", err);
            isDaemonTransitioning = false;
            dispatch("refresh");
        }
    }

    import { open } from "@tauri-apps/plugin-dialog";

    async function pickWallpaperFolder() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: config?.paths?.wallpapers || undefined,
            });
            if (selected) {
                updateConfig("paths.wallpapers", selected);
            }
        } catch (e) {
            // console.error("Failed to open dialog:", e);
        }
    }
</script>

<div class="settings-panel premium-scroll">
    {#if !showProviders}
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
                    <label
                        class="switch"
                        class:disabled={isDaemonTransitioning}
                    >
                        <input
                            type="checkbox"
                            checked={isDaemonTransitioning
                                ? optimisticDaemonState
                                : status?.daemon_running ||
                                  status?.daemon?.running ||
                                  status?.running}
                            disabled={isDaemonTransitioning}
                            onchange={(e) => {
                                const target = /** @type {HTMLInputElement} */ (
                                    e.target
                                );
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
                                /** @type {HTMLInputElement} */ (e.target)
                                    .value,
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
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
        </div>

        <div class="section glass-card">
            <h3>{$t("settings.behavior")}</h3>
            <div class="row">
                <span>{$t("settings.theme")}</span>
                <select
                    value={$theme}
                    onchange={(e) => {
                        const val = /** @type {HTMLSelectElement} */ (e.target)
                            .value;
                        theme.set(
                            /** @type {import('$lib/stores/theme').Theme} */ (
                                val
                            ),
                        );
                    }}
                >
                    <option value="system">{$t("settings.theme.system")}</option
                    >
                    <option value="light">{$t("settings.theme.light")}</option>
                    <option value="dark">{$t("settings.theme.dark")}</option>
                </select>
            </div>
            <div class="row">
                <span>{$t("settings.only_favorites")}</span>
                <label class="switch">
                    <input
                        type="checkbox"
                        checked={config?.behavior?.from_favorites || false}
                        onchange={(e) =>
                            updateConfig(
                                "behavior.from_favorites",
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
            <div class="row">
                <span>{$t("settings.save_favorites")}</span>
                <label class="switch">
                    <input
                        type="checkbox"
                        checked={config?.behavior?.save_favorites_to_folder ||
                            false}
                        onchange={(e) =>
                            updateConfig(
                                "behavior.save_favorites_to_folder",
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
            {#if hasBattery}
                <div class="row">
                    <span>{$t("settings.power.pause_low_battery")}</span>
                    <label class="switch">
                        <input
                            type="checkbox"
                            checked={config?.power?.pause_on_low_battery ||
                                false}
                            onchange={(e) =>
                                updateConfig(
                                    "power.pause_on_low_battery",
                                    /** @type {HTMLInputElement} */ (e.target)
                                        .checked,
                                )}
                        />
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="row">
                    <span>{$t("settings.power.threshold")}</span>
                    <input
                        type="number"
                        value={config?.power?.low_battery_threshold || 20}
                    onchange={(e) =>
                            updateConfig(
                                "power.low_battery_threshold",
                                parseInt(
                                    /** @type {HTMLInputElement} */ (e.target)
                                        .value,
                                ),
                            )}
                    />
                </div>
            {/if}
        </div>

        <div class="section glass-card">
            <h3>{$t("settings.display")}</h3>
            <div class="row">
                <span>{$t("settings.multi_monitor")}</span>
                <select
                    value={config?.behavior?.multi_monitor || "distinct"}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.multi_monitor",
                            /** @type {HTMLSelectElement} */ (e.target).value,
                        )}
                >
                    <option value="distinct"
                        >{$t("settings.monitor.distinct")}</option
                    >
                    <option value="clone">{$t("settings.monitor.clone")}</option
                    >
                </select>
            </div>
        </div>

        <div class="section glass-card">
            <h3>{$t("settings.general")}</h3>
            <div class="row">
                <span>{$t("language")}</span>
                <select
                    value={$locale}
                    onchange={(e) =>
                        locale.set(
                            /** @type {HTMLSelectElement} */ (e.target).value,
                        )}
                >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                </select>
            </div>
            <div class="col">
                <span>{$t("settings.wallpapers_folder")}</span>
                <div class="input-group">
                    <input
                        type="text"
                        value={config?.paths?.wallpapers || ""}
                        readonly
                    />
                    <button class="icon-btn" onclick={pickWallpaperFolder}>
                        <span class="material-icons">folder_open</span>
                    </button>
                </div>
            </div>
            <div class="row">
                <span>{$t("settings.use_system_dir")}</span>
                <label class="switch">
                    <input
                        type="checkbox"
                        checked={config?.paths?.use_system_dir || false}
                        onchange={(e) =>
                            updateConfig(
                                "paths.use_system_dir",
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
            <div class="row">
                <span>{$t("settings.index_folder")}</span>
                <label class="switch">
                    <input
                        type="checkbox"
                        checked={config?.paths?.index_wallpapers || false}
                        onchange={(e) =>
                            updateConfig(
                                "paths.index_wallpapers",
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
        </div>

        <button
            class="section glass-card clickable"
            onclick={() => (showProviders = true)}
        >
            <h3>{$t("settings.providers.title")} &nbsp; ›</h3>
            <p class="subtext">{$t("settings.providers.subtitle")}</p>
        </button>

        <div class="version">Version 1.1.0</div>
    {:else}
        <!-- PROVIDERS SUB-VIEW -->
        <div class="section">
            <div class="header-row">
                <button
                    class="back-btn icon-btn"
                    onclick={() => (showProviders = false)}
                >
                    <span class="material-icons">arrow_back</span>
                </button>
                <h3 class="title-centered">{$t("settings.providers.title")}</h3>
            </div>

            <div class="providers-list">
                {#each Object.entries(config?.providers || {}) as [key, provider]}
                    <div class="provider-item">
                        <div class="provider-header">
                            <span class="provider-name"
                                >{provider.name || key}</span
                            >
                            <label class="switch">
                                <input
                                    type="checkbox"
                                    checked={provider.enabled === true}
                                    onchange={(e) =>
                                        updateConfig(
                                            `providers.${key}.enabled`,
                                            /** @type {HTMLInputElement} */ (
                                                e.target
                                            ).checked,
                                        )}
                                />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="provider-options">
                            {#if key === "reddit" || (provider && provider.hasOwnProperty("sort"))}
                                <select
                                    class="small-select"
                                    value={provider.sort || "hot"}
                                    onchange={(e) =>
                                        updateConfig(
                                            `providers.${key}.sort`,
                                            /** @type {HTMLSelectElement} */ (
                                                e.target
                                            ).value,
                                        )}
                                >
                                    <option value="new">new</option>
                                    <option value="hot">hot</option>
                                    <option value="top">top</option>
                                    <option value="controversial"
                                        >controversial</option
                                    >
                                    <option value="mix">mix</option>
                                </select>
                            {/if}
                            {#if provider && provider.hasOwnProperty("api_key")}
                                <input
                                    class="provider-api-key"
                                    type="password"
                                    placeholder="API Key"
                                    value={provider.api_key}
                                    onchange={(e) =>
                                        updateConfig(
                                            `providers.${key}.api_key`,
                                            /** @type {HTMLInputElement} */ (
                                                e.target
                                            ).value,
                                        )}
                                />
                            {/if}
                        </div>
                    </div>
                {/each}

                <h4>{$t("settings.providers.custom")}</h4>
                {#each Object.entries(config?.generic_providers || {}) as [key, provider]}
                    <div class="provider-item">
                        <div class="provider-header">
                            <span class="provider-name"
                                >{provider.name || key}</span
                            >
                            <div class="provider-actions">
                                <button
                                    class="small-btn danger"
                                    onclick={() => {
                                        providerToDelete = {
                                            open: true,
                                            key: provider.name || key,
                                            name: provider.name || key,
                                        };
                                    }}>×</button
                                >
                                <label class="switch">
                                    <input
                                        type="checkbox"
                                        checked={provider.enabled !== false}
                                        onchange={(e) =>
                                            updateConfig(
                                                `generic_providers.${key}.enabled`,
                                                /** @type {HTMLInputElement} */ (
                                                    e.target
                                                ).checked,
                                            )}
                                    />
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="provider-options">
                            <span class="subtext url-text"
                                >{provider.search_url}</span
                            >
                            {#if (provider && provider.hasOwnProperty("sort")) || (provider && provider.search_url && provider.search_url.includes("reddit.com"))}
                                <select
                                    class="small-select"
                                    value={provider.sort || "hot"}
                                    onchange={(e) =>
                                        updateConfig(
                                            `generic_providers.${key}.sort`,
                                            /** @type {HTMLSelectElement} */ (
                                                e.target
                                            ).value,
                                        )}
                                >
                                    <option value="new">new</option>
                                    <option value="hot">hot</option>
                                    <option value="top">top</option>
                                    <option value="controversial"
                                        >controversial</option
                                    >
                                    <option value="mix">mix</option>
                                </select>
                            {/if}
                        </div>
                    </div>
                {/each}

                <!-- Add Provider form condensed -->
                <div class="add-provider">
                    <h4>{$t("settings.providers.add")}</h4>
                    <input
                        type="text"
                        placeholder="Nombre (ej: wallpapers)"
                        bind:value={newProvider.name}
                    />
                    <div class="input-with-label">
                        <input
                            type="text"
                            placeholder={$t(
                                "settings.providers.url_placeholder",
                            )}
                            bind:value={newProvider.url}
                        />
                        {#if newProvider.url
                            .trim()
                            .toLowerCase()
                            .startsWith("r/")}
                            <span class="badge"
                                >{$t(
                                    "settings.providers.reddit_detected",
                                )}</span
                            >
                        {/if}
                    </div>

                    {#if newProvider.url.trim().toLowerCase().startsWith("r/")}
                        <select bind:value={newProvider.key}>
                            <option value="hot">hot</option>
                            <option value="new">new</option>
                            <option value="top">top</option>
                            <option value="controversial">controversial</option>
                            <option value="mix">mix</option>
                        </select>
                    {/if}

                    <button
                        onclick={() => {
                            if (
                                newProvider.url
                                    .trim()
                                    .toLowerCase()
                                    .startsWith("r/")
                            ) {
                                let sub = newProvider.url.trim().substring(2);
                                gower.addRedditProvider(
                                    sub,
                                    newProvider.key || "hot",
                                );
                            } else {
                                gower.addProvider(
                                    newProvider.name,
                                    newProvider.url,
                                    "",
                                );
                            }
                            newProvider = { name: "", url: "", key: "" };
                            setTimeout(() => dispatch("refresh"), 500);
                        }}>{$t("settings.providers.add_btn")}</button
                    >
                </div>
            </div>
        </div>
    {/if}

    {#if providerToDelete.open}
        <div
            class="modal-overlay"
            transition:fade={{ duration: 150 }}
            onclick={() => (providerToDelete.open = false)}
            onkeydown={(e) =>
                e.key === "Escape" && (providerToDelete.open = false)}
            role="presentation"
        >
            <div
                class="modal"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                tabindex="-1"
            >
                <h3>{$t("settings.delete_provider.title")}</h3>
                <p class="subtext">
                    {$t("settings.delete_provider.confirm")}
                    <b>{providerToDelete.name}</b>?
                </p>
                <div class="modal-actions">
                    <button
                        class="btn-secondary"
                        onclick={() => (providerToDelete.open = false)}
                        >{$t("settings.delete_provider.cancel")}</button
                    >
                    <button
                        class="btn-danger"
                        onclick={async () => {
                            const name = providerToDelete.key; // Keep for context
                            try {
                                const result = await gower.removeProvider(name);
                                providerToDelete.open = false;
                                dispatch("refresh");
                            } catch (e) {
                                console.error("[SETTINGS] Remove failed:", e);
                                providerToDelete.open = false;
                                dispatch("refresh");
                            }
                        }}>{$t("settings.delete_provider.delete")}</button
                    >
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .settings-panel {
        height: 100%;
        overflow-y: auto;
        padding-right: 4px;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-s);
    }

    h3 {
        margin: 0;
        margin-bottom: var(--spacing-s);
        font-size: 1rem;
        color: var(--primary);
    }
    h4 {
        margin: var(--spacing-s) 0;
        font-size: 0.9rem;
        opacity: 0.8;
    }

    .section {
        padding: var(--spacing-m);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-s);
    }

    .clickable {
        cursor: pointer;
        transition: transform 0.2s;
    }
    .clickable:hover {
        transform: scale(1.02);
    }

    .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-height: 32px;
    }

    .col {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .status-control {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .status-text {
        font-size: 0.75rem;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--on-surface-variant);
        opacity: 0.5;
    }
    .status-text.active {
        background: rgba(187, 134, 252, 0.1);
        color: var(--primary);
        opacity: 1;
    }
    .status-text.transitioning {
        animation: pulse 1.5s infinite;
        opacity: 0.8;
    }

    @keyframes pulse {
        0% {
            opacity: 0.4;
        }
        50% {
            opacity: 0.8;
        }
        100% {
            opacity: 0.4;
        }
    }

    /* Switch Style */
    .switch {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
        flex-shrink: 0;
    }
    .switch.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .switch.disabled .slider {
        cursor: not-allowed;
    }
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--on-surface-variant);
        opacity: 0.3;
        transition: 0.4s;
        border-radius: 20px;
    }
    input:checked + .slider {
        background-color: var(--primary);
        opacity: 1;
    }
    .slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.4s;
        border-radius: 50%;
    }
    input:checked + .slider {
        background-color: var(--primary);
    }
    input:checked + .slider:before {
        transform: translateX(16px);
    }

    .input-group {
        display: flex;
        gap: var(--spacing-s);
    }
    .input-group input {
        flex: 1;
    }

    .provider-api-key {
        width: 100%;
        margin-top: var(--spacing-s);
    }

    .subtext {
        font-size: 0.8rem;
        opacity: 0.6;
    }
    .version {
        text-align: center;
        opacity: 0.3;
        font-size: 0.7rem;
        margin-top: auto;
    }

    .header-row {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        margin-bottom: var(--spacing-m);
        min-height: 40px;
    }
    .back-btn {
        position: absolute;
        left: 0;
        background: transparent;
        color: var(--primary);
        font-weight: bold;
    }
    .title-centered {
        margin: 0;
        font-size: 1rem;
        color: var(--primary);
    }

    .provider-item {
        background: rgba(255, 255, 255, 0.05);
        padding: 8px;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    .provider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }
    .provider-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 4px;
    }
    .provider-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .small-select {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--glass-border);
        border-radius: 4px;
        font-size: 0.8rem;
        padding: 2px 4px;
        color: var(--on-surface);
    }
    .url-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
    }

    .add-provider {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 8px;
    }
    .input-with-label {
        position: relative;
        width: 100%;
    }
    .badge {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: var(--primary);
        color: black;
        font-size: 0.65rem;
        font-weight: bold;
        padding: 2px 6px;
        border-radius: 4px;
        pointer-events: none;
    }

    .add-provider input {
        width: 100%;
    }
    .add-provider select {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        padding: 6px;
        border-radius: 4px;
    }
    .add-provider button {
        background: var(--primary);
        color: black;
        padding: 6px;
        border-radius: 4px;
        font-weight: bold;
        width: 100%;
    }

    .small-btn.danger {
        color: var(--on-surface-variant);
        font-size: 1.1rem;
        padding: 4px 8px;
        background: transparent;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.2s;
    }
    .small-btn.danger:hover {
        color: var(--error);
        opacity: 1;
        transform: scale(1.1);
    }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85); /* Darker backdrop, no blur */
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        padding: var(--spacing-m);
    }
    .modal {
        background: var(--surface-container-high);
        border: 2px solid var(--outline);
        border-radius: var(--radius-m);
        width: 100%;
        max-width: 320px;
        padding: var(--spacing-l);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-m);
        align-items: center;
        text-align: center;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    @keyframes scaleIn {
        from {
            transform: scale(0.9);
            opacity: 0;
        }
        to {
            transform: scale(1);
            opacity: 1;
        }
    }
    .modal-actions {
        display: flex;
        gap: var(--spacing-m);
        width: 100%;
    }
    .modal-actions button {
        flex: 1;
        padding: 10px;
        border-radius: var(--radius-m);
        font-weight: bold;
        cursor: pointer;
        border: none;
    }
    .btn-secondary {
        background: var(--surface-container-highest);
        color: var(--on-surface);
    }
    .btn-danger {
        background: var(--error);
        color: white;
    }
</style>
