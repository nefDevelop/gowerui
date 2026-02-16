<script>
  import "../index.css";
  import "../app.css";
  import { listen } from "@tauri-apps/api/event";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(() => {
    // Layout-specific lifecycle
  });
</script>

<main class="app-container">
  {@render children()}
</main>

<style>
  .app-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: radial-gradient(circle at top left, #1a1a2e, #121212);
  }
</style>
