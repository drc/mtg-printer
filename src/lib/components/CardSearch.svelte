<script lang="ts">
  import { onDestroy } from "svelte";
  import type { CardSummary } from "$lib/server/scryfall";
  import CardPreview from "./CardPreview.svelte";

  export let onselect: (card: CardSummary) => void;
  export let onerror: (message: string) => void;
  let query = "";
  let results: CardSummary[] = [];
  let activeIndex = -1;
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function search() {
    const value = query.trim();
    if (!value) {
      results = [];
      activeIndex = -1;
      return;
    }
    try {
      const response = await fetch(`/api/cards?q=${encodeURIComponent(value)}`);
      const body = await response.json();
      if (!response.ok) {
        onerror(body.error ?? "Search failed");
        return;
      }
      results = body.cards;
      activeIndex = -1;
    } catch (error) {
      onerror(error instanceof Error ? error.message : "Search failed");
    }
  }
  function scheduleSearch() {
    clearTimeout(timer);
    timer = setTimeout(search, 300);
  }
  function select(card: CardSummary) {
    onselect(card);
    results = [];
    query = "";
    activeIndex = -1;
    input?.focus();
  }
  function navigate(event: KeyboardEvent) {
    if (!results.length) {
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeIndex = (activeIndex + step + results.length) % results.length;
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(results[activeIndex]);
    } else if (event.key === "Escape") {
      results = [];
      activeIndex = -1;
    }
  }
  onDestroy(() => clearTimeout(timer));
</script>

<section aria-labelledby="search-heading">
  <h2 id="search-heading">Find cards</h2>
  <label for="search">Search Scryfall</label>
  <input
    bind:this={input}
    id="search"
    bind:value={query}
    oninput={scheduleSearch}
    onkeydown={navigate}
    aria-controls="search-results"
    aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
    placeholder="Lightning Bolt"
    autocomplete="off" />
  <p class="sr-only" aria-live="polite">{results.length ? `${results.length} printings found.` : ""}</p>
  {#if results.length}
    <ul id="search-results" class="results" role="listbox" aria-label="Card printings">
      {#each results as card, index (card.id)}
        <li id={`search-result-${index}`} role="option" aria-selected={index === activeIndex}><CardPreview {card} onclick={() => select(card)} /></li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .results {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 0;
  }
  .results li + li {
    border-top: 1px solid var(--border);
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
