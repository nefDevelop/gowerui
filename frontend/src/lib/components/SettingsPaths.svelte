<script>
    import {
        getGowerStatus,
        pickDirectory,
        pickGowerBinary,
        setCustomGowerPath,
    } from "$lib/api";
    import { t, locale } from "$lib/stores/i18n";
    import { notifications } from "$lib/stores/notifications";
    import { onMount } from "svelte";

    /**
     * @type {{
     *   config: any,
     *   updateConfig: (key: string, value: any) => void,
     *   onrefresh?: () => void,
     * }}
     */
    let { config, updateConfig, onrefresh } = $props();

    /**
     * Dónde está el binario de gower. null mientras no se ha consultado.
     * @type {{resolved_path: string, configured_path: string, available: boolean, error: string} | null}
     */
    let gowerStatus = $state(null);
    let savingGowerPath = $state(false);

    onMount(async () => {
        gowerStatus = await getGowerStatus();
    });

    /** Refresca el estado del sidecar, p. ej. tras cambiar la ruta. */
    async function refreshGowerStatus() {
        gowerStatus = await getGowerStatus();
    }

    async function browseGowerPath() {
        try {
            const selected = await pickGowerBinary(
                $t("settings.gower_path_dialog"),
            );
            if (!selected) return;
            await applyGowerPath(selected);
        } catch (e) {
            console.error("[SETTINGS] Failed to open gower dialog:", e);
        }
    }

    async function clearGowerPath() {
        try {
            await applyGowerPath("");
        } catch (e) {
            console.error("[SETTINGS] Failed to clear gower path:", e);
        }
    }

    /**
     * Guarda la ruta indicada y refleja el resultado en la UI.
     * @param {string} path
     */
    async function applyGowerPath(path) {
        savingGowerPath = true;
        try {
            await setCustomGowerPath(path);
            await refreshGowerStatus();
            onrefresh?.();
            notifications.add(
                path
                    ? $t("settings.gower_path_saved")
                    : $t("settings.gower_path_cleared"),
                "success",
            );
        } catch (err) {
            await refreshGowerStatus();
            notifications.add($t("settings.gower_path_invalid"), "error");
        } finally {
            savingGowerPath = false;
        }
    }

    async function pickWallpaperFolder() {
        try {
            const selected = await pickDirectory(
                $t("settings.wallpapers_folder"),
            );
            if (selected) {
                updateConfig("paths.wallpapers", selected);
            }
        } catch (e) {
            // console.error("Failed to open dialog:", e);
        }
    }
</script>

<div class="section glass-card">
    <h3>{$t("settings.gower_path")}</h3>
    <div class="col">
        <div
            class="gower-path-status"
            data-available={gowerStatus?.available}
        >
            {#if !gowerStatus}
                <span class="material-icons spinner">progress_activity</span>
            {:else if gowerStatus.available}
                <span class="material-icons ok">check_circle</span>
                <span class="path" title={gowerStatus.resolved_path}>
                    {gowerStatus.resolved_path}
                </span>
            {:else}
                <span class="material-icons missing">error_outline</span>
                <span class="path">
                    {$t("settings.gower_path_not_found")}
                </span>
            {/if}
        </div>

        <p class="subtext">
            {#if gowerStatus?.configured_path}
                {$t("settings.gower_path")}:
                <code>{gowerStatus.configured_path}</code>
            {:else}
                {$t("settings.gower_path_auto")}
            {/if}
        </p>

        {#if gowerStatus && !gowerStatus.available}
            <p class="subtext error-text">{gowerStatus.error}</p>
        {/if}

        <div class="gower-path-actions">
            <button
                class="btn-secondary"
                onclick={browseGowerPath}
                disabled={savingGowerPath}
            >
                {$t("settings.gower_path_browse")}
            </button>
            {#if gowerStatus?.configured_path}
                <button
                    class="btn-secondary"
                    onclick={clearGowerPath}
                    disabled={savingGowerPath}
                >
                    {$t("settings.gower_path_clear")}
                </button>
            {/if}
        </div>
    </div>
</div>

<div class="section glass-card">
    <h3>{$t("settings.general")}</h3>
    <div class="row">
        <span>{$t("language")}</span>
        <select
            value={$locale}
            onchange={(e) =>
                locale.set(/** @type {HTMLSelectElement} */ (e.target).value)}
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
                        /** @type {HTMLInputElement} */ (e.target).checked,
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
                        /** @type {HTMLInputElement} */ (e.target).checked,
                    )}
            />
            <span class="slider"></span>
        </label>
    </div>
</div>
