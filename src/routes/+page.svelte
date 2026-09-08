<script lang="ts">
  import type { CardSummary } from "$lib/server/scryfall";
  import CardListInput from "$lib/components/CardListInput.svelte";
  import CardSearch from "$lib/components/CardSearch.svelte";
  import CardUrlInput from "$lib/components/CardUrlInput.svelte";
  import PrintQueue from "$lib/components/PrintQueue.svelte";
  import ThemePicker from "$lib/components/ThemePicker.svelte";
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
    const discount = formatCartTotal(queue);
    busy = true;
    error = "";
    status = `Printing… discount: ${discount}; total: $0.00.`;
    try {
      const response = await fetch("/api/print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: queue.map((card) => card.id) }) });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Print failed");
      }
      queue = [];
      status = `Printed ${body.printed} card(s). Discount: ${discount}; total: $0.00.`;
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
  <ThemePicker />
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
    <p class="cart-total" aria-live="polite"><span class="discount">Discount: {formatCartTotal(queue)}</span><span class="final-total">Total: $0.00</span></p>
  {/if}
  <PrintQueue cards={queue} {busy} onremove={(index) => (queue = queue.filter((_, i) => i !== index))} onprint={print} />
  <p class="status" aria-live="polite">{status}</p>
  {#if error}<ErrorToast message={error} onclose={() => (error = "")} />{/if}
</main>
<style>
:global(:root) {
  color-scheme: light;
  --page: #f4f1ea;
  --surface: #ffffff;
  --surface-muted: #ece9e2;
  --text: #17202a;
  --muted: #5f6368;
  --border: #d8d2c6;
  --field-border: #aaa;
  --accent: #1769aa;
  --deal: #92400e;
  --deal-bg: #fffbeb;
  --success: #166534;
  --error-border: #9b1c1c;
  --error-bg: #fff5f5;
  --error-text: #651313;
}
:global(:root[data-theme="dark"]) {
  color-scheme: dark;
  --page: #101820;
  --surface: #18232d;
  --surface-muted: #23313d;
  --text: #eef2f4;
  --muted: #aeb9c2;
  --border: #3b4a56;
  --field-border: #627382;
  --accent: #75b9f0;
  --deal: #fbbf24;
  --deal-bg: #3a2d10;
  --deal-border: #b7791f;
  --success: #86efac;
  --error-border: #f87171;
  --error-bg: #3b1f24;
  --error-text: #fecaca;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme])) {
    color-scheme: dark;
    --page: #101820;
    --surface: #18232d;
    --surface-muted: #23313d;
    --text: #eef2f4;
    --muted: #aeb9c2;
    --border: #3b4a56;
    --field-border: #627382;
    --accent: #75b9f0;
    --deal: #fbbf24;
    --deal-bg: #3a2d10;
    --deal-border: #b7791f;
    --success: #86efac;
    --error-border: #f87171;
    --error-bg: #3b1f24;
    --error-text: #fecaca;
  }
}
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    font:
      16px/1.4 system-ui,
      sans-serif;
    color: var(--text);
    background: var(--page);
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
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
  font-variant-numeric: tabular-nums;
}
.discount {
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--deal-border);
  background: var(--deal-bg);
  color: var(--deal);
  font-weight: 700;
}
.final-total {
  color: var(--success);
  font-size: 1.2rem;
  font-weight: 800;
}
  :global(section) {
    background: var(--surface);
    border: 1px solid var(--border);
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
    display: block;
    width: 100%;
    padding: 0.65rem;
    border: 1px solid var(--field-border);
    border-radius: 4px;
    font: inherit;
  }
  :global(section > form button) {
    margin-top: 0.75rem;
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--field-border);
    border-radius: 4px;
    background: var(--surface-muted);
    color: var(--text);
  }
  :global(button:focus-visible),
  :global(input:focus-visible),
  :global(textarea:focus-visible) {
    outline: 3px solid var(--accent);
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
