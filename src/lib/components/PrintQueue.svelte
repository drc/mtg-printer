<script lang="ts">
  import type { CardSummary } from "$lib/server/scryfall";
  import CardPreview from "./CardPreview.svelte";

  export let cards: CardSummary[] = [];
  export let busy = false;
  export let onremove: (index: number) => void;
  export let onprint: () => void;
  function formatTotal(cards: CardSummary[]): string {
    const total = cards.reduce((sum, card) => {
      const price = parseFloat(card.price ?? "0");
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
    return total === 0 ? "—" : `$${total.toFixed(2)}`;
  }
  function remove(index: number) {
    onremove(index);
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".remove")?.focus());
  }
</script>

<section aria-labelledby="queue-heading" aria-busy={busy}>
  <h2 id="queue-heading">Print queue ({cards.length})</h2>
  <p class="sr-only" aria-live="polite">{cards.length} card{cards.length === 1 ? "" : "s"} queued.</p>
  {#if cards.length}
    <ul class="queue" aria-label="Cards waiting to print">
      {#each cards as card, index (index)}
        <li><CardPreview {card} mode="remove" onclick={() => remove(index)} /></li>
      {/each}
    </ul>
  {:else}
    <p>No cards queued.</p>
  {/if}
  <p class="total" aria-live="polite">Total: {formatTotal(cards)}</p>
  <button class="print" onclick={onprint} disabled={busy || !cards.length}>{busy ? "Printing… (free!)" : "Print queue"}</button>
</section>

<style>
  .queue {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0;
  }
  .queue li + li {
    border-top: 1px solid #eee;
  }
.print {
  margin-top: 1rem;
  width: 100%;
  cursor: pointer;
  padding: 0.55rem 0.8rem;
  border: 1px solid #777;
  border-radius: 4px;
  background: #17202a;
  color: white;
}
.print:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.total {
  margin-top: 0.75rem;
  font-weight: 600;
  text-align: right;
  color: #2e7d32;
  font-size: 0.95rem;
}
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
