const error = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } },
  },
});

export const mediaErrorResponses = {
  404: error(
    "NOT_FOUND for unavailable or unowned resources; MEDIA_OBJECT_MISSING when an authorized pending object is absent.",
  ),
  409: error(
    "STALE_VERSION, MEDIA_COUNT_LIMIT, MEDIA_LAST_PUBLISHED_IMAGE or MEDIA_TICKET_CONSUMED. Reread authoritative state before a new mutation; exact confirmation retries retain their original token and body.",
  ),
  422: error(
    "VALIDATION_FAILED or MEDIA_INVALID, MEDIA_UNSUPPORTED_FORMAT, MEDIA_TOO_LARGE, MEDIA_INVALID_DIMENSIONS, MEDIA_CHECKSUM_MISMATCH, MEDIA_TICKET_EXPIRED, MEDIA_TICKET_INVALID, MEDIA_WRONG_PURPOSE or MEDIA_WRONG_RESOURCE. Current attached images are preserved.",
  ),
  503: error(
    "MEDIA_STORAGE_UNAVAILABLE. Storage details and credentials are withheld. Reread the resource after an uncertain confirmation; preparation and validation failures preserve existing images.",
  ),
};
