<script lang="ts">
  import { onMount } from "svelte";

  onMount(() => {
    const saved = localStorage.getItem("mtg-theme");
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  });
</script>

<slot />

<style>
  :global(:root) { color-scheme: light; --page:#f4f1ea; --surface:#fff; --surface-muted:#ece9e2; --text:#17202a; --muted:#5f6368; --border:#d8d2c6; --field-border:#aaa; --accent:#1769aa; --deal:#92400e; --deal-bg:#fffbeb; --success:#166534; --error-border:#9b1c1c; --error-bg:#fff5f5; --error-text:#651313; }
  :global(:root[data-theme="dark"]) { color-scheme: dark; --page:#101820; --surface:#18232d; --surface-muted:#23313d; --text:#eef2f4; --muted:#aeb9c2; --border:#3b4a56; --field-border:#627382; --accent:#75b9f0; --deal:#fbbf24; --deal-bg:#3a2d10; --success:#86efac; --error-border:#f87171; --error-bg:#3b1f24; --error-text:#fecaca; }
  @media (prefers-color-scheme: dark) { :global(:root:not([data-theme])) { color-scheme:dark; --page:#101820; --surface:#18232d; --surface-muted:#23313d; --text:#eef2f4; --muted:#aeb9c2; --border:#3b4a56; --field-border:#627382; --accent:#75b9f0; --deal:#fbbf24; --deal-bg:#3a2d10; --deal-border:#b7791f; --success:#86efac; --error-border:#f87171; --error-bg:#3b1f24; --error-text:#fecaca; } }
  :global(*) { box-sizing:border-box; }
  :global(body) { margin:0; font:16px/1.4 system-ui,sans-serif; color:var(--text); background:var(--page); }
  :global(button:focus-visible), :global(input:focus-visible), :global(textarea:focus-visible), :global(select:focus-visible) { outline:3px solid var(--accent); outline-offset:2px; }
  :global(button:disabled) { cursor:not-allowed; opacity:.5; }
</style>
