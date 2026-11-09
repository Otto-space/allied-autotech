import { render, screen } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
jest.mock("expo-router", () => ({ Stack: () => null }));
test.each([
  ["", "Set EXPO_PUBLIC_API_BASE_URL"],
  ["http://127.0.0.1:5000", "ending exactly in /api/v1"],
  ["https://api.alliedautotech.com/api/v1", "Production API access is blocked"],
])(
  "unsafe startup configuration renders an error without mounting network providers: %s",
  async (url, message) => {
    process.env.EXPO_PUBLIC_API_BASE_URL = url;
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API = "true";
    const view = await render(<RootLayout />);
    expect(screen.getByText("App configuration needed")).toBeTruthy();
    expect(screen.getByRole("alert").props.children).toContain(message);
    expect(global.fetch).not.toHaveBeenCalled();
    await view.unmount();
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_APP_ENV;
    delete process.env.EXPO_PUBLIC_ALLOW_PRODUCTION_API;
  },
);
