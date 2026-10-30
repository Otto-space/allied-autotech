import sharp from "sharp";
import { backendOrigin } from "@/lib/backend-origin";
import { backendClientAddress, frontendProxySecret } from "@/lib/backend-client-address";
import { publicImageVariant, publicImageWidths } from "@/lib/public-image-variants";

export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const maxBytes = 8 * 1024 * 1024;
function unavailable(status: number) {
  return new Response(null, { status, headers });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const url = new URL(request.url);
  const width = Number(url.searchParams.get("w"));
  const path = `/api/v1/public/${(await context.params).path.join("/")}`;
  if (
    url.searchParams.size !== 1 ||
    !url.searchParams.has("w") ||
    url.searchParams.get("w") !== String(width) ||
    !(publicImageWidths as readonly number[]).includes(width) ||
    !publicImageVariant(path, width)
  )
    return unavailable(400);
  const origin = backendOrigin();
  if (!origin) return unavailable(503);
  try {
    // Re-read the existing public endpoint on EVERY request. Unpublished/deleted
    // media cannot survive in a derivative cache, and no user credentials travel upstream.
    const response = await fetch(`${origin}${path}`, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
      headers: {
        Accept: "image/webp,image/jpeg,image/png",
        ...(frontendProxySecret()
          ? backendClientAddress(request.headers, "GET", path)
          : {}),
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      return unavailable(response.status === 404 ? 404 : 502);
    }
    if (
      !/^image\/(webp|jpeg|png)(;|$)/i.test(response.headers.get("content-type") ?? "") ||
      Number(response.headers.get("content-length")) > maxBytes ||
      !response.body
    ) {
      await response.body?.cancel();
      return unavailable(502);
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) {
          await reader.cancel();
          return unavailable(502);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = await sharp(Buffer.concat(chunks), {
      limitInputPixels: 24_000_000,
      animated: false,
      failOn: "warning",
    })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 3 })
      .toBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return unavailable(502);
  }
}
