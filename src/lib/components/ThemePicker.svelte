<script lang="ts">
  import { onMount } from "svelte";

  type Theme = "system" | "light" | "dark";
  const STORAGE_KEY = "mtg-theme";
  let theme: Theme = "system";

  function applyTheme(value: Theme) {
    theme = value;
    if (value === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = value;
    }
    localStorage.setItem(STORAGE_KEY, value);
  }

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      applyTheme(saved);
    }
  });
</script>

<div class="theme-picker" role="group" aria-label="Color theme">
  <span class="theme-label">Theme</span>
  <div class="theme-buttons">
    {#each ["system", "light", "dark"] as option}
      <button
        type="button"
        class:active={theme === option}
        aria-pressed={theme === option}
        onclick={() => applyTheme(option as Theme)}>
        {option[0].toUpperCase() + option.slice(1)}
      </button>
    {/each}
  </div>
</div>

<style>
  .theme-picker {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .theme-label {
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .theme-buttons {
    display: flex;
    gap: 0.25rem;
    padding: 0.2rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-muted);
  }
  button {
    cursor: pointer;
    padding: 0.35rem 0.65rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 0.85rem;
  }
  button.active {
    background: var(--surface);
    box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
    color: var(--text);
    font-weight: 700;
  }
</style>
