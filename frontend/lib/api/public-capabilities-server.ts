import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { publicData } from "./public-server";
import { capabilityView, parsePublicCapabilities } from "../public-capabilities";

// React cache deduplicates only within this server render, never between visitors.
export const getPublicCapabilities = cache(async () => {
  try {
    return capabilityView(
      await publicData("/public/capabilities", parsePublicCapabilities),
    );
  } catch (error) {
    unstable_rethrow(error);
    return capabilityView(null);
  }
});
