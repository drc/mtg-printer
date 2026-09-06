import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { CARD_HEIGHT, CARD_WIDTH, renderCard } from "./render-card";

describe("renderCard", () => {
  it("always produces the calibrated card dimensions", async () => {
    const input = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    const output = await renderCard(input);
    await expect(sharp(output).metadata()).resolves.toMatchObject({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    });
  });
});
