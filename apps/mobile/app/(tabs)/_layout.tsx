import { Tabs } from "expo-router";
import { useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, touchTarget } from "../../src/design/tokens";
import { Text } from "../../src/components/ui";
export const tabs = [
  { name: "index", title: "Home" },
  { name: "explore", title: "Explore" },
  { name: "garage", title: "Garage" },
  { name: "activity", title: "Activity" },
  { name: "you", title: "You" },
] as const;
function TabControl({
  label,
  selected,
  largeText,
  onPress,
  onLongPress,
}: {
  label: string;
  selected: boolean;
  largeText: boolean;
  onPress(): void;
  onLongPress(): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        width: largeText ? "33.333%" : "20%",
        minHeight: touchTarget,
        paddingHorizontal: 4,
        paddingVertical: 12,
        justifyContent: "center",
        borderWidth: 2,
        borderColor: focused ? colors.ink : "transparent",
        backgroundColor: pressed ? colors.canvas : colors.white,
      })}
    >
      <Text
        accessible={false}
        style={{
          fontSize: 13,
          lineHeight: 20,
          textAlign: "center",
          color: selected ? colors.action : colors.muted,
          fontWeight: selected ? "700" : "400",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export default function TabLayout() {
  const { fontScale } = useWindowDimensions();
  return (
    <Tabs
      tabBar={({ state, emitter, navigateToTab }) => (
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          style={{
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: colors.line,
          }}
        >
          <View
            accessibilityRole="tablist"
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              paddingVertical: 4,
            }}
          >
            {state.routes.map((route, index) => (
              <TabControl
                key={route.key}
                label={tabs.find((tab) => tab.name === route.name)?.title ?? route.name}
                selected={state.index === index}
                largeText={fontScale >= 1.5}
                onPress={() => {
                  const event = emitter.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (state.index !== index && !event.defaultPrevented)
                    navigateToTab(route.key);
                }}
                onLongPress={() =>
                  emitter.emit({ type: "tabLongPress", target: route.key })
                }
              />
            ))}
          </View>
        </SafeAreaView>
      )}
      screenOptions={{
        headerShown: false,
        animation: "none",
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.title,
          }}
        />
      ))}
    </Tabs>
  );
}
