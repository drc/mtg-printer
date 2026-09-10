export type CardInstance = {
  instanceId: string;
  scryfallId: string;
  name: string;
  imageUrl: string;
  deckId: string;
  deckName: string;
  cardNumber: number;
  isCommander: boolean;
};

export type ZoneName = "library" | "hand" | "graveyard" | "exile" | "command";
export type DeckZones = Record<ZoneName, string[]>;
export type SessionDeck = { deckId: string; deckName: string; cards: CardInstance[] };
export type SessionState = {
  version: 1;
  sessionId: string;
  decks: Record<string, DeckZones>;
  cards: Record<string, CardInstance>;
  actionLog: string[];
  status: string;
  keptHands: string[];
  openingHands: string[];
};
export type RandomUint32 = () => number;

const ZONES: ZoneName[] = ["library", "hand", "graveyard", "exile", "command"];
const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"] as const;

function productionRandomUint32(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error("Secure randomness is unavailable; cannot start a session");
  return cryptoApi.getRandomValues(new Uint32Array(1))[0];
}

/** Unbiased in-place Fisher-Yates shuffle. The input array is never changed. */
export function shuffleIds(ids: string[], randomUint32: RandomUint32 = productionRandomUint32): string[] {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const bound = i + 1;
    const limit = Math.floor(0x100000000 / bound) * bound;
    let value: number;
    do value = randomUint32() >>> 0; while (value >= limit);
    const j = value % bound;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function newSessionId(): string {
  const uuid = globalThis.crypto?.randomUUID;
  if (!uuid) throw new Error("Secure randomness is unavailable; cannot start a session");
  return uuid.call(globalThis.crypto);
}

function blankZones(): DeckZones {
  return { library: [], hand: [], graveyard: [], exile: [], command: [] };
}

export function createSession(decks: SessionDeck[], randomUint32: RandomUint32 = productionRandomUint32, sessionId = newSessionId()): SessionState {
  const cards: Record<string, CardInstance> = {};
  const zones: Record<string, DeckZones> = {};
  for (const deck of decks) {
    const deckZones = blankZones();
    for (const card of deck.cards) {
      const instanceId = card.instanceId || `${deck.deckId}:${card.cardNumber}:${Object.keys(cards).length}`;
      const instance = { ...card, instanceId, deckId: deck.deckId, deckName: deck.deckName };
      if (cards[instanceId]) throw new Error(`Duplicate card instance ID: ${instanceId}`);
      cards[instanceId] = instance;
      (instance.isCommander ? deckZones.command : deckZones.library).push(instanceId);
    }
    deckZones.library = shuffleIds(deckZones.library, randomUint32);
    zones[deck.deckId] = deckZones;
  }
  return { version: 1, sessionId, decks: zones, cards, actionLog: [], status: "Session ready", keptHands: [], openingHands: [] };
}

function cloneState(state: SessionState): SessionState {
  return {
    ...state,
    decks: Object.fromEntries(Object.entries(state.decks).map(([id, z]) => [id, Object.fromEntries(ZONES.map((zone) => [zone, [...z[zone]]]))])) as Record<string, DeckZones>,
    actionLog: [...state.actionLog], keptHands: [...state.keptHands], openingHands: [...state.openingHands],
  };
}

function finish(state: SessionState, message: string): SessionState {
  const next = cloneState(state);
  next.status = message;
  next.actionLog.push(message);
  return next;
}
function reject(state: SessionState, message: string): SessionState {
  const next = cloneState(state);
  next.status = message;
  return next;
}
function deck(state: SessionState, deckId: string): DeckZones | undefined { return state.decks[deckId]; }
function cardToken(card: CardInstance): string { return `card #${card.cardNumber}/100 (${card.instanceId.slice(-8)})`; }
function has(state: SessionState, id: string): boolean { return !!state.cards[id]; }
function move(state: SessionState, deckId: string, from: ZoneName, to: ZoneName, id: string): boolean {
  const z = deck(state, deckId);
  if (!z || !ZONES.includes(from) || !ZONES.includes(to) || !has(state, id)) return false;
  const index = z[from].indexOf(id);
  if (index < 0) return false;
  z[from].splice(index, 1); z[to].push(id); return true;
}
function drawCount(state: SessionState, deckId: string, count: number, random: RandomUint32, label: string): SessionState {
  const z = deck(state, deckId);
  if (!z) return reject(state, `Unknown deck: ${deckId}`);
  if (!z.library.length) return reject(state, `${label}: library is empty`);
  const next = cloneState(state); const nz = next.decks[deckId];
  const amount = Math.min(count, nz.library.length);
  nz.hand.push(...nz.library.splice(0, amount));
  return finish(next, `${label}: drew ${amount} card${amount === 1 ? "" : "s"}`);
}
export function drawOpeningHand(state: SessionState, deckId: string, random: RandomUint32 = productionRandomUint32): SessionState {
  const z = deck(state, deckId);
  if (!z) return reject(state, `Unknown deck: ${deckId}`);
  if (state.openingHands.includes(deckId)) return reject(state, "Opening hand already drawn");
  const next = drawCount(state, deckId, 7, random, "Opening hand");
  if (next.actionLog.length === state.actionLog.length) return next;
  return { ...next, openingHands: [...next.openingHands, deckId] };
}

export function mulligan(state: SessionState, deckId: string, random: RandomUint32 = productionRandomUint32): SessionState {
  const z = deck(state, deckId);
  if (!z) return reject(state, `Unknown deck: ${deckId}`);
  if (state.keptHands.includes(deckId)) return reject(state, "Kept hands cannot be mulliganed");
  if (!state.openingHands.includes(deckId)) return reject(state, "Draw an opening hand first");
  const next = cloneState(state); const nz = next.decks[deckId];
  nz.library = shuffleIds([...nz.library, ...nz.hand], random); nz.hand = [];
  const draw = Math.max(0, 7 - (next.actionLog.filter((x) => x.startsWith("Mulligan:") && x.includes(deckId)).length + 1));
  const amount = Math.min(draw, nz.library.length); nz.hand.push(...nz.library.splice(0, amount));
  return finish(next, `Mulligan: ${deckId}, drew ${amount}`);
}

export function keepHand(state: SessionState, deckId: string): SessionState {
  if (!deck(state, deckId)) return reject(state, `Unknown deck: ${deckId}`);
  if (!state.openingHands.includes(deckId)) return reject(state, "Draw an opening hand first");
  if (state.keptHands.includes(deckId)) return reject(state, "Hand already kept");
  return finish({ ...state, keptHands: [...state.keptHands, deckId] }, `Kept hand: ${deckId}`);
}
export function drawCard(state: SessionState, deckId: string, random: RandomUint32 = productionRandomUint32): SessionState { return drawCount(state, deckId, 1, random, "Draw"); }

function topAction(state: SessionState, deckId: string, to: "graveyard" | "exile", label: string): SessionState {
  const z = deck(state, deckId);
  if (!z) return reject(state, `Unknown deck: ${deckId}`);
  if (!z.library.length) return reject(state, `${label}: library is empty`);
  const next = cloneState(state); const id = next.decks[deckId].library.shift()!; next.decks[deckId][to].push(id);
  return finish(next, `${label}: ${cardToken(next.cards[id])}`);
}
export function mill(state: SessionState, deckId: string): SessionState { return topAction(state, deckId, "graveyard", "Mill"); }
export function exileTop(state: SessionState, deckId: string): SessionState { return topAction(state, deckId, "exile", "Exile top"); }
export function revealTop(state: SessionState, deckId: string): SessionState {
  const z = deck(state, deckId); if (!z) return reject(state, `Unknown deck: ${deckId}`);
  if (!z.library.length) return reject(state, "Reveal: library is empty");
  const id = z.library[0]; return finish(state, `Reveal: ${cardToken(state.cards[id])}`);
}
export function shuffleLibrary(state: SessionState, deckId: string, random: RandomUint32 = productionRandomUint32): SessionState {
  const z = deck(state, deckId); if (!z) return reject(state, `Unknown deck: ${deckId}`);
  const next = cloneState(state); next.decks[deckId].library = shuffleIds(next.decks[deckId].library, random); return finish(next, `Shuffled library: ${deckId}`);
}

export function moveHandCard(state: SessionState, deckId: string, instanceId: string, to: "graveyard" | "exile"): SessionState {
  const next = cloneState(state); if (!move(next, deckId, "hand", to, instanceId)) return reject(state, "Card is not available in hand");
  return finish(next, `Moved ${cardToken(next.cards[instanceId])} to ${to}`);
}
export function returnCardToLibrary(state: SessionState, deckId: string, instanceId: string, from: "graveyard" | "exile", random: RandomUint32 = productionRandomUint32): SessionState {
  const next = cloneState(state); if (!move(next, deckId, from, "library", instanceId)) return reject(state, "Card is not available in that zone");
  next.decks[deckId].library = shuffleIds(next.decks[deckId].library, random); return finish(next, `Returned ${cardToken(next.cards[instanceId])} to library`);
}
export function searchLibraryToHand(state: SessionState, deckId: string, name: string, instanceId?: string, random: RandomUint32 = productionRandomUint32): SessionState {
  const z = deck(state, deckId); if (!z) return reject(state, `Unknown deck: ${deckId}`);
  const found = z.library.find((id) => (!instanceId || id === instanceId) && state.cards[id].name.toLowerCase() === name.trim().toLowerCase());
  if (!found) return reject(state, "No matching card in library");
  const next = cloneState(state); move(next, deckId, "library", "hand", found); next.decks[deckId].library = shuffleIds(next.decks[deckId].library, random);
  return finish(next, `Searched library: moved ${cardToken(next.cards[found])} to hand`);
}
export function basicLandToHand(state: SessionState, deckId: string, name: typeof BASIC_LANDS[number], random: RandomUint32 = productionRandomUint32): SessionState {
  if (!BASIC_LANDS.includes(name)) return reject(state, "Unknown basic land");
  return searchLibraryToHand(state, deckId, name, undefined, random);
}
export { BASIC_LANDS };
