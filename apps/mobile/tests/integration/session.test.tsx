import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { secureStorage } from "../../src/auth/secure-storage";
import { SessionProvider, useSession } from "../../src/auth/session";
import { makeQueryClient, queryKey } from "../../src/api/queries";
import { Button, Text } from "../../src/components/ui";
function Probe() {
  const session = useSession();
  return (
    <>
      <Text>
        {session.status}:{session.sessionGeneration}
      </Text>
      <Button
        label="Sign out stub"
        onPress={() => {
          void session.signOut();
        }}
      />
    </>
  );
}
test("MOB-018 sign-out stub clears secure storage, private queries and bumps generation", async () => {
  const client = makeQueryClient();
  await secureStorage.set("synthetic-fixture", "not-a-token");
  client.setQueryData(queryKey("private", 0, "fixture"), "synthetic-private-data");
  await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Sign out stub" }));
  await waitFor(() => expect(screen.getByText("signed_out:1")).toBeTruthy());
  expect(await secureStorage.get("synthetic-fixture")).toBeNull();
  expect(client.getQueryData(queryKey("private", 0, "fixture"))).toBeUndefined();
  client.clear();
});
