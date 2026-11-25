import { render, screen, fireEvent } from "@testing-library/react-native";
import type { ReactNode } from "react";
import TabLayout from "../../app/(tabs)/_layout";
const mockNavigate = jest.fn();
const mockEmit = jest.fn(() => ({ defaultPrevented: false }));
// Use the real custom bar, with Router's state/events controlled in this unit.
jest.mock("expo-router", () => {
  const Tabs = ({ tabBar }: { tabBar: (props: object) => ReactNode }) =>
    tabBar({
      state: {
        index: 0,
        routes: ["index", "explore", "garage", "activity", "you"].map((name) => ({
          key: name,
          name,
        })),
      },
      emitter: { emit: mockEmit },
      navigateToTab: mockNavigate,
    });
  Tabs.Screen = function TabScreen() {
    return null;
  };
  return { Tabs };
});
test("five-tab shell renders Home, Explore, Garage, Activity, You", async () => {
  await render(<TabLayout />);
  for (const name of ["Home", "Explore", "Garage", "Activity", "You"])
    expect(screen.getByRole("tab", { name })).toBeTruthy();
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(mockEmit).toHaveBeenCalledWith({
    type: "tabPress",
    target: "explore",
    canPreventDefault: true,
  });
  expect(mockNavigate).toHaveBeenCalledWith("explore");
});
