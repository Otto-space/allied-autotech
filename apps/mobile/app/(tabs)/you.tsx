import { Screen, Text, StatusBadge } from "../../src/components/ui";
export default function You() {
  return (
    <Screen title="You" screenId="S24 You / Profile / Privacy / Security">
      <StatusBadge label="Signed out" />
      <Text>
        Account, privacy and security settings will be here. Sign-in and account changes
        are not available in this scaffold.
      </Text>
    </Screen>
  );
}
