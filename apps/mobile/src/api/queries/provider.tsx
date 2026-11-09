import { useEffect, useState, type PropsWithChildren } from "react";
import { AppState, View, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { QueryClientProvider, onlineManager, focusManager } from "@tanstack/react-query";
import { createApiClient } from "../client";
import { ApiContext } from "../client/context";
import { makeQueryClient } from ".";
import { OfflineBanner, UnavailableCapabilityNotice } from "../../components/feedback";
import { SessionProvider } from "../../auth/session";
import { CapabilitiesProvider } from "../../capabilities";

export function AppProviders({
  baseUrl,
  children,
}: PropsWithChildren<{ baseUrl: string }>) {
  const { height } = useWindowDimensions();
  const [api] = useState(() => createApiClient(baseUrl));
  const [notice, setNotice] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [client] = useState(() =>
    makeQueryClient((error, resource, queryClient) => {
      setNotice(error.message);
      // Every 403 is treated conservatively. Never replay an operation. Avoid a
      // refetch loop when the capabilities read itself is forbidden by a perimeter.
      queryClient.setQueriesData(
        { predicate: (query) => query.queryKey[2] === "capabilities" },
        null,
      );
      if (resource !== "capabilities")
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[2] === "capabilities",
        });
    }),
  );
  useEffect(() => {
    const stopNetwork = NetInfo.addEventListener((state) => {
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setOffline(!connected);
      onlineManager.setOnline(connected);
    });
    const subscription = AppState.addEventListener("change", (state) =>
      focusManager.setFocused(state === "active"),
    );
    return () => {
      stopNetwork();
      subscription.remove();
    };
  }, []);
  return (
    <QueryClientProvider client={client}>
      <ApiContext.Provider value={api}>
        <SessionProvider>
          <CapabilitiesProvider>
            <View style={{ flex: 1 }}>
              {offline || notice ? (
                <SafeAreaView
                  edges={["top", "left", "right"]}
                  style={{ maxHeight: height * 0.4 }}
                >
                  <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                    {offline ? <OfflineBanner /> : null}
                    {notice ? <UnavailableCapabilityNotice message={notice} /> : null}
                  </ScrollView>
                </SafeAreaView>
              ) : null}
              {children}
            </View>
          </CapabilitiesProvider>
        </SessionProvider>
      </ApiContext.Provider>
    </QueryClientProvider>
  );
}
