<script>
    import { onMount, tick, untrack } from "svelte";
    import { t } from "$lib/stores/i18n";
    import { theme } from "$lib/stores/theme";
    import { gower, getAppContext, mapThumbnails, checkFileExists, normalizeId } from "$lib/api";
    import { fade } from "svelte/transition";
    import { getCurrentWindow } from "@tauri-apps/api/window";
    import { listen } from "@tauri-apps/api/event";

    const appWindow = getCurrentWindow();

    import ColorBar from "$lib/components/ColorBar.svelte";
    import SettingsPanel from "$lib/components/SettingsPanel.svelte";
    import SearchPanel from "$lib/components/SearchPanel.svelte";
    import SortBar from "$lib/components/SortBar.svelte";
    import CurrentWallpapersBar from "$lib/components/CurrentWallpapersBar.svelte";
    import DeleteDialog from "$lib/components/DeleteDialog.svelte";
    import WallpaperGrid from "$lib/components/WallpaperGrid.svelte";
    import { notifications as notificationsStore } from "$lib/stores/notifications";
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
    let favoritesPage = $state(1); // New state for favorites pagination
    let favoritesCurrentSort = $state("Smart"); // New state for favorites sort
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

    // Modal & Context Menu State
    /** @type {any} */
    let previewItem = $state(null);
    let previewOpen = $state(false);
    /** @type {any} */
    let contextMenu = $state({ open: false, x: 0, y: 0, item: null });
    
    // Dialog State
    let deleteDialogOpen = $state(false);
    let itemToDelete = $state(null);

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
     * @param {boolean} [skipColors]
     */
    async function loadHome(reset = false, skipColors = false) {
        if (!appContext) return;
        if (reset) {
            feedPage = 1;
        }
        // Only show loading skeletons if we don't have items yet
        if (feedModel.length === 0) loading = true;

        try {
            // Fetch feed and colors in parallel, or just feed
            const tasks = [
                gower.getFeed(
                    feedPage,
                    10, // Buffer: fetch 10 to show 9
                    selectedColor,
                    currentSort.toLowerCase(),
                )
            ];
            
            if (!skipColors) {
                tasks.push(gower.getFeedColors());
            }

            const [result, colorsResult] = await Promise.all(tasks);

            /** @type {any[]} */
            let newItems = mapThumbnails(result || [], appContext.cache_path);
            const existingIds = new Set();
            newItems = newItems.filter((i) => !existingIds.has(i.id));

            feedModel = newItems;

            if (!skipColors && Array.isArray(colorsResult)) {
                feedColors = colorsResult;
            }
            console.log("[loadHome] Feed cargado. Items:", newItems.length);
        } catch (e) {
            console.error("[loadHome] Error al cargar feed:", e);
        } finally {
            loading = false;
        }
    }

    let favoritesLoading = $state(false);
    /**
     * @param {boolean} [skipColors]
     * @param {number} [page]
     * @param {string} [sort]
     */
    async function loadFavorites(skipColors = false, page = favoritesPage, sort = favoritesCurrentSort.toLowerCase()) {
        if (!appContext || favoritesLoading) return;

        // Show loading only if empty to avoid flicker
        if (favoritesModel.length === 0) favoritesLoading = true;
        try {
            const tasks = [gower.getFavorites(page, 9, selectedColor, sort)]; // Use page, limit, color, sort
            if (!skipColors) {
                tasks.push(gower.getFavoritesColors());
            }

            const [result, colorsResult] = await Promise.all(tasks);

            favoritesModel = mapThumbnails(result || [], appContext.cache_path);

            if (!skipColors && Array.isArray(colorsResult)) {
                favoritesColors = colorsResult;
            }
            console.log("[loadFavorites] Favoritos cargados. Items:", favoritesModel.length);
        } catch (e) {
            console.error("[loadFavorites] Error al cargar favoritos:", e);
        } finally {
            favoritesLoading = false;
        }
    }

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

        const isLocal =
            item.path &&
            config?.paths?.wallpapers &&
            item.path.startsWith(config.paths.wallpapers);
        const target = isLocal ? item.path : item.id.replace("local_", "");

        try {
            await gower.setWallpaper(target, monitorId);
            contextMenu.open = false;
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
            feedModel = feedModel.filter((i) => i.id !== snap.id);
            favoritesModel = favoritesModel.filter((i) => i.id !== snap.id);
            currentWallpapers = currentWallpapers.filter((i) => i.id !== snap.id);
            if (searchResults) searchResults = searchResults.filter((i) => i.id !== snap.id);
            
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
        const nid = notificationsStore.add("Descargando...", "loading");
        try {
            await gower.download(snap.id);
            notificationsStore.add("Descarga iniciada", "success", nid);
            // Refresh feed happens via background event
        } catch (e) { // Keep error for user feedback
            notificationsStore.add("Error al descargar", "error", nid);
            console.error("Download failed:", e);
        }
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
            contextMenu.open = false; // Close context menu after action
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
            contextMenu.open = false; // Close context menu after action
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
            contextMenu.open = false;
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
        const isCurrentlyFavorite = favoritesModel.some((f) => normalizeId(f.id) === normalizedItemId);

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
                loadHome(false, true); // Refresh home, skip colors for speed, to update favorite status
                loadFavorites(); // Also refresh favorites to ensure consistency across tabs
            } else if (currentTab === "favorites") { // If on favorites tab, the gower-command-finished listener will handle the refresh
                loadFavorites(); // Explicitly refresh favorites if on favorites tab
            }
        } catch (e) { // Keep error for user feedback
            notificationsStore.add("Error al actualizar favoritos", "error");
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
            // Check which monitor(s) are using this wallpaper by matching ID
            // currentWallpapers[i] maps to monitors[i]
            const affectedMonitorIndices = currentWallpapers
                .map((curr, idx) => (curr.id === item.id ? idx : -1))
                .filter((idx) => idx !== -1);

            await gower.deleteWallpaper(item.id);

            // Update models locally
            feedModel = feedModel.filter((i) => i.id !== item.id);
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
        if (loading || favoritesLoading) return;
        if (currentTab !== "home" && currentTab !== "favorites") return;

        // Prevent default scrolling to handle pages
        e.preventDefault();

        if (e.deltaY > 0) {
            // Scroll down -> Next page
            if (currentTab === "home") {
                feedPage++;
                loadHome();
            } else if (currentTab === "favorites") {
                favoritesPage++;
                loadFavorites();
            }
        } else if (e.deltaY < 0) {
            // Scroll up -> Prev page
            if (currentTab === "home" && feedPage > 1) {
                feedPage--;
                loadHome();
            } else if (currentTab === "favorites" && favoritesPage > 1) {
                favoritesPage--;
                loadFavorites();
            }
        }
    }

    /**
     * @param {CustomEvent<string>} e
     */
    function handleColorSelect(e) {
        selectedColor = selectedColor === e.detail ? "" : e.detail;
        if (currentTab === "home") loadHome(true);
        if (currentTab === "favorites") loadFavorites();
    }

    /** 
     * @param {CustomEvent<string>} e
     */
    function handleSort(e) {
        currentSort = e.detail;
        loadHome(true);
    }
    
    /**
     * @param {CustomEvent<string>} e
     */
    function handleSortFavorites(e) {
        favoritesCurrentSort = e.detail;
        loadFavorites(false, 1, favoritesCurrentSort.toLowerCase()); // Reset to page 1 on sort change
    }

    /**
     * @param {CustomEvent<number>} e
     */
    function handlePageManualFavorites(e) {
        favoritesPage = e.detail;
        loadFavorites(false, favoritesPage, favoritesCurrentSort.toLowerCase());
    }

    /**
     * @param {CustomEvent<number>} e
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
                // Only load current wallpapers if not already loaded or if tab changes to home
                if (currentWallpapers.length === 0 || currentTab !== "home") {
                    loadCurrentWallpapers(); // Refresh active status
                }
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
            console.log("[init] Iniciando carga de la aplicación...");
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
                console.log("[init] AppContext obtenido:", $state.snapshot(appContext));
                await loadConfig(); // Aseguramos que la configuración se cargue antes de los datos que dependen de ella

                // Load all data in parallel without blocking the UI start
                Promise.all([
                    loadFavorites(),
                    loadHome(),
                    loadCurrentWallpapers(), // Load current wallpapers
                ]).catch((e) =>
                    console.error("Initialization background load failed:", e),
                );

                // Run update in background if needed
                gower.updateFeed();

                unlistenResize = await listen("tauri://resize", () => {
                    // Logic for resize if needed
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

        // Listen for background command completions to refresh UI
        const unlistenCommand = listen("gower-command-finished", (event) => {
            const args = /** @type {string[]} */ (event.payload); // Keep for context
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
                    loadFavorites(isBlacklist || isDelete);
                }
                // Phase 2: Background color recalculation if it was a blacklist (only if visible)
                if ((isBlacklist || isDelete) && currentTab === "favorites") {
                    setTimeout(() => loadFavorites(false), 600);
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
                loadHome(false, isBlacklist || isDelete);
                // Phase 2: Background color recalculation if it was a blacklist (only if visible)
                if ((isBlacklist || isDelete) && currentTab === "home") {
                    setTimeout(() => loadHome(false, false), 600);
                }
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
                    favoritesList={favoritesModel}
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
                <div class="top-bar" style="margin-bottom: 6px;">
                    <ColorBar
                        colors={favoritesColors}
                        {selectedColor}
                        on:select={handleColorSelect}
                    />
                </div>
                <div class="grid-area" onwheel={handleWheel}>
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
                </div>
                {#if favoritesModel.length === 0 && !favoritesLoading}
                    <div class="empty">No tienes favoritos.</div>
                {/if}
                <div class="bottom-bar">
                    <SortBar
                        currentSort={favoritesCurrentSort}
                        {sortOptions}
                        currentPage={favoritesPage}
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
                            onclick={() => {
                                handleBlock(previewItem);
                                previewOpen = false;
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
                                class:active={favoritesModel.some((f) => normalizeId(f.id) === normalizeId(previewItem.id))}
                            >
                                {favoritesModel.some((f) => normalizeId(f.id) === normalizeId(previewItem.id))
                                    ? "favorite" : "favorite_border"}
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
</main>
<style>
    /* Remove the .notifications and .notification styles as they are now handled by ToastContainer */
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
        gap: 6px; /* Reduced by 2px from 8px */
        gap: 4px; /* Reduced further to save space */
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .grid-area {
        flex: 1; /* Allow to grow and shrink */
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
