import { useState, type PropsWithChildren } from "react";
import {
  ScrollView,
  Text as NativeText,
  Pressable,
  View,
  type TextProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, touchTarget } from "../../design/tokens";
import { useBrandFonts } from "../../design/typography";

export function Text({ style, ...props }: TextProps) {
  const fonts = useBrandFonts();
  return (
    <NativeText
      {...props}
      allowFontScaling
      maxFontSizeMultiplier={0}
      style={[
        {
          fontSize: 16,
          lineHeight: 25,
          color: colors.body,
          fontFamily: fonts ? "Quicksand_400Regular" : undefined,
        },
        style,
      ]}
    />
  );
}
export function Screen({
  children,
  title,
  screenId,
}: PropsWithChildren<{ title: string; screenId?: string }>) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 32, gap: 24 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, lineHeight: 38, fontWeight: "700", color: colors.ink }}
        >
          {title}
        </Text>
        {screenId ? <Text style={{ color: colors.muted }}>{screenId}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress(): void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => ({
        minHeight: touchTarget,
        minWidth: touchTarget,
        paddingVertical: 12,
        paddingHorizontal: 16,
        justifyContent: "center",
        borderRadius: radius.control,
        borderWidth: 2,
        borderColor: focused
          ? colors.ink
          : variant === "secondary"
            ? colors.line
            : "transparent",
        backgroundColor:
          variant === "primary"
            ? pressed
              ? colors.actionPressed
              : colors.action
            : variant === "secondary"
              ? colors.surface
              : "transparent",
        opacity: disabled ? 0.55 : 1,
      })}
    >
      <Text
        style={{
          color: variant === "primary" ? colors.white : colors.ink,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        borderRadius: radius.card,
        backgroundColor: colors.surface,
        padding: 16,
        gap: 12,
      }}
    >
      {children}
    </View>
  );
}
export function StatusBadge({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        padding: 8,
        backgroundColor: colors.surface,
        borderRadius: 10,
      }}
    >
      <Text
        accessibilityRole="text"
        accessibilityLabel={label}
        style={{ fontWeight: "600" }}
      >
        {label}
      </Text>
    </View>
  );
}
