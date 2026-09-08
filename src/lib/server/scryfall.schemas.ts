import { z } from "zod";

export const ImageUris = z.object({ png: z.url().optional() });

export const CardPayload = z.object({
  id: z.string(),
  name: z.string(),
  set: z.string(),
  set_name: z.string(),
  collector_number: z.string(),
  layout: z.string(),
  image_uris: ImageUris.optional(),
  card_faces: z.array(z.object({ image_uris: ImageUris.optional() })).optional(),
  prices: z.record(z.string(), z.string().nullable()).optional(),
});

export const SearchPayload = z.object({ data: z.array(CardPayload) });

export type CardPayload = z.infer<typeof CardPayload>;
