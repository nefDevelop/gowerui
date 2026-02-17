<script>
    import { gower, checkBattery } from "$lib/api";
    import { createEventDispatcher, onMount } from "svelte";
    import { slide } from "svelte/transition";

    /** @type {{config: any, status: any}} */
    let { config = $bindable(), status } = $props();

    const dispatch = createEventDispatcher();

    let showProviders = $state(false);
    let newProvider = $state({ name: "", url: "", key: "" });
    let hasBattery = $state(false);

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
            console.error("Daemon toggle failed:", err);
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
            console.error("Failed to open dialog:", e);
        }
    }
</script>

<div class="settings-panel premium-scroll">
    {#if !showProviders}
        <div class="section glass-card">
            <h3>Daemon</h3>
            <div class="row">
                <span>Estado del servicio</span>
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
                                ? "INICIANDO..."
                                : "DETENIENDO..."}
                        {:else}
                            {status?.daemon_running ||
                            status?.daemon?.running ||
                            status?.running
                                ? "ACTIVO"
                                : "INACTIVO"}
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
                <span>Intervalo (minutos)</span>
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
                <span>Auto Descarga</span>
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
            <h3>Comportamiento</h3>
            <div class="row">
                <span>Respetar Modo Oscuro</span>
                <label class="switch">
                    <input
                        type="checkbox"
                        checked={config?.behavior?.respect_dark_mode || false}
                        onchange={(e) =>
                            updateConfig(
                                "behavior.respect_dark_mode",
                                /** @type {HTMLInputElement} */ (e.target)
                                    .checked,
                            )}
                    />
                    <span class="slider"></span>
                </label>
            </div>
            <div class="row">
                <span>Solo Favoritos</span>
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
                <span>Guardar favoritos en carpeta</span>
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
                    <span>Pausar con Batería Baja</span>
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
                    <span>Umbral Batería (%)</span>
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
            <h3>Display</h3>
            <div class="row">
                <span>Modo Multi-Monitor</span>
                <select
                    value={config?.behavior?.multi_monitor || "distinct"}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.multi_monitor",
                            /** @type {HTMLSelectElement} */ (e.target).value,
                        )}
                >
                    <option value="distinct">Independiente (Distinct)</option>
                    <option value="clone">Clonar (Clone)</option>
                </select>
            </div>
        </div>

        <div class="section glass-card">
            <h3>General</h3>
            <div class="col">
                <span>Carpeta de Wallpapers</span>
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
                <span>Usar Directorio del Sistema</span>
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
                <span>Indexar Carpeta</span>
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
            <h3>Providers &nbsp; ›</h3>
            <p class="subtext">Configurar fuentes de wallpapers</p>
        </button>

        <div class="version">Version 1.1.0</div>
    {:else}
        <!-- PROVIDERS SUB-VIEW -->
        <div class="section glass-card" transition:slide>
            <div class="header-row">
                <button
                    class="back-btn icon-btn"
                    onclick={() => (showProviders = false)}
                >
                    <span class="material-icons">arrow_back</span>
                </button>
                <h3 class="title-centered">Providers</h3>
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
                                    checked={status?.providers?.[key] === true}
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

                <h4>Custom Providers</h4>
                {#each Object.entries(config?.generic_providers || {}) as [key, provider]}
                    <div class="provider-item">
                        <div class="provider-header">
                            <span class="provider-name"
                                >{provider.name || key}</span
                            >
                            <div class="provider-actions">
                                <button
                                    class="small-btn danger"
                                    onclick={() => gower.removeProvider(key)}
                                    >×</button
                                >
                                <label class="switch">
                                    <input
                                        type="checkbox"
                                        checked={provider.enabled}
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
                    <h4>Añadir Custom</h4>
                    <input
                        type="text"
                        placeholder="Nombre (ej: wallpapers)"
                        bind:value={newProvider.name}
                    />
                    <div class="input-with-label">
                        <input
                            type="text"
                            placeholder="URL o r/subreddit"
                            bind:value={newProvider.url}
                        />
                        {#if newProvider.url
                            .trim()
                            .toLowerCase()
                            .startsWith("r/")}
                            <span class="badge">Reddit Detectado</span>
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
                        }}>Añadir</button
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
        color: var(--error);
        font-size: 1.2rem;
        padding: 0 4px;
    }
</style>
