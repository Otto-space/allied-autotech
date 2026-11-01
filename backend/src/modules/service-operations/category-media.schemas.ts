import { z } from "zod";
import { mediaVersionSchema } from "../media/media.schemas.js";
const categoryParamsSchema = z.object({ categoryId: z.uuid() }).strict();
export { categoryParamsSchema };
export const categoryImageParamsSchema = categoryParamsSchema
  .extend({ imageId: z.uuid() })
  .strict();
export const categoryImageUpdateSchema = mediaVersionSchema
  .extend({ altText: z.string().trim().max(240).nullable() })
  .strict();
