<script lang="ts">
  import { onMount } from "svelte";
  import ThemePicker from "$lib/components/ThemePicker.svelte";
  import ErrorToast from "$lib/components/ErrorToast.svelte";
  import { BASIC_LANDS, basicLandToHand, createSession, drawCard, drawOpeningHand, exileTop, keepHand, mill, moveHandCard, mulligan, revealTop, returnCardToLibrary, searchLibraryToHand, shuffleLibrary, type CardInstance, type SessionDeck, type SessionState, type ZoneName } from "$lib/game-state";

  const STORAGE_KEY = "mtg-play-session-v1";
  let links = ["", "", "", ""];
  let busy = false;
  let error = "";
  let session: SessionState | null = null;
  let status = "";
  let search: Record<string, string> = {};
  let confirmReset = false;

  function validState(value: unknown): value is SessionState {
    if (!value || typeof value !== "object") return false;
    const v = value as SessionState;
    if (v.version !== 1 || typeof v.sessionId !== "string" || !v.sessionId || !v.decks || typeof v.decks !== "object" || !v.cards || typeof v.cards !== "object" || !Array.isArray(v.actionLog) || !Array.isArray(v.keptHands) || !Array.isArray(v.openingHands)) return false;
    const ids = new Set(Object.keys(v.cards));
    for (const [deckId, zones] of Object.entries(v.decks)) {
      if (!zones || typeof zones !== "object") return false;
      for (const zone of ["library", "hand", "graveyard", "exile", "command"] as const) {
        if (!Array.isArray(zones[zone]) || zones[zone].some((id) => typeof id !== "string" || !ids.has(id))) return false;
      }
      if (Object.values(v.cards).some((card) => !card || card.deckId === deckId && (!ids.has(card.instanceId) || typeof card.name !== "string"))) return false;
    }
    return Object.values(v.cards).every((card) => card && typeof card.instanceId === "string" && typeof card.name === "string" && typeof card.deckId === "string" && Number.isInteger(card.cardNumber));
  }
  onMount(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (validState(parsed)) { session = parsed; status = parsed.status; } else localStorage.removeItem(STORAGE_KEY); } } catch { localStorage.removeItem(STORAGE_KEY); }
  });
  function persist(next: SessionState) { session = next; status = next.status; localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function random() { return crypto.getRandomValues(new Uint32Array(1))[0]; }
  function act(fn: () => SessionState) { if (!session) return; try { persist(fn()); } catch (cause) { error = cause instanceof Error ? cause.message : "Action failed"; } }
  function cardsIn(deckId: string, zone: ZoneName): CardInstance[] { if (!session) return []; return (session.decks[deckId]?.[zone] ?? []).map((id) => session!.cards[id]).filter(Boolean); }
  function cardMeta(card: CardInstance) { return `${card.name} · #${card.cardNumber}/100`; }
  function privateCardMeta(card: CardInstance) { return `Card #${card.cardNumber}/100 · ${card.instanceId.slice(-8)}`; }
  async function printCards(cards: CardInstance[], successMessage: string) {
    if (!session || !cards.length) return;
    busy = true; error = ""; status = "Printing…";
    try {
      const response = await fetch("/api/game-print", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: session.sessionId, cards: cards.map((card) => ({ id: card.scryfallId, label: { deckId: card.deckId, deckName: card.deckName, cardNumber: card.cardNumber } })) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Print failed");
      status = successMessage;
    } catch (cause) { error = cause instanceof Error ? cause.message : "Print failed"; status = ""; }
    finally { busy = false; }
  }
  async function printCommander(deckId: string) {
    if (!session) return;
    const commander = cardsIn(deckId, "command")[0];
    if (!commander) { error = "This deck has no commander to print."; return; }
    await printCards([commander], `Printed commander: ${commander.name}.`);
  }
  async function drawOpeningHandAndPrint(deckId: string) {
    if (!session || busy) return;
    const previous = session; const next = drawOpeningHand(previous, deckId, random); persist(next);
    if (next.actionLog.length === previous.actionLog.length) return;
    await printCards(next.decks[deckId].hand.map((id) => next.cards[id]), `Printed opening hand (${next.decks[deckId].hand.length} cards).`);
  }
  async function drawCardAndPrint(deckId: string) {
    if (!session || busy) return;
    const previous = session; const next = drawCard(previous, deckId, random); persist(next);
    if (next.actionLog.length === previous.actionLog.length) return;
    const id = next.decks[deckId].hand.at(-1); if (id) await printCards([next.cards[id]], "Printed drawn card.");
  }
  async function mulliganAndPrint(deckId: string) {
    if (!session || busy) return;
    const previous = session; const next = mulligan(previous, deckId, random); persist(next);
    if (next.actionLog.length === previous.actionLog.length) return;
    await printCards(next.decks[deckId].hand.map((id) => next.cards[id]), `Printed mulligan hand (${next.decks[deckId].hand.length} cards).`);
  }
  async function basicLandAndPrint(deckId: string, name: typeof BASIC_LANDS[number]) {
    if (!session || busy) return;
    const previous = session; const next = basicLandToHand(previous, deckId, name, random); persist(next);
    if (next.actionLog.length === previous.actionLog.length) return;
    const id = next.decks[deckId].hand.at(-1); if (id) await printCards([next.cards[id]], "Printed basic land.");
  }
  async function searchCard(deckId: string, card: CardInstance) {
    const term = (search[deckId] ?? "").trim(); if (!session || !term || busy) return;
    const previous = session; const next = searchLibraryToHand(previous, deckId, term, card.instanceId, random); persist(next); search = { ...search, [deckId]: "" };
    if (next.actionLog.length === previous.actionLog.length) return;
    await printCards([next.cards[card.instanceId]], "Printed searched card.");
  }

  async function start() {
    const values = links.map((link) => link.trim()).filter(Boolean);
    if (values.length < 2 || values.length > 4) { error = "Enter 2–4 deck links."; return; }
    busy = true; error = ""; status = "Importing decks…";
    try {
      const response = await fetch("/api/decks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ links: values }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not import decks");
      const imported = body.decks as Array<{ deckId: string; deckName: string; cards: Array<Record<string, unknown>> }>;
      if (!Array.isArray(imported) || imported.length < 2) throw new Error("The import returned no usable decks.");
      const decks: SessionDeck[] = imported.map((deck) => ({ deckId: deck.deckId, deckName: deck.deckName, cards: deck.cards.map((card, i) => ({ instanceId: `${deck.deckId}:${i + 1}`, scryfallId: String(card.id), name: String(card.name), imageUrl: String(card.image_url ?? card.preview_url ?? ""), deckId: deck.deckId, deckName: deck.deckName, cardNumber: Number(card.cardNumber ?? i + 1), isCommander: Boolean(card.isCommander) })) }));
      persist(createSession(decks, random));
    } catch (cause) { error = cause instanceof Error ? cause.message : "Could not import decks"; status = ""; } finally { busy = false; }
  }
  function reset() { if (!confirmReset) { confirmReset = true; return; } confirmReset = false; session = null; localStorage.removeItem(STORAGE_KEY); status = "New session ready"; }
  function invoke(deckId: string, action: (state: SessionState) => SessionState) { act(() => action(session!)); }
  function move(deckId: string, id: string, to: "graveyard" | "exile") { invoke(deckId, (s) => moveHandCard(s, deckId, id, to)); }
  function returnCard(deckId: string, id: string, from: "graveyard" | "exile") { invoke(deckId, (s) => returnCardToLibrary(s, deckId, id, from, random)); }
  function shortId() { return session?.sessionId.slice(0, 8) ?? ""; }

</script>
<svelte:head><title>Play · MTG Proxy Printer</title><meta name="description" content="Play a tracked tabletop deck session" /></svelte:head>
<main class:tabletop={!!session} aria-busy={busy}>
  <header class="topbar"><div><p class="eyebrow">NEARBY PRINTER / TABLETOP</p><h1>Play session</h1></div><div class="header-tools"><ThemePicker />{#if session}<span class="session-id" title={session.sessionId}>Session {shortId()}</span><button class="reset" type="button" onclick={reset}>{confirmReset ? "Confirm reset" : "Reset game"}</button>{/if}</div></header>
  {#if !session}
    <section class="start-card"><p class="eyebrow">START A CLOSED DECK SET</p><h2>Bring your table online</h2><p class="muted">Import 2–4 public Commander deck links. Every card instance stays traceable in this browser.</p><form onsubmit={(event) => { event.preventDefault(); start(); }}>
      {#each links as link, i}<label for={`deck-${i}`}>Deck {i + 1}{i < 2 ? " · required" : " · optional"}<input id={`deck-${i}`} bind:value={links[i]} type="url" placeholder="https://moxfield.com/decks/…" /></label>{/each}
      <button class="primary" type="submit" disabled={busy}>{busy ? "Importing…" : "Import decks"}</button>
    </form><p class="status" aria-live="polite">{status}</p></section>
  {:else}
    <section class="session-strip"><div><strong>{Object.keys(session.decks).length} decks in play</strong><span> · {Object.keys(session.cards).length} tracked card instances</span></div><span class="status" aria-live="polite">{status}</span></section>
    <div class="deck-grid">
      {#each Object.entries(session.decks) as [deckId, zones]}
        {@const deckCards = Object.values(session.cards).filter((card) => card.deckId === deckId)}
        <section class="deck-panel" aria-labelledby={`deck-${deckId}`}>
          <div class="deck-heading"><div><p class="eyebrow">DECK {deckCards[0]?.deckName ?? deckId}</p><h2 id={`deck-${deckId}`}>{deckCards.length} cards · {zones.library.length} library</h2></div><span class="deck-id">{deckId}</span></div>
          <div class="counts"><span>Hand <b>{zones.hand.length}</b></span><span>Grave <b>{zones.graveyard.length}</b></span><span>Exile <b>{zones.exile.length}</b></span><span>Command <b>{zones.command.length}</b></span></div>
          {#each cardsIn(deckId, "command").slice(0, 1) as commander}<div class="command-zone"><div><h3>Commander</h3><span>{cardMeta(commander)}</span></div><button type="button" onclick={() => printCommander(deckId)} disabled={busy}>Print commander</button></div>{/each}
          <div class="actions primary-actions"><button type="button" onclick={() => drawOpeningHandAndPrint(deckId)} disabled={busy || zones.library.length === 0 || session.openingHands.includes(deckId)}>Opening hand + print</button><button type="button" onclick={() => mulliganAndPrint(deckId)} disabled={busy || session.keptHands.includes(deckId) || !session.openingHands.includes(deckId)}>Mulligan + print</button><button type="button" onclick={() => invoke(deckId, (s) => keepHand(s, deckId))} disabled={busy || !session.openingHands.includes(deckId) || session.keptHands.includes(deckId)}>Keep hand</button><button type="button" onclick={() => drawCardAndPrint(deckId)} disabled={busy || !zones.library.length}>Draw + print</button></div>
          <div class="actions"><button type="button" onclick={() => invoke(deckId, (s) => mill(s, deckId))} disabled={!zones.library.length}>Mill</button><button type="button" onclick={() => invoke(deckId, (s) => exileTop(s, deckId))} disabled={!zones.library.length}>Exile top</button><button type="button" onclick={() => invoke(deckId, (s) => revealTop(s, deckId))} disabled={!zones.library.length}>Reveal top</button><button type="button" onclick={() => invoke(deckId, (s) => shuffleLibrary(s, deckId, random))}>Shuffle library</button></div>
          <div class="search-box"><label for={`search-${deckId}`}>Search library by card name<input id={`search-${deckId}`} placeholder="Exact card name" bind:value={search[deckId]} /></label>{#if (search[deckId] ?? "").trim()}<div class="matches">{#each cardsIn(deckId, "library").filter((card) => card.name.toLowerCase().includes((search[deckId] ?? "").toLowerCase())) as card}<button type="button" class="match" onclick={() => searchCard(deckId, card)}><span>{privateCardMeta(card)}</span><small>Match</small></button>{/each}{#if !cardsIn(deckId, "library").some((card) => card.name.toLowerCase().includes((search[deckId] ?? "").toLowerCase()))}<p class="muted">No matching card in library.</p>{/if}</div>{/if}</div>
          <div class="land-row"><span>Basic land</span>{#each BASIC_LANDS as land}<button type="button" onclick={() => basicLandAndPrint(deckId, land)} disabled={busy || !cardsIn(deckId, "library").some((card) => card.name.toLowerCase() === land.toLowerCase())}>{land} + print</button>{/each}</div>
          {#if zones.hand.length}<div class="zone"><h3>Hand</h3>{#each cardsIn(deckId, "hand") as card}<div class="card-row"><span>{privateCardMeta(card)}</span><button type="button" onclick={() => move(deckId, card.instanceId, "graveyard")}>Grave</button><button type="button" onclick={() => move(deckId, card.instanceId, "exile")}>Exile</button></div>{/each}</div>{/if}
          {#each ["graveyard", "exile"] as zone}<div class="zone"><h3>{zone[0].toUpperCase() + zone.slice(1)} · {zones[zone as "graveyard" | "exile"].length}</h3>{#each cardsIn(deckId, zone as ZoneName) as card}<div class="card-row"><span>{cardMeta(card)}</span><button type="button" onclick={() => returnCard(deckId, card.instanceId, zone as "graveyard" | "exile")}>Return</button></div>{/each}</div>{/each}
        </section>
      {/each}
    </div>
  {/if}
</main>
{#if error}<ErrorToast message={error} onclose={() => (error = "")} />{/if}

<style>
  main { max-width: 1500px; margin:0 auto; padding:1.25rem clamp(1rem,3vw,3rem) 4rem; }
  .topbar,.deck-heading,.session-strip,.header-tools { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
  .topbar { border-bottom:1px solid var(--border); padding-bottom:1rem; margin-bottom:1.25rem; }
  h1,h2,h3,p { margin-top:0; } h1 { margin-bottom:0; letter-spacing:-.04em; } h2 { font-size:1.15rem; margin-bottom:.7rem; } h3 { font-size:.8rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:.35rem; }
  .eyebrow { margin-bottom:.3rem; color:var(--accent); font-size:.7rem; font-weight:800; letter-spacing:.14em; } .muted { color:var(--muted); }
  .session-id,.deck-id { color:var(--muted); font: .75rem ui-monospace,monospace; } .reset { border:1px solid var(--error-border); color:var(--error-text); background:transparent; padding:.45rem .65rem; }
  .start-card { max-width:42rem; margin:5vh auto; padding:clamp(1.25rem,4vw,3rem); border:1px solid var(--border); border-top:4px solid var(--accent); background:var(--surface); box-shadow:0 10px 30px #00000012; } .start-card h2 { font-size:2rem; letter-spacing:-.04em; }
  label { display:block; margin:.7rem 0 .25rem; font-weight:650; } input { display:block; width:100%; margin-top:.3rem; padding:.65rem; border:1px solid var(--field-border); background:var(--surface); color:var(--text); font:inherit; } button { cursor:pointer; border:1px solid var(--field-border); background:var(--surface-muted); color:var(--text); padding:.52rem .65rem; font:inherit; font-size:.85rem; } .primary { width:100%; margin-top:1rem; background:var(--accent); color:#fff; border-color:var(--accent); font-weight:750; }
  .tabletop { max-width:1800px; } .session-strip { padding:.65rem .8rem; background:var(--surface-muted); border-inline-start:4px solid var(--accent); margin-bottom:1rem; } .status { min-height:1.4em; font-weight:650; } .session-strip .status { margin:0; color:var(--success); }
  .deck-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,30rem),1fr)); gap:1rem; align-items:start; } .deck-panel,.log { background:var(--surface); border:1px solid var(--border); padding:1rem; } .deck-panel { min-width:0; } .deck-heading { align-items:flex-start; } .deck-heading h2 { margin-bottom:0; } .counts { display:flex; flex-wrap:wrap; gap:.35rem; margin:.9rem 0; } .counts span { padding:.3rem .5rem; background:var(--surface-muted); color:var(--muted); font-size:.8rem; } .counts b { color:var(--text); margin-left:.2rem; }
  .actions { display:flex; flex-wrap:wrap; gap:.35rem; margin:.4rem 0; } .primary-actions button { font-weight:700; } .search-box { border-top:1px solid var(--border); margin-top:.8rem; padding-top:.6rem; } .search-box label { margin:0; } .matches { border:1px solid var(--border); max-height:11rem; overflow:auto; } .match { display:flex; justify-content:space-between; width:100%; border:0; border-bottom:1px solid var(--border); background:var(--surface); text-align:left; } .match small { color:var(--muted); } .land-row { display:flex; flex-wrap:wrap; align-items:center; gap:.3rem; margin:.7rem 0; font-size:.8rem; } .land-row span { font-weight:700; margin-right:.2rem; }
  .zone { border-top:1px solid var(--border); padding-top:.5rem; margin-top:.65rem; } .card-row { display:flex; align-items:center; gap:.35rem; padding:.25rem 0; font-size:.78rem; } .card-row span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; } .card-row button { padding:.3rem .45rem; font-size:.75rem; } .log { margin-top:1rem; } .log p { margin:.2rem 0; color:var(--muted); font-size:.85rem; }
  .command-zone { display:flex; align-items:center; justify-content:space-between; gap:.75rem; padding:.6rem; margin:.7rem 0; border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 8%, var(--surface)); } .command-zone h3 { margin-bottom:.15rem; } .command-zone span { font-size:.8rem; }
  @media (max-width:650px) { .topbar { align-items:flex-start; flex-direction:column; } .header-tools { width:100%; flex-wrap:wrap; } .session-strip { align-items:flex-start; flex-direction:column; } }
</style>
