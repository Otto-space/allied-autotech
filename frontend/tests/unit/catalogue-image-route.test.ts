import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "@/app/api/catalogue-image/[...path]/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const id = "f0000000-0000-4000-8000-000000000001";
const params = { params: Promise.resolve({ path: ["vehicles", "images", id] }) };
const request = (query = "w=320") =>
  new Request(`https://example.test/api/catalogue-image/vehicles/images/${id}?${query}`, {
    headers: { Cookie: "session=private", Authorization: "Bearer private" },
  });

it("rejects arbitrary paths and parameters before fetching", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const query of ["w=99999", "w=320&url=https://evil.test", "w=320&w=640", ""])
    expect((await GET(request(query), params)).status).toBe(400);
  expect(
    (
      await GET(request(), {
        params: Promise.resolve({
          path: ["staff", "vehicles", id, "images", id, "content"],
        }),
      })
    ).status,
  ).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
it("checks publication every time, bounds width and never forwards credentials or caches", async () => {
  vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
  vi.stubEnv("FRONTEND_PROXY_SECRET", "");
  const original = await sharp({
    create: { width: 640, height: 480, channels: 3, background: "#444" },
  })
    .webp()
    .toBuffer();
  const fetch = vi
    .fn()
    .mockImplementationOnce(
      async () =>
        new Response(new Uint8Array(original), {
          headers: { "Content-Type": "image/webp" },
        }),
    )
    .mockImplementationOnce(async () => new Response(null, { status: 404 }));
  vi.stubGlobal("fetch", fetch);
  const response = await GET(request(), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const image = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  expect([image.width, image.height, image.format]).toEqual([320, 240, "webp"]);
  expect(fetch.mock.calls[0][0]).toBe(
    `https://api.example.test/api/v1/public/vehicles/images/${id}`,
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
  });
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("Cookie");
  expect((await GET(request(), params)).status).toBe(404);
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("rejects non-images, oversized or corrupt sources instead of returning their contents", async () => {
  vi.stubEnv("BACKEND_ORIGIN", "https://api.example.test");
  vi.stubEnv("FRONTEND_PROXY_SECRET", "");
  for (const source of [
    new Response("private", { headers: { "Content-Type": "text/html" } }),
    new Response("bad", {
      headers: { "Content-Type": "image/webp", "Content-Length": "99999999" },
    }),
    new Response("not an image", { headers: { "Content-Type": "image/webp" } }),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(source));
    const response = await GET(request(), params);
    expect(response.status).toBe(502);
    expect(await response.text()).toBe("");
  }
});
