<script>
    import { gower } from "$lib/api";
    import { createEventDispatcher } from "svelte";
    import { slide } from "svelte/transition";

    const dispatch = createEventDispatcher();

    export let config = null;
    export let status = null;

    let showProviders = false;
    let newProvider = { name: "", url: "", key: "" };

    function updateConfig(key, value) {
        // Optimistic update
        const keys = key.split(".");
        if (keys.length === 2) {
            config[keys[0]][keys[1]] = value;
        }
        gower.setConfig(key, value);
    }

    async function toggleDaemon() {
        const newState = !status?.daemon_running;
        await gower.toggleDaemon(newState);
        dispatch("refresh");
    }

    const builtInProviders = ["wallhaven", "reddit"]; // Example, should come from config keys

    import { open } from "@tauri-apps/plugin-dialog";

    async function pickWallpaperFolder() {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: config.paths.wallpapers || undefined,
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
                <button
                    class="toggle-btn"
                    class:active={status?.daemon_running}
                    onclick={toggleDaemon}
                >
                    {status?.daemon_running ? "ACTIVO" : "INACTIVO"}
                </button>
            </div>
            <div class="row">
                <span>Intervalo (minutos)</span>
                <input
                    type="number"
                    value={config?.behavior?.change_interval || 30}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.change_interval",
                            parseInt(e.target.value),
                        )}
                />
            </div>
            <div class="row">
                <span>Auto Descarga</span>
                <input
                    type="checkbox"
                    checked={config?.behavior?.auto_download || false}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.auto_download",
                            e.target.checked,
                        )}
                />
            </div>
        </div>

        <div class="section glass-card">
            <h3>Comportamiento</h3>
            <div class="row">
                <span>Respetar Modo Oscuro</span>
                <input
                    type="checkbox"
                    checked={config?.behavior?.respect_dark_mode || false}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.respect_dark_mode",
                            e.target.checked,
                        )}
                />
            </div>
            <div class="row">
                <span>Solo Favoritos</span>
                <input
                    type="checkbox"
                    checked={config?.behavior?.from_favorites || false}
                    onchange={(e) =>
                        updateConfig(
                            "behavior.from_favorites",
                            e.target.checked,
                        )}
                />
            </div>
            <div class="row">
                <span>Pausar con Batería Baja</span>
                <input
                    type="checkbox"
                    checked={config?.power?.pause_on_low_battery || false}
                    onchange={(e) =>
                        updateConfig(
                            "power.pause_on_low_battery",
                            e.target.checked,
                        )}
                />
            </div>
            <div class="row">
                <span>Umbral Batería (%)</span>
                <input
                    type="number"
                    value={config?.power?.low_battery_threshold || 20}
                    onchange={(e) =>
                        updateConfig(
                            "power.low_battery_threshold",
                            parseInt(e.target.value),
                        )}
                />
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
                    <button class="icon-btn" onclick={pickWallpaperFolder}
                        >📂</button
                    >
                </div>
            </div>
            <div class="row">
                <span>Indexar Carpeta</span>
                <input
                    type="checkbox"
                    checked={config?.paths?.index_wallpapers || false}
                    onchange={(e) =>
                        updateConfig(
                            "paths.index_wallpapers",
                            e.target.checked,
                        )}
                />
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
                <button class="back-btn" onclick={() => (showProviders = false)}
                    >← Volver</button
                >
                <h3>Providers</h3>
            </div>

            <div class="providers-list">
                {#each Object.entries(config.providers || {}) as [key, provider]}
                    <div class="provider-item">
                        <div class="provider-header">
                            <span class="provider-name"
                                >{provider.name || key}</span
                            >
                            <input
                                type="checkbox"
                                checked={provider.enabled}
                                onchange={(e) =>
                                    updateConfig(
                                        `providers.${key}.enabled`,
                                        e.target.checked,
                                    )}
                            />
                        </div>
                        {#if provider.hasOwnProperty("api_key")}
                            <input
                                class="provider-api-key"
                                type="password"
                                placeholder="API Key"
                                value={provider.api_key}
                                onchange={(e) =>
                                    updateConfig(
                                        `providers.${key}.api_key`,
                                        e.target.value,
                                    )}
                            />
                        {/if}
                    </div>
                {/each}

                <h4>Custom Providers</h4>
                {#each Object.entries(config.generic_providers || {}) as [key, provider]}
                    <div class="provider-item">
                        <div class="provider-header">
                            <span class="provider-name"
                                >{provider.name || key}</span
                            >
                            <button
                                class="small-btn danger"
                                onclick={() => gower.removeProvider(key)}
                                >×</button
                            >
                        </div>
                        <div class="provider-header">
                            <span class="subtext">{provider.search_url}</span>
                            <input
                                type="checkbox"
                                checked={provider.enabled}
                                onchange={(e) =>
                                    updateConfig(
                                        `generic_providers.${key}.enabled`,
                                        e.target.checked,
                                    )}
                            />
                        </div>
                    </div>
                {/each}

                <!-- Add Provider form condensed -->
                <div class="add-provider">
                    <h4>Añadir Custom</h4>
                    <input
                        type="text"
                        placeholder="Nombre"
                        bind:value={newProvider.name}
                    />
                    <input
                        type="text"
                        placeholder="URL / r/subreddit"
                        bind:value={newProvider.url}
                    />
                    <button
                        onclick={() => {
                            gower.addProvider(
                                newProvider.name,
                                newProvider.url,
                                "",
                            );
                            newProvider = { name: "", url: "" };
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
    }

    .col {
        display: flex;
        flex-direction: column;
        gap: 4px;
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

    .toggle-btn {
        background: var(--surface-container-highest);
        color: var(--on-surface-variant);
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: bold;
    }
    .toggle-btn.active {
        background: var(--primary);
        color: var(--on-primary);
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
        gap: 10px;
        margin-bottom: 10px;
    }
    .back-btn {
        background: transparent;
        color: var(--primary);
        font-weight: bold;
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
    }
    .provider-name {
        font-weight: bold;
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
    .add-provider input {
        width: 100%;
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
