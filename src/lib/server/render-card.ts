import sharp from "sharp";

export const CARD_WIDTH = 512;
export const CARD_HEIGHT = 712;

export async function renderCard(imageBytes: Uint8Array): Promise<Buffer> {
  return sharp(Buffer.from(imageBytes))
    .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "contain", background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .grayscale()
    .png()
    .toBuffer();
}
