import { CardPayload, SearchPayload, type CardPayload as CardPayloadType } from "./scryfall.schemas";

export type CardSummary = {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  layout: string;
  image_url: string;
  price: string | undefined;
};
export type CardRecord = CardSummary;

const API = "https://api.scryfall.com";
const USER_AGENT = "mtg-proxy-printer/1.0 (local LAN printer)";

function imageUrl(card: CardPayloadType): string | undefined {
  return card.image_uris?.png ?? card.card_faces?.[0]?.image_uris?.png;
}

function normalize(card: CardPayloadType): CardRecord {
  const image_url = imageUrl(card);
  if (!image_url) {
    throw new Error("Scryfall returned a card without an image");
  }
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    layout: card.layout,
    image_url,
    price: card.prices?.usd,
  };
}

async function request(path: string): Promise<unknown> {
  const response = await fetch(`${API}${path}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Scryfall request failed (${response.status})`);
  }
  return response.json();
}

async function requestCard(path: string): Promise<CardPayloadType> {
  const parsed = CardPayload.safeParse(await request(path));
  if (!parsed.success) {
    throw new Error("Scryfall returned an incomplete card response");
  }
  return parsed.data;
}

export async function searchCards(query: string): Promise<CardSummary[]> {
  const clean = query.trim();
  if (!clean) {
    return [];
  }
  const parsed = SearchPayload.safeParse(await request(`/cards/search?q=${encodeURIComponent(clean)}&unique=prints&order=name`));
  if (!parsed.success) {
    throw new Error("Scryfall returned malformed search results");
  }
  return parsed.data.data.slice(0, 20).map(normalize);
}

export async function getCard(id: string): Promise<CardRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new Error("Invalid Scryfall card ID");
  }
  return normalize(await requestCard(`/cards/${encodeURIComponent(id)}`));
}

export async function resolveCardUrl(value: string): Promise<CardRecord> {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid Scryfall card URL");
  }
  if (parsed.protocol !== "https:" || !["scryfall.com", "www.scryfall.com"].includes(parsed.hostname)) {
    throw new Error("Only scryfall.com card links are supported");
  }
  const match = parsed.pathname.match(/^\/card\/([^/]+)\/([^/]+)(?:\/[^/]*)?\/?$/i);
  if (!match) {
    throw new Error("Use a Scryfall card link such as https://scryfall.com/card/slz/3/eerie-interlude");
  }
  return normalize(await requestCard(`/cards/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`));
}

export async function fetchCardImage(card: CardRecord): Promise<Uint8Array> {
  const response = await fetch(card.image_url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Card image request failed (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function resolveCardNames(names: string[]): Promise<CardRecord[]> {
  const clean = names.map((name, index) => ({ name: name.trim(), line: index + 1 })).filter((entry) => entry.name);
  const cards: CardRecord[] = [];
  for (let index = 0; index < clean.length; index += 1) {
    if (index) {
      await wait(500);
    }
    const entry = clean[index];
    try {
      cards.push(normalize(await requestCard(`/cards/named?fuzzy=${encodeURIComponent(entry.name)}`)));
    } catch (error) {
      throw new Error(`Could not resolve line ${entry.line} (${entry.name}): ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  return cards;
}
