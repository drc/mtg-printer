import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { z } from "zod";
import { enqueuePrint } from "$lib/server/printer";
import { getCard } from "$lib/server/scryfall";

const PrintRequest = z.object({ ids: z.array(z.uuid()).min(1) });

export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = PrintRequest.safeParse(body);
  if (!parsed.success) {
    return json({ error: "ids must be a non-empty array of Scryfall card IDs" }, { status: 400 });
  }

  try {
    const cards = await Promise.all(parsed.data.ids.map(getCard));
    await enqueuePrint(cards);
    return json({ printed: cards.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Print failed" }, { status: 502 });
  }
};
