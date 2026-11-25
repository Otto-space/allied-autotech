import { Screen } from "../../src/components/ui";
import { EmptyState } from "../../src/components/feedback";
export default function Activity() {
  return (
    <Screen title="Activity" screenId="S20 Activity center">
      <EmptyState
        title="Follow your requests here"
        message="Sign in will let you view your own updates and history. Sign-in is not available in this scaffold."
      />
    </Screen>
  );
}
