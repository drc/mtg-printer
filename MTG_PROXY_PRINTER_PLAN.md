# MTG Proxy Printer

## Context
Create a new SvelteKit application in the currently empty repository. The browser UI accepts individual Magic: The Gathering cards selected from Scryfall or a newline-separated list of card names, previews the resolved cards, and submits a print job. The Node/SvelteKit server fetches trusted Scryfall card data and imagery, rasterizes each card at true playing-card dimensions, and sends the result to the Rongata ESC/POS network printer at `10.0.1.128:9100`.
Reuse the known-good `@point-of-sale/receipt-printer-encoder` library and the raw TCP approach from `/Users/dancigrang/dev/astro-thermal`; do not introduce a different printer protocol or printing library. All implementation, configuration, tests, and package changes belong in the current `/Users/dancigrang/dev/mtg-printer` repository; `/Users/dancigrang/dev/astro-thermal` is read-only reference material.

## Approach

1. Scaffold the smallest SvelteKit Node application in the empty repository.
   - Add the SvelteKit/Vite/TypeScript project files and scripts needed for `pnpm dev`, `pnpm build`, `pnpm preview`, and `pnpm test`.
   - Use the Node adapter because the server must open a raw TCP socket and use native image processing.
   - Add only the existing printer encoder dependency plus the image/runtime dependencies required by the reference implementation: `@point-of-sale/receipt-printer-encoder`, `canvas`, `sharp`, and the project’s test runner. Use the repository’s package manager convention (`pnpm@10.33.2`) if a package manager field is present.
   - Configure a server-only alias/import layout under `src/lib/server`; never import TCP, `canvas`, or `sharp` into browser code.

2. Implement the Scryfall server client and card normalization.
   - Add `src/lib/server/scryfall.ts` with typed functions `searchCards(query: string): Promise<CardSummary[]>` and `getCard(id: string): Promise<CardRecord>`.
   - `searchCards` calls `GET https://api.scryfall.com/cards/search?q=<encoded query>&unique=cards&order=name`, returns at most 20 results, and maps only the fields needed by the UI: `id`, `name`, `set`, `set_name`, `collector_number`, `layout`, and a preview image URL.
   - `getCard` calls `GET https://api.scryfall.com/cards/<id>` and uses the Scryfall card ID from the request; do not accept arbitrary client-supplied image URLs. Prefer `image_uris.png`; for cards with `card_faces`, use the first face’s `image_uris.png` when the top-level image is absent. This requested version prints one front-face proxy per card; do not invent back-face or double-sided layout behavior.
   - Send a descriptive `User-Agent` header, check every response status, and convert Scryfall errors, missing imagery, and malformed results into safe server errors. Empty search input returns an empty result without making a request.
   - For pasted names, add `resolveCardNames(names: string[]): Promise<CardRecord[]>` that trims blank lines, resolves each name through `GET /cards/named?fuzzy=...`, preserves input order and duplicates, and reports the line/name that failed. Space requests by at least Scryfall’s documented 500 ms rate interval rather than issuing a burst.

3. Add the SvelteKit card API routes.
- Add `src/routes/api/cards/+server.ts` with `GET`: read query parameter `q`, call `searchCards`, and return JSON `{ cards: CardSummary[] }`; return HTTP 400 for a missing/blank query and a useful non-2xx response for upstream failures.
- Add `POST` to the same route: accept JSON `{ names: string[] }`, call `resolveCardNames`, and return `{ cards: CardRecord[] }` containing normalized Scryfall IDs, names, preview URLs, and metadata in input order; return HTTP 400 for malformed/empty input and identify the failed line/name on resolution errors.
   - Keep the print route as the only route allowed to invoke printer code. Never expose the printer host/port, socket, encoder, or arbitrary URL fetch to the browser.

4. Implement reliable sequential printer execution using the reference behavior.
   - Add `src/lib/server/printer.ts`, based on `/Users/dancigrang/dev/astro-thermal/src/lib/printer.ts`, using `node:net`, host `10.0.1.128`, port `9100`, and `ReceiptPrinterEncoder`.
   - Export `printCard(card: CardRecord): Promise<void>` and `enqueuePrint(cards: CardRecord[]): Promise<void>`. Serialize jobs through one promise chain so concurrent requests cannot interleave encoder output or TCP writes; preserve card order.
   - Connect on demand and await a connected socket before writing. On connection error, close/reset the socket and reject the current job; do not silently claim success or retry a print that may already have reached the printer. Use one encoded buffer per card and finish each card with the encoder’s cut command.
   - Add `src/lib/server/render-card.ts` with `renderCard(imageBytes: Uint8Array): Promise<Buffer>`. Fetching is handled by the Scryfall client; this renderer uses `sharp` plus `canvas`/`loadImage` following the reference project’s proven raster path.
