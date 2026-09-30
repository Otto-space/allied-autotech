import { z } from "zod";
import { mediaVersionSchema } from "../media/media.schemas.js";
import { serviceParamsSchema } from "./service-operations.schemas.js";
export const serviceImageParamsSchema = serviceParamsSchema
  .extend({ imageId: z.uuid() })
  .strict();
export const serviceImageUpdateSchema = mediaVersionSchema
  .extend({ altText: z.string().trim().max(240).nullable() })
  .strict();
