import net from "node:net";
import { createCanvas, loadImage } from "canvas";
import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";
import { fetchCardImage, type CardRecord } from "./scryfall.js";
import { CARD_HEIGHT, CARD_WIDTH, renderCard, type CardRenderMetadata } from "./render-card.js";

export const PRINTER_HOST = process.env.PRINTER_HOST ?? "10.0.1.128";
export const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100);
let queue: Promise<void> = Promise.resolve();
const printerCanvas = createCanvas as unknown as (width: number, height: number) => HTMLCanvasElement;

function send(data: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(PRINTER_PORT, PRINTER_HOST);
    let settled = false;
    const fail = (error: Error) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(error);
      }
    };
    socket.once("connect", () => {
      socket.write(data, (error) => {
        if (error) {
          fail(error);
        } else {
          settled = true;
          socket.end();
          resolve();
        }
      });
    });
    socket.once("error", fail);
    socket.once("timeout", () => fail(new Error("Printer connection timed out")));
    socket.setTimeout(10_000);
  });
}
export type PrintJob = { card: CardRecord; metadata?: CardRenderMetadata };

export async function printCard(card: CardRecord, metadata?: CardRenderMetadata): Promise<void> {
  const rendered = await renderCard(await fetchCardImage(card), metadata);
  const image = await loadImage(rendered);
  const encoder = new ReceiptPrinterEncoder({
    createCanvas: printerCanvas,
    feedBeforeCut: 5,
    imageMode: "raster",
  });
  const data = encoder.align("center").image(image, CARD_WIDTH, CARD_HEIGHT, "atkinson").cut().encode();
  await send(data);
}
export function enqueuePrint(cards: CardRecord[], metadata?: CardRenderMetadata[]): Promise<void> {
  const job = queue.then(async () => {
    for (const [index, card] of cards.entries()) {
      await printCard(card, metadata?.[index]);
    }
  });
  queue = job.catch(() => undefined);
  return job;
}
