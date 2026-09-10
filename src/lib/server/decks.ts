import { spawn } from "node:child_process";

import { resolveCardNamesBulk, type CardRecord } from "./scryfall";

export type DeckCard = {
  name: string;
  quantity: number;
  commander?: boolean;
};

export type NormalizedDeckCard = CardRecord & {
  deckId: string;
  deckName: string;
  cardNumber: number;
  isCommander: boolean;
};

export type NormalizedDeck = {
  deckId: string;
  deckName: string;
  cards: NormalizedDeckCard[];
};

type Provider = {
  name: string;
  hosts: readonly string[];
  recognize: (url: URL) => boolean;
  endpoint: (url: URL) => string;
  parse: (payload: unknown, url: URL) => { deckId: string; deckName?: string; cards: DeckCard[] };
};

const hosts = (...values: string[]) => values;
const idFromPath = (url: URL) => url.pathname.split("/").filter(Boolean).at(-1) ?? "";

function asQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) return Number(value);
  throw new Error("Deck contains an invalid card quantity");
}

function cardName(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "cardName", "card_name"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
    if (record.card && typeof record.card === "object") return cardName(record.card);
  }
  throw new Error("Deck contains a card without a name");
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([name, entry]) =>
      typeof entry === "object" && entry !== null ? { ...(entry as Record<string, unknown>), name } : { name, quantity: entry },
    );
  }
  return [];
}

function parseRows(value: unknown, commanderNames = new Set<string>()): DeckCard[] {
  return rows(value).map((entry) => {
    const record = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const name = cardName(record.name ?? record.card ?? entry);
    const quantity = asQuantity(record.quantity ?? record.qty ?? record.count ?? 1);
    const category = String(record.category ?? record.categories ?? record.section ?? "").toLowerCase();
    return { name, quantity, commander: Boolean(record.commander ?? record.isCommander) || commanderNames.has(name.toLowerCase()) || category.includes("commander") };
  });
}

function parseMoxfield(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Moxfield returned an unreadable deck");
  const p = payload as Record<string, unknown>;
  const commanders = parseRows(p.commanders ?? p.commander).map((card) => ({ ...card, commander: true }));
  const commanderNames = new Set(commanders.map((card) => card.name.toLowerCase()));
  const cards = [...commanders, ...parseRows(p.mainboard ?? p.cards ?? p.board, commanderNames)];
  return { deckId: String(p.publicId ?? p.id ?? ""), deckName: typeof p.name === "string" ? p.name : undefined, cards };
}

function parseArchidekt(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new Error("Archidekt returned an unreadable deck");
  const p = payload as Record<string, unknown>;
  const cards = parseRows(p.cards ?? p.deckCards).map((card) => {
    const entry = card as DeckCard;
    return entry;
  });
  return { deckId: String(p.id ?? ""), deckName: typeof p.name === "string" ? p.name : undefined, cards };
}

function parseText(payload: unknown, provider: string, deckId: string) {
  if (typeof payload !== "string") throw new Error(`${provider} returned an unreadable deck`);
  const cards: DeckCard[] = [];
  let commander = false;
  for (const raw of payload.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (/^(?:\[?\s*)commander(?:\s*\]?|\s*\([^)]*\))\s*:?[\s]*$/i.test(line)) { commander = true; continue; }
    const match = line.match(/^(\d+)\s*[x×]?\s+(.+?)\s*$/);
    if (!match) continue;
    const quantity = asQuantity(match[1]);
    cards.push({ name: match[2].trim(), quantity, commander });
    commander = false;
  }
  if (!cards.length) throw new Error(`${provider} returned an unreadable deck`);
  return { deckId, cards };
}

const providers: Provider[] = [
  { name: "Moxfield", hosts: hosts("moxfield.com", "www.moxfield.com"), recognize: (u) => /^\/decks\/[A-Za-z0-9_-]+\/?$/.test(u.pathname), endpoint: (u) => `https://api2.moxfield.com/v2/decks/all/${idFromPath(u)}`, parse: parseMoxfield },
  { name: "Archidekt", hosts: hosts("archidekt.com", "www.archidekt.com"), recognize: (u) => /^\/decks\/\d+\/?$/.test(u.pathname), endpoint: (u) => `https://archidekt.com/api/decks/${idFromPath(u)}/`, parse: parseArchidekt },
  { name: "TappedOut", hosts: hosts("tappedout.net", "www.tappedout.net"), recognize: (u) => /^\/mtg-decks\/[A-Za-z0-9_-]+\/?$/.test(u.pathname), endpoint: (u) => `https://tappedout.net/mtg-decks/${idFromPath(u)}/?fmt=txt`, parse: (p, u) => parseText(p, "TappedOut", idFromPath(u)) },
  { name: "Deckstats", hosts: hosts("deckstats.net", "www.deckstats.net"), recognize: (u) => /^\/decks\/[A-Za-z0-9_-]+\/?$/.test(u.pathname), endpoint: (u) => `https://deckstats.net/decks/${idFromPath(u)}/?export=txt`, parse: (p, u) => parseText(p, "Deckstats", idFromPath(u)) },
  { name: "Scryfall", hosts: hosts("scryfall.com", "www.scryfall.com"), recognize: (u) => /^\/(?:@[^/]+\/)?(?:decks|lists)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname), endpoint: (u) => `https://scryfall.com${u.pathname.replace(/\/$/, "")}.json`, parse: (p, u) => parseScryfall(p, idFromPath(u)) },
];
function parseScryfall(payload: unknown, deckId: string) {
  if (!payload || typeof payload !== "object") throw new Error("Scryfall returned an unreadable deck");
  const p = payload as Record<string, unknown>;
  const commanders = parseRows(p.commanders ?? p.commander).map((card) => ({ ...card, commander: true }));
  const commanderNames = new Set(commanders.map((card) => card.name.toLowerCase()));
  const cards = [...commanders, ...parseRows(p.cards ?? p.entries ?? p.mainboard, commanderNames)];
  return { deckId: String(p.id ?? deckId), deckName: typeof p.name === "string" ? p.name : undefined, cards };
}
export const deckProviders = providers;
export const providerRegistry = providers;

