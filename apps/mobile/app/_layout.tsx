import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { validateApiBaseUrl } from "../src/api/client/environment";
import { AppProviders } from "../src/api/queries/provider";
import { TypographyProvider } from "../src/design/typography";
import { Screen, Text } from "../src/components/ui";

export default function RootLayout() {
  let baseUrl: string;
  try {
    baseUrl = validateApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  } catch (error) {
    return (
      <SafeAreaProvider>
        <Screen title="App configuration needed">
          <Text accessibilityRole="alert">
            {error instanceof Error
              ? error.message
              : "The API address could not be verified."}
          </Text>
        </Screen>
      </SafeAreaProvider>
    );
  }
  return (
    <SafeAreaProvider>
      <TypographyProvider>
        <StatusBar style="dark" />
        <AppProviders baseUrl={baseUrl}>
          <Stack screenOptions={{ headerShown: false, animation: "none" }} />
        </AppProviders>
      </TypographyProvider>
    </SafeAreaProvider>
  );
}
