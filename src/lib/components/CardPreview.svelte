<script lang="ts">
  import type { CardSummary } from "$lib/server/scryfall";

  export let card: CardSummary;
  export let mode: "select" | "remove" = "select";
  export let onclick: (() => void) | undefined = undefined;
  let imageFailed = false;
  const formatPrice = (value: string | undefined) => (value === undefined ? "" : `$${Number(value).toFixed(2)}`);
</script>

{#if mode === "select"}
  <button class="card-preview select" {onclick}>
    {#if imageFailed}<span class="image-fallback" aria-hidden="true">No image</span>{:else}<img src={card.preview_url} alt="" loading="lazy" decoding="async" onerror={() => (imageFailed = true)} />{/if}
    <span>{card.name}<small>{card.set.toUpperCase()} · {card.set_name} · #{card.collector_number}</small></span>
  </button>
{:else}
  <div class="card-preview">
    {#if imageFailed}<span class="image-fallback" aria-hidden="true">No image</span>{:else}<img src={card.preview_url} alt={card.name} loading="lazy" decoding="async" onerror={() => (imageFailed = true)} />{/if}
    <span>{card.name}<small>{card.set_name} · {card.collector_number}</small></span>
    {#if card.price}<span class="price">{formatPrice(card.price)}</span>{/if}
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
    background: var(--surface-muted);
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
    background: var(--surface-muted);
    color: var(--muted);
    font-size: 0.7rem;
    text-align: center;
  }
  small {
    display: block;
    color: var(--muted);
  }
  .remove {
    margin-left: 1.5rem;
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--field-border);
    border-radius: 4px;
    background: var(--surface-muted);
    color: var(--text);
  }
  .price {
    flex: 0 0 5.5rem;
    margin-left: auto;
    text-align: right;
    font-weight: 600;
    color: var(--success);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
  }
</style>
