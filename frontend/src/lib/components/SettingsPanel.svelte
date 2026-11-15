<script>
    import { gower, getAppVersion, getLogPath, openLogFile } from "$lib/api";
    import { t } from "$lib/stores/i18n";
    import { notifications } from "$lib/stores/notifications";
    import { createEventDispatcher, onMount } from "svelte";
    import "$lib/styles/settings.css";

    import SettingsBehavior from "./SettingsBehavior.svelte";
    import SettingsDaemon from "./SettingsDaemon.svelte";
    import SettingsPaths from "./SettingsPaths.svelte";
    import SettingsProviders from "./SettingsProviders.svelte";

    /** @type {{config: any, status: any}} */
    let { config = $bindable(), status } = $props();

    const dispatch = createEventDispatcher();

    let showProviders = $state(false);
    let newProvider = $state({ name: "", url: "", key: "" });
    let appVersion = $state("");
    /** Ruta del log; se muestra como tooltip del enlace "Open logs". */
    let logPath = $state("");

    onMount(async () => {
        appVersion = await getAppVersion();
        try {
            logPath = await getLogPath();
        } catch (e) {
            console.error("[SETTINGS] Failed to resolve the log path:", e);
        }
    });

    /**
     * Actualiza config de forma optimista y la persiste con gower. Vive aquí
     * para que todos los subcomponentes compartan una sola implementación.
     * @param {string} key
     * @param {any} value
     */
    function updateConfig(key, value) {
        const keys = key.split(".");
        if (keys.length === 2) {
            config[keys[0]][keys[1]] = value;
        }
        gower.setConfig(key, value);
    }

    function refresh() {
        dispatch("refresh");
    }

    /**
     * Abre el log de la app con el visor del sistema. Es la vía para que un
     * usuario que lanzó la app desde el menú pueda adjuntar el diagnóstico.
     */
    async function showLogs() {
        try {
            await openLogFile();
        } catch (e) {
            notifications.add(
                $t("settings.logs_error", { error: String(e) }),
                "error",
            );
        }
    }
</script>

<div class="settings-panel premium-scroll">
    {#if !showProviders}
        <SettingsDaemon {config} {status} {updateConfig} onrefresh={refresh} />
        <SettingsBehavior {config} {updateConfig} />
        <SettingsPaths {config} {updateConfig} onrefresh={refresh} />

        <button
            class="section glass-card clickable"
            onclick={() => (showProviders = true)}
        >
            <h3>{$t("settings.providers.title")} &nbsp; ›</h3>
            <p class="subtext">{$t("settings.providers.subtitle")}</p>
        </button>

        <div class="version">
            <span class="version-text"
                >{$t("app.version")} {appVersion}</span
            >
            <button class="logs-btn" title={logPath} onclick={showLogs}>
                {$t("settings.logs_open")}
            </button>
        </div>
    {:else}
        <SettingsProviders
            {config}
            {updateConfig}
            bind:newProvider
            onrefresh={refresh}
            onclose={() => (showProviders = false)}
        />
    {/if}
</div>
