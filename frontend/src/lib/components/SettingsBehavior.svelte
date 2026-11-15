<script>
    import { checkBattery } from "$lib/api";
    import { t } from "$lib/stores/i18n";
    import { theme } from "$lib/stores/theme";
    import { onMount } from "svelte";

    /**
     * @type {{
     *   config: any,
     *   updateConfig: (key: string, value: any) => void,
     * }}
     */
    let { config, updateConfig } = $props();

    let hasBattery = $state(false);

    onMount(async () => {
        hasBattery = await checkBattery();
    });
</script>

<div class="section glass-card">
    <h3>{$t("settings.behavior")}</h3>
    <div class="row">
        <span>{$t("settings.theme")}</span>
        <select
            value={$theme}
            onchange={(e) => {
                const val = /** @type {HTMLSelectElement} */ (e.target).value;
                theme.set(/** @type {import('$lib/stores/theme').Theme} */ (val));
            }}
        >
            <option value="system">{$t("settings.theme.system")}</option>
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
                        /** @type {HTMLInputElement} */ (e.target).checked,
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
                checked={config?.behavior?.save_favorites_to_folder || false}
                onchange={(e) =>
                    updateConfig(
                        "behavior.save_favorites_to_folder",
                        /** @type {HTMLInputElement} */ (e.target).checked,
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
                    checked={config?.power?.pause_on_low_battery || false}
                    onchange={(e) =>
                        updateConfig(
                            "power.pause_on_low_battery",
                            /** @type {HTMLInputElement} */ (e.target).checked,
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
                            /** @type {HTMLInputElement} */ (e.target).value,
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
            <option value="distinct">{$t("settings.monitor.distinct")}</option>
            <option value="clone">{$t("settings.monitor.clone")}</option>
        </select>
    </div>
</div>
