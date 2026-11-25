import { render, screen, fireEvent } from "@testing-library/react-native";
import { Button, StatusBadge } from "../../src/components/ui";
test("MOB-020 Button exposes role, label and interaction; status always includes text", async () => {
  const press = jest.fn();
  await render(
    <>
      <Button label="Try again" onPress={press} />
      <StatusBadge label="Signed out" />
    </>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(press).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("text", { name: "Signed out" })).toBeTruthy();
  expect(screen.getByText("Signed out")).toBeTruthy();
});
