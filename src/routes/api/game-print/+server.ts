import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { enqueuePrint } from "$lib/server/printer";
import { getCard } from "$lib/server/scryfall";

const GamePrintRequest = z.object({
  sessionId: z.uuid(),
  cards: z.array(z.object({
    id: z.uuid(),
    label: z.object({
      deckId: z.string().min(1).max(100),
      cardNumber: z.number().int().min(1).max(100),
      deckName: z.string().trim().min(1).max(100),
    }),
  })).min(1).max(20),
});

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = GamePrintRequest.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid game print request" }, { status: 400 });
  }
  try {
    const cards = await Promise.all(parsed.data.cards.map(({ id }) => getCard(id)));
    await enqueuePrint(cards, parsed.data.cards.map(({ label }) => ({
      sessionId: parsed.data.sessionId.slice(0, 8),
      deckName: label.deckName,
      cardNumber: label.cardNumber,
    })));
    return json({ printed: cards.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Print failed" }, { status: 502 });
  }
};