- Render every card to exactly `504 × 704` printer dots as the initial calibrated setting for a standard 63 × 88 mm card on a presumed 203 dpi printer, centered on the 576-dot paper, flattened to white, converted to grayscale, and dithered with the encoder’s `atkinson` mode. The printer DPI and dot pitch are unverified until a physical measurement; keep these dimensions as named constants so calibration is a single future change. Use Scryfall’s PNG image where available; do not scale to receipt width.

5. Build the single-page Svelte UI and user flow.
   - Add `src/routes/+page.svelte` with an accessible card search input, debounced calls to `/api/cards`, keyboard/mouse-selectable result rows with thumbnails and set/collector metadata, and a selected print queue showing each card preview, name, and remove control.
- Include a newline-separated textarea for pasting card names and an explicit “Add list” action. POST `{ names: string[] }` to `/api/cards`, append the returned normalized cards to the queue in order, and preserve duplicate lines as duplicate queue entries. The print request sends only the queued Scryfall IDs.
   - Disable print while empty or submitting, show progress/success/error feedback, and clear only successfully submitted items. Do not optimistically remove cards before the server response.
   - Keep preview images sourced from Scryfall URLs returned by the server; use meaningful alt text and visible focus/error states. Use plain Svelte/CSS and no UI component library.

6. Add focused contract tests and verify the real flow.
   - Add tests for card-image selection (top-level image and `card_faces` fallback), blank/invalid input rejection, ordered duplicate-preserving name resolution, exact `504 × 704` raster output, queue serialization, and printer failure propagation using mocked Scryfall responses and a fake socket/encoder. Tests must assert observable behavior rather than implementation text.
   - Run the project’s focused tests and build from the repository root.
   - Start the actual SvelteKit server, exercise a search against Scryfall with a known card such as `Lightning Bolt`, add it to the queue, and verify the rendered UI response and print-route validation. For hardware verification, run the print flow only with the configured LAN printer reachable; confirm a physical proxy measures 63 × 88 mm and the printer cuts after the card. If the printer is unavailable, verify the error response with a fake socket and report the hardware prerequisite rather than claiming a physical print.

## Critical files & anchors

- `src/lib/server/printer.ts` — new TCP singleton/queue and `printCard`/`enqueuePrint`; mirror the working socket and encoder configuration from `/Users/dancigrang/dev/astro-thermal/src/lib/printer.ts` while making connection readiness and failure explicit.
- `src/lib/server/render-card.ts` — new fixed-size raster pipeline; owns the `504 × 704` output invariant.
- `src/lib/server/scryfall.ts` — new Scryfall API client, card types, image selection, and name resolution.
- `src/routes/api/print/+server.ts` — server trust boundary and print-job contract.
- `src/routes/+page.svelte` — search, pasted-list input, queue state, and user-visible status.

## Verification

- From the repository root, install the declared dependencies with `pnpm install`, then run `pnpm test` and `pnpm build`; both must complete successfully.
- Start `pnpm dev` and open the local URL. Enter `Lightning Bolt`; expect Scryfall-backed results with thumbnails. Select one; expect one queue row with the card name and preview. Enter two newline-separated names including a duplicate; expect three ordered queue rows after resolution.
- Submit an empty queue and malformed JSON directly to `POST /api/print`; expect HTTP 400 and no socket write. Submit one known Scryfall ID with a fake printer in the focused test; expect one ordered encoded write, dimensions `504 × 704`, and a cut command. Submit two IDs concurrently in the test; expect non-interleaved writes in queue order.
- With `10.0.1.128:9100` reachable, submit one known card through the running app; expect a success response, one physical true-size front-face proxy, and a cut. With the printer unreachable, expect a non-success response and a visible UI error without claiming the card printed.

## Assumptions & contingencies

- The reference project’s 576-dot raster path suggests an 80 mm-class ESC/POS printer, but printer DPI and exact dot pitch are unverified. Start with `504 × 704` dots (63 × 88 mm at 203 dpi) and require physical measurement during verification; if measurement differs, change the named card-dimension constants and dimension assertion together before accepting print output.
- The requested behavior is front-face proxies. For a Scryfall double-faced card, print the first/front face image; do not silently print a second face or distort two faces into one card.
- No persistence, accounts, deck storage, print history, authentication, or remote printer configuration is required. If the app is exposed beyond the trusted LAN, add authentication and rate limiting before deployment rather than treating the current printer endpoint as public.
- Scryfall’s documented rate limit is 2 requests/second; search is one request per query, and pasted-name resolution is sequentially spaced at 500 ms or slower.
