<script>
    import { gower } from "$lib/api";
    import { t } from "$lib/stores/i18n";
    import { fade } from "svelte/transition";

    /**
     * @type {{
     *   config: any,
     *   updateConfig: (key: string, value: any) => void,
     *   onrefresh?: () => void,
     *   onclose?: () => void,
     *   newProvider?: { name: string, url: string, key: string },
     * }}
     */
    let {
        config,
        updateConfig,
        onrefresh,
        onclose,
        // Vive en el padre para que el formulario no se vacíe al salir y
        // volver a la sub-vista, como ocurría antes de trocear el panel.
        newProvider = $bindable({ name: "", url: "", key: "" }),
    } = $props();

    let providerToDelete = $state({ open: false, key: "", name: "" });
</script>

<div class="section">
    <div class="header-row">
        <button class="back-btn icon-btn" onclick={() => onclose?.()}>
            <span class="material-icons">arrow_back</span>
        </button>
        <h3 class="title-centered">{$t("settings.providers.title")}</h3>
    </div>

    <div class="providers-list">
        {#each Object.entries(config?.providers || {}) as [key, provider]}
            <div class="provider-item">
                <div class="provider-header">
                    <span class="provider-name">{provider.name || key}</span>
                    <label class="switch">
                        <input
                            type="checkbox"
                            checked={provider.enabled === true}
                            onchange={(e) =>
                                updateConfig(
                                    `providers.${key}.enabled`,
                                    /** @type {HTMLInputElement} */ (e.target)
                                        .checked,
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
                                    /** @type {HTMLSelectElement} */ (e.target)
                                        .value,
                                )}
                        >
                            <option value="new">new</option>
                            <option value="hot">hot</option>
                            <option value="top">top</option>
                            <option value="controversial">controversial</option>
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
                                    /** @type {HTMLInputElement} */ (e.target)
                                        .value,
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
                    <span class="provider-name">{provider.name || key}</span>
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
                                    /** @type {HTMLSelectElement} */ (e.target)
                                        .value,
                                )}
                        >
                            <option value="new">new</option>
                            <option value="hot">hot</option>
                            <option value="top">top</option>
                            <option value="controversial">controversial</option>
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
                    placeholder={$t("settings.providers.url_placeholder")}
                    bind:value={newProvider.url}
                />
                {#if newProvider.url.trim().toLowerCase().startsWith("r/")}
                    <span class="badge"
                        >{$t("settings.providers.reddit_detected")}</span
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
                    if (newProvider.url.trim().toLowerCase().startsWith("r/")) {
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
                    setTimeout(() => onrefresh?.(), 500);
                }}>{$t("settings.providers.add_btn")}</button
            >
        </div>
    </div>
</div>

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
                            await gower.removeProvider(name);
                            providerToDelete.open = false;
                            onrefresh?.();
                        } catch (e) {
                            console.error("[SETTINGS] Remove failed:", e);
                            providerToDelete.open = false;
                            onrefresh?.();
                        }
                    }}>{$t("settings.delete_provider.delete")}</button
                >
            </div>
        </div>
    </div>
{/if}
