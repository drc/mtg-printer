<script lang="ts">
  import type { CardSummary } from "$lib/server/scryfall";

  export let card: CardSummary;
  export let mode: "select" | "remove" = "select";
  export let onclick: (() => void) | undefined = undefined;
  let imageFailed = false;
</script>

{#if mode === "select"}
  <button class="card-preview select" {onclick}>
    {#if imageFailed}<span class="image-fallback" aria-hidden="true">No image</span>{:else}<img src={card.image_url} alt="" onerror={() => (imageFailed = true)} />{/if}
    <span>{card.name}<small>{card.set.toUpperCase()} · {card.set_name} · #{card.collector_number}</small></span>
  </button>
{:else}
  <div class="card-preview">
    {#if imageFailed}<span class="image-fallback" aria-hidden="true">No image</span>{:else}<img src={card.image_url} alt={card.name} onerror={() => (imageFailed = true)} />{/if}
    <span>{card.name}<small>{card.set_name} · {card.collector_number}</small></span>
    <button class="remove" aria-label={`Remove ${card.name}`} {onclick}>Remove</button>
  </div>
{/if}

<style>
  .card-preview {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0;
    text-align: left;
  }
  .select {
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
  }
  .select:hover {
    background: #f0eee9;
  }
  img,
  .image-fallback {
    width: 44px;
    height: 62px;
    object-fit: cover;
    border-radius: 3px;
  }
  .image-fallback {
    display: grid;
    place-items: center;
    background: #eee;
    color: #555;
    font-size: 0.7rem;
    text-align: center;
  }
  small {
    display: block;
    color: #5f6368;
  }
  .remove {
    margin-left: auto;
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    border: 1px solid #777;
    border-radius: 4px;
    background: #fff;
  }
</style>
