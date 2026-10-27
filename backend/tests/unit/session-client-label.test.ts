import { describe, expect, it } from "vitest";
import { sessionClientLabel } from "../../src/modules/identity/session-client-label.js";

describe("recognisable session hints without raw user-agent disclosure", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
      "Microsoft Edge on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox on Linux",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1",
      "Chrome on iPad",
    ],
    [
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 SamsungBrowser/28.0 Chrome/140.0 Mobile Safari/537.36",
      "Samsung Internet on Android",
    ],
    ["Mozilla/5.0", "Unrecognised browser"],
    ["<script>private-device-identifier</script>", "Unrecognised browser"],
    [null, "Browser details unavailable"],
  ])("labels %s as %s", (agent, label) => {
    expect(sessionClientLabel(agent)).toBe(label);
  });
});
