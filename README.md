# MTG Proxy Printer

A local Magic: The Gathering proxy printer. Search Scryfall, build a print queue, see card price estimates, and print front-face proxies to an ESC/POS network printer.

## Features

- Scryfall card search, card-name lists, and Scryfall URLs
- Direct Scryfall card previews with lightweight UI thumbnails
- Per-card USD prices, discount display, and a `$0.00` print total
- Queue editing with duplicate cards preserved
- Fixed-size card rendering and sequential ESC/POS printing
- Bun 1.4, SvelteKit, TypeScript, Sharp, and Canvas

## Development

Requirements: Bun 1.4 and a reachable Scryfall connection.

```sh
bun install
bun run dev
```

Open `http://localhost:5173`.

Run verification:

```sh
bun run test
bun run build
```

## Printer configuration

The default printer target is `10.0.1.128:9100`. Override it with environment variables:

```sh
PRINTER_HOST=192.168.1.50 PRINTER_PORT=9100 bun run dev
```

Printing is server-side and requires the configured printer to be reachable from the machine running the app.

## Docker

```sh
docker build -t mtg-proxy-printer .
docker run --rm -p 3000:3000 \
  -e PRINTER_HOST=192.168.1.50 \
  mtg-proxy-printer
```

## Notes

- Price data comes from Scryfall and is an estimate, not a purchase quote.
- The app prints front-face proxies; double-faced cards use the first face.
- Do not expose the printer endpoint publicly without authentication and rate limiting.
