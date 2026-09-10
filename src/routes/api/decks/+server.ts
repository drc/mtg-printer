import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { importDeck } from "$lib/server/decks";

const DeckRequest = z.object({ links: z.array(z.string().trim().min(1)).min(2).max(4) });

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = DeckRequest.safeParse(body);
  if (!parsed.success) {
    return json({ error: "links must be an array of 2 to 4 non-empty strings" }, { status: 400 });
  }
  try {
    const decks = [];
    for (const link of parsed.data.links) decks.push(await importDeck(link));
    return json({ decks });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Deck import failed" }, { status: 400 });
  }
};
