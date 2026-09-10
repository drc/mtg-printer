import { describe, expect, it } from "vitest";
import {
  basicLandToHand,
  createSession,
  drawCard,
  drawOpeningHand,
  exileTop,
  keepHand,
  mill,
  moveHandCard,
  mulligan,
  returnCardToLibrary,
  searchLibraryToHand,
  shuffleIds,
} from "./game-state";

const randomZero = () => 0;
const cards = Array.from({ length: 10 }, (_, i) => ({
  instanceId: `c${i}`,
  scryfallId: `s${i}`,
  name: i === 7 ? "Plains" : `Card ${i}`,
  imageUrl: "",
  deckId: "a",
  deckName: "Alpha",
  cardNumber: i + 1,
  isCommander: i === 9,
}));
const state = () => createSession([{ deckId: "a", deckName: "Alpha", cards }], randomZero, "session");

function allIds(s: ReturnType<typeof state>) {
  const zones = s.decks.a;
  return [...zones.library, ...zones.hand, ...zones.graveyard, ...zones.exile, ...zones.command];
}

describe("game state", () => {
  it("shuffles as a deterministic permutation without mutating input", () => {
    const ids = ["a", "b", "c", "d"];
    expect(shuffleIds(ids, () => 0)).toEqual(["b", "c", "d", "a"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
    expect(new Set(shuffleIds(ids, () => 3))).toEqual(new Set(ids));
  });

  it("draws, mulligans repeatedly, keeps, and preserves all instances", () => {
    let s = state();
    s = drawOpeningHand(s, "a", randomZero);
    expect(s.decks.a.hand).toHaveLength(7);
    s = mulligan(s, "a", randomZero);
    expect(s.decks.a.hand).toHaveLength(6);
    s = mulligan(s, "a", randomZero);
    expect(s.decks.a.hand).toHaveLength(5);
    s = keepHand(s, "a");
    expect(mulligan(s, "a", randomZero).decks.a.hand).toEqual(s.decks.a.hand);
    expect(new Set(allIds(s)).size).toBe(10);
  });

  it("moves top cards, searches, basic lands, and returns cards", () => {
    let s = state();
    s = drawOpeningHand(s, "a", randomZero);
    const handCard = s.decks.a.hand[0];
    s = moveHandCard(s, "a", handCard, "graveyard");
    s = returnCardToLibrary(s, "a", handCard, "graveyard", randomZero);
    s = searchLibraryToHand(s, "a", "Card 8", undefined, randomZero);
    s = basicLandToHand(s, "a", "Plains", randomZero);
    expect(s.decks.a.hand.map((id) => s.cards[id].name)).toContain("Card 8");
    expect(s.decks.a.hand.map((id) => s.cards[id].name)).toContain("Plains");
    s = mill(s, "a");
    s = exileTop(s, "a");
    expect(s.decks.a.graveyard.length + s.decks.a.exile.length).toBe(2);
    expect(new Set(allIds(s)).size).toBe(10);
  });

  it("rejects invalid IDs and empty libraries without mutation", () => {
    const s = state();
    const invalid = moveHandCard(s, "a", "missing", "exile");
    expect(invalid).toEqual({ ...s, status: "Card is not available in hand" });
    let empty = { ...s, decks: { ...s.decks, a: { ...s.decks.a, library: [] } } };
    expect(drawCard(empty, "a", randomZero).decks.a).toEqual(empty.decks.a);
    expect(drawCard(empty, "a", randomZero).status).toContain("empty");
  });
});
