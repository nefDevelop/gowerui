import "clsx";
import { e as ensure_array_like, s as store_get, a as attr_class, b as escape_html, c as attr_style, u as unsubscribe_stores } from "../../chunks/index2.js";
import { n as notifications } from "../../chunks/theme.js";
function ToastContainer($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    function getTypeColor(type) {
      switch (type) {
        case "error":
          return "var(--error, #cf6679)";
        case // Red/Pink
        "success":
          return "var(--success, #03dac6)";
        case // Teal/Green
        "warning":
          return "var(--warning, #ffb74d)";
        default:
          return "var(--primary, #bb86fc)";
      }
    }
    function getIcon(type) {
      switch (type) {
        case "error":
          return "error_outline";
        case "success":
          return "check_circle";
        case "warning":
          return "warning_amber";
        default:
          return "info";
      }
    }
    $$renderer2.push(`<div class="toast-container svelte-cqwvc2"><!--[-->`);
    const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$notifications", notifications));
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let toast = each_array[$$index];
      $$renderer2.push(`<div${attr_class("toast svelte-cqwvc2", void 0, {
        "error": toast.type === "error",
        "success": toast.type === "success"
      })}><span class="material-icons icon svelte-cqwvc2">${escape_html(getIcon(toast.type))}</span> <span class="message svelte-cqwvc2">${escape_html(toast.message)}</span> <button class="close-btn svelte-cqwvc2"><span class="material-icons svelte-cqwvc2">close</span></button> <div class="progress-bar svelte-cqwvc2"${attr_style("", { "background-color": getTypeColor(toast.type) })}></div></div>`);
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { children } = $$props;
    $$renderer2.push(`<main class="app-container svelte-12qhfyh">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main> `);
    ToastContainer($$renderer2);
    $$renderer2.push(`<!---->`);
  });
}
export {
  _layout as default
};
