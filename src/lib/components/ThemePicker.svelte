<script lang="ts">
  import { onMount } from "svelte";

  type Theme = "system" | "light" | "dark";
  const STORAGE_KEY = "mtg-theme";
  function initialTheme(): Theme {
    const value = typeof document === "undefined" ? "system" : document.documentElement.dataset.theme;
    return value === "light" || value === "dark" ? value : "system";
  }
  let theme: Theme = initialTheme();

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
  <div class="theme-buttons">
    {#each ["system", "light", "dark"] as option}
      <button
        type="button"
        class:active={theme === option}
        data-theme-option={option}
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
  button.active,
  :global(:root[data-theme="light"]) button[data-theme-option="light"],
  :global(:root[data-theme="dark"]) button[data-theme-option="dark"] {
    background: var(--surface);
    box-shadow: 0 1px 3px rgb(0 0 0 / 15%);
    color: var(--text);
    font-weight: 700;
  }
  :global(:root[data-theme]) button[data-theme-option="system"].active {
    background: transparent;
    box-shadow: none;
    color: var(--muted);
    font-weight: 400;
  }
</style>