function providerFor(value: string): { provider: Provider; url: URL } {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error("Enter a valid deck link"); }
  if (url.protocol !== "https:") throw new Error("Only HTTPS deck links are supported");
  const provider = providers.find((candidate) => candidate.hosts.includes(url.hostname) && candidate.recognize(url));
  if (!provider) throw new Error("Unsupported deck link");
  return { provider, url };
}

async function fetchPayload(url: string): Promise<unknown> {
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.moxfield.com/",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
  };
  const response = await fetch(url, { redirect: "error", headers });
  if (response.ok) return parseProviderBody(await response.text());
  if (response.status !== 403) throw new Error(`Provider request failed (${response.status})`);

  // Some public providers reject Bun's TLS fingerprint while accepting normal browser clients.
  // Use curl only for the already allowlisted, provider-generated URL; never pass user input to a shell.
  try {
    const curl = process.platform === "darwin" ? "/opt/homebrew/opt/curl/bin/curl" : "/usr/bin/curl";
    const args = ["--silent", "--show-error", "--fail", "--max-time", "20", "--max-redirs", "0", "--proto", "=https", ...Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]), url];
    const body = await new Promise<{ output: string; error: string; code: number }>((resolve, reject) => {
      const child = spawn(curl, args, { stdio: ["ignore", "pipe", "pipe"] });
      let output = "";
      let error = "";
      child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { error += chunk.toString(); });
      child.once("error", reject);
      child.once("close", (code) => resolve({ output, error, code: code ?? 1 }));
    });
    if (body.code === 0) return parseProviderBody(body.output);
    const status = body.error.match(/HTTP\/\S+\s+(\d{3})/)?.[1];
    throw new Error(`Provider request failed (${status ?? "blocked"})`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Provider request failed")) throw error;
    throw new Error("Provider request failed (403)");
  }
}

function parseProviderBody(body: string): unknown {
  try { return JSON.parse(body); } catch { return body; }
}
export async function importDeck(value: string, fetcher: (url: string) => Promise<unknown> = fetchPayload): Promise<NormalizedDeck> {
  const { provider, url } = providerFor(value);
  const payload = await fetcher(provider.endpoint(url));
  const parsed = provider.parse(payload, url);
  if (!parsed.deckId) throw new Error(`${provider.name} returned a deck without an ID`);
  const commander = parsed.cards.filter((card) => card.commander);
  if (commander.length !== 1 || commander[0].quantity !== 1) throw new Error("Deck must contain exactly one commander");
  if (parsed.cards.some((card) => !Number.isInteger(card.quantity) || card.quantity < 1)) throw new Error("Deck contains invalid quantities");
  const total = parsed.cards.reduce((sum, card) => sum + card.quantity, 0);
  if (total !== 100) throw new Error("Commander deck must contain exactly 100 cards");
  const names = [...new Set(parsed.cards.map((card) => card.name))];
  let resolved: CardRecord[];
  try { resolved = await resolveCardNamesBulk(names); } catch (error) { throw new Error(`Could not resolve imported deck: ${error instanceof Error ? error.message : "unknown error"}`); }
  const byName = new Map(resolved.map((card) => [card.name.toLowerCase(), card]));
  const cards: NormalizedDeckCard[] = [];
  let cardNumber = 1;
  for (const entry of parsed.cards) {
    const card = byName.get(entry.name.toLowerCase());
    if (!card) throw new Error(`Could not resolve imported card (${entry.name})`);
    for (let copy = 0; copy < entry.quantity; copy += 1) cards.push({ ...card, deckId: parsed.deckId, deckName: parsed.deckName?.trim() || parsed.deckId, cardNumber: cardNumber++, isCommander: Boolean(entry.commander) });
  }
  return { deckId: parsed.deckId, deckName: parsed.deckName?.trim() || parsed.deckId, cards };
}

export const resolveDeck = importDeck;
