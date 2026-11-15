<script>
  import "../index.css";
  import "../app.css";
  import ToastContainer from "$lib/components/ToastContainer.svelte";
  import { theme } from "$lib/stores/theme"; // Initialize theme store
  import { t } from "$lib/stores/i18n";
  import { openLogFile } from "$lib/api";

  let { children } = $props();

  /**
   * Abre el log desde la pantalla de error. Si el binding también falla no se
   * debe volver a romper la ventana: el error va a la consola y ya está.
   */
  async function showLogs() {
    try {
      await openLogFile();
    } catch (e) {
      console.error("[LAYOUT] Failed to open the log:", e);
    }
  }
</script>

<main class="app-container">
  <!-- Sin boundary, cualquier throw en un componente deja la ventana en
       blanco sin explicación ni forma de reintentar. -->
  <svelte:boundary>
    {@render children()}

    {#snippet failed(error, reset)}
      <div class="crash">
        <h2>{$t("app.crashed_title")}</h2>
        <p>{$t("app.crashed_hint")}</p>
        <pre>{String(error)}</pre>
        <div class="crash-actions">
          <button onclick={reset}>{$t("app.crashed_retry")}</button>
          <button onclick={showLogs}>{$t("settings.logs_open")}</button>
        </div>
      </div>
    {/snippet}
  </svelte:boundary>
</main>
<ToastContainer />

<style>
  .app-container {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--background);
  }

  .crash {
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
    padding: 32px 24px;
    overflow-y: auto;
    color: var(--on-background);
  }

  .crash h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .crash p {
    margin: 0;
    opacity: 0.8;
    font-size: 0.85rem;
  }

  .crash pre {
    margin: 0;
    padding: 12px;
    border-radius: 8px;
    background: var(--surface-container);
    font-size: 0.75rem;
    white-space: pre-wrap;
    word-break: break-word;
    user-select: text;
  }

  .crash-actions {
    display: flex;
    gap: 8px;
  }

  .crash-actions button {
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    background: var(--primary);
    color: var(--on-primary);
    font-size: 0.8rem;
    cursor: pointer;
  }
</style>
