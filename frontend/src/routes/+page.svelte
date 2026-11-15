<script>
    import { onDestroy, onMount, tick, untrack } from "svelte";
    import { writable } from "svelte/store";
    import { fade } from "svelte/transition";
    import { t } from "$lib/stores/i18n";
    import { theme } from "$lib/stores/theme";
    import { gower, getAppContext, mapThumbnails, checkFileExists, normalizeId, wallpaperTarget } from "$lib/api";

    import ColorBar from "$lib/components/ColorBar.svelte";
    import SettingsPanel from "$lib/components/SettingsPanel.svelte";
    import SearchPanel from "$lib/components/SearchPanel.svelte";
    import SortBar from "$lib/components/SortBar.svelte";
    import CurrentWallpapersBar from "$lib/components/CurrentWallpapersBar.svelte";
    import DeleteDialog from "$lib/components/DeleteDialog.svelte";
    import WallpaperGrid from "$lib/components/WallpaperGrid.svelte";
    import { notifications as notificationsStore } from "$lib/stores/notifications";
    import { createFeedStore, createFavoritesStore } from "$lib/stores/wallpapers";
    import { createSearchSession } from "$lib/stores/search-session";
    import { createDialogState } from "$lib/stores/dialogs";

    // El color es compartido: el mismo filtro se aplica al feed y a favoritos.
    const selectedColor = writable("");
    const feed = createFeedStore({ color: selectedColor });
    const favorites = createFavoritesStore({ color: selectedColor });

    let currentTab = $state("home");
    /** @type {any[]} */
    let currentWallpapers = $state([]); // Active wallpapers
    /** @type {any[]} */
    let monitors = $state([]);

    /** @type {{cache_path: string, config_path: string, user_home: string} | null} */
    let appContext = $state(null);

    // Búsqueda persistida: se restaura en el arranque y caduca a los 15 min.
    // El guardado automático vive en el store.
    const search = createSearchSession();
    const {
        results: searchResults,
        query: searchQuery,
        page: searchPage,
        provider: selectedProvider,
        lastSearchTime,
    } = search;

    // Modal, menú contextual y diálogo de borrado.
    const dialogs = createDialogState();
    const {
        previewItem,
        previewOpen,
        contextMenu,
        deleteOpen: deleteDialogOpen,
        itemToDelete,
    } = dialogs;

    const sortOptions = [
        { value: "Smart", label: "sort.smart" },
        { value: "Newest", label: "sort.newest" },
        { value: "Oldest", label: "sort.oldest" },
        { value: "Source", label: "Source" },
        { value: "Unseen", label: "Unseen" },
        { value: "Random", label: "sort.random" },
        { value: "A-Z", label: "sort.a_z" },
        { value: "Z-A", label: "sort.z_a" },
    ];

    const tabs = [
        { id: "home", icon: "home", label: "tabs.home" },
        { id: "search", icon: "search", label: "tabs.search" },
        { id: "favorites", icon: "star", label: "tabs.favorites" },
        { id: "settings", icon: "settings", label: "tabs.settings" },
    ];

    // --- ACTIONS ---

    async function loadCurrentWallpapers() {
        if (!appContext) return;
        try {
            const result = await gower.getStatus();
            if (result && result.wallpaper && result.wallpaper.wallpapers) {
                currentWallpapers = mapThumbnails(
                    result.wallpaper.wallpapers,
                    appContext.cache_path,
                );
            }
            // Optimization: Don't reload monitors every time we refresh wallpapers
            if (monitors.length === 0) {
                await loadMonitors();
            }
            console.log("[loadCurrentWallpapers] Actuales cargados:", currentWallpapers.length);
        } catch (e) {
            console.error("[loadCurrentWallpapers] Error:", e);
        }
    }

    async function loadMonitors() {
        if (!appContext) return;
        try {
            const result = await gower.getMonitors();
            if (result && Array.isArray(result.monitors)) {
                monitors = result.monitors;
            }
        } catch (e) {
            console.error("[loadMonitors] Error:", e);
        }
    }

    /**
     * @param {any} item
     * @param {string} [monitorId]
     */
    async function setWallpaper(item, monitorId = "") {
        if (!item) return;

        try {
            await gower.setWallpaper(
                wallpaperTarget(item, currentTab === "search"),
                monitorId,
            );
            dialogs.closeContextMenu();
            // Refreshed via background event
        } catch (e) { // Keep error for user feedback
            notificationsStore.add("Error al establecer wallpaper", "error");
        }
    }

    /**
     * @param {any} item
     */
    async function handleBlock(item) {
        if (!item) return;
        const snap = $state.snapshot(item);
        try {
            // 1. Identify which monitor is using this wallpaper before removing it
            const affectedMonitorIds = currentWallpapers
                .map((curr, idx) => (curr.id === snap.id ? monitors[idx]?.ID : null))
                .filter(id => id !== null);

            // 2. Wait for blacklist to finish (now synchronous in api.js)
            await gower.blacklist(snap.id);
            
            // 3. Update UI locally for instant feedback
            feed.remove(snap.id);
            favorites.remove(snap.id);
            currentWallpapers = currentWallpapers.filter((i) => i.id !== snap.id);
            search.results.update((items) =>
                items.filter((i) => i.id !== snap.id),
            );
            
            notificationsStore.add("Imagen añadida a la lista negra", "success");

            // 4. Force new wallpaper on affected monitors
            if (affectedMonitorIds.length > 0) {
                notificationsStore.add("Actualizando fondo de escritorio...", "info");
                for (const monitorId of affectedMonitorIds) {
                    await gower.setRandom(monitorId);
                }
                // Final sync after backend stabilizes
                setTimeout(() => loadCurrentWallpapers(), 600);
            }
        } catch (e) {
            notificationsStore.add("Error al añadir a la lista negra", "error");
        }
    }

    /**
     * @param {any} item
     */
    async function handleDownload(item) {
        if (!item) return;
        const snap = $state.snapshot(item);
        // Un solo toast que mutamos de estado a estado. Antes se creaban dos y
        // el segundo heredaba timeout=undefined, así que nunca se eliminaba.
        const toastId = notificationsStore.add("Descargando...", "info", 0);
        try {
            await gower.download(
                snap.origin === "search" || currentTab === "search"
                    ? snap.url || snap.id
                    : snap.id,
            );
            notificationsStore.update(toastId, "Descarga iniciada", "success");
            // Refresh feed happens via background event
        } catch (e) { // Keep error for user feedback
            notificationsStore.update(toastId, "Error al descargar", "error", 5000);
            console.error("Download failed:", e);
        }
    }

    /**
     * @param {any} item
     */
    async function setOnAllMonitors(item) {
        if (!item || monitors.length === 0) return;
        feed.setLoading(true);
        try {
            const target = wallpaperTarget(item, currentTab === "search");
            for (const m of monitors) {
                await gower.setWallpaper(target, m.ID);
            }
            dialogs.closeContextMenu(); // Close context menu after action
        } catch (e) {
            console.error(e);
        } finally {
            feed.setLoading(false);
        }
    }

    /**
     * @param {any} item
     */
    async function openUrl(item) {
        if (!item || !item.url) return;
        try {
            await gower.openPath(item.url);
            dialogs.closeContextMenu(); // Close context menu after action
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @param {any} item
     */
    async function openInSystem(item) {
        if (!item) return;
        const pathOrUrl = item.path || item.url;
        if (!pathOrUrl) return;

        const collectionPath = config?.paths?.wallpapers;

        try {
            if (
                !pathOrUrl.startsWith("http") &&
                !pathOrUrl.startsWith("https")
            ) {
                // Check if it belongs to the collection
                if (collectionPath && pathOrUrl.startsWith(collectionPath)) {
                    await gower.openPath(pathOrUrl);
                    notificationsStore.add("Abriendo en colección...", "info");
                } else {
                    await gower.openPath(pathOrUrl);
                    notificationsStore.add("Abriendo carpeta local...", "info");
                }
            } else {
                // Remote URL
                notificationsStore.add("Abriendo en el navegador...", "info");
            }
            dialogs.closeContextMenu();
        } catch (e) {
            notificationsStore.add("Error al intentar abrir", "error"); // Keep for user feedback
            console.error(e);
        }
    }

    /**
     * Checks if a wallpaper item is downloaded to the user's collection folder.
     * This is an async function because it performs a file system check.
     * @param {any} item
     * @returns {Promise<boolean>}
     */
    async function checkItemDownloadedStatus(item) {
        if (!item || !item.id || !config?.paths?.wallpapers || !item.ext) {
            return false;
        }
        const cleanCollectionPath = config.paths.wallpapers.replace(/\/$/, "");
        const potentialCollectionFilePath = `${cleanCollectionPath}/${item.id}${item.ext.startsWith(".") ? item.ext : `.${item.ext}`}`;
        return await checkFileExists(potentialCollectionFilePath);
    }

    /**
     * @param {any} item
     */
    async function handlePreview(item) {
        dialogs.openPreview({
            ...item,
            isDownloaded: await checkItemDownloadedStatus(item),
        });
    }

    /**
     * @param {any} item
     * @param {number} x
     * @param {number} y
     */
    function handleContextMenu(item, x, y) {
        dialogs.openContextMenu(item, x, y);
    }

    function closeContextMenu() {
        dialogs.closeContextMenu();
    }

    // --- UTILS ---

    async function handleUndo() {
        try {
            notificationsStore.add("Cambio deshecho", "success");
            await gower.undoWallpaper(); // Now backgrounded in API
            // Refresh happens via event listener in onMount
        } catch (e) {
            notificationsStore.add("Error al deshacer", "error"); // Keep for user feedback
            console.error(e);
        }
    }

    // Default config to ensure UI renders immediately
    const defaultConfig = {
        behavior: {
            change_interval: 30,
            auto_download: false,
            respect_dark_mode: true,
            from_favorites: false,
        },
        power: { pause_on_low_battery: true, low_battery_threshold: 20 },
        paths: { wallpapers: "", index_wallpapers: false },
        providers: {},
        generic_providers: {},
    };

    /** @type {object} */
    let config = $state(defaultConfig);
    /** @type {object} */
    let status = $state({ daemon_running: false });

    let settingsLoading = $state(false);
    async function loadConfig() {
        if (settingsLoading) return;
        settingsLoading = true;
        try {
            // Fetch config and status in parallel
            const [fetchedConfig, fetchedStatus] = await Promise.all([
                gower.getConfig(),
                gower.getStatus(),
            ]);

            if (fetchedConfig && Object.keys(fetchedConfig).length > 0) {
                config = fetchedConfig;
            }

            if (fetchedStatus) {
                status = fetchedStatus;
            }
            console.log("[loadConfig] Configuración y Status cargados.");
        } catch (e) {
            console.error("[loadConfig] Error:", e);
        } finally {
            settingsLoading = false;
        }
    }

    /**
     * @param {any} item
     */
    async function toggleFavorite(item) {
        const normalizedItemId = normalizeId(item.id);
        const isCurrentlyFavorite = $favorites.items.some((f) => normalizeId(f.id) === normalizedItemId);

        try {
            if (isCurrentlyFavorite) {
                // console.log(`[toggleFavorite] Item ${item.id} (normalized: ${normalizedItemId}) is favorite. Removing...`);
                await gower.removeFavorite(item.id);
                notificationsStore.add("Eliminado de favoritos", "info");
            } else {
                // console.log(`[toggleFavorite] Item ${item.id} (normalized: ${normalizedItemId}) is NOT favorite. Adding...`);
                await gower.addFavorite(item.id);
                notificationsStore.add("Añadido a favoritos", "success");
            }
            // Refresh the relevant tab to update the favorite status from the backend
            if (currentTab === "home" || currentTab === "search" || currentTab === "favorites") {
                feed.load({ skipColors: true }); // Skip colors for speed, to update favorite status
                favorites.load(); // Keep both tabs consistent
            }
        } catch (e) { // Keep error for user feedback
            notificationsStore.add("Error al actualizar favoritos", "error");
        }
    }

    /**
     * @param {any} item
     */
    function handleDeleteRequest(item) {
        dialogs.requestDelete(item);
    }

    /**
     * @param {any} item
     */
    async function confirmDelete(item) {
        if (!item) return;
        try {
            // Check which monitor(s) are using this wallpaper by matching ID
            // currentWallpapers[i] maps to monitors[i]
            const affectedMonitorIndices = currentWallpapers
                .map((curr, idx) => (curr.id === item.id ? idx : -1))
                .filter((idx) => idx !== -1);

            await gower.deleteWallpaper(item.id);

            // Update models locally
            feed.remove(item.id);
            currentWallpapers = currentWallpapers.filter(
                (i) => i.id !== item.id,
            );

            // If it was active, set a new random one for each affected monitor
            if (affectedMonitorIndices.length > 0 && monitors.length > 0) {
                notificationsStore.add("Actualizando fondo de escritorio...", "info");
                for (const idx of affectedMonitorIndices) {
                    const monitorId = monitors[idx]?.ID;
                    if (monitorId) {
                        await gower.setRandom(monitorId);
                    }
                }
            }

            // Refresh to fill the grid (refetch the current page)
            // Real refresh will happen via 'gower-command-finished' listener
        } catch (e) {
            // console.error("Failed to delete wallpaper:", e);
        }
    }

    // --- EVENTS ---

    /**
     * @param {WheelEvent} e
     */
    function handleWheel(e) {
        if ($feed.loading || $favorites.loading) return;
        if (currentTab !== "home" && currentTab !== "favorites") return;

        // Prevent default scrolling to handle pages
        e.preventDefault();

        if (e.deltaY > 0) {
            // Scroll down -> Next page
            if (currentTab === "home") {
                feed.load({ page: $feed.page + 1 });
            } else if (currentTab === "favorites") {
                favorites.load({ page: $favorites.page + 1 });
            }
        } else if (e.deltaY < 0) {
            // Scroll up -> Prev page
            if (currentTab === "home" && $feed.page > 1) {
                feed.load({ page: $feed.page - 1 });
            } else if (currentTab === "favorites" && $favorites.page > 1) {
                favorites.load({ page: $favorites.page - 1 });
            }
        }
    }

    /**
     * @param {CustomEvent<string>} e
     */
    function handleColorSelect(e) {
        selectedColor.update((current) =>
            current === e.detail ? "" : e.detail,
        );
        if (currentTab === "home") feed.load({ reset: true });
        if (currentTab === "favorites") favorites.load();
    }

    /** 
     * @param {CustomEvent<string>} e
     */
    function handleSort(e) {
        feed.setSort(e.detail);
        feed.load({ reset: true });
    }
    
    /**
     * @param {CustomEvent<string>} e
     */
    function handleSortFavorites(e) {
        favorites.setSort(e.detail);
        favorites.load({ page: 1 }); // Reset to page 1 on sort change
    }

    /**
     * @param {CustomEvent<number>} e
     */
    function handlePageManualFavorites(e) {
        favorites.load({ page: e.detail });
    }

    /**
     * @param {CustomEvent<number>} e
     */
    function handlePageManual(e) {
        feed.load({ page: e.detail }); // Don't reset to page 1
    }

    $effect(() => {
        // Only react to currentTab change
        const tab = currentTab;
        untrack(() => {
            if (tab === "home") {
                if ($feed.items.length === 0) feed.load();
                // Only load current wallpapers if not already loaded or if tab changes to home
                if (currentWallpapers.length === 0 || currentTab !== "home") {
                    loadCurrentWallpapers(); // Refresh active status
                }
            }
            if (tab === "favorites") favorites.load();

            // Sync daemon status specifically when entering settings
            if (tab === "settings") {
                untrack(() => {
                    if (
                        !config?.behavior ||
                        Object.keys(config.behavior).length === 0
                    ) {
                        loadConfig();
                    } else {
                        // Background refresh only
                        loadConfig();
                    }
                });
            }

            // Check search expiration (15 minutes across sessions)
            search.expire();
        });
    });

    onMount(() => {
        let unlistenCommand;
        let unlistenCommandFailed;

        async function init() {
            console.log("[init] Iniciando carga de la aplicación...");
            try {
                // Restore search from localStorage
                search.restore();

                appContext = await getAppContext();
                console.log("[init] AppContext obtenido:", $state.snapshot(appContext));
                // Las listas necesitan cache_path para montar las miniaturas.
                feed.setCachePath(appContext?.cache_path || "");
                favorites.setCachePath(appContext?.cache_path || "");
                await loadConfig(); // Aseguramos que la configuración se cargue antes de los datos que dependen de ella

                // Load all data in parallel without blocking the UI start
                Promise.all([
                    favorites.load(),
                    feed.load(),
                    loadCurrentWallpapers(), // Load current wallpapers
                ]).catch((e) =>
                    console.error("Initialization background load failed:", e),
                );

                // Run update in background if needed
                gower.updateFeed();

                // Los comandos en background fallan fuera del ciclo de la
                // promesa (`setWallpaper` ya devolvió), así que el único canal
                // para contarlo es este evento. Sin él, el usuario veía que la
                // acción no hacía nada y el motivo solo iba al stdout.
                // @ts-ignore
                unlistenCommandFailed = window.runtime.EventsOn(
                    "gower-command-failed",
                    (payload) => {
                        const detail = String(payload?.error || "").trim();
                        notificationsStore.add(
                            detail
                                ? $t("command.failed", { error: detail })
                                : $t("command.failed_no_details"),
                            "error",
                            8000,
                        );
                    },
                );

                // @ts-ignore
                unlistenCommand = window.runtime.EventsOn("gower-command-finished", (args) => {
                    // console.log("[BG_REFRESH] Command finished, refreshing UI:", args);

                    const isBlacklist = args.includes("blacklist");
                    const isSet = args.includes("set");
                    const isDelete = args.includes("delete") || args.includes("wallpaper");
                    const isUndo = args.includes("undo");

                    // 1. Refresh current wallpapers if something changed that could affect them
                    if (isSet || isUndo || isDelete || isBlacklist) {
                        // Give the backend a tiny moment to stabilize status if needed
                        setTimeout(() => loadCurrentWallpapers(), 300);
                    }

                    // 2. Refresh favorites if favorites or blacklist changed
                    if (args.includes("favorites") || isBlacklist || isDelete) {
                        // Only refresh if on the favorites tab, as toggleFavorite already handles optimistic update
                        if (currentTab === "favorites") {
                            favorites.load({ skipColors: isBlacklist || isDelete });
                        }
                        // Phase 2: Background color recalculation if it was a blacklist (only if visible)
                        if ((isBlacklist || isDelete) && currentTab === "favorites") {
                            setTimeout(() => favorites.load(), 600);
                        }
                    }

                    // 3. Refresh home feed if it might have changed
                    if (
                        isBlacklist ||
                        isDelete ||
                        isSet ||
                        args.includes("wallpaper") ||
                        (args.includes("feed") && (args.includes("update") || args.includes("download"))) ||
                        args.includes("download")
                    ) {
                        // Phase 1: Quick fill
                        feed.load({ skipColors: isBlacklist || isDelete });
                        // Phase 2: Background color recalculation if it was a blacklist (only if visible)
                        if ((isBlacklist || isDelete) && currentTab === "home") {
                            setTimeout(() => feed.load(), 600);
                        }
                    }
                });

            } catch (e) { // Keep error for user feedback
                notificationsStore.add("Error de inicialización", "error");
                console.error("[init] Error fatal durante inicialización:", e);
            }
        }

        init();
        
        // Status polling every 15 seconds as fallback
        const pollInterval = setInterval(() => {
            loadCurrentWallpapers();
            if (currentTab === "settings") loadConfig();
        }, 15000);

        return () => {
            clearInterval(pollInterval);
            if (unlistenCommand) unlistenCommand();
            if (unlistenCommandFailed) unlistenCommandFailed();
        };
    });

    // Las suscripciones de guardado del store no deben sobrevivir a la página.
    onDestroy(() => search.dispose());

    function closeApp() {
        // @ts-ignore
        window.go.main.App.CloseApp();
    }
</script>

<main class="app-container">
    <!-- Custom Title Bar -->
    <div class="titlebar">
        <div class="logo" data-wails-drag>Gower</div>
        <div class="drag-spacer" data-wails-drag></div>
        <div class="window-controls">
            <button class="close-btn" onclick={closeApp}
                >×</button
            >
        </div>
    </div>

    <!-- Navigation -->
    <nav class="glass-card">
        {#each tabs as tab}
            <button
                class:active={currentTab === tab.id}
                onclick={() => (currentTab = tab.id)}
            >
                <span class="material-icons">{tab.icon}</span>
                <span class="label">{$t(tab.label)}</span>
            </button>
        {/each}
        <div class="nav-spacer"></div>
        <button
            class="theme-toggle"
            onclick={() => theme.toggle()}
            title="Cambiar tema"
        >
            <span class="material-icons theme-icon-light">light_mode</span>
            <span class="material-icons theme-icon-dark">dark_mode</span>
        </button>
    </nav>

    <!-- Content -->
    <div class="content">
        {#if currentTab === "home"}
            <div in:fade class="tab-pane home-layout">
                <div class="top-bar">
                    <ColorBar
                        colors={$feed.colors}
                        selectedColor={$selectedColor}
                        on:select={handleColorSelect}
                    />
                </div>

                <div class="grid-area" onwheel={handleWheel}>
                    <WallpaperGrid
                        items={$feed.items}
                        loading={$feed.loading}
                        favoritesList={$favorites.items}
                        collectionPath={config?.paths?.wallpapers}
                        on:preview={(e) => handlePreview(e.detail)}
                        on:contextmenu={(e) =>
                            handleContextMenu(
                                e.detail.item,
                                e.detail.x,
                                e.detail.y,
                            )}
                        on:favorite={(e) => toggleFavorite(e.detail)}
                        on:block={(e) => handleBlock(e.detail)}
                        on:download={(e) => handleDownload(e.detail)}
                    />
                </div>

                <div class="bottom-bar">
                    <SortBar
                        currentSort={$feed.sort}
                        {sortOptions}
                        currentPage={$feed.page}
                        on:sort={handleSort}
                        on:page={handlePageManual}
                        on:undo={handleUndo}
                    />
                </div>

                <CurrentWallpapersBar
                    {currentWallpapers}
                    favoritesList={$favorites.items}
                    collectionPath={config?.paths?.wallpapers}
                    onfavorite={(item) => toggleFavorite(item)}
                    onblacklist={(item) => handleBlock(item)}
                    onpreview={(item) => handlePreview(item)}
                />
            </div>
        {:else if currentTab === "search"}
            <div in:fade class="tab-pane">
                <SearchPanel
                    {config}
                    {status}
                    {appContext}
                    favoritesModel={$favorites.items}
                    bind:searchResults={$searchResults}
                    bind:searchQuery={$searchQuery}
                    bind:searchPage={$searchPage}
                    bind:selectedProvider={$selectedProvider}
                    bind:lastSearchTime={$lastSearchTime}
                    on:preview={(e) => handlePreview(e.detail)}
                    on:contextmenu={(e) =>
                        handleContextMenu(
                            e.detail.item,
                            e.detail.x,
                            e.detail.y,
                        )}
                    on:block={(e) => handleBlock(e.detail)}
                    on:favorite={(e) => toggleFavorite(e.detail)}
                    on:download={(e) => handleDownload(e.detail)}
                />
            </div>
        {:else if currentTab === "favorites"}
            <div in:fade class="tab-pane home-layout">
                <div class="top-bar" style="margin-bottom: 6px;">
                    <ColorBar
                        colors={$favorites.colors}
                        selectedColor={$selectedColor}
                        on:select={handleColorSelect}
                    />
                </div>
                <div class="grid-area" onwheel={handleWheel}>
                    <!-- Reuse WallpaperGrid for favorites, different type/actions -->
                    <WallpaperGrid
                        items={$favorites.items}
                        loading={$favorites.loading}
                        type="favorites"
                        favoritesList={$favorites.items}
                        collectionPath={config?.paths?.wallpapers}
                        on:preview={(e) => handlePreview(e.detail)}
                        on:contextmenu={(e) =>
                            handleContextMenu(
                                e.detail.item,
                                e.detail.x,
                                e.detail.y,
                            )}
                        on:favorite={(e) => toggleFavorite(e.detail)}
                        on:block={(e) => handleBlock(e.detail)}
                        on:download={(e) => handleDownload(e.detail)}
                    />
                </div>
                {#if $favorites.items.length === 0 && !$favorites.loading}
                    <div class="empty">No tienes favoritos.</div>
                {/if}
                <div class="bottom-bar">
                    <SortBar
                        currentSort={$favorites.sort}
                        {sortOptions}
                        currentPage={$favorites.page}
                        on:sort={handleSortFavorites}
                        on:page={handlePageManualFavorites}
                        on:undo={handleUndo}
                    />
                </div>
            </div>
        {:else if currentTab === "settings"}
            <div in:fade class="tab-pane">
                <SettingsPanel {config} {status} on:refresh={loadConfig} />
            </div>
        {/if}
    </div>

    <DeleteDialog
        open={$deleteDialogOpen}
        item={$itemToDelete}
        on:close={() => dialogs.closeDelete()}
        on:confirm={(e) => confirmDelete(e.detail)}
    />

    <!-- Preview Modal -->
    {#if $previewOpen && $previewItem}
        <div
            class="modal-backdrop"
            onclick={() => dialogs.closePreview()}
            onkeydown={(e) => e.key === "Escape" && dialogs.closePreview()}
            role="presentation"
        >
            <div
                class="preview-modal glass-card"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                tabindex="-1"
            >
                <button
                    class="close-preview-btn"
                    onclick={() => dialogs.closePreview()}
                >
                    <span class="material-icons">close</span>
                </button>
                <img src={$previewItem.thumbnail} alt={$previewItem.id} />
                <div class="preview-info">
                    <div class="preview-header">
                        <h3>ID: {$previewItem.id}</h3>
                        <p class="provider">
                            Provider: {$previewItem.provider &&
                            $previewItem.provider.toLowerCase() !== "local"
                                ? $previewItem.provider
                                : "Local"}
                        </p>
                    </div>

                    <div class="monitor-selection">
                        <p class="section-title">Establecer en:</p>
                        <div class="monitor-buttons">
                            <button
                                class="monitor-chip all"
                                onclick={() => {
                                    setOnAllMonitors($previewItem);
                                    dialogs.closePreview();
                                }}
                            >
                                <span class="material-icons"
                                    >tab_unselected</span
                                >
                                Todos
                            </button>
                            {#each monitors as m}
                                <button
                                    class="monitor-chip"
                                    onclick={() => {
                                        setWallpaper($previewItem, m.ID);
                                        dialogs.closePreview();
                                    }}
                                >
                                    <span class="material-icons"
                                        >{m.Primary ? "star" : "monitor"}</span
                                    >
                                    {m.Name}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <div class="quick-actions">
                        <button
                            onclick={() => {
                                handleBlock($previewItem);
                                dialogs.closePreview();
                            }}
                            title="Añadir a lista negra"
                            class="action-btn block"
                        >
                            <span class="material-icons">visibility_off</span>
                        </button>

                        <button
                            onclick={() => toggleFavorite($previewItem)}
                            title="Favoritos"
                            class="action-btn favorite"
                        >
                            <span
                                class="material-icons"
                                class:active={$favorites.items.some((f) => normalizeId(f.id) === normalizeId($previewItem.id))}
                            >
                                {$favorites.items.some((f) => normalizeId(f.id) === normalizeId($previewItem.id))
                                    ? "favorite" : "favorite_border"}
                            </span>
                        </button>
                        {#if !$previewItem.isDownloaded}
                            <button
                                onclick={() => handleDownload($previewItem)}
                                title="Descargar"
                                class="action-btn"
                            >
                                <span class="material-icons">download</span>
                            </button>
                        {/if}

                        {#if !$previewItem.provider || $previewItem.provider.toLowerCase() === "local"}
                            <button
                                onclick={() => {
                                    handleDeleteRequest($previewItem);
                                    dialogs.closePreview();
                                }}
                                title="Eliminar"
                                class="action-btn delete"
                            >
                                <span class="material-icons">delete</span>
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Context Menu -->
    {#if $contextMenu.open}
        <div
            class="context-menu-backdrop"
            onclick={closeContextMenu}
            onkeydown={(e) => e.key === "Escape" && closeContextMenu()}
            role="presentation"
        >
            <div
                class="context-menu glass-card"
                style="top: {$contextMenu.y}px; left: {$contextMenu.x}px;"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="menu"
                tabindex="-1"
            >
                <button onclick={() => openUrl($contextMenu.item)}>
                    <span class="material-icons">link</span>
                    Abrir URL
                </button>
                <button onclick={() => openInSystem($contextMenu.item)}>
                    <span class="material-icons">folder_open</span>
                    Ver en sistema
                </button>
            </div>
        </div>
    {/if}
</main>
<style>
    .app-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100vw;
        background: var(--background);
        border: none;
        overflow: hidden;
    }

    /* Titlebar */
    .titlebar {
        height: 32px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 var(--spacing-s);
        background: rgba(0, 0, 0, 0.2);
        user-select: none;
    }

    .logo {
        font-weight: 700;
        font-size: 0.9rem;
        color: var(--primary);
        padding-left: 8px;
    }

    .close-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        color: var(--on-surface);
        font-size: 1.2rem;
        cursor: pointer;
        padding-bottom: 2px;
    }
    .close-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--error);
    }

    /* Navigation */
    nav {
        display: flex;
        padding: 0;
        margin: 0 var(--spacing-s) var(--spacing-s) var(--spacing-s);
        background: var(--surface);
        border-radius: var(--radius-m);
        flex-shrink: 0;
        overflow: hidden;
    }

    nav button {
        flex: 1;
        padding: 10px 4px;
        border-radius: 0;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: none;
        background: transparent;
        color: var(--surface-variant-text);
        cursor: pointer;
        transition: color 0.2s;
        position: relative;
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
    }

    nav button:hover {
        background: transparent;
        color: var(--on-surface);
    }

    nav button.active {
        background: transparent;
        color: var(--primary);
    }

    nav button.active::after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: var(--primary);
        border-radius: 2px 2px 0 0;
    }

    nav button .material-icons {
        font-size: 18px;
    }

    /* Content Area */
    .content {
        flex: 1;
        overflow: hidden;
        position: relative;
        padding: 0 var(--spacing-s) var(--spacing-s) var(--spacing-s);
        display: flex;
        flex-direction: column;
    }

    .tab-pane {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        min-height: 0;
    }

    /* Modals & Context Menu */
    .modal-backdrop,
    .context-menu-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.7);
    }

    .context-menu-backdrop {
        background: transparent;
        backdrop-filter: none;
    }

    .preview-modal {
        position: relative;
        width: 85%;
        max-width: 400px;
        background: var(--surface);
        padding: 0;
        border-radius: var(--radius-l);
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }

    .close-preview-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 10;
        transition: background 0.2s;
    }

    .close-preview-btn:hover {
        background: var(--error);
    }

    .preview-modal img {
        width: 100%;
        aspect-ratio: 16/9;
        object-fit: cover;
    }

    .preview-info {
        padding: var(--spacing-m);
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .preview-header h3 {
        margin: 0;
        font-size: 16px;
        color: var(--on-surface);
    }

    .preview-header .provider {
        margin: 4px 0 0 0;
        font-size: 13px;
        opacity: 0.6;
    }

    .quick-actions {
        display: flex;
        justify-content: center;
        gap: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--glass-border);
    }

    .action-btn {
        background: var(--surface-container);
        border: 1px solid var(--glass-border);
        color: var(--on-surface);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: var(--primary);
        color: black;
        transform: translateY(-2px);
    }

    .action-btn.delete:hover,
    .action-btn.block:hover {
        background: var(--error);
        color: white;
    }

    .action-btn .material-icons.active {
        color: var(--error);
    }

    .monitor-selection {
        background: var(--surface-container);
        padding: 12px;
        border-radius: var(--radius-m);
    }

    .section-title {
        margin: 0 0 10px 0;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.8;
    }

    .monitor-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .monitor-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: var(--surface-container-high);
        border: 1px solid var(--glass-border);
        border-radius: 20px;
        color: var(--on-surface);
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .monitor-chip:hover {
        background: var(--primary);
        color: black;
        border-color: var(--primary);
    }

    .monitor-chip.all {
        background: var(--surface-container-highest);
        border-color: var(--primary);
        color: var(--primary);
    }
    .monitor-chip.all:hover {
        background: var(--primary);
        color: black;
    }

    .monitor-chip .material-icons {
        font-size: 16px;
    }

    .context-menu {
        position: absolute;
        width: 180px;
        padding: 4px;
        background: var(--surface);
        z-index: 1100;
        border: 1px solid var(--glass-border);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
    }

    .context-menu button {
        width: 100%;
        padding: 10px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        background: transparent;
        border: none;
        color: var(--on-surface);
        cursor: pointer;
        text-align: left;
        border-radius: var(--radius-s);
        font-size: 14px;
    }

    .context-menu button:hover {
        background: var(--surface-hover);
    }

    .context-menu button .material-icons {
        font-size: 18px;
        opacity: 0.7;
    }

    /* Home Layout Specifics */
    .home-layout {
        gap: 4px;
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .grid-area {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }

    .bottom-bar {
        flex-shrink: 0;
        margin-bottom: 2px;
    }

    .empty {
        text-align: center;
        margin-top: 40px;
        opacity: 0.5;
    }

    .material-icons {
        font-size: 20px;
    }
</style>
