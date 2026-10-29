const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const managed = new RegExp(
  `^/api/v1/public/(vehicles/images|catalog/products/images|media/images)/(${uuid})$`,
  "i",
);
export const publicImageWidths = [320, 480, 640, 800, 1000] as const;

/** Only existing publication-checked public streams; never private/admin or arbitrary URLs. */
export function publicImageVariant(src: string, width: number): string | undefined {
  const match = managed.exec(src);
  if (!match || !(publicImageWidths as readonly number[]).includes(width))
    return undefined;
  return `/api/catalogue-image/${match[1]}/${match[2]}?w=${width}`;
}

export function publicImageSrcSet(
  src: string,
  sourceWidth?: number | null,
): string | undefined {
  if (!managed.test(src)) return undefined;
  const widths = publicImageWidths.filter(
    (width) => !sourceWidth || width <= sourceWidth,
  );
  return widths.length
    ? widths.map((width) => `${publicImageVariant(src, width)} ${width}w`).join(", ")
    : undefined;
}
