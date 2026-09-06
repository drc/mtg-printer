import { json } from "@sveltejs/kit";
import { resolveCardNames, resolveCardUrl, searchCards } from "$lib/server/scryfall";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return json({ error: "Search query is required" }, { status: 400 });
  }
  try {
    return json({ cards: await searchCards(query) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Card search failed" }, { status: 502 });
  }
};
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "url" in body && typeof body.url === "string" && body.url.trim()) {
      return json({ cards: [await resolveCardUrl(body.url)] });
    }
    if (
      !body ||
      typeof body !== "object" ||
      !Array.isArray((body as { names?: unknown }).names) ||
      !(body as { names: unknown[] }).names.every((name) => typeof name === "string") ||
      !(body as { names: string[] }).names.some((name) => name.trim())
    ) {
      return json({ error: "names must be a non-empty string array" }, { status: 400 });
    }
    return json({ cards: await resolveCardNames((body as { names: string[] }).names) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Card resolution failed" }, { status: 502 });
  }
};
