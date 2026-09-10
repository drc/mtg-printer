import sharp from "sharp";

export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 712;

export type CardRenderMetadata = {
  sessionId: string;
  deckName: string;
  cardNumber: number;
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

export async function renderCard(imageBytes: Uint8Array, metadata?: CardRenderMetadata): Promise<Buffer> {
  const image = sharp(Buffer.from(imageBytes)).resize(CARD_WIDTH, CARD_HEIGHT, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).grayscale();
  if (!metadata) {
    return image.png().toBuffer();
  }
  const footer = Buffer.from(`<svg width="${CARD_WIDTH}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="44" fill="white"/><text x="8" y="18" font-family="sans-serif" font-size="13" font-weight="bold" fill="black">${escapeXml(metadata.sessionId)} · ${escapeXml(metadata.deckName)}</text><text x="8" y="35" font-family="sans-serif" font-size="12" fill="black">Card ${metadata.cardNumber}/100</text></svg>`);
  return image.composite([{ input: footer, top: CARD_HEIGHT - 44, left: 0 }]).png().toBuffer();
}
