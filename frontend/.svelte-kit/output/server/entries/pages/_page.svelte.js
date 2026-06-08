import { n as noop, a7 as fallback, e as ensure_array_like, a as attr_class, c as attr_style, a8 as attr, s as store_get, u as unsubscribe_stores, a9 as bind_props, aa as stringify, b as escape_html, a6 as derived$1 } from "../../chunks/index2.js";
import { d as derived, w as writable } from "../../chunks/index.js";
import "../../chunks/theme.js";
import "clsx";
function createEventDispatcher() {
  return noop;
}
const dictionary = {
  es: {
    "app.title": "Gower GUI",
    "settings.title": "Configuración",
    "settings.daemon": "Daemon",
    "settings.daemon.status": "Estado del servicio",
    "settings.daemon.starting": "INICIANDO...",
    "settings.daemon.stopping": "DETENIENDO...",
    "settings.daemon.active": "ACTIVO",
    "settings.daemon.inactive": "INACTIVO",
    "settings.interval": "Intervalo (minutos)",
    "settings.auto_download": "Auto Descarga",
    "settings.behavior": "Comportamiento",
    "settings.theme": "Tema",
    "settings.theme.system": "Sistema",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Oscuro",
    "settings.dark_mode": "Respetar Modo Oscuro",
    "settings.only_favorites": "Solo Favoritos",
    "settings.save_favorites": "Guardar favoritos en carpeta",
    "settings.power.pause_low_battery": "Pausar con Batería Baja",
    "settings.power.threshold": "Umbral Batería (%)",
    "settings.display": "Pantalla",
    "settings.multi_monitor": "Modo Multi-Monitor",
    "settings.monitor.distinct": "Independiente (Distinct)",
    "settings.monitor.clone": "Clonar (Clone)",
    "settings.general": "General",
    "settings.wallpapers_folder": "Carpeta de Wallpapers",
    "settings.use_system_dir": "Usar Directorio del Sistema",
    "settings.index_folder": "Indexar Carpeta",
    "settings.providers.title": "Fuentes (Providers)",
    "settings.providers.subtitle": "Configurar fuentes de wallpapers",
    "settings.providers.back": "Atrás",
    "settings.providers.custom": "Custom Providers",
    "settings.providers.add": "Añadir Custom",
    "settings.providers.name_placeholder": "Nombre (ej: wallpapers)",
    "settings.providers.url_placeholder": "URL o r/subreddit",
    "settings.providers.reddit_detected": "Reddit Detectado",
    "settings.providers.add_btn": "Añadir",
    "settings.delete_provider.title": "Eliminar Provider",
    "settings.delete_provider.confirm": "¿Estás seguro de que quieres eliminar",
    "settings.delete_provider.cancel": "Cancelar",
    "settings.delete_provider.delete": "Eliminar",
    "sort.smart": "Inteligente",
    "sort.random": "Aleatorio",
    "sort.newest": "Más Nuevos",
    "sort.oldest": "Más Antiguos",
    "sort.a_z": "A-Z",
    "sort.z_a": "Z-A",
    "grid.add_to_blacklist": "Añadir a lista negra",
    "grid.remove_from_favorites": "Quitar de favoritos",
    "grid.add_to_favorites": "Añadir a favoritos",
    "grid.download": "Descargar",
    "current.open_folder": "Abrir carpeta",
    "common.delete": "Eliminar",
    "color.select": "Seleccionar color {color}",
    "search.placeholder": "Buscar...",
    "search.button": "Buscar",
    "search.page": "Página {page}",
    "search.no_results": "No se encontraron resultados.",
    "search.hint": "Busca algo increíble.",
    "tabs.home": "Inicio",
    "tabs.search": "Buscar",
    "tabs.favorites": "Favoritos",
    "tabs.settings": "Ajustes",
    "language": "Idioma"
  },
  en: {
    "app.title": "Gower GUI",
    "settings.title": "Settings",
    "settings.daemon": "Daemon",
    "settings.daemon.status": "Service Status",
    "settings.daemon.starting": "STARTING...",
    "settings.daemon.stopping": "STOPPING...",
    "settings.daemon.active": "ACTIVE",
    "settings.daemon.inactive": "INACTIVE",
    "settings.interval": "Interval (minutes)",
    "settings.auto_download": "Auto Download",
    "settings.behavior": "Behavior",
    "settings.theme": "Theme",
    "settings.theme.system": "System",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
    "settings.dark_mode": "Respect Dark Mode",
    "settings.only_favorites": "Only Favorites",
    "settings.save_favorites": "Save favorites to folder",
    "settings.power.pause_low_battery": "Pause on Low Battery",
    "settings.power.threshold": "Battery Threshold (%)",
    "settings.display": "Display",
    "settings.multi_monitor": "Multi-Monitor Mode",
    "settings.monitor.distinct": "Distinct",
    "settings.monitor.clone": "Clone",
    "settings.general": "General",
    "settings.wallpapers_folder": "Wallpapers Folder",
    "settings.use_system_dir": "Use System Directory",
    "settings.index_folder": "Index Folder",
    "settings.providers.title": "Providers",
    "settings.providers.subtitle": "Configure wallpaper sources",
    "settings.providers.back": "Back",
    "settings.providers.custom": "Custom Providers",
    "settings.providers.add": "Add Custom",
    "settings.providers.name_placeholder": "Name (e.g. wallpapers)",
    "settings.providers.url_placeholder": "URL or r/subreddit",
    "settings.providers.reddit_detected": "Reddit Detected",
    "settings.providers.add_btn": "Add",
    "settings.delete_provider.title": "Delete Provider",
    "settings.delete_provider.confirm": "Are you sure you want to delete",
    "settings.delete_provider.cancel": "Cancel",
    "settings.delete_provider.delete": "Delete",
    "sort.smart": "Smart",
    "sort.random": "Random",
    "sort.newest": "Newest",
    "sort.oldest": "Oldest",
    "sort.a_z": "A-Z",
    "sort.z_a": "Z-A",
    "grid.add_to_blacklist": "Add to blacklist",
    "grid.remove_from_favorites": "Remove from favorites",
    "grid.add_to_favorites": "Add to favorites",
    "grid.download": "Download",
    "current.open_folder": "Open folder",
    "common.delete": "Delete",
    "color.select": "Select color {color}",
    "search.placeholder": "Search...",
    "search.button": "Search",
    "search.page": "Page {page}",
    "search.no_results": "No results found.",
    "search.hint": "Search for something amazing.",
    "tabs.home": "Home",
    "tabs.search": "Search",
    "tabs.favorites": "Favorites",
    "tabs.settings": "Settings",
    "language": "Language"
  }
};
function createI18nStore() {
  const storedLocale = typeof localStorage !== "undefined" ? localStorage.getItem("locale") : null;
  const initialLocale = storedLocale || (typeof navigator !== "undefined" && navigator.language.startsWith("en") ? "en" : "es");
  const locale2 = writable(initialLocale);
  const { subscribe, set, update } = locale2;
  return {
    subscribe,
    /** @param {string} l */
    set: (l) => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("locale", l);
      }
      set(l);
    },
    update
  };
}
const locale = createI18nStore();
const t = derived(
  locale,
  ($locale) => (
    /**
     * @param {string} key
     * @param {Record<string, any>} [vars={}]
     * @returns {string}
     */
    (key, vars = {}) => {
      const dict = dictionary;
      let text = dict[$locale]?.[key] || key;
      Object.entries(vars).forEach(([k, v]) => {
        const regex = new RegExp(`{${k}}`, "g");
        text = text.replace(regex, String(v));
      });
      return text;
    }
  )
);
function normalizeId(id) {
  return String(id).trim();
}
function ColorBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let colors = fallback(
      $$props["colors"],
      () => [
        "#FF0000",
        "#FF7F00",
        "#FFFF00",
        "#00FF00",
        "#0000FF",
        "#4B0082",
        "#9400D3",
        "#FFFFFF",
        "#000000"
      ],
      true
    );
    let selectedColor = fallback($$props["selectedColor"], "");
    $$renderer2.push(`<div class="color-filter glass-card svelte-16ja0vs"><!--[-->`);
    const each_array = ensure_array_like(colors);
    for (let i = 0, $$length = each_array.length; i < $$length; i++) {
      let color = each_array[i];
      $$renderer2.push(`<button type="button"${attr_class("color-segment svelte-16ja0vs", void 0, {
        "first": i === 0,
        "last": i === colors.length - 1,
        "selected": selectedColor === color
      })}${attr_style(`background-color: ${stringify(color)};`)}${attr("aria-label", store_get($$store_subs ??= {}, "$t", t)("color.select", { color }))}>`);
      if (selectedColor === color) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="material-icons check-icon svelte-16ja0vs">check</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></button>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { colors, selectedColor });
  });
}
function WallpaperGrid($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      items = [],
      loading = false,
      type = "home",
      // 'home' | 'favorites' | 'search' | 'current'
      favoritesList = [],
      // List of favorite items to check status
      collectionPath = ""
    } = $$props;
    let favoriteIds = derived$1(() => new Set(favoritesList.map((f) => normalizeId(f.id))));
    let recentlyDownloaded = [];
    function isFavorite(item) {
      if (!item || !item.id) return false;
      return favoriteIds().has(normalizeId(item.id));
    }
    function isDownloaded(item) {
      if (!item) return false;
      if (recentlyDownloaded.includes(item.id)) return true;
      if (item.source === "local") return true;
      if (!item.path) return false;
      const pathStr = item.path || "";
      const cleanCollection = (collectionPath || "").replace(/[\\/]$/, "");
      const cleanPath = pathStr.replace(/[\\/]$/, "");
      if (cleanCollection && cleanPath.startsWith(cleanCollection)) {
        return true;
      }
      if (cleanPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(cleanPath)) {
        if (!cleanPath.includes("/cache/") && !cleanPath.includes("\\cache\\")) {
          return true;
        }
      }
      return false;
    }
    $$renderer2.push(`<div class="grid premium-scroll svelte-i6onle"><!--[-->`);
    const each_array = ensure_array_like(items.slice(0, 9));
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let item = each_array[$$index];
      $$renderer2.push(`<div class="card glass-card svelte-i6onle" role="button" tabindex="0"><img${attr("src", item.thumbnail)}${attr("alt", item.id)} loading="lazy" class="svelte-i6onle" onerror="this.__e=event"/> <div class="overlay svelte-i6onle"><div class="actions svelte-i6onle"><button${attr("title", store_get($$store_subs ??= {}, "$t", t)("grid.add_to_blacklist"))} class="block-btn svelte-i6onle"><span class="material-icons svelte-i6onle">visibility_off</span></button> `);
      if (type !== "favorites") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button${attr("title", isFavorite(item) ? store_get($$store_subs ??= {}, "$t", t)("grid.remove_from_favorites") : store_get($$store_subs ??= {}, "$t", t)("grid.add_to_favorites"))} class="svelte-i6onle"><span${attr_class("material-icons svelte-i6onle", void 0, { "active": isFavorite(item) })}>${escape_html(isFavorite(item) ? "favorite" : "favorite_border")}</span></button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (!isDownloaded(item)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button${attr("title", store_get($$store_subs ??= {}, "$t", t)("grid.download"))} class="download-btn svelte-i6onle"><span class="material-icons svelte-i6onle">download</span></button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (type === "favorites") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<button class="danger svelte-i6onle"${attr("title", store_get($$store_subs ??= {}, "$t", t)("common.delete"))}><span class="material-icons svelte-i6onle">delete</span></button>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div></div> `);
      if (isFavorite(item) && type !== "favorites") {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="fav-badge svelte-i6onle"><span class="material-icons svelte-i6onle">favorite</span></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (isDownloaded(item)) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="download-badge svelte-i6onle"><span class="material-icons svelte-i6onle">save</span></div>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (loading && items.length === 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<!--[-->`);
      const each_array_1 = ensure_array_like(Array(9));
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        each_array_1[$$index_1];
        $$renderer2.push(`<div class="card skeleton svelte-i6onle"></div>`);
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function SortBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let sortOptions = fallback(
      $$props["sortOptions"],
      () => [
        { value: "Smart", label: "sort.smart" },
        { value: "Newest", label: "sort.newest" },
        { value: "Oldest", label: "sort.oldest" },
        { value: "Source", label: "Source" },
        // Provide defaults if no key
        { value: "Unseen", label: "Unseen" },
        { value: "Random", label: "sort.random" }
      ],
      true
    );
    let currentSort = fallback($$props["currentSort"], "Smart");
    let currentPage = fallback($$props["currentPage"], 1);
    const dispatch = createEventDispatcher();
    function handleSortChange(e) {
      dispatch("sort", e.target.value);
    }
    $$renderer2.push(`<div class="sort-bar glass-card svelte-95uaex"><div class="left svelte-95uaex"><span class="material-icons info-icon svelte-95uaex">sort</span> `);
    $$renderer2.select(
      {
        class: "sort-select",
        value: currentSort,
        onchange: handleSortChange
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(sortOptions);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let option = each_array[$$index];
          $$renderer3.option(
            { value: option.value, class: "" },
            ($$renderer4) => {
              $$renderer4.push(`${escape_html(store_get($$store_subs ??= {}, "$t", t)(option.label) || option.value)}`);
            },
            "svelte-95uaex"
          );
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-95uaex"
    );
    $$renderer2.push(`</div> <div class="center svelte-95uaex"><div class="paginator svelte-95uaex"><input type="number" min="1"${attr("value", currentPage)} class="svelte-95uaex"/></div></div> <div class="right svelte-95uaex"><button class="icon-btn svelte-95uaex" title="Deshacer"><span class="material-icons svelte-95uaex">undo</span></button></div></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
    bind_props($$props, { sortOptions, currentSort, currentPage });
  });
}
function CurrentWallpapersBar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      currentWallpapers = [],
      favoritesList = [],
      collectionPath = ""
    } = $$props;
    let favoriteIds = derived$1(() => new Set(favoritesList.map((f) => normalizeId(f.id))));
    function isFavorite(item) {
      if (!item || !item.id) return false;
      return favoriteIds().has(normalizeId(item.id));
    }
    function isDownloaded(item) {
      if (!item) return false;
      if (item.source === "local") return true;
      if (!item.path) return false;
      const pathStr = item.path || "";
      const cleanCollection = (collectionPath || "").replace(/[\\/]$/, "");
      const cleanPath = pathStr.replace(/[\\/]$/, "");
      if (cleanCollection && cleanPath.startsWith(cleanCollection)) {
        return true;
      }
      if (cleanPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(cleanPath)) {
        if (!cleanPath.includes("/cache/") && !cleanPath.includes("\\cache\\")) {
          return true;
        }
      }
      return false;
    }
    if (currentWallpapers.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="current-bar glass-card svelte-a6id7t"><div class="scroll-container svelte-a6id7t"><!--[-->`);
      const each_array = ensure_array_like(currentWallpapers);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<div class="wallpaper-item svelte-a6id7t" role="button" tabindex="0"><img${attr("src", item.thumbnail)}${attr("alt", item.id)} class="svelte-a6id7t"/> <div class="overlay svelte-a6id7t"><button${attr("title", store_get($$store_subs ??= {}, "$t", t)("common.favorite"))} class="svelte-a6id7t"><span${attr_class("material-icons svelte-a6id7t", void 0, { "active": isFavorite(item) })}>${escape_html(isFavorite(item) ? "favorite" : "favorite_border")}</span></button> <button class="block-btn svelte-a6id7t"${attr("title", store_get($$store_subs ??= {}, "$t", t)("grid.add_to_blacklist"))}><span class="material-icons svelte-a6id7t">visibility_off</span></button></div> ... `);
        if (isFavorite(item)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="fav-badge svelte-a6id7t"><span class="material-icons svelte-a6id7t">favorite</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--> `);
        if (isDownloaded(item)) {
          $$renderer2.push("<!--[0-->");
          $$renderer2.push(`<div class="download-badge svelte-a6id7t"><span class="material-icons svelte-a6id7t">save</span></div>`);
        } else {
          $$renderer2.push("<!--[-1-->");
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function DeleteDialog($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let open = fallback($$props["open"], false);
    let item = fallback($$props["item"], null);
    if (open && item) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="modal-overlay svelte-1wpsb6h" role="button" tabindex="0"><div class="modal glass-card svelte-1wpsb6h" role="dialog" aria-modal="true" tabindex="-1"><h3 class="svelte-1wpsb6h">Eliminar Wallpaper?</h3> `);
      if (item?.thumbnail) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<div class="preview svelte-1wpsb6h"><img${attr("src", item.thumbnail)} alt="Wallpaper to delete" class="preview-img svelte-1wpsb6h"/></div> <p class="title svelte-1wpsb6h">${escape_html(item.id)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
        $$renderer2.push(`<p class="title svelte-1wpsb6h">${escape_html(item?.id || "Unknown Item")}</p>`);
      }
      $$renderer2.push(`<!--]--> <div class="actions svelte-1wpsb6h"><button class="cancel svelte-1wpsb6h">Cancelar</button> <button class="delete svelte-1wpsb6h">Eliminar</button></div></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    bind_props($$props, { open, item });
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let currentTab = "home";
    let feedModel = [];
    let favoritesModel = [];
    let currentWallpapers = [];
    let loading = false;
    let feedPage = 1;
    let currentSort = "Smart";
    let selectedColor = "";
    let feedColors = [];
    let deleteDialogOpen = false;
    let itemToDelete = null;
    const sortOptions = [
      { value: "Smart", label: "sort.smart" },
      { value: "Newest", label: "sort.newest" },
      { value: "Oldest", label: "sort.oldest" },
      { value: "Source", label: "Source" },
      { value: "Unseen", label: "Unseen" },
      { value: "Random", label: "sort.random" },
      { value: "A-Z", label: "sort.a_z" },
      { value: "Z-A", label: "sort.z_a" }
    ];
    const tabs = [
      { id: "home", icon: "home", label: "tabs.home" },
      { id: "search", icon: "search", label: "tabs.search" },
      { id: "favorites", icon: "star", label: "tabs.favorites" },
      { id: "settings", icon: "settings", label: "tabs.settings" }
    ];
    const defaultConfig = {
      paths: { wallpapers: "" }
    };
    let config = defaultConfig;
    let $$settled = true;
    let $$inner_renderer;
    function $$render_inner($$renderer3) {
      $$renderer3.push(`<main class="app-container svelte-1uha8ag"><div class="titlebar svelte-1uha8ag"><div class="logo svelte-1uha8ag" data-wails-drag="">Gower</div> <div class="drag-spacer" data-wails-drag=""></div> <div class="window-controls"><button class="close-btn svelte-1uha8ag">×</button></div></div> <nav class="glass-card svelte-1uha8ag"><!--[-->`);
      const each_array = ensure_array_like(tabs);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let tab = each_array[$$index];
        $$renderer3.push(`<button${attr_class("svelte-1uha8ag", void 0, { "active": currentTab === tab.id })}><span class="material-icons svelte-1uha8ag">${escape_html(tab.icon)}</span> <span class="label">${escape_html(store_get($$store_subs ??= {}, "$t", t)(tab.label))}</span></button>`);
      }
      $$renderer3.push(`<!--]--> <div class="nav-spacer"></div> <button class="theme-toggle svelte-1uha8ag" title="Cambiar tema"><span class="material-icons theme-icon-light svelte-1uha8ag">light_mode</span> <span class="material-icons theme-icon-dark svelte-1uha8ag">dark_mode</span></button></nav> <div class="content svelte-1uha8ag">`);
      {
        $$renderer3.push("<!--[0-->");
        $$renderer3.push(`<div class="tab-pane home-layout svelte-1uha8ag"><div class="top-bar">`);
        ColorBar($$renderer3, { colors: feedColors, selectedColor });
        $$renderer3.push(`<!----></div> <div class="grid-area svelte-1uha8ag">`);
        WallpaperGrid($$renderer3, {
          items: feedModel,
          loading,
          favoritesList: favoritesModel,
          collectionPath: config?.paths?.wallpapers
        });
        $$renderer3.push(`<!----></div> <div class="bottom-bar svelte-1uha8ag">`);
        SortBar($$renderer3, { currentSort, sortOptions, currentPage: feedPage });
        $$renderer3.push(`<!----></div> `);
        CurrentWallpapersBar($$renderer3, {
          currentWallpapers,
          favoritesList: favoritesModel,
          collectionPath: config?.paths?.wallpapers
        });
        $$renderer3.push(`<!----></div>`);
      }
      $$renderer3.push(`<!--]--></div> `);
      DeleteDialog($$renderer3, { open: deleteDialogOpen, item: itemToDelete });
      $$renderer3.push(`<!----> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--> `);
      {
        $$renderer3.push("<!--[-1-->");
      }
      $$renderer3.push(`<!--]--></main>`);
    }
    do {
      $$settled = true;
      $$inner_renderer = $$renderer2.copy();
      $$render_inner($$inner_renderer);
    } while (!$$settled);
    $$renderer2.subsume($$inner_renderer);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
