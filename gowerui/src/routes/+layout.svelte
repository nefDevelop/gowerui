<script>
  import "../index.css";
  import "../app.css";
  import { listen } from "@tauri-apps/api/event";
  import { onMount } from "svelte";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { theme } from "$lib/stores/theme"; // Initialize theme store

  let { children } = $props();

  onMount(() => {
    console.log("[Layout] Initializing theme store:", $theme);
    // Listen for theme sync event from tray
    const unlisten = listen("window-shown", () => {
      console.log(
        "[Layout] Received window-shown from Rust, notifying app.html...",
      );
      document.dispatchEvent(new CustomEvent("window-shown"));
    });

    return () => {
      unlisten.then((f) => f());
    };
  });
</script>

<main class="app-container">
  {@render children()}
</main>
<ToastContainer />

<style>
  .app-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--background);
  }
</style>
