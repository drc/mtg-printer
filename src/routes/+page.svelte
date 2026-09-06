<script lang="ts">
  import { onDestroy } from "svelte";
  import type { CardSummary } from "$lib/server/scryfall";

  let query = "";
  let results: CardSummary[] = [];
  let queue: CardSummary[] = [];
  let names = "";
  let cardUrl = "";
  let status = "";
  let busy = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function search() {
    const value = query.trim();
    if (!value) {
      results = [];
      return;
    }
    const response = await fetch(`/api/cards?q=${encodeURIComponent(value)}`);
    const body = await response.json();
    if (!response.ok) {
      status = body.error ?? "Search failed";
      return;
    }
    results = body.cards;
  }

  function scheduleSearch() {
    clearTimeout(timer);
    timer = setTimeout(search, 300);
  }

  function add(card: CardSummary) {
    queue = [...queue, card];
    results = [];
    query = "";
  }

  async function addList() {
    const lines = names.split("\n");
    busy = true;
    status = "Resolving cards…";
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ names: lines }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Could not resolve list");
      }

      queue = [...queue, ...body.cards];
      names = "";
      status = `${body.cards.length} card(s) added.`;
    } catch (error) {
      status = error instanceof Error ? error.message : "Could not resolve list";
    } finally {
      busy = false;
    }
  }

  async function addUrl() {
    busy = true;
    status = "Resolving card link…";

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: cardUrl }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "Could not resolve link");
      }

      queue = [...queue, ...body.cards];
      cardUrl = "";
      status = "Card added.";
    } catch (error) {
      status = error instanceof Error ? error.message : "Could not resolve link";
    } finally {
      busy = false;
    }
  }

  async function print() {
    busy = true;
    status = "Printing…";
    
    try {
      const response = await fetch("/api/print", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: queue.map((card) => card.id) }),
      });
      
      const body = await response.json();
      
      if (!response.ok) {
        throw new Error(body.error ?? "Print failed");
      }
      
      queue = [];
      status = `Printed ${body.printed} card(s).`;
    } catch (error) {
      status = error instanceof Error ? error.message : "Print failed";
    } finally {
      busy = false;
    }
  }
  onDestroy(() => clearTimeout(timer));
</script>

<svelte:head
  ><title>MTG Proxy Printer</title><meta
    name="description"
    content="Print Magic: The Gathering proxies"
  /></svelte:head
>
<main>
  <h1>MTG Proxy Printer</h1>
  <section aria-labelledby="search-heading">
    <h2 id="search-heading">Find cards</h2>
    <label for="search">Search Scryfall</label>
    <input
      id="search"
      bind:value={query}
      oninput={scheduleSearch}
      placeholder="Lightning Bolt"
      autocomplete="off"
    />
    {#if results.length}<ul class="results">
        {#each results as card (card.id)}<li>
            <button onclick={() => add(card)}
              ><img src={card.image_url} alt="" />
              <span
                >{card.name}<small
                  >{card.set.toUpperCase()} · {card.set_name} · #{card.collector_number}</small
                ></span
              ></button
            >
          </li>{/each}
      </ul>{/if}
  </section>
  <section aria-labelledby="list-heading">
    <h2 id="list-heading">Paste names</h2>
    <label for="names">One card name per line</label>
    <textarea id="names" bind:value={names} rows="4" placeholder="Lightning Bolt&#10;Counterspell"
    ></textarea>
    <button onclick={addList} disabled={busy || !names.trim()}>Add list</button>
  </section>
  <section aria-labelledby="link-heading">
    <h2 id="link-heading">Add a card link</h2>
    <label for="card-url">Scryfall card URL</label>
    <input
      id="card-url"
      bind:value={cardUrl}
      type="url"
      placeholder="https://scryfall.com/card/slz/3/eerie-interlude"
    />
    <button onclick={addUrl} disabled={busy || !cardUrl.trim()}>Add card</button>
  </section>
  <section aria-labelledby="queue-heading">
    <h2 id="queue-heading">Print queue ({queue.length})</h2>
    {#if queue.length}<ul class="queue">
        {#each queue as card, index (index)}<li>
            <img src={card.image_url} alt={card.name} /><span
              >{card.name}<small>{card.set_name} · {card.collector_number}</small></span
            ><button
              aria-label={`Remove ${card.name}`}
              onclick={() => (queue = queue.filter((_, i) => i !== index))}>Remove</button
            >
          </li>{/each}
      </ul>{:else}<p>No cards queued.</p>{/if}
    <button class="print" onclick={print} disabled={busy || !queue.length}>Print queue</button>
  </section>
  <p class="status" aria-live="polite">{status}</p>
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
  section {
    background: white;
    border: 1px solid #d8d2c6;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }
  h2 {
    font-size: 1.1rem;
    margin-top: 0;
  }
  label {
    display: block;
    font-weight: 600;
    margin: 0.5rem 0 0.25rem;
  }
  input,
  textarea {
    width: 100%;
    padding: 0.65rem;
    border: 1px solid #aaa;
    border-radius: 4px;
    font: inherit;
  }
  button {
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    border: 1px solid #777;
    border-radius: 4px;
    background: #fff;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .results,
  .queue {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0;
  }
  .results li + li,
  .queue li + li {
    border-top: 1px solid #eee;
  }
  .results button,
  .queue li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
    padding: 0.5rem 0;
    border: 0;
    border-radius: 0;
  }
  .results button:hover {
    background: #f0eee9;
  }
  img {
    width: 44px;
    height: 62px;
    object-fit: cover;
    border-radius: 3px;
  }
  small {
    display: block;
    color: #5f6368;
  }
  .queue li button {
    margin-left: auto;
  }
  .print {
    margin-top: 1rem;
    width: 100%;
    background: #17202a;
    color: white;
  }
  .status {
    min-height: 1.4em;
    font-weight: 600;
  }
</style>
