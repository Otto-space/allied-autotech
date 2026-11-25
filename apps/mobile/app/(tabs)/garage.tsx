import { Screen } from "../../src/components/ui";
import { EmptyState } from "../../src/components/feedback";
export default function Garage() {
  return (
    <Screen title="Garage" screenId="S10 Garage overview">
      <EmptyState
        title="Your vehicles belong here"
        message="Sign in will let you view your own garage. Sign-in is not available in this scaffold."
      />
    </Screen>
  );
}
