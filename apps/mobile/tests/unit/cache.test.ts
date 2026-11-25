import { makeQueryClient, queryKey, clearPrivateCache } from "../../src/api/queries";
test("MOB-018 query generations isolate private records and clearing retains public data", async () => {
  const client = makeQueryClient();
  expect(queryKey("private", 1, "garage")).not.toEqual(queryKey("private", 2, "garage"));
  client.setQueryData(queryKey("private", 1, "garage"), { privateFixture: true });
  client.setQueryData(queryKey("public", 1, "services"), { items: [] });
  await clearPrivateCache(client);
  expect(client.getQueryData(queryKey("private", 1, "garage"))).toBeUndefined();
  expect(client.getQueryData(queryKey("public", 1, "services"))).toEqual({ items: [] });
  client.clear();
});
