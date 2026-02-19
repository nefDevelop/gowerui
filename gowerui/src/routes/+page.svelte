<script>
    import { onMount, tick, untrack } from "svelte";
    import { t } from "$lib/stores/i18n";
    import { theme } from "$lib/stores/theme";
    import { gower, getAppContext, mapThumbnails, checkFileExists } from "$lib/api";
    import { fade } from "svelte/transition";
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import { listen } from "@tauri-apps/api/event";

    import ColorBar from "$lib/components/ColorBar.svelte";
    import SettingsPanel from "$lib/components/SettingsPanel.svelte";
    import SearchPanel from "$lib/components/SearchPanel.svelte";
    import SortBar from "$lib/components/SortBar.svelte";
    import CurrentWallpapersBar from "$lib/components/CurrentWallpapersBar.svelte";
    import DeleteDialog from "$lib/components/DeleteDialog.svelte";
    import WallpaperGrid from "$lib/components/WallpaperGrid.svelte";

    let currentTab = $state("home");
    /** @type {any[]} */
    let feedModel = $state([]);
    /** @type {any[]} */
    let favoritesModel = $state([]);
    /** @type {any[]} */
    let currentWallpapers = $state([]); // Active wallpapers
    /** @type {any[]} */
    let monitors = $state([]);
    let loading = $state(false);

    /** @type {{cache_path: string, config_path: string, user_home: string} | null} */
    let appContext = $state(null);

    let feedPage = $state(1);
    let currentSort = $state("Smart");
    let selectedColor = $state("");
    /** @type {string[]} */
    let feedColors = $state([]);
    /** @type {string[]} */
    let favoritesColors = $state([]);

    // Search State (Persisted)
    /** @type {any[]} */
    let searchResults = $state([]);
    let searchQuery = $state("");
    let searchPage = $state(1);
    let selectedProvider = $state("wallhaven");
    let lastSearchTime = $state(0);

    // PERSISTENCE: Save search to localStorage
    $effect(() => {
        if (lastSearchTime > 0) {
            localStorage.setItem(
                "gower_search_data",
                JSON.stringify({
                    searchResults,
                    searchQuery,
                    searchPage,
                    selectedProvider,
                    lastSearchTime,
                }),
            );
        }
    });

    // Dialog State
    let deleteDialogOpen = $state(false);
    let itemToDelete = $state(null);

    // Modal & Context Menu State
    /** @type {any} */
    let previewItem = $state(null);
    let previewOpen = $state(false);
    /** @type {any} */
    let contextMenu = $state({ open: false, x: 0, y: 0, item: null });

    const appWindow = getCurrentWindow();

    /** @type {any[]} */
    let notifications = $state([]);

    /**
     * @param {string} message
     * @param {'success' | 'error' | 'info' | 'loading'} type
     * @param {number} [existingId]
     */
    function notify(message, type = "success", existingId = undefined) {
        const id = existingId || Date.now();
        const notification = { id, message, type };

        const index = notifications.findIndex((n) => n.id === id);
        if (index !== -1) {
            notifications[index] = notification;
        } else {
            notifications.push(notification);
        }

        if (type !== "loading") {
            setTimeout(() => {
                notifications = notifications.filter((n) => n.id !== id);
            }, 3500);
        }
        return id;
    }

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

    /**
     * @param {boolean} [reset]
     */
    async function loadHome(reset = false) {
        if (!appContext) return;
        if (reset) {
            feedPage = 1;
        }
        // Only show loading skeletons if we don't have items yet
        if (feedModel.length === 0) loading = true;

        try {
            // Fetch feed and colors in parallel
            const [result, colorsResult] = await Promise.all([
                gower.getFeed(
                    feedPage,
                    9,
                    selectedColor,
                    currentSort.toLowerCase(),
                ),
                gower.getFeedColors(),
            ]);

            /** @type {any[]} */
            let newItems = mapThumbnails(result || [], appContext.cache_path);
            const existingIds = new Set();
            newItems = newItems.filter((i) => !existingIds.has(i.id));

            feedModel = newItems;

            if (Array.isArray(colorsResult)) {
                feedColors = colorsResult;
            }
        } catch (e) {
            console.error("Error loading home feed:", e);
        } finally {
            loading = false;
        }
    }

    let favoritesLoading = $state(false);
    async function loadFavorites() {
        if (!appContext || favoritesLoading) return;

        // Show loading only if empty to avoid flicker
        if (favoritesModel.length === 0) favoritesLoading = true;

        try {
            const [result, colorsResult] = await Promise.all([
                gower.getFavorites(selectedColor),
                gower.getFavoritesColors(),
            ]);

            favoritesModel = mapThumbnails(result || [], appContext.cache_path);

            if (Array.isArray(colorsResult)) {
                favoritesColors = colorsResult;
            }
        } catch (e) {
            console.error("Error loading favorites:", e);
        } finally {
            favoritesLoading = false;
        }
    }

    async function loadCurrentWallpapers() {
        if (!appContext) return;
        try {
            const result = await gower.getCurrentWallpapers();
            if (result && result.wallpaper && result.wallpaper.wallpapers) {
                currentWallpapers = mapThumbnails(
                    result.wallpaper.wallpapers,
                    appContext.cache_path,
                );
            }
            await loadMonitors();
        } catch (e) {
            console.error("Failed to load current wallpapers:", e);
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
            console.error("Failed to load monitors:", e);
        }
    }

    /**
     * @param {any} item
     * @param {string} [monitorId]
     */
    async function setWallpaper(item, monitorId = "") {
        if (!item) return;

        const isLocal =
            item.path &&
            config?.paths?.wallpapers &&
            item.path.startsWith(config.paths.wallpapers);
        const target = isLocal ? item.path : item.id.replace("local_", "");

        try {
            await gower.setWallpaper(target, monitorId);
            contextMenu.open = false;
            // Refreshed via background event
        } catch (e) {
            console.error(e);
        }
    }

    /**
     * @param {any} item
     */
    async function handleBlock(item) {
        if (!item) return;
        const snap = $state.snapshot(item);
        try {
            await gower.blacklist(snap.id);
            // Visual feedback: remove from models
            feedModel = feedModel.filter((i) => i.id !== snap.id);
            if (searchResults) {
                searchResults = searchResults.filter((i) => i.id !== snap.id);
            }
            favoritesModel = favoritesModel.filter((i) => i.id !== snap.id);
            notify("Imagen añadida a la lista negra", "success");

            // Trigger reload to fill gaps and sync state
            if (currentTab === "home") {
                loadHome();
            } else if (currentTab === "favorites") {
                loadFavorites();
            }
        } catch (e) {
            notify("Error al añadir a la lista negra", "error");
            console.error("Failed to blacklist item:", e);
        }
    }

    /**
     * @param {any} item
     */
    async function handleDownload(item) {
        if (!item) return;
        const snap = $state.snapshot(item);
        const nid = notify("Descargando...", "loading");
        try {
            await gower.download(snap.id);
            notify("Descarga iniciada", "success", nid);
            // Refresh feed happens via background event
        } catch (e) {
            notify("Error al descargar", "error", nid);
            console.error("Download failed:", e);
        }
    }

    /**
     * @param {string} id
     * @returns {string}
     */
    function normalizeId(id) {
        if (!id) return "";
        // ID is now stable, but we still strip provider prefixes for consistent comparison
        return String(id)
            .replace(/^(wh_|wallhaven_|reddit_|rd_|bing_|unsplash_|nasa_)/, "")
            .split(/[?#.]/)[0];
    }

    /**
     * @param {string} id
     */
    function isFavorite(id) {
        const nid = normalizeId(id);
        return favoritesModel.some((f) => normalizeId(f.id) === nid);
    }

    /**
     * @param {any} item
     */
    async function setOnAllMonitors(item) {
        if (!item || monitors.length === 0) return;
        loading = true;
        try {
            for (const m of monitors) {
                await gower.setWallpaper(item.id, m.ID);
            }
            contextMenu.open = false;
        } catch (e) {
            console.error(e);
        } finally {
            loading = false;
        }
    }

    /**
     * @param {any} item
     */
    async function openUrl(item) {
        if (!item || !item.url) return;
        try {
            await gower.openPath(item.url);
            contextMenu.open = false;
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
                    notify("Abriendo en colección...", "info");
                } else {
                    await gower.openPath(pathOrUrl);
                    notify("Abriendo carpeta local...", "info");
                }
            } else {
                // Remote URL
                await gower.openPath(pathOrUrl);
                notify("Abriendo en el navegador...", "info");
            }
            contextMenu.open = false;
        } catch (e) {
            notify("Error al intentar abrir", "error");
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
        previewItem = { ...item, isDownloaded: await checkItemDownloadedStatus(item) };
        previewOpen = true;
    }

    /**
     * @param {any} item
     * @param {number} x
     * @param {number} y
     */
    function handleContextMenu(item, x, y) {
        // Adjust menu position if it goes off screen
        const menuWidth = 160;
        const menuHeight = 120;
        let posX = x;
        let posY = y;

        if (x + menuWidth > 480) posX = x - menuWidth;
        if (y + menuHeight > 800) posY = y - menuHeight;

        contextMenu = { open: true, x: posX, y: posY, item };
    }

    function closeContextMenu() {
        contextMenu.open = false;
    }

    // --- UTILS ---

    async function handleUndo() {
        try {
            notify("Cambio deshecho", "success");
            await gower.undoWallpaper(); // Now backgrounded in API
            // Refresh happens via event listener in onMount
        } catch (e) {
            notify("Error al deshacer", "error");
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

    /** @type {any} */
    let config = $state(defaultConfig);
    /** @type {any} */
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
        } catch (e) {
            console.error("Error loading settings:", e);
        } finally {
            settingsLoading = false;
        }
    }

    /**
     * @param {any} item
     */
    async function toggleFavorite(item) {
        if (currentTab === "favorites") {
            // In favs tab, remove immediately
            await gower.removeFavorite(item.id);
            favoritesModel = favoritesModel.filter(
                (/** @type {any} */ f) => f.id !== item.id,
            );
            // Also update feed model if present
            // Since we don't hold 'isFavorite' state in items but check list, just updating list is enough
        } else {
            const isFav = favoritesModel.some(
                (/** @type {any} */ f) => f.id === item.id,
            );
            if (isFav) {
                await gower.removeFavorite(item.id);
                favoritesModel = favoritesModel.filter(
                    (/** @type {any} */ f) => f.id !== item.id,
                );
            } else {
                await gower.addFavorite(item.id);
                favoritesModel = [...favoritesModel, item];
            }
        }
    }

    /**
     * @param {any} item
     */
    function handleDeleteRequest(item) {
        itemToDelete = item;
        deleteDialogOpen = true;
    }

    /**
     * @param {any} item
     */
    async function confirmDelete(item) {
        if (!item) return;
        try {
            await gower.deleteWallpaper(item.id);

            // Update models locally
            feedModel = feedModel.filter((i) => i.id !== item.id);
            currentWallpapers = currentWallpapers.filter(
                (i) => i.id !== item.id,
            );

            // Refresh to fill the grid (refetch the current page)
            await loadHome(false);
        } catch (e) {
            console.error("Failed to delete wallpaper:", e);
        }
    }

    // --- EVENTS ---

    /**
     * @param {WheelEvent} e
     */
    function handleWheel(e) {
        if (loading) return;
        if (currentTab !== "home") return;

        // Prevent default scrolling to handle pages
        e.preventDefault();

        if (e.deltaY > 0) {
            // Scroll down -> Next page
            feedPage++;
            loadHome();
        } else if (e.deltaY < 0 && feedPage > 1) {
            // Scroll up -> Prev page
            feedPage--;
            loadHome();
        }
    }

    /**
     * @param {any} e
     */
    function handleColorSelect(e) {
        selectedColor = selectedColor === e.detail ? "" : e.detail;
        if (currentTab === "home") loadHome(true);
        if (currentTab === "favorites") loadFavorites();
    }

    /**
     * @param {any} e
     */
    function handleSort(e) {
        currentSort = e.detail;
        loadHome(true);
    }

    /**
     * @param {any} e
     */
    function handlePageManual(e) {
        feedPage = e.detail;
        loadHome(false); // Don't reset to page 1
    }

    $effect(() => {
        // Only react to currentTab change
        const tab = currentTab;
        untrack(() => {
            if (tab === "home") {
                if (feedModel.length === 0) loadHome();
                loadCurrentWallpapers(); // Refresh active status
            }
            if (tab === "favorites") loadFavorites();

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
            const now = Date.now();
            if (lastSearchTime > 0 && now - lastSearchTime > 900000) {
                searchResults = [];
                searchQuery = "";
                searchPage = 1;
                lastSearchTime = 0;
                localStorage.removeItem("gower_search_data");
            }
        });
    });

    onMount(() => {
        /** @type {any} */
        let unlistenResize;

        async function init() {
            try {
                // Restore search from localStorage
                const saved = localStorage.getItem("gower_search_data");
                if (saved) {
                    const data = JSON.parse(saved);
                    const now = Date.now();
                    if (now - data.lastSearchTime < 900000) {
                        searchResults = data.searchResults || [];
                        searchQuery = data.searchQuery || "";
                        searchPage = data.searchPage || 1;
                        selectedProvider = data.selectedProvider || "wallhaven";
                        lastSearchTime = data.lastSearchTime;
                    }
                }

                appContext = await getAppContext();
                await loadConfig(); // Aseguramos que la configuración se cargue antes de los datos que dependen de ella

                // Load all data in parallel without blocking the UI start
                Promise.all([
                    loadFavorites(),
                    loadHome(),
                    loadCurrentWallpapers(),
                ]).catch((e) =>
                    console.error("Initialization background load failed:", e),
                );

                // Run update in background if needed
                gower.updateFeed();

                unlistenResize = await listen("tauri://resize", () => {
                    // Logic for resize if needed
                });
            } catch (e) {
                console.error("Initialization failed:", e);
            }
        }

        init();

        // Status polling every 10 seconds
        const pollInterval = setInterval(() => {
            // loadConfig(); // Config also contains status in some apps, but let's be sure
            // loadCurrentWallpapers(); // This also calls getStatus internally usually
            // refreshStatus() // If we had one, but loadConfig/loadCurrentWallpapers update the models
        }, 10000);

        // Listen for background command completions to refresh UI
        const unlistenCommand = listen("gower-command-finished", (event) => {
            const args = /** @type {string[]} */ (event.payload);
            console.log("[BG_REFRESH] Command finished, refreshing UI:", args);

            // Intelligent refresh based on command
            if (args.includes("set") || args.includes("undo")) {
                loadCurrentWallpapers();
            }
            if (args.includes("favorites") || args.includes("blacklist")) {
                loadFavorites();
            }

            // Handle download completion specifically to mark items as downloaded in UI
            // Instead of setting a client-side flag, trigger a reload to fetch the updated path from the backend.
            if (args.includes("download")) {
                // Reload relevant data to reflect the new path from the backend
                loadHome(); // Assuming downloaded items might appear in home/feed
                loadFavorites(); // Assuming downloaded items might be favorites
                // searchResults will be reloaded on next search if needed
                
            }

            if (
                args.includes("feed") &&
                (args.includes("update") || args.includes("download"))
            ) {
                loadHome();
            }
        });

        return () => {
            clearInterval(pollInterval);
            if (unlistenResize) unlistenResize();
            unlistenCommand.then((f) => f());
        };
    });
</script>

<main class="app-container">
    <!-- Custom Title Bar -->
    <div class="titlebar">
        <div class="logo" data-tauri-drag-region>Gower</div>
        <div class="drag-spacer" data-tauri-drag-region></div>
        <div class="window-controls">
            <button class="close-btn" onclick={() => appWindow.close()}
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
            <!-- Show icon BASED on current effective theme -->
            <!-- We need a reactive way to know if we are effectively dark or light when system is selected -->
            <!-- For simplicity, let's just show standard icons based on store value or just toggler -->
            <!-- Actually, let's use the CSS-based approach we had, but linked to the class on html -->
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
                        colors={feedColors}
                        {selectedColor}
                        on:select={handleColorSelect}
                    />
                </div>

                <div class="grid-area" onwheel={handleWheel}>
                    <WallpaperGrid
                        items={feedModel}
                        {loading}
                        favoritesList={favoritesModel}
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
                        {currentSort}
                        {sortOptions}
                        currentPage={feedPage}
                        on:sort={handleSort}
                        on:page={handlePageManual}
                        on:undo={handleUndo}
                    />
                </div>

                <CurrentWallpapersBar
                    {currentWallpapers}
                    on:openFolder={() => {}}
                    on:delete={(e) => handleDeleteRequest(e.detail)}
                />
            </div>
        {:else if currentTab === "search"}
            <div in:fade class="tab-pane">
                <SearchPanel
                    {config}
                    {status}
                    {appContext}
                    {favoritesModel}
                    bind:searchResults
                    bind:searchQuery
                    bind:searchPage
                    bind:selectedProvider
                    bind:lastSearchTime
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
                <div class="top-bar">
                    <ColorBar
                        colors={favoritesColors}
                        {selectedColor}
                        on:select={handleColorSelect}
                    />
                </div>

                <!-- Reuse WallpaperGrid for favorites, different type/actions -->
                <WallpaperGrid
                    items={favoritesModel}
                    loading={favoritesLoading}
                    type="favorites"
                    favoritesList={favoritesModel}
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
                {#if favoritesModel.length === 0 && !favoritesLoading}
                    <div class="empty">No tienes favoritos.</div>
                {/if}
            </div>
        {:else if currentTab === "settings"}
            <div in:fade class="tab-pane">
                <SettingsPanel {config} {status} on:refresh={loadConfig} />
            </div>
        {/if}
    </div>

    <DeleteDialog
        open={deleteDialogOpen}
        item={itemToDelete}
        on:close={() => (deleteDialogOpen = false)}
        on:confirm={(e) => confirmDelete(e.detail)}
    />

    <!-- Preview Modal -->
    {#if previewOpen && previewItem}
        <div
            class="modal-backdrop"
            onclick={() => (previewOpen = false)}
            onkeydown={(e) => e.key === "Escape" && (previewOpen = false)}
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
                    onclick={() => (previewOpen = false)}
                >
                    <span class="material-icons">close</span>
                </button>
                <img src={previewItem.thumbnail} alt={previewItem.id} />
                <div class="preview-info">
                    <div class="preview-header">
                        <h3>ID: {previewItem.id}</h3>
                        <p class="provider">
                            Provider: {previewItem.provider &&
                            previewItem.provider.toLowerCase() !== "local"
                                ? previewItem.provider
                                : "Local"}
                        </p>
                    </div>

                    <div class="monitor-selection">
                        <p class="section-title">Establecer en:</p>
                        <div class="monitor-buttons">
                            <button
                                class="monitor-chip all"
                                onclick={() => {
                                    setOnAllMonitors(previewItem);
                                    previewOpen = false;
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
                                        setWallpaper(previewItem, m.ID);
                                        previewOpen = false;
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
                            onclick={async () => {
                                await gower.blacklist(previewItem.id);
                                previewOpen = false;
                                await loadHome(false);
                            }}
                            title="Añadir a lista negra"
                            class="action-btn block"
                        >
                            <span class="material-icons">visibility_off</span>
                        </button>

                        <button
                            onclick={() => toggleFavorite(previewItem)}
                            title="Favoritos"
                            class="action-btn favorite"
                        >
                            <span
                                class="material-icons"
                                class:active={isFavorite(previewItem.id)}
                            >
                                {isFavorite(previewItem.id)
                                    ? "favorite"
                                    : "favorite_border"}
                            </span>
                        </button>
                        {#if !previewItem.isDownloaded}
                            <button
                                onclick={() => handleDownload(previewItem)}
                                title="Descargar"
                                class="action-btn"
                            >
                                <span class="material-icons">download</span>
                            </button>
                        {/if}

                        {#if !previewItem.provider || previewItem.provider.toLowerCase() === "local"}
                            <button
                                onclick={() => {
                                    handleDeleteRequest(previewItem);
                                    previewOpen = false;
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
    {#if contextMenu.open}
        <div
            class="context-menu-backdrop"
            onclick={closeContextMenu}
            onkeydown={(e) => e.key === "Escape" && closeContextMenu()}
            role="presentation"
        >
            <div
                class="context-menu glass-card"
                style="top: {contextMenu.y}px; left: {contextMenu.x}px;"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => e.stopPropagation()}
                role="menu"
                tabindex="-1"
            >
                <button onclick={() => openUrl(contextMenu.item)}>
                    <span class="material-icons">link</span>
                    Abrir URL
                </button>
                <button onclick={() => openInSystem(contextMenu.item)}>
                    <span class="material-icons">folder_open</span>
                    Ver en sistema
                </button>
            </div>
        </div>
    {/if}

    <div class="notifications">
        {#each notifications as n (n.id)}
            <div class="notification {n.type}" transition:fade>
                {#if n.type === "loading"}
                    <div class="spinner"></div>
                {:else}
                    <span class="material-icons">
                        {n.type === "success"
                            ? "check_circle"
                            : n.type === "error"
                              ? "error"
                              : "info"}
                    </span>
                {/if}
                {n.message}
            </div>
        {/each}
    </div>
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
        /* Remove drag region from logo if we want spacer to handle it, or keep it. Spacer is better for filling. */
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
    /* Navigation - Material Tabs Style */
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
        flex: 1; /* Space distributed evenly */
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
        opacity: 1; /* Reset opacity logic */
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

    /* Adjust icon size for inline tab */
    nav button .material-icons {
        font-size: 18px;
    }

    /* Content Area */
    .content {
        flex: 1;
        overflow: hidden;
        position: relative;
        padding: 0 var(--spacing-s) var(--spacing-s) var(--spacing-s);
    }

    .tab-pane {
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
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
        gap: 6px; /* Reduced by 2px from 8px */
    }

    .grid-area {
        flex: 1; /* Stretch to occupy space but let bottom-bar stretch too if flexible */
        overflow-y: auto;
        min-height: 0;
    }

    .bottom-bar {
        flex-shrink: 0;
    }

    .empty {
        text-align: center;
        margin-top: 40px;
        opacity: 0.5;
    }

    .material-icons {
        font-size: 20px;
    }
    .notifications {
        position: fixed;
        bottom: 75px; /* Above nav tab line */
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        z-index: 2000;
        pointer-events: none;
        width: 100%;
        max-width: 400px;
    }

    .notification {
        background: var(--surface-container-high);
        color: var(--on-surface);
        padding: 10px 16px;
        border-radius: var(--radius-l);
        display: flex;
        align-items: center;
        gap: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        border: 1px solid var(--outline);
        font-weight: 500;
        min-width: 200px;
    }

    .notification.success {
        border-left: 4px solid #4caf50;
    }
    .notification.error {
        border-left: 4px solid var(--error);
    }
    .notification.loading {
        border-left: 4px solid var(--primary);
    }
    .notification.success span {
        color: #4caf50;
    }
    .notification.error span {
        color: var(--error);
    }

    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
