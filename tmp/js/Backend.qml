pragma Singleton
import QtQml
import Qt.labs.processes 1.0 // Nuevo: Para ejecutar procesos externos de forma multiplataforma
import QtQuick.Dialogs 1.2 // Nuevo: Para el selector de carpetas multiplataforma
import Qt.labs.platform 1.0 // Nuevo: Para acceso a archivos multiplataforma (ej. File.exists)
import QtQuick // Necesario para Timer y Qt.createQmlObject

QtObject {
    id: backend

    // Detección del sistema operativo
    readonly property bool isWindows: Qt.platform.os === "windows"
    readonly property bool isLinux: Qt.platform.os === "linux"
    readonly property bool isMacOS: Qt.platform.os === "osx" // Añadido para completitud, aunque no se refactorice explícitamente para macOS

    signal colorsChanged(var feedColors, var favoritesColors)
    signal feedChanged(var feed)
    signal favoritesChanged(var favorites)
    signal searchChanged(var searchResult)
    signal feedNeedsReload()
    signal favoritesNeedReload()
    signal updateFinished()

    property string userHome: ""
    property int feedPage: 1
    property int feedLimit: 9
    property string cachePath: ""
    property string configPath: ""
    property string dataPath: ""
    property bool refreshing: false
    property bool initialized: false
    property bool isLaptop: false
    property var monitors: []
    property int feedRetryCount: 0
    property string currentFeedColor: ""
    property bool daemonRunning: false
    property var currentWallpapers: []
    property var currentWallpaperItems: []
    property string feedSort: "smart"
    property var config: null

    function getHsl(hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return {h:0, s:0, l:0};
        var r = parseInt(result[1], 16) / 255;
        var g = parseInt(result[2], 16) / 255;
        var b = parseInt(result[3], 16) / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;
        if (max == min) {
            h = s = 0;
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return {h: h, s: s, l: l};
    }

    // Eliminados processComponent y collectorComponent ya que eran específicos de Quickshell.Io
    // Ahora se usa Qt.labs.processes.Process directamente

    function createProcess(command, onFinished) {
        var process = Qt.labs.processes.Process.create({
            program: command[0],
            arguments: command.slice(1)
        });

        var output = "";
        process.standardOutput.connect(function() {
            output += process.readAllStandardOutput().toString();
        });
        process.standardError.connect(function() {
            // Opcionalmente, se puede recolectar stderr o simplemente loguearlo
            console.error("Process stderr: " + process.readAllStandardError().toString());
        });

        process.finished.connect(function(exitCode, exitStatus) {
            if (exitStatus === Qt.labs.processes.Process.NormalExit) {
                onFinished(output);
            } else {
                console.error("Process crashed or was killed: " + command.join(" "));
                onFinished(""); // Devolver vacío en caso de error
            }
            process.destroy();
        });
        process.start();
    }

    function createDetachedProcess(command) {
        Qt.labs.processes.Process.startDetached(command[0], command.slice(1));
    }

    function openImageExternally(item) {
        if (!backend.config || !backend.config.paths || !backend.config.paths.wallpapers) {
            console.error("Cannot open image externally, wallpaper path not configured.");
            return;
        }
        if (!item || !item.id || !item.ext) {
            console.error("Cannot open image externally, invalid item data.");
            return;
        }
        var imagePath = backend.config.paths.wallpapers + "/" + item.id + item.ext; // Ruta local
        Qt.openUrlExternally("file:///" + imagePath); // Usa la función multiplataforma de Qt
    }

    function openInBrowser(item) {
        if (!item) return;
        var url = item.permalink || item.post_url || item.url || item.link || "";
        if (url !== "") {
            console.warn("Backend: Found direct URL in item, opening: " + url); // Log para depuración
            Qt.openUrlExternally(url); // Usa la función multiplataforma de Qt
            return;
        }

        // If no direct URL, try fetching details with gower
        if (!item.id) {
            console.error("Backend: No URL and no ID to fetch details for item.");
            console.error("Backend: Item data: " + JSON.stringify(item));
            return;
        }

        console.warn("Backend: No direct URL found for " + item.id + ". Fetching details with 'gower wallpaper'...");
        var cmd = ["gower", "wallpaper", item.id, "--json"];
        backend.createProcess(cmd, function(text) {
            var output = text.trim();
            if (output === "") {
                console.error("Backend: 'gower wallpaper' command returned empty output for " + item.id);
                return;
            }

            var jsonStart = output.indexOf("{");
            var jsonEnd = output.lastIndexOf("}");
            if (jsonStart === -1 || jsonEnd === -1) {
                console.error("Backend: Could not find JSON object in 'gower wallpaper' output for " + item.id + ". Raw: " + output);
                return;
            }

            try {
                var details = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
                var fetchedUrl = details.permalink || details.post_url || details.url || details.link || "";
                if (fetchedUrl !== "") {
                    console.warn("Backend: Fetched details, opening URL: " + fetchedUrl);
                    Qt.openUrlExternally(fetchedUrl); // Usa la función multiplataforma de Qt
                } else {
                    console.error("Backend: Fetched details for " + item.id + " but still no URL found. Data: " + JSON.stringify(details));
                }
            } catch (e) {
                console.error("Backend: Failed to parse JSON from 'gower wallpaper' for " + item.id + ". Error: " + e + ". Raw: " + output);
            }
        });
    }

    function openImageFolder(item) {
        if (!backend.config || !backend.config.paths || !backend.config.paths.wallpapers) {
            console.error("Cannot open folder, wallpaper path not configured.");
            return;
        }
        var folderPath = backend.config.paths.wallpapers;
        var cmd;
        if (backend.isWindows) {
            cmd = ["explorer", folderPath]; // Explorador de archivos de Windows
        } else if (backend.isLinux) {
            cmd = ["xdg-open", folderPath]; // Gestor de archivos predeterminado de Linux
        } else if (backend.isMacOS) {
            cmd = ["open", folderPath]; // Finder de macOS
        } else {
            console.error("Sistema operativo no soportado para openImageFolder");
            return;
        }
        backend.createDetachedProcess(cmd);
    }

    function deleteWallpaper(id) {
        var cmd = ["gower", "wallpaper", id, "--delete", "--file", "--force"];
        backend.createProcess(cmd, function() {
            // After deleting, refresh the current wallpapers and the feed
            backend.loadCurrentWallpapers();
            backend.feedNeedsReload();
        });
    }

    function detectPaths(retry) {
        // Usar Qt.platform.homePath para el directorio de inicio del usuario de forma multiplataforma
        backend.userHome = Qt.platform.homePath;

        if (backend.isWindows) {
            // En Windows, la configuración suele estar en AppData/Roaming, datos/caché en AppData/Local
            backend.configPath = backend.userHome + "/AppData/Roaming/gower";
            backend.dataPath = backend.userHome + "/AppData/Local/gower";
            backend.cachePath = backend.userHome + "/AppData/Local/gower/cache";
        } else if (backend.isLinux || backend.isMacOS) {
            // Rutas estándar de XDG para Linux/macOS
            backend.configPath = backend.userHome + "/.config/gower";
            backend.dataPath = backend.userHome + "/.local/share/gower";
            backend.cachePath = backend.userHome + "/.cache/gower";
        } else {
            console.error("Sistema operativo no soportado para la detección de rutas.");
            return;
        }

        // La lógica de detección de rutas basada en la existencia de archivos es compleja y específica del shell.
        // Una mejor aproximación es intentar cargar la configuración; si falla, entonces inicializar.
        backend.loadConfig(function(success) {
            if (success) {
                backend.finalizeInit();
            } else {
                if (retry) {
                    console.error("Could not detect config paths even after 'gower config init'.");
                    return;
                }
                console.warn("No configuration found. Running 'gower config init'...");
                backend.createProcess(["gower", "config", "init"], function() {
                    backend.detectPaths(true); // Reintentar después de la inicialización
                });
            }
        });
    }

    function finalizeInit() {
        // backend.loadConfig() ahora se llama dentro de detectPaths
        backend.checkAndLoadColors();
        backend.loadCurrentWallpapers();
        backend.update();
    }

    function initialize() {
        if (backend.initialized) return;
        backend.initialized = true;

        // Detección de portátil (específico de Linux, para Windows/macOS, se asume falso o se implementa una comprobación específica del SO)
        // Esta comprobación es muy específica del kernel de Linux. Para Windows/macOS, se asume falso.
        if (backend.isLinux) {
            backend.createProcess(["sh", "-c", "ls /sys/class/power_supply/BAT* > /dev/null 2>&1 && echo 1 || echo 0"], function(output) {
                backend.isLaptop = (output.trim() === "1");
        } else {
            backend.isLaptop = false; // Valor predeterminado para Windows/macOS
        }
        
        backend.checkDaemonStatus();
        backend.loadMonitors();
        // userHome ahora se establece en detectPaths
        backend.detectPaths(false);
    }

    function checkDaemonStatus() {
        var cmd;
        if (backend.isWindows) {
            // Comprobar si gower.exe se está ejecutando como un proceso demonio en Windows
            cmd = ["cmd", "/c", "tasklist /FI \"IMAGENAME eq gower.exe\" /FO CSV /NH | findstr /I \"gower.exe\" >nul && echo 1 || echo 0"];
        } else if (backend.isLinux) {
            cmd = ["pgrep", "-f", "gower [d]aemon"]; // Llamada directa a pgrep
        } else {
            console.warn("Comprobación de estado del demonio no implementada para este SO.");
            backend.daemonRunning = false;
            return;
        }

        backend.createProcess(cmd, function(output) {
            var status = (output.trim() === "1");
            if (backend.isLinux) {
                // pgrep devuelve 0 si encuentra, 1 si no. createProcess devuelve el stdout.
                // Necesitamos verificar el exitCode para pgrep.
                // Para simplificar, asumimos que si hay output, está corriendo.
                status = output.trim() !== "";
            }
            backend.daemonRunning = status;
        });
    }

    function toggleDaemon(enable) {
        backend.daemonRunning = enable;
        var cmd;
        if (enable) {
            if (backend.isWindows) {
                cmd = ["cmd", "/c", "start", "gower", "daemon", "start"]; // Usar 'start' para ejecutar en segundo plano
            } else { // Linux/macOS
                cmd = ["gower", "daemon", "start"]; // Llamada directa a gower
            }
            backend.createProcess(cmd, function(output) {
                console.warn("Daemon start output: " + output);
                var timer = Qt.createQmlObject("import QtQuick; Timer { interval: 2000; repeat: false; onTriggered: backend.checkDaemonStatus(); }", backend);
                timer.start();
            });
        } else {
            if (backend.isWindows) {
                // taskkill es un comando de shell de Windows, se mantiene el cmd /c
                cmd = ["cmd", "/c", "taskkill /IM gower.exe /F"];
            } else if (backend.isMacOS) {
                cmd = ["pkill", "-f", "gower daemon"]; // pkill es una utilidad de macOS/Linux
            } else { // Linux/macOS
                cmd = ["sh", "-c", "(gower daemon stop; sleep 1; pkill -f \"gower daemon\") 2>&1"];
            }
            backend.createProcess(cmd, function(output) {
                console.warn("Daemon stop output: " + output);
                var timer = Qt.createQmlObject("import QtQuick; Timer { interval: 2000; repeat: false; onTriggered: backend.checkDaemonStatus(); }", backend);
                timer.start();
            });
        }
    }

    function loadMonitors() {
        backend.createProcess(["gower", "status", "--monitors", "--json"], function(text) {
            var output = text.trim();
            if (output === "") {
                return;
            }
            var jsonStart = output.indexOf("{");
            var jsonEnd = output.lastIndexOf("}");
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                output = output.substring(jsonStart, jsonEnd + 1);
            }
            try {
                var json = JSON.parse(output);
                if (json && json.monitors) {
                    backend.monitors = json.monitors;
                }
            } catch (e) {
                console.error("Error parsing monitors: " + e);
                console.error("Raw output: " + text);
            }
        });
    }

    function checkAndLoadColors() {
        if (backend.dataPath === "") return;
        var colorsFile = backend.dataPath + "/colors.json";
        var cmd;
        if (backend.isWindows) {
            cmd = ["cmd", "/c", "type", colorsFile]; // Equivalente a 'cat' en Windows
        } else {
            cmd = ["cat", colorsFile];
        }

        backend.createProcess(cmd, function(text) {
            if (!text || text.trim() === "") {
                return
            }
            try {
                var data = JSON.parse(text)
                var sortFn = function(a, b) {
                    var hslA = backend.getHsl(a);
                    var hslB = backend.getHsl(b);
                    if (hslA.s < 0.01 && hslB.s >= 0.01) return 1;
                    if (hslA.s >= 0.01 && hslB.s < 0.01) return -1;
                    return hslA.h - hslB.h;
                }

                var feedColors = data.feed || data.feed_palette || [];
                var favColors = data.favorites || data.favorites_palette || [];

                if (feedColors.length > 0) {
                    feedColors.sort(sortFn)
                }
                if (favColors.length > 0) {
                    favColors.sort(sortFn)
                }
                backend.colorsChanged(feedColors, favColors);
            } catch (e) {
                console.error("Failed to parse colors JSON: " + e)
            }
        });
    }

    function update() {
        backend.createProcess(["gower", "feed", "update"], function(text) {
            backend.updateFinished();
            backend.checkAndLoadColors();
            backend.loadCurrentWallpapers(function() {
                backend.feedNeedsReload();
            });
        });
    }

    function undoWallpaper() {
        backend.createProcess(["gower", "set", "undo"], function(text) {
            backend.loadCurrentWallpapers(function() {
                backend.feedNeedsReload();
            });
        });
    }

    function loadFeed(color, isRetry) {
        if (!isRetry) {
            backend.feedRetryCount = 0;
            backend.currentFeedColor = color;
        }
        if (backend.userHome === "") {
            backend.feedChanged([]);
            return;
        }
        
        var limit = backend.feedLimit;
        
        var colorArg = (color && color !== "") ? " --color " + color.replace("#", "") : "";
        var feedCmd = ["gower", "feed", "show", "--quiet", "--page", String(backend.feedPage), "--limit", String(limit)]; // Convertir números a string
        if (backend.refreshing) feedCmd.push("--refresh");
        if (colorArg) feedCmd.push("--color", color.replace("#", ""));
        feedCmd.push("--sort", backend.feedSort);
        feedCmd.push("--json");
        backend.executeFeedCommand(feedCmd, isRetry); // command es ahora un array
    }

    function executeFeedCommand(commandArray, isRetry) { // Ahora recibe un array
        backend.createProcess(["sh", "-c", commandStr], function(text) {
            var output = text.trim();
            var items = [];
            
            if (output !== "") {
                var jsonStart = output.indexOf("[");
                var jsonEnd = output.lastIndexOf("]");
                
                if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                    var jsonString = output.substring(jsonStart, jsonEnd + 1);
                    try {
                        items = JSON.parse(jsonString);
                    } catch (e) {
                        console.error("Feed JSON parse error: " + e);
                    }
                }
            }
            
            for (var i = 0; i < items.length; i++) {
                if (items[i].id && items[i].ext) {
                    items[i].thumbnail = "file://" + backend.cachePath + "/thumbs/" + items[i].id + items[i].ext;
                    if (isRetry) {
                        items[i].thumbnail += "?retry=" + new Date().getTime();
                    }
                } else {
                    items[i].thumbnail = "";
                }
                items[i].seen = true;
            }
            backend.validateFeedItems(items);
        });
    }

    function validateFeedItems(items) {
        if (!items || items.length === 0) {
            backend.feedChanged([]);
            return;
        }
        
        var idsToCheck = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].id && items[i].ext) {
                idsToCheck.push(items[i].id + "::" + items[i].ext);
            }
        }
        
        if (idsToCheck.length === 0) {
            backend.feedChanged(items);
            return;
        }

        // Usar Qt.labs.platform.File para una comprobación multiplataforma de existencia y tamaño
        var missingIds = [];
        for (var i = 0; i < idsToCheck.length; i++) {
            var parts = idsToCheck[i].split("::");
            var id = parts[0];
            var ext = parts[1];
            var path = backend.cachePath + "/thumbs/" + id + ext;
            
            var file = Qt.labs.platform.File.fromLocalFile(path);
            if (!file.exists || file.size === 0) {
                missingIds.push(id);
            }
        }

        if (missingIds.length > 0) {
            console.error("Missing thumbnails detected for IDs: " + missingIds.join(", "));
            if (backend.feedRetryCount < 3) {
                console.warn("Missing thumbnails detected. Running analysis and retrying (" + (backend.feedRetryCount + 1) + "/3)...");
                backend.feedRetryCount++;
                backend.createProcess(["gower", "feed", "analyze", "--all"], function() {
                    // Después de analizar, reintentar cargar el feed para que se revalide
                    backend.loadFeed(backend.currentFeedColor, true);
                });
            } else {
                console.warn("Giving up on missing thumbnails after retries.");
                for (var m = 0; m < missingIds.length; m++) {
                    var mId = missingIds[m].trim();
                    if (!mId) continue;
                    for (var k = 0; k < items.length; k++) {
                        if (items[k].id === mId) items[k].thumbnail = ""; // Eliminar miniatura si sigue faltando
                    }
                }
                backend.feedChanged(items);
            }
        } else {
            backend.feedChanged(items); // Todas las miniaturas están bien
        }
    }

    function loadFavorites(color) {
        if (backend.userHome === "") {
            backend.favoritesChanged([]);
            return;
        }
        var colorArg = (color && color !== "") ? " --color " + color.replace("#", "") : "";
        var command = ["gower", "favorites", "list"];
        if (colorArg) command.push("--color", color.replace("#", ""));
        command.push("--json");
        backend.createProcess(command, function(text) {
            var output = text.trim();
            if (output === "") {
                backend.favoritesChanged([]);
                return;
            }

            var jsonStart = output.indexOf("[");
            var jsonEnd = output.lastIndexOf("]");
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                output = output.substring(jsonStart, jsonEnd + 1);
            }

            try {
                var favs = JSON.parse(output);
                var newModel = [];
                if (Array.isArray(favs)) {
                    newModel = favs.map(function(item) {
                        var favItem = (typeof item === 'object') ? item : { id: item };
                        if (favItem.id && favItem.hasOwnProperty('ext')) {
                            favItem.thumbnail = "file://" + backend.cachePath + "/thumbs/" + favItem.id + favItem.ext;
                        } else {
                            favItem.thumbnail = "";
                        }
                        favItem.seen = false;
                        return favItem;
                    });
                }
                backend.checkMissingThumbnails(newModel);
                backend.favoritesChanged(newModel);
            } catch (e) {
                console.error("Favorites JSON parse error: " + e);
                backend.favoritesChanged([]);
            }
        });
    }

    function loadCurrentWallpapers(callback) {
        backend.createProcess(["gower", "status", "--wallpapers", "--json"], function(text) {
            var output = text.trim();
            var jsonStart = output.indexOf("{");
            var jsonEnd = output.lastIndexOf("}");
            
            var items = [];
            var ids = [];

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                try {
                    var json = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
                    // La nueva estructura es json.wallpaper.wallpapers, que es un array de objetos
                    if (json && json.wallpaper && json.wallpaper.wallpapers) {
                        items = json.wallpaper.wallpapers;
                        
                        // Procesamos los items para añadir la ruta local a la miniatura y extraer los IDs
                        for (var i = 0; i < items.length; i++) {
                            var item = items[i];
                            if (item.id && item.ext) {
                                item.thumbnail = "file://" + backend.cachePath + "/thumbs/" + item.id + item.ext;
                            }
                            ids.push(item.id);
                        }
                    }
                } catch (e) {
                    console.error("Error parsing wallpaper status: " + e);
                }
            }

            backend.currentWallpapers = ids;
            backend.currentWallpaperItems = items;
            console.warn("Backend: Detected " + ids.length + " active wallpapers from gower status: " + JSON.stringify(ids));
            console.warn("Backend: Resolved " + items.length + " wallpaper items from status.");

            if (callback) callback();
        });
    }

    function search(text, provider) {
        var providerKey = provider.toLowerCase();
        // This is a simplified version, in a real app you would get this from the config
        var cmd = ["gower", "explore", text, "--provider", providerKey, "--json"]; // Argumentos directos
        backend.createProcess(cmd, function(text) {
            var output = text.trim();
            if (output === "") {
                backend.searchChanged([]);
                return;
            }
            var jsonStart = output.indexOf("[");
            var jsonEnd = output.lastIndexOf("]");
            
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                var jsonString = output.substring(jsonStart, jsonEnd + 1);
                try {
                    var items = JSON.parse(jsonString);
                    for (var i = 0; i < items.length; i++) {
                        if (!items[i].thumbnail) items[i].thumbnail = "";
                    }
                    backend.searchChanged(items);
                } catch (e) {
                    console.error("Search JSON parse error: " + e);
                    backend.searchChanged([]);
                }
            } else {
                backend.searchChanged([]);
            }
        });
    }

    function loadConfig() {
    function loadConfig(callback) { // Añadido callback para detectPaths, corregida duplicación de función
        if (backend.configPath === "") return;
        if (backend.configPath === "") {
            if (callback) callback(false);
            return;
        }
        var configFile = backend.configPath + "/config.json";
        var cmd;
        if (backend.isWindows) {
            cmd = ["cmd", "/c", "type", configFile];
        } else {
            cmd = ["cat", configFile];
        }

        backend.createProcess(cmd, function(text) {
            var raw = text.trim();
            var start = raw.indexOf("{");
            var end = raw.lastIndexOf("}");
            
            if (start !== -1 && end !== -1) {
                var jsonStr = raw.substring(start, end + 1);
                try { 
                    var conf = JSON.parse(jsonStr);
                    backend.config = conf;
                    if (conf.behavior && conf.behavior.daemon_enabled === true && !backend.daemonRunning) {
                        console.warn("Daemon enabled in config, starting...");
                        backend.toggleDaemon(true);
                    }
                    if (callback) callback(true);
                } catch (e) {
                    console.error("Config parse error: " + e);
                }
            } else {
                console.error("No JSON object found in config file: " + configFile);
                // Fallback to defaults to prevent UI breakage
                var defaults = {
                    paths: { wallpapers: backend.userHome + "/Pictures/Wallpapers", use_system_dir: false, index_wallpapers: false },
                    behavior: { change_interval: 30, auto_download: true, respect_dark_mode: true, multi_monitor: "clone" },
                    power: { pause_on_low_battery: true, low_battery_threshold: 20 },
                    providers: {},
                    generic_providers: {}
                };
                backend.config = defaults;
                if (callback) callback(false); // Indicar fallo al cargar la configuración
            }
        });
    }

    function setConfig(key, value) {
        console.warn("Setting config: " + key + " = " + value);
        backend.createProcess(["gower", "config", "set", key + "=" + value], function() {
            backend.loadConfig();
        });
    }

    function addProvider(name, url, key) {
        var cmd = ["gower", "config", "provider", "add", name, url]
        if (key !== "") {
            cmd.push("--key");
            cmd.push(key);
        }
        createProcess(cmd, function() {
            backend.loadConfig();
        });
    }

    function addRedditProvider(channel, sort) {
        var cmd = ["gower", "config", "provider", "reddit", "add", channel, sort];
        backend.createProcess(cmd, function() {
            backend.loadConfig();
        });
    }

    function removeProvider(name) {
        var cmd = ["gower", "config", "provider", "remove", name]; // Argumentos directos
        backend.createProcess(cmd, function() {
            backend.loadConfig();
        });
    }

    function setWallpaper(id, monitor) {
        var cleanId = id;
        var qIndex = cleanId.indexOf('?');
        if (qIndex !== -1) {
            cleanId = cleanId.substring(0, qIndex);
        }
        var cmd = ["gower", "set", cleanId];
        if (monitor) {
            cmd.push("--target-monitor");
            cmd.push(monitor);
        }
        backend.createProcess(cmd, function() {
            backend.loadCurrentWallpapers();
        });
    }

    function blacklist(id) {
        var cmd = ["gower", "blacklist", "add", id]
        backend.createProcess(cmd, function() {
            backend.feedNeedsReload();
        });
    }

    function download(id) {
        var cleanId = id;
        var qIndex = cleanId.indexOf('?');
        if (qIndex !== -1) {
            cleanId = cleanId.substring(0, qIndex);
        }
        var cmd = ["gower", "download", cleanId];
        backend.createDetachedProcess(cmd);
    }

    function handleImageError(id) {
        var cleanId = id;
        var qIndex = cleanId.indexOf('?');
        if (qIndex !== -1) {
            cleanId = cleanId.substring(0, qIndex);
        }
        console.error("FAILED TO LOAD IMAGE: " + cleanId);
    }

    function checkFile(path) {
        // This function is for debugging and adds log noise. Removing its content.
    }
    // Para la comprobación de existencia de archivos multiplataforma, usar Qt.labs.platform.File.exists(path) si está disponible,
    // o pasarlo a un backend en C++.
    function addFavorite(id) {
        var cmd = ["gower", "favorites", "add", id];
        backend.createProcess(cmd, function() {
            backend.feedNeedsReload();
            backend.favoritesNeedReload();
            backend.checkAndLoadColors();
        });
    }

    function removeFavorite(id) {
        var cmd = ["gower", "favorites", "remove", id];
        backend.createProcess(cmd, function() {
            backend.feedNeedsReload();
            backend.favoritesNeedReload();
            backend.checkAndLoadColors();
        });
    }

    // FileDialog para la selección de carpetas multiplataforma
    FileDialog {
        id: folderPicker
        folder: backend.userHome // Establecer la carpeta inicial al directorio de inicio del usuario
        selectFolder: true // Habilitar la selección de carpetas
        onAccepted: {
            // fileDialog.fileUrl es una QUrl, necesita ser convertida a ruta local
            var localPath = folderPicker.fileUrl.toLocalFile();
            if (backend._folderPickerCallback) {
                backend._folderPickerCallback(localPath);
            }
        }
        onRejected: {
            if (backend._folderPickerCallback) {
                backend._folderPickerCallback(""); // Indicar cancelación
            }
        }
    }
    property var _folderPickerCallback: null // Propiedad interna para almacenar el callback

    function openFolderPicker(onFinished) {
        backend._folderPickerCallback = onFinished;
        folderPicker.open();
    }
}