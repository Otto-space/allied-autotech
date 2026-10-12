// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DisputeProviderFacts } from "@/app/components/dispute-provider-facts";
import { disputeFixture } from "../fixtures/dispute-work";
import { parseDisputes } from "@/lib/api/operations-schemas";
import { formatKobo } from "@/lib/format/money";
afterEach(cleanup);
it("shows the confirmed partial chargeback independently from the disputed amount", () => {
  const dispute = parseDisputes({
    items: [
      {
        ...disputeFixture(),
        chargebackAmountKobo: "1200",
        providerStatus: "resolved",
        providerResolution: "merchant-accepted",
      },
    ],
  }).items[0];
  render(
    <dl>
      <DisputeProviderFacts dispute={dispute} />
    </dl>,
  );
  expect(screen.getByText(formatKobo("1200"))).toBeTruthy();
  expect(screen.queryByText(formatKobo(dispute.amountKobo))).toBeNull();
  expect(screen.getByText("merchant accepted")).toBeTruthy();
});
it("keeps unconfirmed provider outcomes visible without displaying an invented loss", () => {
  render(
    <dl>
      <DisputeProviderFacts
        dispute={{
          ...disputeFixture(),
          providerReviewReason: "UNCONFIRMED_PROVIDER_RESOLUTION",
          providerResolution: "declined",
        }}
      />
    </dl>,
  );
  expect(screen.getByText("Not confirmed")).toBeTruthy();
  expect(screen.getByText(/provider outcome needs review/)).toBeTruthy();
  expect(screen.getByText("declined")).toBeTruthy();
});
