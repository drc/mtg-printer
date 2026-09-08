<script lang="ts">
  import type { CardSummary } from "$lib/server/scryfall";
  import CardListInput from "$lib/components/CardListInput.svelte";
  import CardSearch from "$lib/components/CardSearch.svelte";
  import CardUrlInput from "$lib/components/CardUrlInput.svelte";
  import PrintQueue from "$lib/components/PrintQueue.svelte";
  import ErrorToast from "$lib/components/ErrorToast.svelte";

  let queue: CardSummary[] = [];
  let status = "";
  let busy = false;
  let error = "";
  function formatCartTotal(cards: CardSummary[]): string {
    const total = cards.reduce((sum, card) => {
      const price = parseFloat(card.price ?? "0");
      return sum + (isNaN(price) ? 0 : price);
    }, 0);
    return total === 0 ? "—" : `$${total.toFixed(2)}`;
  }

  function add(card: CardSummary) {
    queue = [...queue, card];
  }

  async function addList(names: string[]): Promise<boolean> {
    busy = true;
    error = "";
    status = "Resolving cards…";
    try {
      const response = await fetch("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ names }) });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Could not resolve list");
      }
      queue = [...queue, ...body.cards];
      status = `${body.cards.length} card(s) added.`;
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not resolve list";
      status = "";
      return false;
    } finally {
      busy = false;
    }
  }

  async function addUrl(url: string): Promise<boolean> {
    busy = true;
    error = "";
    status = "Resolving card link…";
    try {
      const response = await fetch("/api/cards", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Could not resolve link");
      }
      queue = [...queue, ...body.cards];
      status = "Card added.";
      return true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Could not resolve link";
      status = "";
      return false;
    } finally {
      busy = false;
    }
  }

  async function print() {
    busy = true;
    error = "";
    status = "Printing…";
    try {
      const response = await fetch("/api/print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: queue.map((card) => card.id) }) });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Print failed");
      }
      queue = [];
      status = `Printed ${body.printed} card(s).`;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Print failed";
      status = "";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>MTG Proxy Printer</title>
  <meta name="description" content="Print Magic: The Gathering proxies" />
</svelte:head>

<main aria-busy={busy}>
  <h1>MTG Proxy Printer</h1>
  <CardSearch
    onselect={add}
    onerror={(message) => {
      error = message;
      status = "";
    }} />
  <CardListInput {busy} onadd={addList} />
  <CardUrlInput {busy} onadd={addUrl} />
  {#if queue.length}
    <p class="cart-total" aria-live="polite">Cart total: {formatCartTotal(queue)}</p>
  {/if}
  <PrintQueue cards={queue} {busy} onremove={(index) => (queue = queue.filter((_, i) => i !== index))} onprint={print} />
  <p class="status" aria-live="polite">{status}</p>
  {#if error}<ErrorToast message={error} onclose={() => (error = "")} />{/if}
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    font:
      16px/1.4 system-ui,
      sans-serif;
    color: #17202a;
    background: #f4f1ea;
  }
  main {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }
h1 {
  margin-bottom: 2rem;
}
.cart-total {
  font-weight: 600;
  color: #2e7d32;
  font-size: 1.05rem;
  text-align: right;
  margin: 0.5rem 0 0;
}
  :global(section) {
    background: white;
    border: 1px solid #d8d2c6;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }
  :global(h2) {
    font-size: 1.1rem;
    margin-top: 0;
  }
  :global(label) {
    display: block;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem;
  }
  :global(input),
  :global(textarea) {
    width: 100%;
    padding: 0.65rem;
    border: 1px solid #aaa;
    border-radius: 4px;
    font: inherit;
  }
  :global(section > form button) {
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    border: 1px solid #777;
    border-radius: 4px;
    background: #fff;
  }
  :global(button:focus-visible),
  :global(input:focus-visible),
  :global(textarea:focus-visible) {
    outline: 3px solid #1769aa;
    outline-offset: 2px;
  }
  :global(button:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .status {
    min-height: 1.4em;
    font-weight: 600;
  }
</style>
