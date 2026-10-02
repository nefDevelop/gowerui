<script>
  import "../index.css";
  import "../app.css";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { theme } from "$lib/stores/theme"; // Initialize theme store

  let { children } = $props();
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