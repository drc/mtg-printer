import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CARD_HEIGHT, CARD_WIDTH, renderCard } from "./render-card";

describe("renderCard", () => {
  async function inputImage() {
    return sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  }

  it("always produces the calibrated card dimensions", async () => {
    const output = await renderCard(await inputImage());
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    });
  });

  it("adds a metadata footer without changing dimensions", async () => {
    const input = await inputImage();
    const plain = await renderCard(input);
    const labeled = await renderCard(input, { sessionId: "abcd1234", deckName: "Table deck", cardNumber: 7 });
    expect(labeled.equals(plain)).toBe(false);
    await expect(sharp(labeled).metadata()).resolves.toMatchObject({ width: CARD_WIDTH, height: CARD_HEIGHT });
  });
});
